import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext
} from 'react';
import type { ReactNode } from 'react';
import { useAudioVisualizer } from '../../context/AudioVisualizerContext';
import { useAccessibility } from './AccessibilityLayer';
import type { DeviceCapability } from '../../types/canvas';
import type { AudioSourceType, VisualizationType } from '../../types/audio';
import { detectDeviceType, getDeviceCapability } from '../../utils/deviceDetection';

// =============================================================================
// MOBILE INTERFACE CONFIGURATION
// =============================================================================

export interface MobileInterfaceSettings {
  readonly gestures: {
    readonly enabled: boolean;
    readonly swipeThreshold: number;
    readonly longPressDelay: number;
    readonly doubleTapDelay: number;
    readonly panSensitivity: number;
  };
  readonly bottomSheet: {
    readonly enabled: boolean;
    readonly snapPoints: readonly number[];
    readonly initialSnap: number;
    readonly backdropDismiss: boolean;
    readonly swipeToClose: boolean;
  };
  readonly floatingControls: {
    readonly enabled: boolean;
    readonly position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    readonly autoHide: boolean;
    readonly autoHideDelay: number;
  };
  readonly haptics: {
    readonly enabled: boolean;
    readonly feedbackLevel: 'light' | 'medium' | 'heavy';
    readonly gestureConfirmation: boolean;
    readonly buttonFeedback: boolean;
  };
  readonly safeArea: {
    readonly respectInsets: boolean;
    readonly minPadding: number;
    readonly adaptiveLayout: boolean;
  };
}

interface TouchState {
  readonly isActive: boolean;
  readonly startTime: number;
  readonly startPosition: { x: number; y: number };
  readonly currentPosition: { x: number; y: number };
  readonly velocity: { x: number; y: number };
  readonly touches: readonly Touch[];
}

interface GestureState {
  readonly type: 'none' | 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pan' | 'pinch';
  readonly direction?: 'up' | 'down' | 'left' | 'right';
  readonly distance: number;
  readonly duration: number;
  readonly scale?: number;
}

// =============================================================================
// DEFAULT SETTINGS
// =============================================================================

const DEFAULT_MOBILE_SETTINGS: MobileInterfaceSettings = {
  gestures: {
    enabled: true,
    swipeThreshold: 50,
    longPressDelay: 500,
    doubleTapDelay: 300,
    panSensitivity: 1,
  },
  bottomSheet: {
    enabled: true,
    snapPoints: [0.1, 0.4, 0.8],
    initialSnap: 0.1,
    backdropDismiss: true,
    swipeToClose: true,
  },
  floatingControls: {
    enabled: true,
    position: 'bottom-right',
    autoHide: true,
    autoHideDelay: 3000,
  },
  haptics: {
    enabled: true,
    feedbackLevel: 'medium',
    gestureConfirmation: true,
    buttonFeedback: true,
  },
  safeArea: {
    respectInsets: true,
    minPadding: 16,
    adaptiveLayout: true,
  },
};

// =============================================================================
// MOBILE INTERFACE CONTEXT
// =============================================================================

interface MobileInterfaceContextValue {
  readonly settings: MobileInterfaceSettings;
  readonly touchState: TouchState;
  readonly gestureState: GestureState;
  readonly bottomSheetState: {
    readonly isOpen: boolean;
    readonly currentSnap: number;
    readonly isDragging: boolean;
  };
  readonly floatingControlsState: {
    readonly isVisible: boolean;
    readonly isInteracting: boolean;
  };
  readonly safeAreaInsets: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
  };
  readonly updateSettings: (settings: Partial<MobileInterfaceSettings>) => void;
  readonly triggerHaptic: (pattern: 'light' | 'medium' | 'heavy' | number[]) => void;
  readonly openBottomSheet: (snapIndex?: number) => void;
  readonly closeBottomSheet: () => void;
  readonly showFloatingControls: () => void;
  readonly hideFloatingControls: () => void;
}

const MobileInterfaceContext = createContext<MobileInterfaceContextValue | null>(null);

// =============================================================================
// GESTURE RECOGNITION ENGINE
// =============================================================================

class GestureRecognizer {
  // private touchHistory: Array<{ position: { x: number; y: number }; timestamp: number }> = []; // Unused
  private tapTimeout: number | null = null;
  private longPressTimeout: number | null = null;
  private tapCount = 0;

