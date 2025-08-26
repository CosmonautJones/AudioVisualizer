import { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef
} from 'react';
import type { ReactNode } from 'react';
import type {
  AudioVisualizerError,
  AudioSourceType,
  VisualizationType,
  PerformanceMetrics,
  Result,
  FrequencyData,
  TimeData,
  VisualizationFrameData,
  MobileOptimizations,
  VisualizationConfig
} from '../types/audio';
import type { 
  DeviceCapability, 
  CanvasDimensions,
  QualityLevel,
  ColorScheme 
} from '../types/canvas';
import { 
  useAudioContext
} from '../hooks/useAudioContext';
import type { UseAudioContextReturn } from '../hooks/useAudioContext';
import { 
  useAudioAnalyzer
} from '../hooks/useAudioAnalyzer';
import type { UseAudioAnalyzerReturn } from '../hooks/useAudioAnalyzer';
import { 
  useCanvasRenderer
} from '../hooks/useCanvasRenderer';
// import type { UseCanvasRendererReturn } from '../hooks/useCanvasRenderer'; // Not exported
import { 
  useResponsiveCanvas
} from '../hooks/useResponsiveCanvas';
// import type { UseResponsiveCanvasReturn } from '../hooks/useResponsiveCanvas'; // Not exported
import {
  DEFAULT_VISUALIZATION_CONFIG,
  DEFAULT_MOBILE_OPTIMIZATIONS,
  QUALITY_LEVELS,
  COLOR_SCHEMES,
  PERFORMANCE_BUDGETS
} from '../constants/audio';

// =============================================================================
// STATE INTERFACES
// =============================================================================

// Audio playback and engine state
interface AudioState {
  readonly playbackStatus: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';
  readonly volume: number;
  readonly currentSource: AudioSourceType | null;
  readonly sourceMetadata: {
    readonly name?: string;
    readonly duration?: number;
    readonly sampleRate?: number;
    readonly channels?: number;
  } | null;
  readonly audioEngineStatus: 'initializing' | 'ready' | 'error' | 'disposed';
  readonly requiresUserGesture: boolean;
}

// Visualization rendering and display state
interface VisualizationState {
  readonly config: VisualizationConfig;
  readonly rendererType: VisualizationType;
  readonly colorScheme: ColorScheme;
  readonly qualityLevel: QualityLevel;
  readonly isRendering: boolean;
  readonly frameRate: number;
  readonly lastFrameData: VisualizationFrameData | null;
}

// User interface and control state
interface UIState {
  readonly isLoading: boolean;
  readonly isMobileView: boolean;
  readonly controlPanelVisible: boolean;
  readonly settingsPanelVisible: boolean;
  readonly fullscreenMode: boolean;
  readonly showPerformanceMetrics: boolean;
  readonly accessibilityMode: boolean;
}

// Device capabilities and responsive state
interface DeviceState {
  readonly capability: DeviceCapability | null;
  readonly currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  readonly orientation: 'portrait' | 'landscape';
  readonly canvasDimensions: CanvasDimensions | null;
  readonly performanceMode: 'auto' | 'performance' | 'quality';
  readonly batteryOptimized: boolean;
}

// Combined application state
interface AudioVisualizerState {
  readonly audio: AudioState;
  readonly visualization: VisualizationState;
  readonly ui: UIState;
  readonly device: DeviceState;
  readonly error: AudioVisualizerError | null;
  readonly performanceMetrics: PerformanceMetrics;
  readonly initializationComplete: boolean;
}

// =============================================================================
// ACTIONS AND REDUCER
// =============================================================================

