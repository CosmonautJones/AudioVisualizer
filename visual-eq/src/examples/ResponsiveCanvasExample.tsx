import React, { useEffect } from 'react';
import { useResponsiveCanvas, useSimpleResponsiveCanvas, useMobileResponsiveCanvas } from '../hooks/useResponsiveCanvas';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer';
import type { CanvasDimensions, DeviceCapability } from '../types/canvas';

/**
 * Example component demonstrating useResponsiveCanvas integration
 * Shows how to combine responsive canvas with audio visualization
 */
export const ResponsiveCanvasExample: React.FC = () => {
  // Basic responsive canvas with aspect ratio
  const {
    canvasRef,
    dimensions,
    deviceCapability,
    isResizing,
    currentBreakpoint,
    orientation,
    isHighDPI,
    aspectRatio,
    setAspectRatio,
    supportsFeature
  } = useResponsiveCanvas({
    config: {
      maintainAspectRatio: true,
      aspectRatio: 16 / 9,
      minWidth: 320,
      minHeight: 200,
      enableHighDPI: true,
      deviceOptimization: true
    },
    onResize: (dimensions: CanvasDimensions, capability: DeviceCapability) => {
      console.log('Canvas resized:', dimensions);
      console.log('Device capability:', capability);
    },
    onBreakpointChange: (breakpoint) => {
      console.log('Breakpoint changed to:', breakpoint);
    },
    onOrientationChange: (orientation) => {
      console.log('Orientation changed to:', orientation);
    }
  });

  // Canvas renderer for audio visualization
  const canvasRenderer = useCanvasRenderer('frequency', {
    barCount: currentBreakpoint === 'mobile' ? 32 : 64,
    barWidth: 8,
    barSpacing: 2,
    minBarHeight: 2,
    maxBarHeight: dimensions ? dimensions.height * 0.8 : 200,
    sensitivity: 1.0,
    smoothing: 0.8,
    colorScheme: {
      type: 'spectrum',
      colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
      opacity: 0.8,
      backgroundAlpha: 0.1
    },
    drawPeaks: currentBreakpoint !== 'mobile', // Disable peaks on mobile
    mirrorVertical: false,
    logarithmicScale: true
  });

  // Update canvas renderer when dimensions change
  useEffect(() => {
    if (dimensions && canvasRenderer.hasContext) {
      // Canvas is automatically resized by useResponsiveCanvas
      // We can trigger additional renderer updates here if needed
      canvasRenderer.updateConfig({
        maxBarHeight: dimensions.height * 0.8,
        barCount: currentBreakpoint === 'mobile' ? 32 : 64
      });
    }
  }, [dimensions, currentBreakpoint, canvasRenderer]);

  return (
    <div className="responsive-canvas-example">
      <h2>Responsive Audio Visualizer</h2>
      
      {/* Device and State Information */}
      <div className="info-panel" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
        <div>
          <strong>Device:</strong> {deviceCapability?.deviceType || 'Loading...'}
        </div>
        <div>
          <strong>Breakpoint:</strong> {currentBreakpoint}
        </div>
        <div>
          <strong>Orientation:</strong> {orientation}
        </div>
        <div>
          <strong>High-DPI:</strong> {isHighDPI ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Dimensions:</strong> {dimensions ? `${dimensions.width}×${dimensions.height} (DPR: ${dimensions.devicePixelRatio})` : 'Not set'}
        </div>
        <div>
          <strong>Resizing:</strong> {isResizing ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Features:</strong> 
          {' '}WebGL2: {supportsFeature('webgl2') ? '✓' : '✗'}
          {' '}Touch: {supportsFeature('touch') ? '✓' : '✗'}
          {' '}Haptics: {supportsFeature('haptics') ? '✓' : '✗'}
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        className="canvas-container" 
        style={{ 
          width: '100%', 
          height: '400px',
          border: '1px solid #333',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#000'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%'
          }}
        />
      </div>

      {/* Controls */}
      <div className="controls" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setAspectRatio(16/9)}>
          16:9 Aspect Ratio
        </button>
        <button onClick={() => setAspectRatio(4/3)}>
          4:3 Aspect Ratio
        </button>
        <button onClick={() => setAspectRatio()}>
          No Aspect Ratio
        </button>
      </div>

      {/* Device Capability Details */}
      {deviceCapability && (
        <details style={{ marginTop: '1rem' }}>
          <summary>Device Capability Details</summary>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto', fontSize: '0.75rem' }}>
            {JSON.stringify(deviceCapability, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

/**
 * Simple example using the simplified hook
 */
export const SimpleResponsiveCanvasExample: React.FC = () => {
  const { canvasRef, dimensions, currentBreakpoint } = useSimpleResponsiveCanvas(16/9);

  return (
    <div className="simple-example">
      <h3>Simple Responsive Canvas (16:9)</h3>
      <p>Breakpoint: {currentBreakpoint}</p>
      <p>Dimensions: {dimensions ? `${dimensions.width}×${dimensions.height}` : 'Loading...'}</p>
      
      <div style={{ width: '100%', maxWidth: '800px', border: '1px solid #ccc' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
};

/**
 * Mobile-optimized example
 */
export const MobileResponsiveCanvasExample: React.FC = () => {
  const { 
    canvasRef, 
    dimensions, 
    deviceCapability, 
    currentBreakpoint 
  } = useMobileResponsiveCanvas(1); // Square aspect ratio for mobile

  return (
    <div className="mobile-example">
      <h3>Mobile-Optimized Responsive Canvas</h3>
      <p>Device Type: {deviceCapability?.deviceType || 'Loading...'}</p>
      <p>Memory Status: {deviceCapability?.memoryStatus || 'Unknown'}</p>
      <p>Breakpoint: {currentBreakpoint}</p>
      
      <div style={{ 
        width: '100%', 
        maxWidth: currentBreakpoint === 'mobile' ? '300px' : '500px',
        border: '1px solid #ccc',
        margin: '0 auto'
      }}>
        <canvas
          ref={canvasRef}
          style={{ 
            display: 'block', 
            width: '100%', 
            height: 'auto',
            touchAction: 'none' // Prevent touch gestures
          }}
        />
      </div>
    </div>
  );
};

export default ResponsiveCanvasExample;