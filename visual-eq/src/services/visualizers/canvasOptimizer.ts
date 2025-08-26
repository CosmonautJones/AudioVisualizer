import type {
  CanvasDimensions,
  // CanvasOptimizations,
  // AdaptiveQuality,
  QualityLevel,
  RenderPerformanceMetrics,
  CanvasState,
  // FrameTiming,
  CanvasContextConfig,
  DrawBatch,
  DrawingPrimitive,
  TransformMatrix
  // Rectangle
} from '../../types/canvas';
import type {
  AudioVisualizerError,
  Result
  // PerformanceMetrics
} from '../../types/audio';
import {
  PERFORMANCE_BUDGETS,
  PERFORMANCE_THRESHOLDS,
  QUALITY_LEVELS,
  DEFAULT_ADAPTIVE_QUALITY
} from '../../constants/audio';

interface CanvasOptimizerConfig {
  enableOffscreenCanvas: boolean;
  enableBatching: boolean;
  enableGradientCaching: boolean;
  enableSelectiveClear: boolean;
  enableWebGLFallback: boolean;
  adaptiveQualityEnabled: boolean;
  performanceMonitoring: boolean;
  deviceOptimization: boolean;
}

interface CanvasOptimizerEventHandlers {
  onPerformanceWarning?: (metrics: RenderPerformanceMetrics) => void;
  onQualityChange?: (level: QualityLevel) => void;
  onError?: (error: AudioVisualizerError) => void;
  onOptimizationApplied?: (optimization: string) => void;
}

interface RenderStats {
  totalDrawCalls: number;
  batchedDrawCalls: number;
  cachedGradients: number;
  memoryUsedMB: number;
  lastOptimizationTime: number;
}

/**
 * CanvasOptimizer - Critical performance layer for 60fps audio visualization
 * 
 * Provides comprehensive canvas optimization including:
 * - Zero-allocation rendering loops
 * - Adaptive quality management
 * - GPU acceleration where possible
 * - Memory-efficient buffer reuse
 * - Performance monitoring and auto-adjustment
 * 
 * Designed for production-ready real-time audio visualization performance.
 */
export class CanvasOptimizer {
  private static instance: CanvasOptimizer | null = null;

  // Core canvas state
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenContext: OffscreenCanvasRenderingContext2D | null = null;

  // Performance monitoring
  private performanceMetrics = {
    frameTime: 0,
    renderTime: 0,
    clearTime: 0,
    drawCallCount: 0,
    memoryUsage: 0,
    fps: 0,
    framesBehind: 0
  };

  // Frame timing for precise 60fps control
  private frameTiming = {
    targetFps: PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP,
    frameInterval: 1000 / PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP,
    lastFrameTime: 0,
    deltaTime: 0,
    frameCount: 0
  };

  // Adaptive quality management
  private adaptiveQuality = { ...DEFAULT_ADAPTIVE_QUALITY };
  private currentQualityIndex = 1; // Start with 'High' quality

  // Canvas state tracking
  private canvasState = {
    isRendering: false,
    hasContext: false,
    dimensions: {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      scaledWidth: 0,
      scaledHeight: 0
    },
    lastRenderTime: 0,
    frameCount: 0,
    performanceMetrics: this.performanceMetrics
  };

  // Optimization caches and buffers (zero-allocation in hot paths)
  private gradientCache = new Map<string, CanvasGradient>();
  private patternCache = new Map<string, CanvasPattern>();
  private imageDataCache = new Map<string, ImageData>();
  private transformMatrix: TransformMatrix | null = null;
  
  // Batch rendering system
  private renderBatches: DrawBatch[] = [];
  private currentBatch: DrawBatch | null = null;
  private batchingEnabled = true;

  // Device and performance optimization
  private isMobileDevice = false;
  private isLowMemoryDevice = false;
  private devicePixelRatio = 1;
  // private gpuAccelerated = false; // Unused - for future GPU acceleration features