type AudioVisualizerAction =
  // Audio actions
  | { type: 'SET_PLAYBACK_STATUS'; payload: AudioState['playbackStatus'] }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_AUDIO_SOURCE'; payload: { type: AudioSourceType; metadata?: any } }
  | { type: 'SET_AUDIO_ENGINE_STATUS'; payload: AudioState['audioEngineStatus'] }
  | { type: 'SET_USER_GESTURE_REQUIRED'; payload: boolean }
  
  // Visualization actions
  | { type: 'UPDATE_VISUALIZATION_CONFIG'; payload: Partial<VisualizationConfig> }
  | { type: 'SET_RENDERER_TYPE'; payload: VisualizationType }
  | { type: 'SET_COLOR_SCHEME'; payload: ColorScheme }
  | { type: 'SET_QUALITY_LEVEL'; payload: QualityLevel }
  | { type: 'SET_RENDERING_STATUS'; payload: boolean }
  | { type: 'UPDATE_FRAME_DATA'; payload: VisualizationFrameData }
  
  // UI actions
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MOBILE_VIEW'; payload: boolean }
  | { type: 'TOGGLE_CONTROL_PANEL' }
  | { type: 'TOGGLE_SETTINGS_PANEL' }
  | { type: 'SET_FULLSCREEN'; payload: boolean }
  | { type: 'TOGGLE_PERFORMANCE_METRICS' }
  | { type: 'SET_ACCESSIBILITY_MODE'; payload: boolean }
  
  // Device actions
  | { type: 'SET_DEVICE_CAPABILITY'; payload: DeviceCapability }
  | { type: 'SET_BREAKPOINT'; payload: DeviceState['currentBreakpoint'] }
  | { type: 'SET_ORIENTATION'; payload: DeviceState['orientation'] }
  | { type: 'SET_CANVAS_DIMENSIONS'; payload: CanvasDimensions }
  | { type: 'SET_PERFORMANCE_MODE'; payload: DeviceState['performanceMode'] }
  | { type: 'SET_BATTERY_OPTIMIZED'; payload: boolean }
  
  // Global actions
  | { type: 'SET_ERROR'; payload: AudioVisualizerError | null }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: PerformanceMetrics }
  | { type: 'SET_INITIALIZATION_COMPLETE'; payload: boolean }
  | { type: 'RESET_STATE' };

// Default state values
const createDefaultState = (): AudioVisualizerState => ({
  audio: {
    playbackStatus: 'idle',
    volume: 0.8,
    currentSource: null,
    sourceMetadata: null,
    audioEngineStatus: 'initializing',
    requiresUserGesture: false,
  },
  visualization: {
    config: DEFAULT_VISUALIZATION_CONFIG,
    rendererType: 'frequency',
    colorScheme: COLOR_SCHEMES.SPECTRUM,
    qualityLevel: QUALITY_LEVELS[1], // 'High' quality by default
    isRendering: false,
    frameRate: 0,
    lastFrameData: null,
  },
  ui: {
    isLoading: false,
    isMobileView: false,
    controlPanelVisible: true,
    settingsPanelVisible: false,
    fullscreenMode: false,
    showPerformanceMetrics: false,
    accessibilityMode: false,
  },
  device: {
    capability: null,
    currentBreakpoint: 'desktop',
    orientation: 'landscape',
    canvasDimensions: null,
    performanceMode: 'auto',
    batteryOptimized: false,
  },
  error: null,
  performanceMetrics: {
    frameRate: 0,
    audioLatency: 0,
    renderTime: 0,
    memoryUsage: 0,
    droppedFrames: 0,
    averageFrameTime: 0,
  },
  initializationComplete: false,
});

