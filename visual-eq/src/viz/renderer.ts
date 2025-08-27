/**
 * High-performance Canvas 2D renderer for audio frequency visualization
 * Target: 60fps with device pixel ratio support and performance budgeting
 */

export type Theme = 'light' | 'dark';

interface BarLayout {
  x: number;
  width: number;
  logFreqIndex: number; // Mapped frequency bin for logarithmic distribution
}

export class VisualizerRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  
  // Performance tracking
  private lastFrameTime = 0;
  private renderBudgetMs = 12; // Skip frame if render takes >12ms
  
  // Bar configuration
  private barCount = 64;
  private barLayouts: BarLayout[] = [];
  private frequencyBinCount = 0;
  
  // Visual styling
  private theme: Theme = 'dark';
  private gradient: CanvasGradient | null = null;
  private backgroundColor = '#000000';
  
  // Cached dimensions
  private canvasWidth = 0;
  private canvasHeight = 0;

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
    
    // Scale context to match device pixel ratio
    this.ctx.scale(this.dpr, this.dpr);
    
    // Recalculate bar layouts
    this.calculateBarLayouts();
    this.createGradient();
  }

  /**
   * Set the number of frequency bars to display
   */
  setBarCount(count: number): void {
    this.barCount = Math.max(8, Math.min(256, count));
    this.calculateBarLayouts();
  }

  /**
   * Update visual theme
   */
  setTheme(theme: Theme): void {
    this.theme = theme;
    
    if (theme === 'dark') {
      this.backgroundColor = '#000000';
    } else {
      this.backgroundColor = '#ffffff';
    }
    
    this.createGradient();
  }

  /**
   * Main render method - draw frequency bars
   */
  drawBars(frequencyData: Uint8Array): void {
    if (!this.ctx || !this.canvas || this.barLayouts.length === 0) return;

    const startTime = performance.now();
    
    // Skip frame if last render took too long (performance budget)
    if (this.lastFrameTime > this.renderBudgetMs) {
      return;
    }

    const ctx = this.ctx;
    const displayWidth = this.canvasWidth / (this.dpr || 1);
    const displayHeight = this.canvasHeight / (this.dpr || 1);

    // Clear canvas with background color
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Set gradient for bars
    if (this.gradient) {
      ctx.fillStyle = this.gradient;
    }

    // Render bars in single loop (minimize state changes)
    for (const bar of this.barLayouts) {
      // Get frequency value for this bar (logarithmic mapping)
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      
      // Convert to bar height (0-255 -> 0-canvasHeight)
      const normalizedHeight = freqValue / 255;
      const barHeight = normalizedHeight * displayHeight * 0.9; // Leave 10% padding
      
      // Draw bar from bottom up
      const barY = displayHeight - barHeight;
      
      // Single fillRect call per bar
      ctx.fillRect(bar.x, barY, bar.width, barHeight);
    }

    // Track render performance
    this.lastFrameTime = performance.now() - startTime;
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
   * Update frequency bin count when audio engine changes
   */
  updateFrequencyBinCount(binCount: number): void {
    this.frequencyBinCount = binCount;
    this.calculateBarLayouts();
  }

  /**
   * Get current render performance metrics
   */
  getPerformanceStats(): { lastFrameTime: number; renderBudget: number } {
    return {
      lastFrameTime: this.lastFrameTime,
      renderBudget: this.renderBudgetMs
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.gradient = null;
    this.barLayouts = [];
  }
}