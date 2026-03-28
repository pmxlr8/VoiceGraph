import { useGraphStore, colorForType } from '../../stores/graphStore';
import type { View } from '../../App';

interface TopBarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onIngest: () => void;
}

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'graph', label: 'Context Graph', icon: '◆' },
  { id: 'query', label: 'Agent Query', icon: '⚡' },
  { id: 'ontology', label: 'Ontology', icon: '○' },
];

export default function TopBar({ currentView, onViewChange, onIngest }: TopBarProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  // Entity type counts for filter pills
  const typeCounts: Record<string, number> = {};
  for (const node of nodes) {
    const t = (node.data?.type as string) || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  // Get active type filters from store
  const activeFilters = useGraphStore((s) => s.typeFilters);
  const toggleTypeFilter = useGraphStore((s) => s.toggleTypeFilter);

  return (
    <div
      className="absolute top-0 left-0 right-0 h-[56px] z-20 flex items-center justify-between px-5"
      style={{
        background: 'linear-gradient(180deg, rgba(12,12,15,0.97) 0%, rgba(12,12,15,0.92) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left: logo + filters */}
      <div className="flex items-center gap-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <svg className="h-4 w-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <circle cx="5" cy="5" r="1.5" />
              <circle cx="19" cy="5" r="1.5" />
              <circle cx="5" cy="19" r="1.5" />
              <circle cx="19" cy="19" r="1.5" />
              <line x1="9.5" y1="10" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="1" />
              <line x1="14.5" y1="10" x2="17.5" y2="6.5" stroke="currentColor" strokeWidth="1" />
              <line x1="9.5" y1="14" x2="6.5" y2="17.5" stroke="currentColor" strokeWidth="1" />
              <line x1="14.5" y1="14" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-semibold text-text-primary tracking-tight">VoiceGraph</div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted mr-1">Filter:</span>
          <button
            onClick={() => toggleTypeFilter('__all__')}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              activeFilters.size === 0
                ? 'bg-white/10 text-text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
            }`}
          >
            All
          </button>
          {Object.entries(typeCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([type]) => {
              const color = colorForType(type);
              const isActive = activeFilters.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-white/10 text-text-primary'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className="h-[6px] w-[6px] rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {type}
                </button>
              );
            })}
        </div>
      </div>

      {/* Center: nav tabs */}
      <div className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-medium transition-all ${
              currentView === item.id
                ? 'bg-white/[0.08] text-text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
            }`}
          >
            <span className="text-[10px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Right: stats + ingest button */}
      <div className="flex items-center gap-4">
        <span className="text-[12px] text-text-muted tabular-nums">
          <span className="text-text-primary font-semibold">{nodes.length}</span> entities
          <span className="mx-1.5 text-text-muted/40">·</span>
          <span className="text-text-primary font-semibold">{edges.length}</span> relationships
        </span>

        <button
          onClick={onIngest}
          className="group relative flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-[11px] font-semibold tracking-wide uppercase transition-all duration-300 hover:-translate-y-[1px]"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef8b00 100%)',
            boxShadow: '0 0 12px rgba(245,158,11,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            color: '#0a0a0d',
          }}
        >
          <span
            className="flex items-center justify-center h-5 w-5 rounded-full transition-transform group-hover:rotate-90 duration-300"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Ingest
          <span
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ boxShadow: '0 0 24px rgba(245,158,11,0.45), 0 4px 12px rgba(245,158,11,0.3)' }}
          />
        </button>
      </div>
    </div>
  );
}