// State reducer with immutable updates
function audioVisualizerReducer(
  state: AudioVisualizerState,
  action: AudioVisualizerAction
): AudioVisualizerState {
  switch (action.type) {
    // Audio state updates
    case 'SET_PLAYBACK_STATUS':
      return {
        ...state,
        audio: { ...state.audio, playbackStatus: action.payload }
      };
    
    case 'SET_VOLUME':
      return {
        ...state,
        audio: { ...state.audio, volume: Math.max(0, Math.min(1, action.payload)) }
      };
    
    case 'SET_AUDIO_SOURCE':
      return {
        ...state,
        audio: {
          ...state.audio,
          currentSource: action.payload.type,
          sourceMetadata: action.payload.metadata || null
        }
      };
    
    case 'SET_AUDIO_ENGINE_STATUS':
      return {
        ...state,
        audio: { ...state.audio, audioEngineStatus: action.payload }
      };
    
    case 'SET_USER_GESTURE_REQUIRED':
      return {
        ...state,
        audio: { ...state.audio, requiresUserGesture: action.payload }
      };
    
    // Visualization state updates
    case 'UPDATE_VISUALIZATION_CONFIG':
      return {
        ...state,
        visualization: {
          ...state.visualization,
          config: { ...state.visualization.config, ...action.payload }
        }
      };
    
    case 'SET_RENDERER_TYPE':
      return {
        ...state,
        visualization: { ...state.visualization, rendererType: action.payload }
      };
    
    case 'SET_COLOR_SCHEME':
      return {
        ...state,
        visualization: { ...state.visualization, colorScheme: action.payload }
      };
    
    case 'SET_QUALITY_LEVEL':
      return {
        ...state,
        visualization: { ...state.visualization, qualityLevel: action.payload }
      };
    
    case 'SET_RENDERING_STATUS':
      return {
        ...state,
        visualization: { ...state.visualization, isRendering: action.payload }
      };
    
    case 'UPDATE_FRAME_DATA':
      return {
        ...state,
        visualization: {
          ...state.visualization,
          lastFrameData: action.payload,
          frameRate: 1000 / (action.payload.timestamp - (state.visualization.lastFrameData?.timestamp || 0)) || 0
        }
      };
    
    // UI state updates
    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload }
      };
    
    case 'SET_MOBILE_VIEW':
      return {
        ...state,
        ui: { ...state.ui, isMobileView: action.payload }
      };
    
    case 'TOGGLE_CONTROL_PANEL':
      return {
        ...state,
        ui: { ...state.ui, controlPanelVisible: !state.ui.controlPanelVisible }
      };
    
    case 'TOGGLE_SETTINGS_PANEL':
      return {
        ...state,
        ui: { 
          ...state.ui, 
          settingsPanelVisible: !state.ui.settingsPanelVisible,
          // Close control panel when settings opens to prevent overlap
          controlPanelVisible: state.ui.settingsPanelVisible ? state.ui.controlPanelVisible : false
        }
      };
    
    case 'SET_FULLSCREEN':
      return {
        ...state,
        ui: { ...state.ui, fullscreenMode: action.payload }
      };
    
    case 'TOGGLE_PERFORMANCE_METRICS':
      return {
        ...state,
        ui: { ...state.ui, showPerformanceMetrics: !state.ui.showPerformanceMetrics }
      };
    
    case 'SET_ACCESSIBILITY_MODE':
      return {
        ...state,
        ui: { ...state.ui, accessibilityMode: action.payload }
      };
    
    // Device state updates
    case 'SET_DEVICE_CAPABILITY':
      return {
        ...state,
        device: { 
          ...state.device, 
          capability: action.payload,
          batteryOptimized: action.payload.batteryStatus === 'discharging' && 
                           action.payload.memoryStatus === 'low'
        }
      };
    
    case 'SET_BREAKPOINT':
      return {
        ...state,
        device: { ...state.device, currentBreakpoint: action.payload },
        ui: { ...state.ui, isMobileView: action.payload === 'mobile' }
      };
    
    case 'SET_ORIENTATION':
      return {
        ...state,
        device: { ...state.device, orientation: action.payload }
      };
    
    case 'SET_CANVAS_DIMENSIONS':
      return {
        ...state,
        device: { ...state.device, canvasDimensions: action.payload }
      };
    
    case 'SET_PERFORMANCE_MODE':
      return {
        ...state,
        device: { ...state.device, performanceMode: action.payload }
      };
    
    case 'SET_BATTERY_OPTIMIZED':
      return {
        ...state,
        device: { ...state.device, batteryOptimized: action.payload }
      };
    
    // Global state updates
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        // Clear loading state on error
        ui: action.payload ? { ...state.ui, isLoading: false } : state.ui
      };
    
    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        performanceMetrics: action.payload
      };
    
    case 'SET_INITIALIZATION_COMPLETE':
      return {
        ...state,
        initializationComplete: action.payload,
        ui: { ...state.ui, isLoading: !action.payload }
      };
    
    case 'RESET_STATE':
      return createDefaultState();
    
    default:
      return state;
  }
}

// =============================================================================
// CONTEXT INTERFACES
// =============================================================================

// Context actions interface
interface AudioVisualizerActions {
  // Audio controls
  readonly setVolume: (volume: number) => void;
  readonly selectAudioSource: (type: AudioSourceType, metadata?: any) => Promise<Result<void>>;
  readonly handleUserGesture: () => Promise<Result<void>>;
  readonly togglePlayback: () => Promise<Result<void>>;
  