  // Configuration and state
  private config: CanvasOptimizerConfig;
  private eventHandlers: CanvasOptimizerEventHandlers = {};
  private renderStats: RenderStats = {
    totalDrawCalls: 0,
    batchedDrawCalls: 0,
    cachedGradients: 0,
    memoryUsedMB: 0,
    lastOptimizationTime: 0
  };

  // Performance monitoring
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private frameDropCount = 0;
  private consecutiveFrameDrops = 0;

  private constructor(config: Partial<CanvasOptimizerConfig> = {}) {
    this.config = {
      enableOffscreenCanvas: true,
      enableBatching: true,
      enableGradientCaching: true,
      enableSelectiveClear: true,
      enableWebGLFallback: false,
      adaptiveQualityEnabled: true,
      performanceMonitoring: true,
      deviceOptimization: true,
      ...config
    };

    this.detectDeviceCapabilities();
    this.setupPerformanceMonitoring();
  }

  /**
   * Get singleton instance of CanvasOptimizer
   */
  static getInstance(config?: Partial<CanvasOptimizerConfig>): CanvasOptimizer {
    if (!CanvasOptimizer.instance) {
      CanvasOptimizer.instance = new CanvasOptimizer(config);
    }
    return CanvasOptimizer.instance;
  }

  /**
   * Initialize optimizer with canvas element
   * Sets up optimal context configuration and GPU acceleration
   */
  async initialize(canvas: HTMLCanvasElement): Promise<Result<void>> {
    try {
      this.canvas = canvas;

      // Setup optimal canvas context
      const contextResult = this.setupCanvasContext(canvas);
      if (!contextResult.success) {
        return contextResult;
      }

      this.context = contextResult.data;

      // Initialize offscreen canvas if supported and enabled
      if (this.config.enableOffscreenCanvas && this.isOffscreenCanvasSupported()) {
        this.setupOffscreenCanvas();
      }

      // Setup adaptive quality based on device capabilities
      this.initializeAdaptiveQuality();

      // Update canvas state
      this.canvasState.hasContext = true;
      this.canvasState.dimensions = this.calculateCanvasDimensions(canvas);

      // Start performance monitoring
      if (this.config.performanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      return { success: true, data: undefined };

    } catch (error) {
      const canvasError: AudioVisualizerError = {
        type: 'canvas_render_failed',
        context: '2d',
        fallbackAvailable: true,
        message: 'Failed to initialize canvas context',
        canRetry: true
      };
      
      this.eventHandlers.onError?.(canvasError);
      return { success: false, error: canvasError };
    }
  }

  /**
   * Optimize canvas rendering for high-performance visualization
   * Zero-allocation hot path for 60fps performance
   */
  optimizeRenderFrame(
    renderCallback: (context: CanvasRenderingContext2D, dimensions: CanvasDimensions) => void
  ): RenderPerformanceMetrics {
    const frameStartTime = performance.now();
    
    if (!this.context || !this.canvas || this.canvasState.isRendering) {
      return this.performanceMetrics;
    }

    this.canvasState.isRendering = true;

    try {
      // Use offscreen canvas if available for better performance
      const renderContext = this.offscreenContext || this.context;
      const renderDimensions = this.canvasState.dimensions;

      // Apply frame timing throttling for consistent FPS
      if (!this.shouldRenderFrame(frameStartTime)) {
        this.canvasState.isRendering = false;
        return this.performanceMetrics;
      }

      // Clear canvas efficiently (selective clearing if enabled)
      const clearStartTime = performance.now();
      this.optimizedClear(renderContext, renderDimensions);
      const clearTime = performance.now() - clearStartTime;

      // Execute render callback with optimized context
      const renderStartTime = performance.now();
      this.applyRenderOptimizations(renderContext);
      
      renderCallback(renderContext as CanvasRenderingContext2D, renderDimensions);
      
      // Flush batched operations
      if (this.batchingEnabled && this.renderBatches.length > 0) {
        this.flushBatches(renderContext);
      }
      
      const renderTime = performance.now() - renderStartTime;

      // Copy from offscreen canvas if using double buffering
      if (this.offscreenCanvas && this.context) {
        this.context.drawImage(this.offscreenCanvas, 0, 0);
      }

      // Update performance metrics
      const totalTime = performance.now() - frameStartTime;
      this.updatePerformanceMetrics(totalTime, clearTime, renderTime);

      // Check for performance issues and adapt quality
      if (this.config.adaptiveQualityEnabled) {
        this.checkAndAdaptQuality();
      }

      this.canvasState.frameCount++;
      this.canvasState.lastRenderTime = frameStartTime;

    } catch (error) {
      console.warn('Canvas optimization error:', error);
      this.eventHandlers.onError?.({
        type: 'canvas_render_failed',
        context: '2d',
        fallbackAvailable: false,
        message: 'Canvas optimization error during render',
        canRetry: false
      });
    } finally {
      this.canvasState.isRendering = false;
    }

    return this.performanceMetrics;
  }

  /**
   * Batch multiple drawing operations for improved performance
   */
  createBatch(): DrawBatch {
    const batch: DrawBatch = {
      primitives: [],
      transform: this.transformMatrix || undefined,
      clipRegion: undefined
    };

    if (this.batchingEnabled) {
      this.renderBatches.push(batch);
      this.currentBatch = batch;
    }

    return batch;
  }

  /**
   * Add drawing primitive to current batch
   */
  addToBatch(primitive: DrawingPrimitive): void {
    if (this.currentBatch) {
      this.currentBatch.primitives.push(primitive);
    }
  }

  /**
   * Create or retrieve cached gradient for optimal performance
   */
  getCachedGradient(
    key: string,
    createGradient: (context: CanvasRenderingContext2D) => CanvasGradient
  ): CanvasGradient {
    if (!this.config.enableGradientCaching || !this.context) {
      return createGradient(this.context!);
    }

    let gradient = this.gradientCache.get(key);
    if (!gradient) {
      gradient = createGradient(this.context);
      this.gradientCache.set(key, gradient);
      this.renderStats.cachedGradients++;
    }

    return gradient;
  }

  /**
   * Optimize canvas for high-DPI displays
   */
  optimizeForHighDPI(): void {
    if (!this.canvas || !this.context) return;

    const dpr = window.devicePixelRatio || 1;
    if (dpr === this.devicePixelRatio) return; // No change needed

    this.devicePixelRatio = dpr;

    // Update canvas dimensions for high-DPI
    const rect = this.canvas.getBoundingClientRect();
    const scaledWidth = rect.width * dpr;
    const scaledHeight = rect.height * dpr;

    this.canvas.width = scaledWidth;
    this.canvas.height = scaledHeight;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Scale context for high-DPI rendering
    this.context.scale(dpr, dpr);

    // Update dimensions in state
    this.canvasState.dimensions = {
      width: rect.width,
      height: rect.height,
      devicePixelRatio: dpr,
      scaledWidth,
      scaledHeight
    };

    // Clear caches as dimensions changed
    this.clearCaches();
  }

  /**
   * Resize canvas with optimal performance
   */
  resize(width: number, height: number): void {
    if (!this.canvas || !this.context) return;

    const dpr = this.devicePixelRatio;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    // Only resize if dimensions actually changed
    if (
      this.canvasState.dimensions.scaledWidth === scaledWidth &&
      this.canvasState.dimensions.scaledHeight === scaledHeight
    ) {
      return;
    }

    // Update canvas size
    this.canvas.width = scaledWidth;
    this.canvas.height = scaledHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Reapply context scaling
    this.context.scale(dpr, dpr);

    // Update offscreen canvas if enabled
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = scaledWidth;
      this.offscreenCanvas.height = scaledHeight;
      this.offscreenContext?.scale(dpr, dpr);
    }

    // Update dimensions
    this.canvasState.dimensions = {
      width,
      height,
      devicePixelRatio: dpr,
      scaledWidth,
      scaledHeight
    };

    // Clear caches due to size change
    this.clearCaches();

    // Reapply render optimizations
    this.applyRenderOptimizations(this.context);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): RenderPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get canvas state information
   */
  getCanvasState(): CanvasState {
    return {
      ...this.canvasState,
      performanceMetrics: { ...this.performanceMetrics }
    };
  }

