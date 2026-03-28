import { useEffect, useRef } from 'react';
import { useVoiceStore, type ActivityEntry } from '../../stores/voiceStore';

export default function ActivityPanel() {
  const activity = useVoiceStore((s) => s.activity);
  const isPanelOpen = useVoiceStore((s) => s.isPanelOpen);
  const setPanelOpen = useVoiceStore((s) => s.setPanelOpen);
  const clearTranscript = useVoiceStore((s) => s.clearTranscript);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activity]);

  if (!isPanelOpen) return null;

  return (
    <div
      className="absolute top-0 left-0 h-full z-20 flex flex-col"
      style={{
        width: '380px',
        background: 'rgba(12,12,16,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        animation: 'slideInLeft 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[13px] font-semibold text-text-primary">Activity Log</span>
          <span className="text-[11px] text-text-muted ml-1">{activity.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearTranscript}
            className="rounded-md px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary hover:bg-white/[0.04] transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Activity stream */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" ref={scrollRef}>
        {activity.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-[12px] text-text-muted/50">No activity yet</span>
            <span className="text-[11px] text-text-muted/30 mt-1">Speak or type to start</span>
          </div>
        )}

        {activity.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  switch (entry.type) {
    case 'user':
      return (
        <div className="flex gap-2.5 py-2">
          <div className="shrink-0 mt-0.5">
            <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="h-3 w-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">You</span>
            <p className="text-[13px] text-text-primary leading-relaxed mt-0.5">{entry.text}</p>
          </div>
        </div>
      );

    case 'agent':
      return (
        <div className="flex gap-2.5 py-2">
          <div className="shrink-0 mt-0.5">
            <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center">
              <svg className="h-3 w-3 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <circle cx="5" cy="5" r="1.5" />
                <circle cx="19" cy="5" r="1.5" />
                <circle cx="5" cy="19" r="1.5" />
                <circle cx="19" cy="19" r="1.5" />
              </svg>
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent/70">Agent</span>
            <p className="text-[13px] text-gray-200 leading-relaxed mt-0.5">{entry.text}</p>
          </div>
        </div>
      );

    case 'tool_start':
      return (
        <div className="flex items-start gap-2.5 py-1.5 pl-7">
          <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}
          >
            {entry.status === 'running' ? (
              <svg className="h-3 w-3 text-purple-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : entry.status === 'error' ? (
              <span className="text-[10px]">❌</span>
            ) : (
              <span className="text-[10px]">✓</span>
            )}
            <span className="text-[11px] font-mono text-purple-300">{entry.toolName || 'tool'}</span>
            {entry.status === 'running' && (
              <span className="text-[10px] text-purple-400/60">running...</span>
            )}
          </div>
        </div>
      );

    case 'tool_result':
      return (
        <div className="py-1 pl-7">
          <div
            className="rounded-md px-2.5 py-1.5 text-[11px] text-gray-400 leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {entry.text}
          </div>
        </div>
      );

    case 'thinking':
      return (
        <div className="flex items-center gap-2 py-1 pl-7">
          <span className="text-[12px]">{entry.icon || '💭'}</span>
          <span className="text-[11px] text-gray-400 italic">{entry.text}</span>
        </div>
      );

    case 'system':
      return (
        <div className="flex items-center gap-2 py-1.5 px-2">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span className="text-[10px] text-gray-500 shrink-0">{entry.text}</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      );

    default:
      return null;
  }
}
