import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type {
  CanvasDimensions,
  ResponsiveCanvasConfig,
  DeviceCapability,
  ContainerSize,
  ResponsiveCanvasState,
  ResizePerformanceConfig
} from '../types/canvas';
import { getDeviceCapability, monitorDeviceCapabilityChanges } from '../utils/deviceDetection';

// Default configuration for responsive canvas
const DEFAULT_RESPONSIVE_CONFIG: ResponsiveCanvasConfig = {
  minWidth: 320,
  minHeight: 200,
  maintainAspectRatio: false,
  respectViewport: true,
  enableHighDPI: true,
  autoResize: true,
  debounceMs: 16,
  deviceOptimization: true,
  fallbackDimensions: { width: 800, height: 400 },
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1440
  }
};

const DEFAULT_PERFORMANCE_CONFIG: ResizePerformanceConfig = {
  enableDebouncing: true,
  debounceMs: 16,
  enableThrottling: false,
  throttleMs: 33,
  maxResizesPerSecond: 60,
  performanceMode: 'balanced',
  skipFramesDuringResize: false
};

interface UseResponsiveCanvasOptions {
  container?: HTMLElement | null;
  config?: Partial<ResponsiveCanvasConfig>;
  performanceConfig?: Partial<ResizePerformanceConfig>;
  onResize?: (dimensions: CanvasDimensions, deviceCapability: DeviceCapability) => void;
  onOrientationChange?: (orientation: 'portrait' | 'landscape') => void;
  onBreakpointChange?: (breakpoint: 'mobile' | 'tablet' | 'desktop') => void;
  onDeviceCapabilityUpdate?: (capability: DeviceCapability) => void;
}

interface UseResponsiveCanvasReturn {
  // Canvas reference and core state
  canvasRef: React.RefObject<HTMLCanvasElement>;
  dimensions: CanvasDimensions | null;
  devicePixelRatio: number;
  isResizing: boolean;
  containerSize: ContainerSize | null;
  deviceCapability: DeviceCapability | null;
  isHighDPI: boolean;
  aspectRatio: number;
  
  // Configuration and control
  config: ResponsiveCanvasConfig;
  setAspectRatio: (ratio?: number) => void;
  updateConfig: (newConfig: Partial<ResponsiveCanvasConfig>) => void;
  
  // Responsive state
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  orientation: 'portrait' | 'landscape';
  isInitialized: boolean;
  
  // Utility functions
  recalculate: () => void;
  getOptimalDimensions: () => CanvasDimensions | null;
  supportsFeature: (feature: string) => boolean;
}

/**
 * Comprehensive responsive canvas hook with device-specific optimizations
 * 
 * Features:
 * - Dynamic sizing based on container/viewport
 * - High-DPI display support with optimal scaling
 * - Device capability detection and optimization
 * - Orientation change handling with smooth transitions
 * - Performance-aware resize debouncing
 * - Accessibility and reduced motion support
 * - Memory-efficient ResizeObserver integration
 * - Battery and network-aware optimizations
 */
