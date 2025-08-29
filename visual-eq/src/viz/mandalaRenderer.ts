/**
 * Mandala Renderer - Radial/circular audio visualization
 * Creates beautiful mandala patterns from frequency data
 */

import { BaseRenderer } from './baseRenderer.ts';
import type { VisualizationConfig, MandalaConfig, SymmetryMode, ColorPalette } from './visualizationMode.ts';

interface PolarPoint {
  angle: number;
  radius: number;
  x: number;
  y: number;
}

interface MandalaSegment {
  angle: number;
  points: PolarPoint[];
  frequencyIndex: number;
}

interface ColorStop {
  position: number;
  color: string;
}

export class MandalaRenderer extends BaseRenderer {
  // Mandala configuration
  private config: MandalaConfig;
  private segments: MandalaSegment[] = [];
  private frequencyBinCount = 0;
  
  // Animation state
  private currentRotation = 0;
  private lastTimestamp = 0;
  
  // Performance optimization caches
  private polarCache = new Map<string, PolarPoint>();
  private gradientCache = new Map<string, CanvasGradient>();
  
  // Visual elements
  private centerGradient: CanvasGradient | null = null;
  private ringGradients: CanvasGradient[] = [];
  
  // Off-screen buffer for symmetry effects
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenContext: CanvasRenderingContext2D | null = null;

  constructor() {
    super();
    this.config = {
      mode: 'mandala' as any,
      theme: 'dark',
      sensitivity: 1.0,
      segments: 32,
      rings: 4,
      innerRadius: 0.2,
      outerRadius: 0.9,
      rotationSpeed: 2.0,
      symmetryMode: 'none' as SymmetryMode,
      colorPalette: 'aurora' as ColorPalette,
      glowIntensity: 0.6,
      pulseReactivity: 0.8
    };
  }

  /**
   * Initialize renderer with off-screen canvas for symmetry effects
   */
  initialize(canvas: HTMLCanvasElement): boolean {
    if (!super.initialize(canvas)) {
      return false;
    }

    // Create off-screen canvas for symmetry effects
    this.setupOffscreenCanvas();
    
    return true;
  }

