/**
 * Bar Renderer - Frequency bars visualization
 * Refactored from original VisualizerRenderer to extend BaseRenderer
 */

import { BaseRenderer } from './baseRenderer.ts';
import type { Theme } from './themes.ts';
import type { VisualizationConfig, BarConfig } from './visualizationMode.ts';
import { ColorMapping, type ColorMode, type ColorConfig } from './colorMapping.ts';
import { BarEffects, type BarVisualMode, type BarEffectConfig, type BarLayout as EffectBarLayout } from './effects/barEffects.ts';

interface BarLayout {
  x: number;
  width: number;
  logFreqIndex: number; // Mapped frequency bin for logarithmic distribution
}

export class BarRenderer extends BaseRenderer {
  // Bar-specific configuration
  private barCount = 64;
  private barLayouts: BarLayout[] = [];
  private frequencyBinCount = 0;
  private gradient: CanvasGradient | null = null;
  
  // Enhanced color mapping system
  private colorMapping: ColorMapping | null = null;
  private colorMode: ColorMode = 'theme';
  
  // Bar effects system
  private barEffects: BarEffects | null = null;
  private visualMode: BarVisualMode = 'standard';

  /**
   * Initialize the renderer (override from BaseRenderer)
   */
  initialize(canvas: HTMLCanvasElement): boolean {
    const success = super.initialize(canvas);
    if (!success) return false;
    
    // Initialize color mapping and effects systems
    if (this.canvas && this.ctx) {
      this.colorMapping = new ColorMapping(this.canvas, this.ctx);
      this.barEffects = new BarEffects(this.canvas, this.ctx, this.dpr || 1);
    }
    
    return true;
  }

  /**
   * Main render method - draw frequency bars with enhanced colors
   */
  render(frequencyData: Uint8Array): void {
    this.performRender(() => {
      if (this.barLayouts.length === 0) return;

      this.clearCanvas();
      
      if (this.visualMode === 'standard') {
        this.drawEnhancedBars(frequencyData);
      } else {
        this.drawBarsWithEffects(frequencyData);
      }
    });
  }

  /**
   * Draw frequency bars with effects using BarEffects system
   */
  private drawBarsWithEffects(frequencyData: Uint8Array): void {
    if (!this.ctx || !this.colorMapping || !this.barEffects) return;

    const displayHeight = this.canvasHeight / (this.dpr || 1);

    // Create color configuration
    const colorConfig: ColorConfig = {
      mode: this.colorMode,
      theme: this.theme,
      barCount: this.barCount,
      canvasHeight: displayHeight
    };

    // Create bar effect configuration
    const effectConfig: BarEffectConfig & ColorConfig = {
      visualMode: this.visualMode,
      theme: this.theme,
      barCount: this.barCount,
      canvasWidth: this.canvasWidth / (this.dpr || 1),
      canvasHeight: displayHeight,
      sensitivity: 1.0, // TODO: Get from audio config
      ...colorConfig
    };

    // Convert BarLayout to EffectBarLayout format
    const effectBarLayouts: EffectBarLayout[] = this.barLayouts.map(bar => ({
      x: bar.x,
      width: bar.width,
      logFreqIndex: bar.logFreqIndex
    }));

    // Render using BarEffects system
    this.barEffects.renderBarsWithEffects(
      frequencyData,
      effectBarLayouts,
      this.colorMapping,
      effectConfig
    );
  }

  /**
   * Draw frequency bars with enhanced color mapping
   */
  private drawEnhancedBars(frequencyData: Uint8Array): void {
    if (!this.ctx || !this.colorMapping) return;

    const ctx = this.ctx;
    const displayWidth = this.canvasWidth / (this.dpr || 1);
    const displayHeight = this.canvasHeight / (this.dpr || 1);

    // Create color configuration
    const colorConfig: ColorConfig = {
      mode: this.colorMode,
      theme: this.theme,
      barCount: this.barCount,
      canvasHeight: displayHeight
    };

    // Render bars with individual colors based on mode
    for (let i = 0; i < this.barLayouts.length; i++) {
      const bar = this.barLayouts[i];
      
      // Get frequency value for this bar (logarithmic mapping)
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      
      // Convert to bar height (0-255 -> 0-canvasHeight)
      const normalizedHeight = freqValue / 255;
      const barHeight = normalizedHeight * displayHeight * 0.9; // Leave 10% padding
      
      // Draw bar from bottom up
      const barY = displayHeight - barHeight;
      
      // Get color for this specific bar
      const barColor = this.colorMapping.getBarColor(colorConfig, i, freqValue);
      
      // Apply color and draw
      ctx.fillStyle = barColor.fill;
      if (barColor.alpha !== undefined) {
        ctx.globalAlpha = barColor.alpha;
      }
      
      ctx.fillRect(bar.x, barY, bar.width, barHeight);
      
      // Reset alpha if it was changed
      if (barColor.alpha !== undefined) {
        ctx.globalAlpha = 1.0;
      }
    }
  }

