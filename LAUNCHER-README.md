# Interview Assistant - CMD Launcher Guide

This folder contains user-friendly command-line launchers for the Interview Assistant application.

## Available Launchers

### 1. `Start-Dev.cmd` (Quick Development Launcher)
**Recommended for most users!**
- **Purpose**: Quick start in development mode
- **Features**: 
  - Beautiful UI with Unicode characters
  - Automatic dependency checking
  - One-click startup
  - Shows application URL (http://localhost:9000)

### 2. `Interview-Assistant-Launcher.cmd` (Full Feature Launcher)
**For advanced users who want more options**
- **Purpose**: Comprehensive launcher with multiple options
- **Features**:
  - Interactive menu with 6 options
  - Development mode
  - Production mode (if built)
  - Build application
  - Install dependencies
  - Open settings folder
  - Exit

### 3. `run-app.cmd` (Production Launcher)
**For running the built application**
- **Purpose**: Launch the production build
- **Requirement**: Application must be built first using `npm run make`

### 4. `start-dev.cmd` (Original Development Launcher)
**Original development launcher**
- **Purpose**: Simple development mode startup
- **Features**: Basic dependency checking and .env file creation

## Quick Start Instructions

### For First-Time Users:
1. **Double-click** `Start-Dev.cmd`
2. The launcher will:
   - Check if Node.js is installed
   - Install dependencies (if needed)
   - Start the development server
   - Open your browser to http://localhost:9000

### For Regular Users:
1. **Double-click** `Start-Dev.cmd` for quick development mode
2. Or use `Interview-Assistant-Launcher.cmd` for more options

## Requirements

- **Node.js** (v16 or higher) - Download from https://nodejs.org/
- **Windows** (CMD files are Windows-specific)

## Troubleshooting

### If the launcher doesn't work:
1. Make sure Node.js is installed: `node --version`
2. Check if you're in the correct folder
3. Try running `npm start` directly
4. Check the terminal for error messages

### If you see garbled characters:
- The launchers use Unicode characters for better UI
- This is normal and won't affect functionality

### If dependencies fail to install:
1. Check your internet connection
2. Try running `npm install` manually
3. Clear npm cache: `npm cache clean --force`

## API Keys Setup

The application requires API keys for AI services. The launchers will help you set up a `.env` file with placeholder keys. You'll need to:

1. Get API keys from:
   - **DeepGram** (for transcription): https://console.deepgram.com/
   - **Gemini** (for AI responses): https://makersuite.google.com/app/apikey
   - **DeepSeek** (alternative AI): https://platform.deepseek.com/

2. Edit the `.env` file created by the launcher
3. Replace placeholder keys with your actual API keys

## Development vs Production

- **Development Mode** (`Start-Dev.cmd`):
  - Hot-reload for code changes
  - Debug tools available
  - Console logging
  - Development server at http://localhost:9000

- **Production Mode** (`run-app.cmd`):
  - Optimized performance
  - No development tools
  - Standalone executable
  - Better for regular use

Enjoy using Interview Assistant! 🚀