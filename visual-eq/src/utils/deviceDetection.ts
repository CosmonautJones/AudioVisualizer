import type { DeviceCapability } from '../types/canvas';
import { DEVICE_DETECTION } from '../constants/audio';

/**
 * Comprehensive device capability detection utilities
 * Used by useResponsiveCanvas and other components for optimal performance
 */

/**
 * Detect device type based on user agent and screen dimensions
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const userAgent = navigator.userAgent;
  
  // Mobile detection
  const isMobile = DEVICE_DETECTION.MOBILE_USER_AGENTS.some(regex => regex.test(userAgent));
  if (isMobile) return 'mobile';
  
  // Tablet detection (more complex as tablets can have desktop user agents)
  const isTablet = /iPad|Android.*(?:Tablet|Tab)/i.test(userAgent) || 
                   (window.screen.width >= 768 && window.screen.width <= 1024 && 
                    'ontouchstart' in window);
  if (isTablet) return 'tablet';
  
  return 'desktop';
}

/**
 * Estimate device memory status
 */
export function getMemoryStatus(): 'low' | 'normal' | 'high' {
  // @ts-ignore - deviceMemory is not in all TS types but exists in Chrome
  if (navigator.deviceMemory) {
    // @ts-ignore
    const memory = navigator.deviceMemory;
    if (memory <= 2) return 'low';
    if (memory >= 8) return 'high';
    return 'normal';
  }
  
  // Fallback estimation based on device type
  const deviceType = detectDeviceType();
  switch (deviceType) {
    case 'mobile': return 'low';
    case 'tablet': return 'normal';
    case 'desktop': return 'high';
  }
}

/**
 * Get network connection type
 */
export function getNetworkType(): 'slow' | 'fast' | 'unknown' {
  // @ts-ignore - connection is not in all TS types
  if (navigator.connection) {
    // @ts-ignore
    const effectiveType = navigator.connection.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return 'slow';
    if (effectiveType === '4g' || effectiveType === '5g') return 'fast';
  }
  
  return 'unknown';
}

/**
 * Detect battery status (if available)
 */
export async function getBatteryStatus(): Promise<'charging' | 'discharging' | 'unknown'> {
  try {
    // @ts-ignore - battery API is experimental
    if ('getBattery' in navigator) {
      // @ts-ignore
      const battery = await navigator.getBattery();
      return battery.charging ? 'charging' : 'discharging';
    }
  } catch (error) {
    // Battery API not supported or permission denied
  }
  
  return 'unknown';
}

/**
 * Calculate maximum safe canvas size for the device
 */
export function getMaxCanvasSize(deviceType: 'mobile' | 'tablet' | 'desktop'): number {
  // Browser-imposed limits and device-specific optimizations
  const browserLimit = 4096; // Most browsers limit canvas to 4096x4096 or similar
  
  switch (deviceType) {
    case 'mobile':
      return Math.min(2048, browserLimit); // Conservative for mobile
    case 'tablet':
      return Math.min(4096, browserLimit);
    case 'desktop':
      return Math.min(8192, browserLimit);
    default:
      return browserLimit;
  }
}

/**
 * Detect if high-DPI optimizations should be used
 */
export function shouldUseHighDPI(): boolean {
  const pixelRatio = window.devicePixelRatio || 1;
  const memoryStatus = getMemoryStatus();
  
  // Disable high-DPI on low-memory devices even if they support it
  if (memoryStatus === 'low') return false;
  
  return pixelRatio >= 2;
}

/**
 * Check if the device supports specific web features
 */
export function checkFeatureSupport() {
  return {
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webGL2: (() => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2');
        canvas.remove();
        return !!context;
      } catch {
        return false;
      }
    })(),
    resizeObserver: typeof ResizeObserver !== 'undefined',
    intersectionObserver: typeof IntersectionObserver !== 'undefined',
    audioContext: typeof AudioContext !== 'undefined',
    mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    vibration: 'vibrate' in navigator,
    deviceOrientation: 'DeviceOrientationEvent' in window,
    deviceMotion: 'DeviceMotionEvent' in window,
    webWorkers: typeof Worker !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    wasmStreaming: typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming !== 'undefined'
  };
}

