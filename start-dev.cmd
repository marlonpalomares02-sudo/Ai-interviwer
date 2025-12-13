@echo off
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                Interview Assistant Quick Start               ║
echo ║                    Development Mode                          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 🚀 Starting Interview Assistant in Development Mode...
echo 📍 Location: http://localhost:9000
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check and install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo ✅ Starting development server...
echo 💡 Press Ctrl+C to stop the server
echo.
call npm start