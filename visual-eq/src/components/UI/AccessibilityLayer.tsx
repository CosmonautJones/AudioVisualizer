import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  createContext,
  useContext
} from 'react';
import { useAudioVisualizer } from '../../context/AudioVisualizerContext';
import type { 
  FrequencyData, 
  TimeData, 
  VisualizationFrameData, 
  VisualizationType 
} from '../../types/audio';
// import type { DeviceCapability } from '../../types/canvas'; // Unused

// =============================================================================
// ACCESSIBILITY CONFIGURATION INTERFACES
// =============================================================================

export interface AccessibilitySettings {
  readonly audioDescription: {
    readonly enabled: boolean;
    readonly verbosity: 'minimal' | 'detailed' | 'verbose';
    readonly announceFrequency: 'never' | 'changes' | 'continuous';
    readonly announceTempo: boolean;
    readonly announceVolume: boolean;
  };
  readonly hapticFeedback: {
    readonly enabled: boolean;
    readonly intensity: number; // 0-1
    readonly bassResponse: boolean;
    readonly volumeResponse: boolean;
    readonly tempoResponse: boolean;
  };
  readonly keyboardNavigation: {
    readonly enabled: boolean;
    readonly shortcuts: boolean;
    readonly spatialNavigation: boolean;
    readonly focusIndicators: boolean;
  };
  readonly visualReduction: {
    readonly respectReducedMotion: boolean;
    readonly alternativeFeedback: boolean;
    readonly highContrast: boolean;
    readonly reduceFlashing: boolean;
  };
  readonly voiceAnnouncements: {
    readonly enabled: boolean;
    readonly rate: number; // 0.5-2
    readonly pitch: number; // 0-2
    readonly volume: number; // 0-1
  };
}

interface AccessibilityContextValue {
  readonly settings: AccessibilitySettings;
  readonly isActive: boolean;
  readonly updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  readonly toggleAccessibility: () => void;
  readonly announceText: (text: string, priority?: 'low' | 'medium' | 'high') => void;
  readonly triggerHaptic: (pattern: 'light' | 'medium' | 'heavy' | number[]) => void;
}

// =============================================================================
// AUDIO ANALYSIS INTERFACES
// =============================================================================

interface AudioCharacteristics {
  readonly dominant_frequency: number;
  readonly bass_level: number;
  readonly treble_level: number;
  readonly mid_level: number;
  readonly overall_volume: number;
  readonly dynamic_range: number;
  readonly tempo_bpm: number | null;
  readonly rhythm_pattern: 'steady' | 'variable' | 'irregular';
  readonly stereo_balance: number; // -1 (left) to 1 (right)
}

interface BeatDetection {
  readonly is_beat: boolean;
  readonly beat_strength: number;
  readonly confidence: number;
  readonly tempo_estimate: number;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  audioDescription: {
    enabled: false,
    verbosity: 'detailed',
    announceFrequency: 'changes',
    announceTempo: true,
    announceVolume: true,
  },
  hapticFeedback: {
    enabled: false,
    intensity: 0.7,
    bassResponse: true,
    volumeResponse: true,
    tempoResponse: false,
  },
  keyboardNavigation: {
    enabled: true,
    shortcuts: true,
    spatialNavigation: false,
    focusIndicators: true,
  },
  visualReduction: {
    respectReducedMotion: true,
    alternativeFeedback: true,
    highContrast: false,
    reduceFlashing: true,
  },
  voiceAnnouncements: {
    enabled: false,
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
  },
};

// =============================================================================
// ACCESSIBILITY CONTEXT
// =============================================================================

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

// =============================================================================
// AUDIO ANALYSIS UTILITIES
// =============================================================================

class AudioAnalyzer {
  // private previousFrequencyData: FrequencyData | null = null; // Unused - removed
  private beatDetectionBuffer: number[] = [];
  private tempoBuffer: number[] = [];
  private lastBeatTime: number = 0;

