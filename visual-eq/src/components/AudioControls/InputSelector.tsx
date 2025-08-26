import React, { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  useMemo 
} from 'react';
import { 
  useAudioVisualizerActions,
  useAudioState 
} from '../../context/AudioVisualizerContext';
import { 
  FileHandler 
  // createFileAudioSource 
} from '../../services/audioSources/fileSource';
import { 
  MicrophonePermissionManager,
  createMicrophoneAudioSource
  // type MicrophoneCapabilities
} from '../../services/audioSources/microphoneSource';
import type { 
  AudioSourceType, 
  AudioVisualizerError
  // Result
} from '../../types/audio';
// import { SUPPORTED_AUDIO_FORMATS, ERROR_MESSAGES } from '../../constants/audio';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface InputSelectorProps {
  className?: string;
  onSourceSelect?: (sourceType: AudioSourceType) => void;
  onError?: (error: AudioVisualizerError) => void;
  disabled?: boolean;
  showAdvancedOptions?: boolean;
}

interface DemoTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  artist?: string;
  genre?: string;
}

interface FileUploadState {
  isDragging: boolean;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

interface MicrophoneState {
  isConnecting: boolean;
  isConnected: boolean;
  devices: any[]; // MicrophoneCapabilities[];
  selectedDeviceId: string;
  currentVolume: number;
  error: string | null;
  hasPermission: boolean;
}

type InputTab = 'file' | 'microphone' | 'demo';

// =============================================================================
// DEMO TRACKS
// =============================================================================

const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'electronic-beat',
    name: 'Electronic Beat',
    url: '/audio/demo/electronic-beat.mp3',
    duration: 120,
    artist: 'Demo Artist',
    genre: 'Electronic'
  },
  {
    id: 'acoustic-guitar',
    name: 'Acoustic Guitar',
    url: '/audio/demo/acoustic-guitar.mp3',
    duration: 180,
    artist: 'Demo Artist',
    genre: 'Acoustic'
  },
  {
    id: 'orchestral',
    name: 'Orchestral Symphony',
    url: '/audio/demo/orchestral.mp3',
    duration: 240,
    artist: 'Demo Orchestra',
    genre: 'Classical'
  }
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InputSelector({
  className = '',
  onSourceSelect,
  onError,
  disabled = false,
  showAdvancedOptions = false
}: InputSelectorProps) {
  // Context hooks
  const actions = useAudioVisualizerActions();
  const audioState = useAudioState();
  // Commented out unused variables:
  // const { state } = useAudioVisualizer();
  // const isReady = state.initializationComplete;

  // Local state
  const [activeTab, setActiveTab] = useState<InputTab>('file');
  const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
    isDragging: false,
    isUploading: false,
    progress: 0,
    error: null
  });
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>({
    isConnecting: false,
    isConnected: false,
    devices: [],
    selectedDeviceId: 'default',
    currentVolume: 0,
    error: null,
    hasPermission: false
  });
  const [selectedDemoTrack, setSelectedDemoTrack] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const volumeAnimationRef = useRef<number | null>(null);

  // =============================================================================
  // FILE UPLOAD HANDLERS
  // =============================================================================

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    setFileUploadState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null
    }));

    try {
      const result = await FileHandler.handleFileUpload(fileInputRef.current!);
      
      if (!result.success) {
        throw result.error;
      }

      // Connect the audio source
      const selectResult = await actions.selectAudioSource('file', {
        filename: file.name,
        size: file.size
      });

      if (selectResult.success) {
        onSourceSelect?.('file');
        setFileUploadState(prev => ({
          ...prev,
          isUploading: false,
          progress: 100
        }));
      } else {
        throw selectResult.error;
      }

    } catch (error) {
      const audioError = error as AudioVisualizerError;
      setFileUploadState(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        error: audioError.type === 'file_format_unsupported' 
          ? `Unsupported format: ${audioError.format}`
          : 'Failed to load audio file'
      }));
      onError?.(audioError);
    }
  }, [actions, onSourceSelect, onError]);

  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    setFileUploadState(prev => ({ ...prev, isDragging: false }));
    
    if (disabled) return;

    handleFileSelect(event.dataTransfer.files);
  }, [handleFileSelect, disabled]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!disabled) {
      setFileUploadState(prev => ({ ...prev, isDragging: true }));
    }
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set isDragging to false if we're actually leaving the drop zone
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = event;
      if (clientX < rect.left || clientX > rect.right || 
          clientY < rect.top || clientY > rect.bottom) {
        setFileUploadState(prev => ({ ...prev, isDragging: false }));
      }
    }
  }, []);

  // =============================================================================
  // MICROPHONE HANDLERS
  // =============================================================================

  const checkMicrophonePermission = useCallback(async () => {
    try {
      const permissionResult = await MicrophonePermissionManager.requestWithGuidance();
      
      setMicrophoneState(prev => ({
        ...prev,
        hasPermission: permissionResult.granted,
        error: permissionResult.granted ? null : permissionResult.error?.message || 'Permission denied'
      }));

      return permissionResult.granted;
    } catch (error) {
      setMicrophoneState(prev => ({
        ...prev,
        hasPermission: false,
        error: 'Failed to check microphone permission'
      }));
      return false;
    }
  }, []);

  const loadMicrophoneDevices = useCallback(async () => {
    try {
      const micSource = createMicrophoneAudioSource();
      const devices = await micSource.getAvailableDevices?.() ?? [];
      
      setMicrophoneState(prev => ({
        ...prev,
        devices,
        selectedDeviceId: prev.selectedDeviceId === 'default' 
          ? devices.find(d => d.isDefault)?.deviceId || devices[0]?.deviceId || 'default'
          : prev.selectedDeviceId
      }));

      micSource.dispose();
    } catch (error) {
      console.warn('Failed to load microphone devices:', error);
    }
  }, []);

  const handleMicrophoneConnect = useCallback(async () => {
    if (!await checkMicrophonePermission()) {
      return;
    }

    setMicrophoneState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }));

    try {
      const selectResult = await actions.selectAudioSource('microphone', {
        deviceId: microphoneState.selectedDeviceId
      });

      if (selectResult.success) {
        setMicrophoneState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: true
        }));
        onSourceSelect?.('microphone');
      } else {
        throw selectResult.error;
      }

    } catch (error) {
      const audioError = error as AudioVisualizerError;
      setMicrophoneState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: audioError.message || 'Failed to connect microphone'
      }));
      onError?.(audioError);
    }
  }, [actions, microphoneState.selectedDeviceId, onSourceSelect, onError, checkMicrophonePermission]);

  const handleMicrophoneDisconnect = useCallback(() => {
    // This would be handled through the audio context
    setMicrophoneState(prev => ({
      ...prev,
      isConnected: false,
      currentVolume: 0
    }));
  }, []);

  const handleDeviceChange = useCallback((deviceId: string) => {
    setMicrophoneState(prev => ({
      ...prev,
      selectedDeviceId: deviceId,
      isConnected: false // Disconnect current device
    }));
  }, []);

  // =============================================================================
  // DEMO TRACK HANDLERS
  // =============================================================================

  const handleDemoTrackSelect = useCallback(async (trackId: string) => {
    setSelectedDemoTrack(trackId);
    
    try {
      // Create a fake File object for demo tracks
      const track = DEMO_TRACKS.find(t => t.id === trackId);
      if (!track) return;

      // In a real implementation, you'd fetch the demo track
      const selectResult = await actions.selectAudioSource('file', {
        filename: track.name,
        url: track.url,
        isDemo: true
      });

      if (selectResult.success) {
        onSourceSelect?.('file');
      } else {
        throw selectResult.error;
      }

    } catch (error) {
      const audioError = error as AudioVisualizerError;
      onError?.(audioError);
      setSelectedDemoTrack('');
    }
  }, [actions, onSourceSelect, onError]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load microphone devices when microphone tab is selected
  useEffect(() => {
    if (activeTab === 'microphone') {
      loadMicrophoneDevices();
    }
  }, [activeTab, loadMicrophoneDevices]);

  // Clear file input value when switching tabs
  useEffect(() => {
    if (fileInputRef.current && activeTab !== 'file') {
      fileInputRef.current.value = '';
    }
  }, [activeTab]);

  // Animate microphone volume indicator
  useEffect(() => {
    if (microphoneState.isConnected && microphoneState.currentVolume > 0) {
      if (volumeAnimationRef.current) {
        cancelAnimationFrame(volumeAnimationRef.current);
      }
      
      const animate = () => {
        // Volume animation would be handled here
        volumeAnimationRef.current = requestAnimationFrame(animate);
      };
      
      animate();
    }

    return () => {
      if (volumeAnimationRef.current) {
        cancelAnimationFrame(volumeAnimationRef.current);
      }
    };
  }, [microphoneState.isConnected, microphoneState.currentVolume]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const supportedFileTypes = useMemo(() => {
    return FileHandler.getMimeTypesForFileInput();
  }, []);

  const supportedExtensions = useMemo(() => {
    return FileHandler.getSupportedFileTypes().join(', ');
  }, []);

  const isCurrentlyActive = useMemo(() => {
    return audioState.currentSource !== null && audioState.playbackStatus !== 'idle';
  }, [audioState.currentSource, audioState.playbackStatus]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderTabButton = (tab: InputTab, label: string, icon: string) => (
    <button
      key={tab}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
        ${activeTab === tab 
          ? 'border-blue-500 bg-blue-500/20 text-blue-400' 
          : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={() => !disabled && setActiveTab(tab)}
      disabled={disabled}
      aria-pressed={activeTab === tab}
      role="tab"
    >
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  const renderFileUploadTab = () => (
    <div className="space-y-4">
      {/* File Drop Zone */}
      <div
        ref={dropZoneRef}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${fileUploadState.isDragging 
            ? 'border-blue-400 bg-blue-500/20' 
            : 'border-gray-600 hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedFileTypes}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || fileUploadState.isUploading}
        />

        <div className="space-y-2">
          <div className="text-4xl" aria-hidden="true">📁</div>
          <div>
            <p className="text-lg text-white font-medium">
              {fileUploadState.isDragging ? 'Drop your audio file here' : 'Choose an audio file'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Supported formats: {supportedExtensions}
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {fileUploadState.isUploading && (
          <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white font-medium">Uploading...</p>
              <div className="w-32 h-2 bg-gray-700 rounded-full mt-2 mx-auto overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${fileUploadState.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Error */}
      {fileUploadState.error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
          <strong>Upload Error:</strong> {fileUploadState.error}
        </div>
      )}

      {/* Current File Info */}
      {audioState.currentSource === 'file' && audioState.sourceMetadata && (
        <div className="bg-green-500/20 border border-green-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-400">
            <span>✅</span>
            <span className="font-medium">File loaded: {audioState.sourceMetadata.name}</span>
          </div>
          {audioState.sourceMetadata.duration && (
            <p className="text-sm text-green-300 mt-1">
              Duration: {Math.floor(audioState.sourceMetadata.duration / 60)}:
              {String(Math.floor(audioState.sourceMetadata.duration % 60)).padStart(2, '0')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderMicrophoneTab = () => (
    <div className="space-y-4">
      {/* Device Selection */}
      {microphoneState.devices.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Microphone Device
          </label>
          <select
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
            value={microphoneState.selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            disabled={disabled || microphoneState.isConnecting}
          >
            {microphoneState.devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label} {device.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Connection Status */}
      <div className="space-y-3">
        {!microphoneState.hasPermission && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-yellow-400 text-sm">
            <strong>Permission Required:</strong> Microphone access is needed for live audio visualization.
          </div>
        )}

        {/* Connect/Disconnect Button */}
        <button
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
            ${microphoneState.isConnected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
            ${disabled || microphoneState.isConnecting 
              ? 'opacity-50 cursor-not-allowed' 
              : ''
            }
          `}
          onClick={microphoneState.isConnected ? handleMicrophoneDisconnect : handleMicrophoneConnect}
          disabled={disabled || microphoneState.isConnecting}
        >
          {microphoneState.isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </>
          ) : microphoneState.isConnected ? (
            <>
              <span>🔴</span>
              <span>Disconnect Microphone</span>
            </>
          ) : (
            <>
              <span>🎤</span>
              <span>Connect Microphone</span>
            </>
          )}
        </button>
      </div>

      {/* Volume Level Indicator */}
      {microphoneState.isConnected && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Audio Level
          </label>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-12">🎤</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-100"
                  style={{ width: `${microphoneState.currentVolume * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-400 w-8">
                {Math.round(microphoneState.currentVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Microphone Error */}
      {microphoneState.error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
          <strong>Microphone Error:</strong> {microphoneState.error}
        </div>
      )}
    </div>
  );

  const renderDemoTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Try these demo tracks to experience the visualizer:
      </p>
      
      <div className="grid gap-3">
        {DEMO_TRACKS.map(track => (
          <button
            key={track.id}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-all text-left
              ${selectedDemoTrack === track.id
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => !disabled && handleDemoTrackSelect(track.id)}
            disabled={disabled}
          >
            <div className="text-2xl">🎵</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate">{track.name}</h3>
              <p className="text-sm text-gray-400">
                {track.artist} • {track.genre} • {Math.floor(track.duration / 60)}:
                {String(track.duration % 60).padStart(2, '0')}
              </p>
            </div>
            {selectedDemoTrack === track.id && (
              <span className="text-blue-400">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Audio Source</h2>
        <p className="text-sm text-gray-400">
          Choose how you want to provide audio for visualization
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2" role="tablist">
        {renderTabButton('file', 'Upload File', '📁')}
        {renderTabButton('microphone', 'Microphone', '🎤')}
        {renderTabButton('demo', 'Demo Tracks', '🎵')}
      </div>

      {/* Tab Content */}
      <div role="tabpanel" className="min-h-[300px]">
        {activeTab === 'file' && renderFileUploadTab()}
        {activeTab === 'microphone' && renderMicrophoneTab()}
        {activeTab === 'demo' && renderDemoTab()}
      </div>

      {/* Current Status */}
      {isCurrentlyActive && (
        <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-400">
            <span>🎵</span>
            <span className="font-medium">
              Audio source active - {audioState.currentSource} input
            </span>
          </div>
          <p className="text-sm text-blue-300 mt-1">
            Status: {audioState.playbackStatus} • Ready for visualization
          </p>
        </div>
      )}

      {/* Advanced Options (if enabled) */}
      {showAdvancedOptions && (
        <details className="bg-gray-800 rounded-lg border border-gray-600">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-300">
            Advanced Options
          </summary>
          <div className="px-4 pb-4 pt-2 border-t border-gray-600 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sample Rate</label>
              <select className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
                <option value="auto">Auto (Recommended)</option>
                <option value="44100">44.1 kHz (CD Quality)</option>
                <option value="48000">48 kHz (Professional)</option>
                <option value="96000">96 kHz (High Resolution)</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" className="rounded" />
                Enable noise suppression (microphone)
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" className="rounded" />
                Enable echo cancellation (microphone)
              </label>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

export default InputSelector;