import type { 
  FileAudioSource, 
  AudioSourceMetadata, 
  AudioVisualizerError, 
  Result 
} from '../../types/audio';
import { audioEngine } from '../audioEngine';
import { SUPPORTED_AUDIO_FORMATS } from '../../constants/audio';

interface FileSourceConfig {
  maxFileSizeMB?: number;
  enableMetadataExtraction?: boolean;
  preloadBuffer?: boolean;
  enableCrossfade?: boolean;
}

interface FileSourceEventHandlers {
  onLoadStart?: () => void;
  onLoadProgress?: (progress: number) => void;
  onLoadComplete?: (metadata: AudioSourceMetadata<'file'>) => void;
  onError?: (error: AudioVisualizerError) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export class FileAudioSourceImpl implements FileAudioSource {
  readonly type = 'file' as const;
  readonly file: File;
  readonly audioElement: HTMLAudioElement;
  
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private _isConnected = false;
  private eventHandlers: FileSourceEventHandlers = {};
  private config: Required<FileSourceConfig>;
  private metadata: AudioSourceMetadata<'file'> | null = null;

  constructor(file: File, config: FileSourceConfig = {}) {
    this.file = file;
    this.audioElement = new Audio();
    this.config = {
      maxFileSizeMB: 50,
      enableMetadataExtraction: true,
      preloadBuffer: false,
      enableCrossfade: false,
      ...config
    };

    this.setupAudioElement();
  }

  get isActive(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  get isConnected(): boolean {
    return this._isConnected && this.sourceNode !== null;
  }

  // Load and validate the audio file
  async load(): Promise<Result<void>> {
    try {
      // Validate file before processing
      const validationResult = await this.validateFile();
      if (!validationResult.success) {
        return validationResult;
      }

      // Create object URL and set as audio source
      const objectUrl = URL.createObjectURL(this.file);
      this.audioElement.src = objectUrl;

      this.eventHandlers.onLoadStart?.();

      // Wait for metadata to load
      await this.waitForMetadata();

      // Extract metadata if enabled
      if (this.config.enableMetadataExtraction) {
        this.metadata = await this.extractMetadata();
      }

      // Preload if configured
      if (this.config.preloadBuffer) {
        await this.preloadAudio();
      }

      this.eventHandlers.onLoadComplete?.(this.metadata!);

      return { success: true, data: undefined };

    } catch (error) {
      const audioError = this.createLoadError(error);
      this.eventHandlers.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  // Connect to Web Audio API destination
  async connect(destination: AudioNode): Promise<FileAudioSource> {
    try {
      this.audioContext = audioEngine.getContext();

      // Create media element source node
      if (!this.sourceNode) {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
      }

      // Connect to destination
      this.sourceNode.connect(destination);
      this._isConnected = true;

      return this;

    } catch (error) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Failed to connect audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: `Failed to connect audio file to Web Audio API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };

      this.eventHandlers.onError?.(audioError);
      throw audioError;
    }
  }

  // Disconnect from Web Audio API
  disconnect(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    this._isConnected = false;
  }

  // Play the audio file
  async play(): Promise<Result<void>> {
    try {
      // Handle autoplay restrictions
      await this.audioElement.play();
      this.eventHandlers.onPlayStateChange?.(true);
      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        const audioError: AudioVisualizerError = {
          type: 'permission_denied',
          source: 'microphone',
          message: 'Autoplay blocked. User interaction required to play audio.',
          canRetry: true
        };
        this.eventHandlers.onError?.(audioError);
        return { success: false, error: audioError };
      }
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: `Failed to play audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };
      return { success: false, error: audioError };
    }
  }

  // Pause the audio file
  pause(): void {
    this.audioElement.pause();
    this.eventHandlers.onPlayStateChange?.(false);
  }

  // Get current playback time
  getCurrentTime(): number {
    return this.audioElement.currentTime;
  }

  // Get total duration
  getDuration(): number {
    return this.audioElement.duration || 0;
  }

  // Set playback position
  setCurrentTime(time: number): void {
    if (time >= 0 && time <= this.getDuration()) {
      this.audioElement.currentTime = time;
    }
  }

  // Set volume (0-1)
  setVolume(volume: number): void {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  // Get metadata
  getMetadata(): AudioSourceMetadata<'file'> {
    if (!this.metadata) {
      return this.createBasicMetadata();
    }
    return this.metadata;
  }

  // Set event handlers
  setEventHandlers(handlers: FileSourceEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Dispose and clean up resources
  dispose(): void {
    // Pause playback
    this.pause();

    // Disconnect Web Audio nodes
    this.disconnect();

    // Clean up audio element
    if (this.audioElement.src) {
      URL.revokeObjectURL(this.audioElement.src);
      this.audioElement.src = '';
    }

    // Remove event listeners
    this.removeAudioElementListeners();

    // Reset state
    this.sourceNode = null;
    this.audioContext = null;
    this.metadata = null;
    this.eventHandlers = {};
  }

  // Private methods

  private async validateFile(): Promise<Result<void>> {
    // Check file size
    const fileSizeMB = this.file.size / (1024 * 1024);
    if (fileSizeMB > this.config.maxFileSizeMB) {
      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: `${fileSizeMB.toFixed(1)}MB`,
          supportedFormats: [`Max ${this.config.maxFileSizeMB}MB`],
          message: `File size ${fileSizeMB.toFixed(1)}MB exceeds maximum allowed size of ${this.config.maxFileSizeMB}MB`,
          canRetry: false
        }
      };
    }

    // Check MIME type
    const mimeValidation = this.validateMimeType();
    if (!mimeValidation.success) {
      return mimeValidation;
    }

    // Additional file header validation for security
    const headerValidation = await this.validateFileHeader();
    if (!headerValidation.success) {
      return headerValidation;
    }

    return { success: true, data: undefined };
  }

  private validateMimeType(): Result<void> {
    const supportedMimeTypes = Object.values(SUPPORTED_AUDIO_FORMATS)
      .flatMap(format => format.mimeTypes);

    if (!supportedMimeTypes.includes(this.file.type as any)) {
      const supportedExtensions = Object.values(SUPPORTED_AUDIO_FORMATS)
        .flatMap(format => format.extensions);

      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: this.file.type || 'unknown',
          supportedFormats: supportedExtensions,
          message: `Unsupported file format: ${this.file.type || 'unknown'}. Please use a supported audio format.`,
          canRetry: false
        }
      };
    }

    return { success: true, data: undefined };
  }