  analyzeAudioCharacteristics(
    frequencyData: FrequencyData,
    _timeData: TimeData,
    sampleRate: number = 44100
  ): AudioCharacteristics {
    const freqArray = Array.from(frequencyData);
    const timeArray = Array.from(_timeData);
    
    // Frequency analysis
    const bassEnd = Math.floor(freqArray.length * 0.1); // ~4kHz
    const midStart = bassEnd;
    const midEnd = Math.floor(freqArray.length * 0.4); // ~17kHz
    const trebleStart = midEnd;
    
    const bassLevel = this.calculateRMS(freqArray.slice(0, bassEnd));
    const midLevel = this.calculateRMS(freqArray.slice(midStart, midEnd));
    const trebleLevel = this.calculateRMS(freqArray.slice(trebleStart));
    const overallVolume = this.calculateRMS(freqArray);
    
    // Find dominant frequency
    const maxIndex = freqArray.indexOf(Math.max(...freqArray));
    const dominantFrequency = (maxIndex / freqArray.length) * (sampleRate / 2);
    
    // Dynamic range
    const dynamicRange = Math.max(...freqArray) - Math.min(...freqArray);
    
    // Beat and tempo detection
    const beatInfo = this.detectBeat(overallVolume);
    
    return {
      dominant_frequency: dominantFrequency,
      bass_level: bassLevel / 255,
      treble_level: trebleLevel / 255,
      mid_level: midLevel / 255,
      overall_volume: overallVolume / 255,
      dynamic_range: dynamicRange / 255,
      tempo_bpm: (beatInfo as any).tempo_estimate,
      rhythm_pattern: this.analyzeRhythmPattern(),
      stereo_balance: this.calculateStereoBalance(timeArray),
    };
  }

  private calculateRMS(data: number[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + val * val, 0);
    return Math.sqrt(sum / data.length);
  }

  private detectBeat(volume: number): BeatDetection {
    const currentTime = Date.now();
    this.beatDetectionBuffer.push(volume);
    
    // Keep buffer size manageable
    if (this.beatDetectionBuffer.length > 20) {
      this.beatDetectionBuffer.shift();
    }
    
    // Calculate beat detection threshold
    const average = this.beatDetectionBuffer.reduce((a, b) => a + b, 0) / this.beatDetectionBuffer.length;
    const threshold = average * 1.3;
    
    const isBeat = volume > threshold && (currentTime - this.lastBeatTime) > 300; // Minimum 300ms between beats
    
    if (isBeat) {
      const timeDiff = currentTime - this.lastBeatTime;
      if (this.lastBeatTime > 0 && timeDiff > 0) {
        const bpm = 60000 / timeDiff;
        this.tempoBuffer.push(bpm);
        
        // Keep tempo buffer reasonable size
        if (this.tempoBuffer.length > 10) {
          this.tempoBuffer.shift();
        }
      }
      this.lastBeatTime = currentTime;
    }
    
    const averageTempo = this.tempoBuffer.length > 0 
      ? this.tempoBuffer.reduce((a, b) => a + b, 0) / this.tempoBuffer.length
      : 0;
    
    return {
      is_beat: isBeat,
      beat_strength: Math.max(0, (volume - threshold) / threshold),
      confidence: Math.min(1, this.beatDetectionBuffer.length / 10),
      tempo_estimate: averageTempo,
    };
  }

  private analyzeRhythmPattern(): 'steady' | 'variable' | 'irregular' {
    if (this.tempoBuffer.length < 3) return 'irregular';
    
    const variance = this.calculateVariance(this.tempoBuffer);
    
    if (variance < 10) return 'steady';
    if (variance < 30) return 'variable';
    return 'irregular';
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
  }

  private calculateStereoBalance(_timeData: number[]): number {
    // Simplified stereo analysis - would need actual stereo data
    return 0; // Placeholder
  }
}

