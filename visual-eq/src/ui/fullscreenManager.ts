/**
 * FullscreenManager - Cross-browser Fullscreen API Management
 * Handles fullscreen requests, events, and browser compatibility
 */

export interface FullscreenState {
  isFullscreen: boolean;
  isSupported: boolean;
  element: Element | null;
}

export interface FullscreenConfig {
  navigationUI?: 'auto' | 'show' | 'hide';
  enableKeyboard?: boolean;
}

export class FullscreenManager {
  private state: FullscreenState = {
    isFullscreen: false,
    isSupported: false,
    element: null
  };

  private config: FullscreenConfig = {
    navigationUI: 'hide',
    enableKeyboard: true
  };

  private targetElement: HTMLElement | null = null;
  
  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map([
    ['enter', new Set()],
    ['exit', new Set()],
    ['change', new Set()],
    ['error', new Set()]
  ]);

  // Browser-specific method names
  private methods = {
    request: '',
    exit: '',
    element: '',
    enabled: ''
  };

  constructor(element?: HTMLElement, config?: FullscreenConfig) {
    this.detectSupport();
    if (element) {
      this.setTargetElement(element);
    }
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.setupEventListeners();
  }

  /**
   * Check if fullscreen is supported by the browser
   */
  private detectSupport(): void {
    const doc = document as any;
    const docEl = document.documentElement as any;

    // Detect browser-specific fullscreen methods
    if (docEl.requestFullscreen) {
      this.methods = {
        request: 'requestFullscreen',
        exit: 'exitFullscreen',
        element: 'fullscreenElement',
        enabled: 'fullscreenEnabled'
      };
    } else if (docEl.webkitRequestFullscreen) {
      this.methods = {
        request: 'webkitRequestFullscreen',
        exit: 'webkitExitFullscreen',
        element: 'webkitFullscreenElement',
        enabled: 'webkitFullscreenEnabled'
      };
    } else if (docEl.mozRequestFullScreen) {
      this.methods = {
        request: 'mozRequestFullScreen',
        exit: 'mozCancelFullScreen',
        element: 'mozFullScreenElement',
        enabled: 'mozFullScreenEnabled'
      };
    } else if (docEl.msRequestFullscreen) {
      this.methods = {
        request: 'msRequestFullscreen',
        exit: 'msExitFullscreen',
        element: 'msFullscreenElement',
        enabled: 'msFullscreenEnabled'
      };
    }

    this.state.isSupported = !!this.methods.request && !!(doc as any)[this.methods.enabled];
  }

  /**
   * Set the target element for fullscreen
   */
  setTargetElement(element: HTMLElement): void {
    this.targetElement = element;
  }

  /**
   * Get current fullscreen state
   */
  getState(): Readonly<FullscreenState> {
    // Update current fullscreen element
    const doc = document as any;
    this.state.element = doc[this.methods.element] || null;
    this.state.isFullscreen = !!this.state.element;
    
    return { ...this.state };
  }

  /**
   * Check if fullscreen is supported
   */
  isSupported(): boolean {
    return this.state.isSupported;
  }

  /**
   * Check if currently in fullscreen mode
   */
  isFullscreen(): boolean {
    const doc = document as any;
    return !!(doc[this.methods.element]);
  }

