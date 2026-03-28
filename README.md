# VoiceGraph

**Talk to your data. See it think.**

VoiceGraph is a voice-first interactive knowledge graph platform that transforms unstructured data into rich, explorable knowledge graphs through natural conversation. Upload documents, PDFs, YouTube videos, or URLs — then talk to the graph using real-time voice to ask questions, explore connections, and refine the ontology, all while watching the AI reason visually across your data in 3D.

Built for the [NYC Build With AI Hackathon](https://lu.ma/NYC-Build-with-AI).

---

## Why This Exists

Knowledge is trapped in disconnected silos. Research papers, meeting notes, URLs, videos, CSVs — valuable information lives in dozens of formats across dozens of tools, and nothing connects to anything.

**Search fails at relationships.** Keyword search finds documents, not insights. "How does X relate to Y?" is unanswerable unless you manually trace connections yourself.

**RAG isn't enough.** Vanilla RAG retrieves text chunks via cosine similarity and stuffs them into a prompt. It has no concept of entities, relationships, or graph structure. It can't traverse connections, find paths, or show you the shape of what you know. A chunk doesn't know that "Einstein" in paragraph 3 is the same person as "Albert" in paragraph 47.

**We don't need more text answers. We need to see connections.**

---

## Why VoiceGraph Is Not "Just Another RAG App"

### Standard RAG pipeline:
```
Document → chunk into 512-token pieces → embed → vector DB
Question → embed → cosine similarity → top-K chunks → stuff into prompt → LLM answers
```
Chunks are dumb. No entity awareness, no relationship tracking, no structural understanding.

### VoiceGraph pipeline:
```
Document → Phase A: schema-free entity/relationship discovery (no constraints, max recall)
         → Phase B: LLM generates formal OWL ontology from discovered patterns
         → Phase C: ontology-guided precision re-extraction + per-chunk ontology subsetting
         → Entity resolution: exact match + fuzzy match + semantic dedup
         → Result: typed, deduplicated, provenance-tracked knowledge graph in Neo4j
```

This is the difference between "find me similar text" and "build me a structured model of reality from these documents."

---

## How It Compares

### vs. ChatGPT / Gemini
GPT and Gemini are stateless text transformers. You paste text in, you get text out. No persistent structure, no accumulated knowledge, no ability to traverse relationships. Even with file uploads, they treat documents as disposable context.

VoiceGraph builds a **persistent, queryable knowledge structure** that grows over time. Every document adds to the graph. Connections across documents from different sources emerge automatically through entity resolution. Ask GPT "how does X from paper A relate to Y from paper B?" and it needs both papers in context. Ask VoiceGraph the same thing and it traverses a pre-built graph path — the connection already exists as a first-class relationship.

### vs. NotebookLM
NotebookLM is excellent for conversational Q&A over a document collection. But it has zero structural awareness. It can't answer:

- "What's the shortest path between Einstein and CERN?" — requires graph traversal
- "Which entity is the most connected hub?" — requires degree centrality
- "Show me all organizations connected to people in quantum physics" — requires typed Cypher with label constraints
- "What clusters of topics exist?" — requires community detection algorithms
- "Add 'Research Lab' as a new entity type and re-scan everything" — requires ontology mutation

NotebookLM also has no visualization. You can't *see* your knowledge. VoiceGraph renders a live 3D graph where you watch the AI reason — nodes light up, paths illuminate, ripples expand. Visualization reveals patterns that text answers fundamentally cannot: clusters, bridges, isolated nodes, hub entities, missing connections.

### vs. Neo4j Browser
Powerful, but requires Cypher expertise. VoiceGraph makes graph querying accessible through natural voice conversation — you speak, the agent writes the Cypher.

### vs. TrustGraph
Excellent ontology-guided extraction, but 34 microservices, 12GB RAM, $180-250/mo on GKE. VoiceGraph borrows the ontology subsetting pattern but runs on Neo4j AuraDB Free ($0) + Cloud Run.

---

## What It Does

1. **Ingest anything** — Drop in text, PDFs, URLs, YouTube links, or CSVs. The system parses and chunks your content automatically.

2. **Build a knowledge graph** — A 3-phase extraction pipeline discovers entities and relationships, generates a formal ontology, then re-extracts with precision using ontology-guided constraints. Entity resolution deduplicates across sources.

3. **Talk to the graph** — Ask questions by voice using Gemini Live. The AI agent selects from 8 specialized query tools — semantic search, path finding, community detection, statistical analysis — to answer naturally while highlighting relevant nodes and edges in real time.

4. **Watch it think** — As the AI reasons through your question, the graph comes alive: nodes glow along traversal paths, ripples expand from focal points, and a thought stream shows the agent's reasoning steps in real time.

5. **Refine by voice** — Edit the ontology through conversation. Add entity types, merge duplicates, adjust relationships — the agent validates changes with OWL reasoning and can selectively re-extract affected portions of the graph.

---

## Demo

https://github.com/user-attachments/assets/voicegraph-demo.mp4

> *Upload a document, watch the graph build, then ask it questions by voice.*

---

## Architecture

```
                          Voice (Gemini Live)
                                │
                     ┌──────────┴──────────┐
                     │   React + Reagraph   │
                     │   3D Graph + Voice   │
                     └──────────┬──────────┘
                           WebSocket
                     ┌──────────┴──────────┐
                     │  FastAPI + Google ADK │
                     │                      │
                     │  ┌── GraphQueryAgent  │──── Neo4j AuraDB
                     │  ├── IngestionAgent  │     (Graph + Vectors)
                     │  ├── OntologyAgent   │
                     │  ├── CSVAnalysisAgent │
                     │  └── ExplanationAgent│
                     └─────────────────────┘
```

### 3-Phase Extraction Pipeline

| Phase | What | How |
|-------|------|-----|
| **A — Discovery** | Schema-free entity extraction | `neo4j-graphrag` with no constraints — maximum recall |
| **B — Ontology** | Generate formal OWL ontology | Gemini analyzes discovered schema → produces typed hierarchy |
| **C — Precision** | Ontology-guided re-extraction | TrustGraph-inspired subsetting — only relevant classes per chunk |

**Why this works:**
- Phase A catches everything — no entity type is missed because there are no constraints
- Phase B uses the LLM to impose human-quality semantic structure on the raw findings
- Phase C re-extracts with precision — consistent labels, proper types, no drift
- Ontology subsetting (from TrustGraph) means this scales to large ontologies without blowing context windows — all OWL classes are vector-embedded, and only the 5-10 most relevant per chunk are sent to the LLM
- Entity resolution runs three stages: exact match on canonical name, fuzzy match via rapidfuzz (0.8 threshold), and LLM-based semantic consolidation for tricky cases
- Every entity and relationship carries provenance: source document, source chunk, extraction confidence, extraction phase

### Agentic GraphRAG — 8 Specialized Query Tools

Not just semantic search — the orchestrator agent dynamically selects the right query strategy per question:

| Tool | When | How |
|------|------|-----|
| **Semantic Search** | "What do we know about climate change?" | Vector similarity over entity embeddings |
| **Entity Explorer** | "Tell me about OpenAI" | Pre-built Cypher template, 1-2 hop neighborhood traversal |
| **Path Finder** | "How does X relate to Y?" | Shortest path via pre-built Cypher (fast + reliable) |
| **Text2Cypher** | "Which orgs have more than 5 people?" | LLM generates Cypher from natural language + schema context |
| **Hybrid Search** | "Explain the AI regulation landscape" | Vector search finds anchors → Cypher expands context |
| **Community Detection** | "What are the main themes?" | Leiden algorithm + LLM summaries |
| **Ontology Info** | "What entity types do we have?" | Direct OWL ontology read |
| **Graph Stats** | "How big is the graph?" | Distribution, connectivity, growth metrics |

Pre-built Cypher templates handle common patterns (fast + reliable). Text2Cypher is reserved for complex analytical questions the templates can't handle. Best of both worlds.

### Voice-First Architecture

Most AI tools are text-first with voice bolted on (speech-to-text → process → text-to-speech). VoiceGraph uses Gemini Live's **native bidirectional audio streaming** — the LLM processes audio directly:

- **Function calling mid-conversation** — while you're speaking, Gemini fires graph queries, gets results, and weaves them into its spoken response. No "wait while I process."
- **Voice ontology editing** — say "add a relationship type called 'mentored by' between Person and Person" and the OntologyAgent fires `add_object_property("mentoredBy", "Person", "Person")`, validates with rdflib, persists as OWL Turtle, and optionally triggers selective re-extraction.
- **Thinking animation** — the backend emits `thinking_start`, `thinking_traverse`, `thinking_ripple`, `thinking_step`, and `thinking_complete` WebSocket events *during* tool execution, before the answer is ready. Three animation modes run simultaneously:
  - **Sequential path glow** — nodes light up in traversal order
  - **Ripple expansion** — concentric neighborhood reveal
  - **Thought stream** — floating panel showing reasoning steps

You literally watch the AI think through the graph topology. The graph animates *before* the answer arrives.

### WebSocket Event Protocol

Everything is real-time over a single WebSocket connection:
- **Audio**: bidirectional PCM chunks (16kHz up, 24kHz down)
- **Graph mutations**: `node_added`, `edge_added`, `graph_update`
- **Thinking events**: 6 event types for animation coordination
- **Ingestion progress**: phase-by-phase status with percentage

No polling. No REST for real-time data. Frontend routes events through typed Zustand stores.

### CSV Auto-Detection

When a CSV is uploaded, a 3-stage pipeline determines optimal storage:

1. **Statistical profiling** — pandas analyzes column types, cardinality, null rates, distributions
2. **Heuristic classification** — Python rules detect ID columns, FK candidates, entity patterns (<5ms, no LLM cost)
3. **Gemini analysis** — LLM reviews stats + heuristics + sample rows → recommends graph / relational / document

Graph data gets Cypher LOAD CSV. Relational data gets SQLite with a bridge node in Neo4j. This isn't "dump everything into the graph" — it's intelligent data routing.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Voice** | Gemini Live (Multimodal Live API) | Real-time bidirectional voice with function calling mid-conversation |
| **Agent Framework** | Google ADK | Multi-agent orchestration with 23 tools, Cloud Run deployment |
| **Extraction LLM** | Gemini 2.5 Flash via `VertexAILLM` | Fast, cheap, multimodal |
| **Graph Database** | Neo4j AuraDB Free | $0, instant setup, 200K nodes/400K rels, mature Cypher + vector indexes |
| **KG Builder** | `neo4j-graphrag[google]` | Official Neo4j library — chunking, extraction, entity resolution, retrievers |
| **Ontology** | `rdflib` + OWL | Lightweight OWL manipulation (no Java), Turtle serialization, JSON for agents |
| **Visualization** | Reagraph | React-native 3D graph, built-in selections/highlighting, modern aesthetic |
| **Frontend** | React 18 + TypeScript + Vite | Tailwind + shadcn/ui + Zustand state management |
| **Backend** | Python FastAPI + WebSocket | Async gateway, REST API, background tasks |
| **Deployment** | Google Cloud Run | Serverless, auto-scales, `adk deploy cloud_run` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Neo4j AuraDB instance (free tier works)
- Google Cloud project with Gemini API enabled

### Setup

```bash
# Clone
git clone https://github.com/yourusername/voicegraph.git
cd voicegraph

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
pnpm install
```

### Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

### Run

```bash
# Terminal 1 — Backend
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && pnpm dev
```

Open `http://localhost:5173` — paste some text, hit ingest, and start talking.

---

## Project Structure

```
backend/
  main.py                  # FastAPI + WebSocket server
  agents/                  # ADK orchestrator + 5 sub-agents + 23 tools
  extraction/              # 3-phase pipeline, parsers, ontology manager
  graph/                   # Neo4j client, Cypher templates
  voice/                   # Gemini Live session, tool declarations
  ingestion/               # Job manager, async ingestion flow

frontend/src/
  components/
    Graph/                 # Reagraph 3D visualization + thinking animations
    VoicePanel/            # Mic capture, waveform, playback
    LeftPanel/             # Stats, entity types, ingestion
    InfoSidebar/           # Node details, relationships
    ThoughtStream/         # Floating AI reasoning display
    OntologyView/          # Ontology browser
  stores/                  # Zustand stores (graph, voice, ingestion)
  hooks/                   # WebSocket, audio capture/playback
```

---

## Acknowledgments

Built on the shoulders of open source:

- [`neo4j-graphrag-python`](https://github.com/neo4j/neo4j-graphrag-python) (Apache 2.0) — extraction pipeline, retrievers, entity resolution
- [`trustgraph`](https://github.com/trustgraph-ai/trustgraph) (Apache 2.0) — ontology subsetting pattern, provenance approach
- [`llm-graph-builder`](https://github.com/neo4j-labs/llm-graph-builder) (MIT) — YouTube parser, schema consolidation patterns

---

## License

MIT
