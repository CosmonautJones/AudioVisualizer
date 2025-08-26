import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef 
} from 'react';
import { useAudioVisualizer } from '../../context/AudioVisualizerContext';
import type { 
  AudioVisualizerError, 
  PerformanceMetrics 
} from '../../types/audio';
import type { DeviceCapability } from '../../types/canvas';
import { getDeviceCapability } from '../../utils/deviceDetection';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface LoadingStage {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isOptional: boolean;
  readonly estimatedDuration: number; // milliseconds
  readonly timeout: number; // milliseconds
}

export interface LoadingProgress {
  readonly currentStage: LoadingStage['id'] | null;
  readonly completedStages: Set<LoadingStage['id']>;
  readonly failedStages: Set<LoadingStage['id']>;
  readonly overallProgress: number; // 0-100
  readonly elapsedTime: number; // milliseconds
  readonly isComplete: boolean;
  readonly hasErrors: boolean;
}

export interface LoadingStateProps {
  readonly onComplete?: () => void;
  readonly onError?: (error: AudioVisualizerError) => void;
  readonly onSkipOptional?: (stageId: string) => void;
  readonly allowSkipping?: boolean;
  readonly showPerformanceMetrics?: boolean;
  readonly animationLevel?: 'none' | 'reduced' | 'full';
  readonly customStages?: LoadingStage[];
}

// =============================================================================
// LOADING STAGES CONFIGURATION
// =============================================================================

const DEFAULT_LOADING_STAGES: readonly LoadingStage[] = [
  {
    id: 'audio-engine',
    name: 'Audio Engine',
    description: 'Initializing AudioContext and audio processing engine',
    isOptional: false,
    estimatedDuration: 2000,
    timeout: 10000,
  },
  {
    id: 'device-detection',
    name: 'Device Detection',
    description: 'Analyzing device capabilities and performance characteristics',
    isOptional: false,
    estimatedDuration: 1000,
    timeout: 5000,
  },
  {
    id: 'permission-requests',
    name: 'Permissions',
    description: 'Requesting microphone access (if needed)',
    isOptional: true,
    estimatedDuration: 3000,
    timeout: 15000,
  },
  {
    id: 'asset-loading',
    name: 'Assets',
    description: 'Loading demo tracks and UI resources',
    isOptional: true,
    estimatedDuration: 2000,
    timeout: 10000,
  },
  {
    id: 'final-preparation',
    name: 'Final Setup',
    description: 'Preparing visualization engine and initial render',
    isOptional: false,
    estimatedDuration: 1000,
    timeout: 5000,
  },
] as const;

// =============================================================================
// LOADING VISUALIZER COMPONENT
// =============================================================================

interface LoadingVisualizerProps {
  readonly progress: number;
  readonly isActive: boolean;
  readonly animationLevel: LoadingStateProps['animationLevel'];
}

const LoadingVisualizer: React.FC<LoadingVisualizerProps> = ({
  progress,
  isActive,
  animationLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);
  const progressAnimationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || animationLevel === 'none') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Smooth progress animation
      progressAnimationRef.current += (progress - progressAnimationRef.current) * 0.1;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const barCount = animationLevel === 'reduced' ? 16 : 32;
      const radius = Math.min(canvas.width, canvas.height) * 0.3;

      // Draw animated frequency bars
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        // Animate bar heights based on progress and time
        const timeOffset = Date.now() * 0.003;
        const baseHeight = 10 + (progressAnimationRef.current / 100) * 30;
        const animatedHeight = baseHeight + Math.sin(timeOffset + i * 0.5) * 15;
        const finalHeight = isActive ? animatedHeight : baseHeight * 0.3;

        // Color based on progress
        const hue = (progressAnimationRef.current / 100) * 120; // Red to green
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;

        // Draw bar
        ctx.fillRect(
          x - 2,
          y - finalHeight / 2,
          4,
          finalHeight
        );
      }

      // Draw progress ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 20, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw progress arc
      ctx.beginPath();
      ctx.arc(
        centerX, 
        centerY, 
        radius + 20, 
        -Math.PI / 2, 
        -Math.PI / 2 + (progressAnimationRef.current / 100) * 2 * Math.PI
      );
      ctx.strokeStyle = `hsla(${(progressAnimationRef.current / 100) * 120}, 70%, 60%, 1)`;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (isActive && animationLevel === 'full') {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    };

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    animate();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [progress, isActive, animationLevel]);

  if (animationLevel === 'none') {
    return (
      <div className="loading-visualizer-static">
        <div 
          className="progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="loading-visualizer-canvas"
      style={{ 
        width: '200px', 
        height: '200px',
        display: 'block',
        margin: '0 auto'
      }}
    />
  );
};

