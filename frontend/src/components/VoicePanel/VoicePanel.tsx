import { useRef, useEffect, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import type { ClientEvent } from '../../types/events';

interface VoicePanelProps {
  sendEvent: (event: ClientEvent) => void;
}

export default function VoicePanel({ sendEvent }: VoicePanelProps) {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const isRecording = useVoiceStore((s) => s.isRecording);

  const { startRecording, stopRecording, analyserRef } = useAudioCapture({ sendEvent });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      sendEvent({ type: 'stop_voice' });
    } else {
      try {
        sendEvent({ type: 'start_voice' });
        await startRecording();
      } catch (err) {
        console.error('Failed to start recording:', err);
        sendEvent({ type: 'stop_voice' });
      }
    }
  }, [isRecording, startRecording, stopRecording, sendEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const analyser = analyserRef.current;
      if (!analyser || !isRecording) return;

      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);
      const n = 5, bw = 2.5, gap = w / n, step = Math.floor(bufLen / n);
      for (let i = 0; i < n; i++) {
        const val = data[i * step] / 255;
        const bh = Math.max(2, val * h * 0.8);
        const x = i * gap + (gap - bw) / 2;
        ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + val * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(x, (h - bh) / 2, bw, bh, 1);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRecording, analyserRef]);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Waveform — only when recording */}
      {isRecording && (
        <canvas ref={canvasRef} width={25} height={20} className="shrink-0 opacity-80" />
      )}
      {!isRecording && <canvas ref={canvasRef} width={0} height={0} className="hidden" />}

      {/* Mic button */}
      <button
        onClick={toggleRecording}
        disabled={!isConnected}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all shrink-0 ${
          !isConnected ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'
        }`}
        style={{
          background: isRecording
            ? '#ef4444'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          boxShadow: isRecording
            ? '0 0 16px rgba(239,68,68,0.4)'
            : '0 0 12px rgba(245,158,11,0.2)',
        }}
        title={isRecording ? 'Stop recording' : 'Start voice'}
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full pulse-ring" style={{ backgroundColor: '#ef4444' }} />
        )}
        {isRecording ? (
          <svg className="h-3 w-3 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 relative z-10" fill="#050507" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