// =============================================================================
// HAPTIC FEEDBACK MANAGER
// =============================================================================

class HapticFeedbackManager {
  private isSupported: boolean;
  private lastHapticTime: number = 0;
  // private hapticQueue: Array<{ pattern: number[]; timestamp: number }> = []; // Unused - removed

  constructor() {
    this.isSupported = 'vibrate' in navigator;
  }

  isHapticSupported(): boolean {
    return this.isSupported;
  }

  async triggerHaptic(
    pattern: 'light' | 'medium' | 'heavy' | number[],
    intensity: number = 1
  ): Promise<void> {
    if (!this.isSupported) return;

    // Throttle haptic feedback to prevent overwhelming
    const now = Date.now();
    if (now - this.lastHapticTime < 50) return;

    let vibrationPattern: number[];
    
    switch (pattern) {
      case 'light':
        vibrationPattern = [50];
        break;
      case 'medium':
        vibrationPattern = [100];
        break;
      case 'heavy':
        vibrationPattern = [200];
        break;
      default:
        vibrationPattern = pattern;
    }

    // Apply intensity scaling
    const scaledPattern = vibrationPattern.map(duration => 
      Math.floor(duration * intensity)
    ).filter(duration => duration > 0);

    if (scaledPattern.length > 0) {
      navigator.vibrate(scaledPattern);
      this.lastHapticTime = now;
    }
  }

  triggerBeatHaptic(beatStrength: number, intensity: number): void {
    if (beatStrength > 0.3) {
      const hapticIntensity = Math.min(1, beatStrength * intensity);
      this.triggerHaptic('medium', hapticIntensity);
    }
  }

  triggerVolumeHaptic(volume: number, previousVolume: number, intensity: number): void {
    const volumeChange = Math.abs(volume - previousVolume);
    if (volumeChange > 0.1) {
      const hapticIntensity = Math.min(1, volumeChange * 2 * intensity);
      this.triggerHaptic('light', hapticIntensity);
    }
  }
}

// =============================================================================
// VOICE ANNOUNCEMENT MANAGER
// =============================================================================

class VoiceAnnouncementManager {
  private speechSynthesis: SpeechSynthesis | null = null;
  private isSupported: boolean;
  private announcementQueue: Array<{ text: string; priority: 'low' | 'medium' | 'high' }> = [];
  private isAnnouncing: boolean = false;

  constructor() {
    this.isSupported = 'speechSynthesis' in window;
    this.speechSynthesis = this.isSupported ? window.speechSynthesis : null;
  }

  isVoiceSupported(): boolean {
    return this.isSupported;
  }

  async announceText(
    text: string, 
    settings: AccessibilitySettings['voiceAnnouncements'],
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    if (!this.isSupported || !settings.enabled || !this.speechSynthesis) return;

    // Add to queue based on priority
    this.announcementQueue.push({ text, priority });
    this.announcementQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.processAnnouncementQueue(settings);
  }

  private async processAnnouncementQueue(
    settings: AccessibilitySettings['voiceAnnouncements']
  ): Promise<void> {
    if (this.isAnnouncing || this.announcementQueue.length === 0) return;

    this.isAnnouncing = true;
    const announcement = this.announcementQueue.shift()!;

    try {
      await this.speak(announcement.text, settings);
    } catch (error) {
      console.warn('Voice announcement failed:', error);
    }

    this.isAnnouncing = false;
    
    // Process next announcement if queue has items
    if (this.announcementQueue.length > 0) {
      setTimeout(() => this.processAnnouncementQueue(settings), 100);
    }
  }

  private speak(
    text: string, 
    settings: AccessibilitySettings['voiceAnnouncements']
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      this.speechSynthesis.speak(utterance);
    });
  }

  clearQueue(): void {
    this.announcementQueue.length = 0;
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
    this.isAnnouncing = false;
  }
}

