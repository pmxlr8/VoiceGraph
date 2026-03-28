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

  const typeColor = colorForType(selectedNode.data?.type as string | undefined);
  const typeName = String(selectedNode.data?.type || 'Entity');

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(14,14,18,0.98) 0%, rgba(10,10,13,0.99) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Close */}
      <div className="flex justify-end p-3">
        <button
          onClick={() => selectNode(null)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Type badge */}
      <div className="px-5 pb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: typeColor }}
        >
          {typeName} Entity
        </span>
      </div>

      {/* Entity name */}
      <div className="px-5 pb-5 flex items-center gap-3">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: typeColor }}
        />
        <h2 className="text-[20px] font-semibold text-text-primary leading-tight">
          {selectedNode.label}
        </h2>
      </div>

      <div className="mx-5 border-t border-border" />

      {/* Properties */}
      {selectedNode.data && Object.keys(selectedNode.data).filter(k => k !== 'type').length > 0 && (
        <>
          <div className="px-5 pt-4 pb-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Properties
            </span>
          </div>
          <div className="px-5 space-y-2 pb-4">
            {Object.entries(selectedNode.data)
              .filter(([key]) => key !== 'type')
              .map(([key, val]) => (
                <div key={key}>
                  <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted mb-0.5">
                    {key}
                  </div>
                  <div className="text-[13px] text-text-primary leading-relaxed">
                    {String(val)}
                  </div>
                </div>
              ))}
          </div>
          <div className="mx-5 border-t border-border" />
        </>
      )}

      {/* Relationships */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Relationships
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {connectedEdges.length > 0 ? (
          <div className="space-y-1">
            {connectedEdges.map((edge) => {
              const isSource = edge.source === selectedNodeId;
              const otherNodeId = isSource ? edge.target : edge.source;
              const otherNode = nodes.find((n) => n.id === otherNodeId);
              const otherType = otherNode?.data?.type as string | undefined;
              const otherColor = colorForType(otherType);
              return (
                <button
                  key={edge.id}
                  onClick={() => selectNode(otherNodeId)}
                  className="flex w-full items-start gap-2.5 py-3 text-left transition-all hover:bg-white/[0.02] rounded-lg px-2 -mx-2 border-b border-border-subtle"
                >
                  <span className="text-text-muted text-[12px] mt-0.5 shrink-0">
                    {isSource ? '\u2192' : '\u2190'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-text-primary font-medium truncate">
                      {otherNode?.label ?? otherNodeId}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {edge.label}
                    </div>
                  </div>
                  <span
                    className="h-[6px] w-[6px] rounded-full shrink-0 mt-2"
                    style={{ backgroundColor: otherColor }}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[12px] text-text-muted py-4">No relationships found</div>
        )}
      </div>
    </div>
  );
}
