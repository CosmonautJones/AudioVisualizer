// Local type definitions to avoid circular imports
type FrequencyData = Uint8Array & { readonly _brand: 'FrequencyData' };
type TimeData = Uint8Array & { readonly _brand: 'TimeData' };
type VisualizationType = 'frequency' | 'waveform' | 'spectrogram' | 'oscilloscope';

// Canvas context types with performance optimizations
export interface CanvasContextConfig {
  readonly alpha: boolean;
  readonly desynchronized: boolean;
  readonly colorSpace?: PredefinedColorSpace;
  readonly willReadFrequently?: boolean;
  readonly imageSmoothingEnabled: boolean;
  readonly imageSmoothingQuality: ImageSmoothingQuality;
}

// Canvas dimensions with DPI awareness
export interface CanvasDimensions {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly scaledWidth: number;
  readonly scaledHeight: number;
}

// Responsive canvas configuration
export interface ResponsiveCanvasConfig {
  readonly aspectRatio?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maintainAspectRatio: boolean;
  readonly respectViewport: boolean;
}

// Generic canvas renderer interface
export interface CanvasRenderer<T extends VisualizationType> {
  readonly type: T;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  render(data: VisualizationData<T>, config: RenderConfig<T>): void;
  resize(dimensions: CanvasDimensions): void;
  clear(): void;
  dispose(): void;
  getPerformanceMetrics(): RenderPerformanceMetrics;
}

// Visualization data types
export type VisualizationData<T> = T extends 'frequency' 
  ? FrequencyVisualizationData 
  : T extends 'waveform' 
  ? WaveformVisualizationData 
  : T extends 'spectrogram' 
  ? SpectrogramVisualizationData 
  : OscilloscopeVisualizationData;

// Specific visualization data interfaces
export interface FrequencyVisualizationData {
  readonly frequencyData: FrequencyData;
  readonly sampleRate: number;
  readonly binCount: number;
  readonly maxFrequency: number;
  readonly timestamp: number;
}

export interface WaveformVisualizationData {
  readonly timeData: TimeData;
  readonly sampleRate: number;
  readonly amplitude: number;
  readonly timestamp: number;
}

export interface SpectrogramVisualizationData {
  readonly frequencyData: FrequencyData;
  readonly timeData: TimeData;
  readonly sampleRate: number;
  readonly windowSize: number;
  readonly timestamp: number;
}

export interface OscilloscopeVisualizationData {
  readonly timeData: TimeData;
  readonly sampleRate: number;
  readonly channelCount: number;
  readonly timestamp: number;
}

// Render configuration types
export type RenderConfig<T> = T extends 'frequency' 
  ? FrequencyRenderConfig 
  : T extends 'waveform' 
  ? WaveformRenderConfig 
  : T extends 'spectrogram' 
  ? SpectrogramRenderConfig 
  : OscilloscopeRenderConfig;

// Specific render configurations
export interface FrequencyRenderConfig {
  readonly barCount: number;
  readonly barWidth: number;
  readonly barSpacing: number;
  readonly minBarHeight: number;
  readonly maxBarHeight: number;
  readonly sensitivity: number;
  readonly smoothing: number;
  readonly colorScheme: ColorScheme;
  readonly drawPeaks: boolean;
  readonly mirrorVertical: boolean;
  readonly logarithmicScale: boolean;
}

export interface WaveformRenderConfig {
  readonly lineWidth: number;
  readonly amplitude: number;
  readonly centerline: boolean;
  readonly fillArea: boolean;
  readonly colorScheme: ColorScheme;
  readonly smoothing: number;
}

export interface SpectrogramRenderConfig {
  readonly colorMap: ColorMap;
  readonly intensityRange: [number, number];
  readonly scrollDirection: 'horizontal' | 'vertical';
  readonly timeWindow: number;
}

export interface OscilloscopeRenderConfig {
  readonly lineWidth: number;
  readonly timeScale: number;
  readonly triggerLevel: number;
  readonly channelColors: string[];
  readonly gridEnabled: boolean;
}

