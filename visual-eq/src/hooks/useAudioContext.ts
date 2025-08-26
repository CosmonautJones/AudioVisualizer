import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  AudioContextState,
  AudioVisualizerError,
  Result,
  AudioProcessingConfig,
  PerformanceMetrics
} from '../types/audio';
import { audioEngine } from '../services/audioEngine';
import { DEFAULT_AUDIO_CONFIG, MOBILE_AUDIO_CONFIG } from '../constants/audio';

// Hook configuration interface
export interface UseAudioContextConfig {
  readonly autoInitialize?: boolean;
  readonly enablePerformanceMonitoring?: boolean;
  readonly handleVisibilityChange?: boolean;
  readonly audioConfig?: Partial<AudioProcessingConfig>;
}

// Hook return type with comprehensive state and actions
export interface UseAudioContextReturn {
  // Core state
  readonly audioContext: AudioContext | null;
  readonly contextState: AudioContextState;
  readonly error: AudioVisualizerError | null;
  readonly isReady: boolean;
  readonly requiresUserGesture: boolean;
  
  // Performance metrics
  readonly performanceMetrics: PerformanceMetrics;
  
  // Actions
  readonly handleUserGesture: () => Promise<Result<void>>;
  readonly retry: () => Promise<Result<void>>;
  readonly dispose: () => void;
  
  // Advanced state for debugging/monitoring
  readonly isInitializing: boolean;
  readonly initializationAttempts: number;
}

// Default configuration with mobile optimizations
const DEFAULT_CONFIG: Required<UseAudioContextConfig> = {
  autoInitialize: true,
  enablePerformanceMonitoring: true,
  handleVisibilityChange: true,
  audioConfig: {},
};

/**
 * Production-ready React hook for managing AudioContext lifecycle
 * 
 * Features:
 * - iOS Safari autoplay handling with user gesture detection
 * - Performance monitoring integration
 * - Mobile optimization and battery-aware patterns
 * - Proper React patterns (cleanup, stable refs, memoization)
 * - Comprehensive error handling with recovery
 * - Page visibility and memory management
 * 
 * @param config - Optional configuration object
 * @returns AudioContext state, actions, and performance metrics
 */
