import type { 
  FrequencyData, 
  TimeData, 
  AudioVisualizerError, 
  Result,
  VisualizationFrameData,
  AudioProcessingConfig 
} from '../types/audio';
import { audioEngine } from './audioEngine';
import { 
  DEFAULT_AUDIO_CONFIG, 
  VISUALIZATION_CONTROLS,
  PERFORMANCE_BUDGETS,
  FFT_SIZES 
} from '../constants/audio';

interface AudioAnalyzerConfig extends AudioProcessingConfig {
  sensitivity: number;
  smoothing: number;
  barCount: number;
  enablePeakDetection: boolean;
  enableFrameRateAdaptation: boolean;
}

interface AudioAnalyzerEventHandlers {
  onDataUpdate?: (frameData: VisualizationFrameData) => void;
  onError?: (error: AudioVisualizerError) => void;
  onPerformanceWarning?: (fps: number) => void;
}

export class AudioAnalyzer {
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: AudioNode | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;
  
  // Memory-efficient reused buffers (critical for 60fps)
  private frequencyDataBuffer: Uint8Array | null = null;
  private timeDataBuffer: Uint8Array | null = null;
  private smoothedFrequencyBuffer: Float32Array | null = null;
  
  // Performance monitoring
  private frameCount = 0;
  private lastFrameTime = 0;
  private averageFrameTime = 0;
  private droppedFrames = 0;
  
  // Configuration
  private config: AudioAnalyzerConfig;
  private eventHandlers: AudioAnalyzerEventHandlers = {};
  
  // Peak detection state
  private peakValues: Float32Array | null = null;
  private peakDecayRate = 0.95;

  constructor(config: Partial<AudioAnalyzerConfig> = {}) {
    this.config = {
      ...DEFAULT_AUDIO_CONFIG,
      sensitivity: VISUALIZATION_CONTROLS.SENSITIVITY.DEFAULT,
      smoothing: VISUALIZATION_CONTROLS.SMOOTHING.DEFAULT,
      barCount: VISUALIZATION_CONTROLS.BAR_COUNT.DEFAULT,
      enablePeakDetection: true,
      enableFrameRateAdaptation: true,
      ...config
    };
  }

