/**
 * Audio Engine for Visual Equalizer
 * Web Audio API pipeline: Input → GainNode → AnalyserNode → Frequency Data
 */

/**
 * Audio Engine for Visual Equalizer
 * Web Audio API pipeline: Input → GainNode → AnalyserNode → Frequency Data
 */
import type { AudioEngineError } from './types.ts';

export interface AudioEngineConfigLocal {
  fftSize: number;
  smoothingTimeConstant: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: AudioBufferSourceNode | MediaStreamAudioSourceNode | null = null;
  private frequencyBins: Uint8Array | null = null;
  private currentAudioFile: File | null = null;
  private isPlaying: boolean = false;
  
  private config: AudioEngineConfigLocal = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8
  };

  /**
   * Initialize audio from microphone input
   */
  async initAudioFromMic(): Promise<{ success: true } | { success: false; error: AudioEngineError }> {
    try {
      // Check for Web Audio API support
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        return { success: false, error: 'browser-unsupported' };
      }

      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { success: false, error: 'browser-unsupported' };
      }

      // Initialize audio context first to ensure user gesture
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Check if context is blocked due to user gesture requirement
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        // If still suspended, user gesture is required
        if (this.audioContext.state === 'suspended') {
          return { success: false, error: 'audio-context-failed' };
        }
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Clean up previous source
      this.cleanup();

      // Create audio nodes
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();

      // Configure analyser
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // Connect audio graph: source → gain → analyser
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      
      // Optional: Connect to destination for monitoring (users can hear themselves)
      // Note: This might cause feedback, so we keep gain low by default
      // this.gainNode.connect(this.audioContext.destination);

      // Pre-allocate frequency data array
      this.frequencyBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.isPlaying = true;

      return { success: true };

    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'mic-denied' };
      }
      if (error.name === 'NotFoundError') {
        return { success: false, error: 'mic-not-found' };
      }
      return { success: false, error: 'audio-context-failed' };
    }
  }

  /**
   * Initialize audio from file input
   */
  async initAudioFromFile(file: File): Promise<{ success: true } | { success: false; error: AudioEngineError }> {
    try {
      // Check for Web Audio API support
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        return { success: false, error: 'browser-unsupported' };
      }

      // Initialize audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Check if context is blocked due to user gesture requirement
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        // If still suspended, user gesture is required
        if (this.audioContext.state === 'suspended') {
          return { success: false, error: 'audio-context-failed' };
        }
      }

      // Store current file reference
      this.currentAudioFile = file;

      // Decode audio file
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Clean up previous source
      this.cleanup();

      // Create audio nodes
      this.source = this.audioContext.createBufferSource();
      this.source.buffer = audioBuffer;
      this.source.loop = true; // Loop for continuous visualization
      
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();

      // Configure analyser
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // Connect audio graph: source → gain → analyser AND destination
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(this.audioContext.destination); // Connect to speakers

      // Pre-allocate frequency data array
      this.frequencyBins = new Uint8Array(this.analyser.frequencyBinCount);

      // Start playback
      this.source.start(0);
      this.isPlaying = true;

      return { success: true };

    } catch (error) {
      return { success: false, error: 'file-decode-failed' };
    }
  }

  /**
   * Set input sensitivity (gain multiplier)
   */
  setSensitivity(multiplier: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0.1, Math.min(5.0, multiplier));
    }
  }

  /**
   * Get number of frequency bins available
   */
  getFrequencyBinCount(): number {
    return this.analyser?.frequencyBinCount ?? 0;
  }

  /**
   * Read current frequency data into provided array (no allocations)
   */
  readFrequencyData(target: Uint8Array<ArrayBuffer>): void {
    if (this.analyser && target.length >= this.analyser.frequencyBinCount && this.isPlaying) {
      this.analyser.getByteFrequencyData(target);
    }
  }

  /**
   * Pause audio playback (only works for file sources)
   */
  pause(): void {
    if (this.source && 'buffer' in this.source) {
      // For file sources, we need to recreate the source to pause
      this.isPlaying = false;
    }
    // Microphone sources cannot be paused
  }

  /**
   * Resume audio playback (only works for file sources)
   */
  async resume(): Promise<void> {
    if (this.currentAudioFile && !this.isPlaying) {
      // Restart file playback
      await this.initAudioFromFile(this.currentAudioFile);
    }
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up audio resources
   */
  private cleanup(): void {
    if (this.source) {
      try {
        this.source.disconnect();
        if ('stop' in this.source) {
          this.source.stop();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      this.source = null;
    }
    this.isPlaying = false;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.cleanup();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.gainNode = null;
    this.frequencyBins = null;
    this.currentAudioFile = null;
    this.isPlaying = false;
  }
}