export function useAudioContext(
  config: UseAudioContextConfig = {}
): UseAudioContextReturn {
  // Merge with defaults and memoize configuration
  const finalConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
    audioConfig: {
      ...(navigator.userAgent.match(/iPhone|iPad|iPod|Android/i) 
        ? MOBILE_AUDIO_CONFIG 
        : DEFAULT_AUDIO_CONFIG),
      ...config.audioConfig,
    },
  }), [config]);

  // Core state management
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [contextState, setContextState] = useState<AudioContextState>('suspended');
  const [error, setError] = useState<AudioVisualizerError | null>(null);
  const [requiresUserGesture, setRequiresUserGesture] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    frameRate: 0,
    audioLatency: 0,
    renderTime: 0,
    memoryUsage: 0,
    droppedFrames: 0,
    averageFrameTime: 0,
  });

  // Refs for stable function references and cleanup
  const initializationInProgressRef = useRef(false);
  const performanceTimerRef = useRef<number>();
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  // Derived state with memoization
  const isReady = useMemo(() => 
    audioContext !== null && 
    contextState === 'running' && 
    !isInitializing &&
    error === null
  , [audioContext, contextState, isInitializing, error]);

  // Performance metrics update with proper cleanup
  useEffect(() => {
    if (!finalConfig.enablePerformanceMonitoring || !audioEngine.isReady()) {
      return;
    }

    // Update performance metrics every 500ms
    performanceTimerRef.current = setInterval(() => {
      try {
        const metrics = audioEngine.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
      } catch (err) {
        console.warn('Failed to update performance metrics:', err);
      }
    }, 500);

    return () => {
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
        performanceTimerRef.current = 0;
      }
    };
  }, [finalConfig.enablePerformanceMonitoring, isReady]);

  // Initialize AudioContext with proper error handling and deduplication
  const initializeAudioContext = useCallback(async (): Promise<Result<void>> => {
    // Prevent concurrent initialization attempts
    if (initializationInProgressRef.current) {
      return { success: false, error: {
        type: 'audio_context_failed',
        reason: 'Initialization already in progress',
        message: 'Audio context initialization is already in progress',
        canRetry: false
      }};
    }

    initializationInProgressRef.current = true;
    setIsInitializing(true);
    setError(null);
    setInitializationAttempts(prev => prev + 1);

    try {
      // Set up event handlers for AudioEngine
      audioEngine.setEventHandlers({
        onStateChange: (state: AudioContextState) => {
          setContextState(state);
        },
        onError: (audioError: AudioVisualizerError) => {
          setError(audioError);
        },
        onPerformanceIssue: (metrics: PerformanceMetrics) => {
          console.warn('Performance issue detected:', metrics);
          setPerformanceMetrics(metrics);
        },
        onUserGestureRequired: () => {
          setRequiresUserGesture(true);
        },
      });

      // Initialize with configuration
      const result = await audioEngine.initialize(finalConfig.audioConfig);

      if (result.success) {
        setAudioContext(result.data);
        setContextState(result.data.state);
        setRequiresUserGesture(false);
        setError(null);
        return { success: true, data: undefined };
      } else {
        // Handle specific error cases
        if (result.error.type === 'audio_context_failed' && 
            result.error.reason.includes('suspended')) {
          setRequiresUserGesture(true);
        }
        
        setError(result.error);
        return result;
      }
    } catch (err) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: err instanceof Error ? err.message : 'Unknown initialization error',
        message: `Audio context initialization failed: ${err instanceof Error ? err.message : 'Unknown initialization error'}`,
        canRetry: true,
      };
      setError(audioError);
      return { success: false, error: audioError };
    } finally {
      initializationInProgressRef.current = false;
      setIsInitializing(false);
    }
  }, [finalConfig.audioConfig]);

  // Handle user gesture with proper error handling and state updates
  const handleUserGesture = useCallback(async (): Promise<Result<void>> => {
    try {
      setError(null);
      
      const result = await audioEngine.handleUserGesture();
      
      if (result.success) {
        // Update state after successful gesture handling
        if (audioEngine.isReady()) {
          const context = audioEngine.getContext();
          setAudioContext(context);
          setContextState(context.state);
          setRequiresUserGesture(false);
        }
      } else {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Gesture handling failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        message: `User gesture handling failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        canRetry: true,
      };
      setError(audioError);
      return { success: false, error: audioError };
    }
  }, []);

  // Retry initialization with exponential backoff consideration
  const retry = useCallback(async (): Promise<Result<void>> => {
    // Reset error state before retry
    setError(null);
    setRequiresUserGesture(false);
    
    // Add slight delay for successive retries to prevent rapid-fire attempts
    if (initializationAttempts > 1) {
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * initializationAttempts, 5000)));
    }
    
    return initializeAudioContext();
  }, [initializeAudioContext, initializationAttempts]);

  // Dispose with comprehensive cleanup
  const dispose = useCallback(() => {
    try {
      // Clear performance timer
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
        performanceTimerRef.current = 0;
      }

      // Remove visibility listener
      if (visibilityListenerRef.current) {
        visibilityListenerRef.current();
        visibilityListenerRef.current = null;
      }

      // Reset state
      setAudioContext(null);
      setContextState('closed');
      setError(null);
      setRequiresUserGesture(false);
      setIsInitializing(false);
      setInitializationAttempts(0);
      setPerformanceMetrics({
        frameRate: 0,
        audioLatency: 0,
        renderTime: 0,
        memoryUsage: 0,
        droppedFrames: 0,
        averageFrameTime: 0,
      });

      // Reset initialization flag
      initializationInProgressRef.current = false;

      // Note: AudioEngine disposal is handled by the singleton itself
      // to prevent issues with multiple hook instances
    } catch (err) {
      console.warn('Error during useAudioContext disposal:', err);
    }
  }, []);

  // Page visibility handling for battery optimization
  useEffect(() => {
    if (!finalConfig.handleVisibilityChange) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden && audioContext?.state === 'running') {
        // Let AudioEngine handle suspension
        console.debug('Page hidden, AudioEngine will manage context suspension');
      } else if (!document.hidden && audioContext?.state === 'suspended') {
        // Try to resume when page becomes visible
        audioContext.resume().catch(err => {
          console.warn('Failed to resume AudioContext on visibility change:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store cleanup function in ref for disposal
    visibilityListenerRef.current = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    return visibilityListenerRef.current;
  }, [audioContext, finalConfig.handleVisibilityChange]);

  // Auto-initialization with proper dependency handling
  useEffect(() => {
    if (finalConfig.autoInitialize && !audioContext && !isInitializing && !initializationInProgressRef.current) {
      initializeAudioContext().catch(err => {
        console.warn('Auto-initialization failed:', err);
      });
    }
  }, [finalConfig.autoInitialize, audioContext, isInitializing, initializeAudioContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  // Monitor AudioContext state changes
  useEffect(() => {
    if (!audioContext) {
      return;
    }

    const handleStateChange = () => {
      const newState = audioContext.state;
      setContextState(newState);
      
      // Update user gesture requirement based on state
      if (newState === 'suspended') {
        const isMobileSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent) && 
                              /Safari/i.test(navigator.userAgent) && 
                              !/Chrome/i.test(navigator.userAgent);
        
        if (isMobileSafari) {
          setRequiresUserGesture(true);
        }
      }
    };

    // Listen for state changes on the AudioContext
    audioContext.addEventListener('statechange', handleStateChange);
    
    return () => {
      audioContext.removeEventListener('statechange', handleStateChange);
    };
  }, [audioContext]);

  // Return stable object with memoized values
  return useMemo(() => ({
    // Core state
    audioContext,
    contextState,
    error,
    isReady,
    requiresUserGesture,
    
    // Performance metrics
    performanceMetrics,
    
    // Actions (already memoized with useCallback)
    handleUserGesture,
    retry,
    dispose,
    
    // Advanced state
    isInitializing,
    initializationAttempts,
  }), [
    audioContext,
    contextState,
    error,
    isReady,
    requiresUserGesture,
    performanceMetrics,
    handleUserGesture,
    retry,
    dispose,
    isInitializing,
    initializationAttempts,
  ]);
}

// Export default hook configuration for testing and documentation
export { DEFAULT_CONFIG as defaultConfig };

// Note: Types are already exported above in the interface declarations