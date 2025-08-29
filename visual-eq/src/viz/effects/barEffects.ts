/**
 * Bar Effects System - Enhanced visualization modes for frequency bars
 * Includes wave overlays, mirror effects, 3D perspective, and peak hold indicators
 */

import type { ColorMapping, ColorConfig } from '../colorMapping.ts';
import type { Theme } from '../themes.ts';

export type BarVisualMode = 'standard' | 'wave' | 'mirror' | '3d' | 'peak-hold';

export interface BarEffectConfig {
  visualMode: BarVisualMode;
  theme: Theme;
  barCount: number;
  canvasWidth: number;
  canvasHeight: number;
  sensitivity: number;
}

export interface BarLayout {
  x: number;
  width: number;
  logFreqIndex: number;
}

export interface WavePoint {
  x: number;
  y: number;
}

export class BarEffects {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  
  // Wave overlay state
  private wavePoints: WavePoint[] = [];
  private lastWaveUpdate = 0;
  
  // Peak hold state
  private peakHolds: number[] = [];
  private peakDecayRate = 0.95;
  
  // Mirror effect state
  private mirrorBuffer: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number = 1) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.dpr = dpr;
  }

  /**
   * Render bars with enhanced visual effects
   */
  renderBarsWithEffects(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    switch (config.visualMode) {
      case 'standard':
        this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);
        break;
      case 'wave':
        this.renderBarsWithWaveOverlay(frequencyData, barLayouts, colorMapping, config);
        break;
      case 'mirror':
        this.renderMirrorBars(frequencyData, barLayouts, colorMapping, config);
        break;
      case '3d':
        this.render3DBars(frequencyData, barLayouts, colorMapping, config);
        break;
      case 'peak-hold':
        this.renderPeakHoldBars(frequencyData, barLayouts, colorMapping, config);
        break;
      default:
        this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);
    }
  }

  /**
   * Render standard frequency bars (baseline implementation)
   */
  private renderStandardBars(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    const displayHeight = config.canvasHeight / this.dpr;

    for (let i = 0; i < barLayouts.length; i++) {
      const bar = barLayouts[i];
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      const normalizedHeight = freqValue / 255;
      const barHeight = normalizedHeight * displayHeight * 0.9;
      const barY = displayHeight - barHeight;

      // Get color and render
      const barColor = colorMapping.getBarColor(config, i, freqValue);
      this.ctx.fillStyle = barColor.fill;
      if (barColor.alpha !== undefined) {
        this.ctx.globalAlpha = barColor.alpha;
      }

      this.ctx.fillRect(bar.x, barY, bar.width, barHeight);

      if (barColor.alpha !== undefined) {
        this.ctx.globalAlpha = 1.0;
      }
    }
  }

  /**
   * Render bars with smooth wave overlay
   */
  private renderBarsWithWaveOverlay(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    // First render standard bars with reduced opacity
    this.ctx.globalAlpha = 0.7;
    this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);
    this.ctx.globalAlpha = 1.0;

    // Create wave overlay
    this.createWaveOverlay(frequencyData, barLayouts, config);
  }

  /**
   * Create smooth wave overlay from frequency data
   */
  private createWaveOverlay(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    config: BarEffectConfig
  ): void {
    if (barLayouts.length === 0) return;

    const displayHeight = config.canvasHeight / this.dpr;
    const now = performance.now();
    
    // Update wave points (smooth interpolation)
    this.wavePoints = [];
    for (let i = 0; i < barLayouts.length; i++) {
      const bar = barLayouts[i];
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      const normalizedHeight = freqValue / 255;
      const waveY = displayHeight - (normalizedHeight * displayHeight * 0.9);
      
      this.wavePoints.push({
        x: bar.x + bar.width / 2,
        y: waveY
      });
    }

    // Draw smooth wave line
    if (this.wavePoints.length > 1) {
      this.ctx.strokeStyle = config.theme === 'dark' ? '#00ff94' : '#2563eb';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(this.wavePoints[0].x, this.wavePoints[0].y);
      
      // Use quadratic curves for smooth interpolation
      for (let i = 1; i < this.wavePoints.length - 1; i++) {
        const cpx = (this.wavePoints[i].x + this.wavePoints[i + 1].x) / 2;
        const cpy = (this.wavePoints[i].y + this.wavePoints[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(this.wavePoints[i].x, this.wavePoints[i].y, cpx, cpy);
      }
      
      // Connect to last point
      const lastPoint = this.wavePoints[this.wavePoints.length - 1];
      this.ctx.lineTo(lastPoint.x, lastPoint.y);
      this.ctx.stroke();

      // Add glow effect
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = this.ctx.strokeStyle as string;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    this.lastWaveUpdate = now;
  }

  /**
   * Render bars with mirror effect
   */
  private renderMirrorBars(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    const displayHeight = config.canvasHeight / this.dpr;
    
    // Render top half normally
    this.ctx.save();
    this.ctx.rect(0, 0, config.canvasWidth, displayHeight / 2);
    this.ctx.clip();
    this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);
    this.ctx.restore();

    // Render bottom half mirrored with fade
    this.ctx.save();
    this.ctx.translate(0, displayHeight);
    this.ctx.scale(1, -1);
    this.ctx.rect(0, 0, config.canvasWidth, displayHeight / 2);
    this.ctx.clip();
    
    // Create gradient for fade effect
    const gradient = this.ctx.createLinearGradient(0, 0, 0, displayHeight / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.globalCompositeOperation = 'multiply';
    this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);
    
    // Apply fade gradient
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, config.canvasWidth, displayHeight / 2);
    
    this.ctx.restore();
  }

  /**
   * Render bars with 3D perspective effect
   */
  private render3DBars(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    const displayHeight = config.canvasHeight / this.dpr;
    const perspective = 0.3; // Perspective strength
    
    for (let i = 0; i < barLayouts.length; i++) {
      const bar = barLayouts[i];
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      const normalizedHeight = freqValue / 255;
      const barHeight = normalizedHeight * displayHeight * 0.9;
      
      // Calculate 3D perspective offset
      const depth = normalizedHeight * 20; // Max 20px depth
      const offsetX = depth * perspective;
      const offsetY = depth * perspective;
      
      // Get color
      const barColor = colorMapping.getBarColor(config, i, freqValue);
      
      // Draw shadow/depth face
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(
        bar.x + offsetX, 
        displayHeight - barHeight + offsetY, 
        bar.width, 
        barHeight
      );
      
      // Draw main bar face
      this.ctx.fillStyle = barColor.fill;
      if (barColor.alpha !== undefined) {
        this.ctx.globalAlpha = barColor.alpha;
      }
      this.ctx.fillRect(bar.x, displayHeight - barHeight, bar.width, barHeight);
      
      // Draw top face for more 3D effect
      if (barHeight > 5) {
        this.ctx.beginPath();
        this.ctx.moveTo(bar.x, displayHeight - barHeight);
        this.ctx.lineTo(bar.x + bar.width, displayHeight - barHeight);
        this.ctx.lineTo(bar.x + bar.width + offsetX, displayHeight - barHeight + offsetY);
        this.ctx.lineTo(bar.x + offsetX, displayHeight - barHeight + offsetY);
        this.ctx.closePath();
        
        // Lighter color for top face
        const lightColor = this.adjustBrightness(barColor.fill, 1.2);
        this.ctx.fillStyle = lightColor;
        this.ctx.fill();
      }
      
      // Draw right face
      if (barHeight > 5) {
        this.ctx.beginPath();
        this.ctx.moveTo(bar.x + bar.width, displayHeight);
        this.ctx.lineTo(bar.x + bar.width, displayHeight - barHeight);
        this.ctx.lineTo(bar.x + bar.width + offsetX, displayHeight - barHeight + offsetY);
        this.ctx.lineTo(bar.x + bar.width + offsetX, displayHeight + offsetY);
        this.ctx.closePath();
        
        // Darker color for side face
        const darkColor = this.adjustBrightness(barColor.fill, 0.7);
        this.ctx.fillStyle = darkColor;
        this.ctx.fill();
      }
      
      if (barColor.alpha !== undefined) {
        this.ctx.globalAlpha = 1.0;
      }
    }
  }

  /**
   * Render bars with peak hold indicators
   */
  private renderPeakHoldBars(
    frequencyData: Uint8Array,
    barLayouts: BarLayout[],
    colorMapping: ColorMapping,
    config: BarEffectConfig & ColorConfig
  ): void {
    const displayHeight = config.canvasHeight / this.dpr;
    
    // Initialize peak holds if needed
    if (this.peakHolds.length !== barLayouts.length) {
      this.peakHolds = new Array(barLayouts.length).fill(0);
    }

    // Render standard bars first
    this.renderStandardBars(frequencyData, barLayouts, colorMapping, config);

    // Update and render peak holds
    for (let i = 0; i < barLayouts.length; i++) {
      const bar = barLayouts[i];
      const freqValue = frequencyData[bar.logFreqIndex] || 0;
      const normalizedHeight = freqValue / 255;
      const currentHeight = normalizedHeight * displayHeight * 0.9;
      
      // Update peak hold
      if (currentHeight > this.peakHolds[i]) {
        this.peakHolds[i] = currentHeight;
      } else {
        this.peakHolds[i] *= this.peakDecayRate; // Decay
      }
      
      // Draw peak hold indicator
      if (this.peakHolds[i] > 5) {
        const peakY = displayHeight - this.peakHolds[i];
        this.ctx.fillStyle = config.theme === 'dark' ? '#ffffff' : '#000000';
        this.ctx.fillRect(bar.x, peakY - 2, bar.width, 2);
      }
    }
  }

  /**
   * Adjust color brightness for 3D effects
   */
  private adjustBrightness(color: string | CanvasGradient, factor: number): string {
    if (typeof color !== 'string') return '#ffffff';
    
    // Simple brightness adjustment for solid colors
    // In a full implementation, you'd properly parse and adjust the color
    if (factor > 1) {
      return color.replace(/rgba?\(([^)]+)\)/, (match, values) => {
        const parts = values.split(',').map((v: string) => parseInt(v.trim()));
        return `rgb(${Math.min(255, Math.round(parts[0] * factor))}, ${Math.min(255, Math.round(parts[1] * factor))}, ${Math.min(255, Math.round(parts[2] * factor))})`;
      });
    } else {
      return color.replace(/rgba?\(([^)]+)\)/, (match, values) => {
        const parts = values.split(',').map((v: string) => parseInt(v.trim()));
        return `rgb(${Math.round(parts[0] * factor)}, ${Math.round(parts[1] * factor)}, ${Math.round(parts[2] * factor)})`;
      });
    }
  }

  /**
   * Clear peak hold values (useful when switching modes or restarting)
   */
  clearPeakHolds(): void {
    this.peakHolds = [];
  }

  /**
   * Set peak decay rate (0-1, where 1 = no decay, 0 = instant decay)
   */
  setPeakDecayRate(rate: number): void {
    this.peakDecayRate = Math.max(0.8, Math.min(0.99, rate));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.wavePoints = [];
    this.peakHolds = [];
    this.mirrorBuffer = null;
  }
}