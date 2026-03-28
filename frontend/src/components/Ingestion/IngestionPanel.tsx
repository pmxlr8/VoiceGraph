import { useState, useCallback } from 'react';
import { useIngestionStore } from '../../stores/ingestionStore';

const API_BASE = '';

export default function IngestionPanel() {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'url' | 'youtube'>('text');

  const {
    isIngesting,
    progress,
    entitiesFound,
    relationshipsFound,
    status,
    error,
    startIngestion,
    setError,
    reset,
  } = useIngestionStore();

  const handleIngest = useCallback(
    async (sourceType: string, content: string) => {
      if (!content.trim()) return;

      const jobId = crypto.randomUUID();
      startIngestion(jobId);

      try {
        const response = await fetch(`${API_BASE}/api/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_type: sourceType,
            source: content.trim(),
          }),
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
    const sourceTypeMap: Record<string, string> = {
      text: 'text',
      url: 'url',
      youtube: 'youtube',
    };
    handleIngest(sourceTypeMap[inputMode], inputText);
    setInputText('');
  }, [inputMode, inputText, handleIngest]);

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        Ingest Data
      </h3>

      {/* Mode selector */}
      <div className="flex rounded-lg bg-bg-primary/60 p-1">
        {(['text', 'url', 'youtube'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
              inputMode === mode
                ? 'bg-bg-tertiary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {mode === 'youtube' ? 'YouTube' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Input area */}
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={
          inputMode === 'text'
            ? 'Paste text to extract knowledge from...'
            : inputMode === 'url'
              ? 'Enter a URL...'
              : 'Enter a YouTube URL...'
        }
        disabled={isIngesting}
        className="w-full rounded-lg border border-border bg-bg-primary/40 px-3 py-2.5 text-[13px] text-text-primary placeholder-text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 disabled:opacity-50 resize-none transition-colors"
        rows={3}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isIngesting || !inputText.trim()}
          className="flex-1 btn-amber px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        >
          {isIngesting ? 'Processing...' : 'Extract'}
        </button>

        <label
          className={`flex items-center justify-center rounded-lg border border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer ${
            isIngesting ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          PDF
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isIngesting}
          />
        </label>
      </div>

      {/* Progress display */}
      {status !== 'idle' && (
        <div className="rounded-xl border border-border bg-bg-primary/40 p-3 space-y-2.5">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-secondary">
              {status === 'complete' ? 'Complete' : status === 'error' ? 'Error' : 'Extracting...'}
            </span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                status === 'complete'
                  ? 'bg-secondary/15 text-secondary'
                  : status === 'error'
                    ? 'bg-error/15 text-error'
                    : 'bg-accent/15 text-accent'
              }`}
            >
              {status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: status === 'error'
                  ? '#ef4444'
                  : 'linear-gradient(90deg, #f59e0b, #34d399)',
              }}
            />
          </div>

          {/* Counts */}
          {(entitiesFound > 0 || relationshipsFound > 0) && (
            <div className="flex gap-4 text-[11px]">
              <span className="text-text-muted">
                Entities: <span className="text-text-primary font-medium">{entitiesFound}</span>
              </span>
              <span className="text-text-muted">
                Rels: <span className="text-text-primary font-medium">{relationshipsFound}</span>
              </span>
            </div>
          )}

          {error && (
            <div className="text-[11px] text-error">{error}</div>
          )}

          {(status === 'complete' || status === 'error') && (
            <button
              onClick={reset}
              className="w-full rounded-lg border border-border px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
