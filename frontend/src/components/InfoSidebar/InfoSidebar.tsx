import { useGraphStore, colorForType } from '../../stores/graphStore';

export default function InfoSidebar() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectNode = useGraphStore((s) => s.selectNode);

  const connectedEdges = selectedNodeId
    ? edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    : [];

  if (!selectedNode) return null;

  return (
    <div className="glass-panel flex flex-col overflow-hidden max-h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          {selectedNode.data?.type != null && (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-2"
              style={{
                color: colorForType(String(selectedNode.data.type)),
                background: colorForType(String(selectedNode.data.type)) + '18',
                border: `1px solid ${colorForType(String(selectedNode.data.type))}30`,
              }}
            >
              {String(selectedNode.data.type)}
            </span>
          )}

          <h2 className="font-headline italic text-lg text-text-primary leading-tight">
            {selectedNode.label}
          </h2>

          <p className="text-[10px] text-text-muted mt-1 truncate font-mono">
            {selectedNode.id}
          </p>
        </div>

        <button
          onClick={() => selectNode(null)}
          className="shrink-0 ml-3 h-7 w-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="Close"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="border-t border-border" />

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-3">
        {/* Properties */}
        {selectedNode.data && Object.keys(selectedNode.data).length > 1 && (
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
              Properties
            </h4>
            <div className="space-y-2">
              {Object.entries(selectedNode.data)
                .filter(([key]) => key !== 'type')
                .map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-bg-primary/40 px-3 py-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-text-muted">
                      {key}
                    </span>
                    <p className="text-text-primary text-[13px] mt-0.5 break-words">
                      {String(val)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Relationships */}
        {connectedEdges.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
              Relationships ({connectedEdges.length})
            </h4>
            <div className="space-y-1.5">
              {connectedEdges.map((edge) => {
                const isSource = edge.source === selectedNodeId;
                const otherNodeId = isSource ? edge.target : edge.source;
                const otherNode = nodes.find((n) => n.id === otherNodeId);
                const otherType = otherNode?.data?.type as string | undefined;
                return (
                  <button
                    key={edge.id}
                    onClick={() => selectNode(otherNodeId)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-surface-hover border border-border-subtle"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: colorForType(otherType) }}
                    />
                    <span className="text-text-muted text-[11px]">
                      {isSource ? '\u2192' : '\u2190'}
                    </span>
                    <span className="text-accent text-[12px] font-medium truncate">
                      {edge.label}
                    </span>
                    <span className="text-text-primary text-[13px] truncate ml-auto">
                      {otherNode?.label ?? otherNodeId}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
