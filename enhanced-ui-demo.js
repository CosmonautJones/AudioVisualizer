/**
 * Enhanced UI Demo - Interactive Functionality Demo
 * This demonstrates the enhanced UI system without full audio processing
 */

class EnhancedUIDemo {
  constructor() {
    this.state = {
      mode: 'bars',
      isPlaying: false,
      sensitivity: 1.0,
      theme: 'dark',
      // Bars settings
      barCount: 64,
      barSpacing: 2,
      barHeightScale: 1.0,
      // Mandala settings
      mandalaSegments: 8,
      rotationSpeed: 3,
      innerRadius: 30,
      outerRadius: 90,
      symmetry: 'mirror',
      // Color settings
      colorScheme: 'spectrum',
      primaryHue: 240,
      saturation: 80,
      brightness: 60
    };
    
    this.initializeEventListeners();
    this.updateUI();
    this.startDemo();
  }

  initializeEventListeners() {
    // Header controls
    this.bindHeaderControls();
    
    // Mode selector
    this.bindModeSelector();
    
    // Global controls
    this.bindGlobalControls();
    
    // Bars controls
    this.bindBarsControls();
    
    // Mandala controls
    this.bindMandalaControls();
    
    // Color controls
    this.bindColorControls();
    
    // Accessibility controls
    this.bindAccessibilityControls();
    
    // Collapsible sections
    this.bindCollapsibleSections();
    
    // Mobile controls
    this.bindMobileControls();
    
    // Keyboard shortcuts
    this.bindKeyboardShortcuts();
  }

  bindHeaderControls() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const collapseBtn = document.getElementById('collapse-controls');

    fullscreenBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    settingsBtn?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    collapseBtn?.addEventListener('click', () => {
      this.toggleControlsPanel();
    });
  }

  bindModeSelector() {
    const modeOptions = document.querySelectorAll('.mode-option');
    
    modeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const mode = option.dataset.mode;
        if (mode && mode !== this.state.mode) {
          this.switchVisualizationMode(mode);
        }
      });
    });
  }

  bindGlobalControls() {
    // Audio source selector
    const inputSelector = document.querySelectorAll('input[name="source"]');
    inputSelector.forEach(input => {
      input.addEventListener('change', () => {
        this.handleAudioSourceChange(input.value);
      });
    });

    // Sensitivity slider
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    sensitivitySlider?.addEventListener('input', (e) => {
      this.state.sensitivity = parseFloat(e.target.value);
      this.updateSliderValue(e.target, this.state.sensitivity.toFixed(1));
      this.announceChange('Sensitivity', this.state.sensitivity.toFixed(1));
    });

    // Theme selector
    const themeSelector = document.getElementById('theme-selector');
    themeSelector?.addEventListener('change', (e) => {
      this.state.theme = e.target.value;
      this.applyTheme(this.state.theme);
      this.announceChange('Theme', this.state.theme);
    });

    // Playback button
    const playbackBtn = document.getElementById('playback-button');
    playbackBtn?.addEventListener('click', () => {
      this.togglePlayback();
    });
  }

  bindBarsControls() {
    const barCountSlider = document.getElementById('bar-count-slider');
    const barSpacingSlider = document.getElementById('bar-spacing-slider');
    const barHeightScale = document.getElementById('bar-height-scale');

    barCountSlider?.addEventListener('input', (e) => {
      this.state.barCount = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.barCount.toString());
      this.announceChange('Bar count', this.state.barCount);
    });

    barSpacingSlider?.addEventListener('input', (e) => {
      this.state.barSpacing = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.barSpacing + 'px');
      this.announceChange('Bar spacing', this.state.barSpacing + ' pixels');
    });

    barHeightScale?.addEventListener('input', (e) => {
      this.state.barHeightScale = parseFloat(e.target.value);
      this.updateSliderValue(e.target, this.state.barHeightScale.toFixed(1) + 'x');
      this.announceChange('Bar height scale', this.state.barHeightScale.toFixed(1) + 'x');
    });
  }

  bindMandalaControls() {
    // Segment buttons
    const segmentBtns = document.querySelectorAll('.segment-btn');
    segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        segmentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.mandalaSegments = parseInt(btn.dataset.segments);
        this.announceChange('Mandala segments', this.state.mandalaSegments);
      });
    });

    // Rotation speed
    const rotationSpeed = document.getElementById('rotation-speed');
    rotationSpeed?.addEventListener('input', (e) => {
      this.state.rotationSpeed = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.rotationSpeed + '°/sec');
      this.announceChange('Rotation speed', this.state.rotationSpeed + ' degrees per second');
    });

    // Radius controls
    const innerRadius = document.getElementById('inner-radius');
    const outerRadius = document.getElementById('outer-radius');

    innerRadius?.addEventListener('input', (e) => {
      this.state.innerRadius = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.innerRadius + '%');
      this.announceChange('Inner radius', this.state.innerRadius + '%');
    });

    outerRadius?.addEventListener('input', (e) => {
      this.state.outerRadius = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.outerRadius + '%');
      this.announceChange('Outer radius', this.state.outerRadius + '%');
    });

    // Symmetry options
    const symmetryInputs = document.querySelectorAll('input[name="symmetry"]');
    symmetryInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.state.symmetry = input.value;
        this.announceChange('Symmetry pattern', this.state.symmetry);
      });
    });
  }

  bindColorControls() {
    // Color scheme buttons
    const colorSchemes = document.querySelectorAll('.color-scheme');
    colorSchemes.forEach(scheme => {
      scheme.addEventListener('click', () => {
        colorSchemes.forEach(s => s.classList.remove('active'));
        scheme.classList.add('active');
        this.state.colorScheme = scheme.dataset.scheme;
        this.toggleCustomColors(this.state.colorScheme === 'custom');
        this.announceChange('Color scheme', this.state.colorScheme);
      });
    });

    // Custom color controls
    const primaryHue = document.getElementById('primary-hue');
    const saturation = document.getElementById('saturation');
    const brightness = document.getElementById('brightness');

    primaryHue?.addEventListener('input', (e) => {
      this.state.primaryHue = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.primaryHue + '°');
      this.updateCustomColorPreview();
    });

    saturation?.addEventListener('input', (e) => {
      this.state.saturation = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.saturation + '%');
      this.updateCustomColorPreview();
    });

    brightness?.addEventListener('input', (e) => {
      this.state.brightness = parseInt(e.target.value);
      this.updateSliderValue(e.target, this.state.brightness + '%');
      this.updateCustomColorPreview();
    });
  }

  bindAccessibilityControls() {
    const highContrast = document.getElementById('high-contrast');
    const reducedMotion = document.getElementById('reduced-motion');
    const screenReader = document.getElementById('screen-reader');
    const keyboardNav = document.getElementById('keyboard-nav');

    highContrast?.addEventListener('change', (e) => {
      document.body.classList.toggle('high-contrast', e.target.checked);
      this.announceChange('High contrast mode', e.target.checked ? 'enabled' : 'disabled');
    });

    reducedMotion?.addEventListener('change', (e) => {
      document.body.classList.toggle('reduced-motion', e.target.checked);
      this.announceChange('Reduced motion', e.target.checked ? 'enabled' : 'disabled');
    });

    screenReader?.addEventListener('change', (e) => {
      this.state.screenReaderMode = e.target.checked;
      this.announceChange('Audio descriptions', e.target.checked ? 'enabled' : 'disabled');
    });

    keyboardNav?.addEventListener('change', (e) => {
      this.state.keyboardNavigation = e.target.checked;
      this.announceChange('Keyboard navigation', e.target.checked ? 'enabled' : 'disabled');
    });
  }

  bindCollapsibleSections() {
    const collapsibleTitles = document.querySelectorAll('.section-title.collapsible');
    
    collapsibleTitles.forEach(title => {
      title.addEventListener('click', () => {
        this.toggleCollapsibleSection(title);
      });
    });
  }

  bindMobileControls() {
    const mobileHandle = document.querySelector('.mobile-handle');
    const mobileControls = document.querySelector('.mobile-controls');
    const mobileModeButtons = document.querySelectorAll('.mobile-mode-btn');
    const mobileSensitivity = document.getElementById('mobile-sensitivity');
    const moreSettingsBtn = document.getElementById('mobile-more-settings');

    mobileHandle?.addEventListener('click', () => {
      mobileControls?.classList.toggle('expanded');
    });

    mobileModeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        mobileModeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchVisualizationMode(btn.dataset.mode);
      });
    });

    mobileSensitivity?.addEventListener('input', (e) => {
      this.state.sensitivity = parseFloat(e.target.value);
      // Sync with desktop control
      const desktopSlider = document.getElementById('sensitivity-slider');
      if (desktopSlider) {
        desktopSlider.value = this.state.sensitivity;
        this.updateSliderValue(desktopSlider, this.state.sensitivity.toFixed(1));
      }
    });

    moreSettingsBtn?.addEventListener('click', () => {
      // Show full controls panel on mobile
      this.showMobileSettings();
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlayback();
          break;
        case '1':
          this.switchVisualizationMode('bars');
          break;
        case '2':
          this.switchVisualizationMode('mandala');
          break;
        case 't':
          this.cycleTheme();
          break;
        case 'f':
          this.toggleFullscreen();
          break;
        case 'Escape':
          this.exitFullscreen();
          break;
        case '?':
          this.showKeyboardShortcuts();
          break;
      }
    });
  }

  // UI Update Methods
  switchVisualizationMode(newMode) {
    if (newMode === this.state.mode) return;

    // Show transition indicator
    this.showModeTransition(newMode);

    // Update state
    const oldMode = this.state.mode;
    this.state.mode = newMode;

    // Update UI
    setTimeout(() => {
      this.updateModeSelector();
      this.updateModeControls();
      this.hideModeTransition();
      this.announceChange('Visualization mode', newMode);
    }, 300);
  }

  showModeTransition(targetMode) {
    const indicator = document.getElementById('mode-transition');
    const targetModeSpan = document.getElementById('target-mode');
    
    if (indicator && targetModeSpan) {
      targetModeSpan.textContent = targetMode;
      indicator.style.display = 'flex';
    }
  }

  hideModeTransition() {
    const indicator = document.getElementById('mode-transition');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  updateModeSelector() {
    const modeOptions = document.querySelectorAll('.mode-option');
    modeOptions.forEach(option => {
      const isActive = option.dataset.mode === this.state.mode;
      option.classList.toggle('active', isActive);
      
      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = isActive;
    });
  }

  updateModeControls() {
    const modeControls = document.querySelectorAll('.mode-controls');
    modeControls.forEach(control => {
      const shouldShow = control.dataset.mode === this.state.mode;
      if (shouldShow) {
        control.style.display = 'block';
        setTimeout(() => {
          control.style.opacity = '1';
          control.style.transform = 'translateY(0)';
        }, 50);
      } else {
        control.style.opacity = '0';
        control.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          control.style.display = 'none';
        }, 300);
      }
    });
  }

  togglePlayback() {
    this.state.isPlaying = !this.state.isPlaying;
    this.updatePlaybackButton();
    this.announceChange('Playback', this.state.isPlaying ? 'started' : 'paused');
  }

  updatePlaybackButton() {
    const playbackBtn = document.getElementById('playback-button');
    const btnIcon = playbackBtn?.querySelector('.btn-icon');
    const btnText = playbackBtn?.querySelector('.btn-text');

    if (btnIcon && btnText) {
      if (this.state.isPlaying) {
        btnIcon.textContent = '⏸️';
        btnText.textContent = 'Pause';
      } else {
        btnIcon.textContent = '▶️';
        btnText.textContent = 'Play';
      }
    }
  }

  applyTheme(theme) {
    document.body.className = theme;
    
    // Update theme selector
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
      themeSelector.value = theme;
    }
  }

  cycleTheme() {
    const themes = ['dark', 'light', 'neon'];
    const currentIndex = themes.indexOf(this.state.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    this.state.theme = nextTheme;
    this.applyTheme(nextTheme);
    this.announceChange('Theme', nextTheme);
  }

  toggleCustomColors(show) {
    const customColors = document.querySelector('.custom-colors');
    if (customColors) {
      customColors.style.display = show ? 'block' : 'none';
    }
  }

  updateCustomColorPreview() {
    const customPreview = document.querySelector('.gradient-custom');
    if (customPreview) {
      const hue1 = this.state.primaryHue;
      const hue2 = (this.state.primaryHue + 60) % 360;
      const sat = this.state.saturation;
      const bright = this.state.brightness;
      
      customPreview.style.background = 
        `linear-gradient(90deg, hsl(${hue1}, ${sat}%, ${bright}%), hsl(${hue2}, ${sat}%, ${bright}%))`;
    }
  }

  toggleCollapsibleSection(titleElement) {
    const isCollapsed = titleElement.dataset.collapsed === 'true';
    titleElement.dataset.collapsed = (!isCollapsed).toString();
    
    const content = titleElement.nextElementSibling;
    if (content && content.classList.contains('collapsible-content')) {
      if (isCollapsed) {
        content.style.display = 'block';
        setTimeout(() => {
          content.style.maxHeight = content.scrollHeight + 'px';
        }, 10);
      } else {
        content.style.maxHeight = '0';
        setTimeout(() => {
          content.style.display = 'none';
        }, 300);
      }
    }
  }

  toggleControlsPanel() {
    const app = document.querySelector('.app');
    app?.classList.toggle('controls-collapsed');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }

  // Utility Methods
  updateSliderValue(slider, value) {
    const valueSpan = slider.parentElement?.querySelector('.slider-value');
    if (valueSpan) {
      valueSpan.textContent = value;
    }
  }

  announceChange(setting, value) {
    const liveRegion = document.getElementById('sr-live-region');
    if (liveRegion && this.state.screenReaderMode) {
      liveRegion.textContent = `${setting} changed to ${value}`;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status status-${type}`;
      
      if (type === 'success') {
        setTimeout(() => {
          statusElement.textContent = '';
          statusElement.className = 'status';
        }, 3000);
      }
    }
  }

  showSettingsModal() {
    // Demo: show alert instead of modal
    alert('Settings modal would open here with advanced configuration options.');
  }

  showMobileSettings() {
    // Demo: toggle full controls visibility on mobile
    const controls = document.querySelector('.controls');
    const mobileControls = document.querySelector('.mobile-controls');
    
    if (window.innerWidth <= 768) {
      // Show desktop controls overlay on mobile
      alert('Full settings panel would slide up from bottom on mobile.');
    }
  }

  showKeyboardShortcuts() {
    const shortcuts = [
      'Space: Toggle playback',
      '1: Switch to Bars mode',
      '2: Switch to Mandala mode',
      'T: Cycle themes',
      'F: Toggle fullscreen',
      'Escape: Exit fullscreen',
      '?: Show this help'
    ];
    
    alert('Keyboard Shortcuts:\n\n' + shortcuts.join('\n'));
  }

  handleAudioSourceChange(source) {
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileInfo = document.getElementById('file-info');
    
    if (source === 'file') {
      fileUploadArea.style.display = 'block';
      fileInfo.style.display = 'none';
    } else {
      fileUploadArea.style.display = 'none';
      fileInfo.style.display = 'none';
    }
    
    this.announceChange('Audio source', source === 'mic' ? 'microphone' : 'audio file');
  }

  // Demo visualization
  startDemo() {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Demo animation
    let frame = 0;
    const animate = () => {
      frame++;
      
      // Clear canvas
      ctx.fillStyle = this.state.theme === 'light' ? '#ffffff' : '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (this.state.mode === 'bars') {
        this.drawDemoBars(ctx, canvas, frame);
      } else {
        this.drawDemoMandala(ctx, canvas, frame);
      }
      
      // Update performance stats
      this.updatePerformanceStats();
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  drawDemoBars(ctx, canvas, frame) {
    const barCount = this.state.barCount;
    const barWidth = (canvas.width - (barCount - 1) * this.state.barSpacing) / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + this.state.barSpacing);
      const amplitude = Math.sin(frame * 0.1 + i * 0.2) * 0.5 + 0.5;
      const height = amplitude * canvas.height * 0.8 * this.state.barHeightScale;
      const y = canvas.height - height;
      
      // Color gradient based on position and height
      const hue = (i / barCount) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, ${50 + amplitude * 30}%)`;
      ctx.fillRect(x, y, barWidth, height);
    }
  }

  drawDemoMandala(ctx, canvas, frame) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const segments = this.state.mandalaSegments;
    const rotation = (frame * this.state.rotationSpeed * 0.1) % 360;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const amplitude = Math.sin(frame * 0.1 + i * 0.5) * 0.5 + 0.5;
      const innerR = (this.state.innerRadius / 100) * Math.min(canvas.width, canvas.height) * 0.4;
      const outerR = innerR + amplitude * (this.state.outerRadius / 100) * Math.min(canvas.width, canvas.height) * 0.3;
      
      const startAngle = angle - Math.PI / segments;
      const endAngle = angle + Math.PI / segments;
      
      // Create gradient
      const gradient = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
      gradient.addColorStop(0, `hsl(${(i / segments) * 360}, 70%, 60%)`);
      gradient.addColorStop(1, `hsl(${(i / segments) * 360}, 70%, 30%)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, startAngle, endAngle);
      ctx.arc(0, 0, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }

  updatePerformanceStats() {
    const fpsCounter = document.getElementById('fps-counter');
    const frameTimeElement = document.getElementById('frame-time');
    
    // Simulate performance metrics
    if (fpsCounter) {
      fpsCounter.textContent = '60';
    }
    if (frameTimeElement) {
      frameTimeElement.textContent = '8ms';
    }
  }

  updateUI() {
    this.updateModeSelector();
    this.updateModeControls();
    this.updatePlaybackButton();
    this.applyTheme(this.state.theme);
  }
}

// Initialize demo when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EnhancedUIDemo();
  
  // Show initial status
  setTimeout(() => {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = 'Enhanced UI Demo Ready - Try switching visualization modes!';
      statusElement.className = 'status status-success';
      
      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
      }, 4000);
    }
  }, 1000);
});