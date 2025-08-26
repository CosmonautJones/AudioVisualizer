import type { 
  MicrophoneAudioSource, 
  AudioSourceMetadata, 
  AudioVisualizerError, 
  Result,
  MicrophoneCapabilities 
} from '../../types/audio';
import { audioEngine } from '../audioEngine';

interface MicrophoneSourceConfig {
  enableNoiseSupression?: boolean;
  enableEchoCancellation?: boolean;
  enableAutoGainControl?: boolean;
  idealSampleRate?: number;
  idealChannelCount?: number;
  deviceId?: string;
  enableVolumeMonitoring?: boolean;
}

interface MicrophoneSourceEventHandlers {
  onPermissionRequested?: () => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: (error: AudioVisualizerError) => void;
  onDeviceConnected?: (deviceInfo: MediaDeviceInfo) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (error: AudioVisualizerError) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
}


export class MicrophoneAudioSourceImpl implements MicrophoneAudioSource {
  readonly type = 'microphone' as const;
  readonly mediaStream: MediaStream | null = null;
  readonly constraints: MediaStreamConstraints;
  
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private volumeMonitorNode: AnalyserNode | null = null;
  private _isConnected = false;
  private isRecording = false;
  private eventHandlers: MicrophoneSourceEventHandlers = {};
  private config: Required<MicrophoneSourceConfig>;
  private deviceInfo: MediaDeviceInfo | null = null;
  private volumeMonitorId: number | null = null;
  private currentVolume = 0;

  constructor(config: MicrophoneSourceConfig = {}) {
    this.config = {
      enableNoiseSupression: true,
      enableEchoCancellation: true,
      enableAutoGainControl: true,
      idealSampleRate: 48000,
      idealChannelCount: 1,
      deviceId: 'default',
      enableVolumeMonitoring: true,
      ...config
    };

    this.constraints = this.createMediaConstraints();
  }

  get isActive(): boolean {
    return this.isRecording && this.mediaStream !== null;
  }

  get isConnected(): boolean {
    return this._isConnected && this.sourceNode !== null;
  }

  // Request microphone permission with contextual explanation
  async requestPermission(): Promise<PermissionState> {
    try {
      this.eventHandlers.onPermissionRequested?.();

      // Check if permission API is available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        if (permission.state === 'granted') {
          this.eventHandlers.onPermissionGranted?.();
          return 'granted';
        } else if (permission.state === 'denied') {
          const error: AudioVisualizerError = {
            type: 'permission_denied',
            source: 'microphone',
            message: 'Microphone permission was previously denied. Please enable in browser settings.',
            canRetry: true
          };
          this.eventHandlers.onPermissionDenied?.(error);
          return 'denied';
        }
      }

      // Fallback: try to access microphone directly
      const stream = await navigator.mediaDevices.getUserMedia(this.constraints);
      stream.getTracks().forEach(track => track.stop()); // Immediately stop for permission test
      
