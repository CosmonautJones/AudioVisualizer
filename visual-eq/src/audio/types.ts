// Audio Engine Types for MVP
export interface AudioEngineConfig {
  fftSize: 512 | 1024 | 2048 | 4096 | 8192;
  sensitivity: number; // 0.1 - 5.0
  smoothing: number; // 0.0 - 1.0
}

export type AudioSourceType = 'microphone' | 'file';

export type AudioEngineError = 
  | 'mic-denied'
  | 'mic-not-found' 
  | 'audio-context-failed'
  | 'file-decode-failed'
  | 'browser-unsupported'
  | 'not-supported';

export interface AudioEngineState {
  initialized: boolean;
  currentSource: AudioSourceType | null;
  isPlaying: boolean;
  error: AudioEngineError | null;
}