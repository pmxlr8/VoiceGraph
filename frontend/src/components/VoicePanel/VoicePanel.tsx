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
  const transcript = useVoiceStore((s) => s.transcript);

  const { startRecording, stopRecording, analyserRef } = useAudioCapture({ sendEvent });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch {
        // Error already logged
      }
    }
  }, [isRecording, startRecording, stopRecording]);

  // Waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      if (!analyser || !isRecording) {
        // Idle: subtle dots
        const barCount = 16;
        const gap = width / barCount;
        for (let i = 0; i < barCount; i++) {
          const x = i * gap + gap / 2;
          ctx.fillStyle = 'rgba(161, 161, 170, 0.15)';
          ctx.beginPath();
          ctx.arc(x, height / 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barCount = 16;
      const barWidth = 2.5;
      const gap = width / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] / 255;
        const barH = Math.max(2, val * height * 0.85);
        const x = i * gap + (gap - barWidth) / 2;
        const y = (height - barH) / 2;

        const alpha = 0.5 + val * 0.5;
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRecording, analyserRef]);

  const lastTranscript = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  return (
    <div
      className="flex items-center gap-3 rounded-full px-4 py-2"
      style={{
        background: 'rgba(24, 24, 27, 0.88)',
        border: '1px solid rgba(63, 63, 70, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        minWidth: '380px',
      }}
    >
      {/* Connection dot */}
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{
          backgroundColor: isConnected ? '#34d399' : '#ef4444',
          boxShadow: isConnected ? '0 0 8px rgba(52, 211, 153, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)',
        }}
      />

      {/* Status / transcript */}
      <div className="flex-1 min-w-0 truncate">
        {isRecording ? (
          <span className="text-[12px] font-medium text-accent">Listening...</span>
        ) : lastTranscript ? (
          <span className="text-[13px] text-text-secondary truncate">
            {lastTranscript.text}
          </span>
        ) : (
          <span className="text-[12px] text-text-muted">
            {isConnected ? 'Ready — click mic to speak' : 'Disconnected'}
          </span>
        )}
      </div>

      {/* Waveform */}
      <canvas ref={canvasRef} width={80} height={28} className="shrink-0" />

      {/* Mic button */}
      <button
        onClick={toggleRecording}
        disabled={!isConnected}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all shrink-0 ${
          !isConnected ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
        }`}
        style={{
          background: isRecording
            ? '#ef4444'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          boxShadow: isRecording
            ? '0 0 16px rgba(239, 68, 68, 0.5)'
            : '0 0 12px rgba(245, 158, 11, 0.3)',
        }}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full pulse-ring"
            style={{ backgroundColor: '#ef4444' }}
          />
        )}
        {isRecording ? (
          <svg className="h-3.5 w-3.5 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 relative z-10" fill="#09090b" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
