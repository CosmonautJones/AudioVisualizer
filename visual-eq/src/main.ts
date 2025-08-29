// Bootstrap: Wire audio ↔ viz ↔ ui
import { AudioEngine } from './audio/audioEngine.ts';
import { RendererFactory } from './viz/rendererFactory.ts';
import { VisualizerControls } from './ui/controls.ts';
import { VisualizationMode, DEFAULT_BAR_CONFIG, DEFAULT_MANDALA_CONFIG, type VisualizationConfig } from './viz/visualizationMode.ts';

// Main application class
class AudioVisualizerApp {
  private audioEngine: AudioEngine;
  private rendererFactory: RendererFactory;
  private controls: VisualizerControls;
  private animationId: number = 0;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private lastBinCount: number = 0;
  
  // Current visualization configuration
  private currentConfig: VisualizationConfig = DEFAULT_BAR_CONFIG;

  constructor() {
    this.audioEngine = new AudioEngine();
    this.rendererFactory = new RendererFactory();
    this.controls = new VisualizerControls();
  }

  async initialize(): Promise<boolean> {
    try {
      // Initialize canvas
      const canvas = document.getElementById('visualizer') as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      if (!this.rendererFactory.initialize(canvas)) {
        throw new Error('Failed to initialize renderer factory');
      }

      // Set up visualization mode switching BEFORE initializing controls
      this.setupModeSwitch();
      
      // Initialize the default renderer
      const renderer = this.rendererFactory.getRenderer(this.currentConfig.mode);
      
      // Initialize controls with callback methods
      this.controls.initializeControls(
        this.audioEngine, 
        renderer,
        () => this.startVisualization(), // onStart callback
        () => this.stopVisualization()   // onStop callback
      );

      // Set up window resize handler
      window.addEventListener('resize', () => {
        this.rendererFactory.resize();
      });

      // Show ready message
      this.showStatus('Click "Start" to begin with microphone or select "Audio File" to upload');
      
      console.log('🎵 Audio Visualizer initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showStatus('Failed to initialize - Please refresh the page', true);
      return false;
    }
  }

  startVisualization(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    // Allocate or reallocate frequency data array based on current bin count
    const binCount = this.audioEngine.getFrequencyBinCount();
    if (!this.frequencyData || this.frequencyData.length !== binCount) {
      this.frequencyData = new Uint8Array(new ArrayBuffer(binCount));
      this.lastBinCount = binCount;
    }

    const animate = () => {
      // Only check for buffer reallocation occasionally (not every frame)
      const currentBinCount = this.audioEngine.getFrequencyBinCount();
      if (this.lastBinCount !== currentBinCount) {
        this.frequencyData = new Uint8Array(new ArrayBuffer(currentBinCount));
        this.lastBinCount = currentBinCount;
      }
      
      // Read frequency data from audio engine
      this.audioEngine.readFrequencyData(this.frequencyData!);
      
      // Render with current visualization mode
      this.rendererFactory.render(this.frequencyData!);
      
      // Continue animation loop
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
    console.log('🎨 Visualization started');
  }

  stopVisualization(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    console.log('⏹️ Visualization stopped');
  }

  /**
   * Switch visualization mode
   */
  switchVisualizationMode(mode: VisualizationMode, config?: Partial<VisualizationConfig>): void {
    // Update configuration
    if (mode === VisualizationMode.MANDALA) {
      this.currentConfig = { ...DEFAULT_MANDALA_CONFIG, ...config };
    } else {
      this.currentConfig = { ...DEFAULT_BAR_CONFIG, ...config };
    }

    // Get the appropriate renderer
    const renderer = this.rendererFactory.getRenderer(mode);
    
    // Update frequency bin count for the new renderer
    const binCount = this.audioEngine.getFrequencyBinCount();
    this.rendererFactory.updateFrequencyBinCount(binCount);
    
    // Update configuration
    this.rendererFactory.updateConfiguration(this.currentConfig);
    
    console.log(`🎨 Switched to ${mode} visualization mode`);
  }

  /**
   * Set up visualization mode switching
   */
  private setupModeSwitch(): void {
    // This will be connected to UI controls
    (window as any).switchVisualizationMode = (mode: string, config?: any) => {
      this.switchVisualizationMode(mode as VisualizationMode, config);
    };

    // Expose current config for UI
    (window as any).getCurrentVisualizationConfig = () => this.currentConfig;
    
    // Expose performance stats
    (window as any).getPerformanceStats = () => this.rendererFactory.getPerformanceStats();
  }

  private showStatus(message: string, isError: boolean = false): void {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = isError ? 'status error' : 'status';
      
      // Auto-hide after 5 seconds for non-error messages
      if (!isError) {
        setTimeout(() => {
          statusElement.textContent = '';
        }, 5000);
      }
    }
  }

  dispose(): void {
    this.stopVisualization();
    this.audioEngine.dispose();
    this.rendererFactory.dispose();
    this.frequencyData = null;
    this.lastBinCount = 0;
  }
}

// Initialize app when DOM is ready
let app: AudioVisualizerApp;

document.addEventListener('DOMContentLoaded', async () => {
  app = new AudioVisualizerApp();
  
  const initialized = await app.initialize();
  if (!initialized) {
    console.error('❌ Failed to initialize audio visualizer');
    return;
  }

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });

  // Handle visibility change (pause when tab not visible)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app) {
      app.stopVisualization();
    }
  });

  console.log('🚀 Audio Visualizer ready');
});

// Global cleanup
window.addEventListener('beforeunload', () => {
  if (app) {
    app.dispose();
  }
});

// Export for potential external access
export default AudioVisualizerApp;