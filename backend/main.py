"""VoiceGraph Backend — FastAPI application entry point."""

import asyncio
import json
import logging
import random
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as graph_router
from graph.neo4j_client import Neo4jClient
from ingestion.job_manager import JobManager
from extraction.ontology_manager import OntologyManager
from agents import context as agent_ctx
from voice.session import VoiceSession

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connected client tracking
# ---------------------------------------------------------------------------

connected_clients: list[WebSocket] = []

# Map each WebSocket to its active VoiceSession (if any)
voice_sessions: dict[WebSocket, VoiceSession] = {}


# ---------------------------------------------------------------------------
# Sample graph data (AI/ML knowledge graph)
# ---------------------------------------------------------------------------

SAMPLE_NODES = [
    {"id": "ai", "label": "Artificial Intelligence", "type": "Field", "properties": {"description": "The simulation of human intelligence by machines"}},
    {"id": "ml", "label": "Machine Learning", "type": "Field", "properties": {"description": "Subset of AI that learns from data"}},
    {"id": "dl", "label": "Deep Learning", "type": "Method", "properties": {"description": "ML using neural networks with many layers"}},
    {"id": "nn", "label": "Neural Networks", "type": "Technology", "properties": {"description": "Computing systems inspired by biological neural networks"}},
    {"id": "transformer", "label": "Transformer", "type": "Architecture", "properties": {"description": "Attention-based architecture for sequence modeling"}},
    {"id": "nlp", "label": "Natural Language Processing", "type": "Field", "properties": {"description": "AI subfield dealing with human language"}},
    {"id": "cv", "label": "Computer Vision", "type": "Field", "properties": {"description": "AI subfield for visual understanding"}},
    {"id": "gpt", "label": "GPT-4", "type": "Model", "properties": {"description": "Generative Pre-trained Transformer by OpenAI"}},
    {"id": "openai", "label": "OpenAI", "type": "Organization", "properties": {"description": "AI research organization"}},
    {"id": "google", "label": "Google DeepMind", "type": "Organization", "properties": {"description": "AI research lab at Google"}},
    {"id": "hinton", "label": "Geoffrey Hinton", "type": "Person", "properties": {"description": "Pioneer of deep learning"}},
    {"id": "attention", "label": "Attention Mechanism", "type": "Concept", "properties": {"description": "Mechanism allowing models to focus on relevant parts of input"}},
    {"id": "rl", "label": "Reinforcement Learning", "type": "Method", "properties": {"description": "Learning through interaction with an environment"}},
    {"id": "alphago", "label": "AlphaGo", "type": "Model", "properties": {"description": "First AI to defeat a world champion at Go"}},
    {"id": "stanford", "label": "Stanford University", "type": "Organization", "properties": {"description": "Leading AI research university"}},
]

