import { create } from 'zustand';

interface TranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

interface VoiceState {
  // Connection state
  isConnected: boolean;
  isRecording: boolean;

  // Transcript history
  transcript: TranscriptEntry[];

  // Actions
  setConnected: (connected: boolean) => void;
  setRecording: (recording: boolean) => void;
  addTranscript: (role: 'user' | 'agent', text: string) => void;
  clearTranscript: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isConnected: false,
  isRecording: false,
  transcript: [],

  setConnected: (connected) => set({ isConnected: connected }),
  setRecording: (recording) => set({ isRecording: recording }),

  addTranscript: (role, text) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        { role, text, timestamp: Date.now() },
      ],
    })),

  clearTranscript: () => set({ transcript: [] }),
}));
