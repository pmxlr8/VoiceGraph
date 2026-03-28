"""Graph UI tools — emit WebSocket events to control the frontend
3D force-graph visualization.

Each function is registered as an ADK tool. Docstrings serve as the
tool descriptions visible to the LLM.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from agents import context as ctx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helper — broadcast a WebSocket event to all connected frontend clients
# ---------------------------------------------------------------------------


def _broadcast(event: dict) -> None:
    """Send an event via WebSocket broadcast. Falls back to logging if
    the broadcast function is not configured."""
    fn = ctx.ws_broadcast
    if fn is None:
        logger.info("ws_broadcast not set — event logged: %s", event.get("type"))
        return

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(fn(event))
    except RuntimeError:
        # No running event loop — run synchronously
        asyncio.run(fn(event))


# ---------------------------------------------------------------------------
# Helper — run Cypher
# ---------------------------------------------------------------------------


def _run_cypher(cypher: str) -> list[dict]:
    client = ctx.neo4j_client
    if client is None:
        return []
    try:
        return client.run_query(cypher)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cypher execution failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Tool: highlight_nodes
# ---------------------------------------------------------------------------


def highlight_nodes(node_ids: list[str], edge_ids: list[str] = []) -> dict:
    """Highlight specific nodes and edges in the graph visualization.
    Non-highlighted nodes dim to 20% opacity. Always call this after
    a query to visually show the user which parts of the graph are relevant."""

    _broadcast({
        "type": "highlight",
        "node_ids": node_ids,
        "edge_ids": edge_ids,
    })

    return {
        "highlighted_nodes": len(node_ids),
        "highlighted_edges": len(edge_ids),
        "message": f"Highlighted {len(node_ids)} nodes and {len(edge_ids)} edges.",
    }


# ---------------------------------------------------------------------------
# Tool: expand_node
# ---------------------------------------------------------------------------


def expand_node(node_id: str) -> dict:
    """Expand a node to show its neighbors in the graph visualization.
    Loads neighbors from Neo4j and sends them to the frontend for rendering."""

    _broadcast({
        "type": "expand_node",
        "node_id": node_id,
    })

    return {
        "node_id": node_id,
        "message": f"Expand event sent for node '{node_id}'.",
    }


# ---------------------------------------------------------------------------
# Tool: dim_nodes
# ---------------------------------------------------------------------------


def dim_nodes() -> dict:
    """Clear all highlights and restore normal graph view.
    All nodes return to full opacity."""

    _broadcast({
        "type": "dim",
    })

    return {
        "message": "All highlights cleared. Graph restored to normal view.",
    }


# ---------------------------------------------------------------------------
# Tool: add_node
# ---------------------------------------------------------------------------


def add_node(name: str, entity_type: str, description: str = "") -> dict:
    """Add a new entity to the knowledge graph and display it in the
    visualization. Creates the node in Neo4j and notifies the frontend."""

    client = ctx.neo4j_client
    node_id = None

    if client is not None:
        try:
            cypher = (
                f"CREATE (n:`{entity_type}` {{name: $name, description: $desc}}) "
                f"RETURN elementId(n) AS id"
            )
            results = client.run_query(cypher, {"name": name, "desc": description})
            if results:
                node_id = results[0].get("id")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to create node in Neo4j: %s", exc)

    _broadcast({
        "type": "add_node",
        "node": {
            "id": node_id or f"temp_{name}",
            "name": name,
            "entity_type": entity_type,
            "description": description,
        },
    })

    return {
        "node_id": node_id or f"temp_{name}",
        "name": name,
        "entity_type": entity_type,
        "created_in_neo4j": node_id is not None,
        "message": f"Created entity '{name}' of type '{entity_type}'.",
    }


# ---------------------------------------------------------------------------
# Tool: add_relationship
# ---------------------------------------------------------------------------


def add_relationship(source_name: str, target_name: str, relationship_type: str) -> dict:
    """Add a new relationship between two existing entities in the knowledge
    graph. Connects them in Neo4j and updates the visualization."""

    client = ctx.neo4j_client
    created = False

    if client is not None:
        try:
            cypher = (
                "MATCH (a {name: $source}), (b {name: $target}) "
                f"CREATE (a)-[r:`{relationship_type}`]->(b) "
                "RETURN elementId(r) AS id"
            )
            results = client.run_query(cypher, {
                "source": source_name,
                "target": target_name,
            })
            created = bool(results)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to create relationship in Neo4j: %s", exc)

    _broadcast({
        "type": "add_edge",
        "edge": {
            "source": source_name,
            "target": target_name,
            "type": relationship_type,
        },
    })

    return {
        "source": source_name,
        "target": target_name,
        "relationship_type": relationship_type,
        "created_in_neo4j": created,
        "message": f"Created relationship '{source_name}' --[{relationship_type}]--> '{target_name}'.",
    }