  recognizeGesture(
    touchState: TouchState,
    settings: MobileInterfaceSettings['gestures']
  ): GestureState {
    const { startPosition, currentPosition, startTime, touches } = touchState;
    const currentTime = Date.now();
    const duration = currentTime - startTime;
    const deltaX = currentPosition.x - startPosition.x;
    const deltaY = currentPosition.y - startPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Multi-touch gestures (pinch)
    if (touches.length === 2) {
      return this.recognizePinchGesture(touches, duration);
    }

    // Single touch gestures
    if (touches.length === 1) {
      // Long press detection
      if (duration >= settings.longPressDelay && distance < 20) {
        return {
          type: 'long-press',
          distance,
          duration,
        };
      }

      // Swipe detection
      if (distance >= settings.swipeThreshold) {
        const direction = this.getSwipeDirection(deltaX, deltaY);
        return {
          type: 'swipe',
          direction,
          distance,
          duration,
        };
      }

      // Pan detection (continuous movement)
      if (distance > 10 && duration > 100) {
        return {
          type: 'pan',
          distance,
          duration,
        };
      }
    }

    // Tap detection (on touch end)
    if (!touchState.isActive && distance < 20) {
      return this.recognizeTapGesture(settings.doubleTapDelay, duration);
    }

    return {
      type: 'none',
      distance,
      duration,
    };
  }

  private recognizePinchGesture(touches: readonly Touch[], duration: number): GestureState {
    if (touches.length !== 2) {
      return { type: 'none', distance: 0, duration };
    }

    const touch1 = touches[0];
    const touch2 = touches[1];
    
    const currentDistance = Math.sqrt(
      Math.pow(touch1.clientX - touch2.clientX, 2) + 
      Math.pow(touch1.clientY - touch2.clientY, 2)
    );

    // Store initial distance in class property for comparison
    // This is simplified - would need proper state management for pinch scale
    const scale = 1.0; // Placeholder

    return {
      type: 'pinch',
      distance: currentDistance,
      duration,
      scale,
    };
  }

  private recognizeTapGesture(doubleTapDelay: number, duration: number): GestureState {
    this.tapCount++;
    
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
    }

    return new Promise((resolve) => {
      this.tapTimeout = setTimeout(() => {
        const gestureType = this.tapCount === 1 ? 'tap' : 'double-tap';
        this.tapCount = 0;
        resolve({
          type: gestureType,
          distance: 0,
          duration,
        });
      }, doubleTapDelay);
    }) as any; // Simplified for this example
  }

  private getSwipeDirection(deltaX: number, deltaY: number): 'up' | 'down' | 'left' | 'right' {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  cleanup(): void {
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
      this.tapTimeout = null;
    }
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    // this.touchHistory = []; // Unused property
    this.tapCount = 0;
  }
}

// =============================================================================
// BOTTOM SHEET COMPONENT
// =============================================================================

interface BottomSheetProps {
  readonly isOpen: boolean;
  readonly snapPoints: readonly number[];
  readonly currentSnap: number;
  readonly onSnapChange: (snapIndex: number) => void;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly backdropDismiss: boolean;
  readonly swipeToClose: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  snapPoints,
  currentSnap,
  onSnapChange,
  onClose,
  children,
  backdropDismiss,
  swipeToClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentHeight = useMemo(() => {
    const viewportHeight = window.innerHeight;
    return viewportHeight * snapPoints[currentSnap];
  }, [snapPoints, currentSnap]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!swipeToClose) return;
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, [swipeToClose]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const offset = Math.max(0, currentY - startY.current);
    setDragOffset(offset);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine snap point based on drag distance and velocity
    const threshold = currentHeight * 0.3;
    
    if (dragOffset > threshold) {
      const nextSnapIndex = Math.max(0, currentSnap - 1);
      if (nextSnapIndex === 0 && swipeToClose) {
        onClose();
      } else {
        onSnapChange(nextSnapIndex);
      }
    } else {
      // Snap back to current position
    }
    
    setDragOffset(0);
  }, [isDragging, dragOffset, currentHeight, currentSnap, swipeToClose, onClose, onSnapChange]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        onClick={backdropDismiss ? onClose : undefined}
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${currentHeight + dragOffset}px`,
          backgroundColor: '#1a1a1a',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          zIndex: 1001,
          transform: `translateY(${isDragging ? -dragOffset : 0}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease, height 0.3s ease',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div
          style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#666',
            borderRadius: '2px',
            margin: '8px auto 16px',
            cursor: 'grab',
          }}
        />
        
        {/* Content */}
        <div
          style={{
            padding: '0 16px 16px',
            height: 'calc(100% - 28px)',
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

// =============================================================================
// FLOATING ACTION BUTTONS
// =============================================================================

interface FloatingControlsProps {
  readonly isVisible: boolean;
  readonly position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  readonly onPlayPauseClick: () => void;
  readonly onMicToggle: () => void;
  readonly onSettingsClick: () => void;
  readonly isPlaying: boolean;
  readonly isMicActive: boolean;
  readonly safeAreaInsets: { bottom: number; right: number; left: number; top: number };
}

const FloatingControls: React.FC<FloatingControlsProps> = ({
  isVisible,
  position,
  onPlayPauseClick,
  onMicToggle,
  onSettingsClick,
  isPlaying,
  isMicActive,
  safeAreaInsets,
}) => {
  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    };

    switch (position) {
      case 'bottom-right':
        return {
          ...baseStyles,
          bottom: `${16 + safeAreaInsets.bottom}px`,
          right: `${16 + safeAreaInsets.right}px`,
        };
      case 'bottom-left':
        return {
          ...baseStyles,
          bottom: `${16 + safeAreaInsets.bottom}px`,
          left: `${16 + safeAreaInsets.left}px`,
        };
      case 'top-right':
        return {
          ...baseStyles,
          top: `${16 + safeAreaInsets.top}px`,
          right: `${16 + safeAreaInsets.right}px`,
        };
      case 'top-left':
        return {
          ...baseStyles,
          top: `${16 + safeAreaInsets.top}px`,
          left: `${16 + safeAreaInsets.left}px`,
        };
    }
  };

  const buttonBaseStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: '28px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.2s ease',
    touchAction: 'manipulation',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#007acc',
    color: '#fff',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#333',
    color: '#fff',
  };

  if (!isVisible) return null;

  return (
    <div style={getPositionStyles()}>
      {/* Primary Play/Pause Button */}
      <button
        style={primaryButtonStyle}
        onClick={onPlayPauseClick}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>

      {/* Microphone Toggle */}
      <button
        style={{
          ...secondaryButtonStyle,
          backgroundColor: isMicActive ? '#dc3545' : '#333',
        }}
        onClick={onMicToggle}
        aria-label={isMicActive ? 'Turn off microphone' : 'Turn on microphone'}
      >
        🎤
      </button>

      {/* Settings */}
      <button
        style={secondaryButtonStyle}
        onClick={onSettingsClick}
        aria-label="Open settings"
      >
        ⚙️
      </button>
    </div>
  );
};

// =============================================================================
// MOBILE CANVAS CONTAINER
// =============================================================================

interface MobileCanvasProps {
  readonly children: ReactNode;
  readonly onGesture: (gesture: GestureState) => void;
  readonly gestureSettings: MobileInterfaceSettings['gestures'];
  readonly className?: string;
}

