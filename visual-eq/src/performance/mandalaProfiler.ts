/**
 * Mandala Renderer Performance Profiler
 * Analyzes and benchmarks various aspects of the MandalaRenderer
 */

import { MandalaRenderer } from '../viz/mandalaRenderer.ts';
import type { MandalaConfig } from '../viz/visualizationMode.ts';

export interface PerformanceMetrics {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  averageFrameTime: number;
  maxFrameTime: number;
  totalFrames: number;
  droppedFrames: number;
  renderBudgetViolations: number;
}

export interface BottleneckAnalysis {
  polarCalculations: number;
  gradientGeneration: number;
  canvasOperations: number;
  symmetryEffects: number;
  total: number;
}

export interface ConfigurationTestResult {
  config: Partial<MandalaConfig>;
  metrics: PerformanceMetrics;
  bottlenecks: BottleneckAnalysis;
  isPerformant: boolean;
}

export class MandalaProfiler {
  private canvas: HTMLCanvasElement;
  private renderer: MandalaRenderer;
  private mockFrequencyData: Uint8Array;
  
  // Performance tracking
  private frameTimings: number[] = [];
  private renderStartTime = 0;
  private profileData = {
    polarCalcs: 0,
    gradientOps: 0,
    canvasOps: 0,
    symmetryOps: 0
  };

  constructor(canvasWidth = 800, canvasHeight = 600) {
    // Create offscreen canvas for testing
    this.canvas = new OffscreenCanvas(canvasWidth, canvasHeight) as any;
    this.renderer = new MandalaRenderer();
    this.renderer.initialize(this.canvas as any);
    
    // Generate realistic frequency data
    this.generateMockFrequencyData();
  }

  /**
   * Generate mock frequency data that simulates real audio
   */
  private generateMockFrequencyData(): void {
    this.mockFrequencyData = new Uint8Array(1024);
    for (let i = 0; i < this.mockFrequencyData.length; i++) {
      // Simulate typical frequency spectrum with decay
      const baseLevel = 100;
      const decay = Math.exp(-i / 200);
      const noise = Math.random() * 50;
      const bass = i < 50 ? Math.sin(Date.now() / 200) * 100 : 0;
      
      this.mockFrequencyData[i] = Math.min(255, Math.max(0, 
        baseLevel * decay + noise + bass
      ));
    }
  }

  /**
   * Profile performance with different configurations
   */
  async profileConfigurations(): Promise<ConfigurationTestResult[]> {
    const configurations: Partial<MandalaConfig>[] = [
      // Lightweight configurations
      { segments: 8, rings: 3, symmetryMode: 'none' },
      { segments: 16, rings: 3, symmetryMode: 'none' },
      
      // Medium configurations
      { segments: 24, rings: 4, symmetryMode: 'none' },
      { segments: 32, rings: 4, symmetryMode: 'none' },
      { segments: 32, rings: 4, symmetryMode: 'mirror-x' },
      
      // High complexity configurations
      { segments: 48, rings: 5, symmetryMode: 'none' },
      { segments: 48, rings: 5, symmetryMode: 'radial-4x' },
      
      // Maximum complexity configurations
      { segments: 64, rings: 6, symmetryMode: 'none' },
      { segments: 64, rings: 6, symmetryMode: 'radial-8x' },
      { segments: 64, rings: 8, symmetryMode: 'kaleidoscope' }
    ];

    const results: ConfigurationTestResult[] = [];

    for (const config of configurations) {
      console.log(`Testing configuration: ${config.segments}s/${config.rings}r/${config.symmetryMode}`);
      
      // Apply configuration
      this.renderer.updateConfiguration({
        mode: 'mandala',
        theme: 'dark',
        sensitivity: 1.0,
        ...config
      } as any);

      // Run performance test
      const metrics = await this.runPerformanceTest(2000); // 2 second test
      const bottlenecks = this.analyzeBottlenecks();

      results.push({
        config,
        metrics,
        bottlenecks,
        isPerformant: metrics.averageFPS >= 55 && metrics.renderBudgetViolations < metrics.totalFrames * 0.05
      });

      // Allow browser to breathe between tests
      await this.sleep(100);
    }

    return results;
  }

  /**
   * Run performance test for specified duration
   */
  private async runPerformanceTest(durationMs: number): Promise<PerformanceMetrics> {
    this.frameTimings = [];
    const startTime = Date.now();
    let totalFrames = 0;
    let droppedFrames = 0;
    let budgetViolations = 0;
    const renderBudget = 16.67; // 60fps = 16.67ms per frame

    while (Date.now() - startTime < durationMs) {
      const frameStart = performance.now();
      
      // Generate fresh frequency data
      this.generateMockFrequencyData();
      
      // Render frame
      this.renderer.render(this.mockFrequencyData);
      
      const frameTime = performance.now() - frameStart;
      this.frameTimings.push(frameTime);
      
      totalFrames++;
      if (frameTime > renderBudget) {
        budgetViolations++;
        if (frameTime > renderBudget * 2) {
          droppedFrames++;
        }
      }

      // Simulate 60fps timing
      await new Promise(resolve => setTimeout(resolve, Math.max(0, renderBudget - frameTime)));
    }

    return this.calculateMetrics(totalFrames, droppedFrames, budgetViolations);
  }