  // Initialize analyzer with audio source
  async initialize(sourceNode: AudioNode): Promise<Result<void>> {
    try {
      const audioContext = audioEngine.getContext();
      
      // Create and configure analyser node
      const analyserResult = this.createAnalyserNode(audioContext);
      if (!analyserResult.success) {
        return analyserResult;
      }

      this.analyserNode = analyserResult.data;
      this.sourceNode = sourceNode;

      // Connect audio source to analyser
      sourceNode.connect(this.analyserNode);

      // Initialize buffers with optimal sizes
      this.initializeBuffers();

      return { success: true, data: undefined };

    } catch (error) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Failed to initialize audio analyzer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: `Audio analyzer initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };
      
      this.eventHandlers.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  // Start real-time analysis with performance optimization
  startAnalysis(): void {
    if (!this.analyserNode || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    
    // Start the high-performance analysis loop
    this.analysisLoop();
  }

  // Stop analysis and clean up
  stopAnalysis(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Update configuration (hot-swappable)
  updateConfig(newConfig: Partial<AudioAnalyzerConfig>): void {
    const previousConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Reinitialize if critical parameters changed
    if (
      previousConfig.fftSize !== this.config.fftSize ||
      previousConfig.barCount !== this.config.barCount
    ) {
      this.reinitialize();
    }

    // Update analyser node properties
    if (this.analyserNode) {
      this.analyserNode.fftSize = this.config.fftSize;
      this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
      this.analyserNode.minDecibels = this.config.minDecibels;
      this.analyserNode.maxDecibels = this.config.maxDecibels;
    }
  }

  // Get current frequency data (zero-copy when possible)
  getFrequencyData(): FrequencyData | null {
    if (!this.analyserNode || !this.frequencyDataBuffer) {
      return null;
    }

    this.analyserNode.getByteFrequencyData(this.frequencyDataBuffer);
    return this.frequencyDataBuffer as FrequencyData;
  }

  // Get current time domain data
  getTimeData(): TimeData | null {
    if (!this.analyserNode || !this.timeDataBuffer) {
      return null;
    }

    this.analyserNode.getByteTimeDomainData(this.timeDataBuffer);
    return this.timeDataBuffer as TimeData;
  }

  // Get smoothed and processed frequency data for visualization
  getProcessedFrequencyData(): Float32Array | null {
    if (!this.analyserNode || !this.frequencyDataBuffer || !this.smoothedFrequencyBuffer) {
      return null;
    }

    // Get raw frequency data
    this.analyserNode.getByteFrequencyData(this.frequencyDataBuffer);

    // Apply sensitivity and logarithmic scaling
    this.processFrequencyData();

    return this.smoothedFrequencyBuffer;
  }

  // Set event handlers
  setEventHandlers(handlers: AudioAnalyzerEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      frameRate: this.calculateFrameRate(),
      averageFrameTime: this.averageFrameTime,
      droppedFrames: this.droppedFrames,
      bufferSize: this.frequencyDataBuffer?.length || 0,
      isRunning: this.isRunning
    };
  }

  // Dispose and clean up all resources
  dispose(): void {
    this.stopAnalysis();

    // Disconnect audio nodes
    if (this.sourceNode && this.analyserNode) {
      this.sourceNode.disconnect(this.analyserNode);
    }

    // Clean up buffers
    this.frequencyDataBuffer = null;
    this.timeDataBuffer = null;
    this.smoothedFrequencyBuffer = null;
    this.peakValues = null;

    // Reset state
    this.analyserNode = null;
    this.sourceNode = null;
    this.eventHandlers = {};
  }

  // Private methods

  private createAnalyserNode(audioContext: AudioContext): Result<AnalyserNode> {
    try {
      const analyser = audioContext.createAnalyser();
      
      // Configure for optimal performance
      analyser.fftSize = this.getOptimalFFTSize();
      analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
      analyser.minDecibels = this.config.minDecibels;
      analyser.maxDecibels = this.config.maxDecibels;

      return { success: true, data: analyser };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'audio_context_failed',
          reason: `Failed to create analyser node: ${error instanceof Error ? error.message : 'Unknown error'}`,
          message: `Failed to create audio analyser node: ${error instanceof Error ? error.message : 'Unknown error'}`,
          canRetry: true
        }
      };
    }
  }

  private getOptimalFFTSize(): number {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
    
    if (isMobile) {
      return FFT_SIZES.MOBILE_STANDARD;
    } else {
      // Choose based on bar count for optimal performance
      if (this.config.barCount <= 32) return FFT_SIZES.DESKTOP_STANDARD;
      if (this.config.barCount <= 64) return FFT_SIZES.DESKTOP_HIGH;
      return FFT_SIZES.DESKTOP_ULTRA;
    }
  }

  private initializeBuffers(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    
    // Reuse buffers if size hasn't changed (memory optimization)
    if (
      !this.frequencyDataBuffer || 
      this.frequencyDataBuffer.length !== bufferLength
    ) {
      this.frequencyDataBuffer = new Uint8Array(bufferLength);
      this.timeDataBuffer = new Uint8Array(bufferLength);
      this.smoothedFrequencyBuffer = new Float32Array(this.config.barCount);
      
      // Initialize peak detection
      if (this.config.enablePeakDetection) {
        this.peakValues = new Float32Array(this.config.barCount);
      }
    }
  }

  private analysisLoop(): void {
    if (!this.isRunning || !this.analyserNode) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    // Performance monitoring
    this.updatePerformanceMetrics(deltaTime);

    // Adaptive frame rate based on performance
    if (this.config.enableFrameRateAdaptation && this.shouldSkipFrame(deltaTime)) {
      this.scheduleNextFrame();
      return;
    }

    // Get audio data and create frame data
    const frequencyData = this.getFrequencyData();
    const timeData = this.getTimeData();

    if (frequencyData && timeData) {
      const frameData: VisualizationFrameData = {
        frequencyData,
        timeData,
        timestamp: currentTime,
        sampleRate: audioEngine.getContext().sampleRate,
        frameNumber: this.frameCount
      };

      // Notify listeners
      this.eventHandlers.onDataUpdate?.(frameData);
    }

    this.lastFrameTime = currentTime;
    this.frameCount++;

    // Schedule next frame
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    this.animationFrameId = requestAnimationFrame(() => this.analysisLoop());
  }

  private processFrequencyData(): void {
    if (!this.frequencyDataBuffer || !this.smoothedFrequencyBuffer) return;

    const binCount = this.frequencyDataBuffer.length;
    const barCount = this.config.barCount;
    // const binsPerBar = Math.floor(binCount / barCount); // Unused - for future use

    // Process frequency data with logarithmic scaling and sensitivity
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      let count = 0;

      // Calculate logarithmic bin range for more natural frequency distribution
      const startBin = Math.floor(Math.pow(i / barCount, 2) * binCount);
      const endBin = Math.floor(Math.pow((i + 1) / barCount, 2) * binCount);

      for (let j = startBin; j < endBin && j < binCount; j++) {
        sum += this.frequencyDataBuffer[j];
        count++;
      }

      // Calculate average and apply sensitivity
      const average = count > 0 ? sum / count : 0;
      let processedValue = (average / 255) * this.config.sensitivity;

      // Apply smoothing
      if (this.config.smoothing > 0) {
        const previousValue = this.smoothedFrequencyBuffer[i] || 0;
        processedValue = previousValue * this.config.smoothing + 
                       processedValue * (1 - this.config.smoothing);
      }

      // Peak detection
      if (this.config.enablePeakDetection && this.peakValues) {
        if (processedValue > this.peakValues[i]) {
          this.peakValues[i] = processedValue;
        } else {
          this.peakValues[i] *= this.peakDecayRate;
        }
      }

      this.smoothedFrequencyBuffer[i] = Math.min(1, Math.max(0, processedValue));
    }
  }

  private updatePerformanceMetrics(deltaTime: number): void {
    // Update average frame time
    this.averageFrameTime = (this.averageFrameTime * 0.9) + (deltaTime * 0.1);

    // Track dropped frames
    const targetFrameTime = 1000 / PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP;
    if (deltaTime > targetFrameTime * 1.5) {
      this.droppedFrames++;
      
      // Emit performance warning if needed
      const currentFps = this.calculateFrameRate();
      if (currentFps < PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP * 0.75) {
        this.eventHandlers.onPerformanceWarning?.(currentFps);
      }
    }
  }

  private shouldSkipFrame(deltaTime: number): boolean {
    const targetFrameTime = 1000 / PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP;
    return deltaTime < targetFrameTime * 0.5; // Skip if running too fast
  }

  private calculateFrameRate(): number {
    if (this.averageFrameTime <= 0) return 0;
    return 1000 / this.averageFrameTime;
  }

  private reinitialize(): void {
    if (this.analyserNode && this.sourceNode) {
      this.initializeBuffers();
    }
  }
}

// Factory function for creating optimized analyzer instances
export function createAudioAnalyzer(config?: Partial<AudioAnalyzerConfig>): AudioAnalyzer {
  return new AudioAnalyzer(config);
}

// Utility functions for frequency data processing
export class FrequencyDataProcessor {
  static applyLogarithmicScale(data: Uint8Array, outputSize: number): Float32Array {
    const result = new Float32Array(outputSize);
    const inputSize = data.length;

    for (let i = 0; i < outputSize; i++) {
      const logIndex = Math.floor(Math.pow(i / outputSize, 2) * inputSize);
      result[i] = data[Math.min(logIndex, inputSize - 1)] / 255;
    }

    return result;
  }

  static applySmoothing(current: Float32Array, previous: Float32Array, factor: number): void {
    for (let i = 0; i < current.length; i++) {
      current[i] = previous[i] * factor + current[i] * (1 - factor);
    }
  }

  static detectPeaks(data: Float32Array, threshold: number = 0.7): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (
        data[i] > threshold &&
        data[i] > data[i - 1] &&
        data[i] > data[i + 1]
      ) {
        peaks.push(i);
      }
    }

    return peaks;
  }

  static calculateRMS(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalizedValue = (data[i] - 128) / 128;
      sum += normalizedValue * normalizedValue;
    }
    return Math.sqrt(sum / data.length);
  }
}