// =============================================================================
// STAGE PROGRESS COMPONENT
// =============================================================================

interface StageProgressProps {
  readonly stages: readonly LoadingStage[];
  readonly progress: LoadingProgress;
  readonly onSkipStage?: (stageId: string) => void;
  readonly allowSkipping: boolean;
}

const StageProgress: React.FC<StageProgressProps> = ({
  stages,
  progress,
  onSkipStage,
  allowSkipping
}) => {
  return (
    <div className="stage-progress">
      <div className="stage-list">
        {stages.map((stage, index) => {
          const isCompleted = progress.completedStages.has(stage.id);
          const isCurrent = progress.currentStage === stage.id;
          const isFailed = progress.failedStages.has(stage.id);
          const isSkippable = allowSkipping && stage.isOptional && !isCompleted && !isCurrent;

          return (
            <div
              key={stage.id}
              className={`stage-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isFailed ? 'failed' : ''}`}
            >
              <div className="stage-indicator">
                {isCompleted ? (
                  <div className="stage-checkmark">✓</div>
                ) : isFailed ? (
                  <div className="stage-error">✗</div>
                ) : isCurrent ? (
                  <div className="stage-spinner" />
                ) : (
                  <div className="stage-number">{index + 1}</div>
                )}
              </div>
              
              <div className="stage-info">
                <div className="stage-name">{stage.name}</div>
                <div className="stage-description">{stage.description}</div>
                
                {isSkippable && onSkipStage && (
                  <button
                    className="skip-button"
                    onClick={() => onSkipStage(stage.id)}
                    aria-label={`Skip ${stage.name}`}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// PERFORMANCE METRICS DISPLAY
// =============================================================================

interface PerformanceDisplayProps {
  readonly metrics: PerformanceMetrics;
  readonly elapsedTime: number;
  readonly deviceCapability: DeviceCapability | null;
}

const PerformanceDisplay: React.FC<PerformanceDisplayProps> = ({
  metrics,
  elapsedTime,
  deviceCapability
}) => {
  return (
    <div className="performance-display">
      <h4>Initialization Performance</h4>
      
      <div className="metrics-grid">
        <div className="metric">
          <span className="metric-label">Elapsed Time</span>
          <span className="metric-value">{(elapsedTime / 1000).toFixed(1)}s</span>
        </div>
        
        <div className="metric">
          <span className="metric-label">Memory Usage</span>
          <span className="metric-value">{metrics.memoryUsage.toFixed(1)}MB</span>
        </div>
        
        <div className="metric">
          <span className="metric-label">Audio Latency</span>
          <span className="metric-value">{metrics.audioLatency.toFixed(0)}ms</span>
        </div>
        
        {deviceCapability && (
          <>
            <div className="metric">
              <span className="metric-label">Device Type</span>
              <span className="metric-value">{deviceCapability.deviceType}</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Memory Status</span>
              <span className="metric-value">{deviceCapability.memoryStatus}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN LOADING STATE COMPONENT
// =============================================================================

export const LoadingState: React.FC<LoadingStateProps> = ({
  onComplete,
  onError,
  onSkipOptional,
  allowSkipping = true,
  showPerformanceMetrics = false,
  animationLevel = 'full',
  customStages
}) => {
  // Context and state
  const { 
    state, 
    audioContext, 
    actions,
    isReady
  } = useAudioVisualizer();

  const stages = customStages || DEFAULT_LOADING_STAGES;
  
  // Loading state management
  const [progress, setProgress] = useState<LoadingProgress>({
    currentStage: null,
    completedStages: new Set(),
    failedStages: new Set(),
    overallProgress: 0,
    elapsedTime: 0,
    isComplete: false,
    hasErrors: false,
  });

  const [deviceCapability, setDeviceCapability] = useState<DeviceCapability | null>(null);
  const [initializationError, setInitializationError] = useState<AudioVisualizerError | null>(null);
  
  // Refs for tracking
  const startTimeRef = useRef<number>(Date.now());
  const stageTimeoutsRef = useRef<Map<string, number>>(new Map());
  const initializationStartedRef = useRef(false);

  // Reduced motion support
  const effectiveAnimationLevel = useMemo(() => {
    if (deviceCapability?.preferReducedMotion) {
      return animationLevel === 'none' ? 'none' : 'reduced';
    }
    return animationLevel;
  }, [animationLevel, deviceCapability?.preferReducedMotion]);

  // Stage management functions
  const completeStage = useCallback((stageId: string) => {
    setProgress(prev => {
      const newCompleted = new Set(prev.completedStages);
      newCompleted.add(stageId);
      
      const completedCount = newCompleted.size;
      const totalStages = stages.length;
      const overallProgress = (completedCount / totalStages) * 100;
      
      return {
        ...prev,
        completedStages: newCompleted,
        overallProgress,
        currentStage: overallProgress >= 100 ? null : prev.currentStage,
        isComplete: overallProgress >= 100,
      };
    });
    
    // Clear timeout for this stage
    const timeout = stageTimeoutsRef.current.get(stageId);
    if (timeout) {
      clearTimeout(timeout);
      stageTimeoutsRef.current.delete(stageId);
    }
  }, [stages.length]);

  const failStage = useCallback((stageId: string, error: AudioVisualizerError) => {
    setProgress(prev => {
      const newFailed = new Set(prev.failedStages);
      newFailed.add(stageId);
      
      return {
        ...prev,
        failedStages: newFailed,
        hasErrors: true,
        currentStage: null,
      };
    });
    
    setInitializationError(error);
    onError?.(error);
  }, [onError]);

  const startStage = useCallback((stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;

    setProgress(prev => ({
      ...prev,
      currentStage: stageId,
    }));

    // Set timeout for stage
    const timeout = setTimeout(() => {
      const timeoutError: AudioVisualizerError = {
        type: 'audio_context_failed',
        reason: `Stage "${stage.name}" exceeded timeout of ${stage.timeout}ms`,
        message: `Initialization timeout: Stage "${stage.name}" exceeded timeout of ${stage.timeout}ms`,
        canRetry: true,
      };
      failStage(stageId, timeoutError);
    }, stage.timeout);

    stageTimeoutsRef.current.set(stageId, timeout);
  }, [stages, failStage]);

  const skipStage = useCallback((stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage?.isOptional) return;

    completeStage(stageId);
    onSkipOptional?.(stageId);
  }, [stages, completeStage, onSkipOptional]);

  // Initialize device capability detection
  useEffect(() => {
    if (!initializationStartedRef.current) {
      initializationStartedRef.current = true;
      startStage('device-detection');

      getDeviceCapability()
        .then(capability => {
          setDeviceCapability(capability);
          completeStage('device-detection');
        })
        .catch(error => {
          const detectionError: AudioVisualizerError = {
            type: 'browser_incompatible',
            feature: 'device-detection',
            alternatives: ['Try refreshing the page', 'Check browser compatibility'],
            // reason: `Device capability detection failed: ${error.message}`,  // Not needed for browser_incompatible
            message: `Failed to detect device capabilities: ${error.message}`,
            canRetry: true,
          };
          failStage('device-detection', detectionError);
        });
    }
  }, [startStage, completeStage, failStage]);

  // Handle audio engine initialization
  useEffect(() => {
    if (progress.completedStages.has('device-detection') && !progress.currentStage) {
      startStage('audio-engine');
    }
  }, [progress.completedStages, progress.currentStage, startStage]);

  // Monitor audio context state
  useEffect(() => {
    if (progress.currentStage === 'audio-engine') {
      if (audioContext.isReady) {
        completeStage('audio-engine');
      } else if (audioContext.error) {
        failStage('audio-engine', audioContext.error);
      }
    }
  }, [audioContext.isReady, audioContext.error, progress.currentStage, completeStage, failStage]);

  // Handle permission requests
  useEffect(() => {
    if (progress.completedStages.has('audio-engine') && 
        !progress.currentStage && 
        !progress.completedStages.has('permission-requests')) {
      
      startStage('permission-requests');
      
      // Simulate permission request (would be actual microphone permission in real app)
      setTimeout(() => {
        completeStage('permission-requests');
      }, 1000);
    }
  }, [progress.completedStages, progress.currentStage, startStage, completeStage]);

  // Handle asset loading
  useEffect(() => {
    if (progress.completedStages.has('permission-requests') && 
        !progress.currentStage && 
        !progress.completedStages.has('asset-loading')) {
      
      startStage('asset-loading');
      
      // Simulate asset loading
      setTimeout(() => {
        completeStage('asset-loading');
      }, 1500);
    }
  }, [progress.completedStages, progress.currentStage, startStage, completeStage]);

  // Handle final preparation
  useEffect(() => {
    if (progress.completedStages.has('asset-loading') && 
        !progress.currentStage && 
        !progress.completedStages.has('final-preparation')) {
      
      startStage('final-preparation');
      
      // Wait for full system readiness
      const checkReadiness = () => {
        if (isReady) {
          completeStage('final-preparation');
        } else {
          setTimeout(checkReadiness, 100);
        }
      };
      checkReadiness();
    }
  }, [progress.completedStages, progress.currentStage, startStage, completeStage, isReady]);

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        elapsedTime: Date.now() - startTimeRef.current,
      }));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Handle completion
  useEffect(() => {
    if (progress.isComplete && !progress.hasErrors) {
      // Small delay to show completion state
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [progress.isComplete, progress.hasErrors, onComplete]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      stageTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      stageTimeoutsRef.current.clear();
    };
  }, []);

  // Retry functionality
  const handleRetry = useCallback(async () => {
    if (initializationError) {
      setInitializationError(null);
      setProgress({
        currentStage: null,
        completedStages: new Set(),
        failedStages: new Set(),
        overallProgress: 0,
        elapsedTime: 0,
        isComplete: false,
        hasErrors: false,
      });
      startTimeRef.current = Date.now();
      initializationStartedRef.current = false;
      
      // Clear all timeouts
      stageTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      stageTimeoutsRef.current.clear();
      
      // Try to retry the audio context if that failed
      if (initializationError.type === 'audio_context_failed' && initializationError.canRetry) {
        await actions.retryOperation();
      }
    }
  }, [initializationError, actions]);

  // Get current stage info
  const currentStageInfo = useMemo(() => {
    if (!progress.currentStage) return null;
    return stages.find(stage => stage.id === progress.currentStage) || null;
  }, [progress.currentStage, stages]);

  return (
    <div 
      className="loading-state"
      role="status" 
      aria-live="polite"
      aria-label="Application is initializing"
    >
      <div className="loading-content">
        {/* Main loading visualizer */}
        <div className="loading-visualizer-container">
          <LoadingVisualizer
            progress={progress.overallProgress}
            isActive={!progress.isComplete && !progress.hasErrors}
            animationLevel={effectiveAnimationLevel}
          />
        </div>

        {/* Status message */}
        <div className="loading-status">
          {progress.hasErrors && initializationError ? (
            <div className="error-status">
              <h2>Initialization Failed</h2>
              <p>{initializationError.reason}</p>
              {initializationError.canRetry && (
                <button 
                  className="retry-button"
                  onClick={handleRetry}
                  aria-label="Retry initialization"
                >
                  Retry
                </button>
              )}
            </div>
          ) : progress.isComplete ? (
            <div className="complete-status">
              <h2>Ready!</h2>
              <p>Audio visualizer initialized successfully</p>
            </div>
          ) : currentStageInfo ? (
            <div className="current-status">
              <h2>{currentStageInfo.name}</h2>
              <p>{currentStageInfo.description}</p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar"
                  style={{ width: `${progress.overallProgress}%` }}
                />
                <span className="progress-text">
                  {Math.round(progress.overallProgress)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="initial-status">
              <h2>Initializing...</h2>
              <p>Preparing your audio visualizer experience</p>
            </div>
          )}
        </div>

        {/* Stage progress */}
        <StageProgress
          stages={stages}
          progress={progress}
          onSkipStage={allowSkipping ? skipStage : undefined}
          allowSkipping={allowSkipping}
        />

        {/* Performance metrics */}
        {showPerformanceMetrics && (
          <PerformanceDisplay
            metrics={state.performanceMetrics}
            elapsedTime={progress.elapsedTime}
            deviceCapability={deviceCapability}
          />
        )}

        {/* Accessibility announcements */}
        <div 
          className="sr-only" 
          aria-live="assertive"
          aria-atomic="true"
        >
          {currentStageInfo && `Loading ${currentStageInfo.name}: ${currentStageInfo.description}`}
          {progress.isComplete && "Audio visualizer ready"}
          {progress.hasErrors && `Error: ${initializationError?.message || 'Unknown error'}`}
        </div>
      </div>

      <style>{`
        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          color: #ffffff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 2rem;
        }

        .loading-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .loading-visualizer-container {
          margin-bottom: 3rem;
        }

        .loading-visualizer-canvas {
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
          backdrop-filter: blur(10px);
        }

        .loading-visualizer-static {
          width: 200px;
          height: 200px;
          margin: 0 auto;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .loading-visualizer-static .progress-bar {
          height: 4px;
          background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .loading-status {
          margin-bottom: 2rem;
        }

        .loading-status h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          font-weight: 600;
        }

        .loading-status p {
          margin: 0 0 1rem 0;
          color: rgba(255,255,255,0.7);
          font-size: 1rem;
        }

        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 10px;
          right: 0;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.7);
        }

        .stage-progress {
          margin-bottom: 2rem;
        }

        .stage-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          text-align: left;
        }

        .stage-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.3s ease;
        }

        .stage-item.current {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.2);
        }

        .stage-item.completed {
          background: rgba(76,175,80,0.1);
          border-color: rgba(76,175,80,0.3);
        }

        .stage-item.failed {
          background: rgba(244,67,54,0.1);
          border-color: rgba(244,67,54,0.3);
        }

        .stage-indicator {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
        }

        .stage-checkmark,
        .stage-error {
          color: #4caf50;
          font-weight: bold;
        }

        .stage-error {
          color: #f44336;
        }

        .stage-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid #ffffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .stage-number {
          font-size: 0.875rem;
          font-weight: 600;
        }

        .stage-info {
          flex: 1;
        }

        .stage-name {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .stage-description {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.7);
        }

        .skip-button {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
          color: rgba(255,255,255,0.7);
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: all 0.2s ease;
        }

        .skip-button:hover {
          background: rgba(255,255,255,0.1);
          color: #ffffff;
        }

        .retry-button {
          background: #4caf50;
          border: none;
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .retry-button:hover {
          background: #45a049;
        }

        .performance-display {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 1rem;
          text-align: left;
        }

        .performance-display h4 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metric-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value {
          font-weight: 600;
          color: #4ecdc4;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .loading-state {
            padding: 1rem;
          }

          .loading-content {
            max-width: 100%;
          }

          .loading-visualizer-canvas,
          .loading-visualizer-static {
            width: 150px;
            height: 150px;
          }

          .stage-list {
            gap: 0.75rem;
          }

          .stage-item {
            padding: 0.75rem;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stage-spinner {
            animation: none;
          }
          
          .progress-bar,
          .stage-item {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingState;