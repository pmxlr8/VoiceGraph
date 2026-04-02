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
  // Core entity types — pastel palette
  Person: '#f096b8',       // dusty rose
  Organization: '#96e0b8', // mint
  Concept: '#96b8f0',      // cornflower
  Event: '#f0aa96',        // peach
  Location: '#aae096',     // sage green
  Technology: '#aa96f0',   // violet
  Facility: '#96dce8',     // pale cyan
  Infrastructure: '#96c0f0', // sky steel
  Signal: '#e8d496',       // golden
  Institution: '#d496f0',  // lilac
  Regulation: '#edc4f7',   // lilac-light
  Community: '#96e8dc',    // turquoise
  Commodity: '#f0cc96',    // warm sand
  Company: '#96e0b8',      // mint (same as Org)
  Cluster: '#c896f0',      // soft lavender

  // Aliases
  Field: '#96b8f0',
  Method: '#f0aa96',
  Model: '#c896f0',
  Architecture: '#96c0f0',
  Theory: '#d496f0',
  Year: '#96c0f0',
  Date: '#96c0f0',
  City: '#aae096',
  Country: '#aae096',
  Award: '#e8d496',
  Equation: '#96dce8',
  Field_Of_Study: '#96b8f0',
  FieldOfStudy: '#96b8f0',
  Scientific_Concept: '#96b8f0',
  ScientificConcept: '#96b8f0',

  // DC & Energy specific
  data_center: '#96dce8',
  hedge_fund: '#f096b8',
  passive: '#e8d496',
  active: '#f0aa96',
  transmission: '#96c0f0',
  power_plant: '#f09696',
  fuel_cell: '#96e8dc',
  mining_facility: '#f0cc96',
  thermal_energy_network: '#96e0b8',
};

const DEFAULT_COLOR = '#aa96f0';

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

  // Latest agent text response (from transcript events)
  lastAgentResponse: string;

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

  // ---- Actions: type filters ----
  typeFilters: Set<string>;
  toggleTypeFilter: (type: string) => void;

  // ---- Actions: thinking ----
  thinkingStart: (query: string) => void;
  thinkingAddStep: (step: string, icon: string, nodeId?: string) => void;
  thinkingTraverse: (fromId: string, toId: string, edgeId: string) => void;
  thinkingRipple: (centerId: string, rings: string[][]) => void;
  thinkingComplete: (resultNodeIds: string[], resultEdgeIds: string[]) => void;
  thinkingClear: () => void;
  setLastAgentResponse: (text: string) => void;
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
  lastAgentResponse: '',
  typeFilters: new Set<string>(),

  // ---- Type filters ----
  toggleTypeFilter: (type) => {
    if (type === '__all__') {
      set({ typeFilters: new Set<string>() });
      return;
    }
    set((state) => {
      const next = new Set(state.typeFilters);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { typeFilters: next };
    });
  },

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
      activeNodeIds: new Set<string>(),
      activeEdgeIds: new Set<string>(),
      dimAll: false,
      isThinking: false,
    }),

  setNodes: (nodes) => set({ nodes: nodes.map(toReagraphNode) }),

  setEdges: (edges) => set({ edges: edges.map(toReagraphEdge) }),

  addNode: (node) =>
    set((state) => {
      const rNode = toReagraphNode(node);
      // Deduplicate by label (case-insensitive)
      const exists = state.nodes.some(
        (n) => n.label.toLowerCase() === rNode.label.toLowerCase(),
      );
      if (exists) return state;
      // Auto-highlight the new node for 3 seconds
      const newActive = new Set(state.activeNodeIds);
      newActive.add(rNode.id);
      setTimeout(() => {
        const s = get();
        const updated = new Set(s.activeNodeIds);
        updated.delete(rNode.id);
        if (updated.size === 0) {
          set({ activeNodeIds: updated, dimAll: false });
        } else {
          set({ activeNodeIds: updated });
        }
      }, 3000);
      return {
        nodes: [...state.nodes, rNode],
        activeNodeIds: newActive,
        dimAll: true,
      };
    }),

  addEdge: (edge) =>
    set((state) => {
      const rEdge = toReagraphEdge(edge);
      // Deduplicate
      const exists = state.edges.some((e) => e.id === rEdge.id);
      if (exists) return state;
      return { edges: [...state.edges, rEdge] };
    }),

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

  setHighlight: (nodeIds, edgeIds) => {
    // Resolve: IDs may be element IDs or entity names — match both
    const idSet = new Set(nodeIds);
    const allNodes = get().nodes;
    const resolved = new Set<string>();
    for (const nid of nodeIds) {
      // Direct ID match
      if (allNodes.some((n) => n.id === nid)) {
        resolved.add(nid);
      } else {
        // Try matching by label (case-insensitive)
        const lower = nid.toLowerCase();
        for (const n of allNodes) {
          if (n.label.toLowerCase().includes(lower) || lower.includes(n.label.toLowerCase())) {
            resolved.add(n.id);
          }
        }
      }
    }
    // Also keep any raw IDs that didn't match by name (might match element IDs)
    for (const nid of idSet) resolved.add(nid);
    set({
      activeNodeIds: resolved,
      activeEdgeIds: new Set(edgeIds),
      dimAll: resolved.size > 0,
    });
    // Auto-clear highlights after 8 seconds
    if (resolved.size > 0) {
      setTimeout(() => {
        const s = get();
        if (!s.isThinking && s.dimAll) {
          set({
            activeNodeIds: new Set<string>(),
            activeEdgeIds: new Set<string>(),
            dimAll: false,
          });
        }
      }, 8000);
    }
  },

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

  setLastAgentResponse: (text) => set({ lastAgentResponse: text }),

  thinkingStart: (query) =>
    set({
      isThinking: true,
      thinkingQuery: query,
      thinkingSteps: [],
      lastAgentResponse: '',
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

  thinkingComplete: (resultNodeIds, resultEdgeIds) => {
    set({
      isThinking: false,
      activeNodeIds: new Set(resultNodeIds),
      activeEdgeIds: new Set(resultEdgeIds),
      dimAll: resultNodeIds.length > 0,
    });
    // Auto-clear highlights after 8 seconds
    if (resultNodeIds.length > 0) {
      setTimeout(() => {
        const s = get();
        // Only clear if still showing the same result set
        if (!s.isThinking && s.dimAll) {
          set({
            activeNodeIds: new Set<string>(),
            activeEdgeIds: new Set<string>(),
            dimAll: false,
          });
        }
      }, 8000);
    }
  },

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
