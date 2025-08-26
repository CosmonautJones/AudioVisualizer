import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useAudioVisualizer } from '../../context/AudioVisualizerContext';
import { ErrorBoundary } from '../ErrorBoundary';
import type {
  VisualizationType,
  FrequencyData,
  // TimeData,
  // VisualizationFrameData,
  AudioVisualizerError
} from '../../types/audio';
import type {
  CanvasDimensions,
  DeviceCapability,
  QualityLevel
} from '../../types/canvas';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface AudioCanvasProps {
  /** Canvas CSS class name */
  readonly className?: string;
  
  /** Canvas inline styles */
  readonly style?: React.CSSProperties;
  
  /** Canvas width - overrides responsive sizing if set */
  readonly width?: number;
  
  /** Canvas height - overrides responsive sizing if set */
  readonly height?: number;
  
  /** Aspect ratio to maintain (width/height) */
  readonly aspectRatio?: number;
  
  /** Enable debug overlay with performance metrics */
  readonly showDebugOverlay?: boolean;
  
  /** Enable accessibility features */
  readonly enableAccessibility?: boolean;
  
  /** Custom fallback content when canvas is not supported */
  readonly fallbackContent?: React.ReactNode;
  
  /** Callback when canvas is ready for rendering */
  readonly onReady?: () => void;
  
  /** Callback when rendering starts */
  readonly onRenderStart?: () => void;
  
  /** Callback when rendering stops */
  readonly onRenderStop?: () => void;
  
  /** Callback for canvas errors */
  readonly onError?: (error: AudioVisualizerError) => void;
  
  /** Callback for performance warnings */
  readonly onPerformanceWarning?: (fps: number, metrics: any) => void;
}

// =============================================================================
// DEBUG OVERLAY COMPONENT
// =============================================================================

interface DebugOverlayProps {
  readonly isVisible: boolean;
  readonly performanceMetrics: any;
  readonly deviceCapability: DeviceCapability | null;
  readonly currentQuality: QualityLevel;
  readonly canvasDimensions: CanvasDimensions | null;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
  isVisible,
  performanceMetrics,
  deviceCapability,
  currentQuality,
  canvasDimensions
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className="debug-overlay"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '8px',
        borderRadius: '4px',
        zIndex: 1000,
        pointerEvents: 'none',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div>FPS: {performanceMetrics.frameRate?.toFixed(1) || '0.0'}</div>
      <div>Render: {performanceMetrics.renderTime?.toFixed(2) || '0.00'}ms</div>
      <div>Quality: {currentQuality?.name || 'Unknown'}</div>
      <div>Device: {deviceCapability?.deviceType || 'Unknown'}</div>
      {canvasDimensions && (
        <div>
          Canvas: {canvasDimensions.width}×{canvasDimensions.height} 
          ({canvasDimensions.devicePixelRatio.toFixed(1)}x)
        </div>
      )}
      <div>Memory: {performanceMetrics.memoryUsage?.toFixed(1) || '0.0'}MB</div>
      <div>Dropped: {performanceMetrics.droppedFrames || 0} frames</div>
    </div>
  );
};

// =============================================================================
// ACCESSIBILITY FALLBACK COMPONENT
// =============================================================================

const AccessibilityFallback: React.FC<{
  frequencyData: FrequencyData | null;
  currentVisualization: VisualizationType;
}> = ({ frequencyData, currentVisualization }) => {
  const audioDescription = useMemo(() => {
    if (!frequencyData) return 'No audio data available';
    
    // Calculate basic audio characteristics for screen readers
    const dataArray = Array.from(frequencyData);
    const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    const peak = Math.max(...dataArray);
    
    const intensity = average > 128 ? 'high' : average > 64 ? 'medium' : 'low';
    const dynamics = peak - Math.min(...dataArray) > 100 ? 'dynamic' : 'stable';
    
    return `${currentVisualization} visualization: ${intensity} intensity, ${dynamics} dynamics`;
  }, [frequencyData, currentVisualization]);

  return (
    <div
      role="img"
      aria-label={audioDescription}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#ffffff',
        fontSize: '14px',
        textAlign: 'center',
        zIndex: -1
      }}
    >
      <div>
        <div>Audio Visualization Active</div>
        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
          {audioDescription}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// LOADING INDICATOR COMPONENT
// =============================================================================

