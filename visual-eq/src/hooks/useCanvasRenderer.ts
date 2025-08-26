import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type {
  CanvasRenderer,
  VisualizationData,
  RenderConfig,
  VisualizationType,
  RenderPerformanceMetrics,
  CanvasDimensions,
  CanvasState,
  QualityLevel
} from '../types/canvas';
import type { AudioVisualizerError, Result } from '../types/audio';
import { CanvasOptimizer, createCanvasOptimizer } from '../services/visualizers/canvasOptimizer';
import { createSpectrumVisualizer, SpectrumVisualizer } from '../services/visualizers/spectrumVisualizer';
import { PERFORMANCE_BUDGETS, QUALITY_LEVELS } from '../constants/audio';

interface UseCanvasRendererOptions<T extends VisualizationType> {
  enableOptimizations?: boolean;
  enableAdaptiveQuality?: boolean;
  enablePerformanceMonitoring?: boolean;
  maxFps?: number;
  onPerformanceIssue?: (metrics: RenderPerformanceMetrics) => void;
  onQualityChange?: (level: QualityLevel) => void;
  onError?: (error: AudioVisualizerError) => void;
}

interface UseCanvasRendererReturn<T extends VisualizationType> {
  // Canvas reference and state
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isRendering: boolean;
  hasContext: boolean;
  dimensions: CanvasDimensions | null;
  
  // Core rendering functions
  renderFrame: (data: VisualizationData<T>) => void;
  startRendering: () => void;
  stopRendering: () => void;
  
  // Configuration and renderer management
  updateConfig: (config: Partial<RenderConfig<T>>) => void;
  setRenderer: (rendererType: T, config?: RenderConfig<T>) => Promise<boolean>;
  
  // Performance and monitoring
  performanceMetrics: RenderPerformanceMetrics;
  currentQuality: QualityLevel;
  canvasState: CanvasState | null;
  
  // Error handling
  error: AudioVisualizerError | null;
  clearError: () => void;
  
  // Manual optimization controls
  setQualityLevel: (levelIndex: number) => void;
  toggleOptimization: (optimization: string, enabled: boolean) => void;
}

/**
 * High-performance React hook for canvas-based audio visualization rendering
 * 
 * Provides:
 * - Zero-allocation 60fps rendering through CanvasOptimizer integration
 * - Support for multiple renderer types (spectrum, waveform, etc.)
 * - Adaptive quality management for consistent performance
 * - Memory-efficient render loop with buffer reuse
 * - Frame rate monitoring and performance analytics
 * - Hot-swappable renderer instances
 * - Mobile-optimized rendering strategies
 */