  /**
   * Calculate performance metrics from frame timings
   */
  private calculateMetrics(totalFrames: number, droppedFrames: number, budgetViolations: number): PerformanceMetrics {
    if (this.frameTimings.length === 0) {
      return {
        averageFPS: 0, minFPS: 0, maxFPS: 0,
        averageFrameTime: 0, maxFrameTime: 0,
        totalFrames, droppedFrames, renderBudgetViolations: budgetViolations
      };
    }

    const avgFrameTime = this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length;
    const maxFrameTime = Math.max(...this.frameTimings);
    const minFrameTime = Math.min(...this.frameTimings);

    return {
      averageFPS: 1000 / avgFrameTime,
      minFPS: 1000 / maxFrameTime,
      maxFPS: 1000 / minFrameTime,
      averageFrameTime: avgFrameTime,
      maxFrameTime,
      totalFrames,
      droppedFrames,
      renderBudgetViolations: budgetViolations
    };
  }

  /**
   * Analyze performance bottlenecks by profiling specific operations
   */
  private analyzeBottlenecks(): BottleneckAnalysis {
    const iterations = 1000;
    const segments = 32;
    const rings = 4;

    // Profile polar coordinate calculations
    const polarStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = cos * 100;
        const y = sin * 100;
      }
    }
    const polarTime = performance.now() - polarStart;

    // Profile gradient generation
    const gradientStart = performance.now();
    const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    for (let i = 0; i < iterations / 10; i++) {
      const gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 50);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.5, '#00ff00');
      gradient.addColorStop(1, '#0000ff');
    }
    const gradientTime = performance.now() - gradientStart;

    // Profile canvas operations (arcs and fills)
    const canvasStart = performance.now();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < iterations / 5; i++) {
      ctx.beginPath();
      for (let s = 0; s < segments / 4; s++) {
        const angle = (s / segments) * Math.PI * 2;
        ctx.arc(100, 100, 50, angle, angle + 0.1);
      }
      ctx.fill();
    }
    const canvasTime = performance.now() - canvasStart;

    // Profile symmetry operations (canvas copy operations)
    const symmetryStart = performance.now();
    for (let i = 0; i < iterations / 20; i++) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-200, 0);
      ctx.drawImage(this.canvas as any, 0, 0);
      ctx.restore();
    }
    const symmetryTime = performance.now() - symmetryStart;

    return {
      polarCalculations: polarTime,
      gradientGeneration: gradientTime,
      canvasOperations: canvasTime,
      symmetryEffects: symmetryTime,
      total: polarTime + gradientTime + canvasTime + symmetryTime
    };
  }

  /**
   * Test adaptive quality scaling
   */
  async testAdaptiveQuality(targetFPS = 60): Promise<{
    originalConfig: Partial<MandalaConfig>;
    adaptedConfig: Partial<MandalaConfig>;
    originalMetrics: PerformanceMetrics;
    adaptedMetrics: PerformanceMetrics;
    improvement: number;
  }> {
    // Start with high complexity configuration
    const originalConfig = {
      segments: 64,
      rings: 8,
      symmetryMode: 'kaleidoscope' as any
    };

    this.renderer.updateConfiguration({
      mode: 'mandala',
      theme: 'dark',
      sensitivity: 1.0,
      ...originalConfig
    } as any);

    const originalMetrics = await this.runPerformanceTest(3000);

    // Adapt configuration if performance is poor
    let adaptedConfig = { ...originalConfig };
    
    if (originalMetrics.averageFPS < targetFPS) {
      // Reduce complexity step by step
      if (originalConfig.symmetryMode !== 'none') {
        adaptedConfig.symmetryMode = 'none' as any;
      }
      
      if (originalMetrics.averageFPS < targetFPS * 0.8) {
        adaptedConfig.rings = Math.max(3, Math.floor(adaptedConfig.rings! * 0.75));
      }
      
      if (originalMetrics.averageFPS < targetFPS * 0.6) {
        adaptedConfig.segments = Math.max(16, Math.floor(adaptedConfig.segments! * 0.75));
      }
    }

    // Test adapted configuration
    this.renderer.updateConfiguration({
      mode: 'mandala',
      theme: 'dark',
      sensitivity: 1.0,
      ...adaptedConfig
    } as any);

    const adaptedMetrics = await this.runPerformanceTest(3000);
    const improvement = ((adaptedMetrics.averageFPS - originalMetrics.averageFPS) / originalMetrics.averageFPS) * 100;

    return {
      originalConfig,
      adaptedConfig,
      originalMetrics,
      adaptedMetrics,
      improvement
    };
  }

  /**
   * Test mode transition performance
   */
  async testModeTransitions(transitionCount = 10): Promise<{
    transitionTimes: number[];
    averageTransitionTime: number;
    frameDuringTransition: number[];
    performanceImpact: number;
  }> {
    const transitionTimes: number[] = [];
    const framesDuringTransition: number[] = [];

    const configs = [
      { segments: 16, rings: 3, symmetryMode: 'none' },
      { segments: 32, rings: 4, symmetryMode: 'mirror-x' },
      { segments: 48, rings: 5, symmetryMode: 'radial-4x' },
      { segments: 24, rings: 6, symmetryMode: 'kaleidoscope' }
    ];

    for (let i = 0; i < transitionCount; i++) {
      const config = configs[i % configs.length];
      
      const transitionStart = performance.now();
      
      this.renderer.updateConfiguration({
        mode: 'mandala',
        theme: 'dark',
        sensitivity: 1.0,
        ...config
      } as any);

      const transitionTime = performance.now() - transitionStart;
      transitionTimes.push(transitionTime);

      // Measure performance in first few frames after transition
      const frameTimings: number[] = [];
      for (let frame = 0; frame < 5; frame++) {
        const frameStart = performance.now();
        this.generateMockFrequencyData();
        this.renderer.render(this.mockFrequencyData);
        frameTimings.push(performance.now() - frameStart);
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      framesDuringTransition.push(...frameTimings);
      await this.sleep(100);
    }

    const averageTransitionTime = transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length;
    const averageFrameTime = framesDuringTransition.reduce((a, b) => a + b, 0) / framesDuringTransition.length;
    const baselineFrameTime = 16.67; // 60fps
    const performanceImpact = ((averageFrameTime - baselineFrameTime) / baselineFrameTime) * 100;

    return {
      transitionTimes,
      averageTransitionTime,
      frameDuringTransition: framesDuringTransition,
      performanceImpact
    };
  }

  /**
   * Identify optimization opportunities
   */
  identifyOptimizations(results: ConfigurationTestResult[]): {
    recommendations: string[];
    precomputeOpportunities: string[];
    cachingImprovements: string[];
    algorithmicChanges: string[];
  } {
    const recommendations: string[] = [];
    const precomputeOpportunities: string[] = [];
    const cachingImprovements: string[] = [];
    const algorithmicChanges: string[] = [];

    // Analyze polar coordinate performance
    const avgPolarTime = results.reduce((sum, r) => sum + r.bottlenecks.polarCalculations, 0) / results.length;
    if (avgPolarTime > 5) {
      precomputeOpportunities.push('Pre-compute sin/cos lookup tables for common angles');
      precomputeOpportunities.push('Cache polar coordinates for static segment positions');
    }

    // Analyze gradient performance
    const avgGradientTime = results.reduce((sum, r) => sum + r.bottlenecks.gradientGeneration, 0) / results.length;
    if (avgGradientTime > 2) {
      cachingImprovements.push('Implement gradient caching with cache invalidation');
      cachingImprovements.push('Pre-generate gradients for common color palettes');
    }

    // Analyze canvas operation performance
    const avgCanvasTime = results.reduce((sum, r) => sum + r.bottlenecks.canvasOperations, 0) / results.length;
    if (avgCanvasTime > 10) {
      algorithmicChanges.push('Batch canvas operations to minimize state changes');
      algorithmicChanges.push('Use single path for multiple segments instead of individual arcs');
      algorithmicChanges.push('Implement dirty rectangle rendering for partial updates');
    }

    // Analyze symmetry performance
    const avgSymmetryTime = results.reduce((sum, r) => sum + r.bottlenecks.symmetryEffects, 0) / results.length;
    if (avgSymmetryTime > 5) {
      algorithmicChanges.push('Implement symmetry during drawing instead of post-processing');
      algorithmicChanges.push('Use CSS transforms for simple symmetry operations');
    }

    // General recommendations based on performance results
    const poorPerformanceConfigs = results.filter(r => !r.isPerformant);
    if (poorPerformanceConfigs.length > results.length * 0.3) {
      recommendations.push('Implement adaptive quality scaling based on frame rate');
      recommendations.push('Add performance budget enforcement with graceful degradation');
      recommendations.push('Consider WebGL implementation for complex configurations');
    }

    const highComplexityConfigs = results.filter(r => 
      (r.config.segments || 0) > 48 || (r.config.rings || 0) > 6
    );
    if (highComplexityConfigs.some(r => !r.isPerformant)) {
      recommendations.push('Limit maximum complexity based on device capabilities');
      recommendations.push('Implement progressive rendering for high complexity scenes');
    }

    return {
      recommendations,
      precomputeOpportunities,
      cachingImprovements,
      algorithmicChanges
    };
  }

  /**
   * Utility method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.renderer.dispose();
  }
}