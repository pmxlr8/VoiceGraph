import { useRef, useMemo, useCallback, useEffect, useState, Component, type ReactNode } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { useGraphStore, colorForType } from '../../stores/graphStore';

// Error boundary to catch WebGL / Three.js crashes
class GraphErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center space-y-2">
            <p className="text-lg">Graph rendering error</p>
            <p className="text-sm opacity-60">{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types for react-force-graph
// ---------------------------------------------------------------------------

interface FGNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __threeObj?: any;
}

interface FGLink {
  id: string;
  source: string | FGNode;
  target: string | FGNode;
  label?: string;
}

interface GraphData {
  nodes: FGNode[];
  links: FGLink[];
}

// ---------------------------------------------------------------------------
// Word-wrap helper
// ---------------------------------------------------------------------------

const wrap = (s: string, w: number) =>
  s.replace(
    new RegExp(`(?![^\\n]{1,${w}}$)([^\\n]{1,${w}})\\s`, 'g'),
    '$1\n',
  );

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GraphView() {
  const fgRef = useRef<any>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight - 56 });

  const storeNodes = useGraphStore((s) => s.nodes);
  const storeEdges = useGraphStore((s) => s.edges);
  const activeNodeIds = useGraphStore((s) => s.activeNodeIds);
  const activeEdgeIds = useGraphStore((s) => s.activeEdgeIds);
  const dimAll = useGraphStore((s) => s.dimAll);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const typeFilters = useGraphStore((s) => s.typeFilters);

  // Store highlight state in refs so nodeColor callback always has fresh values
  // without needing to rebuild graphData
  const dimAllRef = useRef(dimAll);
  const activeNodeIdsRef = useRef(activeNodeIds);
  dimAllRef.current = dimAll;
  activeNodeIdsRef.current = activeNodeIds;

  // Resize tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter nodes by type
  const filteredNodes = useMemo(() => {
    if (typeFilters.size === 0) return storeNodes;
    return storeNodes.filter((node) => {
      const nodeType = (node.data?.type as string) || 'Unknown';
      return typeFilters.has(nodeType);
    });
  }, [storeNodes, typeFilters]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(() => {
    if (typeFilters.size === 0) return storeEdges;
    return storeEdges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    );
  }, [storeEdges, typeFilters, filteredNodeIds]);

  // Build graph data — ONLY when actual graph data changes, NOT for highlights
  const graphData: GraphData = useMemo(() => {
    const nodes: FGNode[] = filteredNodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: (n.data?.type as string) || 'Entity',
    }));

    const links: FGLink[] = filteredEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
    }));

    return { nodes, links };
  }, [filteredNodes, filteredEdges]);

  // nodeColor callback — reads highlight state from refs (always fresh)
  // Returns a NEW function reference when highlights change so ForceGraph3D
  // re-evaluates colors without rebuilding the simulation
  const getNodeColor = useMemo(
    () => (node: FGNode) => {
      const type = node.type || 'Entity';
      const baseColor = colorForType(type);
      if (dimAllRef.current) {
        return activeNodeIdsRef.current.has(node.id) ? '#ffffff' : baseColor + '30';
      }
      return baseColor;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dimAll, activeNodeIds],
  );

  // When highlights change, also update any existing Three.js objects directly
  // to ensure immediate visual feedback without waiting for ForceGraph3D
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // Access the internal graph data nodes (which have __threeObj)
    const internalNodes = fg.graphData?.()?.nodes;
    if (!internalNodes) return;

    for (const node of internalNodes) {
      if (node.__threeObj) {
        // The main mesh is the first child (sphere)
        const mesh = node.__threeObj.children?.[0] || node.__threeObj;
        if (mesh?.material?.color) {
          const type = node.type || 'Entity';
          const baseColor = colorForType(type);
          let color = baseColor;
          if (dimAll) {
            color = activeNodeIds.has(node.id) ? '#ffffff' : baseColor + '30';
          }
          mesh.material.color.set(color);
          if (dimAll) {
            mesh.material.opacity = activeNodeIds.has(node.id) ? 1.0 : 0.15;
            mesh.material.transparent = true;
          } else {
            mesh.material.opacity = 0.9;
          }
        }
      }
    }

    // Force scene re-render
    if (fg.renderer?.()) {
      fg.renderer().render(fg.scene(), fg.camera());
    }

    if (dimAll) {
      const matchCount = internalNodes.filter((n: FGNode) => activeNodeIds.has(n.id)).length;
      console.log('[GraphView] Highlight update — dimAll:', dimAll, 'activeIds:', activeNodeIds.size, 'matched:', matchCount);
    }
  }, [dimAll, activeNodeIds]);

  // Node click
  const handleNodeClick = useCallback(
    (node: FGNode) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  // Background click — deselect
  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Node three object — SpriteText label ADDED to the default sphere (nodeThreeObjectExtend=true)
  const nodeThreeObject = useCallback(
    (node: FGNode) => {
      const sprite = new SpriteText(wrap(node.label, 30));
      sprite.color = selectedNodeId === node.id ? '#ffffff' : '#d1d5db';
      sprite.textHeight = 3.5;
      sprite.fontWeight = selectedNodeId === node.id ? 'bold' : 'normal';
      sprite.position.y = 12; // offset above the sphere
      return sprite;
    },
    [selectedNodeId],
  );

  // Node size — scale by connections
  const getNodeVal = useCallback((node: FGNode) => {
    const conns = filteredEdges.filter(
      (e) => e.source === node.id || e.target === node.id ||
             (e.source as any)?.id === node.id || (e.target as any)?.id === node.id
    ).length;
    return Math.max(3, conns * 2);
  }, [filteredEdges]);

  // Link label as SpriteText
  const linkThreeObject = useCallback((link: FGLink) => {
    const sprite = new SpriteText(wrap(String(link.label || ''), 30));
    sprite.color = 'rgba(255, 255, 255, 0.35)';
    sprite.textHeight = 2.0;
    return sprite;
  }, []);

  // Position link label at midpoint
  const linkPositionUpdate = useCallback(
    (
      sprite: any,
      { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } },
    ) => {
      const middlePos = {
        x: start.x + (end.x - start.x) / 2,
        y: start.y + (end.y - start.y) / 2,
        z: start.z + (end.z - start.z) / 2,
      };
      Object.assign(sprite.position, middlePos);
    },
    [],
  );

  // Link color — match node source color
  const getLinkColor = useCallback((link: FGLink) => {
    const sourceNode = typeof link.source === 'object' ? link.source : null;
    if (dimAllRef.current && sourceNode) {
      const isActive = activeNodeIdsRef.current.has(sourceNode.id);
      return isActive ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.05)';
    }
    if (sourceNode) {
      const baseColor = colorForType(sourceNode.type);
      return baseColor + '60';
    }
    return 'rgba(255, 255, 255, 0.25)';
  }, []);

  // Link particle color
  const getLinkParticleColor = useCallback(() => '#f59e0b', []);

  if (storeNodes.length === 0) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl opacity-20">
            <svg
              className="mx-auto h-16 w-16"
              fill="none"
              stroke="currentColor"
              strokeWidth={0.8}
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="5" cy="6" r="2" />
              <circle cx="19" cy="6" r="2" />
              <circle cx="5" cy="18" r="2" />
              <circle cx="19" cy="18" r="2" />
              <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
              <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
              <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
              <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
            </svg>
          </div>
          <p className="text-lg text-text-muted font-light">
            Your knowledge graph is empty
          </p>
          <p className="text-sm text-text-muted/60">
            Click Ingest to extract knowledge from text
          </p>
        </div>
      </div>
    );
  }

  return (
    <GraphErrorBoundary>
    <div ref={containerRef} className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeOpacity={0.9}
        nodeLabel="label"
        nodeVal={getNodeVal}
        nodeRelSize={5}
        enableNodeDrag={true}
        nodeColor={getNodeColor}
        backgroundColor="#050507"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={true}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        onNodeDragEnd={(node: FGNode) => {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.8}
        linkOpacity={0.7}
        linkColor={getLinkColor}
        linkWidth={1.5}
        linkThreeObjectExtend={true}
        linkThreeObject={linkThreeObject}
        linkPositionUpdate={linkPositionUpdate}
        linkDirectionalParticleColor={getLinkParticleColor}
        linkDirectionalParticleWidth={1.4}
        linkHoverPrecision={2}
        onLinkClick={(link: FGLink) => {
          if (fgRef.current) (fgRef.current as any).emitParticle(link);
        }}
      />

      {/* Zoom controls — bottom right like TrustGraph */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => {
            const fg = fgRef.current;
            if (fg) {
              const dist = fg.cameraPosition().z;
              fg.cameraPosition({ z: dist * 0.75 }, undefined, 300);
            }
          }}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary bg-black/60 border border-white/[0.08] hover:bg-white/[0.06] transition-colors text-lg"
        >
          +
        </button>
        <button
          onClick={() => {
            const fg = fgRef.current;
            if (fg) {
              const dist = fg.cameraPosition().z;
              fg.cameraPosition({ z: dist * 1.35 }, undefined, 300);
            }
          }}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary bg-black/60 border border-white/[0.08] hover:bg-white/[0.06] transition-colors text-lg"
        >
          -
        </button>
        <button
          onClick={() => {
            const fg = fgRef.current;
            if (fg) fg.zoomToFit(400);
          }}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary bg-black/60 border border-white/[0.08] hover:bg-white/[0.06] transition-colors text-xs"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Status indicator — bottom left like TrustGraph */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] text-text-muted z-10">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Ready
      </div>
    </div>
    </GraphErrorBoundary>
  );
}
