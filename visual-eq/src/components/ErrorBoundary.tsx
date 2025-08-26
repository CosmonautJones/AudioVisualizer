import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { type AudioVisualizerError, isAudioVisualizerError } from '../types/audio';
import { audioEngine } from '../services/audioEngine';

// Props for the error boundary component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AudioVisualizerError, retry: () => void) => ReactNode;
  onError?: (error: AudioVisualizerError, errorInfo: React.ErrorInfo) => void;
  className?: string;
}

// State for tracking errors and recovery attempts
interface ErrorBoundaryState {
  hasError: boolean;
  error: AudioVisualizerError | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRecovering: boolean;
}

// Maximum retry attempts before showing permanent error state
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 2000;

/**
 * Audio-specific error boundary for React audio visualizer applications.
 * 
 * Handles Web Audio API errors, canvas context loss, microphone permissions,
 * and file loading errors with intelligent recovery strategies.
 * 
 * Features:
 * - Audio-specific error categorization and handling
 * - Graceful degradation with fallback modes
 * - User-friendly recovery actions with retry logic
 * - Accessibility-compliant error messaging
 * - Performance-optimized error reporting
 * - Mobile-responsive error displays
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null;
  private errorReportingEnabled = true;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    };

    // Bind methods to maintain context
    this.handleRetry = this.handleRetry.bind(this);
    this.handleRefresh = this.handleRefresh.bind(this);
    this.handleDismiss = this.handleDismiss.bind(this);
    this.reportError = this.reportError.bind(this);
  }

  // React error boundary lifecycle method
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Convert generic errors to audio-specific errors
    const audioError = ErrorBoundary.convertToAudioError(error);
    
    return {
      hasError: true,
      error: audioError,
      isRecovering: false
    };
  }

  // Error info capture for debugging and reporting
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const audioError = ErrorBoundary.convertToAudioError(error);
    
    this.setState({
      error: audioError,
      errorInfo,
      retryCount: 0
    });

    // Report error to parent component and external services
    this.props.onError?.(audioError, errorInfo);
    this.reportError(audioError, errorInfo);

    // Log detailed error information for debugging
    console.group('🚨 Audio Visualizer Error Boundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Audio Error:', audioError);
    console.groupEnd();
  }

  // Cleanup on unmount
  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  // Convert generic errors to audio-specific error types
  private static convertToAudioError(error: Error): AudioVisualizerError {
    if (isAudioVisualizerError(error)) {
      return error;
    }

    const message = error.message.toLowerCase();

    // Audio context errors
    if (message.includes('audiocontext') || message.includes('audio context')) {
      return {
        type: 'audio_context_failed',
        reason: error.message,
        message: error.message,
        canRetry: true
      };
    }

    // Permission errors
    if (message.includes('permission') || message.includes('notallowed')) {
      return {
        type: 'permission_denied',
        source: 'microphone',
        message: error.message,
        canRetry: true
      };
    }

    // Canvas errors
    if (message.includes('canvas') || message.includes('webgl') || message.includes('2d')) {
      return {
        type: 'canvas_render_failed',
        context: message.includes('webgl') ? 'webgl' : '2d',
        fallbackAvailable: true,
        message: error.message,
        canRetry: true
      };
    }

    // File format errors
    if (message.includes('decode') || message.includes('format') || message.includes('codec')) {
      return {
        type: 'file_format_unsupported',
        format: 'unknown',
        supportedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
        message: error.message,
        canRetry: false
      };
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('load')) {
      return {
        type: 'network_error',
        url: window.location.href,
        message: error.message,
        canRetry: true
      };
    }

    // Default to browser incompatibility
    return {
      type: 'browser_incompatible',
      feature: 'unknown',
      alternatives: ['Update your browser to the latest version'],
      message: error.message,
      canRetry: false
    };
  }

  // Handle retry attempts with exponential backoff
  private async handleRetry(): Promise<void> {
    if (this.state.retryCount >= MAX_RETRY_ATTEMPTS) {
      return;
    }

    this.setState({ isRecovering: true });

    try {
      // Wait for cooldown period
      await new Promise(resolve => {
        this.retryTimeoutId = window.setTimeout(resolve, RETRY_COOLDOWN_MS * (this.state.retryCount + 1));
      });

      // Attempt recovery based on error type
      const recoveryResult = await this.attemptRecovery(this.state.error);
      
      if (recoveryResult.success) {
        // Reset error state on successful recovery
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: 0,
          isRecovering: false
        });
      } else {
        // Increment retry count and update error
        this.setState(prevState => ({
          retryCount: prevState.retryCount + 1,
          isRecovering: false,
          error: recoveryResult.error || prevState.error
        }));
      }
    } catch (error) {
      // Recovery attempt failed
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1,
        isRecovering: false
      }));
    }
  }

  // Attempt recovery based on error type
  private async attemptRecovery(error: AudioVisualizerError | null): Promise<{success: boolean; error?: AudioVisualizerError}> {
    if (!error) return { success: false };

    switch (error.type) {
      case 'audio_context_failed':
        return await this.recoverAudioContext();
      
      case 'permission_denied':
        return await this.recoverPermissions();
      
      case 'canvas_render_failed':
        return await this.recoverCanvasContext();
      
      case 'file_format_unsupported':
        return { success: false }; // Cannot recover from unsupported format
      
      case 'network_error':
        return await this.recoverNetworkConnection();
      
      case 'browser_incompatible':
        return { success: false }; // Cannot recover from browser incompatibility
      
      default:
        return { success: false };
    }
  }

  // Recover audio context
  private async recoverAudioContext(): Promise<{success: boolean; error?: AudioVisualizerError}> {
    try {
      // Dispose existing context and reinitialize
      audioEngine.dispose();
      const result = await audioEngine.initialize();
      
      if (result.success) {
        // Handle user gesture requirement
        if (audioEngine.getContext().state === 'suspended') {
          const gestureResult = await audioEngine.handleUserGesture();
          return { success: gestureResult.success, ...(gestureResult.success ? {} : { error: gestureResult.error }) };
        }
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { 
        success: false, 
        error: {
          type: 'audio_context_failed',
          reason: error instanceof Error ? error.message : 'Recovery failed',
          message: `Audio context recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          canRetry: false
        }
      };
    }
  }

  // Recover permissions (redirect to permission request)
  private async recoverPermissions(): Promise<{success: boolean; error?: AudioVisualizerError}> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Clean up test stream
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'permission_denied',
          source: 'microphone',
          message: error instanceof Error ? error.message : 'Permission denied',
          canRetry: true
        }
      };
    }
  }

  // Recover canvas context
  private async recoverCanvasContext(): Promise<{success: boolean; error?: AudioVisualizerError}> {
    // Canvas recovery typically requires page refresh
    // Return false to trigger refresh option
    return { success: false };
  }

  // Recover network connection
  private async recoverNetworkConnection(): Promise<{success: boolean; error?: AudioVisualizerError}> {
    try {
      const response = await fetch(window.location.href, { method: 'HEAD' });
      return { success: response.ok };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'network_error',
          url: window.location.href,
          message: 'Network connection failed during recovery attempt',
          canRetry: true
        }
      };
    }
  }

  // Force page refresh for unrecoverable errors
  private handleRefresh(): void {
    window.location.reload();
  }

  // Dismiss error and attempt to continue (risky)
  private handleDismiss(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    });
  }

  // Report error to external services (analytics, logging, etc.)
  private reportError(error: AudioVisualizerError, errorInfo: React.ErrorInfo): void {
    if (!this.errorReportingEnabled) return;

    // In a real application, you would send this to your error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    const errorReport = {
      error,
      errorInfo,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    console.log('Error Report:', errorReport);
    
    // Prevent multiple reports for the same error
    this.errorReportingEnabled = false;
    setTimeout(() => {
      this.errorReportingEnabled = true;
    }, 5000);
  }

  // Get user-friendly error message
  private getErrorMessage(error: AudioVisualizerError): string {
    switch (error.type) {
      case 'permission_denied':
        return 'Microphone access is required for audio visualization. Please grant permission and try again.';
      
      case 'file_format_unsupported':
        return `The selected audio file format is not supported. Please try with ${error.supportedFormats.join(', ')} files.`;
      
      case 'audio_context_failed':
        return 'Audio system initialization failed. This may be due to browser restrictions or system limitations.';
      
      case 'canvas_render_failed':
        return 'Graphics rendering failed. Your browser may not support the required graphics features.';
      
      case 'network_error':
        return 'Network connection failed. Please check your internet connection and try again.';
      
      case 'browser_incompatible':
        return `Your browser doesn't support required features: ${error.feature}. Please update your browser.`;
      
      default:
        return 'An unexpected error occurred. Please try again or refresh the page.';
    }
  }

  // Get recovery actions based on error type
  private getRecoveryActions(error: AudioVisualizerError): Array<{label: string; action: () => void; primary?: boolean}> {
    const actions: Array<{label: string; action: () => void; primary?: boolean}> = [];

    // Always provide refresh option
    actions.push({
      label: 'Refresh Page',
      action: this.handleRefresh
    });

    // Add specific recovery actions based on error type
    switch (error.type) {
      case 'audio_context_failed':
        if (error.canRetry && this.state.retryCount < MAX_RETRY_ATTEMPTS) {
          actions.unshift({
            label: this.state.isRecovering ? 'Recovering...' : 'Retry Audio',
            action: this.handleRetry,
            primary: true
          });
        }
        break;
      
      case 'permission_denied':
        actions.unshift({
          label: 'Grant Permission',
          action: this.handleRetry,
          primary: true
        });
        break;
      
      case 'canvas_render_failed':
        if (error.fallbackAvailable) {
          actions.unshift({
            label: 'Try Simplified Mode',
            action: this.handleRetry,
            primary: true
          });
        }
        break;
      
      case 'network_error':
        actions.unshift({
          label: 'Retry Connection',
          action: this.handleRetry,
          primary: true
        });
        break;
    }

    // Add dismiss option for non-critical errors
    if (this.state.retryCount > 0) {
      actions.push({
        label: 'Continue Anyway',
        action: this.handleDismiss
      });
    }

    return actions;
  }

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.handleRetry);
    }

    const errorMessage = this.getErrorMessage(this.state.error);
    const recoveryActions = this.getRecoveryActions(this.state.error);

    return (
      <div className={`error-boundary ${this.props.className || ''}`} role="alert">
        <div className="error-boundary__container">
          <div className="error-boundary__icon" aria-hidden="true">
            ⚠️
          </div>
          
          <div className="error-boundary__content">
            <h2 className="error-boundary__title">
              Something went wrong
            </h2>
            
            <p className="error-boundary__message">
              {errorMessage}
            </p>
            
            {this.state.retryCount > 0 && (
              <p className="error-boundary__retry-info">
                Retry attempt {this.state.retryCount} of {MAX_RETRY_ATTEMPTS}
              </p>
            )}
            
            <div className="error-boundary__actions">
              {recoveryActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  disabled={this.state.isRecovering}
                  className={`error-boundary__action ${action.primary ? 'error-boundary__action--primary' : ''}`}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
            
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="error-boundary__debug">
                <summary>Debug Information</summary>
                <pre className="error-boundary__debug-content">
                  {JSON.stringify(this.state.error, null, 2)}
                  {'\n\nComponent Stack:'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
        
        <style>{`
          .error-boundary {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            padding: 2rem;
            background: var(--background, #242424);
            color: var(--foreground, rgba(255, 255, 255, 0.87));
            border-radius: 8px;
            font-family: system-ui, sans-serif;
          }
          
          .error-boundary__container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 500px;
            width: 100%;
          }
          
          .error-boundary__icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          
          .error-boundary__title {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0 0 1rem 0;
            color: #ff6b6b;
          }
          
          .error-boundary__message {
            font-size: 1rem;
            line-height: 1.5;
            margin: 0 0 1rem 0;
            opacity: 0.9;
          }
          
          .error-boundary__retry-info {
            font-size: 0.875rem;
            margin: 0 0 1.5rem 0;
            opacity: 0.7;
            font-style: italic;
          }
          
          .error-boundary__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            justify-content: center;
            margin-bottom: 2rem;
          }
          
          .error-boundary__action {
            padding: 0.75rem 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: inherit;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 120px;
          }
          
          .error-boundary__action:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
          }
          
          .error-boundary__action--primary {
            background: #646cff;
            border-color: #646cff;
            color: white;
          }
          
          .error-boundary__action--primary:hover:not(:disabled) {
            background: #535bf2;
            border-color: #535bf2;
          }
          
          .error-boundary__action:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          
          .error-boundary__debug {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            text-align: left;
            width: 100%;
          }
          
          .error-boundary__debug summary {
            cursor: pointer;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #ffd93d;
          }
          
          .error-boundary__debug-content {
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
            margin: 0;
            color: rgba(255, 255, 255, 0.7);
          }
          
          @media (max-width: 768px) {
            .error-boundary {
              padding: 1rem;
              min-height: 300px;
            }
            
            .error-boundary__container {
              max-width: 100%;
            }
            
            .error-boundary__icon {
              font-size: 2.5rem;
            }
            
            .error-boundary__title {
              font-size: 1.25rem;
            }
            
            .error-boundary__actions {
              flex-direction: column;
              width: 100%;
            }
            
            .error-boundary__action {
              width: 100%;
            }
          }
          
          @media (prefers-reduced-motion: reduce) {
            .error-boundary__action {
              transition: none;
            }
            
            .error-boundary__action:hover:not(:disabled) {
              transform: none;
            }
          }
          
          @media (prefers-color-scheme: light) {
            .error-boundary {
              background: #ffffff;
              color: #213547;
            }
            
            .error-boundary__action {
              border-color: rgba(0, 0, 0, 0.2);
              background: rgba(0, 0, 0, 0.05);
            }
            
            .error-boundary__action:hover:not(:disabled) {
              background: rgba(0, 0, 0, 0.1);
              border-color: rgba(0, 0, 0, 0.3);
            }
            
            .error-boundary__debug {
              background: rgba(0, 0, 0, 0.05);
            }
            
            .error-boundary__debug-content {
              color: rgba(0, 0, 0, 0.7);
            }
          }
        `}</style>
      </div>
    );
  }
}

// Default export for easy importing
export default ErrorBoundary;

// Type exports for TypeScript consumers
export type { ErrorBoundaryProps, ErrorBoundaryState };