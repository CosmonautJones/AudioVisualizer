// Branded types for type safety and runtime validation
export type FrequencyData = Uint8Array & { readonly _brand: 'FrequencyData' };
export type TimeData = Uint8Array & { readonly _brand: 'TimeData' };
export type AudioContextState = 'suspended' | 'running' | 'closed' | 'interrupted';
export type AudioSourceType = 'file' | 'microphone' | 'stream';
export type VisualizationType = 'frequency' | 'waveform' | 'spectrogram' | 'oscilloscope';

// Audio processing configuration with strict validation
export interface AudioProcessingConfig {
  readonly fftSize: 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768;
  readonly smoothingTimeConstant: number; // 0-1
  readonly minDecibels: number;
  readonly maxDecibels: number;
}

// Generic audio source interface with type constraints
export interface AudioSource<T extends AudioSourceType> {
  readonly type: T;
  readonly isActive: boolean;
  readonly isConnected: boolean;
  connect(destination: AudioNode): Promise<AudioSourceResult<T>>;
  disconnect(): void;
  getMetadata(): AudioSourceMetadata<T>;
  dispose(): void;
}

// Conditional types for different audio sources
export type AudioSourceResult<T> = T extends 'file' 
  ? FileAudioSource 
  : T extends 'microphone' 
  ? MicrophoneAudioSource 
  : StreamAudioSource;

// Audio source metadata with discriminated unions
export type AudioSourceMetadata<T> = T extends 'file' 
  ? {
      type: 'file';
      filename: string;
      duration: number;
      sampleRate: number;
      channels: number;
      bitRate?: number;
    }
  : T extends 'microphone' 
  ? {
      type: 'microphone';
      deviceId: string;
      deviceName: string;
      sampleRate: number;
      channels: number;
    }
  : {
      type: 'stream';
      streamId: string;
      sampleRate: number;
      channels: number;
    };

// Specific audio source implementations
export interface FileAudioSource extends AudioSource<'file'> {
  readonly file: File;
  readonly audioElement: HTMLAudioElement;
  load(): Promise<Result<void>>;
  play(): Promise<Result<void>>;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
}

export interface MicrophoneAudioSource extends AudioSource<'microphone'> {
  readonly mediaStream: MediaStream | null;
  readonly constraints: MediaStreamConstraints;
  requestPermission(): Promise<PermissionState>;
  startRecording(): Promise<void>;
  stopRecording(): void;
  getVolume(): number;
  getAvailableDevices?(): Promise<MicrophoneCapabilities[]>;
}

export interface StreamAudioSource extends AudioSource<'stream'> {
  readonly stream: MediaStream;
  readonly origin: string;
}

// Application state with discriminated unions
export type AppState = 
  | { status: 'idle' }
  | { status: 'loading'; progress: number; message?: string }
  | { status: 'playing'; audioSource: AudioSourceType; duration?: number }
  | { status: 'paused'; audioSource: AudioSourceType; currentTime: number }
  | { status: 'error'; error: AudioVisualizerError };

// Comprehensive error handling with specific error types
export type AudioVisualizerError = 
  | { type: 'permission_denied'; source: 'microphone'; message: string; canRetry: boolean }
  | { type: 'file_format_unsupported'; format: string; supportedFormats: string[]; message: string; canRetry: boolean }
  | { type: 'audio_context_failed'; reason: string; message: string; canRetry: boolean }
  | { type: 'canvas_render_failed'; context: '2d' | 'webgl'; fallbackAvailable: boolean; message: string; canRetry: boolean }
  | { type: 'network_error'; url: string; statusCode?: number; message: string; canRetry: boolean }
  | { type: 'browser_incompatible'; feature: string; alternatives: string[]; message: string; canRetry: boolean };

// Event system with strict typing
export interface AudioVisualizerEvents {
  'state-change': AppState;
  'audio-data': { frequency: FrequencyData; time: TimeData };
  'source-connected': { type: AudioSourceType; metadata: AudioSourceMetadata<AudioSourceType> };
  'render-frame': { timestamp: number; frameData: VisualizationFrameData };
  'error': AudioVisualizerError;
  'permission-requested': { type: 'microphone' | 'file' };
  'permission-granted': { type: 'microphone' | 'file' };
  'audio-context-resumed': { previousState: AudioContextState };
}

