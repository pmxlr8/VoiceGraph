import { useState, useRef } from 'react';
import { useIngestionStore } from '../../stores/ingestionStore';

type InputType = 'text' | 'link' | 'file' | 'folder' | 'audio';
type ContextType = 'personal' | 'institutional' | 'external';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
}

const INPUT_OPTIONS: { type: InputType; icon: string; label: string; accept?: string }[] = [
  { type: 'text', icon: '✏️', label: 'Type or paste text' },
  { type: 'link', icon: '🔗', label: 'Link (URL or YouTube)' },
  { type: 'file', icon: '📄', label: 'File (PDF, DOCX, TXT, MD)', accept: '.pdf,.docx,.txt,.md' },
  { type: 'folder', icon: '📁', label: 'Folder / Second Brain (ZIP)', accept: '.zip' },
  { type: 'audio', icon: '🎧', label: 'Audio (MP3, MP4, WAV, M4A)', accept: '.mp3,.mp4,.wav,.m4a' },
];

export default function BottomSheet({ open, onClose }: BottomSheetProps) {
  const [selected, setSelected] = useState<InputType | null>(null);
  const [collection, setCollection] = useState('');
  const [context, setContext] = useState<ContextType>('personal');
  const [textInput, setTextInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const startIngestion = useIngestionStore((s) => s.startIngestion);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!collection.trim()) return;
    setSubmitting(true);

    try {
      if (selected === 'text' && textInput.trim()) {
        const resp = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_type: 'text',
            source: textInput,
            options: { collection_name: collection, context },
          }),
        });
        const data = await resp.json();
        startIngestion(data.job_id);
      } else if (selected === 'link' && linkInput.trim()) {
        const isYT = linkInput.includes('youtube.com') || linkInput.includes('youtu.be');
        const resp = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_type: isYT ? 'youtube' : 'url',
            source: linkInput,
            options: { collection_name: collection, context },
          }),
        });
        const data = await resp.json();
        startIngestion(data.job_id);
      } else if ((selected === 'file' || selected === 'folder' || selected === 'audio') && fileRef.current?.files?.[0]) {
        const file = fileRef.current.files[0];
        const formData = new FormData();
        formData.append('file', file);
        const st = selected === 'folder' ? 'folder' : selected === 'audio' ? 'audio' : 'pdf';
        formData.append('source_type', st);
        formData.append('collection_name', collection);
        formData.append('context', context);
        const resp = await fetch('/api/ingest/file', { method: 'POST', body: formData });
        const data = await resp.json();
        startIngestion(data.job_id);
      }
      onClose();
    } catch (err) {
      console.error('Ingestion failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setTextInput('');
    setLinkInput('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg glass-1 rounded-t-2xl p-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        {!selected ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Add knowledge</h2>
              <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-lg">×</button>
            </div>
            <div className="space-y-1">
              {INPUT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setSelected(opt.type)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-3 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button onClick={handleBack} className="text-text-muted hover:text-text-secondary text-sm">← Back</button>
              <h2 className="text-lg font-semibold text-text-primary">
                {INPUT_OPTIONS.find((o) => o.type === selected)?.label}
              </h2>
            </div>

            {/* Collection name */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Collection name</label>
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder='e.g. "PhD year 2", "Research papers — kidney disease"'
                className="w-full glass-2 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none"
              />
            </div>

            {/* Context selector */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Context</label>
              <div className="flex gap-1">
                {(['personal', 'institutional', 'external'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setContext(c)}
                    className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition-all ${
                      context === c
                        ? 'glass-2 text-text-primary ring-1 ring-white/20'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific input */}
            {selected === 'text' && (
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your text, notes, or article here..."
                rows={6}
                className="w-full glass-2 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none resize-none"
              />
            )}
            {selected === 'link' && (
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://... or YouTube URL"
                className="w-full glass-2 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none"
              />
            )}
            {(selected === 'file' || selected === 'folder' || selected === 'audio') && (
              <div className="glass-2 rounded-xl px-4 py-6 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept={INPUT_OPTIONS.find((o) => o.type === selected)?.accept}
                  className="hidden"
                  id="bottom-sheet-file"
                />
                <label
                  htmlFor="bottom-sheet-file"
                  className="cursor-pointer text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Click to choose a file
                </label>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !collection.trim()}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
              style={{ background: 'hsla(45, 80%, 65%, 0.85)', color: '#09090b' }}
            >
              {submitting ? 'Processing...' : 'Extract knowledge'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
