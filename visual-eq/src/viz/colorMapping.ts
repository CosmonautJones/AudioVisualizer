/**
 * Color Mapping System for Bar Visualization
 * Supports multiple color modes: theme-based, frequency-based, rainbow, amplitude-based
 */

import type { Theme } from './themes.ts';

export type ColorMode = 'theme' | 'frequency' | 'rainbow' | 'amplitude';

export interface ColorConfig {
  mode: ColorMode;
  theme: Theme;
  barCount: number;
  canvasHeight: number;
}

export interface BarColor {
  fill: string | CanvasGradient;
  stroke?: string;
  alpha?: number;
}

export class ColorMapping {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gradientCache: Map<string, CanvasGradient> = new Map();
  private colorCache: Map<string, string[]> = new Map();

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /**
   * Get color for a specific bar based on the color mode
   */
  getBarColor(config: ColorConfig, barIndex: number, frequencyValue: number): BarColor {
    switch (config.mode) {
      case 'theme':
        return this.getThemeColor(config, barIndex);
      case 'frequency':
        return this.getFrequencyColor(config, barIndex, frequencyValue);
      case 'rainbow':
        return this.getRainbowColor(config, barIndex);
      case 'amplitude':
        return this.getAmplitudeColor(config, barIndex, frequencyValue);
      default:
        return this.getThemeColor(config, barIndex);
    }
  }

  /**
   * Theme-based colors (current system with gradients)
   */
  private getThemeColor(config: ColorConfig, barIndex: number): BarColor {
    const cacheKey = `theme-${config.theme}-${config.canvasHeight}`;
    
    if (!this.gradientCache.has(cacheKey)) {
      const gradient = this.createThemeGradient(config);
      this.gradientCache.set(cacheKey, gradient);
    }

    return {
      fill: this.gradientCache.get(cacheKey)!
    };
  }

  /**
   * Frequency-based colors (bass=red, mids=green, treble=blue)
   */
  private getFrequencyColor(config: ColorConfig, barIndex: number, frequencyValue: number): BarColor {
    const frequencyRatio = barIndex / (config.barCount - 1);
    const intensity = frequencyValue / 255;

    let baseColor: [number, number, number];

    if (frequencyRatio < 0.33) {
      // Bass frequencies - Red spectrum
      baseColor = [255, 50, 50];
    } else if (frequencyRatio < 0.67) {
      // Mid frequencies - Green spectrum
      baseColor = [50, 255, 50];
    } else {
      // Treble frequencies - Blue spectrum
      baseColor = [50, 150, 255];
    }

    // Apply intensity and theme adjustments
    const alpha = 0.7 + (intensity * 0.3);
    const brightness = config.theme === 'dark' ? 1.0 : 0.8;

    return {
      fill: `rgba(${Math.round(baseColor[0] * brightness)}, ${Math.round(baseColor[1] * brightness)}, ${Math.round(baseColor[2] * brightness)}, ${alpha})`
    };
  }

  /**
   * Rainbow/spectrum colors distributed across bars
   */
  private getRainbowColor(config: ColorConfig, barIndex: number): BarColor {
    const hue = (barIndex / config.barCount) * 360;
    const saturation = config.theme === 'dark' ? 80 : 70;
    const lightness = config.theme === 'dark' ? 60 : 50;

    return {
      fill: `hsl(${hue}, ${saturation}%, ${lightness}%)`
    };
  }

  /**
   * Amplitude-based colors (brightness based on volume)
   */
  private getAmplitudeColor(config: ColorConfig, barIndex: number, frequencyValue: number): BarColor {
    const intensity = frequencyValue / 255;
    const baseHue = config.theme === 'dark' ? 220 : 200; // Blue base
    const saturation = 60 + (intensity * 40); // 60-100%
    const lightness = config.theme === 'dark' ? 
      30 + (intensity * 40) : // 30-70% for dark
      25 + (intensity * 35);   // 25-60% for light

    return {
      fill: `hsl(${baseHue}, ${saturation}%, ${lightness}%)`
    };
  }