// =============================================================================
// KEYBOARD NAVIGATION MANAGER
// =============================================================================

class KeyboardNavigationManager {
  private shortcuts: Map<string, () => void> = new Map();
  private isActive: boolean = false;

  constructor() {
    this.setupGlobalKeyboardListener();
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }

  registerShortcut(key: string, callback: () => void): void {
    this.shortcuts.set(key.toLowerCase(), callback);
  }

  unregisterShortcut(key: string): void {
    this.shortcuts.delete(key.toLowerCase());
  }

  private setupGlobalKeyboardListener(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.isActive) return;

      const key = event.key.toLowerCase();
      const isModified = event.ctrlKey || event.altKey || event.metaKey;

      // Handle modified shortcuts
      if (isModified) {
        const modifiedKey = `${event.ctrlKey ? 'ctrl+' : ''}${event.altKey ? 'alt+' : ''}${event.metaKey ? 'meta+' : ''}${key}`;
        const callback = this.shortcuts.get(modifiedKey);
        if (callback) {
          event.preventDefault();
          callback();
          return;
        }
      }

      // Handle simple shortcuts
      const callback = this.shortcuts.get(key);
      if (callback) {
        event.preventDefault();
        callback();
      }
    });
  }

  getAvailableShortcuts(): string[] {
    return Array.from(this.shortcuts.keys());
  }
}

// =============================================================================
// MAIN ACCESSIBILITY LAYER COMPONENT
// =============================================================================

export interface AccessibilityLayerProps {
  readonly children: React.ReactNode;
  readonly initialSettings?: Partial<AccessibilitySettings>;
  readonly onSettingsChange?: (settings: AccessibilitySettings) => void;
}