// Performance monitoring and optimization
export interface PerformanceMetrics {
  readonly frameRate: number;
  readonly audioLatency: number;
  readonly renderTime: number;
  readonly memoryUsage: number;
  readonly droppedFrames: number;
  readonly averageFrameTime: number;
}

// Visualization frame data
export interface VisualizationFrameData {
  readonly frequencyData: FrequencyData;
  readonly timeData: TimeData;
  readonly timestamp: number;
  readonly sampleRate: number;
  readonly frameNumber: number;
}

// Configuration validation and immutable updates
export type ValidatedConfig<T> = T & { readonly _validated: true };
export type ImmutableUpdate<T> = {
  readonly [K in keyof T]: T[K] extends object ? ImmutableUpdate<T[K]> : T[K];
};

// Result type for error handling
export type Result<T, E = AudioVisualizerError> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Async operation wrapper
export type AsyncOperation<T> = () => Promise<Result<T>>;

// Event listener types
export type EventListener<T> = (data: T) => void;
export type EventMap = { [K in keyof AudioVisualizerEvents]: AudioVisualizerEvents[K] };

// Memoization for performance
export type MemoizedFunction<Args extends readonly unknown[], Return> = 
  ((...args: Args) => Return) & { cache: Map<string, Return> };

// Audio context configuration
export interface AudioContextConfig {
  readonly sampleRate?: number;
  readonly latencyHint?: AudioContextLatencyCategory;
  readonly channelCount?: number;
  readonly channelCountMode?: ChannelCountMode;
  readonly channelInterpretation?: ChannelInterpretation;
}

// Mobile optimization flags
export interface MobileOptimizations {
  readonly reduceFrameRate: boolean;
  readonly simplifyVisualizations: boolean;
  readonly enableHapticFeedback: boolean;
  readonly respectReducedMotion: boolean;
  readonly batteryAware: boolean;
  readonly reducedBarCount: boolean;
  readonly increasedSensitivity: boolean;
  readonly optimizedSmoothing: boolean;
  readonly batteryOptimizations: boolean;
}

// Type guards for runtime safety
export function isFrequencyData(data: unknown): data is FrequencyData {
  return data instanceof Uint8Array;
}

export function isTimeData(data: unknown): data is TimeData {
  return data instanceof Uint8Array;
}

export function isAudioVisualizerError(error: unknown): error is AudioVisualizerError {
  return typeof error === 'object' && error !== null && 'type' in error;
}

// Utility types for component props
export interface AudioVisualizerProps {
  className?: string;
  onStateChange?: (state: AppState) => void;
  onError?: (error: AudioVisualizerError) => void;
  config?: Partial<AudioProcessingConfig>;
  mobileOptimizations?: Partial<MobileOptimizations>;
}

// Visualization configuration
export interface VisualizationConfig {
  readonly type: VisualizationType;
  readonly barCount: number;
  readonly sensitivity: number;
  readonly smoothing: number;
  readonly colorScheme: 'spectrum' | 'monochrome' | 'custom';
  readonly showPeaks: boolean;
  readonly mirrorBars: boolean;
  readonly normalize?: boolean;
  readonly logarithmicScale?: boolean;
  readonly enableWebGL?: boolean;
}

// Audio visualizer settings for the application
export interface AudioVisualizerSettings {
  readonly audioConfig: AudioProcessingConfig;
  readonly visualizationConfig: VisualizationConfig;
  readonly mobileOptimizations: MobileOptimizations;
  readonly performanceMode: 'high' | 'medium' | 'low' | 'auto' | 'performance' | 'quality';
  readonly enableDebugMode: boolean;
  readonly visualization?: VisualizationConfig;
  readonly volume?: number;
  readonly colorScheme?: string;
}

// Microphone capabilities and constraints
export interface MicrophoneCapabilities {
  readonly deviceId: string;
  readonly label: string;
  readonly groupId: string;
  readonly supportedConstraints: MediaTrackSupportedConstraints;
  readonly maxSampleRate: number;
  readonly maxChannelCount: number;
  readonly hasEchoCancellation: boolean;
  readonly hasNoiseSuppression: boolean;
  readonly hasAutoGainControl: boolean;
  readonly hasPermission: boolean;
  readonly isDefault: boolean;
}