  private async validateFileHeader(): Promise<Result<void>> {
    try {
      const buffer = await this.file.slice(0, 12).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check common audio file signatures
      if (this.isValidAudioHeader(bytes)) {
        return { success: true, data: undefined };
      }

      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: 'Invalid file header',
          supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
          message: 'File header is invalid or corrupted. Please ensure the file is a valid audio file.',
          canRetry: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: 'Unable to read file header',
          supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
          message: 'Unable to read file header. The file may be corrupted or inaccessible.',
          canRetry: true
        }
      };
    }
  }

  private isValidAudioHeader(bytes: Uint8Array): boolean {
    // MP3: FF FB or ID3
    if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true;
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // ID3

    // WAV: RIFF...WAVE
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45   // WAVE
    ) return true;

    // MP4/M4A: ftyp
    if (
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 // ftyp
    ) return true;

    // OGG: OggS
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;

    // FLAC: fLaC
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return true;

    return false;
  }

  private setupAudioElement(): void {
    // Configure audio element
    this.audioElement.preload = 'metadata';
    this.audioElement.crossOrigin = 'anonymous';

    // Add event listeners
    this.audioElement.addEventListener('loadstart', () => this.eventHandlers.onLoadStart?.());
    this.audioElement.addEventListener('progress', this.handleLoadProgress.bind(this));
    this.audioElement.addEventListener('canplaythrough', () => this.eventHandlers.onLoadComplete?.(this.getMetadata()));
    this.audioElement.addEventListener('error', this.handleAudioError.bind(this));
    this.audioElement.addEventListener('ended', () => this.eventHandlers.onPlayStateChange?.(false));
  }

  private removeAudioElementListeners(): void {
    this.audioElement.removeEventListener('loadstart', () => {});
    this.audioElement.removeEventListener('progress', this.handleLoadProgress);
    this.audioElement.removeEventListener('canplaythrough', () => {});
    this.audioElement.removeEventListener('error', this.handleAudioError);
    this.audioElement.removeEventListener('ended', () => {});
  }

  private handleLoadProgress(): void {
    if (this.audioElement.buffered.length > 0) {
      const loaded = this.audioElement.buffered.end(this.audioElement.buffered.length - 1);
      const total = this.audioElement.duration || 0;
      const progress = total > 0 ? (loaded / total) * 100 : 0;
      this.eventHandlers.onLoadProgress?.(progress);
    }
  }

  private handleAudioError(): void {
    const error = this.audioElement.error;
    const audioError: AudioVisualizerError = {
      type: 'file_format_unsupported',
      format: this.file.type,
      supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
      message: `Audio element error: ${this.file.type}`,
      canRetry: true
    };

    if (error) {
      audioError.format = `${this.file.type} (Error code: ${error.code})`;
    }

    this.eventHandlers.onError?.(audioError);
  }

  private async waitForMetadata(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.audioElement.readyState >= 1) {
        resolve();
        return;
      }

      const onLoadedMetadata = () => {
        this.audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.audioElement.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        this.audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.audioElement.removeEventListener('error', onError);
        reject(new Error('Failed to load audio metadata'));
      };

      this.audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      this.audioElement.addEventListener('error', onError);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.audioElement.removeEventListener('error', onError);
        reject(new Error('Timeout waiting for audio metadata'));
      }, 30000);
    });
  }

  private async extractMetadata(): Promise<AudioSourceMetadata<'file'>> {
    // Extract basic metadata from audio element and file
    const audioContext = audioEngine.getContext();
    
    return {
      type: 'file',
      filename: this.file.name,
      duration: this.audioElement.duration || 0,
      sampleRate: audioContext.sampleRate,
      channels: 2, // Default assumption, could be enhanced
      bitRate: this.estimateBitRate()
    };
  }

  private estimateBitRate(): number {
    const fileSizeBytes = this.file.size;
    const durationSeconds = this.audioElement.duration || 1;
    const bitRate = (fileSizeBytes * 8) / durationSeconds;
    return Math.round(bitRate);
  }

  private async preloadAudio(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onCanPlayThrough = () => {
        this.audioElement.removeEventListener('canplaythrough', onCanPlayThrough);
        this.audioElement.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        this.audioElement.removeEventListener('canplaythrough', onCanPlayThrough);
        this.audioElement.removeEventListener('error', onError);
        reject(new Error('Failed to preload audio'));
      };

      if (this.audioElement.readyState >= 4) {
        resolve();
        return;
      }

      this.audioElement.addEventListener('canplaythrough', onCanPlayThrough);
      this.audioElement.addEventListener('error', onError);
      this.audioElement.load();
    });
  }

  private createBasicMetadata(): AudioSourceMetadata<'file'> {
    const audioContext = audioEngine.getContext();
    
    return {
      type: 'file',
      filename: this.file.name,
      duration: this.audioElement.duration || 0,
      sampleRate: audioContext.sampleRate,
      channels: 2,
      bitRate: this.estimateBitRate()
    };
  }

  private createLoadError(_error: unknown): AudioVisualizerError {
    return {
      type: 'file_format_unsupported',
      format: this.file.type || 'unknown',
      supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
      message: `Failed to load audio file: ${this.file.type || 'unknown'}`,
      canRetry: true
    };
  }
}

