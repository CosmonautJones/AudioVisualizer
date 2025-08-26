import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  FrequencyData,
  TimeData,
  VisualizationFrameData,
  AudioVisualizerError,
  PerformanceMetrics,
  Result
} from '../types/audio';
import { AudioAnalyzer, createAudioAnalyzer } from '../services/audioAnalyzer';
import { useAudioContext } from './useAudioContext';
import {
  DEFAULT_VISUALIZATION_CONFIG,
  PERFORMANCE_BUDGETS,
  PERFORMANCE_THRESHOLDS
} from '../constants/audio';

// Configuration interface for the audio analyzer hook
export interface AudioAnalyzerConfig {
  readonly fftSize: 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768;
  readonly smoothingTimeConstant: number;
  readonly minDecibels: number;
  readonly maxDecibels: number;
  readonly sensitivity: number;
  readonly smoothing: number;
  readonly barCount: number;
  readonly enablePeakDetection: boolean;
  readonly enableFrameRateAdaptation: boolean;
}

// Performance metrics specific to audio analysis
export interface AudioAnalysisPerformanceMetrics extends PerformanceMetrics {
  readonly bufferSize: number;
  readonly analysisLatency: number;
  readonly configUpdateTime: number;
}

// Hook configuration interface
export interface UseAudioAnalyzerConfig {
  readonly autoStart?: boolean;
  readonly enablePerformanceMonitoring?: boolean;
  readonly adaptiveQuality?: boolean;
  readonly maxRetries?: number;
}

// Hook return interface with comprehensive state and actions
export interface UseAudioAnalyzerReturn {
  // Real-time audio data
  readonly frequencyData: FrequencyData | null;
  readonly timeData: TimeData | null;
  readonly processedData: Float32Array | null;
  readonly frameData: VisualizationFrameData | null;
  
  // Analysis state
  readonly isAnalyzing: boolean;
  readonly isInitializing: boolean;
  readonly error: AudioVisualizerError | null;
  
  // Configuration
  readonly config: AudioAnalyzerConfig;
  readonly performanceMetrics: AudioAnalysisPerformanceMetrics;
  
  // Actions
  readonly updateConfig: (config: Partial<AudioAnalyzerConfig>) => void;
  readonly startAnalysis: () => Promise<Result<void>>;
  readonly stopAnalysis: () => void;
  readonly retry: () => Promise<Result<void>>;
  readonly dispose: () => void;
}

// Default configuration with performance optimizations
const DEFAULT_ANALYZER_CONFIG: AudioAnalyzerConfig = {
  fftSize: 4096,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  sensitivity: DEFAULT_VISUALIZATION_CONFIG.sensitivity,
  smoothing: DEFAULT_VISUALIZATION_CONFIG.smoothing,
  barCount: DEFAULT_VISUALIZATION_CONFIG.barCount,
  enablePeakDetection: true,
  enableFrameRateAdaptation: true,
};

const DEFAULT_HOOK_CONFIG: Required<UseAudioAnalyzerConfig> = {
  autoStart: true,
  enablePerformanceMonitoring: true,
  adaptiveQuality: true,
  maxRetries: 3,
};

/**
 * High-performance React hook for real-time audio analysis
 * 
 * Features:
 * - 60fps real-time audio data updates using requestAnimationFrame
 * - Zero-allocation hot path with buffer reuse
 * - Adaptive quality based on performance metrics
 * - Memory-efficient resource management
 * - Integration with useAudioContext for lifecycle management
 * - Configuration hot-swapping without frame drops
 * - Comprehensive error handling and recovery
 * 
 * @param sourceNode - Audio source node to analyze
 * @param initialConfig - Initial analyzer configuration
 * @param hookConfig - Hook behavior configuration
 * @returns Audio analysis state, data, and control actions
 */
