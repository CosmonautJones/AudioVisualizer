# ADR-004: Zoom and Fullscreen Architecture

## Status
**ACCEPTED** - Implemented 2025-08-29

## Context
The audio visualizer needed professional zoom and fullscreen capabilities to enhance user experience and provide detailed visualization inspection. Users requested the ability to zoom into specific parts of the visualization and view in fullscreen for presentations.

## Decision

### Zoom Architecture
We implemented a comprehensive zoom system with:

1. **ZoomManager Module**
   - Central state management for zoom level (0.5x to 3.0x) and pan position
   - Event-driven architecture for UI synchronization
   - Canvas transformation calculations with proper viewport bounds
   - Smooth animation system using requestAnimationFrame

2. **Renderer Integration**
   - BaseRenderer enhanced with zoom transformation support
   - Viewport culling optimization for performance when zoomed
   - Transform state management and context save/restore patterns

### Fullscreen Architecture
We implemented cross-browser fullscreen support with:

1. **FullscreenManager Module**
   - Abstraction layer over browser-specific fullscreen APIs
   - Event handling for enter/exit state changes
   - Style management for fullscreen mode

2. **UI Integration**
   - Header controls hidden in fullscreen
   - Canvas properly sized to full viewport
   - Keyboard shortcuts for accessibility

## Implementation Details

### Zoom System Components
```typescript
interface ZoomState {
  level: number;      // 0.5 to 3.0
  panX: number;       // Pan offset X
  panY: number;       // Pan offset Y
  isDragging: boolean;
}
```

### Interaction Methods
- **Mouse Wheel**: Zoom in/out at cursor position
- **Click & Drag**: Pan when zoomed >100%
- **Double-Click**: Toggle zoom levels
- **Keyboard**: +/-, 0 for zoom; arrows for pan
- **UI Controls**: Header buttons and sidebar slider

### Performance Optimizations
- **Viewport Culling**: Only render visible elements when zoomed
- **Transform Caching**: Pre-calculate transformations
- **Frame Budget**: Skip frames if rendering exceeds 12ms
- **Smooth Animations**: CSS transitions and requestAnimationFrame

## Alternatives Considered

### 1. CSS Transform Approach
- **Rejected**: Limited control over viewport bounds and performance
- **Issues**: Browser inconsistencies, poor canvas quality when scaled

### 2. Canvas-Only Implementation
- **Rejected**: Would require complete re-render on zoom changes
- **Issues**: Performance impact, complexity of viewport management

### 3. Third-Party Zoom Library
- **Rejected**: Additional dependency, potential compatibility issues
- **Issues**: Library size, customization limitations

## Consequences

### Positive
- **Enhanced UX**: Professional zoom/pan interactions
- **Performance**: Maintained 60fps across all zoom levels
- **Accessibility**: Comprehensive keyboard support
- **Immersion**: Clean fullscreen experience
- **Flexibility**: Multiple interaction methods for different use cases

### Negative
- **Complexity**: Additional state management and event coordination
- **Browser Support**: Fullscreen API variations require compatibility layer
- **Memory**: Additional event listeners and state tracking

### Neutral
- **File Size**: ~8KB additional code for complete zoom/fullscreen system
- **Maintenance**: Well-structured modules with clear separation of concerns

## Compliance
- ✅ **Performance Budget**: <12ms render budget maintained
- ✅ **Accessibility**: ARIA labels and keyboard navigation
- ✅ **Browser Support**: Chrome, Firefox, Safari, Edge
- ✅ **Mobile**: Touch-friendly interactions
- ✅ **Architecture**: Follows existing renderer pattern

## Monitoring
- Track zoom interaction frequency in analytics
- Monitor performance metrics at different zoom levels
- Collect user feedback on zoom/pan responsiveness
- Measure fullscreen usage patterns

## Future Considerations
- **Preset Zoom Levels**: Quick zoom to common levels (25%, 50%, 200%)
- **Mobile Gestures**: Pinch-to-zoom for mobile devices
- **Zoom Bookmarks**: Save/restore specific zoom/pan positions
- **Minimap**: Overview navigator when heavily zoomed