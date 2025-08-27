/**
 * Renderer Factory - Creates and manages visualization renderers
 * Handles switching between different visualization modes
 */

import { BaseRenderer } from './baseRenderer.ts';
import { BarRenderer } from './barRenderer.ts';
import { MandalaRenderer } from './mandalaRenderer.ts';
import { VisualizationMode, type VisualizationConfig } from './visualizationMode.ts';

export class RendererFactory {
  private currentRenderer: BaseRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;

  /**
   * Initialize with canvas element
   */
  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    return true;
  }

  /**
   * Create or switch to a renderer for the given mode
   */
  getRenderer(mode: VisualizationMode): BaseRenderer {
    // If we already have the correct renderer, return it
    if (this.currentRenderer && this.isCorrectRenderer(mode)) {
      return this.currentRenderer;
    }

    // Dispose of current renderer
    if (this.currentRenderer) {
      this.currentRenderer.dispose();
    }

    // Create new renderer based on mode
    switch (mode) {
      case VisualizationMode.BARS:
        this.currentRenderer = new BarRenderer();
        break;
      case VisualizationMode.MANDALA:
        this.currentRenderer = new MandalaRenderer();
        break;
      default:
        throw new Error(`Unknown visualization mode: ${mode}`);
    }

    // Initialize the new renderer
    if (this.canvas && !this.currentRenderer.initialize(this.canvas)) {
      throw new Error('Failed to initialize renderer');
    }

    return this.currentRenderer;
  }

  /**
   * Check if current renderer matches the desired mode
   */
  private isCorrectRenderer(mode: VisualizationMode): boolean {
    if (!this.currentRenderer) return false;

    switch (mode) {
      case VisualizationMode.BARS:
        return this.currentRenderer instanceof BarRenderer;
      case VisualizationMode.MANDALA:
        return this.currentRenderer instanceof MandalaRenderer;
      default:
        return false;
    }
  }

  /**
   * Update configuration for current renderer
   */
  updateConfiguration(config: VisualizationConfig): void {
    if (this.currentRenderer) {
      this.currentRenderer.updateConfiguration(config);
    }
  }

  /**
   * Update frequency bin count for current renderer
   */
  updateFrequencyBinCount(binCount: number): void {
    if (this.currentRenderer) {
      this.currentRenderer.updateFrequencyBinCount(binCount);
    }
  }

  /**
   * Resize current renderer
   */
  resize(): void {
    if (this.currentRenderer) {
      this.currentRenderer.resize();
    }
  }

  /**
   * Set theme for current renderer
   */
  setTheme(theme: 'light' | 'dark'): void {
    if (this.currentRenderer) {
      this.currentRenderer.setTheme(theme);
    }
  }

  /**
   * Render with current renderer
   */
  render(frequencyData: Uint8Array): void {
    if (this.currentRenderer) {
      this.currentRenderer.render(frequencyData);
    }
  }

  /**
   * Get performance stats from current renderer
   */
  getPerformanceStats() {
    return this.currentRenderer?.getPerformanceStats() || {
      lastFrameTime: 0,
      renderBudget: 12,
      averageFPS: 60,
      isPerformant: true
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    if (this.currentRenderer) {
      this.currentRenderer.dispose();
      this.currentRenderer = null;
    }
    this.canvas = null;
  }
}