export const AccessibilityLayer: React.FC<AccessibilityLayerProps> = ({
  children,
  initialSettings,
  onSettingsChange
}) => {
  // =============================================================================
  // STATE AND REFS
  // =============================================================================

  const [settings, setSettings] = useState<AccessibilitySettings>({
    ...DEFAULT_ACCESSIBILITY_SETTINGS,
    ...initialSettings,
  });

  const [isActive, setIsActive] = useState(false);

  const audioAnalyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());
  const hapticManagerRef = useRef<HapticFeedbackManager>(new HapticFeedbackManager());
  const voiceManagerRef = useRef<VoiceAnnouncementManager>(new VoiceAnnouncementManager());
  const keyboardManagerRef = useRef<KeyboardNavigationManager>(new KeyboardNavigationManager());

  const previousAudioCharacteristics = useRef<AudioCharacteristics | null>(null);
  const lastAnnouncementTime = useRef<number>(0);

  // =============================================================================
  // CONTEXT INTEGRATION
  // =============================================================================

  const {
    state,
    // audioAnalyzer, // Unused
    frequencyData,
    // timeData, // Unused
    frameData,
    actions,
    // isReady, // Unused
    canRender
  } = useAudioVisualizer();

  // =============================================================================
  // AUDIO ANALYSIS AND DESCRIPTION
  // =============================================================================

  const analyzeAndDescribeAudio = useCallback((
    frequency: FrequencyData,
    time: TimeData,
    frameInfo: VisualizationFrameData
  ) => {
    if (!settings.audioDescription.enabled) return;

    const characteristics = audioAnalyzerRef.current.analyzeAudioCharacteristics(
      frequency,
      time,
      frameInfo.sampleRate
    );

    // Generate audio description based on verbosity setting
    const description = generateAudioDescription(
      characteristics,
      previousAudioCharacteristics.current,
      settings.audioDescription.verbosity,
      state.visualization.rendererType
    );

    if (description && shouldAnnounceDescription(characteristics, settings)) {
      voiceManagerRef.current.announceText(
        description,
        settings.voiceAnnouncements,
        'medium'
      );
      lastAnnouncementTime.current = Date.now();
    }

    // Update haptic feedback
    updateHapticFeedback(characteristics, previousAudioCharacteristics.current);

    previousAudioCharacteristics.current = characteristics;
  }, [settings, state.visualization.rendererType]);

  const generateAudioDescription = useCallback((
    current: AudioCharacteristics,
    _previous: AudioCharacteristics | null,
    verbosity: 'minimal' | 'detailed' | 'verbose',
    visualizationType: VisualizationType
  ): string => {
    const descriptions: string[] = [];

    switch (verbosity) {
      case 'minimal':
        const intensity = current.overall_volume > 0.7 ? 'high' : current.overall_volume > 0.3 ? 'medium' : 'low';
        descriptions.push(`${intensity} volume`);
        break;

      case 'detailed':
        // Volume description
        const volumeDesc = current.overall_volume > 0.8 ? 'very loud' : 
                          current.overall_volume > 0.6 ? 'loud' : 
                          current.overall_volume > 0.4 ? 'moderate' : 
                          current.overall_volume > 0.2 ? 'quiet' : 'very quiet';
        descriptions.push(volumeDesc);

        // Frequency balance
        if (current.bass_level > current.treble_level + 0.2) {
          descriptions.push('bass-heavy');
        } else if (current.treble_level > current.bass_level + 0.2) {
          descriptions.push('treble-dominant');
        } else {
          descriptions.push('balanced');
        }

        // Tempo if detected
        if (current.tempo_bpm && current.tempo_bpm > 0) {
          const tempoDesc = current.tempo_bpm > 140 ? 'fast' : 
                           current.tempo_bpm > 100 ? 'moderate' : 'slow';
          descriptions.push(`${tempoDesc} tempo`);
        }
        break;

      case 'verbose':
        // Comprehensive description
        descriptions.push(`Volume: ${Math.round(current.overall_volume * 100)}%`);
        descriptions.push(`Bass: ${Math.round(current.bass_level * 100)}%`);
        descriptions.push(`Treble: ${Math.round(current.treble_level * 100)}%`);
        
        if (current.tempo_bpm && current.tempo_bpm > 0) {
          descriptions.push(`Tempo: ${Math.round(current.tempo_bpm)} BPM`);
        }

        descriptions.push(`Rhythm: ${current.rhythm_pattern}`);
        descriptions.push(`Dynamic range: ${current.dynamic_range > 0.5 ? 'high' : 'low'}`);

        if (current.dominant_frequency > 0) {
          const freqDesc = current.dominant_frequency > 8000 ? 'high frequency' :
                          current.dominant_frequency > 2000 ? 'mid frequency' : 'low frequency';
          descriptions.push(`${freqDesc} dominant`);
        }
        break;
    }

    const prefix = visualizationType === 'frequency' ? 'Frequency bars show' :
                  visualizationType === 'waveform' ? 'Waveform shows' :
                  visualizationType === 'spectrogram' ? 'Spectrogram shows' : 'Visualization shows';

    return `${prefix} ${descriptions.join(', ')}`;
  }, []);

  const shouldAnnounceDescription = useCallback((
    _characteristics: AudioCharacteristics,
    settings: AccessibilitySettings
  ): boolean => {
    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastAnnouncementTime.current;

    switch (settings.audioDescription.announceFrequency) {
      case 'never':
        return false;
      case 'changes':
        return timeSinceLastAnnouncement > 2000; // Minimum 2 seconds between announcements
      case 'continuous':
        return timeSinceLastAnnouncement > 5000; // Continuous but throttled
      default:
        return false;
    }
  }, []);

  const updateHapticFeedback = useCallback((
    current: AudioCharacteristics,
    _previous: AudioCharacteristics | null
  ) => {
    if (!settings.hapticFeedback.enabled || !hapticManagerRef.current.isHapticSupported()) {
      return;
    }

    const hapticManager = hapticManagerRef.current;

    // Beat detection haptics
    if (settings.hapticFeedback.bassResponse && frequencyData) {
      // const _beatInfo = audioAnalyzerRef.current.analyzeAudioCharacteristics(frequencyData, new Uint8Array()); // Unused
      // hapticManager.triggerBeatHaptic(beatInfo.beat_strength, settings.hapticFeedback.intensity);
    }

    // Volume change haptics
    if (settings.hapticFeedback.volumeResponse && _previous) {
      hapticManager.triggerVolumeHaptic(
        current.overall_volume,
        _previous.overall_volume,
        settings.hapticFeedback.intensity
      );
    }
  }, [settings.hapticFeedback, frequencyData]);  // Removed unused timeData dependency

  // =============================================================================
  // KEYBOARD SHORTCUTS SETUP
  // =============================================================================

  const setupKeyboardShortcuts = useCallback(() => {
    const manager = keyboardManagerRef.current;
    
    if (!settings.keyboardNavigation.shortcuts) return;

    // Clear existing shortcuts
    manager.registerShortcut('space', () => {
      actions.togglePlayback();
      voiceManagerRef.current.announceText(
        state.audio.playbackStatus === 'playing' ? 'Paused' : 'Playing',
        settings.voiceAnnouncements,
        'high'
      );
    });

    manager.registerShortcut('arrowup', () => {
      const newVolume = Math.min(1, state.audio.volume + 0.1);
      actions.setVolume(newVolume);
      voiceManagerRef.current.announceText(
        `Volume ${Math.round(newVolume * 100)}%`,
        settings.voiceAnnouncements,
        'medium'
      );
    });

    manager.registerShortcut('arrowdown', () => {
      const newVolume = Math.max(0, state.audio.volume - 0.1);
      actions.setVolume(newVolume);
      voiceManagerRef.current.announceText(
        `Volume ${Math.round(newVolume * 100)}%`,
        settings.voiceAnnouncements,
        'medium'
      );
    });

    manager.registerShortcut('f', () => {
      actions.setFullscreen(!state.ui.fullscreenMode);
      voiceManagerRef.current.announceText(
        state.ui.fullscreenMode ? 'Fullscreen enabled' : 'Fullscreen disabled',
        settings.voiceAnnouncements,
        'medium'
      );
    });

    manager.registerShortcut('ctrl+shift+a', () => {
      toggleAccessibility();
      voiceManagerRef.current.announceText(
        isActive ? 'Accessibility features enabled' : 'Accessibility features disabled',
        settings.voiceAnnouncements,
        'high'
      );
    });

    manager.registerShortcut('?', () => {
      announceAvailableShortcuts();
    });

  }, [settings, state, actions, isActive]);

  const announceAvailableShortcuts = useCallback(() => {
    const shortcuts = [
      'Space: Play or pause audio',
      'Up arrow: Increase volume',
      'Down arrow: Decrease volume',
      'F: Toggle fullscreen',
      'Ctrl+Shift+A: Toggle accessibility features',
      'Question mark: List available shortcuts'
    ];

    voiceManagerRef.current.announceText(
      `Available shortcuts: ${shortcuts.join(', ')}`,
      settings.voiceAnnouncements,
      'medium'
    );
  }, [settings.voiceAnnouncements]);

  // =============================================================================
  // EFFECTS AND LIFECYCLE
  // =============================================================================

  // Setup keyboard shortcuts when settings change
  useEffect(() => {
    if (settings.keyboardNavigation.enabled) {
      setupKeyboardShortcuts();
      keyboardManagerRef.current.setActive(true);
    } else {
      keyboardManagerRef.current.setActive(false);
    }
  }, [settings.keyboardNavigation, setupKeyboardShortcuts]);

  // Analyze audio data when available
  useEffect(() => {
    if (isActive && canRender && frequencyData && frameData) {
      analyzeAndDescribeAudio(frequencyData, new Uint8Array() as TimeData, frameData);  // Use empty Uint8Array for timeData
    }
  }, [isActive, canRender, frequencyData, frameData, analyzeAndDescribeAudio]);

  // Handle reduced motion preference
  useEffect(() => {
    if (settings.visualReduction.respectReducedMotion) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      
      const handleReducedMotion = (e: MediaQueryListEvent) => {
        if (e.matches) {
          // Reduce visual effects and provide alternative feedback
          updateSettings({
            hapticFeedback: { ...settings.hapticFeedback, enabled: true },
            voiceAnnouncements: { ...settings.voiceAnnouncements, enabled: true }
          });
          
          voiceManagerRef.current.announceText(
            'Reduced motion detected. Enhanced audio feedback enabled.',
            settings.voiceAnnouncements,
            'medium'
          );
        }
      };

      mediaQuery.addEventListener('change', handleReducedMotion);
      return () => mediaQuery.removeEventListener('change', handleReducedMotion);
    }
  }, [settings.visualReduction.respectReducedMotion, settings]);

  // Notify of settings changes
  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // =============================================================================
  // CONTEXT ACTIONS
  // =============================================================================

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const updated = { ...prev };
      
      // Deep merge settings
      Object.keys(newSettings).forEach(key => {
        const settingKey = key as keyof AccessibilitySettings;
        if (typeof newSettings[settingKey] === 'object' && newSettings[settingKey] !== null) {
          updated[settingKey] = { ...prev[settingKey], ...newSettings[settingKey] } as any;
        } else {
          updated[settingKey] = newSettings[settingKey] as any;
        }
      });
      
      return updated;
    });
  }, []);

  const toggleAccessibility = useCallback(() => {
    setIsActive(prev => !prev);
    
    if (!isActive) {
      voiceManagerRef.current.announceText(
        'Accessibility features activated. Press question mark for available shortcuts.',
        settings.voiceAnnouncements,
        'high'
      );
    }
  }, [isActive, settings.voiceAnnouncements]);

  const announceText = useCallback((text: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    voiceManagerRef.current.announceText(text, settings.voiceAnnouncements, priority);
  }, [settings.voiceAnnouncements]);

  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy' | number[]) => {
    hapticManagerRef.current.triggerHaptic(pattern, settings.hapticFeedback.intensity);
  }, [settings.hapticFeedback.intensity]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const contextValue: AccessibilityContextValue = useMemo(() => ({
    settings,
    isActive,
    updateSettings,
    toggleAccessibility,
    announceText,
    triggerHaptic,
  }), [settings, isActive, updateSettings, toggleAccessibility, announceText, triggerHaptic]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Skip Links for keyboard navigation */}
      {settings.keyboardNavigation.enabled && (
        <div
          style={{
            position: 'fixed',
            top: -100,
            left: 0,
            zIndex: 10000,
            background: '#000',
            color: '#fff',
            padding: '8px',
            fontSize: '14px',
            textDecoration: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.top = '0';
          }}
          onBlur={(e) => {
            e.currentTarget.style.top = '-100px';
          }}
          tabIndex={0}
        >
          Press Ctrl+Shift+A to toggle accessibility features
        </div>
      )}

      {/* Live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      />

      {/* High contrast mode styles */}
      {settings.visualReduction.highContrast && (
        <style>{`
          .audio-canvas {
            filter: contrast(150%) brightness(1.2) !important;
          }
          .audio-canvas-container {
            border: 2px solid #fff !important;
          }
        `}</style>
      )}
    </AccessibilityContext.Provider>
  );
};