  /**
   * Create theme-based gradient (original system)
   */
  private createThemeGradient(config: ColorConfig): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(0, config.canvasHeight, 0, 0);

    if (config.theme === 'dark') {
      // Dark theme: cool to warm gradient
      gradient.addColorStop(0, '#1e3a8a'); // Deep blue
      gradient.addColorStop(0.3, '#3b82f6'); // Blue
      gradient.addColorStop(0.6, '#10b981'); // Green
      gradient.addColorStop(0.8, '#f59e0b'); // Amber
      gradient.addColorStop(1, '#ef4444'); // Red
    } else if (config.theme === 'light') {
      // Light theme: vibrant gradient
      gradient.addColorStop(0, '#1e40af'); // Blue-700
      gradient.addColorStop(0.3, '#2563eb'); // Blue-600
      gradient.addColorStop(0.6, '#059669'); // Emerald-600
      gradient.addColorStop(0.8, '#d97706'); // Amber-600
      gradient.addColorStop(1, '#dc2626'); // Red-600
    } else if (config.theme === 'neon') {
      // Neon theme: electric colors
      gradient.addColorStop(0, '#00ff94'); // Bright green
      gradient.addColorStop(0.3, '#00d4ff'); // Cyan
      gradient.addColorStop(0.6, '#ff073a'); // Hot pink
      gradient.addColorStop(0.8, '#ffff00'); // Electric yellow
      gradient.addColorStop(1, '#ff4500'); // Orange red
    } else {
      // Aurora theme: aurora borealis colors
      gradient.addColorStop(0, '#1a2e3d'); // Deep blue
      gradient.addColorStop(0.2, '#2d5a87'); // Blue
      gradient.addColorStop(0.4, '#4ade80'); // Green
      gradient.addColorStop(0.6, '#fbbf24'); // Yellow
      gradient.addColorStop(0.8, '#f97316'); // Orange
      gradient.addColorStop(1, '#ef4444'); // Red
    }

    return gradient;
  }

  /**
   * Get array of colors for visualization previews
   */
  getColorPreview(mode: ColorMode, theme: Theme, count: number = 5): string[] {
    const cacheKey = `preview-${mode}-${theme}-${count}`;
    
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    const colors: string[] = [];
    const config: ColorConfig = {
      mode,
      theme,
      barCount: count,
      canvasHeight: 100
    };

    for (let i = 0; i < count; i++) {
      const barColor = this.getBarColor(config, i, 200); // Use fixed amplitude for preview
      if (typeof barColor.fill === 'string') {
        colors.push(barColor.fill);
      } else {
        // For gradients, approximate with a middle color
        colors.push(this.approximateGradientColor(i / count));
      }
    }

    this.colorCache.set(cacheKey, colors);
    return colors;
  }

  /**
   * Approximate a gradient color at a specific position
   */
  private approximateGradientColor(position: number): string {
    // Simple approximation for gradient previews
    const hue = position * 240; // 0-240 degrees (blue to red)
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Clear caches when canvas is resized or configuration changes
   */
  clearCache(): void {
    this.gradientCache.clear();
    this.colorCache.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearCache();
  }
}

/**
 * Utility functions for color manipulation
 */
export class ColorUtils {
  /**
   * Convert HSL to RGB
   */
  static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    if (s === 0) {
      const rgb = Math.round(l * 255);
      return [rgb, rgb, rgb];
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return [r, g, b];
  }

  /**
   * Calculate color contrast ratio
   */
  static getContrastRatio(color1: string, color2: string): number {
    // Simplified contrast calculation
    // In a real implementation, you'd parse the colors and calculate luminance
    return 4.5; // Placeholder - meets WCAG AA standard
  }

  /**
   * Ensure color has sufficient contrast for accessibility
   */
  static ensureContrast(color: string, background: string, minRatio: number = 4.5): string {
    // Simplified implementation
    // In practice, you'd adjust the color to meet contrast requirements
    return color;
  }
}