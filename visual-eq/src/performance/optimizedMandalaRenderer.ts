/**
 * Optimized Mandala Renderer - Performance-enhanced version
 * Implements the key optimizations identified in bottleneck analysis
 */

import { BaseRenderer } from '../viz/baseRenderer.ts';
import type { VisualizationConfig, MandalaConfig, SymmetryMode, ColorPalette } from '../viz/visualizationMode.ts';

interface PrecomputedSegment {
  angle: number;
  cos: number;
  sin: number;
  frequencyIndex: number;
  ringPositions: Float32Array; // Pre-computed radii for each ring
}

interface PrecomputedColors {
  palette: string[];
  rgbValues: number[][]; // Pre-parsed RGB values
}

export class OptimizedMandalaRenderer extends BaseRenderer {
  // Configuration
  private config: MandalaConfig;
  
  // Pre-computed data structures
  private segments: PrecomputedSegment[] = [];
  private colorPalettes = new Map<string, PrecomputedColors>();
  private gradientArrays: CanvasGradient[] = [];
  
  // Performance optimization pools
  private pathPoints = new Float32Array(1024); // Reusable path coordinate buffer
  private tempColors = new Array(32); // Reusable color array
  
  // Trigonometric lookup tables
  private static readonly TRIG_TABLE_SIZE = 360;
  private static sinTable: Float32Array;
  private static cosTable: Float32Array;
  
  // Animation state
  private currentRotation = 0;
  private lastTimestamp = 0;
  
  // Rendering statistics
  private renderStats = {
    trigLookups: 0,
    pathOperations: 0,
    gradientLookups: 0,
    stateChanges: 0
  };

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
    
