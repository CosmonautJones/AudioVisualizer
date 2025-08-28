/**
 * UI Controls for Audio Visualizer
 * Vanilla TypeScript implementation - connects HTML inputs to audio engine and renderer
 */

import { AudioEngine } from '../audio/audioEngine.ts';
import type { AudioEngineError } from '../audio/types.ts';
import { BaseRenderer, type Theme } from '../viz/baseRenderer.ts';
import { VisualizationMode, type MandalaConfig, type BarConfig, ColorPalette, SymmetryMode, DEFAULT_BAR_CONFIG, DEFAULT_MANDALA_CONFIG } from '../viz/visualizationMode.ts';

interface ControlsState {
  inputMode: 'mic' | 'file';
  sensitivity: number;
  theme: Theme;
  isPlaying: boolean;
  isLoading: boolean;
  // Visualization mode and configs
  visualizationMode: VisualizationMode;
  barConfig: BarConfig;
  mandalaConfig: MandalaConfig;
}

export class VisualizerControls {
  private audioEngine: AudioEngine | null = null;
  private renderer: BaseRenderer | null = null;
  private onVisualizationStart: (() => void) | null = null;
  private onVisualizationStop: (() => void) | null = null;
  
  private state: ControlsState = {
    inputMode: 'mic',
    sensitivity: 1.0,
    theme: 'dark',
    isPlaying: false,
    isLoading: false,
    visualizationMode: VisualizationMode.BARS,
    barConfig: { ...DEFAULT_BAR_CONFIG },
    mandalaConfig: { ...DEFAULT_MANDALA_CONFIG }
  };

  // Control elements
  private inputSelector: HTMLElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private fileUploadArea: HTMLElement | null = null;
  private dragDropArea: HTMLElement | null = null;
  private browseButton: HTMLButtonElement | null = null;
  private fileInfo: HTMLElement | null = null;
  private fileName: HTMLElement | null = null;
  private changeFileButton: HTMLButtonElement | null = null;
  private sensitivitySlider: HTMLInputElement | null = null;
  private themeToggle: HTMLSelectElement | null = null;
  private playbackButton: HTMLButtonElement | null = null;
  private statusElement: HTMLElement | null = null;

  // Visualization mode controls
  private vizModeSelector: HTMLSelectElement | null = null;
  private barControls: HTMLElement | null = null;
  private mandalaControls: HTMLElement | null = null;

  // Bar-specific controls
  private barCountSlider: HTMLInputElement | null = null;
  private barColorModeSelector: HTMLSelectElement | null = null;
  private barVisualModeSelector: HTMLSelectElement | null = null;

  // Mandala-specific controls
  private mandalaSegments: HTMLInputElement | null = null;
  private mandalaRings: HTMLInputElement | null = null;
  private mandalaRotation: HTMLInputElement | null = null;
  private mandalaPalette: HTMLSelectElement | null = null;
  private mandalaSymmetry: HTMLSelectElement | null = null;

