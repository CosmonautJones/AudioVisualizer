import type { AudioProcessingConfig, MobileOptimizations, VisualizationConfig } from '../types/audio';
import type { AdaptiveQuality, QualityLevel } from '../types/canvas';

// Optimal FFT sizes for different devices and performance requirements
export const FFT_SIZES = {
  MOBILE_LOW: 1024,
  MOBILE_STANDARD: 2048,
  DESKTOP_STANDARD: 4096,
  DESKTOP_HIGH: 8192,
  DESKTOP_ULTRA: 16384,
} as const;

// Default audio processing configurations
export const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
  fftSize: 4096,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
};

export const MOBILE_AUDIO_CONFIG: AudioProcessingConfig = {
  fftSize: 2048,
  smoothingTimeConstant: 0.75,
  minDecibels: -80,
  maxDecibels: -10,
};

// Sample rate configurations
export const SAMPLE_RATES = {
  CD_QUALITY: 44100,
  HIGH_QUALITY: 48000,
  MOBILE_OPTIMIZED: 22050,
  LOW_LATENCY: 16000,
} as const;

// Visualization control ranges and defaults
export const VISUALIZATION_CONTROLS = {
  SENSITIVITY: {
    MIN: 0.5,
    MAX: 3.0,
    DEFAULT: 1.0,
    STEP: 0.1,
  },
  SMOOTHING: {
    MIN: 0.0,
    MAX: 0.95,
    DEFAULT: 0.8,
    STEP: 0.05,
  },
  BAR_COUNT: {
    MIN: 16,
    MAX: 96,
    DEFAULT: 64,
    STEP: 8,
    MOBILE_MAX: 48, // Reduce on mobile for performance
  },
} as const;

// Default visualization configuration
export const DEFAULT_VISUALIZATION_CONFIG: VisualizationConfig = {
  type: 'frequency',
  barCount: VISUALIZATION_CONTROLS.BAR_COUNT.DEFAULT,
  sensitivity: VISUALIZATION_CONTROLS.SENSITIVITY.DEFAULT,
  smoothing: VISUALIZATION_CONTROLS.SMOOTHING.DEFAULT,
  colorScheme: 'spectrum',
  showPeaks: true,
  mirrorBars: false,
};

// Performance budgets and frame timing
export const PERFORMANCE_BUDGETS = {
  TARGET_FPS: {
    DESKTOP: 60,
    MOBILE: 30,
    LOW_POWER: 20,
  },
  FRAME_TIME_MS: {
    TARGET: 16.67, // 60fps
    MOBILE_TARGET: 33.33, // 30fps
    WARNING_THRESHOLD: 20,
    CRITICAL_THRESHOLD: 50,
  },
  MEMORY_LIMITS: {
    BUFFER_SIZE_MB: 10,
    TEXTURE_CACHE_MB: 5,
    MOBILE_BUFFER_SIZE_MB: 5,
  },
} as const;

// Browser compatibility and feature detection
export const BROWSER_SUPPORT = {
  REQUIRED_FEATURES: [
    'AudioContext',
    'AnalyserNode',
    'Canvas',
    'RequestAnimationFrame',
  ] as const,
  OPTIONAL_FEATURES: [
    'OffscreenCanvas',
    'WebGL2',
    'AudioWorklet',
    'SharedArrayBuffer',
  ] as const,
  IOS_SAFARI_QUIRKS: {
    REQUIRES_USER_GESTURE: true,
    CONTEXT_RESUME_NEEDED: true,
    MAX_AUDIO_CONTEXTS: 4,
    REDUCED_BUFFER_SIZE: true,
  },
  CHROME_MOBILE_QUIRKS: {
    AUTOPLAY_POLICY: true,
    REDUCED_SAMPLE_RATE: true,
    MEMORY_PRESSURE_HANDLING: true,
  },
} as const;

// Supported audio formats with MIME types and extensions
export const SUPPORTED_AUDIO_FORMATS = {
  MP3: {
    mimeTypes: ['audio/mpeg', 'audio/mp3'],
    extensions: ['.mp3'],
    quality: 'lossy',
    browserSupport: 'excellent',
  },
  MP4: {
    mimeTypes: ['audio/mp4', 'audio/m4a'],
    extensions: ['.mp4', '.m4a'],
    quality: 'lossy',
    browserSupport: 'excellent',
  },
  WAV: {
    mimeTypes: ['audio/wav', 'audio/wave'],
    extensions: ['.wav'],
    quality: 'lossless',
    browserSupport: 'excellent',
  },
  OGG: {
    mimeTypes: ['audio/ogg', 'audio/vorbis'],
    extensions: ['.ogg'],
    quality: 'lossy',
    browserSupport: 'good',
  },
  FLAC: {
    mimeTypes: ['audio/flac'],
    extensions: ['.flac'],
    quality: 'lossless',
    browserSupport: 'limited',
  },
} as const;

// Error messages and user guidance
export const ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Microphone access is required for live audio visualization',
  UNSUPPORTED_FORMAT: 'This audio format is not supported. Please try MP3, WAV, or M4A files',
  AUDIO_CONTEXT_FAILED: 'Failed to initialize audio processing. Your browser may not support Web Audio API',
  CANVAS_FAILED: 'Failed to initialize canvas. Please check your browser settings',
  NO_AUDIO_DETECTED: 'No audio detected. Please check your audio levels or try a different source',
  BROWSER_INCOMPATIBLE: 'Your browser is not compatible with this audio visualizer',
} as const;

// Mobile optimization defaults
export const DEFAULT_MOBILE_OPTIMIZATIONS: MobileOptimizations = {
  reduceFrameRate: true,
  simplifyVisualizations: true,
  enableHapticFeedback: true,
  respectReducedMotion: true,
  batteryAware: true,
  reducedBarCount: true,
  increasedSensitivity: true,
  optimizedSmoothing: true,
  batteryOptimizations: true,
};

