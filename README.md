# 🎵 Audio Visualizer

A real-time audio visualizer built with React, TypeScript, and the Web Audio API. Features a smooth bar equalizer that responds to audio input from files or microphone with 60fps performance optimization.

![Audio Visualizer Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-Latest-purple)

## ✨ Features

### 🎚️ **Real-Time Audio Visualization**
- **Bar equalizer** with smooth animations at 60fps
- **Logarithmic frequency scaling** for natural audio representation  
- **Peak detection** with decay animations
- **Sensitivity and smoothing controls**
- **Customizable bar count** (16-96 bars)

### 🎤 **Audio Input Sources**
- **File upload** - Support for MP3, WAV, M4A, OGG formats
- **Microphone input** - Real-time microphone visualization
- **Automatic format detection** and error handling

### 📱 **Mobile & Responsive**
- **Adaptive quality management** - Automatically adjusts for device performance
- **Mobile-optimized controls** with touch-friendly interface
- **Device capability detection** - Optimizes based on memory, CPU, battery
- **High-DPI display support** with pixel ratio scaling
- **Orientation change handling**

### ♿ **Accessibility**
- **Full ARIA support** with screen reader compatibility
- **Keyboard navigation** with customizable shortcuts
- **Reduced motion support** for users with vestibular disorders
- **High contrast mode** support
- **Audio descriptions** for visual elements

### ⚡ **Performance**
- **Zero-allocation rendering loops** for consistent 60fps
- **Canvas optimization** with selective clearing and batching
- **Memory management** with automatic garbage collection
- **Frame rate monitoring** and adaptive quality
- **Web Worker support** for background processing

## 🚀 Quick Start

### **Option 1: Quick Start Scripts**

**🪟 Windows Users:**
1. Clone the repository:
   ```bash
   git clone https://github.com/CosmonautJones/AudioVisualizer.git
   cd AudioVisualizer
   ```
2. **Double-click `START.bat`** - Automatically installs dependencies and starts the server

**🐧 Linux/Mac Users:**
1. Clone the repository:
   ```bash
   git clone https://github.com/CosmonautJones/AudioVisualizer.git
   cd AudioVisualizer
   ```
2. Run the cross-platform script:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   
**⚡ Git Bash/WSL Windows Users:**
- You can also use `./start.sh` in Git Bash or WSL for a cross-platform experience

### **Option 2: Manual Setup**
1. Clone and navigate:
   ```bash
   git clone https://github.com/CosmonautJones/AudioVisualizer.git
   cd AudioVisualizer/visual-eq
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173` (or the port shown in terminal)

## 📋 Requirements

- **Node.js** 16+ 
- **npm** 7+
- **Modern browser** with Web Audio API support:
  - Chrome 66+
  - Firefox 60+  
  - Safari 11.1+
  - Edge 79+

## 🎮 Usage

### **Basic Controls**
1. **Audio Input**:
   - Click "Upload File" to select an audio file
   - Click "Use Microphone" for real-time input (requires permission)

2. **Visualization Settings**:
   - **Sensitivity**: Adjust amplitude response (0.5x - 3.0x)
   - **Smoothing**: Control animation smoothness (0% - 95%)
   - **Bar Count**: Number of frequency bars (16 - 96)

3. **Advanced Settings**:
   - **Color Scheme**: Spectrum, Monochrome, or Custom
   - **Show Peaks**: Enable/disable peak indicators
   - **Performance Mode**: Auto, Quality, or Performance

### **Keyboard Shortcuts**
- `Space` - Play/Pause audio
- `M` - Toggle microphone
- `↑/↓` - Adjust sensitivity
- `Esc` - Toggle controls panel
- `F` - Focus file input

## 🏗️ Architecture

### **Frontend Stack**
```
React 19 + TypeScript + Vite
├── Web Audio API (AudioContext, AnalyserNode)
├── Canvas 2D Rendering (60fps optimized)  
├── Context State Management
└── Custom React Hooks
```

### **Project Structure**
```
visual-eq/src/
├── components/          # React components
│   ├── AudioControls/   # Input controls
│   ├── AudioVisualizer/ # Main canvas component
│   └── UI/             # Interface components
├── hooks/              # Custom React hooks
│   ├── useAudioContext # Audio engine management
│   ├── useAudioAnalyzer# Real-time analysis
│   ├── useCanvasRenderer# Canvas optimization
│   └── useResponsiveCanvas# Device adaptation
├── services/           # Core audio processing
│   ├── audioEngine     # Web Audio API wrapper
│   ├── audioAnalyzer   # Frequency analysis
│   └── visualizers/    # Canvas rendering
├── types/              # TypeScript definitions
├── utils/              # Device detection utilities
└── constants/          # Configuration constants
```

### **Key Services**

**AudioEngine** - Singleton managing AudioContext lifecycle
- iOS Safari autoplay handling
- Performance monitoring  
- Battery optimization
- Error recovery

**AudioAnalyzer** - Real-time frequency analysis
- Zero-allocation rendering loops
- Logarithmic frequency scaling
- Peak detection with decay
- Adaptive quality management

**CanvasOptimizer** - High-performance rendering
- Selective clearing and dirty regions
- Gradient caching
- Batch rendering operations
- Frame timing optimization

## 🛠️ Development

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
```

### **Build & Deploy**
The app builds to static files and can be deployed to:
- **Vercel** - `vercel --prod`
- **Netlify** - Drag `dist/` folder to Netlify
- **GitHub Pages** - Push `dist/` to `gh-pages` branch
- **Any static host** - Upload `dist/` contents

### **Environment Variables**
Create `.env` file for configuration:
```env
VITE_DEFAULT_SAMPLE_RATE=44100
VITE_MAX_FFT_SIZE=32768  
VITE_PERFORMANCE_MODE=auto
```

## 🔧 Configuration

### **Audio Settings** (`src/constants/audio.ts`)
```typescript
DEFAULT_AUDIO_CONFIG = {
  fftSize: 4096,           # Frequency resolution
  smoothingTimeConstant: 0.8, # Smoothing factor
  minDecibels: -90,        # Minimum dB
  maxDecibels: -10         # Maximum dB  
}
```

### **Mobile Optimizations**
- **Reduced frame rate** (30fps on mobile)
- **Lower bar counts** (max 48 on mobile)
- **Memory-aware canvas sizes**
- **Battery optimization** when discharging

## 📱 Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome  | 66+     | ✅ Full | Best performance |
| Firefox | 60+     | ✅ Full | Good performance |  
| Safari  | 11.1+   | ✅ Full | Requires user gesture |
| Edge    | 79+     | ✅ Full | Chromium-based |
| Mobile Safari | 11+ | ✅ Limited | Autoplay restrictions |
| Chrome Mobile | 66+ | ✅ Good | Performance optimized |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript strict mode
- Use React 19 patterns (hooks, functional components)
- Maintain 60fps performance target
- Write comprehensive error handling
- Include accessibility features
- Test on mobile devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Web Audio API** - For real-time audio processing
- **Canvas API** - For high-performance 2D rendering  
- **React Team** - For the excellent development experience
- **Vite** - For lightning-fast build tooling
- **Claude Code** - For development assistance

## 🔗 Links

- **Live Demo**: Coming Soon
- **Issues**: [GitHub Issues](https://github.com/CosmonautJones/AudioVisualizer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CosmonautJones/AudioVisualizer/discussions)

---

**Built with ❤️ using React, TypeScript, and Web Audio API**

🤖 *Generated with [Claude Code](https://claude.ai/code)*