import { create } from 'zustand';
import type { GraphNode as EventNode, GraphEdge as EventEdge } from '../types/events';

// ---------------------------------------------------------------------------
// Reagraph-compatible types
// ---------------------------------------------------------------------------

export interface ReagraphNode {
  id: string;
  label: string;
  fill?: string;
  data?: Record<string, unknown>;
}

export interface ReagraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Color mapping by entity type
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  Person: '#60a5fa',
  Organization: '#a78bfa',
  Concept: '#34d399',
  Event: '#fbbf24',
  Location: '#f87171',
  Technology: '#2dd4bf',
  Field: '#818cf8',
  Method: '#fb923c',
  Model: '#f472b6',
  Architecture: '#38bdf8',
  Theory: '#c084fc',
  Date: '#a1a1aa',
};

const DEFAULT_COLOR = '#71717a';

export function colorForType(type?: string): string {
  return (type && TYPE_COLORS[type]) || DEFAULT_COLOR;
}

// ---------------------------------------------------------------------------
// Thinking step type
// ---------------------------------------------------------------------------

export interface ThinkingStep {
  step: string;
  icon: string;
  nodeId?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface GraphState {
  // Graph data (raw from server)
  nodes: ReagraphNode[];
  edges: ReagraphEdge[];

  // Selected node
  selectedNodeId: string | null;
  selectedNode: ReagraphNode | null;

  // Highlighting / thinking animation
  activeNodeIds: Set<string>;
  activeEdgeIds: Set<string>;
  dimAll: boolean;

  // Thinking state
  isThinking: boolean;
  thinkingQuery: string;
  thinkingSteps: ThinkingStep[];

  // ---- Actions: selection ----
  selectNode: (id: string | null) => void;

  // ---- Actions: graph mutations ----
  setGraph: (nodes: EventNode[], edges: EventEdge[]) => void;
  setNodes: (nodes: EventNode[]) => void;
  setEdges: (edges: EventEdge[]) => void;
  addNode: (node: EventNode) => void;
  addEdge: (edge: EventEdge) => void;
  removeNode: (nodeId: string) => void;
  resetGraph: () => void;

  // ---- Actions: highlighting ----
  setHighlight: (nodeIds: string[], edgeIds: string[]) => void;
  clearHighlights: () => void;
  setActiveNodes: (ids: Set<string>) => void;
  setActiveEdges: (ids: Set<string>) => void;
  setDimAll: (dim: boolean) => void;

  // ---- Actions: thinking ----
  thinkingStart: (query: string) => void;
  thinkingAddStep: (step: string, icon: string, nodeId?: string) => void;
  thinkingTraverse: (fromId: string, toId: string, edgeId: string) => void;
  thinkingRipple: (centerId: string, rings: string[][]) => void;
  thinkingComplete: (resultNodeIds: string[], resultEdgeIds: string[]) => void;
  thinkingClear: () => void;
}

// ---------------------------------------------------------------------------
// Conversion helpers: event types -> Reagraph types
// ---------------------------------------------------------------------------

function toReagraphNode(node: EventNode): ReagraphNode {
  return {
    id: node.id,
    label: node.label,
    fill: colorForType(node.type),
    data: {
      type: node.type,
      ...node.properties,
    },
  };
}

function toReagraphEdge(edge: EventEdge): ReagraphEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNode: null,
  activeNodeIds: new Set<string>(),
  activeEdgeIds: new Set<string>(),
  dimAll: false,
  isThinking: false,
  thinkingQuery: '',
  thinkingSteps: [],

  // ---- Selection ----

  selectNode: (id) => {
    if (id === null) {
      set({ selectedNodeId: null, selectedNode: null });
      return;
    }
    const node = get().nodes.find((n) => n.id === id) ?? null;
    set({ selectedNodeId: id, selectedNode: node });
  },

  // ---- Graph mutations ----

  setGraph: (nodes, edges) =>
    set({
      nodes: nodes.map(toReagraphNode),
      edges: edges.map(toReagraphEdge),
    }),

  setNodes: (nodes) => set({ nodes: nodes.map(toReagraphNode) }),

  setEdges: (edges) => set({ edges: edges.map(toReagraphEdge) }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, toReagraphNode(node)],
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, toReagraphEdge(edge)],
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  resetGraph: () =>
    set({
      nodes: [],
      edges: [],
      activeNodeIds: new Set<string>(),
      activeEdgeIds: new Set<string>(),
      dimAll: false,
      isThinking: false,
      thinkingQuery: '',
      thinkingSteps: [],
    }),

  // ---- Highlighting ----

  setHighlight: (nodeIds, edgeIds) =>
    set({
      activeNodeIds: new Set(nodeIds),
      activeEdgeIds: new Set(edgeIds),
      dimAll: true,
    }),

  clearHighlights: () =>
    set({
      activeNodeIds: new Set<string>(),
      activeEdgeIds: new Set<string>(),
      dimAll: false,
    }),

  setActiveNodes: (ids) => set({ activeNodeIds: ids }),
  setActiveEdges: (ids) => set({ activeEdgeIds: ids }),
  setDimAll: (dim) => set({ dimAll: dim }),

  // ---- Thinking ----

  thinkingStart: (query) =>
    set({
      isThinking: true,
      thinkingQuery: query,
      thinkingSteps: [],
      activeNodeIds: new Set<string>(),
      activeEdgeIds: new Set<string>(),
      dimAll: true,
    }),

  thinkingAddStep: (step, icon, nodeId) =>
    set((state) => {
      const newSteps = [...state.thinkingSteps, { step, icon, nodeId, timestamp: Date.now() }];
      const newActiveNodes = new Set(state.activeNodeIds);
      if (nodeId) newActiveNodes.add(nodeId);
      return {
        thinkingSteps: newSteps,
        activeNodeIds: newActiveNodes,
      };
    }),

  thinkingTraverse: (fromId, toId, edgeId) =>
    set((state) => {
      const newNodes = new Set(state.activeNodeIds);
      newNodes.add(fromId);
      newNodes.add(toId);
      const newEdges = new Set(state.activeEdgeIds);
      newEdges.add(edgeId);
      return {
        activeNodeIds: newNodes,
        activeEdgeIds: newEdges,
      };
    }),

  thinkingRipple: (centerId, rings) =>
    set((state) => {
      const newNodes = new Set(state.activeNodeIds);
      newNodes.add(centerId);
      for (const ring of rings) {
        for (const id of ring) {
          newNodes.add(id);
        }
      }
      return { activeNodeIds: newNodes };
    }),

  thinkingComplete: (resultNodeIds, resultEdgeIds) =>
    set({
      isThinking: false,
      activeNodeIds: new Set(resultNodeIds),
      activeEdgeIds: new Set(resultEdgeIds),
      dimAll: true,
    }),

  thinkingClear: () =>
    set({
      isThinking: false,
      thinkingQuery: '',
      thinkingSteps: [],
      activeNodeIds: new Set<string>(),
      activeEdgeIds: new Set<string>(),
      dimAll: false,
    }),
}));