      this.eventHandlers.onPermissionGranted?.();
      return 'granted';

    } catch (error) {
      const audioError = this.createPermissionError(error);
      this.eventHandlers.onPermissionDenied?.(audioError);
      return 'denied';
    }
  }

  // Connect to Web Audio API destination
  async connect(destination: AudioNode): Promise<MicrophoneAudioSource> {
    try {
      this.audioContext = audioEngine.getContext();

      // Ensure we have microphone access
      if (!this.mediaStream) {
        throw new Error('Microphone not initialized. Call startRecording() first.');
      }

      // Create media stream source
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect audio graph: microphone -> gain -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(destination);

      // Set up volume monitoring if enabled
      if (this.config.enableVolumeMonitoring) {
        this.setupVolumeMonitoring();
      }

      this._isConnected = true;
      return this;

    } catch (error) {
      const audioError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Failed to connect microphone: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: `Failed to connect microphone: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canRetry: true
      };

      this.eventHandlers.onError?.(audioError);
      throw audioError;
    }
  }

  // Disconnect from Web Audio API
  disconnect(): void {
    if (this.volumeMonitorId) {
      clearInterval(this.volumeMonitorId);
      this.volumeMonitorId = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
    }

    if (this.volumeMonitorNode) {
      this.volumeMonitorNode.disconnect();
    }

    this._isConnected = false;
  }

  // Start recording from microphone
  async startRecording(): Promise<void> {
    try {
      // Request permission first
      const permissionState = await this.requestPermission();
      if (permissionState !== 'granted') {
        throw new Error('Microphone permission denied');
      }

      // Get available devices and select appropriate one
      const devices = await this.getAvailableDevices();
      const selectedDevice = this.selectBestDevice(devices);
      
      if (selectedDevice) {
        this.deviceInfo = selectedDevice;
        this.constraints.audio = {
          ...(this.constraints.audio as MediaTrackConstraints),
          deviceId: selectedDevice.deviceId
        };
      }

      // Get media stream with optimized constraints
      (this.mediaStream as any) = await navigator.mediaDevices.getUserMedia(this.constraints);
      this.isRecording = true;

      // Notify listeners
      this.eventHandlers.onRecordingStart?.();
      if (this.deviceInfo) {
        this.eventHandlers.onDeviceConnected?.(this.deviceInfo);
      }

    } catch (error) {
      const audioError = this.createRecordingError(error);
      this.eventHandlers.onError?.(audioError);
      throw audioError;
    }
  }

  // Stop recording from microphone
  stopRecording(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      (this.mediaStream as any) = null;
    }

    this.isRecording = false;
    this.eventHandlers.onRecordingStop?.();
  }

  // Get current volume level (0-1)
  getVolume(): number {
    return this.currentVolume;
  }

  // Set microphone gain (0-2, 1 = normal)
  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, gain));
    }
  }

  // Get metadata about the microphone
  getMetadata(): AudioSourceMetadata<'microphone'> {
    const audioContext = audioEngine.getContext();
    
    return {
      type: 'microphone',
      deviceId: this.deviceInfo?.deviceId || 'unknown',
      deviceName: this.deviceInfo?.label || 'Default Microphone',
      sampleRate: audioContext.sampleRate,
      channels: this.getChannelCount()
    };
  }

  // Set event handlers
  setEventHandlers(handlers: MicrophoneSourceEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Get available microphone devices
  async getAvailableDevices(): Promise<MicrophoneCapabilities[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      return audioInputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId,
        supportedConstraints: navigator.mediaDevices.getSupportedConstraints(),
        maxSampleRate: 48000, // Standard maximum for most devices
        maxChannelCount: 2, // Most devices support stereo
        hasEchoCancellation: true, // Assume support, will be validated during stream creation
        hasNoiseSuppression: true,
        hasAutoGainControl: true,
        hasPermission: device.label !== '', // Empty label means no permission
        isDefault: device.deviceId === 'default'
      }));

    } catch (error) {
      console.warn('Failed to enumerate audio devices:', error);
      return [];
    }
  }

  // Switch to a different microphone device
  async switchDevice(deviceId: string): Promise<Result<void>> {
    try {
      const wasRecording = this.isRecording;
      
      // Stop current recording
      if (wasRecording) {
        this.stopRecording();
        this.disconnect();
      }

      // Update constraints with new device
      this.config.deviceId = deviceId;
      this.constraints.audio = {
        ...(this.constraints.audio as MediaTrackConstraints),
        deviceId: deviceId
      };

      // Restart if it was recording
      if (wasRecording) {
        await this.startRecording();
        // Reconnection will be handled by the consumer
      }

      return { success: true, data: undefined };

    } catch (error) {
      const audioError = this.createRecordingError(error);
      return { success: false, error: audioError };
    }
  }

  // Dispose and clean up resources
  dispose(): void {
    // Stop recording
    this.stopRecording();

    // Disconnect Web Audio nodes
    this.disconnect();

    // Clean up volume monitoring
    if (this.volumeMonitorId) {
      clearInterval(this.volumeMonitorId);
      this.volumeMonitorId = null;
    }

    // Reset state
    this.sourceNode = null;
    this.gainNode = null;
    this.volumeMonitorNode = null;
    this.audioContext = null;
    this.deviceInfo = null;
    this.eventHandlers = {};
  }

  // Private methods

  private createMediaConstraints(): MediaStreamConstraints {
    const audioConstraints: MediaTrackConstraints = {
      deviceId: this.config.deviceId === 'default' ? undefined : this.config.deviceId,
      sampleRate: { ideal: this.config.idealSampleRate },
      channelCount: { ideal: this.config.idealChannelCount },
      echoCancellation: this.config.enableEchoCancellation,
      noiseSuppression: this.config.enableNoiseSupression,
      autoGainControl: this.config.enableAutoGainControl,
      
      // Additional constraints for better audio quality
      sampleSize: { ideal: 16 }
      // Note: latency constraint removed as it's not supported in MediaTrackConstraints
    };

    return {
      audio: audioConstraints,
      video: false
    };
  }

  private selectBestDevice(devices: MicrophoneCapabilities[]): MediaDeviceInfo | null {
    if (devices.length === 0) return null;

    // If a specific device is requested, try to find it
    if (this.config.deviceId !== 'default') {
      const requestedDevice = devices.find(d => d.deviceId === this.config.deviceId);
      if (requestedDevice && requestedDevice.hasPermission) {
        // Convert to MediaDeviceInfo-like object
        return {
          deviceId: requestedDevice.deviceId,
          label: requestedDevice.label,
          groupId: requestedDevice.groupId,
          kind: 'audioinput' as MediaDeviceKind,
          toJSON: () => ({})
        };
      }
    }

    // Fallback to default or first available device with permission
    const defaultDevice = devices.find(d => d.isDefault && d.hasPermission);
    if (defaultDevice) {
      return {
        deviceId: defaultDevice.deviceId,
        label: defaultDevice.label,
        groupId: defaultDevice.groupId,
        kind: 'audioinput' as MediaDeviceKind,
        toJSON: () => ({})
      };
    }

    const firstAvailableDevice = devices.find(d => d.hasPermission);
    if (firstAvailableDevice) {
      return {
        deviceId: firstAvailableDevice.deviceId,
        label: firstAvailableDevice.label,
        groupId: firstAvailableDevice.groupId,
        kind: 'audioinput' as MediaDeviceKind,
        toJSON: () => ({})
      };
    }

    return null;
  }

  private setupVolumeMonitoring(): void {
    if (!this.audioContext || !this.sourceNode) return;

    // Create analyser for volume monitoring (separate from main visualization)
    this.volumeMonitorNode = this.audioContext.createAnalyser();
    this.volumeMonitorNode.fftSize = 256;
    this.volumeMonitorNode.smoothingTimeConstant = 0.3;

    // Connect microphone to volume monitor
    this.sourceNode.connect(this.volumeMonitorNode);

    // Start volume monitoring loop
    this.startVolumeMonitoring();
  }

  private startVolumeMonitoring(): void {
    if (!this.volumeMonitorNode) return;

    const bufferLength = this.volumeMonitorNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!this.volumeMonitorNode || !this.isRecording) return;

      this.volumeMonitorNode.getByteTimeDomainData(dataArray);
      
      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = (dataArray[i] - 128) / 128;
        sum += sample * sample;
      }
      
      const rms = Math.sqrt(sum / bufferLength);
      this.currentVolume = Math.min(1, rms * 10); // Amplify for better sensitivity
      
      this.eventHandlers.onVolumeChange?.(this.currentVolume);
    };

    this.volumeMonitorId = setInterval(updateVolume, 100); // Update every 100ms
  }

  private getChannelCount(): number {
    if (this.mediaStream) {
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const settings = audioTracks[0].getSettings();
        return settings.channelCount || 1;
      }
    }
    return this.config.idealChannelCount;
  }

  private createPermissionError(error: unknown): AudioVisualizerError {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return {
          type: 'permission_denied',
          source: 'microphone',
          message: 'Microphone access denied. Please allow microphone access and try again.',
          canRetry: true
        };
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return {
          type: 'permission_denied',
          source: 'microphone',
          message: 'No microphone devices found. Please connect a microphone and try again.',
          canRetry: true
        };
      } else if (error.name === 'NotReadableError') {
        return {
          type: 'permission_denied',
          source: 'microphone',
          message: 'Microphone is already in use by another application.',
          canRetry: true
        };
      }
    }

    return {
      type: 'permission_denied',
      source: 'microphone',
      message: 'Failed to access microphone. Please check your browser settings and permissions.',
      canRetry: true
    };
  }

  private createRecordingError(error: unknown): AudioVisualizerError {
    const permissionError = this.createPermissionError(error);
    
    // If it's not a permission error, it's likely a technical issue
    if (permissionError.type === 'permission_denied') {
      return permissionError;
    }

    return {
      type: 'audio_context_failed',
      reason: `Failed to start microphone recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
      message: `Failed to start microphone recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
      canRetry: true
    };
  }
}

// Factory function for creating microphone audio sources
export function createMicrophoneAudioSource(config?: MicrophoneSourceConfig): MicrophoneAudioSource {
  return new MicrophoneAudioSourceImpl(config);
}

// Utility functions for microphone handling
export class MicrophonePermissionManager {
  static async checkPermissionStatus(): Promise<PermissionState> {
    if (!('permissions' in navigator)) {
      return 'prompt';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state;
    } catch (error) {
      return 'prompt';
    }
  }

  static async requestWithGuidance(): Promise<{ 
    granted: boolean; 
    error?: AudioVisualizerError; 
    instructions?: string[] 
  }> {
    const status = await this.checkPermissionStatus();
    
    if (status === 'denied') {
      return {
        granted: false,
        error: {
          type: 'permission_denied',
          source: 'microphone',
          message: 'Microphone permission was denied.',
          canRetry: true
        },
        instructions: [
          'Click the microphone icon in your browser\'s address bar',
          'Select "Always allow" for this website',
          'Refresh the page and try again'
        ]
      };
    }

    try {
      const source = createMicrophoneAudioSource();
      const permissionState = await source.requestPermission();
      source.dispose();

      return {
        granted: permissionState === 'granted'
      };

    } catch (error) {
      return {
        granted: false,
        error: {
          type: 'permission_denied',
          source: 'microphone',
          message: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        }
      };
    }
  }

  static getBrowserSpecificInstructions(): { browser: string; instructions: string[] } {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return {
        browser: 'Chrome',
        instructions: [
          'Click the camera/microphone icon in the address bar',
          'Select "Always allow microphone" and click "Done"',
          'Refresh the page'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        browser: 'Firefox',
        instructions: [
          'Click the microphone icon in the address bar',
          'Select "Allow" and check "Remember this decision"',
          'Refresh the page'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        browser: 'Safari',
        instructions: [
          'Go to Safari > Settings for This Website',
          'Set Microphone to "Allow"',
          'Refresh the page'
        ]
      };
    } else {
      return {
        browser: 'Your browser',
        instructions: [
          'Look for a microphone icon in the address bar',
          'Click it and allow microphone access',
          'Refresh the page if needed'
        ]
      };
    }
  }
}

