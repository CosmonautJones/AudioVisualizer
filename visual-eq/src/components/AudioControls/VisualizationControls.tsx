import React, { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  useMemo 
} from 'react';
import { 
  useAudioVisualizer,
  useAudioVisualizerActions,
  useVisualizationState,
  useDeviceState
} from '../../context/AudioVisualizerContext';
import type { 
  VisualizationType,
  AudioVisualizerSettings 
} from '../../types/audio';
import type { 
  // QualityLevel,
  ColorScheme 
} from '../../types/canvas';
import { 
  VISUALIZATION_CONTROLS,
  COLOR_SCHEMES,
  QUALITY_LEVELS,
  PERFORMANCE_BUDGETS
} from '../../constants/audio';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface VisualizationControlsProps {
  className?: string;
  onSettingsChange?: (settings: Partial<AudioVisualizerSettings>) => void;
  compactMode?: boolean;
  disabled?: boolean;
  showAdvancedControls?: boolean;
}

interface ControlSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  unit?: string;
  showValue?: boolean;
  helpText?: string;
}

interface SelectControlProps {
  label: string;
  value: string | number;
  options: Array<{ value: string | number; label: string; description?: string }>;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  helpText?: string;
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  helpText?: string;
}

type PresetData = {
  id: string;
  name: string;
  description: string;
  settings: Partial<AudioVisualizerSettings>;
  isFactory: boolean;
  createdAt: number;
};

type ControlSection = 'audio' | 'visual' | 'performance' | 'presets';

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

const FACTORY_PRESETS: PresetData[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Great balance of quality and performance',
    isFactory: true,
    createdAt: 0,
    settings: {
      visualization: {
        type: 'frequency',
        barCount: 64,
        sensitivity: 1.0,
        smoothing: 0.8,
        colorScheme: 'spectrum',
        showPeaks: true,
        mirrorBars: false
      },
      performanceMode: 'auto',
      volume: 0.8
    }
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Optimized for low-end devices',
    isFactory: true,
    createdAt: 0,
    settings: {
      visualization: {
        type: 'frequency',
        barCount: 32,
        sensitivity: 1.2,
        smoothing: 0.6,
        colorScheme: 'monochrome',
        showPeaks: false,
        mirrorBars: false
      },
      performanceMode: 'performance',
      volume: 0.7
    }
  },
  {
    id: 'quality',
    name: 'Maximum Quality',
    description: 'Best visual experience for powerful devices',
    isFactory: true,
    createdAt: 0,
    settings: {
      visualization: {
        type: 'frequency',
        barCount: 96,
        sensitivity: 0.8,
        smoothing: 0.9,
        colorScheme: 'spectrum',
        showPeaks: true,
        mirrorBars: true
      },
      performanceMode: 'quality',
      volume: 0.8
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple visualization',
    isFactory: true,
    createdAt: 0,
    settings: {
      visualization: {
        type: 'waveform',
        barCount: 32,
        sensitivity: 1.0,
        smoothing: 0.7,
        colorScheme: 'monochrome',
        showPeaks: false,
        mirrorBars: false
      },
      performanceMode: 'auto',
      volume: 0.8
    }
  }
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number): T => {
  let timeoutId: number;
  return ((...args: any[]) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  }) as T;
};

const formatNumber = (value: number, decimals: number = 1): string => {
  return value.toFixed(decimals);
};

const getColorSchemeKey = (colorScheme: ColorScheme): keyof typeof COLOR_SCHEMES => {
  return Object.keys(COLOR_SCHEMES).find(key => 
    COLOR_SCHEMES[key as keyof typeof COLOR_SCHEMES] === colorScheme
  ) as keyof typeof COLOR_SCHEMES || 'SPECTRUM';
};

// =============================================================================
// CONTROL COMPONENTS
// =============================================================================