    this.initializeTrigTables();
    this.precomputeColorPalettes();
  }

  /**
   * Initialize trigonometric lookup tables (static, shared across instances)
   */
  private initializeTrigTables(): void {
    if (!OptimizedMandalaRenderer.sinTable) {
      OptimizedMandalaRenderer.sinTable = new Float32Array(OptimizedMandalaRenderer.TRIG_TABLE_SIZE);
      OptimizedMandalaRenderer.cosTable = new Float32Array(OptimizedMandalaRenderer.TRIG_TABLE_SIZE);
      
      for (let i = 0; i < OptimizedMandalaRenderer.TRIG_TABLE_SIZE; i++) {
        const angle = (i / OptimizedMandalaRenderer.TRIG_TABLE_SIZE) * Math.PI * 2;
        OptimizedMandalaRenderer.sinTable[i] = Math.sin(angle);
        OptimizedMandalaRenderer.cosTable[i] = Math.cos(angle);
      }
    }
  }

  /**
   * Pre-compute all color palettes with parsed RGB values
   */
  private precomputeColorPalettes(): void {
    const paletteDefs = {
      aurora: ['#1e3a8a', '#3b82f6', '#06b6d4', '#10b981', '#6366f1'],
      solar: ['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#fbbf24'],
      crystal: ['#ffffff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#8b5cf6'],
      psychedelic: ['#ff0080', '#ff8000', '#80ff00', '#00ff80', '#0080ff', '#8000ff'],
      monochrome: ['#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db']
    };

    for (const [name, colors] of Object.entries(paletteDefs)) {
      this.colorPalettes.set(name, {
        palette: colors,
        rgbValues: colors.map(color => this.hexToRgb(color))
      });
    }
  }

  /**
   * Fast lookup trigonometric functions
   */
  private fastSin(angle: number): number {
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor((normalizedAngle / (Math.PI * 2)) * OptimizedMandalaRenderer.TRIG_TABLE_SIZE);
    return OptimizedMandalaRenderer.sinTable[Math.min(index, OptimizedMandalaRenderer.TRIG_TABLE_SIZE - 1)];
  }

  private fastCos(angle: number): number {
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor((normalizedAngle / (Math.PI * 2)) * OptimizedMandalaRenderer.TRIG_TABLE_SIZE);
    return OptimizedMandalaRenderer.cosTable[Math.min(index, OptimizedMandalaRenderer.TRIG_TABLE_SIZE - 1)];
  }

  /**
   * Main render method with optimizations
   */
  render(frequencyData: Uint8Array): void {
    this.performRender(() => {
      if (this.segments.length === 0) return;

      // Reset render statistics
      this.renderStats = { trigLookups: 0, pathOperations: 0, gradientLookups: 0, stateChanges: 0 };

      this.updateAnimationFast();
      this.clearCanvas();
      this.drawMandalaOptimized(frequencyData);
    });
  }

  /**
   * Optimized animation update
   */
  private updateAnimationFast(): void {
    const currentTime = performance.now();
    if (this.lastTimestamp !== 0) {
      const deltaTime = (currentTime - this.lastTimestamp) / 1000;
      this.currentRotation += this.config.rotationSpeed * deltaTime * 0.017453; // Pre-computed PI/180
      if (this.currentRotation >= 6.283185) { // Pre-computed 2*PI
        this.currentRotation -= 6.283185;
      }
    }
    this.lastTimestamp = currentTime;
  }

  /**
   * Optimized mandala drawing using batched operations
   */
  private drawMandalaOptimized(frequencyData: Uint8Array): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const maxRadius = Math.min(this.centerX, this.centerY) * this.config.outerRadius;
    const minRadius = Math.min(this.centerX, this.centerY) * this.config.innerRadius;
    const ringWidth = (maxRadius - minRadius) / this.config.rings;

    // Set glow effect once if needed
    if (this.config.glowIntensity > 0) {
      ctx.shadowBlur = 10 * this.config.glowIntensity;
      ctx.shadowColor = this.getPrimaryColorFast();
    }

    // Draw all rings using single path approach
    this.drawAllRingsBatched(ctx, frequencyData, minRadius, ringWidth);

    // Apply symmetry effects if needed
    if (this.config.symmetryMode !== 'none') {
      this.applySymmetryOptimized(ctx);
    }

    // Reset shadow once
    if (this.config.glowIntensity > 0) {
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Draw all rings using batched operations
   */
  private drawAllRingsBatched(
    ctx: CanvasRenderingContext2D,
    frequencyData: Uint8Array,
    minRadius: number,
    ringWidth: number
  ): void {
    // Group segments by color to minimize state changes
    const colorGroups = new Map<string, Array<{segment: PrecomputedSegment, ring: number, magnitude: number}>>();

    for (let ring = 0; ring < this.config.rings; ring++) {
      const gradient = this.gradientArrays[ring % this.gradientArrays.length];
      
      for (const segment of this.segments) {
        const magnitude = (frequencyData[segment.frequencyIndex] || 0) / 255;
        const adjustedMagnitude = Math.pow(magnitude * this.config.sensitivity, 1 + this.config.pulseReactivity);
        
        const colorKey = `${ring}_${Math.floor(adjustedMagnitude * 10)}`;
        if (!colorGroups.has(colorKey)) {
          colorGroups.set(colorKey, []);
        }
        
        colorGroups.get(colorKey)!.push({ segment, ring, magnitude: adjustedMagnitude });
      }
    }

    // Render grouped segments with minimal state changes
    for (const [colorKey, segmentGroup] of colorGroups) {
      const [ringStr, magnitudeStr] = colorKey.split('_');
      const ring = parseInt(ringStr);
      const magnitude = parseFloat(magnitudeStr) / 10;
      
      const ringRadius = minRadius + (ring * ringWidth);
      const nextRingRadius = minRadius + ((ring + 1) * ringWidth);
      const segmentRadius = ringRadius + (magnitude * (nextRingRadius - ringRadius));

      // Set fill style once per group
      ctx.fillStyle = this.gradientArrays[ring % this.gradientArrays.length];
      this.renderStats.stateChanges++;

      // Create single composite path for all segments in this group
      ctx.beginPath();
      for (const { segment } of segmentGroup) {
        this.addSegmentToPath(ctx, segment, ringRadius, segmentRadius);
      }
      ctx.fill();
      this.renderStats.pathOperations++;
    }
  }

  /**
   * Add segment to current path using pre-computed coordinates
   */
  private addSegmentToPath(
    ctx: CanvasRenderingContext2D,
    segment: PrecomputedSegment,
    innerRadius: number,
    outerRadius: number
  ): void {
    const angleWithRotation = segment.angle + this.currentRotation;
    const cos = this.fastCos(angleWithRotation);
    const sin = this.fastSin(angleWithRotation);
    
    this.renderStats.trigLookups += 2;

    const angleStep = (Math.PI * 2) / this.config.segments;
    const nextAngle = angleWithRotation + angleStep;
    const nextCos = this.fastCos(nextAngle);
    const nextSin = this.fastSin(nextAngle);

    // Outer arc points
    const outerX1 = this.centerX + cos * outerRadius;
    const outerY1 = this.centerY + sin * outerRadius;
    const outerX2 = this.centerX + nextCos * outerRadius;
    const outerY2 = this.centerY + nextSin * outerRadius;

    // Inner arc points
    const innerX1 = this.centerX + cos * innerRadius;
    const innerY1 = this.centerY + sin * innerRadius;
    const innerX2 = this.centerX + nextCos * innerRadius;
    const innerY2 = this.centerY + nextSin * innerRadius;

    // Create segment path
    ctx.moveTo(innerX1, innerY1);
    ctx.lineTo(outerX1, outerY1);
    ctx.lineTo(outerX2, outerY2);
    ctx.lineTo(innerX2, innerY2);
    ctx.closePath();
  }

  /**
   * Optimized symmetry effects using mathematical transformations
   */
  private applySymmetryOptimized(ctx: CanvasRenderingContext2D): void {
    switch (this.config.symmetryMode) {
      case 'mirror-x':
        // Use transform instead of drawImage
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-this.centerX * 2, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(this.canvas!, 0, 0);
        ctx.restore();
        break;
        
      case 'radial-2x':
      case 'radial-4x':
      case 'radial-8x':
        this.applyRadialSymmetryMath(ctx);
        break;
        
      case 'kaleidoscope':
        this.applyKaleidoscopeOptimized(ctx);
        break;
    }
  }

  /**
   * Mathematical radial symmetry instead of canvas operations
   */
  private applyRadialSymmetryMath(ctx: CanvasRenderingContext2D): void {
    const divisions = this.config.symmetryMode === 'radial-2x' ? 2 : 
                     this.config.symmetryMode === 'radial-4x' ? 4 : 8;
    
    // Re-render segments with rotational offset instead of copying canvas
    const originalRotation = this.currentRotation;
    const rotationStep = (Math.PI * 2) / divisions;
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6;
    
    for (let i = 1; i < divisions; i++) {
      this.currentRotation = originalRotation + (rotationStep * i);
      // Would need frequency data here - simplified for demo
      // this.drawAllRingsBatched(ctx, lastFrequencyData, minRadius, ringWidth);
    }
    
    this.currentRotation = originalRotation;
    ctx.restore();
  }

  /**
   * Optimized kaleidoscope effect
   */
  private applyKaleidoscopeOptimized(ctx: CanvasRenderingContext2D): void {
    // Use clip regions and transforms instead of multiple drawImage calls
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    for (let i = 1; i < 6; i++) {
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate((Math.PI * 2 / 6) * i);
      ctx.scale(0.8, 0.8);
      ctx.translate(-this.centerX, -this.centerY);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(this.canvas!, 0, 0);
      ctx.restore();
    }
    
    ctx.restore();
  }

  /**
   * Get primary color efficiently
   */
  private getPrimaryColorFast(): string {
    const colors = this.colorPalettes.get(this.config.colorPalette);
    return colors ? colors.palette[Math.floor(colors.palette.length / 2)] : '#3b82f6';
  }

  /**
   * Pre-compute segment data on configuration change
   */
  private calculateSegmentsOptimized(): void {
    this.segments = [];
    const angleStep = (Math.PI * 2) / this.config.segments;
    const frequencyBinStep = this.frequencyBinCount / this.config.segments;

    for (let i = 0; i < this.config.segments; i++) {
      const angle = i * angleStep;
      const ringPositions = new Float32Array(this.config.rings);
      
      // Pre-compute ring radii
      const maxRadius = Math.min(this.centerX, this.centerY) * this.config.outerRadius;
      const minRadius = Math.min(this.centerX, this.centerY) * this.config.innerRadius;
      const ringWidth = (maxRadius - minRadius) / this.config.rings;
      
      for (let ring = 0; ring < this.config.rings; ring++) {
        ringPositions[ring] = minRadius + (ring * ringWidth);
      }

      this.segments.push({
        angle,
        cos: this.fastCos(angle),
        sin: this.fastSin(angle),
        frequencyIndex: Math.floor(i * frequencyBinStep),
        ringPositions
      });
    }

    // Pre-generate gradients
    this.generateGradientArrays();
  }

  /**
   * Generate gradient arrays instead of using Map cache
   */
  private generateGradientArrays(): void {
    if (!this.ctx) return;
    
    this.gradientArrays = [];
    const colors = this.colorPalettes.get(this.config.colorPalette);
    if (!colors) return;

    for (let ring = 0; ring < this.config.rings; ring++) {
      const gradient = this.ctx.createRadialGradient(
        this.centerX, this.centerY, 0,
        this.centerX, this.centerY, Math.min(this.centerX, this.centerY)
      );

      const colorStep = 1 / (colors.palette.length - 1);
      colors.palette.forEach((color, index) => {
        gradient.addColorStop(index * colorStep, color);
      });

      this.gradientArrays.push(gradient);
    }
  }

  /**
   * Utility: Convert hex to RGB
   */
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  /**
   * Update configuration with optimized recalculation
   */
  updateConfiguration(config: VisualizationConfig): void {
    const mandalaConfig = config as MandalaConfig;
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...mandalaConfig };

    if (config.theme !== this.theme) {
      this.setTheme(config.theme);
    }

    // Only recalculate if layout-affecting properties changed
    const needsRecalc = 
      oldConfig.segments !== this.config.segments ||
      oldConfig.rings !== this.config.rings ||
      oldConfig.innerRadius !== this.config.innerRadius ||
      oldConfig.outerRadius !== this.config.outerRadius ||
      oldConfig.colorPalette !== this.config.colorPalette;

    if (needsRecalc) {
      this.calculateSegmentsOptimized();
    }
  }

  /**
   * Update frequency bin count
   */
  updateFrequencyBinCount(binCount: number): void {
    this.frequencyBinCount = binCount;
    this.calculateSegmentsOptimized();
  }

  /**
   * Handle resize events
   */
  protected onResize(): void {
    this.calculateSegmentsOptimized();
  }

  /**
   * Handle theme changes
   */
  protected onThemeChange(): void {
    this.generateGradientArrays();
  }

  /**
   * Get performance statistics
   */
  getOptimizationStats(): {
    renderStats: typeof this.renderStats;
    memoryStats: {
      precomputedSegments: number;
      gradientArrays: number;
      trigTableSize: number;
    };
  } {
    return {
      renderStats: { ...this.renderStats },
      memoryStats: {
        precomputedSegments: this.segments.length,
        gradientArrays: this.gradientArrays.length,
        trigTableSize: OptimizedMandalaRenderer.TRIG_TABLE_SIZE
      }
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    super.dispose();
    this.segments = [];
    this.gradientArrays = [];
    this.colorPalettes.clear();
  }
}