export function useAudioAnalyzer(
  sourceNode: AudioNode | null,
  initialConfig?: Partial<AudioAnalyzerConfig>,
  hookConfig?: UseAudioAnalyzerConfig
): UseAudioAnalyzerReturn {
  
  // Merge configurations with defaults
  const finalConfig = useMemo(() => ({
    ...DEFAULT_ANALYZER_CONFIG,
    ...initialConfig,
  }), [initialConfig]);
  
  const finalHookConfig = useMemo(() => ({
    ...DEFAULT_HOOK_CONFIG,
    ...hookConfig,
  }), [hookConfig]);
  
  // Get AudioContext from useAudioContext hook
  const { audioContext, isReady: audioContextReady, error: audioContextError } = useAudioContext();
  
  // Core state management
  const [config, setConfig] = useState<AudioAnalyzerConfig>(finalConfig);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<AudioVisualizerError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Real-time audio data state
  const [frequencyData, setFrequencyData] = useState<FrequencyData | null>(null);
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [processedData, setProcessedData] = useState<Float32Array | null>(null);
  const [frameData, setFrameData] = useState<VisualizationFrameData | null>(null);
  
  // Performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState<AudioAnalysisPerformanceMetrics>({
    frameRate: 0,
    audioLatency: 0,
    renderTime: 0,
    memoryUsage: 0,
    droppedFrames: 0,
    averageFrameTime: 0,
    bufferSize: 0,
    analysisLatency: 0,
    configUpdateTime: 0,
  });
  
  // Refs for stable references and cleanup
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const performanceTimerRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isDisposedRef = useRef<boolean>(false);
  
  // Performance monitoring with adaptive quality
  const monitorPerformance = useCallback(() => {
    if (!analyzerRef.current || !finalHookConfig.enablePerformanceMonitoring) {
      return;
    }
    
    const analyzerMetrics = analyzerRef.current.getPerformanceMetrics();
    const currentTime = performance.now();
    const analysisLatency = currentTime - lastFrameTimeRef.current;
    
    const newMetrics: AudioAnalysisPerformanceMetrics = {
      ...performanceMetrics,
      frameRate: analyzerMetrics.frameRate,
      averageFrameTime: analyzerMetrics.averageFrameTime,
      droppedFrames: analyzerMetrics.droppedFrames,
      bufferSize: analyzerMetrics.bufferSize,
      analysisLatency,
      configUpdateTime: 0, // Updated during config changes
    };
    
    setPerformanceMetrics(newMetrics);
    
    // Adaptive quality adjustment based on performance
    if (finalHookConfig.adaptiveQuality) {
      adaptQualityBasedOnPerformance(newMetrics);
    }
  }, [performanceMetrics, finalHookConfig.enablePerformanceMonitoring, finalHookConfig.adaptiveQuality]);
  
  // Adaptive quality management
  const adaptQualityBasedOnPerformance = useCallback((metrics: AudioAnalysisPerformanceMetrics) => {
    const targetFps = PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP;
    const currentFps = metrics.frameRate;
    
    // Reduce quality if performance is poor
    if (currentFps < targetFps * 0.75 && config.barCount > 32) {
      setConfig(prev => ({
        ...prev,
        barCount: Math.max(32, prev.barCount - 8),
        enablePeakDetection: prev.barCount > 48 ? prev.enablePeakDetection : false,
      }));
    }
    // Increase quality if performance is good
    else if (currentFps > targetFps * 0.9 && config.barCount < finalConfig.barCount) {
      setConfig(prev => ({
        ...prev,
        barCount: Math.min(finalConfig.barCount, prev.barCount + 8),
        enablePeakDetection: finalConfig.enablePeakDetection,
      }));
    }
  }, [config, finalConfig]);
  
  // Initialize analyzer with proper error handling
  const initializeAnalyzer = useCallback(async (): Promise<Result<void>> => {
    if (!audioContext || !sourceNode || isDisposedRef.current) {
      return {
        success: false,
        error: {
          type: 'audio_context_failed',
          reason: 'Audio context or source node not available',
          message: 'Audio context or source node not available for analysis',
          canRetry: true,
        },
      };
    }
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Create new analyzer instance
      const analyzer = createAudioAnalyzer(config);
      
      // Set up event handlers for real-time data updates
      analyzer.setEventHandlers({
        onDataUpdate: (newFrameData: VisualizationFrameData) => {
          if (isDisposedRef.current) return;
          
          // Update all audio data in a single state update for performance
          setFrequencyData(newFrameData.frequencyData);
          setTimeData(newFrameData.timeData);
          setFrameData(newFrameData);
          
          // Update processed data
          const processed = analyzer.getProcessedFrequencyData();
          if (processed) {
            setProcessedData(processed);
          }
          
          frameCountRef.current++;
          lastFrameTimeRef.current = performance.now();
        },
        
        onError: (analyzerError: AudioVisualizerError) => {
          setError(analyzerError);
          setIsAnalyzing(false);
        },
        
        onPerformanceWarning: (fps: number) => {
          if (finalHookConfig.adaptiveQuality) {
            console.warn(`Audio analyzer performance warning: ${fps}fps`);
          }
        },
      });
      
      // Initialize with source node
      const initResult = await analyzer.initialize(sourceNode);
      
      if (initResult.success) {
        analyzerRef.current = analyzer;
        return { success: true, data: undefined };
      } else {
        analyzer.dispose();
        return initResult;
      }
      
    } catch (err) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Analyzer initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        message: `Failed to initialize audio analyzer: ${err instanceof Error ? err.message : 'Unknown error'}`,
        canRetry: true,
      };
      
      setError(audioError);
      return { success: false, error: audioError };
    } finally {
      setIsInitializing(false);
    }
  }, [audioContext, sourceNode, config, finalHookConfig.adaptiveQuality]);
  
  // Start analysis with comprehensive state management
  const startAnalysis = useCallback(async (): Promise<Result<void>> => {
    if (isDisposedRef.current) {
      return {
        success: false,
        error: {
          type: 'audio_context_failed',
          reason: 'Hook has been disposed',
          message: 'Audio analyzer hook has been disposed and cannot be used',
          canRetry: false,
        },
      };
    }
    
    if (isAnalyzing) {
      return { success: true, data: undefined };
    }
    
    // Ensure analyzer is initialized
    if (!analyzerRef.current) {
      const initResult = await initializeAnalyzer();
      if (!initResult.success) {
        return initResult;
      }
    }
    
    try {
      analyzerRef.current!.startAnalysis();
      setIsAnalyzing(true);
      setError(null);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();
      
      // Start performance monitoring
      if (finalHookConfig.enablePerformanceMonitoring) {
        performanceTimerRef.current = setInterval(monitorPerformance, 500);
      }
      
      return { success: true, data: undefined };
    } catch (err) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Failed to start analysis: ${err instanceof Error ? err.message : 'Unknown error'}`,
        message: `Unable to start audio analysis: ${err instanceof Error ? err.message : 'Unknown error'}`,
        canRetry: true,
      };
      
      setError(audioError);
      return { success: false, error: audioError };
    }
  }, [isAnalyzing, initializeAnalyzer, finalHookConfig.enablePerformanceMonitoring, monitorPerformance]);
  
  // Stop analysis with cleanup
  const stopAnalysis = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
    }
    
    setIsAnalyzing(false);
    
    // Clear performance monitoring
    if (performanceTimerRef.current) {
      clearInterval(performanceTimerRef.current);
      performanceTimerRef.current = null;
    }
    
    // Clear animation frame if running
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  // Update configuration with hot-swapping support
  const updateConfig = useCallback((newConfig: Partial<AudioAnalyzerConfig>) => {
    const updateStartTime = performance.now();
    
    setConfig(prevConfig => {
      const updatedConfig = { ...prevConfig, ...newConfig };
      
      // Apply configuration to analyzer
      if (analyzerRef.current) {
        analyzerRef.current.updateConfig(updatedConfig);
      }
      
      return updatedConfig;
    });
    
    // Update performance metrics with config update time
    const configUpdateTime = performance.now() - updateStartTime;
    setPerformanceMetrics(prev => ({
      ...prev,
      configUpdateTime,
    }));
  }, []);
  
  // Retry with exponential backoff
  const retry = useCallback(async (): Promise<Result<void>> => {
    if (retryCount >= finalHookConfig.maxRetries) {
      const maxRetriesError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Maximum retry attempts (${finalHookConfig.maxRetries}) exceeded`,
        message: `Failed to initialize audio analyzer after ${finalHookConfig.maxRetries} retry attempts`,
        canRetry: false,
      };
      
      setError(maxRetriesError);
      return { success: false, error: maxRetriesError };
    }
    
    setRetryCount(prev => prev + 1);
    setError(null);
    
    // Exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Reinitialize analyzer
    if (analyzerRef.current) {
      analyzerRef.current.dispose();
      analyzerRef.current = null;
    }
    
    return initializeAnalyzer();
  }, [retryCount, finalHookConfig.maxRetries, initializeAnalyzer]);
  
  // Comprehensive disposal with cleanup
  const dispose = useCallback(() => {
    isDisposedRef.current = true;
    
    // Stop analysis
    stopAnalysis();
    
    // Dispose analyzer
    if (analyzerRef.current) {
      analyzerRef.current.dispose();
      analyzerRef.current = null;
    }
    
    // Clear all timers and animation frames
    if (performanceTimerRef.current) {
      clearInterval(performanceTimerRef.current);
      performanceTimerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset state
    setFrequencyData(null);
    setTimeData(null);
    setProcessedData(null);
    setFrameData(null);
    setIsAnalyzing(false);
    setIsInitializing(false);
    setError(null);
    setRetryCount(0);
    
    // Reset performance metrics
    setPerformanceMetrics({
      frameRate: 0,
      audioLatency: 0,
      renderTime: 0,
      memoryUsage: 0,
      droppedFrames: 0,
      averageFrameTime: 0,
      bufferSize: 0,
      analysisLatency: 0,
      configUpdateTime: 0,
    });
  }, [stopAnalysis]);
  
  // Handle AudioContext errors
  useEffect(() => {
    if (audioContextError && !error) {
      setError(audioContextError);
    }
  }, [audioContextError, error]);
  
  // Auto-start analysis when ready
  useEffect(() => {
    if (
      finalHookConfig.autoStart &&
      audioContextReady &&
      sourceNode &&
      !isAnalyzing &&
      !isInitializing &&
      !error &&
      !isDisposedRef.current
    ) {
      startAnalysis().catch(err => {
        console.warn('Auto-start analysis failed:', err);
      });
    }
  }, [
    finalHookConfig.autoStart,
    audioContextReady,
    sourceNode,
    isAnalyzing,
    isInitializing,
    error,
    startAnalysis,
  ]);
  
  // Handle source node changes
  useEffect(() => {
    if (sourceNode && analyzerRef.current && isAnalyzing) {
      // Reinitialize analyzer with new source node
      stopAnalysis();
      
      // Small delay to ensure clean state transition
      setTimeout(() => {
        if (!isDisposedRef.current) {
          initializeAnalyzer().then(result => {
            if (result.success && finalHookConfig.autoStart) {
              startAnalysis();
            }
          });
        }
      }, 50);
    }
  }, [sourceNode, stopAnalysis, initializeAnalyzer, startAnalysis, finalHookConfig.autoStart]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);
  
  // Return memoized object for stable references
  return useMemo(() => ({
    // Real-time audio data
    frequencyData,
    timeData,
    processedData,
    frameData,
    
    // Analysis state
    isAnalyzing,
    isInitializing,
    error,
    
    // Configuration and metrics
    config,
    performanceMetrics,
    
    // Actions
    updateConfig,
    startAnalysis,
    stopAnalysis,
    retry,
    dispose,
  }), [
    frequencyData,
    timeData,
    processedData,
    frameData,
    isAnalyzing,
    isInitializing,
    error,
    config,
    performanceMetrics,
    updateConfig,
    startAnalysis,
    stopAnalysis,
    retry,
    dispose,
  ]);
}

// Note: Types are already exported above in the interface declarations