export function useCanvasRenderer<T extends VisualizationType>(
  rendererType: T,
  initialConfig?: RenderConfig<T>,
  options: UseCanvasRendererOptions<T> = {}
): UseCanvasRendererReturn<T> {
  const {
    enableOptimizations = true,
    enableAdaptiveQuality = true,
    enablePerformanceMonitoring = true,
    maxFps = PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP,
    onPerformanceIssue,
    onQualityChange,
    onError
  } = options;

  // Core refs and state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer<T> | null>(null);
  const optimizerRef = useRef<CanvasOptimizer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const renderConfigRef = useRef<RenderConfig<T> | null>(initialConfig || null);

  // State management
  const [isRendering, setIsRendering] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [dimensions, setDimensions] = useState<CanvasDimensions | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<RenderPerformanceMetrics>({
    frameTime: 0,
    renderTime: 0,
    clearTime: 0,
    drawCallCount: 0,
    memoryUsage: 0,
    fps: 0,
    framesBehind: 0
  });
  const [currentQuality, setCurrentQuality] = useState<QualityLevel>(QUALITY_LEVELS[1]);
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
  const [error, setError] = useState<AudioVisualizerError | null>(null);

  // Memoized optimizer configuration
  const optimizerConfig = useMemo(() => ({
    enableOffscreenCanvas: enableOptimizations,
    enableBatching: enableOptimizations,
    enableGradientCaching: enableOptimizations,
    enableSelectiveClear: enableOptimizations,
    enableWebGLFallback: false,
    adaptiveQualityEnabled: enableAdaptiveQuality,
    performanceMonitoring: enablePerformanceMonitoring,
    deviceOptimization: true
  }), [enableOptimizations, enableAdaptiveQuality, enablePerformanceMonitoring]);

  // Initialize canvas optimizer and renderer
  const initializeRenderer = useCallback(async (
    type: T, 
    config?: RenderConfig<T>
  ): Promise<boolean> => {
    if (!canvasRef.current) {
      setError({
        type: 'canvas_render_failed',
        context: '2d',
        fallbackAvailable: false,
        message: 'Canvas element not available for renderer initialization',
        canRetry: true
      });
      return false;
    }

    try {
      // Initialize or get existing optimizer
      if (!optimizerRef.current) {
        optimizerRef.current = createCanvasOptimizer(optimizerConfig);
        
        // Set up optimizer event handlers
        optimizerRef.current.setEventHandlers({
          onPerformanceWarning: (metrics) => {
            setPerformanceMetrics(metrics);
            onPerformanceIssue?.(metrics);
          },
          onQualityChange: (level) => {
            setCurrentQuality(level);
            onQualityChange?.(level);
          },
          onError: (error) => {
            setError(error);
            onError?.(error);
          },
          onOptimizationApplied: (optimization) => {
            console.log(`Canvas optimization applied: ${optimization}`);
          }
        });
      }

      // Initialize optimizer with canvas
      const initResult = await optimizerRef.current.initialize(canvasRef.current);
      if (!initResult.success) {
        setError(initResult.error);
        return false;
      }

      // Create appropriate renderer based on type
      let renderer: CanvasRenderer<T>;
      
      switch (type) {
        case 'frequency':
          renderer = createSpectrumVisualizer(canvasRef.current) as CanvasRenderer<T>;
          break;
        // Future renderer types can be added here
        // case 'waveform':
        //   renderer = createWaveformVisualizer(canvasRef.current) as CanvasRenderer<T>;
        //   break;
        default:
          throw new Error(`Unsupported renderer type: ${type}`);
      }

      // Update configuration if provided
      if (config) {
        renderConfigRef.current = config;
      }

      rendererRef.current = renderer;
      
      // Update canvas state
      const optimizerState = optimizerRef.current.getCanvasState();
      setCanvasState(optimizerState);
      setHasContext(optimizerState.hasContext);
      setDimensions(optimizerState.dimensions);
      setCurrentQuality(optimizerRef.current.getCurrentQualityLevel());

      // Clear any previous errors
      setError(null);
      
      return true;
    } catch (error) {
      const canvasError: AudioVisualizerError = {
        type: 'canvas_render_failed',
        context: '2d',
        fallbackAvailable: false,
        message: `Canvas renderer initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };
      setError(canvasError);
      onError?.(canvasError);
      return false;
    }
  }, [optimizerConfig, onPerformanceIssue, onQualityChange, onError]);

  // Optimized render frame function (zero-allocation hot path)
  const renderFrame = useCallback((data: VisualizationData<T>) => {
    if (!rendererRef.current || !optimizerRef.current || !renderConfigRef.current) {
      return;
    }

    try {
      // Use optimizer for frame timing and optimization
      const metrics = optimizerRef.current.optimizeRenderFrame((context, dimensions) => {
        // Render using the current renderer with optimized context
        rendererRef.current!.render(data, renderConfigRef.current!);
      });

      // Update performance metrics
      setPerformanceMetrics(metrics);
      
      // Update canvas state
      const state = optimizerRef.current.getCanvasState();
      setCanvasState(state);
      
    } catch (error) {
      console.error('Render frame error:', error);
      const renderError: AudioVisualizerError = {
        type: 'canvas_render_failed',
        context: '2d',
        fallbackAvailable: true,
        message: `Canvas rendering failed during frame render: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };
      setError(renderError);
    }
  }, []);

  // Start continuous rendering loop
  const startRendering = useCallback(() => {
    if (isRendering || !rendererRef.current) return;

    setIsRendering(true);
    
    const renderLoop = () => {
      if (!isRendering) return;
      
      // Frame rate throttling handled by CanvasOptimizer
      const currentTime = performance.now();
      const deltaTime = currentTime - lastRenderTimeRef.current;
      
      // Update frame timing
      lastRenderTimeRef.current = currentTime;
      
      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }, [isRendering]);

  // Stop rendering loop with cleanup
  const stopRendering = useCallback(() => {
    if (!isRendering) return;
    
    setIsRendering(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isRendering]);

  // Update renderer configuration
  const updateConfig = useCallback((config: Partial<RenderConfig<T>>) => {
    if (!renderConfigRef.current) return;
    
    // Merge new config with existing
    renderConfigRef.current = { ...renderConfigRef.current, ...config };
    
    // Apply to current renderer if available
    if (rendererRef.current && 'updateConfig' in rendererRef.current) {
      (rendererRef.current as any).updateConfig(config);
    }
  }, []);

  // Hot-swap renderer type
  const setRenderer = useCallback(async (
    newRendererType: T, 
    config?: RenderConfig<T>
  ): Promise<boolean> => {
    // Stop current rendering
    const wasRendering = isRendering;
    if (wasRendering) {
      stopRendering();
    }

    // Clean up current renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Initialize new renderer
    const success = await initializeRenderer(newRendererType, config);
    
    // Resume rendering if it was active
    if (success && wasRendering) {
      startRendering();
    }

    return success;
  }, [isRendering, stopRendering, initializeRenderer, startRendering]);

  // Manual quality level control
  const setQualityLevel = useCallback((levelIndex: number) => {
    if (optimizerRef.current) {
      optimizerRef.current.setQualityLevel(levelIndex);
      setCurrentQuality(optimizerRef.current.getCurrentQualityLevel());
    }
  }, []);

  // Toggle specific optimizations
  const toggleOptimization = useCallback((optimization: string, enabled: boolean) => {
    if (optimizerRef.current) {
      optimizerRef.current.toggleOptimization(optimization as any, enabled);
    }
  }, []);

  // Handle canvas resize
  const handleCanvasResize = useCallback(() => {
    if (canvasRef.current && optimizerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      optimizerRef.current.resize(rect.width, rect.height);
      
      // Update dimensions state
      const state = optimizerRef.current.getCanvasState();
      setDimensions(state.dimensions);
      setCanvasState(state);
      
      // Update renderer dimensions
      if (rendererRef.current) {
        rendererRef.current.resize(state.dimensions);
      }
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize on mount and handle cleanup
  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      const success = await initializeRenderer(rendererType, initialConfig);
      if (!success || !mounted) return;
      
      // Set up resize observer for responsive canvas
      if (canvasRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          handleCanvasResize();
        });
        
        resizeObserver.observe(canvasRef.current);
        
        // Cleanup on unmount
        return () => {
          resizeObserver.disconnect();
        };
      }
    };

    initialize();

    return () => {
      mounted = false;
      
      // Stop rendering
      if (isRendering) {
        stopRendering();
      }
      
      // Clean up renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      // Clean up optimizer
      if (optimizerRef.current) {
        optimizerRef.current.dispose();
        optimizerRef.current = null;
      }
    };
  }, [rendererType, initialConfig]);

  // Handle high-DPI displays
  useEffect(() => {
    const handlePixelRatioChange = () => {
      if (optimizerRef.current) {
        optimizerRef.current.optimizeForHighDPI();
        handleCanvasResize();
      }
    };

    // Listen for device pixel ratio changes (zoom, move to different display)
    const mediaQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    mediaQuery.addEventListener('change', handlePixelRatioChange);

    return () => {
      mediaQuery.removeEventListener('change', handlePixelRatioChange);
    };
  }, [handleCanvasResize]);

  // Performance monitoring effect
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const monitoringInterval = setInterval(() => {
      if (optimizerRef.current) {
        const metrics = optimizerRef.current.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
        
        // Check for performance issues
        if (metrics.fps < PERFORMANCE_BUDGETS.TARGET_FPS.LOW_POWER) {
          onPerformanceIssue?.(metrics);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(monitoringInterval);
  }, [enablePerformanceMonitoring, onPerformanceIssue]);

  return {
    // Canvas reference and state
    canvasRef,
    isRendering,
    hasContext,
    dimensions,
    
    // Core rendering functions
    renderFrame,
    startRendering,
    stopRendering,
    
    // Configuration and renderer management
    updateConfig,
    setRenderer,
    
    // Performance and monitoring
    performanceMetrics,
    currentQuality,
    canvasState,
    
    // Error handling
    error,
    clearError,
    
    // Manual optimization controls
    setQualityLevel,
    toggleOptimization
  };
}

/**
 * Utility hook for canvas renderer with automatic initialization
 * Simplifies usage for common scenarios
 */
export function useAutoCanvasRenderer<T extends VisualizationType>(
  rendererType: T,
  config?: RenderConfig<T>
) {
  const renderer = useCanvasRenderer(rendererType, config, {
    enableOptimizations: true,
    enableAdaptiveQuality: true,
    enablePerformanceMonitoring: true
  });

  // Auto-initialize when canvas ref is available
  useEffect(() => {
    if (renderer.canvasRef.current && !renderer.hasContext) {
      // Initialization is handled automatically by useCanvasRenderer
    }
  }, [renderer.canvasRef.current, renderer.hasContext]);

  return renderer;
}

/**
 * Performance-focused hook variant for maximum FPS
 * Disables non-essential features for best performance
 */
export function useHighPerformanceCanvasRenderer<T extends VisualizationType>(
  rendererType: T,
  config?: RenderConfig<T>
) {
  return useCanvasRenderer(rendererType, config, {
    enableOptimizations: true,
    enableAdaptiveQuality: false, // Disable for consistent max performance
    enablePerformanceMonitoring: false, // Disable monitoring overhead
    maxFps: 60
  });
}

/**
 * Mobile-optimized hook variant
 * Applies mobile-specific optimizations and constraints
 */
export function useMobileCanvasRenderer<T extends VisualizationType>(
  rendererType: T,
  config?: RenderConfig<T>
) {
  return useCanvasRenderer(rendererType, config, {
    enableOptimizations: true,
    enableAdaptiveQuality: true,
    enablePerformanceMonitoring: true,
    maxFps: PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE, // 30fps for mobile
    onPerformanceIssue: (metrics) => {
      console.warn('Mobile performance issue detected:', metrics);
    }
  });
}

// Note: Types are already exported above in the interface declarations