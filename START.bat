@echo off
title Audio Visualizer - Quick Start
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                     🎵 Audio Visualizer                      ║
echo  ║                                                              ║
echo  ║     Real-time audio visualization with React + TypeScript   ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Minimum required version: Node.js 16+
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%

REM Check if npm is available
echo [2/4] Checking npm availability...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available!
    echo Please reinstall Node.js with npm included.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm found: %NPM_VERSION%
echo.

REM Navigate to the visual-eq directory
echo [3/4] Navigating to project directory...
cd /d "%~dp0visual-eq"

if not exist "package.json" (
    echo ❌ package.json not found in visual-eq directory!
    echo Make sure you're running this from the project root.
    pause
    exit /b 1
)

echo ✅ Found package.json
echo.

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules" (
    echo 📦 Installing dependencies (this may take a few minutes)...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ❌ Failed to install dependencies!
        echo Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo.
    echo ✅ Dependencies installed successfully!
) else (
    echo ✅ Dependencies already installed
)

echo.
echo [4/4] Starting development server...
echo.
echo ┌──────────────────────────────────────────────────────────────┐
echo │                                                              │
echo │  🚀 Starting Audio Visualizer...                            │
echo │                                                              │
echo │  The app will open automatically in your browser.           │
echo │  If it doesn't, look for the localhost URL below.           │
echo │                                                              │
echo │  Controls:                                                   │
echo │  • Upload an audio file or use microphone                   │
echo │  • Adjust sensitivity and smoothing                         │
echo │  • Change bar count and color scheme                        │
echo │                                                              │
echo │  Press Ctrl+C in this window to stop the server            │
echo │                                                              │
echo └──────────────────────────────────────────────────────────────┘
echo.

REM Start the development server
npm run dev

REM If we get here, the server was stopped
echo.
echo 🛑 Development server stopped.
echo.
echo To restart, double-click START.bat again or run 'npm run dev' in the visual-eq folder.
echo.
pause