  /**
   * Initialize controls with audio engine, renderer, and visualization callbacks
   */
  initializeControls(
    audioEngine: AudioEngine, 
    renderer: BaseRenderer,
    onStart: () => void,
    onStop: () => void
  ): void {
    this.audioEngine = audioEngine;
    this.renderer = renderer;
    this.onVisualizationStart = onStart;
    this.onVisualizationStop = onStop;

    // Find control elements
    this.inputSelector = document.getElementById('input-selector');
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.fileUploadArea = document.getElementById('file-upload-area');
    this.dragDropArea = document.getElementById('drag-drop-area');
    this.browseButton = document.getElementById('browse-file') as HTMLButtonElement;
    this.fileInfo = document.getElementById('file-info');
    this.fileName = document.getElementById('file-name');
    this.changeFileButton = document.getElementById('change-file') as HTMLButtonElement;
    this.sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
    this.themeToggle = document.getElementById('theme-selector') as HTMLSelectElement;
    this.playbackButton = document.getElementById('playback-button') as HTMLButtonElement;
    this.statusElement = document.getElementById('status-message');

    // Find visualization mode controls
    this.vizModeSelector = document.getElementById('viz-mode') as HTMLSelectElement;
    this.barControls = document.getElementById('bar-controls');
    this.mandalaControls = document.getElementById('mandala-controls');
    
    // Bar controls
    this.barCountSlider = document.getElementById('bar-count-slider') as HTMLInputElement;
    this.barColorModeSelector = document.getElementById('bar-color-mode') as HTMLSelectElement;
    this.barVisualModeSelector = document.getElementById('bar-visual-mode') as HTMLSelectElement;
    
    // Mandala controls
    this.mandalaSegments = document.getElementById('mandala-segments') as HTMLInputElement;
    this.mandalaRings = document.getElementById('mandala-rings') as HTMLInputElement;
    this.mandalaRotation = document.getElementById('mandala-rotation') as HTMLInputElement;
    this.mandalaPalette = document.getElementById('mandala-palette') as HTMLSelectElement;
    this.mandalaSymmetry = document.getElementById('mandala-symmetry') as HTMLSelectElement;

    // Validate critical DOM elements exist
    if (!this.inputSelector || !this.fileInput || !this.sensitivitySlider || 
        !this.themeToggle || !this.playbackButton || !this.vizModeSelector) {
      throw new Error('Critical UI elements not found - HTML structure may be incomplete');
    }

    // Bind all control handlers
    this.bindInputSelector();
    this.bindSensitivitySlider();
    this.bindVisualizationModeSelector();
    this.bindBarCountSlider();
    this.bindBarColorMode();
    this.bindBarVisualMode();
    this.bindMandalaControls();
    this.bindThemeToggle();
    this.bindPlaybackControl();
    this.bindFileButtons();
    this.bindDragAndDrop();

    // Initialize UI state and enable playback button for default mic selection
    this.state.isPlaying = false; // Not playing yet, but ready to start
    this.updateUI(this.state);
  }

