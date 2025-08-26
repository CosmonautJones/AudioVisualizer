import type { 
  CanvasRenderer, 
  FrequencyVisualizationData, 
  FrequencyRenderConfig, 
  RenderPerformanceMetrics,
  CanvasDimensions 
} from '../../types/canvas';
import type { FrequencyData } from '../../types/audio';
import { COLOR_SCHEMES, PERFORMANCE_BUDGETS } from '../../constants/audio';

// interface SpectrumVisualizerState {
//   isRendering: boolean;
//   frameCount: number;
//   lastRenderTime: number;
//   performanceMetrics: RenderPerformanceMetrics;
//   smoothedAmplitudes: Float32Array | null;
//   peakAmplitudes: Float32Array | null;
//   gradientCache: Map<string, CanvasGradient>;
// }

export class SpectrumVisualizer implements CanvasRenderer<'frequency'> {
  readonly type = 'frequency' as const;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;

  private state: any;
  private config: any;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    });
    
    if (!context) {
      throw new Error('Failed to get 2D canvas context');
    }
    
    this.context = context;
    
    this.state = {
      isRendering: false,
      frameCount: 0,
      lastRenderTime: 0,
      performanceMetrics: {
        frameTime: 0,
        renderTime: 0,
        clearTime: 0,
        drawCallCount: 0,
        memoryUsage: 0,
        fps: 0,
        framesBehind: 0
      },
      smoothedAmplitudes: null,
      peakAmplitudes: null,
      gradientCache: new Map()
    };

    this.config = this.getDefaultConfig();
    this.setupCanvas();
  }

  // Render frequency spectrum with high performance
  render(data: FrequencyVisualizationData, config?: Partial<FrequencyRenderConfig>): void {
    const startTime = performance.now();

    // Update config if provided
    if (config) {
      this.updateConfig(config);
    }

    // Initialize or resize buffers if needed
    this.ensureBuffersInitialized(this.config.barCount);

    // Process frequency data with smoothing and scaling
    this.processFrequencyData(data.frequencyData);

    // Clear canvas efficiently
    const clearStartTime = performance.now();
    this.clearCanvas();
    const clearTime = performance.now() - clearStartTime;

    // Render spectrum bars
    const renderStartTime = performance.now();
    this.renderBars();
    const renderTime = performance.now() - renderStartTime;

    // Render peaks if enabled
    if (this.config.drawPeaks) {
      this.renderPeaks();
    }

    // Update performance metrics
    const totalTime = performance.now() - startTime;
    this.updatePerformanceMetrics(totalTime, clearTime, renderTime);

    this.state.frameCount++;
  }

  // Resize canvas and update internal state
  resize(dimensions: CanvasDimensions): void {
    // Update canvas dimensions
    this.canvas.width = dimensions.scaledWidth;
    this.canvas.height = dimensions.scaledHeight;
    this.canvas.style.width = `${dimensions.width}px`;
    this.canvas.style.height = `${dimensions.height}px`;

    // Apply device pixel ratio scaling
    this.context.scale(dimensions.devicePixelRatio, dimensions.devicePixelRatio);

    // Clear gradient cache as dimensions changed
    this.state.gradientCache.clear();

    // Recalculate bar dimensions
    this.updateBarDimensions();
  }

  // Clear canvas efficiently
  clear(): void {
    this.clearCanvas();
  }

  // Clean up resources
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear caches
    this.state.gradientCache.clear();
    this.state.smoothedAmplitudes = null;
    this.state.peakAmplitudes = null;

    this.state.isRendering = false;
  }

  // Get current performance metrics
  getPerformanceMetrics(): RenderPerformanceMetrics {
    return { ...this.state.performanceMetrics };
  }

  // Update configuration
  updateConfig(newConfig: Partial<FrequencyRenderConfig>): void {
    const previousBarCount = this.config.barCount;
    this.config = { ...this.config, ...newConfig };

    // Reinitialize buffers if bar count changed
    if (this.config.barCount !== previousBarCount) {
      this.ensureBuffersInitialized(this.config.barCount);
      this.updateBarDimensions();
    }

    // Clear gradient cache if color scheme changed
    if (newConfig.colorScheme) {
      this.state.gradientCache.clear();
    }
  }

  // Private methods

  private getDefaultConfig(): FrequencyRenderConfig {
    return {
      barCount: 64,
      barWidth: 8,
      barSpacing: 2,
      minBarHeight: 2,
      maxBarHeight: 200,
      sensitivity: 1.0,
      smoothing: 0.8,
      colorScheme: COLOR_SCHEMES.SPECTRUM,
      drawPeaks: true,
      mirrorVertical: false,
      logarithmicScale: true
    };
  }

  private setupCanvas(): void {
    // Set up canvas for optimal performance
    this.context.imageSmoothingEnabled = false;
    
    // Set composite operation for better performance
    this.context.globalCompositeOperation = 'source-over';
  }

  private ensureBuffersInitialized(barCount: number): void {
    if (!this.state.smoothedAmplitudes || this.state.smoothedAmplitudes.length !== barCount) {
      this.state.smoothedAmplitudes = new Float32Array(barCount);
      this.state.peakAmplitudes = new Float32Array(barCount);
    }
  }

  private processFrequencyData(frequencyData: FrequencyData): void {
    if (!this.state.smoothedAmplitudes) return;

    const barCount = this.config.barCount;
    const dataLength = frequencyData.length;

    // Process each frequency bar
    for (let i = 0; i < barCount; i++) {
      // Calculate frequency range for this bar using logarithmic scaling
      let value: number;
      
      if (this.config.logarithmicScale) {
        const logIndex = Math.floor(Math.pow(i / barCount, 2) * dataLength);
        value = frequencyData[Math.min(logIndex, dataLength - 1)] / 255;
      } else {
        const linearIndex = Math.floor((i / barCount) * dataLength);
        value = frequencyData[linearIndex] / 255;
      }

      // Apply sensitivity
      value *= this.config.sensitivity;
      value = Math.min(1, Math.max(0, value));

      // Apply smoothing
      if (this.config.smoothing > 0) {
        const currentSmoothed = this.state.smoothedAmplitudes[i];
        this.state.smoothedAmplitudes[i] = currentSmoothed * this.config.smoothing + 
                                         value * (1 - this.config.smoothing);
      } else {
        this.state.smoothedAmplitudes[i] = value;
      }

      // Update peaks
      if (this.state.peakAmplitudes && this.config.drawPeaks) {
        const currentPeak = this.state.peakAmplitudes[i];
        if (this.state.smoothedAmplitudes[i] > currentPeak) {
          this.state.peakAmplitudes[i] = this.state.smoothedAmplitudes[i];
        } else {
          // Peak decay
          this.state.peakAmplitudes[i] = currentPeak * 0.98;
        }
      }
    }
  }

  private clearCanvas(): void {
    // Use fillRect for better performance than clearRect
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderBars(): void {
    if (!this.state.smoothedAmplitudes) return;

    const barCount = this.config.barCount;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    const canvasWidth = this.canvas.width / window.devicePixelRatio;

    // Calculate bar dimensions
    const totalBarsWidth = barCount * this.config.barWidth + (barCount - 1) * this.config.barSpacing;
    const xOffset = (canvasWidth - totalBarsWidth) / 2;

    // Get or create gradient
    const gradient = this.getGradient();
    
    // Render all bars in a single path for better performance
    this.context.fillStyle = gradient;
    
    for (let i = 0; i < barCount; i++) {
      const amplitude = this.state.smoothedAmplitudes[i];
      const x = xOffset + i * (this.config.barWidth + this.config.barSpacing);
      
      // Calculate bar height
      let barHeight = amplitude * (this.config.maxBarHeight - this.config.minBarHeight) + this.config.minBarHeight;
      barHeight = Math.min(barHeight, canvasHeight);

      // Calculate y position (bars grow from bottom)
      const y = this.config.mirrorVertical 
        ? canvasHeight / 2 - barHeight / 2
        : canvasHeight - barHeight;

      // Draw bar
      this.context.fillRect(x, y, this.config.barWidth, barHeight);

      // Draw mirrored bar if enabled
      if (this.config.mirrorVertical) {
        const mirrorY = canvasHeight / 2;
        this.context.fillRect(x, mirrorY, this.config.barWidth, barHeight);
      }
    }
  }

  private renderPeaks(): void {
    if (!this.state.peakAmplitudes || !this.config.drawPeaks) return;

    const barCount = this.config.barCount;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    const canvasWidth = this.canvas.width / window.devicePixelRatio;

    // Calculate bar dimensions
    const totalBarsWidth = barCount * this.config.barWidth + (barCount - 1) * this.config.barSpacing;
    const xOffset = (canvasWidth - totalBarsWidth) / 2;

    // Set peak style
    this.context.fillStyle = this.config.colorScheme.colors[0] || '#ffffff';
    
    for (let i = 0; i < barCount; i++) {
      const peakAmplitude = this.state.peakAmplitudes[i];
      const x = xOffset + i * (this.config.barWidth + this.config.barSpacing);
      
      // Calculate peak position
      let peakHeight = peakAmplitude * (this.config.maxBarHeight - this.config.minBarHeight) + this.config.minBarHeight;
      peakHeight = Math.min(peakHeight, canvasHeight);

      const y = this.config.mirrorVertical 
        ? canvasHeight / 2 - peakHeight / 2
        : canvasHeight - peakHeight;

      // Draw peak line (2px height)
      this.context.fillRect(x, y - 2, this.config.barWidth, 2);

      // Draw mirrored peak if enabled
      if (this.config.mirrorVertical) {
        const mirrorY = canvasHeight / 2 + peakHeight / 2;
        this.context.fillRect(x, mirrorY, this.config.barWidth, 2);
      }
    }
  }

  private getGradient(): CanvasGradient {
    const cacheKey = `${this.config.colorScheme.type}_${this.canvas.height}`;
    
    // Check cache first
    if (this.state.gradientCache.has(cacheKey)) {
      return this.state.gradientCache.get(cacheKey)!;
    }

    // Create new gradient
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    let gradient: CanvasGradient;

    if (this.config.colorScheme.type === 'gradient') {
      gradient = this.context.createLinearGradient(0, canvasHeight, 0, 0);
      
      const colors = this.config.colorScheme.colors;
      for (let i = 0; i < colors.length; i++) {
        const position = i / (colors.length - 1);
        gradient.addColorStop(position, colors[i]);
      }
    } else if (this.config.colorScheme.type === 'rainbow') {
      gradient = this.context.createLinearGradient(0, canvasHeight, 0, 0);
      
      const colors = this.config.colorScheme.colors;
      for (let i = 0; i < colors.length; i++) {
        const position = i / (colors.length - 1);
        gradient.addColorStop(position, colors[i]);
      }
    } else {
      // Solid color fallback
      gradient = this.context.createLinearGradient(0, 0, 0, 0);
      gradient.addColorStop(0, this.config.colorScheme.colors[0] || '#ffffff');
      gradient.addColorStop(1, this.config.colorScheme.colors[0] || '#ffffff');
    }

    // Cache the gradient
    this.state.gradientCache.set(cacheKey, gradient);
    return gradient;
  }

  private updateBarDimensions(): void {
    const canvasWidth = this.canvas.width / window.devicePixelRatio;
    const availableWidth = canvasWidth * 0.9; // Leave 10% padding
    
    // Calculate optimal bar width and spacing
    const totalSpacing = (this.config.barCount - 1) * this.config.barSpacing;
    const availableBarWidth = availableWidth - totalSpacing;
    
    if (availableBarWidth > 0) {
      const optimalBarWidth = Math.max(2, Math.floor(availableBarWidth / this.config.barCount));
      this.config.barWidth = optimalBarWidth;
    }
  }

  private updatePerformanceMetrics(totalTime: number, clearTime: number, renderTime: number): void {
    const currentTime = performance.now();
    
    // Calculate FPS
    if (this.state.lastRenderTime > 0) {
      const deltaTime = currentTime - this.state.lastRenderTime;
      const fps = 1000 / deltaTime;
      
      // Exponential moving average for smoother FPS
      this.state.performanceMetrics.fps = this.state.performanceMetrics.fps * 0.9 + fps * 0.1;
    }

    // Update metrics
    this.state.performanceMetrics = {
      ...this.state.performanceMetrics,
      frameTime: totalTime,
      renderTime: renderTime,
      clearTime: clearTime,
      drawCallCount: this.config.barCount * (this.config.mirrorVertical ? 2 : 1),
      memoryUsage: this.estimateMemoryUsage(),
      framesBehind: totalTime > PERFORMANCE_BUDGETS.FRAME_TIME_MS.TARGET ? 1 : 0
    };

    this.state.lastRenderTime = currentTime;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in MB
    const bufferSize = (this.state.smoothedAmplitudes?.byteLength || 0) + 
                      (this.state.peakAmplitudes?.byteLength || 0);
    const gradientCacheSize = this.state.gradientCache.size * 1024; // Rough estimate
    
    return (bufferSize + gradientCacheSize) / (1024 * 1024);
  }
}