  // Visualization controls  
  readonly updateVisualizationConfig: (config: Partial<VisualizationConfig>) => void;
  readonly setRendererType: (type: VisualizationType) => Promise<Result<void>>;
  readonly setColorScheme: (scheme: keyof typeof COLOR_SCHEMES) => void;
  readonly setQualityLevel: (level: QualityLevel) => void;
  
  // UI controls
  readonly toggleControlPanel: () => void;
  readonly toggleSettingsPanel: () => void;
  readonly setFullscreen: (enabled: boolean) => void;
  readonly togglePerformanceMetrics: () => void;
  readonly setAccessibilityMode: (enabled: boolean) => void;
  
  // Device and performance controls
  readonly setPerformanceMode: (mode: DeviceState['performanceMode']) => void;
  readonly optimizeForDevice: () => void;
  
  // Error handling
  readonly clearError: () => void;
  readonly retryOperation: () => Promise<Result<void>>;
  
  // Settings persistence
  readonly saveSettings: () => void;
  readonly loadSettings: () => void;
  readonly resetToDefaults: () => void;
}

// Complete context value interface
interface AudioVisualizerContextValue {
  // State
  readonly state: AudioVisualizerState;
  
  // Hook returns for direct access
  readonly audioContext: UseAudioContextReturn;
  readonly audioAnalyzer: UseAudioAnalyzerReturn;
  readonly canvasRenderer: any; // UseCanvasRendererReturn not exported
  readonly responsiveCanvas: any; // UseResponsiveCanvasReturn not exported
  
  // Actions
  readonly actions: AudioVisualizerActions;
  
  // Real-time data
  readonly frequencyData: FrequencyData | null;
  readonly timeData: TimeData | null;
  readonly frameData: VisualizationFrameData | null;
  
  // Derived state selectors
  readonly isReady: boolean;
  readonly canRender: boolean;
  readonly shouldOptimizeForMobile: boolean;
  readonly currentSettings: AudioVisualizerSettings;
}

// Settings interface for persistence
interface AudioVisualizerSettings {
  readonly visualization: VisualizationConfig;
  readonly volume: number;
  readonly colorScheme: keyof typeof COLOR_SCHEMES;
  readonly performanceMode: DeviceState['performanceMode'];
  readonly accessibilityMode: boolean;
  readonly controlPanelVisible: boolean;
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const AudioVisualizerContext = createContext<AudioVisualizerContextValue | null>(null);

// Settings persistence utilities
const SETTINGS_STORAGE_KEY = 'audio-visualizer-settings';

const saveSettingsToStorage = (settings: AudioVisualizerSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

const loadSettingsFromStorage = (): Partial<AudioVisualizerSettings> | null => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
    return null;
  }
};

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface AudioVisualizerProviderProps {
  readonly children: ReactNode;
  readonly initialConfig?: Partial<VisualizationConfig>;
  readonly mobileOptimizations?: Partial<MobileOptimizations>;
  readonly onError?: (error: AudioVisualizerError) => void;
  readonly onStateChange?: (state: AudioVisualizerState) => void;
}