SAMPLE_EDGES = [
    {"id": "e1", "source": "ai", "target": "ml", "label": "includes"},
    {"id": "e2", "source": "ml", "target": "dl", "label": "includes"},
    {"id": "e3", "source": "dl", "target": "nn", "label": "uses"},
    {"id": "e4", "source": "nn", "target": "transformer", "label": "variant_of"},
    {"id": "e5", "source": "transformer", "target": "nlp", "label": "applied_to"},
    {"id": "e6", "source": "transformer", "target": "attention", "label": "based_on"},
    {"id": "e7", "source": "ai", "target": "nlp", "label": "subfield"},
    {"id": "e8", "source": "ai", "target": "cv", "label": "subfield"},
    {"id": "e9", "source": "gpt", "target": "transformer", "label": "based_on"},
    {"id": "e10", "source": "openai", "target": "gpt", "label": "created"},
    {"id": "e11", "source": "hinton", "target": "dl", "label": "pioneered"},
    {"id": "e12", "source": "hinton", "target": "google", "label": "worked_at"},
    {"id": "e13", "source": "google", "target": "alphago", "label": "developed"},
    {"id": "e14", "source": "alphago", "target": "rl", "label": "uses"},
    {"id": "e15", "source": "ml", "target": "rl", "label": "includes"},
    {"id": "e16", "source": "stanford", "target": "ai", "label": "researches"},
    {"id": "e17", "source": "dl", "target": "cv", "label": "applied_to"},
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def send_event(ws: WebSocket, event: dict[str, Any]) -> None:
    """Serialize and send a server event as JSON."""
    try:
        await ws.send_text(json.dumps(event))
    except Exception:
        logger.exception("Failed to send event to client")


async def broadcast_event(event: dict[str, Any], exclude: WebSocket | None = None) -> None:
    """Send an event to all connected clients, optionally excluding one."""
    for client in connected_clients:
        if client is not exclude:
            await send_event(client, event)


def _normalize_node(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert a Neo4j-style node dict to the frontend GraphNode format."""
    # Already in frontend format (has 'label' key)
    if "label" in raw:
        return raw
    # Neo4j format: {id, labels: [...], properties: {name, ...}}
    labels_list = raw.get("labels", [])
    props = raw.get("properties", {})
    return {
        "id": raw["id"],
        "label": props.get("name", raw["id"]),
        "type": labels_list[0] if labels_list else "Concept",
        "properties": props,
    }


def _normalize_edge(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert a Neo4j-style edge dict to the frontend GraphEdge format."""
    # Already in frontend format (has 'label' key)
    if "label" in raw:
        return raw
    # Neo4j format: {id, type: "REL_TYPE", source, target, properties}
    return {
        "id": raw["id"],
        "source": raw["source"],
        "target": raw["target"],
        "label": raw.get("type", "related_to").lower(),
        "properties": raw.get("properties", {}),
    }


async def send_initial_graph(ws: WebSocket, app: FastAPI) -> None:
    """Send the full graph to a newly connected client."""
    client = getattr(app.state, "neo4j_client", None)
    if client is not None:
        graph = await client.get_full_graph()
        raw_nodes = graph["nodes"]
        raw_edges = graph["edges"]
        nodes = [_normalize_node(n) for n in raw_nodes]
        edges = [_normalize_edge(e) for e in raw_edges]
    else:
        nodes = SAMPLE_NODES
        edges = SAMPLE_EDGES
    await send_event(ws, {
        "type": "graph_update",
        "nodes": nodes,
        "edges": edges,
    })


async def handle_text_input(ws: WebSocket, event: dict[str, Any]) -> None:
    """Handle a text_input event: echo transcript + simulate thinking + highlight."""
    text = event.get("text", "")

    # Get current graph from Neo4j client (includes ingested nodes)
    client = getattr(app.state, "neo4j_client", None)
    if client is not None:
        graph = await client.get_full_graph()
        all_nodes = [_normalize_node(n) for n in graph["nodes"]]
        all_edges = [_normalize_edge(e) for e in graph["edges"]]
    else:
        all_nodes = SAMPLE_NODES
        all_edges = SAMPLE_EDGES

    if not all_nodes:
        all_nodes = SAMPLE_NODES
        all_edges = SAMPLE_EDGES

    # Send transcript echo
    await send_event(ws, {
        "type": "transcript",
        "role": "user",
        "text": text,
    })

    # --- Phase 1: Thinking starts, graph dims ---
    await send_event(ws, {
        "type": "thinking_start",
        "query": text,
    })
    await asyncio.sleep(0.6)

    # --- Phase 2: Search — visit nodes one by one with deliberate pacing ---
    num_to_visit = min(6, len(all_nodes))
    visited_nodes = random.sample(all_nodes, num_to_visit)

    thinking_steps = [
        ("Analyzing query structure...", "🧠", None),
        (f"Searching {len(all_nodes)} entities...", "🔍", None),
    ]

    for step_text, icon, node_id in thinking_steps:
        await asyncio.sleep(0.8)
        await send_event(ws, {
            "type": "thinking_step",
            "step": step_text,
            "icon": icon,
            "nodeId": node_id,
        })

    # Visit each node with a dramatic pause
    for i, node in enumerate(visited_nodes):
        await asyncio.sleep(0.7)
        verbs = ["Examining", "Inspecting", "Evaluating", "Analyzing", "Scanning", "Checking"]
        await send_event(ws, {
            "type": "thinking_step",
            "step": f"{verbs[i % len(verbs)]}: {node['label']}",
            "icon": "👁" if i < len(visited_nodes) - 1 else "✅",
            "nodeId": node["id"],
        })

    # --- Phase 3: Traverse edges connecting visited nodes ---
    visited_ids = {n["id"] for n in visited_nodes}
    relevant_edges = [
        e for e in all_edges
        if e["source"] in visited_ids and e["target"] in visited_ids
    ]
    # Also include edges where at least one end is visited
    if len(relevant_edges) < 3:
        relevant_edges = [
            e for e in all_edges
            if e["source"] in visited_ids or e["target"] in visited_ids
        ]

    await asyncio.sleep(0.5)
    await send_event(ws, {
        "type": "thinking_step",
        "step": f"Tracing {min(4, len(relevant_edges))} connections...",
        "icon": "🔗",
        "nodeId": None,
    })

    for edge in relevant_edges[:4]:
        await asyncio.sleep(0.6)
        await send_event(ws, {
            "type": "thinking_traverse",
            "fromId": edge["source"],
            "toId": edge["target"],
            "edgeId": edge["id"],
            "delay_ms": 500,
        })

    # --- Phase 4: Ripple effect from a central result node ---
    if visited_nodes:
        center = random.choice(visited_nodes)
        # Find 1-hop neighbors
        neighbor_ids = set()
        for e in all_edges:
            if e["source"] == center["id"]:
                neighbor_ids.add(e["target"])
            elif e["target"] == center["id"]:
                neighbor_ids.add(e["source"])

        if neighbor_ids:
            await asyncio.sleep(0.5)
            await send_event(ws, {
                "type": "thinking_ripple",
                "centerId": center["id"],
                "rings": [list(neighbor_ids)[:6]],
            })

    # --- Phase 5: Complete — hold the result highlight ---
    await asyncio.sleep(0.8)
    result_node_ids = list(visited_ids)
    result_edge_ids = [e["id"] for e in relevant_edges[:4]]

    await send_event(ws, {
        "type": "thinking_complete",
        "resultNodeIds": result_node_ids,
        "resultEdgeIds": result_edge_ids,
    })

    # Agent response
    labels = [n["label"] for n in visited_nodes[:4]]
    await send_event(ws, {
        "type": "transcript",
        "role": "agent",
        "text": f"I found {len(result_node_ids)} relevant concepts related to \"{text}\": {', '.join(labels)}.",
    })


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown of long-lived resources."""
    # Neo4j
    client = Neo4jClient()
    await client.connect()
    app.state.neo4j_client = client
    logger.info("Neo4j client ready (connected=%s)", client.available)

    # Ingestion job manager
    app.state.job_manager = JobManager()

    # Ontology manager (shared instance for extraction)
    app.state.ontology_manager = OntologyManager()

    # Broadcast function — accessible by routes and ingestion tasks
    app.state.broadcast_fn = broadcast_event

    # Populate shared agent context so ADK tools can access resources
    agent_ctx.neo4j_client = client
    agent_ctx.ontology_manager = app.state.ontology_manager
    agent_ctx.ws_broadcast = broadcast_event

    yield
    await client.close()


app = FastAPI(
    title="VoiceGraph API",
    description="Knowledge-graph voice assistant backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(graph_router)


# ---------------------------------------------------------------------------
# Health check (standalone — not part of the graph router)
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    """Return service health status."""
    client = getattr(app.state, "neo4j_client", None)
    return {
        "status": "ok",
        "service": "voicegraph-backend",
        "neo4j_connected": client.available if client else False,
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint — voice interaction channel
# ---------------------------------------------------------------------------


@app.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket):
    """Accept a WebSocket connection for real-time voice interaction.

    Protocol:
      - Client sends JSON events (see api/events.py for schemas).
      - Server responds with appropriate server events.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info("Client connected. Total clients: %d", len(connected_clients))

    try:
        # Send initial graph data to the newly connected client
        await send_initial_graph(websocket, app)

        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                await send_event(websocket, {
                    "type": "error",
                    "message": "Invalid JSON",
                })
                continue

            event_type = event.get("type")

            if event_type == "text_input":
                # If a voice session is active, forward text to Gemini
                voice_session = voice_sessions.get(websocket)
                if voice_session and voice_session.active:
                    text = event.get("text", "")
                    await send_event(websocket, {
                        "type": "transcript",
                        "role": "user",
                        "text": text,
                    })
                    await voice_session.send_text(text)
                else:
                    await handle_text_input(websocket, event)

            elif event_type == "start_voice":
                # Create and start a new voice session
                if websocket in voice_sessions and voice_sessions[websocket].active:
                    await send_event(websocket, {
                        "type": "error",
                        "message": "Voice session already active.",
                    })
                else:
                    async def _make_sender(ws: WebSocket):
                        async def _send(evt: dict[str, Any]) -> None:
                            await send_event(ws, evt)
                        return _send

                    sender = await _make_sender(websocket)
                    session = VoiceSession(send_event=sender)
                    voice_sessions[websocket] = session
                    await session.start()

            elif event_type == "stop_voice":
                # Close the active voice session
                voice_session = voice_sessions.pop(websocket, None)
                if voice_session:
                    await voice_session.close()
                    await send_event(websocket, {
                        "type": "voice_stopped",
                        "message": "Voice session ended.",
                    })

            elif event_type == "audio_chunk":
                # Forward audio to the active voice session
                voice_session = voice_sessions.get(websocket)
                if voice_session and voice_session.active:
                    audio_data = event.get("data", "")
                    if audio_data:
                        await voice_session.send_audio(audio_data)
                else:
                    logger.debug("Received audio_chunk but no active voice session")

            elif event_type == "ingest_document":
                # Handle inline ingestion request via WebSocket
                source = event.get("source", "")
                source_type = event.get("source_type", "text")
                if not source:
                    await send_event(websocket, {
                        "type": "error",
                        "message": "ingest_document requires a 'source' field.",
                    })
                else:
                    from ingestion.ingest import run_ingestion
                    jm = app.state.job_manager
                    job = jm.create_job(source_type=source_type, source_preview=source[:200])
                    await send_event(websocket, {
                        "type": "ingestion_status",
                        "job_id": job.id,
                        "status": "started",
                        "progress": 0.0,
                    })
                    # Run in background so the WS loop stays responsive
                    asyncio.create_task(run_ingestion(
                        job_id=job.id,
                        source_type=source_type,
                        content=source,
                        job_manager=jm,
                        neo4j_client=app.state.neo4j_client,
                        ontology_manager=app.state.ontology_manager,
                        broadcast_fn=broadcast_event,
                    ))

            elif event_type == "graph_action":
                # Handle graph actions (expand, collapse, pin)
                action = event.get("action")
                node_id = event.get("nodeId")
                logger.info("Graph action: %s on node %s", action, node_id)
                await send_event(websocket, {
                    "type": "highlight",
                    "nodeIds": [node_id] if node_id else [],
                    "edgeIds": [],
                })

            else:
                await send_event(websocket, {
                    "type": "error",
                    "message": f"Unknown event type: {event_type}",
                })

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        # Clean up voice session if active
        voice_session = voice_sessions.pop(websocket, None)
        if voice_session:
            await voice_session.close()

        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("Remaining clients: %d", len(connected_clients))
