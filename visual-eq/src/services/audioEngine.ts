import type { 
  AudioContextState, 
  AudioVisualizerError, 
  Result, 
  AudioProcessingConfig,
  PerformanceMetrics 
} from '../types/audio';
import { 
  DEFAULT_AUDIO_CONFIG, 
  MOBILE_AUDIO_CONFIG, 
  BROWSER_SUPPORT,
  DEVICE_DETECTION,
  AUDIO_CONTEXT_PRESETS,
  PERFORMANCE_BUDGETS 
} from '../constants/audio';

interface AudioEngineEventHandlers {
  onStateChange?: (state: AudioContextState) => void;
  onError?: (error: AudioVisualizerError) => void;
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
  onUserGestureRequired?: () => void;
}

class AudioEngine {
  private static instance: AudioEngine | null = null;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private userGestureReceived = false;
  private eventHandlers: AudioEngineEventHandlers = {};
  private performanceMonitor: PerformanceMonitor;
  private cleanupCallbacks: (() => void)[] = [];

  private constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.setupEventListeners();
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // Initialize audio engine with optimal configuration
  async initialize(config?: Partial<AudioProcessingConfig>): Promise<Result<AudioContext>> {
    try {
      // Check browser compatibility
      const compatibilityResult = this.checkBrowserCompatibility();
      if (!compatibilityResult.success) {
        return compatibilityResult;
      }

      // Determine optimal configuration based on device
      const audioConfig = this.getOptimalConfiguration(config);
      
      // Create AudioContext with optimal settings
      const contextResult = await this.createAudioContext(audioConfig);
      if (!contextResult.success) {
        return contextResult;
      }

      this.audioContext = contextResult.data;
      this.isInitialized = true;

      // Handle iOS Safari autoplay restrictions
      if (this.requiresUserGesture()) {
        this.eventHandlers.onUserGestureRequired?.();
        return { success: false, error: this.createSuspendedContextError() };
      }

      // Resume context if suspended (common on mobile)
      await this.resumeContextIfNeeded();

      // Start performance monitoring
      this.performanceMonitor.start();

      this.eventHandlers.onStateChange?.(this.audioContext.state);
      
      return { success: true, data: this.audioContext };

    } catch (error) {
      const audioError = this.createInitializationError(error);
      this.eventHandlers.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  // Get current AudioContext (throws if not initialized)
  getContext(): AudioContext {
    if (!this.audioContext || !this.isInitialized) {
      throw new Error('AudioEngine not initialized. Call initialize() first.');
    }
    return this.audioContext;
  }

  // Check if engine is ready for audio processing
  isReady(): boolean {
    return this.isInitialized && 
           this.audioContext !== null && 
           this.audioContext.state === 'running';
  }

  // Handle user gesture to unlock audio context (iOS Safari)
  async handleUserGesture(): Promise<Result<void>> {
    try {
      this.userGestureReceived = true;

      if (!this.audioContext) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return { success: false, error: initResult.error };
        }
      }

      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
        this.eventHandlers.onStateChange?.(this.audioContext.state);
      }

      return { success: true, data: undefined };

    } catch (error) {
      const audioError = this.createGestureHandlingError(error);
      this.eventHandlers.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  // Set event handlers for audio engine events
  setEventHandlers(handlers: AudioEngineEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Get current performance metrics
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  // Dispose of audio engine and clean up resources
  dispose(): void {
    try {
      // Stop performance monitoring
      this.performanceMonitor.stop();

      // Run cleanup callbacks
      this.cleanupCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.warn('Error in cleanup callback:', error);
        }
      });
      this.cleanupCallbacks = [];

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }

      // Clean up event listeners
      this.removeEventListeners();