export function AudioVisualizerProvider({
  children,
  initialConfig,
  mobileOptimizations = DEFAULT_MOBILE_OPTIMIZATIONS,
  onError,
  onStateChange
}: AudioVisualizerProviderProps) {
  // State management
  const [state, dispatch] = useReducer(audioVisualizerReducer, createDefaultState());
  
  // Refs for stable function references
  const currentSourceNodeRef = useRef<AudioNode | null>(null);
  const settingsTimeoutRef = useRef<number>(0);
  
  // Initialize hooks
  const audioContext = useAudioContext({
    autoInitialize: true,
    enablePerformanceMonitoring: true,
    audioConfig: state.device.batteryOptimized ? { fftSize: 2048 } : undefined
  });
  
  const audioAnalyzer = useAudioAnalyzer(
    currentSourceNodeRef.current,
    {
      fftSize: state.visualization.config.type === 'frequency' ? 4096 : 2048,
      barCount: state.visualization.config.barCount,
      sensitivity: state.visualization.config.sensitivity,
      smoothing: state.visualization.config.smoothing,
    }
  );
  
  const canvasRenderer = useCanvasRenderer(
    state.visualization.rendererType,
    undefined,
    {
      enableOptimizations: true,
      enableAdaptiveQuality: state.device.performanceMode === 'auto',
      maxFps: state.device.capability?.deviceType === 'mobile' 
        ? PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE 
        : PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP
    }
  );
  
  const responsiveCanvas = useResponsiveCanvas({
    onResize: useCallback((dimensions: CanvasDimensions, capability: DeviceCapability) => {
      dispatch({ type: 'SET_CANVAS_DIMENSIONS', payload: dimensions });
      dispatch({ type: 'SET_DEVICE_CAPABILITY', payload: capability });
    }, []),
    
    onBreakpointChange: useCallback((breakpoint: 'mobile' | 'tablet' | 'desktop') => {
      dispatch({ type: 'SET_BREAKPOINT', payload: breakpoint });
    }, []),
    
    onOrientationChange: useCallback((orientation: 'portrait' | 'landscape') => {
      dispatch({ type: 'SET_ORIENTATION', payload: orientation });
    }, [])
  });

  // =============================================================================
  // ACTION IMPLEMENTATIONS
  // =============================================================================
  
  const actions: AudioVisualizerActions = useMemo(() => ({
    // Audio controls
    setVolume: (volume: number) => {
      dispatch({ type: 'SET_VOLUME', payload: volume });
    },
    
    selectAudioSource: async (type: AudioSourceType, metadata?: any): Promise<Result<void>> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_AUDIO_SOURCE', payload: { type, metadata } });
      
      try {
        // Implementation would integrate with audio source selection
        // This is a placeholder for the actual implementation
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: true, data: undefined };
      } catch (error) {
        const audioError: AudioVisualizerError = {
          type: 'audio_context_failed',
          reason: `Failed to select audio source: ${error}`,
          message: `Failed to select audio source: ${error}`,
          canRetry: true
        };
        dispatch({ type: 'SET_ERROR', payload: audioError });
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: audioError };
      }
    },
    
    handleUserGesture: async (): Promise<Result<void>> => {
      const result = await audioContext.handleUserGesture();
      if (result.success) {
        dispatch({ type: 'SET_USER_GESTURE_REQUIRED', payload: false });
      }
      return result;
    },
    
    togglePlayback: async (): Promise<Result<void>> => {
      const currentStatus = state.audio.playbackStatus;
      const newStatus = currentStatus === 'playing' ? 'paused' : 'playing';
      dispatch({ type: 'SET_PLAYBACK_STATUS', payload: newStatus });
      return { success: true, data: undefined };
    },
    
    // Visualization controls
    updateVisualizationConfig: (config: Partial<VisualizationConfig>) => {
      dispatch({ type: 'UPDATE_VISUALIZATION_CONFIG', payload: config });
      audioAnalyzer.updateConfig({
        barCount: config.barCount,
        sensitivity: config.sensitivity,
        smoothing: config.smoothing,
      });
    },
    
    setRendererType: async (type: VisualizationType): Promise<Result<void>> => {
      dispatch({ type: 'SET_RENDERER_TYPE', payload: type });
      const success = await canvasRenderer.setRenderer(type);
      return success 
        ? { success: true, data: undefined }
        : { success: false, error: { type: 'canvas_render_failed', context: '2d' as const, fallbackAvailable: true, message: 'Failed to set canvas renderer type', canRetry: true } };
    },
    
    setColorScheme: (scheme: keyof typeof COLOR_SCHEMES) => {
      dispatch({ type: 'SET_COLOR_SCHEME', payload: COLOR_SCHEMES[scheme] });
    },
    
    setQualityLevel: (level: QualityLevel) => {
      dispatch({ type: 'SET_QUALITY_LEVEL', payload: level });
      canvasRenderer.setQualityLevel(QUALITY_LEVELS.indexOf(level));
    },
    
    // UI controls
    toggleControlPanel: () => dispatch({ type: 'TOGGLE_CONTROL_PANEL' }),
    toggleSettingsPanel: () => dispatch({ type: 'TOGGLE_SETTINGS_PANEL' }),
    setFullscreen: (enabled: boolean) => dispatch({ type: 'SET_FULLSCREEN', payload: enabled }),
    togglePerformanceMetrics: () => dispatch({ type: 'TOGGLE_PERFORMANCE_METRICS' }),
    setAccessibilityMode: (enabled: boolean) => dispatch({ type: 'SET_ACCESSIBILITY_MODE', payload: enabled }),
    
    // Device controls
    setPerformanceMode: (mode: DeviceState['performanceMode']) => {
      dispatch({ type: 'SET_PERFORMANCE_MODE', payload: mode });
    },
    
    optimizeForDevice: () => {
      const { capability } = state.device;
      if (!capability) return;
      
      // Apply device-specific optimizations
      if (capability.deviceType === 'mobile' || capability.memoryStatus === 'low') {
        dispatch({ type: 'SET_BATTERY_OPTIMIZED', payload: true });
        dispatch({ type: 'UPDATE_VISUALIZATION_CONFIG', payload: { barCount: 32 } });
      }
    },
    
    // Error handling
    clearError: () => dispatch({ type: 'SET_ERROR', payload: null }),
    
    retryOperation: async (): Promise<Result<void>> => {
      dispatch({ type: 'SET_ERROR', payload: null });
      return audioContext.retry();
    },
    
    // Settings persistence
    saveSettings: () => {
      const settings: AudioVisualizerSettings = {
        visualization: state.visualization.config,
        volume: state.audio.volume,
        colorScheme: Object.keys(COLOR_SCHEMES).find(key => 
          COLOR_SCHEMES[key as keyof typeof COLOR_SCHEMES] === state.visualization.colorScheme
        ) as keyof typeof COLOR_SCHEMES || 'SPECTRUM',
        performanceMode: state.device.performanceMode,
        accessibilityMode: state.ui.accessibilityMode,
        controlPanelVisible: state.ui.controlPanelVisible
      };
      saveSettingsToStorage(settings);
    },
    
    loadSettings: () => {
      const settings = loadSettingsFromStorage();
      if (settings) {
        if (settings.visualization) {
          dispatch({ type: 'UPDATE_VISUALIZATION_CONFIG', payload: settings.visualization });
        }
        if (typeof settings.volume === 'number') {
          dispatch({ type: 'SET_VOLUME', payload: settings.volume });
        }
        if (settings.colorScheme && COLOR_SCHEMES[settings.colorScheme]) {
          dispatch({ type: 'SET_COLOR_SCHEME', payload: COLOR_SCHEMES[settings.colorScheme] });
        }
        if (settings.performanceMode) {
          dispatch({ type: 'SET_PERFORMANCE_MODE', payload: settings.performanceMode });
        }
        if (typeof settings.accessibilityMode === 'boolean') {
          dispatch({ type: 'SET_ACCESSIBILITY_MODE', payload: settings.accessibilityMode });
        }
        if (typeof settings.controlPanelVisible === 'boolean') {
          dispatch({ type: 'TOGGLE_CONTROL_PANEL' });
        }
      }
    },
    
    resetToDefaults: () => {
      dispatch({ type: 'RESET_STATE' });
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }), [state, audioContext, audioAnalyzer, canvasRenderer]);

  // =============================================================================
  // SIDE EFFECTS
  // =============================================================================
  
  // Sync audio context state
  useEffect(() => {
    dispatch({ type: 'SET_AUDIO_ENGINE_STATUS', payload: audioContext.isReady ? 'ready' : 'initializing' });
    dispatch({ type: 'SET_USER_GESTURE_REQUIRED', payload: audioContext.requiresUserGesture });
    
    if (audioContext.error) {
      dispatch({ type: 'SET_ERROR', payload: audioContext.error });
      onError?.(audioContext.error);
    }
  }, [audioContext.isReady, audioContext.requiresUserGesture, audioContext.error, onError]);
  
  // Sync performance metrics
  useEffect(() => {
    const combinedMetrics: PerformanceMetrics = {
      ...audioContext.performanceMetrics,
      ...canvasRenderer.performanceMetrics
    };
    dispatch({ type: 'UPDATE_PERFORMANCE_METRICS', payload: combinedMetrics });
  }, [audioContext.performanceMetrics, canvasRenderer.performanceMetrics]);
  
  // Update frame data from analyzer
  useEffect(() => {
    if (audioAnalyzer.frameData) {
      dispatch({ type: 'UPDATE_FRAME_DATA', payload: audioAnalyzer.frameData });
    }
  }, [audioAnalyzer.frameData]);
  
  // Auto-save settings on changes (debounced)
  useEffect(() => {
    if (settingsTimeoutRef.current) {
      window.clearTimeout(settingsTimeoutRef.current);
    }
    
    settingsTimeoutRef.current = window.setTimeout(() => {
      actions.saveSettings();
    }, 1000);
    
    return () => {
      if (settingsTimeoutRef.current) {
        window.clearTimeout(settingsTimeoutRef.current);
      }
    };
  }, [state.visualization.config, state.audio.volume, state.ui.accessibilityMode]);
  
  // Load settings on mount
  useEffect(() => {
    actions.loadSettings();
    dispatch({ type: 'SET_INITIALIZATION_COMPLETE', payload: true });
  }, []);
  
  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // =============================================================================
  // DERIVED STATE AND CONTEXT VALUE
  // =============================================================================
  
  const contextValue: AudioVisualizerContextValue = useMemo(() => ({
    state,
    audioContext,
    audioAnalyzer,
    canvasRenderer,
    responsiveCanvas,
    actions,
    
    // Real-time data
    frequencyData: audioAnalyzer.frequencyData,
    timeData: audioAnalyzer.timeData,
    frameData: audioAnalyzer.frameData,
    
    // Derived state selectors
    isReady: audioContext.isReady && canvasRenderer.hasContext && state.initializationComplete,
    canRender: audioContext.isReady && canvasRenderer.hasContext && audioAnalyzer.isAnalyzing,
    shouldOptimizeForMobile: state.device.capability?.deviceType === 'mobile' || state.device.batteryOptimized,
    
    currentSettings: {
      visualization: state.visualization.config,
      volume: state.audio.volume,
      colorScheme: Object.keys(COLOR_SCHEMES).find(key => 
        COLOR_SCHEMES[key as keyof typeof COLOR_SCHEMES] === state.visualization.colorScheme
      ) as keyof typeof COLOR_SCHEMES || 'SPECTRUM',
      performanceMode: state.device.performanceMode,
      accessibilityMode: state.ui.accessibilityMode,
      controlPanelVisible: state.ui.controlPanelVisible
    }
  }), [
    state, 
    audioContext, 
    audioAnalyzer, 
    canvasRenderer, 
    responsiveCanvas, 
    actions
  ]);
  
  return (
    <AudioVisualizerContext.Provider value={contextValue}>
      {children}
    </AudioVisualizerContext.Provider>
  );
}

