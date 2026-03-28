import { useState, useCallback, useRef, useEffect } from 'react';
import { useIngestionStore } from '../../stores/ingestionStore';
import { colorForType } from '../../stores/graphStore';

const API_BASE = '';

interface IngestModalProps {
  onClose: () => void;
}

export default function IngestModal({ onClose }: IngestModalProps) {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'url' | 'youtube'>('text');
  const [collapsed, setCollapsed] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const {
    isIngesting,
    progress,
    entitiesFound,
    relationshipsFound,
    status,
    phase,
    detail,
    latestEntity,
    latestType,
    chunk,
    totalChunks,
    error,
    entityLog,
    startIngestion,
    setError,
    reset,
  } = useIngestionStore();

  // Auto-scroll entity log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entityLog.length]);

  // Auto-collapse when extraction starts so user sees graph
  useEffect(() => {
    if (status === 'extracting' || status === 'storing') {
      setCollapsed(true);
    }
  }, [status]);

  const handleIngest = useCallback(
    async (sourceType: string, content: string) => {
      if (!content.trim()) return;
      const jobId = crypto.randomUUID();
      startIngestion(jobId);
      try {
        const response = await fetch(`${API_BASE}/api/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_type: sourceType, source: content.trim() }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ detail: 'Request failed' }));
          setError(errData.detail || `HTTP ${response.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    },
    [startIngestion, setError],
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const jobId = crypto.randomUUID();
      startIngestion(jobId);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('job_id', jobId);
        const response = await fetch(`${API_BASE}/api/ingest/file`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ detail: 'Upload failed' }));
          setError(errData.detail || `HTTP ${response.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
      e.target.value = '';
    },
    [startIngestion, setError],
  );

  const handleSubmit = useCallback(() => {
    handleIngest(inputMode, inputText);
  }, [inputMode, inputText, handleIngest]);

  const handleDone = () => {
    reset();
    onClose();
  };

  // Not ingesting yet — show full input form as a slide-up panel
  if (status === 'idle') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
        <div
          className="mx-auto max-w-[640px] rounded-t-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(14,14,18,0.98) 0%, rgba(10,10,13,0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="text-[14px] font-semibold text-text-primary">Ingest Knowledge</h2>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-4 space-y-3">
            {/* Mode tabs */}
            <div className="flex rounded-lg p-0.5 bg-white/[0.03] border border-white/[0.06]">
              {(['text', 'url', 'youtube'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                    inputMode === mode
                      ? 'bg-white/[0.08] text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {mode === 'youtube' ? 'YouTube' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Input */}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                inputMode === 'text'
                  ? 'Paste any text — articles, notes, research papers...'
                  : inputMode === 'url'
                    ? 'https://...'
                    : 'YouTube URL...'
              }
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] text-text-primary placeholder-text-muted/40 focus:border-accent/30 focus:outline-none resize-none transition-all"
              rows={4}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!inputText.trim()}
                className={`flex-1 rounded-lg px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  !inputText.trim()
                    ? 'bg-white/[0.04] text-text-muted cursor-not-allowed'
                    : 'bg-accent text-black hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                }`}
              >
                Extract Knowledge
              </button>

              <label className="flex items-center justify-center rounded-lg border border-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:bg-white/[0.03] transition-all cursor-pointer">
                <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m-4 4l4-4 4 4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                PDF
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ingesting or complete — show non-blocking progress bar at bottom
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div
        className="mx-auto max-w-[640px] rounded-t-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(14,14,18,0.98) 0%, rgba(10,10,13,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header — always visible, clickable to expand/collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            {status === 'complete' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            ) : status === 'error' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
            )}

            <span className="text-[13px] font-medium text-text-primary">
              {status === 'complete'
                ? `Extracted ${entitiesFound} entities, ${relationshipsFound} relationships`
                : status === 'error'
                  ? 'Extraction failed'
                  : `Extracting... ${entitiesFound} entities found`}
            </span>

            {/* Live entity badge */}
            {isIngesting && latestEntity && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: colorForType(latestType) + '20',
                  color: colorForType(latestType),
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {latestEntity}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Chunk progress */}
            {isIngesting && totalChunks > 0 && (
              <span className="text-[11px] text-text-muted tabular-nums">
                Chunk {chunk}/{totalChunks}
              </span>
            )}

            {/* Expand/collapse chevron */}
            <svg
              className={`h-4 w-4 text-text-muted transition-transform ${collapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Progress bar — always visible */}
        <div className="h-1 w-full bg-white/[0.04]">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background:
                status === 'error'
                  ? '#ef4444'
                  : status === 'complete'
                    ? '#10b981'
                    : 'linear-gradient(90deg, #f59e0b, #10b981)',
            }}
          />
        </div>

        {/* Expanded details */}
        {!collapsed && (
          <div className="px-5 py-3 space-y-3">
            {/* Stats row */}
            <div className="flex items-center gap-6 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">Entities</span>
                <span className="text-text-primary font-bold tabular-nums text-[16px]">
                  {entitiesFound}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">Relations</span>
                <span className="text-text-primary font-bold tabular-nums text-[16px]">
                  {relationshipsFound}
                </span>
              </div>
              <div className="flex-1" />
              <span className="text-[11px] text-text-muted">
                {detail || phase}
              </span>
            </div>

            {/* Live entity feed */}
            {entityLog.length > 0 && (
              <div
                ref={logRef}
                className="max-h-[120px] overflow-y-auto space-y-1 rounded-lg bg-white/[0.02] border border-white/[0.04] p-2"
              >
                {entityLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorForType(entry.type) }}
                    />
                    <span className="text-text-muted">{entry.type}</span>
                    <span className="text-text-primary">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-[12px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Done button */}
            {(status === 'complete' || status === 'error') && (
              <button
                onClick={handleDone}
                className="w-full rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 text-[12px] font-semibold text-accent hover:bg-accent/15 transition-colors"
              >
                {status === 'complete' ? 'Done' : 'Close'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