// Color schemes and styling
export interface ColorScheme {
  readonly type: 'gradient' | 'solid' | 'rainbow' | 'spectrum';
  readonly colors: readonly string[];
  readonly opacity: number;
  readonly backgroundAlpha: number;
}

export interface ColorMap {
  readonly type: 'heat' | 'cool' | 'viridis' | 'plasma' | 'custom';
  readonly steps: ColorStop[];
}

export interface ColorStop {
  readonly position: number; // 0-1
  readonly color: string;
}

// Performance monitoring for canvas operations
export interface RenderPerformanceMetrics {
  readonly frameTime: number;
  readonly renderTime: number;
  readonly clearTime: number;
  readonly drawCallCount: number;
  readonly memoryUsage: number;
  readonly fps: number;
  readonly framesBehind: number;
}

// Animation and frame timing
export interface FrameTiming {
  readonly targetFps: number;
  readonly frameInterval: number;
  readonly lastFrameTime: number;
  readonly deltaTime: number;
  readonly frameCount: number;
}

// Canvas optimization settings
export interface CanvasOptimizations {
  readonly enableDoubleBuffering: boolean;
  readonly useOffscreenCanvas: boolean;
  readonly batchDrawCalls: boolean;
  readonly selectiveClear: boolean;
  readonly precomputeGradients: boolean;
  readonly enableWebGL: boolean; // Future WebGL support
}

// Drawing primitives and utilities
export interface DrawingPrimitive {
  readonly type: 'rectangle' | 'circle' | 'line' | 'path' | 'text';
  readonly x: number;
  readonly y: number;
  readonly style: DrawingStyle;
}

export interface DrawingStyle {
  readonly fillColor?: string;
  readonly strokeColor?: string;
  readonly lineWidth?: number;
  readonly opacity?: number;
  readonly shadowBlur?: number;
  readonly shadowColor?: string;
}

// Batch rendering for performance
export interface DrawBatch {
  readonly primitives: DrawingPrimitive[];
  readonly transform?: TransformMatrix;
  readonly clipRegion?: Rectangle;
}

export interface TransformMatrix {
  readonly a: number; // scaleX
  readonly b: number; // skewY
  readonly c: number; // skewX
  readonly d: number; // scaleY
  readonly e: number; // translateX
  readonly f: number; // translateY
}

export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Canvas event handling
export interface CanvasEventHandlers {
  onResize?: (dimensions: CanvasDimensions) => void;
  onRender?: (metrics: RenderPerformanceMetrics) => void;
  onContextLost?: () => void;
  onContextRestored?: (context: CanvasRenderingContext2D) => void;
  onPerformanceIssue?: (metrics: RenderPerformanceMetrics) => void;
}

// Canvas state management
export interface CanvasState {
  readonly isRendering: boolean;
  readonly hasContext: boolean;
  readonly dimensions: CanvasDimensions;
  readonly lastRenderTime: number;
  readonly frameCount: number;
  readonly performanceMetrics: RenderPerformanceMetrics;
}

// Quality level definition (used by AdaptiveQuality)
export interface QualityLevel {
  readonly name: string;
  readonly barCount: number;
  readonly frameRate: number;
  readonly enableSmoothing: boolean;
  readonly enableEffects: boolean;
  readonly description: string;
}

// Adaptive quality settings based on performance
export interface AdaptiveQuality {
  readonly enabled: boolean;
  readonly targetFps: number;
  readonly minFps: number;
  readonly qualityLevels: QualityLevel[];
  readonly currentLevel: number;
}

// Mobile-specific canvas optimizations
export interface MobileCanvasConfig {
  readonly reducedFrameRate: boolean;
  readonly simplifiedRendering: boolean;
  readonly batteryOptimized: boolean;
  readonly touchOptimized: boolean;
  readonly lowMemoryMode: boolean;
}