// Factory function for creating file audio sources
export function createFileAudioSource(file: File, config?: FileSourceConfig): FileAudioSource {
  return new FileAudioSourceImpl(file, config);
}

// Utility functions for file handling
export class FileHandler {
  static async handleFileUpload(
    input: HTMLInputElement,
    config?: FileSourceConfig
  ): Promise<Result<FileAudioSource>> {
    const files = input.files;
    if (!files || files.length === 0) {
      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: 'No file selected',
          supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
          message: 'No file was selected for upload',
          canRetry: true
        }
      };
    }

    const file = files[0];
    const fileSource = createFileAudioSource(file, config);
    
    const loadResult = await fileSource.load();
    if (!loadResult.success) {
      fileSource.dispose();
      return loadResult;
    }

    return { success: true, data: fileSource };
  }

  static async handleFileDrop(
    event: DragEvent,
    config?: FileSourceConfig
  ): Promise<Result<FileAudioSource>> {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return {
        success: false,
        error: {
          type: 'file_format_unsupported',
          format: 'No file dropped',
          supportedFormats: Object.keys(SUPPORTED_AUDIO_FORMATS),
          message: 'No file was dropped in the drop zone',
          canRetry: true
        }
      };
    }

    const file = files[0];
    const fileSource = createFileAudioSource(file, config);
    
    const loadResult = await fileSource.load();
    if (!loadResult.success) {
      fileSource.dispose();
      return loadResult;
    }

    return { success: true, data: fileSource };
  }

  static getSupportedFileTypes(): string[] {
    return Object.values(SUPPORTED_AUDIO_FORMATS)
      .flatMap(format => format.extensions);
  }

  static getMimeTypesForFileInput(): string {
    return Object.values(SUPPORTED_AUDIO_FORMATS)
      .flatMap(format => format.mimeTypes)
      .join(',');
  }
}