// =============================================================================
// HOOK FOR CONSUMING CONTEXT
// =============================================================================

export function useAudioVisualizer(): AudioVisualizerContextValue {
  const context = useContext(AudioVisualizerContext);
  
  if (!context) {
    throw new Error('useAudioVisualizer must be used within an AudioVisualizerProvider');
  }
  
  return context;
}

// =============================================================================
// SELECTOR HOOKS FOR PERFORMANCE
// =============================================================================

// Hook for accessing only audio state (prevents unnecessary re-renders)
export function useAudioState() {
  const { state } = useAudioVisualizer();
  return state.audio;
}

// Hook for accessing only visualization state
export function useVisualizationState() {
  const { state } = useAudioVisualizer();
  return state.visualization;
}

// Hook for accessing only UI state
export function useUIState() {
  const { state } = useAudioVisualizer();
  return state.ui;
}

// Hook for accessing only device state
export function useDeviceState() {
  const { state } = useAudioVisualizer();
  return state.device;
}

// Hook for accessing real-time audio data
export function useAudioData() {
  const { frequencyData, timeData, frameData } = useAudioVisualizer();
  return { frequencyData, timeData, frameData };
}

// Hook for accessing actions only
export function useAudioVisualizerActions() {
  const { actions } = useAudioVisualizer();
  return actions;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  AudioVisualizerState,
  AudioVisualizerContextValue,
  AudioVisualizerActions,
  AudioVisualizerSettings,
  AudioState,
  VisualizationState,
  UIState,
  DeviceState
};