  /**
   * Set up off-screen canvas buffer
   */
  private setupOffscreenCanvas(): void {
    if (!this.canvas) return;

    // Create off-screen canvas with same dimensions as main canvas
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenContext = this.offscreenCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });

    if (!this.offscreenContext) {
      console.warn('MandalaRenderer: Failed to create off-screen context');
      return;
    }

    // Match main canvas dimensions
    this.updateOffscreenCanvasSize();
  }

  /**
   * Update off-screen canvas to match main canvas size
   */
  private updateOffscreenCanvasSize(): void {
    if (!this.offscreenCanvas || !this.offscreenContext || !this.canvas) return;

    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
    
    // Scale context to match device pixel ratio
    this.offscreenContext.scale(this.dpr, this.dpr);
  }

  /**
   * Main render method
   */
  render(frequencyData: Uint8Array): void {
    this.performRender(() => {
      if (this.segments.length === 0) return;

      this.updateAnimation();
      this.clearCanvas();
      this.drawMandala(frequencyData);
    });
  }

  /**
   * Update animation state
   */
  private updateAnimation(): void {
    const currentTime = performance.now();
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = currentTime;
      return;
    }

    const deltaTime = (currentTime - this.lastTimestamp) / 1000; // Convert to seconds
    this.currentRotation += this.config.rotationSpeed * deltaTime * (Math.PI / 180); // Convert to radians
    this.currentRotation %= Math.PI * 2; // Keep rotation within 0-2π

    this.lastTimestamp = currentTime;
  }

  /**
   * Draw the complete mandala visualization
   */
  private drawMandala(frequencyData: Uint8Array): void {
    if (!this.ctx) return;

    // If symmetry is enabled and off-screen canvas is available, use buffer approach
    if (this.config.symmetryMode !== 'none' && this.offscreenContext && this.offscreenCanvas) {
      this.drawMandalaWithSymmetry(frequencyData);
    } else {
      // Draw directly to main canvas for 'none' symmetry mode
      this.drawBaseMandala(this.ctx, frequencyData);
    }
  }

  /**
   * Draw mandala with symmetry effects using off-screen buffer
   */
  private drawMandalaWithSymmetry(frequencyData: Uint8Array): void {
    if (!this.ctx || !this.offscreenContext || !this.offscreenCanvas) return;

    // Clear off-screen canvas
    this.offscreenContext.fillStyle = this.backgroundColor;
    this.offscreenContext.fillRect(0, 0, this.offscreenCanvas.width / this.dpr, this.offscreenCanvas.height / this.dpr);

    // Draw base mandala to off-screen canvas
    this.drawBaseMandala(this.offscreenContext, frequencyData);

    // Clear main canvas
    this.clearCanvas();

    // Draw the base mandala from buffer to main canvas
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);

    // Apply symmetry effects using the buffer
    this.applySymmetryEffect(this.ctx);
  }

  /**
   * Draw the base mandala without symmetry effects
   */
  private drawBaseMandala(ctx: CanvasRenderingContext2D, frequencyData: Uint8Array): void {
    const maxRadius = Math.min(this.centerX, this.centerY) * this.config.outerRadius;
    const minRadius = Math.min(this.centerX, this.centerY) * this.config.innerRadius;
    const ringWidth = (maxRadius - minRadius) / this.config.rings;

    // Enable glow effect if configured
    if (this.config.glowIntensity > 0) {
      ctx.shadowBlur = 10 * this.config.glowIntensity;
      ctx.shadowColor = this.getPrimaryColor();
    }

    // Draw concentric rings
    for (let ring = 0; ring < this.config.rings; ring++) {
      const ringRadius = minRadius + (ring * ringWidth);
      const nextRingRadius = minRadius + ((ring + 1) * ringWidth);
      
      this.drawRing(ctx, frequencyData, ring, ringRadius, nextRingRadius);
    }

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  /**
   * Draw a single ring of the mandala
   */
  private drawRing(
    ctx: CanvasRenderingContext2D,
    frequencyData: Uint8Array,
    ringIndex: number,
    innerRadius: number,
    outerRadius: number
  ): void {
    const angleStep = (Math.PI * 2) / this.config.segments;
    const gradient = this.getRingGradient(ringIndex);

    ctx.fillStyle = gradient;
    ctx.beginPath();

    for (let i = 0; i < this.config.segments; i++) {
      const angle = (i * angleStep) + this.currentRotation;
      const freqIndex = this.getFrequencyIndex(i, ringIndex);
      const magnitude = (frequencyData[freqIndex] || 0) / 255;
      
      // Apply sensitivity and pulse reactivity
      const adjustedMagnitude = Math.pow(magnitude * this.config.sensitivity, 1 + this.config.pulseReactivity);
      const segmentRadius = innerRadius + (adjustedMagnitude * (outerRadius - innerRadius));

      // Create segment path
      this.createSegmentPath(ctx, angle, angleStep, innerRadius, segmentRadius);
    }

    ctx.fill();
  }

  /**
   * Create path for a mandala segment
   */
  private createSegmentPath(
    ctx: CanvasRenderingContext2D,
    startAngle: number,
    angleStep: number,
    innerRadius: number,
    outerRadius: number
  ): void {
    const endAngle = startAngle + angleStep;
    
    // Outer arc
    ctx.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle);
    
    // Connection to inner arc
    const innerEndX = this.centerX + Math.cos(endAngle) * innerRadius;
    const innerEndY = this.centerY + Math.sin(endAngle) * innerRadius;
    ctx.lineTo(innerEndX, innerEndY);
    
    // Inner arc (reverse direction)
    ctx.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
    
    // Close the path
    ctx.closePath();
  }

  /**
   * Get frequency index for segment and ring
   */
  private getFrequencyIndex(segmentIndex: number, ringIndex: number): number {
    // Map segments and rings to frequency bins
    // Lower rings get lower frequencies, higher rings get higher frequencies
    const totalBins = this.frequencyBinCount;
    const binsPerRing = Math.floor(totalBins / this.config.rings);
    
    const ringStartBin = ringIndex * binsPerRing;
    const segmentBin = Math.floor((segmentIndex / this.config.segments) * binsPerRing);
    
    return Math.min(ringStartBin + segmentBin, totalBins - 1);
  }

  /**
   * Apply symmetry effects
   */
  private applySymmetryEffect(ctx: CanvasRenderingContext2D): void {
    switch (this.config.symmetryMode) {
      case 'mirror-x':
        this.applyMirrorX(ctx);
        break;
      case 'mirror-y':
        this.applyMirrorY(ctx);
        break;
      case 'radial-2x':
      case 'radial-4x':
      case 'radial-8x':
        this.applyRadialSymmetry(ctx);
        break;
      case 'kaleidoscope':
        this.applyKaleidoscope(ctx);
        break;
    }
  }

  /**
   * Apply mirror-X symmetry
   */
  private applyMirrorX(ctx: CanvasRenderingContext2D): void {
    if (!this.offscreenCanvas) {
      console.warn('MandalaRenderer: Off-screen canvas not available for mirror-X effect');
      return;
    }

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-this.centerX * 2, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.8; // Blend the mirrored copy
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.restore();
  }

  /**
   * Apply mirror-Y symmetry
   */
  private applyMirrorY(ctx: CanvasRenderingContext2D): void {
    if (!this.offscreenCanvas) {
      console.warn('MandalaRenderer: Off-screen canvas not available for mirror-Y effect');
      return;
    }

    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -this.centerY * 2);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.8; // Blend the mirrored copy
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.restore();
  }

  /**
   * Apply radial symmetry
   */
  private applyRadialSymmetry(ctx: CanvasRenderingContext2D): void {
    if (!this.offscreenCanvas) {
      console.warn('MandalaRenderer: Off-screen canvas not available for radial symmetry effect');
      return;
    }
    
    const divisions = this.config.symmetryMode === 'radial-2x' ? 2 : 
                     this.config.symmetryMode === 'radial-4x' ? 4 : 8;
    
    const rotationStep = (Math.PI * 2) / divisions;
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    for (let i = 1; i < divisions; i++) {
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate(rotationStep * i);
      ctx.translate(-this.centerX, -this.centerY);
      ctx.globalAlpha = 0.6; // Slightly reduce alpha for better blending
      ctx.drawImage(this.offscreenCanvas, 0, 0);
      ctx.restore();
    }
    
    ctx.restore();
  }

  /**
   * Apply kaleidoscope effect
   */
  private applyKaleidoscope(ctx: CanvasRenderingContext2D): void {
    if (!this.offscreenCanvas) {
      console.warn('MandalaRenderer: Off-screen canvas not available for kaleidoscope effect');
      return;
    }
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Create multiple rotated and scaled copies for kaleidoscope effect
    const copies = 6;
    const baseAlpha = 0.4;
    
    for (let i = 1; i < copies; i++) {
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate((Math.PI * 2 / copies) * i);
      ctx.scale(0.85, 0.85); // Slightly larger scale for better effect
      ctx.translate(-this.centerX, -this.centerY);
      ctx.globalAlpha = baseAlpha * (1 - i / copies * 0.3); // Fade each copy
      ctx.drawImage(this.offscreenCanvas, 0, 0);
      ctx.restore();
    }
    
    ctx.restore();
  }

  /**
   * Get gradient for a specific ring
   */
  private getRingGradient(ringIndex: number): CanvasGradient {
    const cacheKey = `ring-${ringIndex}-${this.config.colorPalette}-${this.theme}`;
    
    if (this.gradientCache.has(cacheKey)) {
      return this.gradientCache.get(cacheKey)!;
    }

    if (!this.ctx) {
      console.error('MandalaRenderer: Canvas context not available for gradient creation');
      // Return a dummy gradient that won't cause crashes
      const dummyCanvas = document.createElement('canvas');
      const dummyCtx = dummyCanvas.getContext('2d')!;
      return dummyCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    }

    const gradient = this.ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, Math.min(this.centerX, this.centerY)
    );

    const colors = this.getColorPalette();
    const colorStep = 1 / (colors.length - 1);

    colors.forEach((color, index) => {
      gradient.addColorStop(index * colorStep, color);
    });

    this.gradientCache.set(cacheKey, gradient);
    return gradient;
  }

  /**
   * Get color palette based on configuration
   */
  private getColorPalette(): string[] {
    switch (this.config.colorPalette) {
      case 'aurora':
        return ['#1e3a8a', '#3b82f6', '#06b6d4', '#10b981', '#6366f1'];
      case 'solar':
        return ['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#fbbf24'];
      case 'crystal':
        return ['#ffffff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#8b5cf6'];
      case 'psychedelic':
        return ['#ff0080', '#ff8000', '#80ff00', '#00ff80', '#0080ff', '#8000ff'];
      case 'monochrome':
        return this.theme === 'dark' 
          ? ['#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db']
          : ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af'];
      default:
        return ['#1e3a8a', '#3b82f6', '#06b6d4', '#10b981', '#6366f1'];
    }
  }

  /**
   * Get primary color for glow effect
   */
  private getPrimaryColor(): string {
    const palette = this.getColorPalette();
    return palette[Math.floor(palette.length / 2)];
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: VisualizationConfig): void {
    const mandalaConfig = config as MandalaConfig;
    this.config = { ...this.config, ...mandalaConfig };

    if (config.theme !== this.theme) {
      this.setTheme(config.theme);
    }

    this.calculateSegments();
    this.clearGradientCache();
  }

  /**
   * Update frequency bin count
   */
  updateFrequencyBinCount(binCount: number): void {
    this.frequencyBinCount = binCount;
    this.calculateSegments();
  }

  /**
   * Handle resize events
   */
  protected onResize(): void {
    this.calculateSegments();
    this.clearGradientCache();
    this.updateOffscreenCanvasSize();
  }

  /**
   * Handle theme changes
   */
  protected onThemeChange(): void {
    this.clearGradientCache();
  }

  /**
   * Calculate segment layout
   */
  private calculateSegments(): void {
    this.segments = [];
    const angleStep = (Math.PI * 2) / this.config.segments;

    for (let i = 0; i < this.config.segments; i++) {
      const angle = i * angleStep;
      const points: PolarPoint[] = [];

      for (let ring = 0; ring < this.config.rings; ring++) {
        const maxRadius = Math.min(this.centerX, this.centerY) * this.config.outerRadius;
        const minRadius = Math.min(this.centerX, this.centerY) * this.config.innerRadius;
        const ringRadius = minRadius + (ring * (maxRadius - minRadius) / this.config.rings);

        points.push({
          angle,
          radius: ringRadius,
          x: this.centerX + Math.cos(angle) * ringRadius,
          y: this.centerY + Math.sin(angle) * ringRadius
        });
      }

      this.segments.push({
        angle,
        points,
        frequencyIndex: Math.floor((i / this.config.segments) * this.frequencyBinCount)
      });
    }
  }

  /**
   * Clear gradient cache
   */
  private clearGradientCache(): void {
    this.gradientCache.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    super.dispose();
    this.segments = [];
    this.polarCache.clear();
    this.gradientCache.clear();
    this.centerGradient = null;
    this.ringGradients = [];
    
    // Clean up off-screen canvas resources
    this.offscreenCanvas = null;
    this.offscreenContext = null;
  }
}