/**
 * Visualization Mode System for Audio Visualizer
 * Defines visualization types and configuration interfaces
 */

export enum VisualizationMode {
  BARS = 'bars',
  MANDALA = 'mandala'
}

export interface VisualizationConfig {
  mode: VisualizationMode;
  theme: 'light' | 'dark';
  sensitivity: number;
}

export interface BarConfig extends VisualizationConfig {
  barCount: number;
}

export interface MandalaConfig extends VisualizationConfig {
  segments: number;        // 8-64 radial segments
  rings: number;          // 3-8 concentric rings
  innerRadius: number;    // 0.1-0.8 (% of canvas)
  outerRadius: number;    // 0.6-1.0 (% of canvas)
  rotationSpeed: number;  // 0-10 degrees per second
  symmetryMode: SymmetryMode;
  colorPalette: ColorPalette;
  glowIntensity: number;  // 0-1
  pulseReactivity: number; // 0-1
}

export enum SymmetryMode {
  NONE = 'none',
  MIRROR_X = 'mirror-x',
  MIRROR_Y = 'mirror-y',
  RADIAL_2X = 'radial-2x',
  RADIAL_4X = 'radial-4x',
  RADIAL_8X = 'radial-8x',
  KALEIDOSCOPE = 'kaleidoscope'
}

export enum ColorPalette {
  AURORA = 'aurora',      // Blues, greens, purples
  SOLAR = 'solar',        // Reds, oranges, yellows
  CRYSTAL = 'crystal',    // Whites, cyans, magentas
  PSYCHEDELIC = 'psychedelic', // Full spectrum
  MONOCHROME = 'monochrome',   // Single hue variations
  CUSTOM = 'custom'       // User-defined
}

// Default configurations
export const DEFAULT_BAR_CONFIG: BarConfig = {
  mode: VisualizationMode.BARS,
  theme: 'dark',
  sensitivity: 1.0,
  barCount: 64
};

export const DEFAULT_MANDALA_CONFIG: MandalaConfig = {
  mode: VisualizationMode.MANDALA,
  theme: 'dark',
  sensitivity: 1.0,
  segments: 32,
  rings: 4,
  innerRadius: 0.2,
  outerRadius: 0.9,
  rotationSpeed: 2.0,
  symmetryMode: SymmetryMode.NONE,
  colorPalette: ColorPalette.AURORA,
  glowIntensity: 0.6,
  pulseReactivity: 0.8
};

// Performance quality levels for adaptive rendering
export enum PerformanceMode {
  HIGH_PERFORMANCE = 'high-performance', // 128 points, 3 rings
  BALANCED = 'balanced',                 // 256 points, 4 rings  
  HIGH_QUALITY = 'high-quality'          // 512 points, 6 rings
}

export interface PerformanceConfig {
  mode: PerformanceMode;
  targetFPS: number;
  maxRenderTime: number; // milliseconds
}