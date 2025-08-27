// Bootstrap: Wire audio ↔ viz ↔ ui
import { AudioEngine } from './audio/audioEngine.ts';
import { VisualizerRenderer } from './viz/renderer.ts';
import { VisualizerControls } from './ui/controls.ts';

// Main application class
class AudioVisualizerApp {
  private audioEngine: AudioEngine;
  private renderer: VisualizerRenderer;
  private controls: VisualizerControls;
  private animationId: number = 0;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private lastBinCount: number = 0;

  constructor() {
    this.audioEngine = new AudioEngine();
    this.renderer = new VisualizerRenderer();
    this.controls = new VisualizerControls();
  }

  async initialize(): Promise<boolean> {
    try {
      // Initialize canvas
      const canvas = document.getElementById('visualizer') as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      if (!this.renderer.initialize(canvas)) {
        throw new Error('Failed to initialize renderer');
      }

      // Initialize controls with callback methods
      this.controls.initializeControls(
        this.audioEngine, 
        this.renderer,
        () => this.startVisualization(), // onStart callback
        () => this.stopVisualization()   // onStop callback
      );

      // Set up window resize handler
      window.addEventListener('resize', () => {
        this.renderer.resize();
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
      
      // Draw bars on canvas
      this.renderer.drawBars(this.frequencyData!);
      
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