/**
 * ZoomManager - Canvas Zoom and Pan State Management
 * Handles zoom level, pan position, viewport calculations, and smooth transformations
 */

export interface ZoomState {
  level: number;      // 0.5 to 3.0 (50% to 300%)
  panX: number;       // Pan offset in canvas coordinates
  panY: number;       // Pan offset in canvas coordinates
  isDragging: boolean; // Currently dragging for pan
}

export interface ZoomConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  smoothTransition: boolean;
  transitionDuration: number; // ms
}

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export class ZoomManager {
  private state: ZoomState = {
    level: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false
  };

  private config: ZoomConfig = {
    minZoom: 0.5,
    maxZoom: 3.0,
    zoomStep: 0.1,
    smoothTransition: true,
    transitionDuration: 200
  };

  private canvas: HTMLCanvasElement | null = null;
  private animationId: number = 0;
  private transitionStartTime = 0;
  private transitionStartState: Partial<ZoomState> = {};
  private transitionTargetState: Partial<ZoomState> = {};

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map([
    ['zoom', new Set()],
    ['pan', new Set()],
    ['dragstart', new Set()],
    ['dragend', new Set()]
  ]);

  constructor(canvas?: HTMLCanvasElement, config?: Partial<ZoomConfig>) {
    if (canvas) {
      this.initialize(canvas);
    }
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize zoom manager with canvas element
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /**
   * Get current zoom state
   */
  getState(): Readonly<ZoomState> {
    return { ...this.state };
  }

  /**
   * Get zoom configuration
   */
  getConfig(): Readonly<ZoomConfig> {
    return { ...this.config };
  }

  /**
   * Set zoom level with optional smooth transition
   */
  setZoom(level: number, centerX?: number, centerY?: number, smooth = this.config.smoothTransition): void {
    const clampedLevel = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, level));
    
    if (clampedLevel === this.state.level) return;

    // Calculate new pan position to maintain zoom center
    if (centerX !== undefined && centerY !== undefined && this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = centerX - rect.left;
      const canvasY = centerY - rect.top;
      
      // Calculate new pan to keep the zoom point centered
      const zoomRatio = clampedLevel / this.state.level;
      const newPanX = canvasX - (canvasX - this.state.panX) * zoomRatio;
      const newPanY = canvasY - (canvasY - this.state.panY) * zoomRatio;
      
      this.state.panX = newPanX;
      this.state.panY = newPanY;
    }

    if (smooth) {
      this.animateToZoom(clampedLevel);
    } else {
      this.state.level = clampedLevel;
      this.emit('zoom', this.state);
    }
  }

  /**
   * Zoom in by one step
   */
  zoomIn(centerX?: number, centerY?: number): void {
    this.setZoom(this.state.level + this.config.zoomStep, centerX, centerY);
  }

  /**
   * Zoom out by one step
   */
  zoomOut(centerX?: number, centerY?: number): void {
    this.setZoom(this.state.level - this.config.zoomStep, centerX, centerY);
  }

  /**
   * Reset zoom to 1.0 and center pan
   */
  resetZoom(smooth = this.config.smoothTransition): void {
    if (smooth) {
      this.animateToState({ level: 1.0, panX: 0, panY: 0 });
    } else {
      this.state.level = 1.0;
      this.state.panX = 0;
      this.state.panY = 0;
      this.emit('zoom', this.state);
      this.emit('pan', this.state);
    }
  }

  /**
   * Set pan position
   */
  setPan(panX: number, panY: number, smooth = false): void {
    if (smooth) {
      this.animateToState({ panX, panY });
    } else {
      this.state.panX = panX;
      this.state.panY = panY;
      this.emit('pan', this.state);
    }
  }

  /**
   * Adjust pan by delta values (used for dragging)
   */
  adjustPan(deltaX: number, deltaY: number): void {
    this.state.panX += deltaX;
    this.state.panY += deltaY;
    this.emit('pan', this.state);
  }

  /**
   * Start drag operation
   */
  startDrag(): void {
    this.state.isDragging = true;
    this.emit('dragstart', this.state);
  }

  /**
   * End drag operation
   */
  endDrag(): void {
    this.state.isDragging = false;
    this.emit('dragend', this.state);
  }

  /**
   * Get viewport bounds in canvas coordinates
   */
  getViewportBounds(): ViewportBounds {
    if (!this.canvas) {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const viewWidth = rect.width / this.state.level;
    const viewHeight = rect.height / this.state.level;
    
    const left = centerX - this.state.panX - viewWidth / 2;
    const top = centerY - this.state.panY - viewHeight / 2;
    
    return {
      left,
      top,
      right: left + viewWidth,
      bottom: top + viewHeight,
      width: viewWidth,
      height: viewHeight
    };
  }

  /**
   * Apply zoom transformation to canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Apply transformations in the correct order
    ctx.translate(centerX + this.state.panX, centerY + this.state.panY);
    ctx.scale(this.state.level, this.state.level);
    ctx.translate(-centerX, -centerY);
  }

  /**
   * Convert screen coordinates to canvas coordinates accounting for zoom/pan
   */
  screenToCanvas(screenX: number, screenY: number): { x: number, y: number } {
    if (!this.canvas) return { x: screenX, y: screenY };

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Reverse the transformations
    const x = (canvasX - centerX - this.state.panX) / this.state.level + centerX;
    const y = (canvasY - centerY - this.state.panY) / this.state.level + centerY;
    
    return { x, y };
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  /**
   * Setup canvas event listeners for mouse and touch interactions
   */
  private setupEventListeners(): void {
    if (!this.canvas) return;

    let lastMouseX = 0;
    let lastMouseY = 0;
    let isDragging = false;

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -this.config.zoomStep : this.config.zoomStep;
      this.setZoom(this.state.level + delta, e.clientX, e.clientY);
    });

    // Mouse drag pan
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state.level > 1.0) {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        this.startDrag();
        this.canvas!.style.cursor = 'grabbing';
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging && this.state.level > 1.0) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        this.adjustPan(deltaX, deltaY);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.endDrag();
        this.canvas!.style.cursor = this.state.level > 1.0 ? 'grab' : 'default';
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        this.endDrag();
        this.canvas!.style.cursor = 'default';
      }
    });

    // Update cursor based on zoom level
    this.on('zoom', (state: ZoomState) => {
      if (this.canvas) {
        this.canvas.style.cursor = state.level > 1.0 ? 'grab' : 'default';
      }
    });

    // Double-click to reset zoom
    this.canvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.state.level !== 1.0) {
        this.resetZoom();
      } else {
        this.setZoom(2.0, e.clientX, e.clientY);
      }
    });
  }

  /**
   * Animate to target zoom level
   */
  private animateToZoom(targetLevel: number): void {
    this.animateToState({ level: targetLevel });
  }

  /**
   * Animate to target state
   */
  private animateToState(targetState: Partial<ZoomState>): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.transitionStartTime = performance.now();
    this.transitionStartState = { ...this.state };
    this.transitionTargetState = targetState;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - this.transitionStartTime;
      const progress = Math.min(elapsed / this.config.transitionDuration, 1);
      
      // Smooth easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Interpolate state values
      Object.keys(this.transitionTargetState).forEach(key => {
        const startValue = this.transitionStartState[key as keyof ZoomState] as number;
        const targetValue = this.transitionTargetState[key as keyof ZoomState] as number;
        const currentValue = startValue + (targetValue - startValue) * easeProgress;
        
        (this.state as any)[key] = currentValue;
      });

      // Emit appropriate events
      if ('level' in this.transitionTargetState) {
        this.emit('zoom', this.state);
      }
      if ('panX' in this.transitionTargetState || 'panY' in this.transitionTargetState) {
        this.emit('pan', this.state);
      }

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = 0;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.listeners.clear();
    this.canvas = null;
  }
}