const LoadingIndicator: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#ffffff',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <div
      style={{
        width: '16px',
        height: '16px',
        border: '2px solid #ffffff',
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    />
    <span>Initializing visualizer...</span>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// =============================================================================
// MAIN AUDIO CANVAS COMPONENT
// =============================================================================

/**
 * AudioCanvas - The central visualization component
 * 
 * Features:
 * - Real-time audio visualization with 60fps performance
 * - Multi-visualizer support (frequency bars, waveform, spectrogram)
 * - Responsive canvas with device optimization
 * - Accessibility support with screen reader descriptions
 * - Performance monitoring and adaptive quality
 * - Touch and keyboard interaction support
 * - Error recovery and graceful degradation
 */
export const AudioCanvas: React.FC<AudioCanvasProps> = ({
  className = '',
  style = {},
  width,
  height,
  aspectRatio,
  showDebugOverlay = false,
  enableAccessibility = true,
  fallbackContent,
  onReady,
  onRenderStart,
  onRenderStop,
  onError,
  onPerformanceWarning
}) => {
  // =============================================================================
  // HOOKS AND CONTEXT
  // =============================================================================

  const {
    state,
    // audioContext,
    // audioAnalyzer,
    canvasRenderer,
    responsiveCanvas,
    frequencyData,
    // timeData,
    frameData,
    isReady,
    canRender,
    shouldOptimizeForMobile
  } = useAudioVisualizer();

  // =============================================================================
  // REFS AND STATE
  // =============================================================================

  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [renderingActive, setRenderingActive] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);

  // =============================================================================
  // RESPONSIVE CANVAS SETUP
  // =============================================================================

  const {
    canvasRef,
    dimensions,
    // devicePixelRatio,
    isResizing,
    deviceCapability,
    currentBreakpoint,
    // orientation,
    isInitialized: canvasInitialized,
    recalculate
  } = responsiveCanvas;

  // =============================================================================
  // CANVAS CONFIGURATION
  // =============================================================================

  const canvasConfig = useMemo(() => ({
    width: width || dimensions?.width || 800,
    height: height || dimensions?.height || 400,
    aspectRatio: aspectRatio || (dimensions ? dimensions.width / dimensions.height : 2),
    className: `audio-canvas ${className} ${shouldOptimizeForMobile ? 'mobile-optimized' : ''}`.trim(),
    style: {
      display: 'block',
      backgroundColor: '#000000',
      borderRadius: '8px',
      ...style,
      ...(width && { width }),
      ...(height && { height })
    }
  }), [width, height, aspectRatio, dimensions, className, style, shouldOptimizeForMobile]);

  // =============================================================================
  // RENDERING LOOP
  // =============================================================================

  const renderFrame = useCallback(() => {
    if (!canRender || !frameData || !canvasRenderer.hasContext) {
      return;
    }

    try {
      // Get current visualization data
      const visualizationData = {
        frequencyData: frameData.frequencyData,
        timeData: frameData.timeData,
        sampleRate: 44100, // TODO: Get from audio context
        timestamp: frameData.timestamp
      };

      // Render the frame using the canvas renderer
      canvasRenderer.renderFrame(visualizationData as any);

      // Update rendering state
      if (!renderingActive) {
        setRenderingActive(true);
        onRenderStart?.();
      }

    } catch (error) {
      console.error('Frame rendering error:', error);
      
      // Throttle error reporting to prevent spam
      const now = Date.now();
      if (now - lastErrorTime > 5000) { // Max one error per 5 seconds
        const canvasError: AudioVisualizerError = {
          type: 'canvas_render_failed',
          context: '2d',
          fallbackAvailable: true,
          message: 'Canvas rendering failed but fallback available',
          canRetry: true
        };
        onError?.(canvasError);
        setLastErrorTime(now);
      }
    }
  }, [canRender, frameData, canvasRenderer, renderingActive, lastErrorTime, onRenderStart, onError]);

  const startRenderLoop = useCallback(() => {
    if (renderLoopRef.current) return; // Already running

    const loop = () => {
      renderFrame();
      renderLoopRef.current = requestAnimationFrame(loop);
    };

    renderLoopRef.current = requestAnimationFrame(loop);
  }, [renderFrame]);

  const stopRenderLoop = useCallback(() => {
    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
      renderLoopRef.current = null;
    }
    
    if (renderingActive) {
      setRenderingActive(false);
      onRenderStop?.();
    }
  }, [renderingActive, onRenderStop]);

  // =============================================================================
  // INITIALIZATION AND CLEANUP
  // =============================================================================

  useEffect(() => {
    if (canvasInitialized && canvasRenderer.hasContext && !isInitialized) {
      setIsInitialized(true);
      onReady?.();
    }
  }, [canvasInitialized, canvasRenderer.hasContext, isInitialized, onReady]);

  // Start/stop rendering based on readiness
  useEffect(() => {
    if (isReady && canRender && isInitialized && state.visualization.isRendering) {
      startRenderLoop();
    } else {
      stopRenderLoop();
    }

    return stopRenderLoop; // Cleanup on unmount
  }, [isReady, canRender, isInitialized, state.visualization.isRendering, startRenderLoop, stopRenderLoop]);

  // Handle canvas resize
  useEffect(() => {
    if (dimensions && isInitialized) {
      // Recalculate canvas dimensions when container changes
      recalculate();
    }
  }, [dimensions, isInitialized, recalculate]);

  // Performance monitoring
  useEffect(() => {
    if (state.ui.showPerformanceMetrics && canvasRenderer.performanceMetrics.fps < 30) {
      onPerformanceWarning?.(
        canvasRenderer.performanceMetrics.fps,
        canvasRenderer.performanceMetrics
      );
    }
  }, [canvasRenderer.performanceMetrics, state.ui.showPerformanceMetrics, onPerformanceWarning]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    // Calculate click position relative to canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // TODO: Handle visualization interaction (e.g., frequency band selection)
    console.log('Canvas clicked at:', { x, y });
  }, [canvasRef]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Space':
        event.preventDefault();
        // TODO: Toggle play/pause
        break;
      case 'f':
      case 'F':
        // Toggle fullscreen
        // TODO: Implement fullscreen toggle
        break;
      default:
        break;
    }
  }, []);

  // =============================================================================
  // TOUCH HANDLERS FOR MOBILE
  // =============================================================================

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault(); // Prevent scrolling
    // TODO: Handle touch interactions for mobile
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    // TODO: Handle touch drag for mobile interactions
  }, []);

  // =============================================================================
  // ERROR BOUNDARY PROPS
  // =============================================================================

  const errorBoundaryProps = {
    fallback: () => (
      <div style={{
        width: canvasConfig.width,
        height: canvasConfig.height,
        background: '#000000',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        border: '2px dashed #333333'
      }}>
        {fallbackContent || (
          <div style={{ textAlign: 'center' }}>
            <div>Canvas visualization unavailable</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Please check browser compatibility
            </div>
          </div>
        )}
      </div>
    )
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <ErrorBoundary {...errorBoundaryProps}>
      <div
        ref={containerRef}
        className={`audio-canvas-container ${currentBreakpoint}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: canvasConfig.width,
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
          background: '#000000',
          borderRadius: '8px',
          overflow: 'hidden',
          ...(!isInitialized && { 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          })
        }}
      >
        {/* Main Canvas Element */}
        <canvas
          ref={canvasRef}
          className={canvasConfig.className}
          style={canvasConfig.style}
          width={dimensions?.scaledWidth || canvasConfig.width}
          height={dimensions?.scaledHeight || canvasConfig.height}
          onClick={handleCanvasClick}
          onKeyDown={handleCanvasKeyDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          tabIndex={0}
          role="img"
          aria-label={`${state.visualization.rendererType} audio visualization`}
          aria-live="polite"
        />

        {/* Loading Indicator */}
        {!isInitialized && <LoadingIndicator />}

        {/* Accessibility Fallback */}
        {enableAccessibility && (
          <AccessibilityFallback
            frequencyData={frequencyData}
            currentVisualization={state.visualization.rendererType}
          />
        )}

        {/* Debug Overlay */}
        <DebugOverlay
          isVisible={showDebugOverlay && state.ui.showPerformanceMetrics}
          performanceMetrics={canvasRenderer.performanceMetrics}
          deviceCapability={deviceCapability}
          currentQuality={canvasRenderer.currentQuality}
          canvasDimensions={dimensions}
        />

        {/* Resize Indicator */}
        {isResizing && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#ffffff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none'
            }}
          >
            Resizing...
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

// =============================================================================
// COMPONENT VARIANTS
// =============================================================================

/**
 * AudioCanvasMinimal - Simplified canvas for basic use cases
 */
export const AudioCanvasMinimal: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <AudioCanvas
    className={className}
    style={style}
    enableAccessibility={false}
    showDebugOverlay={false}
  />
);

/**
 * AudioCanvasDebug - Canvas with debug overlay enabled
 */
export const AudioCanvasDebug: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <AudioCanvas
    className={className}
    style={style}
    showDebugOverlay={true}
    enableAccessibility={true}
  />
);

/**
 * AudioCanvasMobile - Mobile-optimized canvas
 */
export const AudioCanvasMobile: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <AudioCanvas
    className={`${className} mobile-canvas`}
    style={style}
    aspectRatio={16 / 9} // Better for mobile landscape
    showDebugOverlay={false}
    enableAccessibility={true}
  />
);

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default AudioCanvas;