// Canvas factory for creating different renderer types
export interface CanvasRendererFactory {
  createFrequencyRenderer(canvas: HTMLCanvasElement, config: FrequencyRenderConfig): CanvasRenderer<'frequency'>;
  createWaveformRenderer(canvas: HTMLCanvasElement, config: WaveformRenderConfig): CanvasRenderer<'waveform'>;
  createSpectrogramRenderer(canvas: HTMLCanvasElement, config: SpectrogramRenderConfig): CanvasRenderer<'spectrogram'>;
  createOscilloscopeRenderer(canvas: HTMLCanvasElement, config: OscilloscopeRenderConfig): CanvasRenderer<'oscilloscope'>;
}

// WebGL support types (future enhancement)
export interface WebGLRendererConfig {
  readonly enableWebGL: boolean;
  readonly preferWebGL2: boolean;
  readonly antialias: boolean;
  readonly preserveDrawingBuffer: boolean;
  readonly premultipliedAlpha: boolean;
}

// Utility type guards
export function isCanvasSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined';
}

export function isWebGL2Supported(): boolean {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2');
  return context !== null;
}

export function isOffscreenCanvasSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

// Device capability detection and optimization
export interface DeviceCapability {
  readonly deviceType: 'mobile' | 'tablet' | 'desktop';
  readonly screenSize: { width: number; height: number };
  readonly pixelRatio: number;
  readonly isHighDPI: boolean;
  readonly isTouchDevice: boolean;
  readonly hasOrientationChange: boolean;
  readonly memoryStatus: 'low' | 'normal' | 'high';
  readonly batteryStatus: 'charging' | 'discharging' | 'unknown';
  readonly networkType: 'slow' | 'fast' | 'unknown';
  readonly cpuCores: number;
  readonly maxCanvasSize: number;
  readonly supportsOffscreenCanvas: boolean;
  readonly supportsWebGL2: boolean;
  readonly preferReducedMotion: boolean;
  readonly supportsHaptics: boolean;
}

// Responsive canvas configuration with device-specific settings
export interface ResponsiveCanvasConfig {
  readonly aspectRatio?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maintainAspectRatio: boolean;
  readonly respectViewport: boolean;
  readonly enableHighDPI: boolean;
  readonly autoResize: boolean;
  readonly debounceMs: number;
  readonly deviceOptimization: boolean;
  readonly fallbackDimensions: { width: number; height: number };
  readonly breakpoints: ResponsiveBreakpoints;
}

// Breakpoint definitions for responsive behavior
export interface ResponsiveBreakpoints {
  readonly mobile: number;    // < 768px
  readonly tablet: number;    // 768px - 1024px
  readonly desktop: number;   // > 1024px
}

// Container size information
export interface ContainerSize {
  readonly width: number;
  readonly height: number;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly clientRect: DOMRect;
}

// Responsive canvas state
export interface ResponsiveCanvasState {
  readonly isInitialized: boolean;
  readonly isResizing: boolean;
  readonly hasValidContainer: boolean;
  readonly containerSize: ContainerSize | null;
  readonly dimensions: CanvasDimensions | null;
  readonly deviceCapability: DeviceCapability | null;
  readonly currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  readonly orientation: 'portrait' | 'landscape';
  readonly lastResizeTime: number;
  readonly resizeCount: number;
}

// Performance-aware resize configuration
export interface ResizePerformanceConfig {
  readonly enableDebouncing: boolean;
  readonly debounceMs: number;
  readonly enableThrottling: boolean;
  readonly throttleMs: number;
  readonly maxResizesPerSecond: number;
  readonly performanceMode: 'smooth' | 'performance' | 'balanced';
  readonly skipFramesDuringResize: boolean;
}

// Canvas utility functions types
export interface CanvasUtils {
  calculateOptimalDimensions(container: Element): CanvasDimensions;
  setupHighDPICanvas(canvas: HTMLCanvasElement): CanvasDimensions;
  createGradient(context: CanvasRenderingContext2D, colorScheme: ColorScheme): CanvasGradient;
  measureTextWidth(context: CanvasRenderingContext2D, text: string): number;
  clearRect(context: CanvasRenderingContext2D, rect: Rectangle): void;
}