const MobileCanvas: React.FC<MobileCanvasProps> = ({
  children,
  onGesture,
  gestureSettings,
  className,
}) => {
  const [touchState, setTouchState] = useState<TouchState>({
    isActive: false,
    startTime: 0,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    touches: [] as unknown as readonly Touch[],
  });

  const gestureRecognizer = useRef(new GestureRecognizer());
  const lastMoveTime = useRef(0);
  const lastPosition = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const touch = e.touches[0];
    const startTime = Date.now();
    const startPosition = { x: touch.clientX, y: touch.clientY };

    setTouchState({
      isActive: true,
      startTime,
      startPosition,
      currentPosition: startPosition,
      velocity: { x: 0, y: 0 },
      touches: Array.from(e.touches) as unknown as readonly Touch[],
    });

    lastMoveTime.current = startTime;
    lastPosition.current = startPosition;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (!touchState.isActive) return;

    const touch = e.touches[0];
    const currentTime = Date.now();
    const currentPosition = { x: touch.clientX, y: touch.clientY };
    
    // Calculate velocity
    const timeDelta = currentTime - lastMoveTime.current;
    const velocity = {
      x: (currentPosition.x - lastPosition.current.x) / timeDelta,
      y: (currentPosition.y - lastPosition.current.y) / timeDelta,
    };

    setTouchState(prev => ({
      ...prev,
      currentPosition,
      velocity,
      touches: Array.from(e.touches) as unknown as readonly Touch[],
    }));

    // Recognize gesture during movement
    const gesture = gestureRecognizer.current.recognizeGesture(
      { ...touchState, currentPosition, touches: Array.from(e.touches) as unknown as readonly Touch[] },
      gestureSettings
    );

    if (gesture.type !== 'none') {
      onGesture(gesture);
    }

    lastMoveTime.current = currentTime;
    lastPosition.current = currentPosition;
  }, [touchState, gestureSettings, onGesture]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    // Final gesture recognition
    const finalGesture = gestureRecognizer.current.recognizeGesture(
      touchState,
      gestureSettings
    );

    if (finalGesture.type !== 'none') {
      onGesture(finalGesture);
    }

    setTouchState({
      isActive: false,
      startTime: 0,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      touches: [] as unknown as readonly Touch[],
    });
  }, [touchState, gestureSettings, onGesture]);

  useEffect(() => {
    return () => {
      gestureRecognizer.current.cleanup();
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
        userSelect: 'none',
        position: 'relative',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
};

// =============================================================================
// MOBILE INTERFACE PROVIDER
// =============================================================================

interface MobileInterfaceProviderProps {
  readonly children: ReactNode;
  readonly initialSettings?: Partial<MobileInterfaceSettings>;
  readonly onSettingsChange?: (settings: MobileInterfaceSettings) => void;
}

export const MobileInterfaceProvider: React.FC<MobileInterfaceProviderProps> = ({
  children,
  initialSettings,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<MobileInterfaceSettings>({
    ...DEFAULT_MOBILE_SETTINGS,
    ...initialSettings,
  });

  const [touchState, setTouchState] = useState<TouchState>({
    isActive: false,
    startTime: 0,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    touches: [] as unknown as readonly Touch[],
  });

  const [gestureState, setGestureState] = useState<GestureState>({
    type: 'none',
    distance: 0,
    duration: 0,
  });

  const [bottomSheetState, setBottomSheetState] = useState({
    isOpen: false,
    currentSnap: 0,
    isDragging: false,
  });

  const [floatingControlsState, setFloatingControlsState] = useState({
    isVisible: true,
    isInteracting: false,
  });

  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  // Get safe area insets for iOS devices
  useEffect(() => {
    const updateSafeAreaInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      
      setSafeAreaInsets({
        top: parseFloat(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
        bottom: parseFloat(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseFloat(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
        right: parseFloat(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
      });
    };

    updateSafeAreaInsets();
    window.addEventListener('resize', updateSafeAreaInsets);
    window.addEventListener('orientationchange', updateSafeAreaInsets);

    return () => {
      window.removeEventListener('resize', updateSafeAreaInsets);
      window.removeEventListener('orientationchange', updateSafeAreaInsets);
    };
  }, []);

  // Auto-hide floating controls
  useEffect(() => {
    if (!settings.floatingControls.autoHide) return;

    const timer = setTimeout(() => {
      if (!floatingControlsState.isInteracting) {
        setFloatingControlsState(prev => ({ ...prev, isVisible: false }));
      }
    }, settings.floatingControls.autoHideDelay);

    return () => clearTimeout(timer);
  }, [settings.floatingControls, floatingControlsState.isInteracting, touchState.isActive]);

  const updateSettings = useCallback((newSettings: Partial<MobileInterfaceSettings>) => {
    setSettings(prev => {
      const updated = { ...prev };
      
      // Deep merge settings
      Object.keys(newSettings).forEach(key => {
        const settingKey = key as keyof MobileInterfaceSettings;
        if (typeof newSettings[settingKey] === 'object' && newSettings[settingKey] !== null) {
          updated[settingKey] = { ...prev[settingKey], ...newSettings[settingKey] } as any;
        } else {
          updated[settingKey] = newSettings[settingKey] as any;
        }
      });
      
      return updated;
    });
  }, []);

  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy' | number[]) => {
    if (!settings.haptics.enabled || !('vibrate' in navigator)) return;

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

    navigator.vibrate(vibrationPattern);
  }, [settings.haptics.enabled]);

  const openBottomSheet = useCallback((snapIndex: number = 1) => {
    setBottomSheetState({
      isOpen: true,
      currentSnap: snapIndex,
      isDragging: false,
    });
    
    if (settings.haptics.enabled) {
      triggerHaptic('medium');
    }
  }, [settings.haptics.enabled, triggerHaptic]);

  const closeBottomSheet = useCallback(() => {
    setBottomSheetState({
      isOpen: false,
      currentSnap: 0,
      isDragging: false,
    });
  }, []);

  const showFloatingControls = useCallback(() => {
    setFloatingControlsState(prev => ({ ...prev, isVisible: true }));
  }, []);

  const hideFloatingControls = useCallback(() => {
    setFloatingControlsState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Notify of settings changes
  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const contextValue: MobileInterfaceContextValue = useMemo(() => ({
    settings,
    touchState,
    gestureState,
    bottomSheetState,
    floatingControlsState,
    safeAreaInsets,
    updateSettings,
    triggerHaptic,
    openBottomSheet,
    closeBottomSheet,
    showFloatingControls,
    hideFloatingControls,
  }), [
    settings,
    touchState,
    gestureState,
    bottomSheetState,
    floatingControlsState,
    safeAreaInsets,
    updateSettings,
    triggerHaptic,
    openBottomSheet,
    closeBottomSheet,
    showFloatingControls,
    hideFloatingControls,
  ]);

  return (
    <MobileInterfaceContext.Provider value={contextValue}>
      {children}
    </MobileInterfaceContext.Provider>
  );
};

// =============================================================================
// MAIN MOBILE INTERFACE COMPONENT
// =============================================================================

export interface MobileInterfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export const MobileInterface: React.FC<MobileInterfaceProps> = ({
  children,
  className,
  style,
}) => {
  // Context hooks
  const {
    state,
    actions,
    audioContext,
    responsiveCanvas,
    isReady,
  } = useAudioVisualizer();

  const {
    settings: mobileSettings,
    bottomSheetState,
    floatingControlsState,
    safeAreaInsets,
    openBottomSheet,
    closeBottomSheet,
    showFloatingControls,
    triggerHaptic,
  } = useMobileInterface();

  const { triggerHaptic: accessibilityHaptic } = useAccessibility();

  // Local state
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceCapability | null>(null);

  // Initialize device detection
  useEffect(() => {
    const initDevice = async () => {
      try {
        const capability = await getDeviceCapability();
        setDeviceInfo(capability);
      } catch (error) {
        console.error('Failed to get device capability:', error);
      }
    };

    initDevice();
  }, []);

  // Handle gestures
  const handleGesture = useCallback((gesture: GestureState) => {
    // Trigger haptic feedback for gesture confirmation
    if (mobileSettings.haptics.gestureConfirmation) {
      triggerHaptic('light');
    }

    switch (gesture.type) {
      case 'swipe':
        switch (gesture.direction) {
          case 'up':
            openBottomSheet(1);
            break;
          case 'down':
            if (bottomSheetState.isOpen) {
              closeBottomSheet();
            }
            break;
          case 'left':
            // Next track or visualization type
            const visualizationTypes: VisualizationType[] = ['frequency', 'waveform', 'spectrogram'];
            const currentIndex = visualizationTypes.indexOf(state.visualization.rendererType);
            const nextIndex = (currentIndex + 1) % visualizationTypes.length;
            actions.setRendererType(visualizationTypes[nextIndex]);
            break;
          case 'right':
            // Previous track or visualization type
            const types: VisualizationType[] = ['frequency', 'waveform', 'spectrogram'];
            const index = types.indexOf(state.visualization.rendererType);
            const prevIndex = (index - 1 + types.length) % types.length;
            actions.setRendererType(types[prevIndex]);
            break;
        }
        break;

      case 'double-tap':
        // Toggle play/pause
        actions.togglePlayback();
        triggerHaptic('medium');
        break;

      case 'long-press':
        // Open context menu or settings
        openBottomSheet(2);
        triggerHaptic('heavy');
        break;

      case 'pan':
        // Volume control or seek (depending on direction)
        break;

      case 'pinch':
        // Zoom or sensitivity adjustment
        if (gesture.scale && gesture.scale !== 1) {
          const currentSensitivity = state.visualization.config.sensitivity;
          const newSensitivity = Math.max(0.1, Math.min(5, currentSensitivity * gesture.scale));
          actions.updateVisualizationConfig({ sensitivity: newSensitivity });
        }
        break;
    }

    // Show floating controls on any gesture
    showFloatingControls();
  }, [
    mobileSettings.haptics,
    triggerHaptic,
    openBottomSheet,
    closeBottomSheet,
    bottomSheetState.isOpen,
    state.visualization,
    actions,
    showFloatingControls,
  ]);

  // Handle floating control actions
  const handlePlayPause = useCallback(() => {
    actions.togglePlayback();
    
    if (mobileSettings.haptics.buttonFeedback) {
      triggerHaptic('medium');
    }
  }, [actions, mobileSettings.haptics.buttonFeedback, triggerHaptic]);

  const handleMicToggle = useCallback(async () => {
    try {
      const currentSource = state.audio.currentSource;
      const newSource: AudioSourceType = currentSource === 'microphone' ? 'file' : 'microphone';
      
      await actions.selectAudioSource(newSource);
      
      if (mobileSettings.haptics.buttonFeedback) {
        triggerHaptic('light');
      }
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [state.audio.currentSource, actions, mobileSettings.haptics.buttonFeedback, triggerHaptic]);

  const handleSettingsClick = useCallback(() => {
    setIsControlsVisible(true);
    openBottomSheet(1);
    
    if (mobileSettings.haptics.buttonFeedback) {
      triggerHaptic('light');
    }
  }, [openBottomSheet, mobileSettings.haptics.buttonFeedback, triggerHaptic]);

  // Apply safe area styles
  const safeAreaStyles: React.CSSProperties = mobileSettings.safeArea.respectInsets ? {
    paddingTop: `max(${mobileSettings.safeArea.minPadding}px, ${safeAreaInsets.top}px)`,
    paddingBottom: `max(${mobileSettings.safeArea.minPadding}px, ${safeAreaInsets.bottom}px)`,
    paddingLeft: `max(${mobileSettings.safeArea.minPadding}px, ${safeAreaInsets.left}px)`,
    paddingRight: `max(${mobileSettings.safeArea.minPadding}px, ${safeAreaInsets.right}px)`,
  } : {
    padding: `${mobileSettings.safeArea.minPadding}px`,
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
    ...safeAreaStyles,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Mobile Canvas with Gesture Support */}
      <MobileCanvas
        onGesture={handleGesture}
        gestureSettings={mobileSettings.gestures}
        className="mobile-canvas-container"
      >
        {children}
      </MobileCanvas>

      {/* Floating Action Buttons */}
      {mobileSettings.floatingControls.enabled && (
        <FloatingControls
          isVisible={floatingControlsState.isVisible}
          position={mobileSettings.floatingControls.position}
          onPlayPauseClick={handlePlayPause}
          onMicToggle={handleMicToggle}
          onSettingsClick={handleSettingsClick}
          isPlaying={state.audio.playbackStatus === 'playing'}
          isMicActive={state.audio.currentSource === 'microphone'}
          safeAreaInsets={safeAreaInsets}
        />
      )}

      {/* Bottom Sheet for Controls */}
      {mobileSettings.bottomSheet.enabled && (
        <BottomSheet
          isOpen={bottomSheetState.isOpen}
          snapPoints={mobileSettings.bottomSheet.snapPoints}
          currentSnap={bottomSheetState.currentSnap}
          onSnapChange={(index) => {
            // Update bottom sheet snap
          }}
          onClose={closeBottomSheet}
          backdropDismiss={mobileSettings.bottomSheet.backdropDismiss}
          swipeToClose={mobileSettings.bottomSheet.swipeToClose}
        >
          <MobileControlPanel />
        </BottomSheet>
      )}

      {/* Mobile Status Bar */}
      <MobileStatusBar />
    </div>
  );
};

// =============================================================================
// MOBILE CONTROL PANEL
// =============================================================================

const MobileControlPanel: React.FC = () => {
  const { state, actions } = useAudioVisualizer();
  const { triggerHaptic } = useMobileInterface();

  const controlStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #333',
    color: '#fff',
  };

  const sliderStyle: React.CSSProperties = {
    width: '100px',
    accentColor: '#007acc',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#007acc',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    touchAction: 'manipulation',
  };

  return (
    <div style={{ color: '#fff' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Audio Controls</h3>
      
      {/* Volume Control */}
      <div style={controlStyle}>
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.audio.volume}
          onChange={(e) => actions.setVolume(parseFloat(e.target.value))}
          style={sliderStyle}
        />
        <span>{Math.round(state.audio.volume * 100)}%</span>
      </div>

      {/* Sensitivity Control */}
      <div style={controlStyle}>
        <span>Sensitivity</span>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={state.visualization.config.sensitivity}
          onChange={(e) => actions.updateVisualizationConfig({ 
            sensitivity: parseFloat(e.target.value) 
          })}
          style={sliderStyle}
        />
        <span>{state.visualization.config.sensitivity.toFixed(1)}</span>
      </div>

      {/* Bar Count Control */}
      <div style={controlStyle}>
        <span>Bars</span>
        <input
          type="range"
          min="16"
          max="256"
          step="16"
          value={state.visualization.config.barCount}
          onChange={(e) => actions.updateVisualizationConfig({ 
            barCount: parseInt(e.target.value) 
          })}
          style={sliderStyle}
        />
        <span>{state.visualization.config.barCount}</span>
      </div>

      {/* Visualization Type */}
      <div style={controlStyle}>
        <span>Visualization</span>
        <select
          value={state.visualization.rendererType}
          onChange={(e) => actions.setRendererType(e.target.value as VisualizationType)}
          style={{
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '4px',
            padding: '4px 8px',
          }}
        >
          <option value="frequency">Frequency Bars</option>
          <option value="waveform">Waveform</option>
          <option value="spectrogram">Spectrogram</option>
        </select>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'space-between' }}>
        <button
          style={buttonStyle}
          onClick={() => actions.setFullscreen(!state.ui.fullscreenMode)}
        >
          {state.ui.fullscreenMode ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        
        <button
          style={buttonStyle}
          onClick={() => actions.setAccessibilityMode(!state.ui.accessibilityMode)}
        >
          Accessibility
        </button>
        
        <button
          style={buttonStyle}
          onClick={() => actions.togglePerformanceMetrics()}
        >
          Performance
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// MOBILE STATUS BAR
// =============================================================================

const MobileStatusBar: React.FC = () => {
  const { state } = useAudioVisualizer();
  const { safeAreaInsets } = useMobileInterface();

  const statusBarStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${safeAreaInsets.top}px`,
    left: 0,
    right: 0,
    height: '24px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    fontSize: '12px',
    color: '#fff',
    zIndex: 100,
    backdropFilter: 'blur(10px)',
  };

  return (
    <div style={statusBarStyle}>
      <span>
        {state.audio.sourceMetadata?.name || 'No audio source'}
      </span>
      <span>
        {Math.round(state.performanceMetrics.frameRate)}fps
      </span>
    </div>
  );
};

// =============================================================================
// HOOK FOR USING MOBILE INTERFACE CONTEXT
// =============================================================================

export function useMobileInterface(): MobileInterfaceContextValue {
  const context = useContext(MobileInterfaceContext);
  
  if (!context) {
    throw new Error('useMobileInterface must be used within a MobileInterfaceProvider');
  }
  
  return context;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const isMobileDevice = (): boolean => {
  return detectDeviceType() === 'mobile';
};

export const isIOSDevice = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroidDevice = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

export const supportsPWA = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const requestFullscreen = async (element?: Element): Promise<boolean> => {
  try {
    const targetElement = element || document.documentElement;
    
    if (targetElement.requestFullscreen) {
      await targetElement.requestFullscreen();
      return true;
    }
    // @ts-ignore - Safari prefixed version
    else if (targetElement.webkitRequestFullscreen) {
      // @ts-ignore
      await targetElement.webkitRequestFullscreen();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Fullscreen request failed:', error);
    return false;
  }
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Note: MobileInterfaceSettings interface is already exported above
export type {
  TouchState,
  GestureState,
  MobileInterfaceContextValue,
};

export default MobileInterface;