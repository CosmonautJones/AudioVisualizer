/**
 * Base Renderer Abstract Class
 * Provides common canvas management and performance monitoring
 * for all visualization renderers
 */

import type { Theme } from './themes.ts';
import type { VisualizationConfig } from './visualizationMode.ts';

export abstract class BaseRenderer {
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected dpr = 1;
  
  // Performance tracking
  protected lastFrameTime = 0;
  protected renderBudgetMs = 12; // Skip frame if render takes >12ms
  protected frameCount = 0;
  protected fpsHistory: number[] = [];
  
  // Cached dimensions
  protected canvasWidth = 0;
  protected canvasHeight = 0;
  protected centerX = 0;
  protected centerY = 0;
  
  // Visual styling
  protected theme: Theme = 'dark';
  protected backgroundColor = '#000000';

  /**
   * Initialize renderer with canvas element
   */
  initialize(canvas: HTMLCanvasElement): boolean {
    try {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', {
        alpha: false, // Opaque canvas for better performance
        desynchronized: true // Hint for hardware acceleration
      });
      
      if (!this.ctx) {
        console.error('Failed to get 2D context');
        return false;
      }

      this.dpr = window.devicePixelRatio || 1;
      this.setTheme(this.theme);
      this.resize();
      
      return true;
    } catch (error) {
      console.error('Renderer initialization failed:', error);
      return false;
    }
  }

  /**
   * Handle canvas resize with device pixel ratio awareness
   */
  resize(): void {
    if (!this.canvas || !this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    
    // Set display size (CSS pixels)
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Set canvas resolution (device pixels)
    this.canvasWidth = rect.width * this.dpr;
    this.canvasHeight = rect.height * this.dpr;
    
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    
    // Update center coordinates
    this.centerX = this.canvasWidth / (this.dpr * 2);
    this.centerY = this.canvasHeight / (this.dpr * 2);
    
    // Scale context to match device pixel ratio
    this.ctx.scale(this.dpr, this.dpr);
    
    // Trigger renderer-specific resize logic
    this.onResize();
  }

  /**
   * Set visual theme
   */
  setTheme(theme: Theme): void {
    this.theme = theme;
    
    if (theme === 'dark') {
      this.backgroundColor = '#000000';
    } else {
      this.backgroundColor = '#ffffff';
    }
    
    this.onThemeChange();
  }

  /**
   * Clear canvas with background color
   */
  protected clearCanvas(): void {
    if (!this.ctx) return;
    
    const displayWidth = this.canvasWidth / (this.dpr || 1);
    const displayHeight = this.canvasHeight / (this.dpr || 1);

    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
  }

  /**
   * Performance monitoring wrapper around render
   */
  protected performRender(renderFn: () => void): void {
    if (!this.ctx || !this.canvas) return;

    const startTime = performance.now();
    
    // Skip frame if last render took too long
    if (this.lastFrameTime > this.renderBudgetMs) {
      return;
    }

    // Execute the actual rendering
    renderFn();
    
    // Track performance
    this.lastFrameTime = performance.now() - startTime;
    this.updateFPSHistory();
  }

  /**
   * Update FPS tracking history
   */
  private updateFPSHistory(): void {
    this.frameCount++;
    
    if (this.frameCount % 60 === 0) { // Update every 60 frames
      const currentFPS = 1000 / Math.max(this.lastFrameTime, 1);
      this.fpsHistory.push(currentFPS);
      
      // Keep only last 10 FPS measurements
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }
    }
  }

  /**
   * Get current render performance metrics
   */
  getPerformanceStats(): { 
    lastFrameTime: number; 
    renderBudget: number;
    averageFPS: number;
    isPerformant: boolean;
  } {
    const averageFPS = this.fpsHistory.length > 0 
      ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length 
      : 60;

    return {
      lastFrameTime: this.lastFrameTime,
      renderBudget: this.renderBudgetMs,
      averageFPS,
      isPerformant: averageFPS >= 55 && this.lastFrameTime <= this.renderBudgetMs
    };
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract render(frequencyData: Uint8Array): void;
  abstract updateConfiguration(config: VisualizationConfig): void;
  abstract updateFrequencyBinCount(binCount: number): void;
  
  /**
   * Template methods for subclass customization
   */
  protected abstract onResize(): void;
  protected abstract onThemeChange(): void;

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.fpsHistory = [];
    this.frameCount = 0;
  }
}