const ControlSection: React.FC<ControlSectionProps> = ({
  title,
  icon,
  children,
  isOpen,
  onToggle,
  disabled = false,
  className = ''
}) => (
  <div className={`border border-gray-600 rounded-lg overflow-hidden ${className}`}>
    <button
      className={`
        w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 
        transition-colors text-left
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={isOpen}
      aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <span className="font-semibold text-white">{title}</span>
      </div>
      <span 
        className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        ▼
      </span>
    </button>
    
    {isOpen && (
      <div 
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="p-4 bg-gray-850 space-y-4"
      >
        {children}
      </div>
    )}
  </div>
);

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  unit = '',
  showValue = true,
  helpText
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {showValue && (
          <span className="text-sm text-gray-400">
            {formatNumber(value)}{unit}
          </span>
        )}
      </div>
      
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={`
            w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
            slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 
            slider-thumb:rounded-full slider-thumb:bg-blue-500 slider-thumb:cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
          }}
          aria-describedby={helpText ? `${label.replace(/\s+/g, '-')}-help` : undefined}
        />
      </div>
      
      {helpText && (
        <p id={`${label.replace(/\s+/g, '-')}-help`} className="text-xs text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
};

const SelectControl: React.FC<SelectControlProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  helpText
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-gray-300">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white
        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      aria-describedby={helpText ? `${label.replace(/\s+/g, '-')}-help` : undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    
    {helpText && (
      <p id={`${label.replace(/\s+/g, '-')}-help`} className="text-xs text-gray-500">
        {helpText}
      </p>
    )}
  </div>
);

const ToggleControl: React.FC<ToggleControlProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  helpText
}) => (
  <div className="space-y-2">
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          aria-describedby={helpText ? `${label.replace(/\s+/g, '-')}-help` : undefined}
        />
        <div 
          className={`
            w-11 h-6 rounded-full transition-colors cursor-pointer
            ${checked ? 'bg-blue-500' : 'bg-gray-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div 
            className={`
              w-4 h-4 bg-white rounded-full shadow-md transform transition-transform
              ${checked ? 'translate-x-6' : 'translate-x-1'} translate-y-1
            `}
          />
        </div>
      </div>
    </label>
    
    {helpText && (
      <p id={`${label.replace(/\s+/g, '-')}-help`} className="text-xs text-gray-500">
        {helpText}
      </p>
    )}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VisualizationControls({
  className = '',
  onSettingsChange,
  compactMode = false,
  disabled = false,
  showAdvancedControls = false
}: VisualizationControlsProps) {
  // Context hooks
  const { state, isReady, currentSettings } = useAudioVisualizer();
  const actions = useAudioVisualizerActions();
  const visualizationState = useVisualizationState();
  const deviceState = useDeviceState();
  // const uiState = useUIState();

  // Local state
  const [openSections, setOpenSections] = useState<Set<ControlSection>>(
    new Set(compactMode ? [] : ['audio', 'visual'])
  );
  const [customPresets, setCustomPresets] = useState<PresetData[]>([]);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [showPresetNameInput, setShowPresetNameInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Refs for debouncing
  const debouncedUpdateRef = useRef<ReturnType<typeof debounce> | null>(null);

  // =============================================================================
  // INITIALIZATION AND EFFECTS
  // =============================================================================

  // Initialize debounced update function
  useEffect(() => {
    debouncedUpdateRef.current = debounce((config: Partial<AudioVisualizerSettings>) => {
      // Extract only visualization config properties for the action
      const { visualization } = config;
      if (visualization) {
        actions.updateVisualizationConfig(visualization);
      }
      onSettingsChange?.(config);
    }, 100);
  }, [actions, onSettingsChange]);

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('audio-visualizer-custom-presets');
      if (saved) {
        setCustomPresets(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load custom presets:', error);
    }
  }, []);

  // Auto-collapse sections on mobile
  useEffect(() => {
    if (deviceState.currentBreakpoint === 'mobile' && !compactMode) {
      setOpenSections(new Set(['visual']));
    }
  }, [deviceState.currentBreakpoint, compactMode]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const toggleSection = useCallback((section: ControlSection) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const handleVisualizationChange = useCallback((updates: Partial<typeof visualizationState.config>) => {
    debouncedUpdateRef.current?.(updates);
  }, []);

  const handleRendererTypeChange = useCallback(async (type: VisualizationType) => {
    const result = await actions.setRendererType(type);
    if (!result.success) {
      console.warn('Failed to change renderer type:', result.error);
    }
  }, [actions]);

  const handleColorSchemeChange = useCallback((schemeKey: keyof typeof COLOR_SCHEMES) => {
    actions.setColorScheme(schemeKey);
  }, [actions]);

  const handleQualityLevelChange = useCallback((value: string | number) => {
    const levelName = String(value);
    const level = QUALITY_LEVELS.find(l => l.name === levelName);
    if (level) {
      actions.setQualityLevel(level);
    }
  }, [actions]);

  const handlePerformanceModeChange = useCallback((mode: typeof deviceState.performanceMode) => {
    actions.setPerformanceMode(mode);
  }, [actions]);

  const handleVolumeChange = useCallback((volume: number) => {
    actions.setVolume(volume);
  }, [actions]);

  // =============================================================================
  // PRESET MANAGEMENT
  // =============================================================================

  const saveCustomPreset = useCallback(() => {
    if (!newPresetName.trim()) return;

    const newPreset: PresetData = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      description: 'Custom user preset',
      isFactory: false,
      createdAt: Date.now(),
      settings: currentSettings
    };

    const updatedPresets = [...customPresets, newPreset];
    setCustomPresets(updatedPresets);
    
    try {
      localStorage.setItem('audio-visualizer-custom-presets', JSON.stringify(updatedPresets));
    } catch (error) {
      console.warn('Failed to save preset:', error);
    }

    setNewPresetName('');
    setShowPresetNameInput(false);
  }, [newPresetName, currentSettings, customPresets]);

  const deleteCustomPreset = useCallback((presetId: string) => {
    const updatedPresets = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updatedPresets);
    
    try {
      localStorage.setItem('audio-visualizer-custom-presets', JSON.stringify(updatedPresets));
    } catch (error) {
      console.warn('Failed to delete preset:', error);
    }
    
    setPresetToDelete(null);
  }, [customPresets]);

  const loadPreset = useCallback((preset: PresetData) => {
    if (preset.settings.visualization) {
      actions.updateVisualizationConfig(preset.settings.visualization);
    }
    if (typeof preset.settings.volume === 'number') {
      actions.setVolume(preset.settings.volume);
    }
    if (preset.settings.colorScheme && COLOR_SCHEMES[preset.settings.colorScheme as keyof typeof COLOR_SCHEMES]) {
      actions.setColorScheme(preset.settings.colorScheme as keyof typeof COLOR_SCHEMES);
    }
    if (preset.settings.performanceMode) {
      // Map legacy performance modes to current ones
      const mappedMode = preset.settings.performanceMode === 'high' ? 'quality' :
                        preset.settings.performanceMode === 'low' ? 'performance' :
                        preset.settings.performanceMode === 'medium' ? 'auto' :
                        preset.settings.performanceMode;
      actions.setPerformanceMode(mappedMode as 'auto' | 'performance' | 'quality');
    }
  }, [actions]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const rendererOptions = useMemo(() => [
    { value: 'frequency', label: 'Frequency Bars', description: 'Classic bar equalizer' },
    { value: 'waveform', label: 'Waveform', description: 'Audio waveform display' },
    { value: 'spectrogram', label: 'Spectrogram', description: 'Time-frequency analysis' },
    { value: 'oscilloscope', label: 'Oscilloscope', description: 'Real-time signal display' }
  ], []);

  const colorSchemeOptions = useMemo(() => 
    Object.keys(COLOR_SCHEMES).map(key => ({
      value: key,
      label: key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')
    }))
  , []);

  const qualityOptions = useMemo(() =>
    QUALITY_LEVELS.map(level => ({
      value: level.name,
      label: level.name,
      description: level.description
    }))
  , []);

  const performanceModeOptions = useMemo(() => [
    { value: 'auto', label: 'Auto', description: 'Automatically adjust based on performance' },
    { value: 'performance', label: 'Performance', description: 'Prioritize smooth playback' },
    { value: 'quality', label: 'Quality', description: 'Prioritize visual quality' }
  ], []);

  // const allPresets = useMemo(() => [...FACTORY_PRESETS, ...customPresets], [customPresets]);

  const currentColorScheme = useMemo(() => 
    getColorSchemeKey(visualizationState.colorScheme)
  , [visualizationState.colorScheme]);

  const currentQuality = useMemo(() => 
    visualizationState.qualityLevel.name
  , [visualizationState.qualityLevel]);

  // =============================================================================
  // RENDER SECTIONS
  // =============================================================================

  const renderAudioSection = () => (
    <ControlSection
      title="Audio Controls"
      icon="🎵"
      isOpen={openSections.has('audio')}
      onToggle={() => toggleSection('audio')}
      disabled={disabled}
    >
      <SliderControl
        label="Master Volume"
        value={state.audio.volume}
        min={0}
        max={1}
        step={0.05}
        onChange={handleVolumeChange}
        disabled={disabled}
        unit="%"
        showValue={true}
        helpText="Controls the overall audio output volume"
      />

      <SliderControl
        label="Sensitivity"
        value={visualizationState.config.sensitivity}
        min={VISUALIZATION_CONTROLS.SENSITIVITY.MIN}
        max={VISUALIZATION_CONTROLS.SENSITIVITY.MAX}
        step={VISUALIZATION_CONTROLS.SENSITIVITY.STEP}
        onChange={(value) => handleVisualizationChange({ sensitivity: value })}
        disabled={disabled}
        helpText="How reactive the visualization is to audio changes"
      />

      <SliderControl
        label="Smoothing"
        value={visualizationState.config.smoothing}
        min={VISUALIZATION_CONTROLS.SMOOTHING.MIN}
        max={VISUALIZATION_CONTROLS.SMOOTHING.MAX}
        step={VISUALIZATION_CONTROLS.SMOOTHING.STEP}
        onChange={(value) => handleVisualizationChange({ smoothing: value })}
        disabled={disabled}
        helpText="Amount of smoothing applied to reduce jitter"
      />

      {showAdvancedControls && (
        <>
          <ToggleControl
            label="Mute Audio Output"
            checked={state.audio.volume === 0}
            onChange={(muted) => handleVolumeChange(muted ? 0 : 0.8)}
            disabled={disabled}
            helpText="Mute audio while keeping visualization active"
          />

          <ToggleControl
            label="Audio Normalization"
            checked={visualizationState.config.normalize || false}
            onChange={(normalize) => handleVisualizationChange({ normalize })}
            disabled={disabled}
            helpText="Automatically adjust audio levels for consistent visualization"
          />
        </>
      )}
    </ControlSection>
  );

  const renderVisualSection = () => (
    <ControlSection
      title="Visual Settings"
      icon="🌈"
      isOpen={openSections.has('visual')}
      onToggle={() => toggleSection('visual')}
      disabled={disabled}
    >
      <SelectControl
        label="Visualization Type"
        value={visualizationState.rendererType}
        options={rendererOptions}
        onChange={(type) => handleRendererTypeChange(type as VisualizationType)}
        disabled={disabled}
        helpText="Choose the type of audio visualization"
      />

      <SelectControl
        label="Color Scheme"
        value={currentColorScheme}
        options={colorSchemeOptions}
        onChange={(scheme) => handleColorSchemeChange(scheme as keyof typeof COLOR_SCHEMES)}
        disabled={disabled}
        helpText="Select colors for the visualization"
      />

      <SliderControl
        label="Bar Count"
        value={visualizationState.config.barCount}
        min={VISUALIZATION_CONTROLS.BAR_COUNT.MIN}
        max={deviceState.currentBreakpoint === 'mobile' 
          ? VISUALIZATION_CONTROLS.BAR_COUNT.MOBILE_MAX 
          : VISUALIZATION_CONTROLS.BAR_COUNT.MAX}
        step={VISUALIZATION_CONTROLS.BAR_COUNT.STEP}
        onChange={(value) => handleVisualizationChange({ barCount: value })}
        disabled={disabled}
        helpText="Number of frequency bars to display"
      />

      <ToggleControl
        label="Show Peaks"
        checked={visualizationState.config.showPeaks || false}
        onChange={(showPeaks) => handleVisualizationChange({ showPeaks })}
        disabled={disabled}
        helpText="Display peak level indicators"
      />

      <ToggleControl
        label="Mirror Bars"
        checked={visualizationState.config.mirrorBars || false}
        onChange={(mirrorBars) => handleVisualizationChange({ mirrorBars })}
        disabled={disabled}
        helpText="Mirror visualization vertically"
      />

      {showAdvancedControls && (
        <>
          <SliderControl
            label="Opacity"
            value={visualizationState.colorScheme.opacity}
            min={0.1}
            max={1.0}
            step={0.05}
            onChange={(opacity) => {
              // This would need to update the color scheme
              console.log('Opacity change:', opacity);
            }}
            disabled={disabled}
            unit="%"
            helpText="Overall transparency of the visualization"
          />

          <ToggleControl
            label="Logarithmic Scale"
            checked={visualizationState.config.logarithmicScale || false}
            onChange={(logarithmicScale) => handleVisualizationChange({ logarithmicScale })}
            disabled={disabled}
            helpText="Use logarithmic frequency scaling"
          />
        </>
      )}
    </ControlSection>
  );

  const renderPerformanceSection = () => (
    <ControlSection
      title="Performance"
      icon="⚡"
      isOpen={openSections.has('performance')}
      onToggle={() => toggleSection('performance')}
      disabled={disabled}
    >
      <SelectControl
        label="Quality Level"
        value={currentQuality}
        options={qualityOptions}
        onChange={handleQualityLevelChange}
        disabled={disabled}
        helpText="Balance between visual quality and performance"
      />

      <SelectControl
        label="Performance Mode"
        value={deviceState.performanceMode}
        options={performanceModeOptions}
        onChange={(mode) => handlePerformanceModeChange(mode as typeof deviceState.performanceMode)}
        disabled={disabled}
        helpText="Choose performance optimization strategy"
      />

      <div className="bg-gray-700 rounded-lg p-3 space-y-2">
        <h4 className="text-sm font-medium text-white">Current Performance</h4>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Frame Rate:</span>
          <span>{Math.round(state.performanceMetrics.frameRate)} FPS</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Render Time:</span>
          <span>{formatNumber(state.performanceMetrics.renderTime)} ms</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Memory Usage:</span>
          <span>{formatNumber(state.performanceMetrics.memoryUsage)} MB</span>
        </div>
      </div>

      {showAdvancedControls && (
        <>
          <ToggleControl
            label="Enable GPU Acceleration"
            checked={visualizationState.config.enableWebGL || false}
            onChange={(enableWebGL) => handleVisualizationChange({ enableWebGL })}
            disabled={disabled}
            helpText="Use WebGL for hardware-accelerated rendering"
          />

          <ToggleControl
            label="Adaptive Quality"
            checked={deviceState.performanceMode === 'auto'}
            onChange={(adaptive) => handlePerformanceModeChange(adaptive ? 'auto' : 'quality')}
            disabled={disabled}
            helpText="Automatically adjust quality based on performance"
          />

          <SliderControl
            label="Target FPS"
            value={deviceState.currentBreakpoint === 'mobile' 
              ? PERFORMANCE_BUDGETS.TARGET_FPS.MOBILE 
              : PERFORMANCE_BUDGETS.TARGET_FPS.DESKTOP}
            min={20}
            max={120}
            step={10}
            onChange={(fps) => {
              console.log('FPS target change:', fps);
            }}
            disabled={true} // Read-only for now
            unit=" FPS"
            helpText="Target frame rate for smooth animation"
          />
        </>
      )}
    </ControlSection>
  );

  const renderPresetsSection = () => (
    <ControlSection
      title="Presets"
      icon="💾"
      isOpen={openSections.has('presets')}
      onToggle={() => toggleSection('presets')}
      disabled={disabled}
    >
      <div className="space-y-3">
        {/* Factory Presets */}
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Factory Presets</h4>
          <div className="grid gap-2">
            {FACTORY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className="flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
                onClick={() => loadPreset(preset)}
                disabled={disabled}
              >
                <div>
                  <div className="font-medium text-white text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-400">{preset.description}</div>
                </div>
                <span className="text-blue-400 text-sm">Load</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Presets */}
        {customPresets.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Custom Presets</h4>
            <div className="grid gap-2">
              {customPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => !disabled && loadPreset(preset)}
                  >
                    <div className="font-medium text-white text-sm">{preset.name}</div>
                    <div className="text-xs text-gray-400">
                      Created {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-blue-400 text-sm hover:text-blue-300"
                      onClick={() => loadPreset(preset)}
                      disabled={disabled}
                    >
                      Load
                    </button>
                    <button
                      className="text-red-400 text-sm hover:text-red-300"
                      onClick={() => setPresetToDelete(preset.id)}
                      disabled={disabled}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save New Preset */}
        <div className="border-t border-gray-600 pt-3">
          {showPresetNameInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCustomPreset();
                  if (e.key === 'Escape') setShowPresetNameInput(false);
                }}
                autoFocus
              />
              <button
                onClick={saveCustomPreset}
                disabled={!newPresetName.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setShowPresetNameInput(false)}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPresetNameInput(true)}
              disabled={disabled}
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
            >
              Save Current Settings as Preset
            </button>
          )}
        </div>

        {/* Reset to Defaults */}
        <button
          onClick={actions.resetToDefaults}
          disabled={disabled}
          className="w-full p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
        >
          Reset All Settings to Default
        </button>
      </div>
    </ControlSection>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Visualization Controls</h2>
          <p className="text-sm text-gray-400">
            Customize your audio visualization experience
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          {deviceState.currentBreakpoint === 'mobile' && (
            <button
              onClick={() => setOpenSections(openSections.size > 0 ? new Set() : new Set(['visual']))}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
              disabled={disabled}
            >
              {openSections.size > 0 ? 'Collapse All' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      {/* Control Sections */}
      <div className="space-y-3">
        {renderAudioSection()}
        {renderVisualSection()}
        {renderPerformanceSection()}
        {renderPresetsSection()}
      </div>

      {/* Status Bar */}
      {isReady && (
        <div className="bg-green-500/20 border border-green-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <span>✅</span>
            <span>All systems ready • Visualization active</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {presetToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Preset?</h3>
            <p className="text-sm text-gray-400 mb-4">
              This action cannot be undone. The preset will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPresetToDelete(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCustomPreset(presetToDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualizationControls;