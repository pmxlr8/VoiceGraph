import { useMemo, useCallback } from 'react';
import { GraphCanvas, darkTheme, type GraphNode, type GraphEdge, type Theme } from 'reagraph';
import { useGraphStore, colorForType } from '../../stores/graphStore';

// ---------------------------------------------------------------------------
// Theme — near-black background, warm amber accents, visible edges
// ---------------------------------------------------------------------------

const voiceGraphTheme: Theme = {
  ...darkTheme,
  canvas: { background: '#09090b' },
  node: {
    ...darkTheme.node,
    fill: '#f59e0b',
    activeFill: '#fbbf24',
    label: {
      ...darkTheme.node.label,
      color: '#e4e4e7',
      activeColor: '#ffffff',
      stroke: '#09090b',
    },
  },
  edge: {
    ...darkTheme.edge,
    fill: 'rgba(161, 161, 170, 0.25)',
    activeFill: '#f59e0b',
    label: {
      ...darkTheme.edge.label,
      color: 'rgba(161, 161, 170, 0.5)',
      activeColor: '#e4e4e7',
      stroke: '#09090b',
    },
  },
  ring: {
    ...darkTheme.ring,
    fill: '#f59e0b',
  },
  arrow: {
    ...darkTheme.arrow,
    fill: 'rgba(161, 161, 170, 0.3)',
    activeFill: '#f59e0b',
  },
};

// ---------------------------------------------------------------------------
// Dim color helper
// ---------------------------------------------------------------------------

function dimColor(hexColor: string): string {
  const base = hexColor.length === 9 ? hexColor.slice(0, 7) : hexColor;
  return base + '33';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GraphView() {
  const storeNodes = useGraphStore((s) => s.nodes);
  const storeEdges = useGraphStore((s) => s.edges);
  const activeNodeIds = useGraphStore((s) => s.activeNodeIds);
  const activeEdgeIds = useGraphStore((s) => s.activeEdgeIds);
  const dimAll = useGraphStore((s) => s.dimAll);
  const selectNode = useGraphStore((s) => s.selectNode);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const displayNodes: GraphNode[] = useMemo(() => {
    return storeNodes.map((node) => {
      const baseColor = node.fill || colorForType(node.data?.type as string | undefined);

      if (dimAll && activeNodeIds.has(node.id)) {
        return { ...node, fill: '#ffffff' };
      }
      if (dimAll && !activeNodeIds.has(node.id)) {
        return { ...node, fill: dimColor(baseColor) };
      }
      return { ...node, fill: baseColor };
    });
  }, [storeNodes, activeNodeIds, dimAll]);

  const displayEdges: GraphEdge[] = useMemo(() => {
    return storeEdges.map((edge) => {
      if (dimAll && !activeEdgeIds.has(edge.id)) {
        return { ...edge, fill: 'rgba(161, 161, 170, 0.06)' };
      }
      if (activeEdgeIds.has(edge.id)) {
        return { ...edge, fill: '#f59e0b' };
      }
      return edge;
    });
  }, [storeEdges, activeEdgeIds, dimAll]);

  const selections = useMemo(() => {
    return Array.from(activeNodeIds);
  }, [activeNodeIds]);

  return (
    <div className="relative h-full w-full">
      {storeNodes.length > 0 ? (
        <GraphCanvas
          nodes={displayNodes}
          edges={displayEdges}
          selections={selections}
          layoutType="forceDirected3d"
          theme={voiceGraphTheme}
          labelType="all"
          edgeLabelPosition="natural"
          onNodeClick={handleNodeClick}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="font-headline italic text-2xl text-text-muted mb-3">
              No data yet
            </p>
            <p className="text-sm text-text-secondary">
              Ingest content or speak to begin exploring
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
