import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef,
  Suspense
} from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioVisualizerProvider, useAudioVisualizer } from './context/AudioVisualizerContext';
import { LoadingState } from './components/UI/LoadingState';
import { AccessibilityLayer } from './components/UI/AccessibilityLayer';
import { MobileInterface, MobileInterfaceProvider, isMobileDevice } from './components/UI/MobileInterface';
import { AudioCanvas } from './components/AudioVisualizer/AudioCanvas';
import { InputSelector } from './components/AudioControls/InputSelector';
import { VisualizationControls } from './components/AudioControls/VisualizationControls';
import type { AudioVisualizerError, AudioVisualizerSettings } from './types/audio';
import { getDeviceCapability } from './utils/deviceDetection';
import './App.css';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  isMobile: boolean;
  deviceCapability: any;
  initializationError: AudioVisualizerError | null;
  showSettings: boolean;
  isFullscreen: boolean;
  debugMode: boolean;
}

interface AppPerformanceMetrics {
  initializationTime: number;
  firstRenderTime: number;
  totalMemoryUsage: number;
  errorCount: number;
}

// =============================================================================
// ERROR FALLBACK COMPONENT
// =============================================================================

const AppErrorFallback: React.FC<{
  error: AudioVisualizerError;
  retry: () => void;
}> = ({ error, retry }) => (
  <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
    <div className="max-w-md w-full text-center space-y-6">
      <div className="text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-red-400">
        Audio Visualizer Error
      </h1>
      <p className="text-gray-300 leading-relaxed">
        {error.type === 'browser_incompatible' 
          ? 'Your browser doesn\'t support the required features for this audio visualizer.'
          : error.type === 'audio_context_failed'
          ? 'Failed to initialize audio processing. This may be due to browser restrictions.'
          : error.type === 'permission_denied'
          ? 'Microphone access was denied. You can still use file uploads.'
          : 'An unexpected error occurred while starting the audio visualizer.'
        }
      </p>
      
      {error.canRetry && (
        <button
          onClick={retry}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      )}
      
      <div className="text-sm text-gray-500 space-y-2">
        <p>Make sure your browser supports:</p>
        <ul className="text-left space-y-1">
          <li>• Web Audio API</li>
          <li>• Canvas 2D rendering</li>
          <li>• Modern JavaScript (ES6+)</li>
        </ul>
      </div>
      
      <details className="text-left text-sm bg-gray-800 rounded p-3">
        <summary className="cursor-pointer text-gray-400">Technical Details</summary>
        <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
          {JSON.stringify(error, null, 2)}
        </pre>
      </details>
    </div>
  </div>
);

// =============================================================================
// DESKTOP LAYOUT COMPONENT
// =============================================================================