  /**
   * Set the color mode for bar visualization
   */
  setColorMode(mode: ColorMode): void {
    this.colorMode = mode;
    // Clear color cache when mode changes
    if (this.colorMapping) {
      this.colorMapping.clearCache();
    }
  }

  /**
   * Get current color mode
   */
  getColorMode(): ColorMode {
    return this.colorMode;
  }

  /**
   * Set the visual mode for bar visualization
   */
  setVisualMode(mode: BarVisualMode): void {
    this.visualMode = mode;
    // Clear peak holds when switching modes
    if (this.barEffects) {
      this.barEffects.clearPeakHolds();
    }
  }

  /**
   * Get current visual mode
   */
  getVisualMode(): BarVisualMode {
    return this.visualMode;
  }

  /**
   * Set the number of frequency bars to display
   */
  setBarCount(count: number): void {
    this.barCount = Math.max(8, Math.min(256, count));
    this.calculateBarLayouts();
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: VisualizationConfig): void {
    if (config.theme !== this.theme) {
      this.setTheme(config.theme);
    }

    const barConfig = config as BarConfig;
    if (barConfig.barCount !== undefined) {
      this.setBarCount(barConfig.barCount);
    }

    // Handle color mode changes (if specified in config)
    if ('colorMode' in barConfig && barConfig.colorMode !== this.colorMode) {
      this.setColorMode(barConfig.colorMode as ColorMode);
    }

    // Handle visual mode changes (if specified in config)
    if ('visualMode' in barConfig && barConfig.visualMode !== this.visualMode) {
      this.setVisualMode(barConfig.visualMode as BarVisualMode);
    }
  }

  /**
   * Update frequency bin count when audio engine changes
   */
  updateFrequencyBinCount(binCount: number): void {
    this.frequencyBinCount = binCount;
    this.calculateBarLayouts();
  }

  /**
   * Handle resize events
   */
  protected onResize(): void {
    this.calculateBarLayouts();
    this.createGradient();
  }

  /**
   * Handle theme changes
   */
  protected onThemeChange(): void {
    this.createGradient();
    // Clear color mapping cache when theme changes
    if (this.colorMapping) {
      this.colorMapping.clearCache();
    }
  }

  /**
   * Pre-calculate bar positions and logarithmic frequency mapping
   */
  private calculateBarLayouts(): void {
    if (!this.canvas) return;

    const displayWidth = this.canvasWidth / (this.dpr || 1);
    const barSpacing = 2; // Fixed spacing between bars
    const totalSpacing = (this.barCount - 1) * barSpacing;
    const availableWidth = displayWidth - totalSpacing;
    const barWidth = Math.max(1, Math.floor(availableWidth / this.barCount));
    
    this.barLayouts = [];
    
    // Pre-calculate logarithmic frequency distribution
    const minFreq = 1; // Start from bin 1 (skip DC component)
    const maxFreq = this.frequencyBinCount > 0 ? this.frequencyBinCount - 1 : 1024;
    const logMinFreq = Math.log(minFreq);
    const logMaxFreq = Math.log(maxFreq);
    const logRange = logMaxFreq - logMinFreq;

    for (let i = 0; i < this.barCount; i++) {
      const x = i * (barWidth + barSpacing);
      
      // Logarithmic frequency mapping for natural distribution
      const logPos = (i / (this.barCount - 1)) * logRange + logMinFreq;
      const logFreqIndex = Math.round(Math.exp(logPos));
      
      this.barLayouts.push({
        x,
        width: barWidth,
        logFreqIndex: Math.min(logFreqIndex, maxFreq)
      });
    }
  }

  /**
   * Create color gradient for bars
   */
  private createGradient(): void {
    if (!this.ctx || !this.canvas) return;

    const displayHeight = this.canvasHeight / (this.dpr || 1);
    this.gradient = this.ctx.createLinearGradient(0, displayHeight, 0, 0);

    if (this.theme === 'dark') {
      // Dark theme: cool to warm gradient
      this.gradient.addColorStop(0, '#1e3a8a'); // Deep blue
      this.gradient.addColorStop(0.3, '#3b82f6'); // Blue
      this.gradient.addColorStop(0.6, '#10b981'); // Green
      this.gradient.addColorStop(0.8, '#f59e0b'); // Amber
      this.gradient.addColorStop(1, '#ef4444'); // Red
    } else {
      // Light theme: vibrant gradient
      this.gradient.addColorStop(0, '#1e40af'); // Blue-700
      this.gradient.addColorStop(0.3, '#2563eb'); // Blue-600
      this.gradient.addColorStop(0.6, '#059669'); // Emerald-600
      this.gradient.addColorStop(0.8, '#d97706'); // Amber-600
      this.gradient.addColorStop(1, '#dc2626'); // Red-600
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    super.dispose();
    this.gradient = null;
    this.barLayouts = [];
    
    // Dispose color mapping system
    if (this.colorMapping) {
      this.colorMapping.dispose();
      this.colorMapping = null;
    }

    // Dispose bar effects system
    if (this.barEffects) {
      this.barEffects.dispose();
      this.barEffects = null;
    }
  }
}