  /**
   * Request fullscreen for the target element
   */
  async requestFullscreen(element?: HTMLElement): Promise<void> {
    if (!this.state.isSupported) {
      throw new Error('Fullscreen is not supported by this browser');
    }

    const targetEl = element || this.targetElement;
    if (!targetEl) {
      throw new Error('No target element specified for fullscreen');
    }

    try {
      const el = targetEl as any;
      
      // Prepare options based on browser support
      let options: any = {};
      if (this.methods.request === 'requestFullscreen') {
        options.navigationUI = this.config.navigationUI;
      }

      // Request fullscreen
      if (el[this.methods.request]) {
        await el[this.methods.request](Object.keys(options).length > 0 ? options : undefined);
      } else {
        throw new Error('Fullscreen request method not available');
      }

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Exit fullscreen mode
   */
  async exitFullscreen(): Promise<void> {
    if (!this.state.isSupported || !this.isFullscreen()) {
      return;
    }

    try {
      const doc = document as any;
      if (doc[this.methods.exit]) {
        await doc[this.methods.exit]();
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Toggle fullscreen mode
   */
  async toggleFullscreen(element?: HTMLElement): Promise<void> {
    if (this.isFullscreen()) {
      await this.exitFullscreen();
    } else {
      await this.requestFullscreen(element);
    }
  }

  /**
   * Setup event listeners for fullscreen changes
   */
  private setupEventListeners(): void {
    if (!this.state.isSupported) return;

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange', 
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    const errorEvents = [
      'fullscreenerror',
      'webkitfullscreenerror',
      'mozfullscreenerror', 
      'MSFullscreenError'
    ];

    // Add change event listeners
    events.forEach(eventName => {
      document.addEventListener(eventName, this.handleFullscreenChange.bind(this), false);
    });

    // Add error event listeners  
    errorEvents.forEach(eventName => {
      document.addEventListener(eventName, this.handleFullscreenError.bind(this), false);
    });

    // Keyboard shortcuts
    if (this.config.enableKeyboard) {
      document.addEventListener('keydown', this.handleKeydown.bind(this), false);
    }
  }

  /**
   * Handle fullscreen change events
   */
  private handleFullscreenChange(): void {
    const wasFullscreen = this.state.isFullscreen;
    this.getState(); // Updates state
    
    if (!wasFullscreen && this.state.isFullscreen) {
      this.emit('enter', this.state);
    } else if (wasFullscreen && !this.state.isFullscreen) {
      this.emit('exit', this.state);
    }
    
    this.emit('change', this.state);
  }

  /**
   * Handle fullscreen error events
   */
  private handleFullscreenError(event: Event): void {
    const error = new Error(`Fullscreen error: ${event.type}`);
    this.emit('error', error);
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeydown(event: KeyboardEvent): void {
    // F11 key - browser's built-in fullscreen, but we can still track it
    if (event.key === 'F11') {
      // Let browser handle F11, we'll just track the state change
      return;
    }
    
    // Escape key - exit fullscreen
    if (event.key === 'Escape' && this.isFullscreen()) {
      event.preventDefault();
      this.exitFullscreen().catch(error => {
        console.warn('Failed to exit fullscreen:', error);
      });
    }
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
   * Get browser-specific CSS for fullscreen styles
   */
  getFullscreenCSS(): string {
    return `
      /* Standard fullscreen */
      :fullscreen {
        width: 100vw !important;
        height: 100vh !important;
      }
      
      /* Webkit */  
      :-webkit-full-screen {
        width: 100vw !important;
        height: 100vh !important;
      }
      
      /* Mozilla */
      :-moz-full-screen {
        width: 100vw !important;
        height: 100vh !important;
      }
      
      /* Microsoft */
      :-ms-fullscreen {
        width: 100vw !important;  
        height: 100vh !important;
      }
    `;
  }

  /**
   * Apply fullscreen-specific styles to an element
   */
  applyFullscreenStyles(element: HTMLElement): void {
    // Create style element if it doesn't exist
    let styleEl = document.getElementById('fullscreen-styles') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'fullscreen-styles';
      document.head.appendChild(styleEl);
    }
    
    // Add CSS rules
    styleEl.textContent = this.getFullscreenCSS();
    
    // Add data attribute for targeting
    element.setAttribute('data-fullscreen-target', 'true');
  }

  /**
   * Remove fullscreen styles
   */
  removeFullscreenStyles(): void {
    const styleEl = document.getElementById('fullscreen-styles');
    if (styleEl) {
      styleEl.remove();
    }
    
    // Remove data attributes
    document.querySelectorAll('[data-fullscreen-target]').forEach(el => {
      el.removeAttribute('data-fullscreen-target');
    });
  }

  /**
   * Cleanup resources and event listeners
   */
  dispose(): void {
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange', 
      'MSFullscreenChange',
      'fullscreenerror',
      'webkitfullscreenerror',
      'mozfullscreenerror',
      'MSFullscreenError'
    ];

    events.forEach(eventName => {
      document.removeEventListener(eventName, this.handleFullscreenChange.bind(this));
      document.removeEventListener(eventName, this.handleFullscreenError.bind(this));
    });

    if (this.config.enableKeyboard) {
      document.removeEventListener('keydown', this.handleKeydown.bind(this));
    }

    this.removeFullscreenStyles();
    this.listeners.clear();
    this.targetElement = null;
  }
}