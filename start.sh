#!/bin/bash

# Audio Visualizer - Cross-Platform Quick Start Script
# Works on Windows (Git Bash/WSL), Linux, and macOS
# Makes it easy for anyone to clone and run the project

# Detect operating system
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    IS_WINDOWS=true
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -W 2>/dev/null || pwd)"
else
    IS_WINDOWS=false
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# Colors for output (disable on Windows Command Prompt)
if [[ "$IS_WINDOWS" == true && -z "$WT_SESSION" && -z "$TERM_PROGRAM" ]]; then
    # Windows Command Prompt - no colors
    RED=''
    GREEN=''
    BLUE=''
    YELLOW=''
    NC=''
else
    # Unix or Windows Terminal/Git Bash - use colors
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    NC='\033[0m' # No Color
fi

# Header
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                     🎵 Audio Visualizer                      ║"
echo "  ║                                                              ║"
echo "  ║     Real-time audio visualization with React + TypeScript   ║"
echo "  ║                                                              ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Minimum required version: Node.js 16+"
    echo ""
    if [[ "$IS_WINDOWS" == true ]]; then
        echo "On Windows: Download from https://nodejs.org/ or use:"
        echo "  • Chocolatey: choco install nodejs"  
        echo "  • Winget: winget install OpenJS.NodeJS"
    else
        echo "On macOS with Homebrew: brew install node"
        echo "On Ubuntu/Debian: sudo apt install nodejs npm"
        echo "On CentOS/RHEL: sudo yum install nodejs npm"
    fi
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js found: $NODE_VERSION${NC}"

# Check if npm is available
echo "[2/4] Checking npm availability..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not available!${NC}"
    echo "Please reinstall Node.js with npm included."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm found: $NPM_VERSION${NC}"
echo ""

# Navigate to the visual-eq directory
echo "[3/4] Navigating to project directory..."
if [[ "$IS_WINDOWS" == true ]]; then
    cd "$SCRIPT_DIR/visual-eq" || exit 1
else
    cd "$(dirname "$0")/visual-eq" || exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in visual-eq directory!${NC}"
    echo "Make sure you're running this from the project root."
    exit 1
fi

echo -e "${GREEN}✅ Found package.json${NC}"
echo ""

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies (this may take a few minutes)...${NC}"
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}❌ Failed to install dependencies!${NC}"
        echo "Please check your internet connection and try again."
        exit 1
    fi
    echo ""
    echo -e "${GREEN}✅ Dependencies installed successfully!${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""
echo "[4/4] Starting development server..."
echo ""
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│                                                              │"
echo "│  🚀 Starting Audio Visualizer...                            │"
echo "│                                                              │"
echo "│  The app will open automatically in your browser.           │"
echo "│  If it doesn't, look for the localhost URL below.           │"
echo "│                                                              │"
echo "│  Controls:                                                   │"
echo "│  • Upload an audio file or use microphone                   │"
echo "│  • Adjust sensitivity and smoothing                         │"
echo "│  • Change bar count and color scheme                        │"
echo "│                                                              │"
echo "│  Press Ctrl+C in this terminal to stop the server          │"
echo "│                                                              │"
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

# Start the development server
npm run dev

# If we get here, the server was stopped
echo ""
echo -e "${YELLOW}🛑 Development server stopped.${NC}"
echo ""
echo "To restart, run './start.sh' again or run 'npm run dev' in the visual-eq folder."
echo ""