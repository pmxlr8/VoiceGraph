import { useGraphStore, colorForType } from '../../stores/graphStore';
import IngestionPanel from '../Ingestion/IngestionPanel';

export default function LeftPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  // Entity type breakdown
  const typeCounts: Record<string, number> = {};
  for (const node of nodes) {
    const t = (node.data?.type as string) || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  return (
    <div className="glass-panel flex flex-col overflow-hidden max-h-[calc(100vh-5rem)]">
      {/* Title */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-semibold tracking-wide text-text-primary">
          VoiceGraph
        </h1>
        <p className="text-xs text-text-muted mt-0.5">Knowledge Graph Explorer</p>
      </div>

      <div className="border-t border-border" />

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-bg-tertiary/50 p-3 text-center">
            <div className="stat-number text-3xl text-accent">
              {nodes.length}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mt-1">
              Nodes
            </div>
          </div>
          <div className="rounded-xl bg-bg-tertiary/50 p-3 text-center">
            <div className="stat-number text-3xl text-secondary">
              {edges.length}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mt-1">
              Edges
            </div>
          </div>
        </div>

        {/* Entity types */}
        {Object.keys(typeCounts).length > 0 && (
          <div>
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
              Entity Types
            </h3>
            <div className="space-y-0.5">
              {Object.entries(typeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorForType(type) }}
                      />
                      <span className="text-text-primary text-[13px]">{type}</span>
                    </div>
                    <span className="text-[12px] text-text-muted tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="border-t border-border" />

        {/* Ingestion */}
        <IngestionPanel />
      </div>
    </div>
  );
}