// Factory function for creating spectrum visualizers
export function createSpectrumVisualizer(canvas: HTMLCanvasElement): SpectrumVisualizer {
  return new SpectrumVisualizer(canvas);
}

// Utility functions for spectrum visualization
export class SpectrumVisualizerUtils {
  static calculateOptimalBarCount(canvasWidth: number, minBarWidth: number = 4): number {
    const availableWidth = canvasWidth * 0.9; // 10% padding
    const barSpacing = 2;
    const maxBars = Math.floor(availableWidth / (minBarWidth + barSpacing));
    
    // Constrain to reasonable range
    return Math.max(16, Math.min(96, maxBars));
  }

  static createResponsiveConfig(
    canvasWidth: number, 
    canvasHeight: number, 
    barCount: number
  ): Partial<FrequencyRenderConfig> {
    const isMobile = canvasWidth < 768;
    const barWidth = Math.max(2, Math.floor((canvasWidth * 0.9) / barCount));
    const maxBarHeight = canvasHeight * 0.8;

    return {
      barCount,
      barWidth,
      barSpacing: isMobile ? 1 : 2,
      maxBarHeight,
      minBarHeight: 2,
      sensitivity: isMobile ? 1.2 : 1.0, // Boost sensitivity on mobile
      smoothing: isMobile ? 0.85 : 0.8, // More smoothing on mobile
      drawPeaks: !isMobile // Disable peaks on mobile for performance
    };
  }

  static interpolateColorScheme(colors: string[], steps: number): string[] {
    if (colors.length < 2) return colors;
    
    const result: string[] = [];
    const segmentCount = colors.length - 1;
    
    for (let i = 0; i < steps; i++) {
      const position = i / (steps - 1);
      const segmentIndex = Math.floor(position * segmentCount);
      const segmentPosition = (position * segmentCount) - segmentIndex;
      
      const color1 = colors[segmentIndex];
      const color2 = colors[Math.min(segmentIndex + 1, colors.length - 1)];
      
      const interpolated = this.interpolateColor(color1, color2, segmentPosition);
      result.push(interpolated);
    }
    
    return result;
  }

  private static interpolateColor(color1: string, color2: string, factor: number): string {
    // Simple linear interpolation between two hex colors
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}