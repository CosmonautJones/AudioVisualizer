/**
 * Renderer Factory - Creates and manages visualization renderers
 * Handles switching between different visualization modes
 */

import { BaseRenderer } from './baseRenderer.ts';
import { BarRenderer } from './barRenderer.ts';
import { MandalaRenderer } from './mandalaRenderer.ts';
import { VisualizationMode, type VisualizationConfig } from './visualizationMode.ts';
import { ZoomManager } from './zoomManager.ts';

export class RendererFactory {
  private currentRenderer: BaseRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private sharedZoomManager: ZoomManager | null = null;

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

    // Preserve zoom manager before disposing current renderer
    if (this.currentRenderer) {
      const currentZoomManager = this.currentRenderer.getZoomManager();
      if (currentZoomManager && !this.sharedZoomManager) {
        this.sharedZoomManager = currentZoomManager;
      }
      
      // Dispose current renderer without destroying zoom manager
      this.disposeCurrentRenderer();
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

    // Initialize zoom with preserved zoom manager
    if (this.sharedZoomManager) {
      this.currentRenderer.initializeZoom(this.sharedZoomManager);
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
   * Initialize zoom for the current renderer
   */
  initializeZoom(zoomManager?: ZoomManager): void {
    if (!this.currentRenderer) return;

    // Store zoom manager reference if provided
    if (zoomManager && !this.sharedZoomManager) {
      this.sharedZoomManager = zoomManager;
    }

    // Initialize zoom on current renderer
    this.currentRenderer.initializeZoom(this.sharedZoomManager || zoomManager);
  }

  /**
   * Get the shared zoom manager
   */
  getZoomManager(): ZoomManager | null {
    return this.sharedZoomManager || (this.currentRenderer?.getZoomManager() ?? null);
  }

  /**
   * Dispose current renderer while preserving zoom manager
   */
  private disposeCurrentRenderer(): void {
    if (!this.currentRenderer) return;

    // Extract zoom manager before disposal to prevent it from being destroyed
    const zoomManager = this.currentRenderer.getZoomManager();
    if (zoomManager && !this.sharedZoomManager) {
      this.sharedZoomManager = zoomManager;
    }

    // Dispose renderer while preserving zoom manager
    this.currentRenderer.dispose(true);
    this.currentRenderer = null;
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
    
    if (this.sharedZoomManager) {
      this.sharedZoomManager.dispose();
      this.sharedZoomManager = null;
    }
    
    this.canvas = null;
  }
}