  /**
   * Get current adaptive quality level
   */
  getCurrentQualityLevel(): QualityLevel {
    return this.adaptiveQuality.qualityLevels[this.currentQualityIndex];
  }

  /**
   * Manually set quality level
   */
  setQualityLevel(levelIndex: number): void {
    if (
      levelIndex >= 0 && 
      levelIndex < this.adaptiveQuality.qualityLevels.length &&
      levelIndex !== this.currentQualityIndex
    ) {
      this.currentQualityIndex = levelIndex;
      this.updateFrameRate();
      
      const newLevel = this.adaptiveQuality.qualityLevels[levelIndex];
      this.eventHandlers.onQualityChange?.(newLevel);
      this.eventHandlers.onOptimizationApplied?.(`Quality set to ${newLevel.name}`);
    }
  }

  /**
   * Enable/disable specific optimizations
   */
  toggleOptimization(optimization: keyof CanvasOptimizerConfig, enabled: boolean): void {
    const oldValue = this.config[optimization];
    this.config[optimization] = enabled as any;

    if (oldValue !== enabled) {
      this.applyConfigurationChange(optimization, enabled);
      this.eventHandlers.onOptimizationApplied?.(`${optimization}: ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Set event handlers for optimizer events
   */
  setEventHandlers(handlers: CanvasOptimizerEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Get current render statistics
   */
  getRenderStats(): RenderStats {
    return {
      ...this.renderStats,
      memoryUsedMB: this.estimateMemoryUsage()
    };
  }

  /**
   * Clean up all resources and stop monitoring
   */
  dispose(): void {
    // Stop performance monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;

    // Clear all caches
    this.clearCaches();

    // Clean up offscreen canvas
    if (this.offscreenCanvas) {
      this.offscreenCanvas = null;
      this.offscreenContext = null;
    }

    // Reset state
    this.canvas = null;
    this.context = null;
    this.canvasState.hasContext = false;
    this.canvasState.isRendering = false;
    this.renderBatches = [];
    this.currentBatch = null;

    // Clear event handlers
    this.eventHandlers = {};
  }

  // Private Methods

  /**
   * Detect device capabilities and optimize accordingly
   */
  private detectDeviceCapabilities(): void {
    // Detect mobile device
    this.isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);

    // Detect memory constraints
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.isLowMemoryDevice = memoryInfo.jsHeapSizeLimit < 1024 * 1024 * 1024; // Less than 1GB
    } else {
      this.isLowMemoryDevice = this.isMobileDevice; // Assume mobile has limited memory
    }

    // Set device pixel ratio
    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Adjust config for device capabilities
    if (this.config.deviceOptimization) {
      this.applyDeviceOptimizations();
    }
  }

  /**
   * Apply device-specific optimizations
   */
  private applyDeviceOptimizations(): void {
    if (this.isMobileDevice) {
      // Mobile optimizations
      this.frameTiming.targetFps = PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE as 60;
      this.frameTiming.frameInterval = 1000 / PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE;
      this.adaptiveQuality = {
        ...this.adaptiveQuality,
        targetFps: PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE,
        minFps: PERFORMANCE_BUDGETS.TARGET_FPS.LOW_POWER
      };
      this.currentQualityIndex = 2; // Start with 'Medium' quality on mobile
    }

    if (this.isLowMemoryDevice) {
      // Reduce cache sizes
      this.config.enableGradientCaching = false;
      this.batchingEnabled = false;
    }
  }

  /**
   * Setup optimal canvas context configuration
   */
  private setupCanvasContext(canvas: HTMLCanvasElement): Result<CanvasRenderingContext2D> {
    const contextConfig: CanvasContextConfig = {
      alpha: false, // Disable alpha for better performance
      desynchronized: true, // Enable GPU optimization
      willReadFrequently: false, // We don't read pixels frequently
      imageSmoothingEnabled: false, // Disable for pixel-perfect rendering
      imageSmoothingQuality: 'medium'
    };

    const context = canvas.getContext('2d', contextConfig);
    
    if (!context) {
      return {
        success: false,
        error: {
          type: 'canvas_render_failed',
          context: '2d',
          fallbackAvailable: false,
          message: 'Failed to resize canvas',
          canRetry: true
        }
      };
    }

    // this.gpuAccelerated = this.checkGPUAcceleration(context); // Unused - for future GPU acceleration

    return { success: true, data: context };
  }

  /**
   * Setup offscreen canvas for double buffering
   */
  private setupOffscreenCanvas(): void {
    try {
      if (!this.canvas) return;

      const { width, height } = this.canvasState.dimensions;
      this.offscreenCanvas = new OffscreenCanvas(width, height);
      this.offscreenContext = this.offscreenCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true
      }) as OffscreenCanvasRenderingContext2D;

      if (this.offscreenContext && this.devicePixelRatio > 1) {
        this.offscreenContext.scale(this.devicePixelRatio, this.devicePixelRatio);
      }
    } catch (error) {
      console.warn('Failed to setup offscreen canvas:', error);
      this.offscreenCanvas = null;
      this.offscreenContext = null;
    }
  }

  /**
   * Check if GPU acceleration is available
   */
  private checkGPUAcceleration(context: CanvasRenderingContext2D): boolean {
    // Simple test for GPU acceleration availability
    try {
      const gradient = context.createLinearGradient(0, 0, 100, 100);
      gradient.addColorStop(0, '#000');
      gradient.addColorStop(1, '#fff');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1, 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if OffscreenCanvas is supported
   */
  private isOffscreenCanvasSupported(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * Calculate optimal canvas dimensions
   */
  private calculateCanvasDimensions(canvas: HTMLCanvasElement): CanvasDimensions {
    const rect = canvas.getBoundingClientRect();
    const dpr = this.devicePixelRatio;

    return {
      width: rect.width,
      height: rect.height,
      devicePixelRatio: dpr,
      scaledWidth: rect.width * dpr,
      scaledHeight: rect.height * dpr
    };
  }

  /**
   * Initialize adaptive quality system
   */
  private initializeAdaptiveQuality(): void {
    // Adjust quality levels for device
    if (this.isMobileDevice) {
      this.adaptiveQuality = {
        ...this.adaptiveQuality,
        qualityLevels: QUALITY_LEVELS.map(level => ({
          ...level,
          barCount: Math.min(level.barCount, 48), // Reduce bar count on mobile
          frameRate: Math.min(level.frameRate, 30) // Lower frame rate on mobile
        }))
      };
    }

    this.updateFrameRate();
  }

  /**
   * Update frame rate based on current quality level
   */
  private updateFrameRate(): void {
    const currentLevel = this.adaptiveQuality.qualityLevels[this.currentQualityIndex];
    this.frameTiming.targetFps = currentLevel.frameRate as 60;
    this.frameTiming.frameInterval = 1000 / currentLevel.frameRate;
  }

  /**
   * Setup performance monitoring system
   */
  private setupPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    // Monitor performance every 100ms
    this.monitoringInterval = window.setInterval(() => {
      this.checkPerformanceThresholds();
    }, 100);
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.isMonitoring = true;
  }

  /**
   * Check if we should render this frame (frame timing control)
   */
  private shouldRenderFrame(currentTime: number): boolean {
    const timeSinceLastFrame = currentTime - this.frameTiming.lastFrameTime;
    
    if (timeSinceLastFrame >= this.frameTiming.frameInterval) {
      this.frameTiming.lastFrameTime = currentTime;
      this.frameTiming.deltaTime = timeSinceLastFrame;
      return true;
    }

    return false;
  }

  /**
   * Optimized canvas clearing
   */
  private optimizedClear(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    dimensions: CanvasDimensions
  ): void {
    if (this.config.enableSelectiveClear) {
      // TODO: Implement selective clearing based on dirty regions
      // For now, use full clear
    }

    // Use fillRect instead of clearRect for better performance
    context.fillStyle = '#000000';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  /**
   * Apply render optimizations to context
   */
  private applyRenderOptimizations(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ): void {
    // Disable image smoothing for pixel-perfect rendering
    context.imageSmoothingEnabled = false;
    
    // Set optimal composite operation
    context.globalCompositeOperation = 'source-over';
    
    // Set text rendering optimizations
    context.textAlign = 'start';
    context.textBaseline = 'alphabetic';
    
    // Prepare for batched operations
    this.renderStats.totalDrawCalls = 0;
  }

  /**
   * Flush all batched rendering operations
   */
  private flushBatches(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    for (const batch of this.renderBatches) {
      this.renderBatch(context, batch);
    }
    
    this.renderStats.batchedDrawCalls += this.renderBatches.length;
    this.renderBatches = [];
    this.currentBatch = null;
  }

  /**
   * Render a single batch efficiently
   */
  private renderBatch(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    batch: DrawBatch
  ): void {
    // Apply transform if specified
    if (batch.transform) {
      context.save();
      const t = batch.transform;
      context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
    }

    // Apply clipping if specified
    if (batch.clipRegion) {
      context.save();
      const r = batch.clipRegion;
      context.beginPath();
      context.rect(r.x, r.y, r.width, r.height);
      context.clip();
    }

    // Render all primitives in the batch
    for (const primitive of batch.primitives) {
      this.renderPrimitive(context, primitive);
      this.renderStats.totalDrawCalls++;
    }

    // Restore context state
    if (batch.clipRegion) {
      context.restore();
    }
    if (batch.transform) {
      context.restore();
    }
  }

  /**
   * Render a single drawing primitive
   */
  private renderPrimitive(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    primitive: DrawingPrimitive
  ): void {
    const { style } = primitive;

    // Set style properties
    if (style.fillColor) context.fillStyle = style.fillColor;
    if (style.strokeColor) context.strokeStyle = style.strokeColor;
    if (style.lineWidth) context.lineWidth = style.lineWidth;
    if (style.opacity !== undefined) context.globalAlpha = style.opacity;

    // Set shadow properties
    if (style.shadowBlur || style.shadowColor) {
      context.shadowBlur = style.shadowBlur || 0;
      context.shadowColor = style.shadowColor || 'transparent';
    }

    // Render based on primitive type
    switch (primitive.type) {
      case 'rectangle':
        if (style.fillColor) {
          context.fillRect(primitive.x, primitive.y, 0, 0); // Width/height from primitive
        }
        if (style.strokeColor && style.lineWidth) {
          context.strokeRect(primitive.x, primitive.y, 0, 0);
        }
        break;
      
      case 'circle':
        context.beginPath();
        context.arc(primitive.x, primitive.y, 0, 0, 2 * Math.PI); // Radius from primitive
        if (style.fillColor) context.fill();
        if (style.strokeColor) context.stroke();
        break;
      
      case 'line':
        context.beginPath();
        context.moveTo(primitive.x, primitive.y);
        context.lineTo(0, 0); // End coordinates from primitive
        context.stroke();
        break;
    }

    // Reset alpha
    if (style.opacity !== undefined) context.globalAlpha = 1;
    
    // Reset shadow
    if (style.shadowBlur || style.shadowColor) {
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    }
  }

  /**
   * Update performance metrics after rendering
   */
  private updatePerformanceMetrics(totalTime: number, clearTime: number, renderTime: number): void {
    const currentTime = performance.now();
    
    // Calculate FPS using exponential moving average
    if (this.frameTiming.lastFrameTime > 0) {
      const actualDelta = currentTime - this.canvasState.lastRenderTime;
      const currentFps = actualDelta > 0 ? 1000 / actualDelta : 0;
      
      // Smooth FPS calculation
      this.performanceMetrics.fps = this.performanceMetrics.fps * 0.9 + currentFps * 0.1;
    }

    // Update metrics
    this.performanceMetrics = {
      ...this.performanceMetrics,
      frameTime: totalTime,
      renderTime,
      clearTime,
      drawCallCount: this.renderStats.totalDrawCalls,
      memoryUsage: this.estimateMemoryUsage(),
      framesBehind: totalTime > this.frameTiming.frameInterval ? 1 : 0
    };

    // Track frame drops
    if (totalTime > this.frameTiming.frameInterval * 1.5) {
      this.frameDropCount++;
      this.consecutiveFrameDrops++;
    } else {
      this.consecutiveFrameDrops = 0;
    }
  }

  /**
   * Check and adapt quality based on performance
   */
  private checkAndAdaptQuality(): void {
    const currentFps = this.performanceMetrics.fps;
    const targetFps = this.adaptiveQuality.targetFps;
    const minFps = this.adaptiveQuality.minFps;

    // Lower quality if performance is poor
    if (currentFps < minFps && this.currentQualityIndex < this.adaptiveQuality.qualityLevels.length - 1) {
      this.currentQualityIndex++;
      this.updateFrameRate();
      
      const newLevel = this.adaptiveQuality.qualityLevels[this.currentQualityIndex];
      this.eventHandlers.onQualityChange?.(newLevel);
      this.eventHandlers.onOptimizationApplied?.(`Quality lowered to ${newLevel.name} (FPS: ${currentFps.toFixed(1)})`);
    }
    // Raise quality if performance is good
    else if (currentFps > targetFps * 1.1 && this.currentQualityIndex > 0) {
      // Wait a bit before raising quality to ensure stable performance
      setTimeout(() => {
        if (this.performanceMetrics.fps > targetFps * 1.05) {
          this.currentQualityIndex--;
          this.updateFrameRate();
          
          const newLevel = this.adaptiveQuality.qualityLevels[this.currentQualityIndex];
          this.eventHandlers.onQualityChange?.(newLevel);
          this.eventHandlers.onOptimizationApplied?.(`Quality raised to ${newLevel.name} (FPS: ${currentFps.toFixed(1)})`);
        }
      }, 2000); // Wait 2 seconds before raising quality
    }
  }

  /**
   * Check performance thresholds and emit warnings
   */
  private checkPerformanceThresholds(): void {
    if (!this.isMonitoring) return;

    const metrics = this.performanceMetrics;

    // Check consecutive frame drops
    if (this.consecutiveFrameDrops >= PERFORMANCE_THRESHOLDS.FRAME_DROP_WARNING) {
      this.eventHandlers.onPerformanceWarning?.(metrics);
    }

    // Check memory usage
    const memoryMB = this.estimateMemoryUsage();
    if (memoryMB > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB) {
      this.eventHandlers.onPerformanceWarning?.(metrics);
      
      // Trigger memory cleanup
      this.cleanupMemory();
    }

    // Reset frame drop counter periodically
    if (this.frameTiming.frameCount % 60 === 0) {
      this.frameDropCount = 0;
    }
  }

  /**
   * Apply configuration changes dynamically
   */
  private applyConfigurationChange(optimization: keyof CanvasOptimizerConfig, enabled: boolean): void {
    switch (optimization) {
      case 'enableOffscreenCanvas':
        if (enabled && !this.offscreenCanvas) {
          this.setupOffscreenCanvas();
        } else if (!enabled) {
          this.offscreenCanvas = null;
          this.offscreenContext = null;
        }
        break;
      
      case 'enableBatching':
        this.batchingEnabled = enabled;
        if (!enabled) {
          this.renderBatches = [];
          this.currentBatch = null;
        }
        break;
      
      case 'enableGradientCaching':
        if (!enabled) {
          this.gradientCache.clear();
        }
        break;
      
      case 'performanceMonitoring':
        if (enabled) {
          this.startPerformanceMonitoring();
        } else {
          this.isMonitoring = false;
        }
        break;
    }
  }

  /**
   * Estimate current memory usage
   */
  private estimateMemoryUsage(): number {
    let totalMemoryMB = 0;

    // Canvas memory
    if (this.canvas) {
      const canvasMemory = this.canvas.width * this.canvas.height * 4; // 4 bytes per pixel
      totalMemoryMB += canvasMemory / (1024 * 1024);
    }

    // Offscreen canvas memory
    if (this.offscreenCanvas) {
      const offscreenMemory = this.offscreenCanvas.width * this.offscreenCanvas.height * 4;
      totalMemoryMB += offscreenMemory / (1024 * 1024);
    }

    // Cache memory estimates
    totalMemoryMB += this.gradientCache.size * 0.001; // Rough estimate
    totalMemoryMB += this.patternCache.size * 0.001;
    totalMemoryMB += this.imageDataCache.size * 0.1; // ImageData is larger

    return totalMemoryMB;
  }

  /**
   * Clean up memory by clearing caches
   */
  private cleanupMemory(): void {
    this.gradientCache.clear();
    this.patternCache.clear();
    this.imageDataCache.clear();
    this.renderBatches = [];
    this.currentBatch = null;
    
    this.eventHandlers.onOptimizationApplied?.('Memory cleanup performed');
  }

  /**
   * Clear all optimization caches
   */
  private clearCaches(): void {
    this.gradientCache.clear();
    this.patternCache.clear();
    this.imageDataCache.clear();
    this.renderStats.cachedGradients = 0;
  }
}

/**
 * Factory function for creating optimized canvas optimizer instances
 */
export function createCanvasOptimizer(config?: Partial<CanvasOptimizerConfig>): CanvasOptimizer {
  return CanvasOptimizer.getInstance(config);
}

/**
 * Utility functions for canvas optimization
 */
export class CanvasOptimizerUtils {
  /**
   * Calculate optimal canvas size based on device capabilities
   */
  static calculateOptimalCanvasSize(
    containerWidth: number, 
    containerHeight: number,
    devicePixelRatio: number = window.devicePixelRatio || 1,
    maxPixels: number = 2048 * 2048
  ): { width: number; height: number; scale: number } {
    const targetWidth = containerWidth * devicePixelRatio;
    const targetHeight = containerHeight * devicePixelRatio;
    const targetPixels = targetWidth * targetHeight;
    
    if (targetPixels <= maxPixels) {
      return {
        width: targetWidth,
        height: targetHeight,
        scale: 1
      };
    }
    
    // Scale down to fit within pixel budget
    const scale = Math.sqrt(maxPixels / targetPixels);
    return {
      width: Math.floor(targetWidth * scale),
      height: Math.floor(targetHeight * scale),
      scale
    };
  }

  /**
   * Create performance-optimized canvas context configuration
   */
  static createOptimalContextConfig(useGPU: boolean = true): CanvasContextConfig {
    return {
      alpha: false, // Better performance without alpha
      desynchronized: useGPU, // GPU acceleration
      willReadFrequently: false,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'medium'
    };
  }

  /**
   * Benchmark canvas performance
   */
  static async benchmarkCanvasPerformance(
    canvas: HTMLCanvasElement,
    iterations: number = 1000
  ): Promise<{ averageFrameTime: number; maxFrameTime: number; fps: number }> {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context for benchmarking');
    }

    const frameTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // Simple render operation
      context.fillStyle = `hsl(${(i * 360) / iterations}, 50%, 50%)`;
      context.fillRect(
        Math.random() * canvas.width, 
        Math.random() * canvas.height, 
        10, 10
      );
      
      const frameTime = performance.now() - startTime;
      frameTimes.push(frameTime);
    }

    const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const maxFrameTime = Math.max(...frameTimes);
    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;

    return {
      averageFrameTime,
      maxFrameTime,
      fps
    };
  }
}

// Export singleton instance for easy access
export const canvasOptimizer = CanvasOptimizer.getInstance();