/**
 * Get comprehensive device capabilities
 * Used by useResponsiveCanvas for optimal configuration
 */
export async function getDeviceCapability(): Promise<DeviceCapability> {
  const deviceType = detectDeviceType();
  const screenSize = {
    width: screen.width || window.innerWidth,
    height: screen.height || window.innerHeight
  };
  const pixelRatio = window.devicePixelRatio || 1;
  const isHighDPI = pixelRatio >= 2;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasOrientationChange = typeof window.orientation !== 'undefined';
  
  const memoryStatus = getMemoryStatus();
  const batteryStatus = await getBatteryStatus();
  const networkType = getNetworkType();
  
  const cpuCores = navigator.hardwareConcurrency || 4;
  const maxCanvasSize = getMaxCanvasSize(deviceType);
  
  const features = checkFeatureSupport();
  const supportsOffscreenCanvas = features.offscreenCanvas;
  const supportsWebGL2 = features.webGL2;
  
  // Accessibility preferences
  const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsHaptics = features.vibration;
  
  return {
    deviceType,
    screenSize,
    pixelRatio,
    isHighDPI,
    isTouchDevice,
    hasOrientationChange,
    memoryStatus,
    batteryStatus,
    networkType,
    cpuCores,
    maxCanvasSize,
    supportsOffscreenCanvas,
    supportsWebGL2,
    preferReducedMotion,
    supportsHaptics
  };
}

/**
 * Monitor device capability changes
 * Returns a cleanup function
 */
export function monitorDeviceCapabilityChanges(
  callback: (capability: DeviceCapability) => void
): () => void {
  const cleanupFunctions: (() => void)[] = [];
  
  // Monitor pixel ratio changes (zoom, external monitor)
  const handlePixelRatioChange = async () => {
    const capability = await getDeviceCapability();
    callback(capability);
  };
  
  const pixelRatio = window.devicePixelRatio || 1;
  const mediaQuery = matchMedia(`(resolution: ${pixelRatio}dppx)`);
  
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handlePixelRatioChange);
    cleanupFunctions.push(() => mediaQuery.removeEventListener('change', handlePixelRatioChange));
  }
  
  // Monitor reduced motion preference changes
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', handlePixelRatioChange);
    cleanupFunctions.push(() => reducedMotionQuery.removeEventListener('change', handlePixelRatioChange));
  }
  
  // Monitor network changes
  // @ts-ignore - connection is not in all TS types
  if (navigator.connection) {
    // @ts-ignore
    const connection = navigator.connection;
    const handleConnectionChange = async () => {
      const capability = await getDeviceCapability();
      callback(capability);
    };
    
    connection.addEventListener('change', handleConnectionChange);
    cleanupFunctions.push(() => connection.removeEventListener('change', handleConnectionChange));
  }
  
  // Monitor battery changes
  // @ts-ignore - battery API is experimental
  if ('getBattery' in navigator) {
    // @ts-ignore
    navigator.getBattery().then((battery: any) => {
      const handleBatteryChange = async () => {
        const capability = await getDeviceCapability();
        callback(capability);
      };
      
      battery.addEventListener('chargingchange', handleBatteryChange);
      battery.addEventListener('levelchange', handleBatteryChange);
      
      cleanupFunctions.push(() => {
        battery.removeEventListener('chargingchange', handleBatteryChange);
        battery.removeEventListener('levelchange', handleBatteryChange);
      });
    }).catch(() => {
      // Battery API not available
    });
  }
  
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}

/**
 * Get optimal canvas configuration based on device capability
 */
export function getOptimalCanvasConfig(capability: DeviceCapability) {
  return {
    enableHighDPI: capability.isHighDPI && capability.memoryStatus !== 'low',
    maxWidth: capability.maxCanvasSize,
    maxHeight: capability.maxCanvasSize,
    debounceMs: capability.deviceType === 'mobile' ? 50 : 16,
    enableWebGL: capability.supportsWebGL2 && capability.memoryStatus === 'high',
    enableOffscreenCanvas: capability.supportsOffscreenCanvas && capability.deviceType === 'desktop',
    respectReducedMotion: capability.preferReducedMotion,
    enableHaptics: capability.supportsHaptics && capability.deviceType === 'mobile'
  };
}