const DesktopLayout: React.FC = () => {
  const { state, actions } = useAudioVisualizer();
  const [showControls, setShowControls] = useState(true);
  const [activePanel, setActivePanel] = useState<'input' | 'visualization'>('input');

  const handleSettingsChange = useCallback((settings: Partial<AudioVisualizerSettings>) => {
    // Settings are automatically saved through the context
    console.log('Settings updated:', settings);
  }, []);

  const handleCanvasReady = useCallback(() => {
    console.log('Canvas ready for rendering');
  }, []);

  const handleVisualizationError = useCallback((error: AudioVisualizerError) => {
    console.error('Visualization error:', error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Visual Equalizer</h1>
              <p className="text-sm text-gray-400">Real-time audio visualization</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                state.audio.currentSource 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  state.audio.currentSource ? 'bg-green-400' : 'bg-gray-400'
                }`} />
                {state.audio.currentSource ? 'Active' : 'No Source'}
              </div>
              
              {/* Controls Toggle */}
              <button
                onClick={() => setShowControls(!showControls)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                title={showControls ? 'Hide Controls' : 'Show Controls'}
              >
                {showControls ? '◀' : '▶'}
              </button>
              
              {/* Fullscreen Toggle */}
              <button
                onClick={() => actions.setFullscreen(!state.ui.fullscreenMode)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                title="Toggle Fullscreen"
              >
                {state.ui.fullscreenMode ? '⊞' : '⊠'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar Controls */}
        {showControls && (
          <aside className="w-80 bg-black/30 backdrop-blur-sm border-r border-gray-800 overflow-y-auto">
            <div className="p-4">
              {/* Panel Tabs */}
              <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
                <button
                  onClick={() => setActivePanel('input')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activePanel === 'input'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Audio Source
                </button>
                <button
                  onClick={() => setActivePanel('visualization')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activePanel === 'visualization'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Visualization
                </button>
              </div>

              {/* Panel Content */}
              <div className="space-y-6">
                {activePanel === 'input' && (
                  <InputSelector
                    onSourceSelect={(type) => console.log('Source selected:', type)}
                    onError={handleVisualizationError}
                    showAdvancedOptions={true}
                  />
                )}
                
                {activePanel === 'visualization' && (
                  <VisualizationControls
                    onSettingsChange={handleSettingsChange}
                    showAdvancedControls={true}
                  />
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Main Visualization Area */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <AudioCanvas
              className="w-full h-auto"
              aspectRatio={16 / 9}
              onReady={handleCanvasReady}
              onError={handleVisualizationError}
              showDebugOverlay={state.ui.showPerformanceMetrics}
              enableAccessibility={state.ui.accessibilityMode}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN APP INNER COMPONENT (with context access)
// =============================================================================

const AppInner: React.FC = () => {
  const { 
    state, 
    actions 
    // isReady, 
    // audioContext,
    // audioAnalyzer 
  } = useAudioVisualizer();
  
  const [appState, setAppState] = useState<AppState>({
    isInitialized: false,
    isLoading: true,
    isMobile: false,
    deviceCapability: null,
    initializationError: null,
    showSettings: false,
    isFullscreen: false,
    debugMode: import.meta.env.DEV
  });

  const performanceMetrics = useRef<AppPerformanceMetrics>({
    initializationTime: 0,
    firstRenderTime: 0,
    totalMemoryUsage: 0,
    errorCount: 0
  });

  const initStartTime = useRef<number>(Date.now());

  // =============================================================================
  // INITIALIZATION LOGIC
  // =============================================================================

  const handleLoadingComplete = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      isLoading: false,
      isInitialized: true
    }));
    
    performanceMetrics.current.initializationTime = Date.now() - initStartTime.current;
    console.log(`🚀 App initialized in ${performanceMetrics.current.initializationTime}ms`);
  }, []);

  const handleInitializationError = useCallback((error: AudioVisualizerError) => {
    setAppState(prev => ({
      ...prev,
      isLoading: false,
      initializationError: error
    }));
    
    performanceMetrics.current.errorCount++;
    console.error('🚨 App initialization failed:', error);
  }, []);

  const handleRetryInitialization = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      isLoading: true,
      initializationError: null
    }));
    
    initStartTime.current = Date.now();
    
    // Reset audio context and retry
    actions.retryOperation().then(result => {
      if (result.success) {
        handleLoadingComplete();
      } else {
        handleInitializationError(result.error!);
      }
    });
  }, [actions, handleLoadingComplete, handleInitializationError]);

  // =============================================================================
  // DEVICE CAPABILITY DETECTION
  // =============================================================================

  useEffect(() => {
    const initializeDeviceCapability = async () => {
      try {
        const capability = await getDeviceCapability();
        const isMobile = capability.deviceType === 'mobile';
        
        setAppState(prev => ({
          ...prev,
          isMobile,
          deviceCapability: capability
        }));

        // Update context with device info
        actions.setPerformanceMode(
          capability.memoryStatus === 'low' ? 'performance' :
          capability.memoryStatus === 'high' ? 'quality' : 'auto'
        );

        // Apply mobile optimizations
        if (isMobile) {
          actions.updateVisualizationConfig({
            barCount: Math.min(64, capability.maxCanvasSize / 20),
            sensitivity: 1.2, // Higher sensitivity for mobile
            smoothing: 0.7 // More smoothing for better mobile performance
          });
        }

      } catch (error) {
        console.warn('Failed to detect device capability:', error);
      }
    };

    initializeDeviceCapability();
  }, [actions]);

  // =============================================================================
  // APP STATE SYNCHRONIZATION
  // =============================================================================

  useEffect(() => {
    // Sync fullscreen state
    setAppState(prev => ({
      ...prev,
      isFullscreen: state.ui.fullscreenMode
    }));
  }, [state.ui.fullscreenMode]);

  // useEffect(() => {
  //   // Monitor for errors in audio context
  //   // if (audioContext.error) {
  //   //   handleInitializationError(audioContext.error);
  //   // }
  // }, [audioContext.error, handleInitializationError]);

  useEffect(() => {
    // Update performance metrics
    performanceMetrics.current.totalMemoryUsage = state.performanceMetrics.memoryUsage;
  }, [state.performanceMetrics.memoryUsage]);

  // =============================================================================
  // KEYBOARD SHORTCUTS
  // =============================================================================

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          actions.togglePlayback();
          break;
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) break; // Don't interfere with browser find
          event.preventDefault();
          actions.setFullscreen(!state.ui.fullscreenMode);
          break;
        case 'Escape':
          if (state.ui.fullscreenMode) {
            actions.setFullscreen(false);
          }
          break;
        case 'd':
        case 'D':
          if (appState.debugMode) {
            actions.togglePerformanceMetrics();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [actions, state.ui.fullscreenMode, appState.debugMode]);

  // =============================================================================
  // DOCUMENT TITLE UPDATES
  // =============================================================================

  useEffect(() => {
    const basedTitle = 'Visual Equalizer';
    
    if (state.audio.currentSource && state.audio.sourceMetadata?.name) {
      document.title = `${state.audio.sourceMetadata.name} - ${basedTitle}`;
    } else if (state.audio.playbackStatus === 'playing') {
      document.title = `▶ ${basedTitle}`;
    } else {
      document.title = basedTitle;
    }
  }, [state.audio.currentSource, state.audio.sourceMetadata, state.audio.playbackStatus]);

  // =============================================================================
  // PERFORMANCE MONITORING
  // =============================================================================

  useEffect(() => {
    if (appState.debugMode) {
      const logPerformance = () => {
        console.log('📊 Performance Metrics:', {
          fps: state.performanceMetrics.frameRate,
          renderTime: state.performanceMetrics.renderTime,
          memoryUsage: state.performanceMetrics.memoryUsage,
          audioLatency: state.performanceMetrics.audioLatency,
          initTime: performanceMetrics.current.initializationTime,
          errorCount: performanceMetrics.current.errorCount
        });
      };

      const interval = setInterval(logPerformance, 5000);
      return () => clearInterval(interval);
    }
  }, [appState.debugMode, state.performanceMetrics]);

  // =============================================================================
  // RENDER LOADING STATE
  // =============================================================================

  if (appState.isLoading) {
    return (
      <LoadingState
        onComplete={handleLoadingComplete}
        onError={handleInitializationError}
        showPerformanceMetrics={appState.debugMode}
        allowSkipping={true}
      />
    );
  }

  // =============================================================================
  // RENDER ERROR STATE
  // =============================================================================

  if (appState.initializationError) {
    return (
      <AppErrorFallback
        error={appState.initializationError}
        retry={handleRetryInitialization}
      />
    );
  }

  // =============================================================================
  // RENDER MAIN APPLICATION
  // =============================================================================

  return (
    <div className={`app ${appState.isFullscreen ? 'fullscreen' : ''}`}>
      {/* Meta tags for PWA and SEO */}
      <meta name="description" content="Real-time audio visualization with frequency bars, waveforms, and spectrograms" />
      <meta name="keywords" content="audio visualizer, music visualization, frequency analyzer, spectrum analyzer" />
      <meta name="theme-color" content="#000000" />
      
      {appState.isMobile ? (
        <MobileInterface>
          <AudioCanvas
            className="mobile-canvas"
            aspectRatio={16 / 9}
            showDebugOverlay={false}
            enableAccessibility={state.ui.accessibilityMode}
            onError={handleInitializationError}
          />
        </MobileInterface>
      ) : (
        <DesktopLayout />
      )}

      {/* Global Status Bar (hidden in fullscreen) */}
      {!appState.isFullscreen && appState.debugMode && (
        <div className="fixed bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white font-mono z-50">
          <div className="flex gap-4">
            <span>FPS: {Math.round(state.performanceMetrics.frameRate)}</span>
            <span>Memory: {Math.round(state.performanceMetrics.memoryUsage)}MB</span>
            <span>Latency: {Math.round(state.performanceMetrics.audioLatency)}ms</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// ROOT APP COMPONENT
// =============================================================================

/**
 * Main Application Component
 * 
 * Architecture:
 * - ErrorBoundary: Top-level error handling and recovery
 * - AudioVisualizerProvider: Global state and audio engine management
 * - AccessibilityLayer: Enhanced accessibility features and keyboard shortcuts
 * - MobileInterface: Mobile-optimized UI with gesture support (conditional)
 * - App Layout: Desktop layout with sidebar controls (conditional)
 * 
 * Features:
 * - Progressive enhancement based on device capabilities
 * - Graceful degradation for unsupported features
 * - Real-time performance monitoring and optimization
 * - Comprehensive error handling and recovery
 * - Mobile-first responsive design
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Keyboard shortcuts and gesture controls
 */
const App: React.FC = () => {
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
  const buildTime = import.meta.env.VITE_BUILD_TIME;
  const isMobile = useMemo(() => isMobileDevice(), []);

  // Console banner (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(
        `%c🎵 Visual Equalizer v${appVersion}%c\n` +
        `Built: ${buildTime || 'development'}\n` +
        `Device: ${isMobile ? 'Mobile' : 'Desktop'}\n` +
        `%cReady for audio visualization!`,
        'color: #3b82f6; font-size: 16px; font-weight: bold',
        'color: #6b7280; font-size: 12px',
        'color: #10b981; font-size: 12px; font-weight: bold'
      );
    }
  }, [appVersion, buildTime, isMobile]);

  const handleGlobalError = useCallback((error: AudioVisualizerError) => {
    console.error('🚨 Global app error:', error);
    
    // Report to external error service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }, []);

  const handleStateChange = useCallback((state: any) => {
    // Optional: Track state changes for analytics
    if (import.meta.env.DEV) {
      console.log('🔄 App state changed:', {
        isReady: state.initializationComplete,
        currentSource: state.audio.currentSource,
        renderType: state.visualization.rendererType,
        isPlaying: state.audio.playbackStatus === 'playing'
      });
    }
  }, []);

  return (
    <ErrorBoundary
      onError={handleGlobalError}
      fallback={(error, retry) => (
        <AppErrorFallback error={error} retry={retry} />
      )}
    >
      <AudioVisualizerProvider
        onError={handleGlobalError}
        onStateChange={handleStateChange}
        mobileOptimizations={{
          reducedBarCount: true,
          increasedSensitivity: true,
          optimizedSmoothing: true,
          batteryOptimizations: true
        }}
      >
        <AccessibilityLayer
          onSettingsChange={(settings) => {
            console.log('♿ Accessibility settings updated:', settings);
          }}
        >
          {isMobile ? (
            <MobileInterfaceProvider>
              <Suspense fallback={
                <div className="min-h-screen bg-black flex items-center justify-center">
                  <div className="text-white">Loading mobile interface...</div>
                </div>
              }>
                <AppInner />
              </Suspense>
            </MobileInterfaceProvider>
          ) : (
            <Suspense fallback={
              <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white">Loading application...</div>
              </div>
            }>
              <AppInner />
            </Suspense>
          )}
        </AccessibilityLayer>
      </AudioVisualizerProvider>
    </ErrorBoundary>
  );
};

export default App;