      // Reset state
      this.audioContext = null;
      this.isInitialized = false;
      this.userGestureReceived = false;
      this.eventHandlers = {};

    } catch (error) {
      console.warn('Error during AudioEngine disposal:', error);
    }
  }

  // Add cleanup callback to be executed on dispose
  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  // Private methods

  private checkBrowserCompatibility(): Result<void> {
    const missingFeatures: string[] = [];

    // Check required features
    BROWSER_SUPPORT.REQUIRED_FEATURES.forEach(feature => {
      if (!this.isFeatureSupported(feature)) {
        missingFeatures.push(feature);
      }
    });

    if (missingFeatures.length > 0) {
      return {
        success: false,
        error: {
          type: 'browser_incompatible',
          feature: missingFeatures.join(', '),
          alternatives: ['Chrome 66+', 'Firefox 60+', 'Safari 11.1+', 'Edge 79+'],
          message: `Browser missing features: ${missingFeatures.join(', ')}`,
          canRetry: false
        }
      };
    }

    return { success: true, data: undefined };
  }

  private isFeatureSupported(feature: string): boolean {
    switch (feature) {
      case 'AudioContext':
        return typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
      case 'AnalyserNode':
        return typeof AnalyserNode !== 'undefined';
      case 'Canvas':
        return typeof HTMLCanvasElement !== 'undefined';
      case 'RequestAnimationFrame':
        return typeof requestAnimationFrame !== 'undefined';
      default:
        return false;
    }
  }

  private getOptimalConfiguration(userConfig?: Partial<AudioProcessingConfig>): AudioProcessingConfig {
    const isMobile = this.isMobileDevice();
    const baseConfig = isMobile ? MOBILE_AUDIO_CONFIG : DEFAULT_AUDIO_CONFIG;
    
    return {
      ...baseConfig,
      ...userConfig
    };
  }

  private async createAudioContext(_config: AudioProcessingConfig): Promise<Result<AudioContext>> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        return {
          success: false,
          error: {
            type: 'browser_incompatible',
            feature: 'AudioContext',
            alternatives: ['Update your browser to support Web Audio API'],
            message: 'AudioContext not supported in this browser',
            canRetry: false
          }
        };
      }

      // Determine optimal context settings
      const contextOptions = this.getContextOptions();
      
      const audioContext = new AudioContextClass(contextOptions);
      
      return { success: true, data: audioContext };

    } catch (error) {
      return {
        success: false,
        error: this.createInitializationError(error)
      };
    }
  }

  private getContextOptions(): AudioContextOptions {
    const isMobile = this.isMobileDevice();
    
    if (isMobile) {
      return AUDIO_CONTEXT_PRESETS.POWER_SAVING;
    } else if (this.isLowLatencyRequired()) {
      return AUDIO_CONTEXT_PRESETS.LOW_LATENCY;
    } else {
      return AUDIO_CONTEXT_PRESETS.BALANCED;
    }
  }

  private requiresUserGesture(): boolean {
    const isiOS = DEVICE_DETECTION.IOS_USER_AGENT.test(navigator.userAgent);
    const isSafari = DEVICE_DETECTION.SAFARI_USER_AGENT.test(navigator.userAgent);
    const isChromeMobile = DEVICE_DETECTION.CHROME_MOBILE_USER_AGENT.test(navigator.userAgent);
    
    // iOS Safari always requires user gesture
    if (isiOS && isSafari) {
      return !this.userGestureReceived;
    }
    
    // Chrome mobile has autoplay policy
    if (isChromeMobile) {
      return !this.userGestureReceived && this.audioContext?.state === 'suspended';
    }
    
    return false;
  }

  private async resumeContextIfNeeded(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  private isMobileDevice(): boolean {
    return DEVICE_DETECTION.MOBILE_USER_AGENTS.some(regex => regex.test(navigator.userAgent));
  }

  private isLowLatencyRequired(): boolean {
    // Check if this is a real-time application requiring low latency
    // For visualizer, balanced is usually sufficient
    return false;
  }

  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Handle beforeunload for cleanup
    window.addEventListener('beforeunload', this.dispose.bind(this));
  }

  private removeEventListeners(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('beforeunload', this.dispose.bind(this));
  }

  private handleVisibilityChange(): void {
    if (document.hidden && this.audioContext?.state === 'running') {
      // Suspend context when page is hidden to save battery
      this.audioContext.suspend().catch(error => {
        console.warn('Failed to suspend audio context:', error);
      });
    }
  }

  // Error creation helpers
  private createInitializationError(error: unknown): AudioVisualizerError {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'audio_context_failed',
      reason,
      message: reason,
      canRetry: true
    };
  }

  private createSuspendedContextError(): AudioVisualizerError {
    const reason = 'AudioContext is suspended. User interaction required.';
    return {
      type: 'audio_context_failed',
      reason,
      message: reason,
      canRetry: true
    };
  }

  private createGestureHandlingError(error: unknown): AudioVisualizerError {
    const reason = `Failed to handle user gesture: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return {
      type: 'audio_context_failed',
      reason,
      message: reason,
      canRetry: true
    };
  }
}

// Performance monitoring class
class PerformanceMonitor {
  private isRunning = false;
  private startTime = 0;
  private frameCount = 0;
  private lastFrameTime = 0;
  private performanceData: PerformanceMetrics = {
    frameRate: 0,
    audioLatency: 0,
    renderTime: 0,
    memoryUsage: 0,
    droppedFrames: 0,
    averageFrameTime: 0
  };

  start(): void {
    this.isRunning = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastFrameTime = this.startTime;
    this.updateMetrics();
  }

  stop(): void {
    this.isRunning = false;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.performanceData };
  }

  private updateMetrics(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    this.frameCount++;
    this.lastFrameTime = currentTime;

    // Calculate frame rate
    const elapsedTime = currentTime - this.startTime;
    const fps = (this.frameCount / elapsedTime) * 1000;

    // Update performance data
    this.performanceData = {
      frameRate: Math.round(fps * 10) / 10,
      audioLatency: this.estimateAudioLatency(),
      renderTime: deltaTime,
      memoryUsage: this.estimateMemoryUsage(),
      droppedFrames: this.calculateDroppedFrames(deltaTime),
      averageFrameTime: elapsedTime / this.frameCount
    };

    // Continue monitoring
    setTimeout(() => this.updateMetrics(), 100);
  }

  private estimateAudioLatency(): number {
    // Simplified latency estimation
    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.isReady()) {
      const context = audioEngine.getContext();
      return (context.baseLatency + context.outputLatency) * 1000;
    }
    return 0;
  }

  private estimateMemoryUsage(): number {
    // Simplified memory estimation
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  private calculateDroppedFrames(deltaTime: number): number {
    const targetFrameTime = 1000 / PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP;
    return deltaTime > targetFrameTime * 1.5 ? 1 : 0;
  }
}

// Export singleton instance
export const audioEngine = AudioEngine.getInstance();