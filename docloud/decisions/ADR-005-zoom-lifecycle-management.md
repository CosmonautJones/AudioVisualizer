# ADR-005: Zoom Manager Lifecycle Management

**Status**: Accepted  
**Date**: 2025-08-29  
**Deciders**: Claude Code, Travis Jones

## Context
The original zoom implementation created zoom managers per renderer, causing zoom functionality to break when switching visualization modes. Users would lose zoom capability permanently after their first mode switch.

## Decision
Implement a **shared zoom manager architecture** where a single `ZoomManager` instance persists across all renderer lifecycle transitions.

## Rationale

### Problems with Per-Renderer Zoom Managers
1. **State Loss**: Zoom state was destroyed on renderer disposal
2. **Event Listener Cleanup**: Zoom event handlers were lost during mode switches  
3. **Memory Waste**: Multiple zoom manager instances created unnecessarily
4. **UX Degradation**: Users had to re-configure zoom after every mode switch

### Benefits of Shared Zoom Manager
1. **State Persistence**: Zoom level, pan position, and settings survive mode switches
2. **Event Continuity**: Single set of event listeners remain active throughout app lifecycle
3. **Performance**: One zoom manager instance handles all renderers efficiently
4. **User Experience**: Seamless zoom functionality across all visualization modes

## Implementation

### Architecture Components

#### 1. RendererFactory - Zoom Coordination Hub
```typescript
export class RendererFactory {
  private sharedZoomManager: ZoomManager | null = null;
  
  // Preserves zoom manager across renderer switches
  private disposeCurrentRenderer(): void {
    const zoomManager = this.currentRenderer.getZoomManager();
    if (zoomManager && !this.sharedZoomManager) {
      this.sharedZoomManager = zoomManager;
    }
    this.currentRenderer.dispose(true); // preserveZoomManager = true
  }
  
  // Applies preserved zoom manager to new renderers
  getRenderer(mode: VisualizationMode): BaseRenderer {
    // ... create new renderer
    if (this.sharedZoomManager) {
      this.currentRenderer.initializeZoom(this.sharedZoomManager);
    }
  }
}
```

#### 2. BaseRenderer - Zoom-Aware Disposal
```typescript
export abstract class BaseRenderer {
  dispose(preserveZoomManager: boolean = false): void {
    if (this.zoomManager && !preserveZoomManager) {
      this.zoomManager.dispose();
      this.zoomManager = null;
    } else if (preserveZoomManager) {
      // Clear reference without disposing - allows external management
      this.zoomManager = null;
    }
  }
}
```

#### 3. Controls - Zoom Manager Consumer
```typescript
export class VisualizerControls {
  private initializeZoomAndFullscreen(canvas: HTMLCanvasElement): void {
    if (this.rendererFactory) {
      // Use shared zoom manager from factory
      this.zoomManager = this.rendererFactory.getZoomManager();
      if (!this.zoomManager) {
        this.zoomManager = new ZoomManager(canvas);
        this.rendererFactory.initializeZoom(this.zoomManager);
      }
    }
  }
}
```

### Data Flow
1. **Initialization**: Controls create initial zoom manager via RendererFactory
2. **Mode Switch**: RendererFactory preserves zoom manager before disposing renderer  
3. **New Renderer**: RendererFactory applies preserved zoom manager to new renderer
4. **User Interaction**: Zoom events flow through shared manager to current renderer

## Consequences

### Positive
- **✅ Seamless UX**: Zoom works consistently across all modes
- **✅ State Preservation**: User zoom preferences persist during mode switches  
- **✅ Performance**: Single zoom manager reduces memory overhead
- **✅ Maintainability**: Centralized zoom lifecycle management
- **✅ Extensibility**: Easy to add zoom features that work across all modes

### Negative  
- **⚠️ Complexity**: Added indirection through RendererFactory
- **⚠️ Coupling**: Tighter coupling between RendererFactory and zoom functionality
- **⚠️ Memory**: Zoom manager persists even when not needed (minimal impact)

### Risks Mitigated
- **✅ Zoom Loss**: Users can no longer lose zoom functionality
- **✅ State Confusion**: No more zoom state inconsistencies between modes
- **✅ Performance Issues**: Eliminated zoom manager recreation overhead

## Alternatives Considered

### 1. Global Zoom Manager Singleton
**Rejected**: Would have required significant refactoring and reduced flexibility

### 2. Zoom State Serialization  
**Rejected**: Complex implementation with potential for state corruption

### 3. Per-Renderer Zoom Recreation
**Rejected**: Would still lose user zoom preferences and event listeners

## Implementation Notes
- All renderer implementations must support the `preserveZoomManager` parameter
- Controls integration requires renderer factory reference for shared zoom access
- Zoom manager disposal is now handled exclusively by RendererFactory
- Backwards compatibility maintained through fallback logic in controls

## Validation
- **Functional**: Zoom persists across: Bars ↔ Mandala ↔ future modes
- **Performance**: No measurable performance impact from shared architecture
- **Memory**: Single zoom manager reduces overall memory footprint
- **UX**: Users can zoom and switch modes without losing zoom state

This architecture ensures zoom functionality remains robust and user-friendly as the visualizer grows to support additional rendering modes and features.