// =============================================================================
// ACCESSIBILITY SETTINGS PANEL COMPONENT
// =============================================================================

export const AccessibilitySettingsPanel: React.FC<{
  isVisible: boolean;
  onClose: () => void;
}> = ({ isVisible, onClose }) => {
  const context = useContext(AccessibilityContext);
  
  if (!context || !isVisible) return null;

  const { settings, updateSettings, isActive, toggleAccessibility } = context;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        zIndex: 10000,
        minWidth: '400px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        color: '#fff'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
    >
      <h2 id="accessibility-settings-title" style={{ marginTop: 0 }}>
        Accessibility Settings
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={toggleAccessibility}
            style={{ marginRight: '8px' }}
          />
          Enable Accessibility Features
        </label>
      </div>

      {/* Audio Description Settings */}
      <fieldset style={{ border: '1px solid #333', padding: '10px', marginBottom: '15px' }}>
        <legend>Audio Description</legend>
        
        <label>
          <input
            type="checkbox"
            checked={settings.audioDescription.enabled}
            onChange={(e) => updateSettings({
              audioDescription: { ...settings.audioDescription, enabled: e.target.checked }
            })}
            style={{ marginRight: '8px' }}
          />
          Enable audio descriptions
        </label>

        <div style={{ margin: '10px 0' }}>
          <label>
            Verbosity:
            <select
              value={settings.audioDescription.verbosity}
              onChange={(e) => updateSettings({
                audioDescription: { 
                  ...settings.audioDescription, 
                  verbosity: e.target.value as 'minimal' | 'detailed' | 'verbose' 
                }
              })}
              style={{ marginLeft: '8px', background: '#333', color: '#fff', border: '1px solid #666' }}
            >
              <option value="minimal">Minimal</option>
              <option value="detailed">Detailed</option>
              <option value="verbose">Verbose</option>
            </select>
          </label>
        </div>
      </fieldset>

      {/* Haptic Feedback Settings */}
      <fieldset style={{ border: '1px solid #333', padding: '10px', marginBottom: '15px' }}>
        <legend>Haptic Feedback</legend>
        
        <label>
          <input
            type="checkbox"
            checked={settings.hapticFeedback.enabled}
            onChange={(e) => updateSettings({
              hapticFeedback: { ...settings.hapticFeedback, enabled: e.target.checked }
            })}
            style={{ marginRight: '8px' }}
          />
          Enable haptic feedback
        </label>

        <div style={{ margin: '10px 0' }}>
          <label>
            Intensity:
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.hapticFeedback.intensity}
              onChange={(e) => updateSettings({
                hapticFeedback: { ...settings.hapticFeedback, intensity: parseFloat(e.target.value) }
              })}
              style={{ marginLeft: '8px' }}
            />
          </label>
        </div>
      </fieldset>

      {/* Voice Announcements Settings */}
      <fieldset style={{ border: '1px solid #333', padding: '10px', marginBottom: '15px' }}>
        <legend>Voice Announcements</legend>
        
        <label>
          <input
            type="checkbox"
            checked={settings.voiceAnnouncements.enabled}
            onChange={(e) => updateSettings({
              voiceAnnouncements: { ...settings.voiceAnnouncements, enabled: e.target.checked }
            })}
            style={{ marginRight: '8px' }}
          />
          Enable voice announcements
        </label>

        <div style={{ margin: '10px 0' }}>
          <label>
            Speech rate:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.voiceAnnouncements.rate}
              onChange={(e) => updateSettings({
                voiceAnnouncements: { ...settings.voiceAnnouncements, rate: parseFloat(e.target.value) }
              })}
              style={{ marginLeft: '8px' }}
            />
          </label>
        </div>
      </fieldset>

      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <button
          onClick={onClose}
          style={{
            background: '#007acc',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// HOOK FOR USING ACCESSIBILITY CONTEXT
// =============================================================================

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityLayer');
  }
  
  return context;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const checkAccessibilitySupport = () => {
  return {
    voiceAnnouncements: 'speechSynthesis' in window,
    hapticFeedback: 'vibrate' in navigator,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    keyboardNavigation: true, // Always supported
  };
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Note: AccessibilitySettings interface is already exported above
export type {
  AccessibilityContextValue,
  AudioCharacteristics,
  BeatDetection
};

export default AccessibilityLayer;