// ─── Graph Data Types ─────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties?: Record<string, unknown>;
}

// ─── Ontology Types ───────────────────────────────────────────────

export interface OntologyChange {
  action: 'add_class' | 'remove_class' | 'add_relationship' | 'remove_relationship';
  details: Record<string, unknown>;
}

// ─── CSV Analysis Types ───────────────────────────────────────────

export interface CSVAnalysisResult {
  columns: string[];
  sample_rows: Record<string, unknown>[];
  suggested_mapping: Record<string, string>;
}

// ─── Client Events (Frontend → Backend) ──────────────────────────

export type ClientEvent =
  | { type: 'audio_chunk'; data: string }
  | { type: 'text_input'; text: string }
  | { type: 'ingest_file'; file: string; name: string; mimeType: string }
  | { type: 'ingest_url'; url: string }
  | { type: 'graph_action'; action: 'expand' | 'collapse' | 'pin'; nodeId: string };

// ─── Server Events (Backend → Frontend) ──────────────────────────

// Audio events
export interface AudioChunkEvent {
  type: 'audio_chunk';
  data: string;
}

export interface TranscriptEvent {
  type: 'transcript';
  role: 'user' | 'agent';
  text: string;
}

// Graph mutation events
export interface GraphUpdateEvent {
  type: 'graph_update';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeAddedEvent {
  type: 'node_added';
  node: GraphNode;
}

export interface EdgeAddedEvent {
  type: 'edge_added';
  edge: GraphEdge;
}

export interface NodeRemovedEvent {
  type: 'node_removed';
  nodeId: string;
}

// Thinking animation events
export interface ThinkingStartEvent {
  type: 'thinking_start';
  query: string;
}

export interface ThinkingStepEvent {
  type: 'thinking_step';
  step: string;
  icon: string;
  nodeId?: string;
}

export interface ThinkingTraverseEvent {
  type: 'thinking_traverse';
  fromId: string;
  toId: string;
  edgeId: string;
  delay_ms: number;
}

export interface ThinkingRippleEvent {
  type: 'thinking_ripple';
  centerId: string;
  rings: string[][];
}

export interface ThinkingCompleteEvent {
  type: 'thinking_complete';
  resultNodeIds: string[];
  resultEdgeIds: string[];
}

export interface ThinkingClearEvent {
  type: 'thinking_clear';
}

// Status events
export interface IngestionStatusEvent {
  type: 'ingestion_status';
  phase: 'A' | 'B' | 'C' | 'done';
  details: string;
  progress: number;
  entities_found?: number;
  relationships_found?: number;
}

export interface OntologyChangedEvent {
  type: 'ontology_changed';
  change: OntologyChange;
}

export interface CSVAnalysisEvent {
  type: 'csv_analysis';
  result: CSVAnalysisResult;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ServerEvent =
  | AudioChunkEvent
  | TranscriptEvent
  | GraphUpdateEvent
  | NodeAddedEvent
  | EdgeAddedEvent
  | NodeRemovedEvent
  | ThinkingStartEvent
  | ThinkingStepEvent
  | ThinkingTraverseEvent
  | ThinkingRippleEvent
  | ThinkingCompleteEvent
  | ThinkingClearEvent
  | IngestionStatusEvent
  | OntologyChangedEvent
  | CSVAnalysisEvent
  | ErrorEvent;