// Adaptive quality levels for performance management
export const QUALITY_LEVELS: QualityLevel[] = [
  {
    name: 'Ultra',
    barCount: 96,
    frameRate: 60,
    enableSmoothing: true,
    enableEffects: true,
    description: 'Maximum quality with all effects',
  },
  {
    name: 'High',
    barCount: 64,
    frameRate: 60,
    enableSmoothing: true,
    enableEffects: true,
    description: 'High quality with smooth animations',
  },
  {
    name: 'Medium',
    barCount: 48,
    frameRate: 45,
    enableSmoothing: true,
    enableEffects: false,
    description: 'Balanced quality and performance',
  },
  {
    name: 'Low',
    barCount: 32,
    frameRate: 30,
    enableSmoothing: false,
    enableEffects: false,
    description: 'Basic quality for better performance',
  },
  {
    name: 'Minimal',
    barCount: 16,
    frameRate: 20,
    enableSmoothing: false,
    enableEffects: false,
    description: 'Minimal quality for low-end devices',
  },
];

export const DEFAULT_ADAPTIVE_QUALITY: AdaptiveQuality = {
  enabled: true,
  targetFps: 60,
  minFps: 20,
  qualityLevels: QUALITY_LEVELS,
  currentLevel: 1, // Start with 'High' quality
};

// Color schemes for visualizations
export const COLOR_SCHEMES = {
  SPECTRUM: {
    type: 'rainbow',
    colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
    opacity: 0.8,
    backgroundAlpha: 0.1,
  },
  MONOCHROME: {
    type: 'gradient',
    colors: ['#ffffff', '#888888'],
    opacity: 0.9,
    backgroundAlpha: 0.05,
  },
  NEON: {
    type: 'gradient',
    colors: ['#00ffff', '#ff00ff', '#ffff00'],
    opacity: 1.0,
    backgroundAlpha: 0.0,
  },
  WARM: {
    type: 'gradient',
    colors: ['#ff6b35', '#f7931e', '#ffcc02'],
    opacity: 0.85,
    backgroundAlpha: 0.05,
  },
  COOL: {
    type: 'gradient',
    colors: ['#0066cc', '#0099ff', '#00ccff'],
    opacity: 0.85,
    backgroundAlpha: 0.05,
  },
} as const;

// Frequency bands for spectral analysis
export const FREQUENCY_BANDS = {
  SUB_BASS: { min: 20, max: 60, name: 'Sub Bass' },
  BASS: { min: 60, max: 250, name: 'Bass' },
  LOW_MIDS: { min: 250, max: 500, name: 'Low Mids' },
  MIDS: { min: 500, max: 2000, name: 'Mids' },
  HIGH_MIDS: { min: 2000, max: 4000, name: 'High Mids' },
  PRESENCE: { min: 4000, max: 6000, name: 'Presence' },
  BRILLIANCE: { min: 6000, max: 20000, name: 'Brilliance' },
} as const;

// Audio context configuration presets
export const AUDIO_CONTEXT_PRESETS = {
  LOW_LATENCY: {
    sampleRate: 48000,
    latencyHint: 'interactive' as AudioContextLatencyCategory,
    channelCount: 2,
  },
  BALANCED: {
    sampleRate: 44100,
    latencyHint: 'balanced' as AudioContextLatencyCategory,
    channelCount: 2,
  },
  POWER_SAVING: {
    sampleRate: 22050,
    latencyHint: 'playback' as AudioContextLatencyCategory,
    channelCount: 1,
  },
} as const;

// Device detection constants
export const DEVICE_DETECTION = {
  MOBILE_USER_AGENTS: [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ],
  IOS_USER_AGENT: /iPhone|iPad|iPod/i,
  CHROME_MOBILE_USER_AGENT: /Chrome.*Mobile/i,
  SAFARI_USER_AGENT: /Safari(?!.*Chrome)/i,
} as const;

// Accessibility constants
export const ACCESSIBILITY = {
  KEYBOARD_SHORTCUTS: {
    PLAY_PAUSE: ' ', // Space
    TOGGLE_MIC: 'm',
    INCREASE_SENSITIVITY: 'ArrowUp',
    DECREASE_SENSITIVITY: 'ArrowDown',
    TOGGLE_CONTROLS: 'Escape',
    FOCUS_FILE_INPUT: 'f',
  },
  FOCUS_RING_COLOR: '#0066cc',
  HIGH_CONTRAST_COLORS: {
    FOREGROUND: '#ffffff',
    BACKGROUND: '#000000',
    ACCENT: '#ffff00',
  },
  REDUCED_MOTION_ALTERNATIVES: {
    DISABLE_ANIMATIONS: true,
    STATIC_VISUALIZATION: true,
    MINIMAL_EFFECTS: true,
  },
} as const;

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  FRAME_DROP_WARNING: 5, // consecutive dropped frames
  FRAME_DROP_CRITICAL: 10,
  MEMORY_WARNING_MB: 50,
  MEMORY_CRITICAL_MB: 100,
  AUDIO_LATENCY_WARNING_MS: 50,
  AUDIO_LATENCY_CRITICAL_MS: 100,
} as const;

// WebGL constants (for future use)
export const WEBGL_CONFIG = {
  VERTEX_BUFFER_SIZE: 65536,
  INDEX_BUFFER_SIZE: 65536,
  TEXTURE_SIZE: 512,
  MAX_TEXTURES: 8,
  PRECISION: 'mediump' as 'lowp' | 'mediump' | 'highp',
} as const;