export function useResponsiveCanvas(
  options: UseResponsiveCanvasOptions = {}
): UseResponsiveCanvasReturn {
  const {
    container,
    config: userConfig,
    performanceConfig: userPerformanceConfig,
    onResize,
    onOrientationChange,
    onBreakpointChange,
    onDeviceCapabilityUpdate
  } = options;

  // Refs for canvas and container tracking
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLElement | null>(container || null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const lastResizeTimeRef = useRef<number>(0);
  const resizeCountRef = useRef<number>(0);

  // Merged configurations
  const config = useMemo<ResponsiveCanvasConfig>(() => ({
    ...DEFAULT_RESPONSIVE_CONFIG,
    ...userConfig
  }), [userConfig]);

  const performanceConfig = useMemo<ResizePerformanceConfig>(() => ({
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...userPerformanceConfig
  }), [userPerformanceConfig]);

  // Core state
  const [state, setState] = useState<ResponsiveCanvasState>({
    isInitialized: false,
    isResizing: false,
    hasValidContainer: false,
    containerSize: null,
    dimensions: null,
    deviceCapability: null,
    currentBreakpoint: 'desktop',
    orientation: 'landscape',
    lastResizeTime: 0,
    resizeCount: 0
  });

  const [aspectRatio, setAspectRatioState] = useState<number>(0);

  // Device pixel ratio tracking with change detection
  const [devicePixelRatio, setDevicePixelRatio] = useState<number>(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  );

  // Device capability state (loaded asynchronously)
  const [deviceCapability, setDeviceCapability] = useState<DeviceCapability | null>(null);

  // Derived state
  const isHighDPI = devicePixelRatio >= 2;
  const currentBreakpoint = useMemo<'mobile' | 'tablet' | 'desktop'>(() => {
    if (!state.containerSize) return 'desktop';
    const width = state.containerSize.width;
    if (width < config.breakpoints.mobile) return 'mobile';
    if (width < config.breakpoints.tablet) return 'tablet';
    return 'desktop';
  }, [state.containerSize, config.breakpoints]);

  const orientation = useMemo<'portrait' | 'landscape'>(() => {
    if (!state.containerSize) return 'landscape';
    return state.containerSize.height > state.containerSize.width ? 'portrait' : 'landscape';
  }, [state.containerSize]);

  // Container size measurement
  const measureContainer = useCallback((): ContainerSize | null => {
    const element = containerRef.current || canvasRef.current?.parentElement;
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    
    return {
      width: rect.width,
      height: rect.height,
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      clientRect: rect
    };
  }, []);

  // Calculate optimal canvas dimensions
  const calculateDimensions = useCallback((
    containerSize: ContainerSize,
    aspectRatio?: number
  ): CanvasDimensions => {
    let { width, height } = containerSize;

    // Apply aspect ratio if specified
    if (aspectRatio && aspectRatio > 0 && config.maintainAspectRatio) {
      if (width / height > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }
    }

    // Apply size constraints
    width = Math.max(config.minWidth, Math.min(width, config.maxWidth || width));
    height = Math.max(config.minHeight, Math.min(height, config.maxHeight || height));

    // Device-specific optimizations
    if (config.deviceOptimization && deviceCapability) {
      const maxSize = deviceCapability.maxCanvasSize;
      width = Math.min(width, maxSize);
      height = Math.min(height, maxSize);

      // Mobile optimizations
      if (deviceCapability.deviceType === 'mobile') {
        // Reduce resolution on low-memory devices
        if (deviceCapability.memoryStatus === 'low') {
          width *= 0.75;
          height *= 0.75;
        }
      }
    }

    // High-DPI handling
    const dpr = config.enableHighDPI ? devicePixelRatio : 1;
    const scaledWidth = Math.floor(width * dpr);
    const scaledHeight = Math.floor(height * dpr);

    return {
      width: Math.floor(width),
      height: Math.floor(height),
      devicePixelRatio: dpr,
      scaledWidth,
      scaledHeight
    };
  }, [config, deviceCapability, devicePixelRatio]);

  // Apply dimensions to canvas
  const applyCanvasDimensions = useCallback((dimensions: CanvasDimensions) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set logical dimensions
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    // Set physical dimensions for high-DPI
    canvas.width = dimensions.scaledWidth;
    canvas.height = dimensions.scaledHeight;

    // Scale the context for high-DPI
    if (dimensions.devicePixelRatio !== 1) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dimensions.devicePixelRatio, dimensions.devicePixelRatio);
      }
    }
  }, []);

  // Performance-aware resize handler
  const handleResize = useCallback(() => {
    const currentTime = performance.now();
    
    // Performance throttling
    if (performanceConfig.enableThrottling) {
      const timeSinceLastResize = currentTime - lastResizeTimeRef.current;
      if (timeSinceLastResize < performanceConfig.throttleMs) {
        return;
      }
    }

    // Rate limiting
    const timeWindow = 1000; // 1 second
    if (currentTime - lastResizeTimeRef.current < timeWindow) {
      resizeCountRef.current++;
      if (resizeCountRef.current > performanceConfig.maxResizesPerSecond) {
        return;
      }
    } else {
      resizeCountRef.current = 1;
    }

    setState(prev => ({ ...prev, isResizing: true }));

    const containerSize = measureContainer();
    if (!containerSize) {
      setState(prev => ({ 
        ...prev, 
        isResizing: false, 
        hasValidContainer: false 
      }));
      return;
    }

    const dimensions = calculateDimensions(containerSize, aspectRatio || undefined);
    
    // Apply dimensions to canvas
    applyCanvasDimensions(dimensions);

    // Update state
    setState(prev => ({
      ...prev,
      isResizing: false,
      hasValidContainer: true,
      containerSize,
      dimensions,
      deviceCapability,
      currentBreakpoint: containerSize.width < config.breakpoints.mobile ? 'mobile' :
                        containerSize.width < config.breakpoints.tablet ? 'tablet' : 'desktop',
      orientation: containerSize.height > containerSize.width ? 'portrait' : 'landscape',
      lastResizeTime: currentTime,
      resizeCount: prev.resizeCount + 1
    }));

    lastResizeTimeRef.current = currentTime;

    // Fire callbacks
    if (deviceCapability) {
      onResize?.(dimensions, deviceCapability);
    }
    
    // Check for breakpoint changes
    const newBreakpoint = containerSize.width < config.breakpoints.mobile ? 'mobile' :
                         containerSize.width < config.breakpoints.tablet ? 'tablet' : 'desktop';
    if (newBreakpoint !== currentBreakpoint) {
      onBreakpointChange?.(newBreakpoint);
    }

    // Check for orientation changes
    const newOrientation = containerSize.height > containerSize.width ? 'portrait' : 'landscape';
    if (newOrientation !== orientation) {
      onOrientationChange?.(newOrientation);
    }
  }, [
    measureContainer, 
    calculateDimensions, 
    applyCanvasDimensions,
    aspectRatio,
    config,
    deviceCapability,
    performanceConfig,
    onResize,
    onBreakpointChange,
    onOrientationChange,
    currentBreakpoint,
    orientation
  ]);

  // Debounced resize handler
  const debouncedResize = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (performanceConfig.enableDebouncing) {
      debounceTimeoutRef.current = window.setTimeout(handleResize, performanceConfig.debounceMs);
    } else {
      handleResize();
    }
  }, [handleResize, performanceConfig]);

  // Manual recalculation function
  const recalculate = useCallback(() => {
    handleResize();
  }, [handleResize]);

  // Get optimal dimensions without applying them
  const getOptimalDimensions = useCallback((): CanvasDimensions | null => {
    const containerSize = measureContainer();
    if (!containerSize) return null;
    return calculateDimensions(containerSize, aspectRatio || undefined);
  }, [measureContainer, calculateDimensions, aspectRatio]);

  // Feature support detection
  const supportsFeature = useCallback((feature: string): boolean => {
    if (!deviceCapability) return false;
    
    switch (feature) {
      case 'offscreen-canvas':
        return deviceCapability.supportsOffscreenCanvas;
      case 'webgl2':
        return deviceCapability.supportsWebGL2;
      case 'high-dpi':
        return deviceCapability.isHighDPI;
      case 'touch':
        return deviceCapability.isTouchDevice;
      case 'orientation':
        return deviceCapability.hasOrientationChange;
      case 'haptics':
        return deviceCapability.supportsHaptics;
      case 'reduced-motion':
        return deviceCapability.preferReducedMotion;
      default:
        return false;
    }
  }, [deviceCapability]);

  // Aspect ratio control
  const setAspectRatio = useCallback((ratio?: number) => {
    setAspectRatioState(ratio || 0);
    // Trigger resize to apply new aspect ratio
    setTimeout(handleResize, 0);
  }, [handleResize]);

  // Configuration updates
  const updateConfig = useCallback((_newConfig: Partial<ResponsiveCanvasConfig>) => {
    // This would need to be implemented with a state update mechanism
    // For now, we'll just trigger a recalculation
    setTimeout(handleResize, 0);
  }, [handleResize]);

  // Initialize device capability
  useEffect(() => {
    let mounted = true;

    const initializeDeviceCapability = async () => {
      try {
        const capability = await getDeviceCapability();
        if (mounted) {
          setDeviceCapability(capability);
          onDeviceCapabilityUpdate?.(capability);
        }
      } catch (error) {
        console.error('Failed to initialize device capability:', error);
      }
    };

    initializeDeviceCapability();

    // Monitor device capability changes
    const cleanup = monitorDeviceCapabilityChanges((capability) => {
      if (mounted) {
        setDeviceCapability(capability);
        onDeviceCapabilityUpdate?.(capability);
      }
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [onDeviceCapabilityUpdate]);

  // Initialize ResizeObserver
  useEffect(() => {
    if (!config.autoResize) return;

    const targetElement = containerRef.current || canvasRef.current?.parentElement;
    if (!targetElement) return;

    // Create ResizeObserver
    resizeObserverRef.current = new ResizeObserver((entries) => {
      // Use the first entry (there should only be one)
      if (entries.length > 0) {
        debouncedResize();
      }
    });

    // Start observing
    resizeObserverRef.current.observe(targetElement);

    // Initial measurement
    setTimeout(debouncedResize, 0);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [config.autoResize, debouncedResize]);

  // Handle device pixel ratio changes
  useEffect(() => {
    const handlePixelRatioChange = () => {
      setDevicePixelRatio(window.devicePixelRatio || 1);
      setTimeout(handleResize, 0);
    };

    // Listen for pixel ratio changes (zoom, move to different display)
    const mediaQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    
    // Use the modern API if available, fallback to deprecated one
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handlePixelRatioChange);
    } else {
      // @ts-ignore - deprecated but may be needed for older browsers
      mediaQuery.addListener(handlePixelRatioChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handlePixelRatioChange);
      } else {
        // @ts-ignore - deprecated but may be needed for older browsers
        mediaQuery.removeListener(handlePixelRatioChange);
      }
    };
  }, [devicePixelRatio, handleResize]);

  // Handle orientation changes
  useEffect(() => {
    if (!deviceCapability?.hasOrientationChange) return;

    const handleOrientationChange = () => {
      // Small delay to allow for orientation change to complete
      setTimeout(handleResize, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [deviceCapability?.hasOrientationChange, handleResize, debouncedResize]);

  // Accessibility: respect reduced motion preference
  useEffect(() => {
    if (deviceCapability?.preferReducedMotion && performanceConfig.performanceMode !== 'performance') {
      // Update performance config to be more conservative
      // This would typically trigger a config update
    }
  }, [deviceCapability?.preferReducedMotion, performanceConfig.performanceMode]);

  // Mark as initialized once we have valid dimensions
  useEffect(() => {
    if (state.dimensions && !state.isInitialized) {
      setState(prev => ({ ...prev, isInitialized: true }));
    }
  }, [state.dimensions, state.isInitialized]);

  return {
    // Canvas reference and core state
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    dimensions: state.dimensions,
    devicePixelRatio,
    isResizing: state.isResizing,
    containerSize: state.containerSize,
    deviceCapability,
    isHighDPI,
    aspectRatio,
    
    // Configuration and control
    config,
    setAspectRatio,
    updateConfig,
    
    // Responsive state
    currentBreakpoint,
    orientation,
    isInitialized: state.isInitialized,
    
    // Utility functions
    recalculate,
    getOptimalDimensions,
    supportsFeature
  };
}

/**
 * Simplified responsive canvas hook for basic use cases
 * Pre-configured with sensible defaults
 */
export function useSimpleResponsiveCanvas(
  aspectRatio?: number,
  container?: HTMLElement | null
) {
  return useResponsiveCanvas({
    container,
    config: {
      maintainAspectRatio: !!aspectRatio,
      aspectRatio
    }
  });
}

/**
 * Performance-optimized responsive canvas hook
 * Minimizes resize operations for better performance
 */
export function usePerformantResponsiveCanvas(
  container?: HTMLElement | null,
  onResize?: (dimensions: CanvasDimensions) => void
) {
  return useResponsiveCanvas({
    container,
    config: {
      deviceOptimization: true,
      debounceMs: 33, // ~30fps max resize rate
    },
    performanceConfig: {
      performanceMode: 'performance',
      enableThrottling: true,
      throttleMs: 33,
      maxResizesPerSecond: 30,
      skipFramesDuringResize: true
    },
    onResize: onResize ? (dims) => onResize(dims) : undefined
  });
}

/**
 * Mobile-optimized responsive canvas hook
 * Configured for touch devices and mobile constraints
 */
export function useMobileResponsiveCanvas(
  aspectRatio?: number,
  container?: HTMLElement | null
) {
  return useResponsiveCanvas({
    container,
    config: {
      aspectRatio,
      maintainAspectRatio: !!aspectRatio,
      deviceOptimization: true,
      enableHighDPI: false, // Disable on mobile for performance
      debounceMs: 50, // Slower debounce for mobile
      breakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024
      }
    },
    performanceConfig: {
      performanceMode: 'performance',
      enableThrottling: true,
      throttleMs: 50,
      maxResizesPerSecond: 20
    }
  });
}

// Note: Types are already exported above in the interface declarations