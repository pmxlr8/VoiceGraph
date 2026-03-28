import { create } from 'zustand';

interface IngestionState {
  isIngesting: boolean;
  currentJobId: string | null;
  phase: string;
  progress: number;
  entitiesFound: number;
  relationshipsFound: number;
  status: 'idle' | 'parsing' | 'extracting' | 'complete' | 'error';
  error: string | null;

  startIngestion: (jobId: string) => void;
  updateProgress: (phase: string, progress: number, entities: number, relationships: number) => void;
  setComplete: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useIngestionStore = create<IngestionState>((set) => ({
  isIngesting: false,
  currentJobId: null,
  phase: '',
  progress: 0,
  entitiesFound: 0,
  relationshipsFound: 0,
  status: 'idle',
  error: null,

  startIngestion: (jobId) =>
    set({
      isIngesting: true,
      currentJobId: jobId,
      phase: 'Discovery',
      progress: 0,
      entitiesFound: 0,
      relationshipsFound: 0,
      status: 'parsing',
      error: null,
    }),

  updateProgress: (phase, progress, entities, relationships) =>
    set({
      phase,
      progress,
      entitiesFound: entities,
      relationshipsFound: relationships,
      status: 'extracting',
    }),

  setComplete: () =>
    set({
      isIngesting: false,
      status: 'complete',
      progress: 100,
    }),

  setError: (error) =>
    set({
      isIngesting: false,
      status: 'error',
      error,
    }),

  reset: () =>
    set({
      isIngesting: false,
      currentJobId: null,
      phase: '',
      progress: 0,
      entitiesFound: 0,
      relationshipsFound: 0,
      status: 'idle',
      error: null,
    }),
}));