  /**
   * Bind input selector (mic vs file) functionality
   */
  bindInputSelector(): void {
    if (!this.inputSelector) return;

    const micRadio = this.inputSelector.querySelector('input[value="mic"]') as HTMLInputElement;
    const fileRadio = this.inputSelector.querySelector('input[value="file"]') as HTMLInputElement;

    micRadio?.addEventListener('change', async () => {
      if (micRadio.checked) {
        this.state.inputMode = 'mic';
        this.state.isLoading = true;
        this.hideFileElements(); // Hide file elements when switching to mic
        this.updateUI(this.state);

        try {
          const result = await this.audioEngine?.initAudioFromMic();
          this.handleAudioInitResult(result, 'microphone');
        } catch (error) {
          this.state.isLoading = false;
          this.updateUI(this.state);
          this.showStatus('Failed to access microphone. Please try again.', 'error');
          console.error('Microphone access error:', error);
        }
      }
    });

    fileRadio?.addEventListener('change', () => {
      if (fileRadio.checked) {
        this.state.inputMode = 'file';
        this.showFileUploadArea(); // Show file upload area
        this.updateUI(this.state);
      }
    });

    // File input handler
    this.fileInput?.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.processAudioFile(file);
        // Clear the input so the same file can be selected again
        (event.target as HTMLInputElement).value = '';
      }
    });
  }

  /**
   * Bind sensitivity slider functionality
   */
  bindSensitivitySlider(): void {
    if (!this.sensitivitySlider) return;

    this.sensitivitySlider.addEventListener('input', (event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      this.state.sensitivity = value;
      
      // Update both configurations
      this.state.barConfig.sensitivity = value;
      this.state.mandalaConfig.sensitivity = value;
      
      this.audioEngine?.setSensitivity(value);
      this.updateGlobalVisualizationConfig();
      this.updateUI(this.state);
    });
  }

  /**
   * Bind visualization mode selector functionality (enhanced UI with cards)
   */
  bindVisualizationModeSelector(): void {
    // Bind to the new mode cards
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
      card.addEventListener('click', (event) => {
        const mode = (event.currentTarget as HTMLElement).getAttribute('data-mode') as VisualizationMode;
        if (mode) {
          // Update card selection
          modeCards.forEach(c => c.classList.remove('active'));
          (event.currentTarget as HTMLElement).classList.add('active');
          
          // Update hidden select for compatibility
          if (this.vizModeSelector) {
            this.vizModeSelector.value = mode;
          }
          
          this.switchVisualizationMode(mode);
        }
      });
    });

    // Also bind to the hidden select as fallback
    if (this.vizModeSelector) {
      this.vizModeSelector.addEventListener('change', (event) => {
        const mode = (event.target as HTMLSelectElement).value as VisualizationMode;
        this.switchVisualizationMode(mode);
      });
    }
  }

  /**
   * Bind bar count slider functionality
   */
  bindBarCountSlider(): void {
    if (!this.barCountSlider) return;

    this.barCountSlider.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value, 10);
      this.state.barConfig.barCount = value;
      
      // Update global configuration if bars mode is active
      if (this.state.visualizationMode === VisualizationMode.BARS) {
        this.updateGlobalVisualizationConfig();
      }
      
      this.updateUI(this.state);
    });
  }

  /**
   * Bind bar color mode selector functionality
   */
  bindBarColorMode(): void {
    if (!this.barColorModeSelector) return;

    this.barColorModeSelector.addEventListener('change', (event) => {
      const colorMode = (event.target as HTMLSelectElement).value as 'theme' | 'frequency' | 'rainbow' | 'amplitude';
      this.state.barConfig.colorMode = colorMode;
      
      // Update global configuration if bars mode is active
      if (this.state.visualizationMode === VisualizationMode.BARS) {
        this.updateGlobalVisualizationConfig();
      }
      
      this.updateUI(this.state);
      
      console.log(`Bar color mode changed to: ${colorMode}`);
    });
  }

  /**
   * Bind bar visual mode selector functionality
   */
  bindBarVisualMode(): void {
    if (!this.barVisualModeSelector) return;

    this.barVisualModeSelector.addEventListener('change', (event) => {
      const visualMode = (event.target as HTMLSelectElement).value as 'standard' | 'wave' | 'mirror' | '3d' | 'peak-hold';
      this.state.barConfig.visualMode = visualMode;
      
      // Update global configuration if bars mode is active
      if (this.state.visualizationMode === VisualizationMode.BARS) {
        this.updateGlobalVisualizationConfig();
      }
      
      this.updateUI(this.state);
      
      console.log(`Bar visual mode changed to: ${visualMode}`);
    });
  }

  /**
   * Bind mandala-specific controls
   */
  bindMandalaControls(): void {
    // Segments control
    if (this.mandalaSegments) {
      this.mandalaSegments.addEventListener('input', (event) => {
        const value = parseInt((event.target as HTMLInputElement).value, 10);
        this.state.mandalaConfig.segments = value;
        if (this.state.visualizationMode === VisualizationMode.MANDALA) {
          this.updateGlobalVisualizationConfig();
        }
        this.updateUI(this.state);
      });
    }

    // Rings control
    if (this.mandalaRings) {
      this.mandalaRings.addEventListener('input', (event) => {
        const value = parseInt((event.target as HTMLInputElement).value, 10);
        this.state.mandalaConfig.rings = value;
        if (this.state.visualizationMode === VisualizationMode.MANDALA) {
          this.updateGlobalVisualizationConfig();
        }
        this.updateUI(this.state);
      });
    }

    // Rotation control
    if (this.mandalaRotation) {
      this.mandalaRotation.addEventListener('input', (event) => {
        const value = parseFloat((event.target as HTMLInputElement).value);
        this.state.mandalaConfig.rotationSpeed = value;
        if (this.state.visualizationMode === VisualizationMode.MANDALA) {
          this.updateGlobalVisualizationConfig();
        }
        this.updateUI(this.state);
      });
    }

    // Palette control
    if (this.mandalaPalette) {
      this.mandalaPalette.addEventListener('change', (event) => {
        const value = (event.target as HTMLSelectElement).value as ColorPalette;
        this.state.mandalaConfig.colorPalette = value;
        if (this.state.visualizationMode === VisualizationMode.MANDALA) {
          this.updateGlobalVisualizationConfig();
        }
        this.updateUI(this.state);
      });
    }

    // Symmetry control
    if (this.mandalaSymmetry) {
      this.mandalaSymmetry.addEventListener('change', (event) => {
        const value = (event.target as HTMLSelectElement).value as SymmetryMode;
        this.state.mandalaConfig.symmetryMode = value;
        if (this.state.visualizationMode === VisualizationMode.MANDALA) {
          this.updateGlobalVisualizationConfig();
        }
        this.updateUI(this.state);
      });
    }
  }

  /**
   * Bind theme selector functionality (enhanced UI)
   */
  bindThemeToggle(): void {
    const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
    if (!themeSelector) return;

    themeSelector.addEventListener('change', (event) => {
      const selectedTheme = (event.target as HTMLSelectElement).value as Theme;
      this.state.theme = selectedTheme;
      
      // Update both configurations
      this.state.barConfig.theme = this.state.theme;
      this.state.mandalaConfig.theme = this.state.theme;
      
      this.renderer?.setTheme(this.state.theme);
      document.body.className = this.state.theme;
      this.updateGlobalVisualizationConfig();
      this.updateUI(this.state);
      
      console.log(`Theme changed to: ${selectedTheme}`);
    });
  }

  /**
   * Bind playback control functionality
   */
  bindPlaybackControl(): void {
    if (!this.playbackButton) return;

    this.playbackButton.addEventListener('click', async () => {
      if (this.state.inputMode === 'mic') {
        if (!this.state.isPlaying) {
          // Start microphone input
          this.state.isLoading = true;
          this.updateUI(this.state);
          try {
            const result = await this.audioEngine?.initAudioFromMic();
            this.handleAudioInitResult(result, 'microphone');
          } catch (error) {
            this.state.isLoading = false;
            this.updateUI(this.state);
            this.showStatus('Failed to access microphone. Please try again.', 'error');
            console.error('Microphone access error:', error);
          }
        } else {
          // Microphone is already running
          this.showStatus('Microphone is already active', 'warning');
        }
        return;
      }

      // Handle file playback control
      if (this.state.isPlaying) {
        // Pause playback
        this.audioEngine?.pause();
        this.onVisualizationStop?.();
        this.state.isPlaying = false;
        this.showStatus('Playback paused', 'success');
      } else {
        // Resume playback
        try {
          await this.audioEngine?.resume();
          this.onVisualizationStart?.();
          this.state.isPlaying = true;
          this.showStatus('Playback resumed', 'success');
        } catch (error) {
          this.showStatus('Failed to resume playback. Please try again.', 'error');
          console.error('Audio resume error:', error);
        }
      }
      
      this.updateUI(this.state);
    });
  }

  /**
   * Bind file-related button functionality
   */
  bindFileButtons(): void {
    // Browse file button
    if (this.browseButton) {
      this.browseButton.addEventListener('click', () => {
        this.fileInput?.click(); // Trigger file picker
      });
    }

    // Change file button
    if (this.changeFileButton) {
      this.changeFileButton.addEventListener('click', () => {
        this.fileInput?.click(); // Trigger file picker
      });
    }
  }

  /**
   * Bind drag and drop functionality
   */
  bindDragAndDrop(): void {
    if (!this.dragDropArea) return;

    // Prevent default drag behaviors
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Highlight drop area when item is dragged over it
    const highlight = () => {
      this.dragDropArea?.classList.add('drag-over');
    };

    // Remove highlight when drag leaves
    const unhighlight = () => {
      this.dragDropArea?.classList.remove('drag-over');
    };

    // Handle dropped files
    const handleDrop = async (e: DragEvent) => {
      preventDefaults(e);
      unhighlight();

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        await this.processAudioFile(file);
      }
    };

    // Add event listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dragDropArea?.addEventListener(eventName, preventDefaults as EventListener);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.dragDropArea?.addEventListener(eventName, highlight as EventListener);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dragDropArea?.addEventListener(eventName, unhighlight as EventListener);
    });

    this.dragDropArea?.addEventListener('drop', handleDrop);
  }

  /**
   * Process audio file (shared between file input and drag-drop)
   */
  private async processAudioFile(file: File): Promise<void> {
    if (!this.audioEngine) return;

    // Validate file type and size
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'];
    const maxSizeMB = 50;
    
    if (!file.type.startsWith('audio/') && !validTypes.some(type => file.type === type)) {
      this.showStatus('Invalid file type. Please select MP3, WAV, OGG, AAC, or FLAC files.', 'error');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      this.showStatus(`File too large. Please select a file smaller than ${maxSizeMB}MB.`, 'error');
      return;
    }

    // Check file extension as backup validation
    const extension = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['mp3', 'wav', 'ogg', 'webm', 'aac', 'flac', 'm4a'];
    if (!extension || !validExtensions.includes(extension)) {
      this.showStatus('Invalid file extension. Supported: MP3, WAV, OGG, AAC, FLAC, M4A', 'error');
      return;
    }

    this.state.isLoading = true;
    this.updateUI(this.state);
    this.showStatus(`Loading ${file.name}...`, 'warning');

    try {
      const result = await this.audioEngine.initAudioFromFile(file);
      this.handleAudioInitResult(result, `file: ${file.name}`);
      
      // Show file info and hide upload area
      if (result?.success) {
        this.showFileInfo(file.name);
        this.hideFileUploadArea();
      }
    } catch (error) {
      this.state.isLoading = false;
      this.updateUI(this.state);
      this.showStatus('Failed to process audio file. Please try again.', 'error');
      console.error('Audio file processing error:', error);
    }
  }

  /**
   * Show file upload area
   */
  private showFileUploadArea(): void {
    if (this.fileUploadArea) {
      this.fileUploadArea.style.display = 'block';
    }
  }

  /**
   * Hide file upload area
   */
  private hideFileUploadArea(): void {
    if (this.fileUploadArea) {
      this.fileUploadArea.style.display = 'none';
    }
  }

  /**
   * Hide all file-related elements (upload area and file info)
   */
  private hideFileElements(): void {
    this.hideFileUploadArea();
    this.hideFileInfo();
  }

  /**
   * Show file information
   */
  private showFileInfo(filename: string): void {
    if (this.fileName && this.fileInfo) {
      this.fileName.textContent = filename;
      this.fileInfo.style.display = 'block';
    }
  }

  /**
   * Hide file information
   */
  private hideFileInfo(): void {
    if (this.fileInfo) {
      this.fileInfo.style.display = 'none';
    }
  }

  /**
   * Update UI elements based on current state
   */
  updateUI(state: ControlsState): void {
    // Update input selector
    if (this.inputSelector) {
      const micRadio = this.inputSelector.querySelector('input[value="mic"]') as HTMLInputElement;
      const fileRadio = this.inputSelector.querySelector('input[value="file"]') as HTMLInputElement;
      
      if (micRadio) micRadio.checked = state.inputMode === 'mic';
      if (fileRadio) fileRadio.checked = state.inputMode === 'file';
    }

    // Update slider values and labels
    if (this.sensitivitySlider) {
      this.sensitivitySlider.value = state.sensitivity.toString();
      const valueSpan = this.sensitivitySlider.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.sensitivity.toFixed(1);
    }

    // Update visualization mode selector
    if (this.vizModeSelector) {
      this.vizModeSelector.value = state.visualizationMode;
    }

    // Show/hide mode-specific controls
    this.updateModeVisibility(state.visualizationMode);

    // Update bar controls
    if (this.barCountSlider) {
      this.barCountSlider.value = state.barConfig.barCount.toString();
      const valueSpan = this.barCountSlider.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.barConfig.barCount.toString();
    }

    // Update bar color mode selector
    if (this.barColorModeSelector && state.barConfig.colorMode) {
      this.barColorModeSelector.value = state.barConfig.colorMode;
    }

    // Update bar visual mode selector
    if (this.barVisualModeSelector && state.barConfig.visualMode) {
      this.barVisualModeSelector.value = state.barConfig.visualMode;
    }

    // Update mandala controls
    if (this.mandalaSegments) {
      this.mandalaSegments.value = state.mandalaConfig.segments.toString();
      const valueSpan = this.mandalaSegments.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.mandalaConfig.segments.toString();
    }

    if (this.mandalaRings) {
      this.mandalaRings.value = state.mandalaConfig.rings.toString();
      const valueSpan = this.mandalaRings.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.mandalaConfig.rings.toString();
    }

    if (this.mandalaRotation) {
      this.mandalaRotation.value = state.mandalaConfig.rotationSpeed.toString();
      const valueSpan = this.mandalaRotation.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.mandalaConfig.rotationSpeed.toFixed(1) + '°/s';
    }

    if (this.mandalaPalette) {
      this.mandalaPalette.value = state.mandalaConfig.colorPalette;
    }

    if (this.mandalaSymmetry) {
      this.mandalaSymmetry.value = state.mandalaConfig.symmetryMode;
    }

    // Update theme selector (new enhanced UI)
    const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
    if (themeSelector) {
      themeSelector.value = state.theme;
      // Also update body class for theme
      document.body.className = state.theme;
    }

    // Update playback button
    if (this.playbackButton) {
      if (state.inputMode === 'mic') {
        this.playbackButton.textContent = state.isPlaying ? '🎤 Live' : '🎤 Start';
        this.playbackButton.disabled = state.isLoading;
      } else {
        this.playbackButton.textContent = state.isPlaying ? '⏸️ Pause' : '▶️ Play';
        this.playbackButton.disabled = state.isLoading; // Enable for file operations
      }
    }

    // Disable controls during loading
    const allInputs = [
      this.sensitivitySlider, this.barCountSlider, this.themeToggle,
      this.vizModeSelector, this.mandalaSegments, this.mandalaRings, 
      this.mandalaRotation, this.mandalaPalette, this.mandalaSymmetry
    ];
    allInputs.forEach(input => {
      if (input) input.disabled = state.isLoading;
    });
  }

  /**
   * Handle result from audio initialization
   */
  private handleAudioInitResult(
    result: { success: true } | { success: false; error: AudioEngineError } | undefined,
    source: string
  ): void {
    this.state.isLoading = false;

    if (!result) {
      this.showStatus('Audio engine not available', 'error');
      this.updateUI(this.state);
      return;
    }

    if (result.success) {
      this.state.isPlaying = true;
      this.showStatus(`Successfully connected to ${source}`, 'success');
      
      // Update renderer with frequency bin count
      const binCount = this.audioEngine?.getFrequencyBinCount() || 0;
      this.renderer?.updateFrequencyBinCount(binCount);
      
      // Start visualization
      this.onVisualizationStart?.();
    } else {
      this.state.isPlaying = false;
      this.showStatus(this.getErrorMessage(result.error), 'error');
    }

    this.updateUI(this.state);
  }

  /**
   * Display status message to user
   */
  private showStatus(message: string, type: 'success' | 'warning' | 'error'): void {
    if (!this.statusElement) return;

    this.statusElement.textContent = message;
    this.statusElement.className = `status status-${type}`;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.textContent = '';
          this.statusElement.className = 'status';
        }
      }, 3000);
    }
  }

  /**
   * Convert audio engine errors to user-friendly messages
   */
  private getErrorMessage(error: AudioEngineError): string {
    switch (error) {
      case 'mic-denied':
        return 'Microphone access denied. Please allow microphone access and try again.';
      case 'mic-not-found':
        return 'No microphone found. Please check your audio devices.';
      case 'audio-context-failed':
        return 'Failed to initialize audio. This may be due to browser security restrictions. Please try again with a fresh click/tap.';
      case 'file-decode-failed':
        return 'Failed to decode audio file. Please try a different file format (MP3, WAV, OGG supported).';
      case 'browser-unsupported':
      case 'not-supported':
        return 'Audio features not supported in this browser. Please try Chrome, Firefox, or Safari.';
      default:
        return 'An unknown error occurred while initializing audio.';
    }
  }

  /**
   * Switch visualization mode
   */
  private switchVisualizationMode(mode: VisualizationMode): void {
    this.state.visualizationMode = mode;
    
    // Update global visualization configuration
    this.updateGlobalVisualizationConfig();
    
    // Update UI to show/hide appropriate controls
    this.updateUI(this.state);
    
    // Show status message
    const modeName = mode === VisualizationMode.BARS ? 'Frequency Bars' : 'Mandala';
    this.showStatus(`Switched to ${modeName} visualization`, 'success');
  }

  /**
   * Update global visualization configuration
   */
  private updateGlobalVisualizationConfig(): void {
    // Get the global function
    const switchVisualizationMode = (window as any).switchVisualizationMode;
    if (!switchVisualizationMode) {
      console.error('VisualizerControls: Global switchVisualizationMode function not available - this will prevent mode switching from working correctly');
      this.showStatus('Configuration update failed - visualization mode switching may not work', 'error');
      return;
    }

    // Prepare configuration based on current mode
    let config: any;
    if (this.state.visualizationMode === VisualizationMode.MANDALA) {
      config = {
        ...this.state.mandalaConfig,
        theme: this.state.theme,
        sensitivity: this.state.sensitivity
      };
    } else {
      config = {
        ...this.state.barConfig,
        theme: this.state.theme,
        sensitivity: this.state.sensitivity
      };
    }

    console.log(`VisualizerControls: Updating global config for ${this.state.visualizationMode} mode:`, config);

    try {
      // Call global function to update visualization
      switchVisualizationMode(this.state.visualizationMode, config);
    } catch (error) {
      console.error('VisualizerControls: Error calling global switchVisualizationMode:', error);
      this.showStatus('Failed to update visualization settings', 'error');
    }
  }

  /**
   * Update visibility of mode-specific control panels
   */
  private updateModeVisibility(mode: VisualizationMode): void {
    if (this.barControls) {
      this.barControls.style.display = mode === VisualizationMode.BARS ? 'block' : 'none';
    }
    
    if (this.mandalaControls) {
      this.mandalaControls.style.display = mode === VisualizationMode.MANDALA ? 'block' : 'none';
    }
  }

  /**
   * Sync state from global configuration (called externally if needed)
   */
  syncFromGlobalConfig(): void {
    const getCurrentConfig = (window as any).getCurrentVisualizationConfig;
    if (!getCurrentConfig) return;

    try {
      const globalConfig = getCurrentConfig();
      if (globalConfig) {
        // Update local state to match global config
        this.state.visualizationMode = globalConfig.mode;
        this.state.sensitivity = globalConfig.sensitivity;
        this.state.theme = globalConfig.theme;
        
        if (globalConfig.mode === VisualizationMode.MANDALA) {
          this.state.mandalaConfig = { ...this.state.mandalaConfig, ...globalConfig };
        } else {
          this.state.barConfig = { ...this.state.barConfig, ...globalConfig };
        }
        
        this.updateUI(this.state);
      }
    } catch (error) {
      console.warn('Failed to sync from global config:', error);
    }
  }

  /**
   * Get current control state
   */
  getState(): ControlsState {
    return { ...this.state };
  }
}