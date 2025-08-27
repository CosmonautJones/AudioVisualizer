/**
 * UI Controls for Audio Visualizer
 * Vanilla TypeScript implementation - connects HTML inputs to audio engine and renderer
 */

import { AudioEngine } from '../audio/audioEngine.ts';
import type { AudioEngineError } from '../audio/types.ts';
import { VisualizerRenderer, type Theme } from '../viz/renderer.ts';

interface ControlsState {
  inputMode: 'mic' | 'file';
  sensitivity: number;
  barCount: number;
  theme: Theme;
  isPlaying: boolean;
  isLoading: boolean;
}

export class VisualizerControls {
  private audioEngine: AudioEngine | null = null;
  private renderer: VisualizerRenderer | null = null;
  private onVisualizationStart: (() => void) | null = null;
  private onVisualizationStop: (() => void) | null = null;
  
  private state: ControlsState = {
    inputMode: 'mic',
    sensitivity: 1.0,
    barCount: 64,
    theme: 'dark',
    isPlaying: false,
    isLoading: false
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
  private barCountSlider: HTMLInputElement | null = null;
  private themeToggle: HTMLInputElement | null = null;
  private playbackButton: HTMLButtonElement | null = null;
  private statusElement: HTMLElement | null = null;

  /**
   * Initialize controls with audio engine, renderer, and visualization callbacks
   */
  initializeControls(
    audioEngine: AudioEngine, 
    renderer: VisualizerRenderer,
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
    this.barCountSlider = document.getElementById('bar-count-slider') as HTMLInputElement;
    this.themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;
    this.playbackButton = document.getElementById('playback-button') as HTMLButtonElement;
    this.statusElement = document.getElementById('status-message');

    // Validate critical DOM elements exist
    if (!this.inputSelector || !this.fileInput || !this.sensitivitySlider || 
        !this.barCountSlider || !this.themeToggle || !this.playbackButton) {
      throw new Error('Critical UI elements not found - HTML structure may be incomplete');
    }

    // Bind all control handlers
    this.bindInputSelector();
    this.bindSensitivitySlider();
    this.bindBarCountSlider();
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
      this.audioEngine?.setSensitivity(value);
      this.updateUI(this.state);
    });
  }

  /**
   * Bind bar count slider functionality
   */
  bindBarCountSlider(): void {
    if (!this.barCountSlider) return;

    this.barCountSlider.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value, 10);
      this.state.barCount = value;
      this.renderer?.setBarCount(value);
      this.updateUI(this.state);
    });
  }

  /**
   * Bind theme toggle functionality
   */
  bindThemeToggle(): void {
    if (!this.themeToggle) return;

    this.themeToggle.addEventListener('change', (event) => {
      const isDark = (event.target as HTMLInputElement).checked;
      this.state.theme = isDark ? 'dark' : 'light';
      this.renderer?.setTheme(this.state.theme);
      document.body.className = this.state.theme;
      this.updateUI(this.state);
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

    if (this.barCountSlider) {
      this.barCountSlider.value = state.barCount.toString();
      const valueSpan = this.barCountSlider.parentElement?.querySelector('.slider-value');
      if (valueSpan) valueSpan.textContent = state.barCount.toString();
    }

    // Update theme toggle
    if (this.themeToggle) {
      this.themeToggle.checked = state.theme === 'dark';
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
    const allInputs = [this.sensitivitySlider, this.barCountSlider, this.themeToggle];
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
   * Get current control state
   */
  getState(): ControlsState {
    return { ...this.state };
  }
}