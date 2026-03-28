import { useEffect, useRef } from 'react';
import { useGraphStore } from '../../stores/graphStore';

export default function ThoughtStream() {
  const isThinking = useGraphStore((s) => s.isThinking);
  const thinkingQuery = useGraphStore((s) => s.thinkingQuery);
  const thinkingSteps = useGraphStore((s) => s.thinkingSteps);
  const thinkingClear = useGraphStore((s) => s.thinkingClear);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingSteps.length]);

  if (!isThinking && thinkingSteps.length === 0) return null;

  return (
    <div
      className="glass-panel flex flex-col overflow-hidden"
      style={{ width: '320px', maxHeight: '300px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {isThinking && (
            <span
              className="h-2 w-2 rounded-full bg-accent"
              style={{
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
                animation: 'pulse-ring 1.5s ease-out infinite',
              }}
            />
          )}
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            {isThinking ? 'Thinking...' : 'Complete'}
          </span>
        </div>
        {!isThinking && (
          <button
            onClick={thinkingClear}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Query */}
      {thinkingQuery && (
        <div className="px-4 py-2">
          <p className="font-headline italic text-[13px] text-text-secondary line-clamp-2">
            &ldquo;{thinkingQuery}&rdquo;
          </p>
        </div>
      )}

      {/* Steps */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {thinkingSteps.map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-2 py-1"
            style={{
              animation: 'fadeSlideIn 0.3s ease-out',
              opacity: isThinking && i === thinkingSteps.length - 1 ? 1 : 0.6,
            }}
          >
            <span className="text-sm shrink-0 mt-0.5">{step.icon}</span>
            <span className="text-[12px] text-text-secondary leading-relaxed">
              {step.step}
            </span>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-1.5 py-1 pl-6">
            <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
            <span className="h-1 w-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="h-1 w-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>
    </div>
  );
}
