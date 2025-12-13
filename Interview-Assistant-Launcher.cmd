@echo off
chcp 65001 >nul
cls
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    Interview Assistant                       ║
echo ║                    AI Interview Buddy                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Welcome to Interview Assistant!
echo This application helps you practice interviews with AI-powered feedback.
echo.
echo ┌──────────────────────────────────────────────────────────────┐
echo │  Available Options:                                          │
echo │  [1] Run in Development Mode (Recommended for first time)    │
echo │  [2] Run Production Build (If already built)               │
echo │  [3] Build Application                                       │
echo │  [4] Install Dependencies                                    │
echo │  [5] Open Settings Folder                                    │
echo │  [6] Exit                                                    │
echo └──────────────────────────────────────────────────────────────┘
echo.

set /p choice=Please select an option (1-6): 

if "%choice%"=="1" goto development
if "%choice%"=="2" goto production
if "%choice%"=="3" goto build
if "%choice%"=="4" goto install
if "%choice%"=="5" goto settings
if "%choice%"=="6" goto exit
echo Invalid choice. Please try again.
pause
goto start

:development
echo.
echo Starting Interview Assistant in Development Mode...
echo This will start the application with hot-reload and debugging capabilities.
echo The app will be available at: http://localhost:9000
echo.
echo Checking prerequisites...

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    goto start
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Dependencies not found. Installing...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies.
        pause
        goto start
    )
)

echo ✅ Prerequisites check passed!
echo 🚀 Starting development server...
echo.
echo 💡 Tip: Press Ctrl+C to stop the server when you're done.
echo.
pause
call npm start
goto start

:production
echo.
echo Starting Interview Assistant in Production Mode...
echo Looking for built application...

if exist "out\Interview Assistant-win32-x64\Interview Assistant.exe" (
    echo ✅ Found built application!
    echo 🚀 Launching Interview Assistant...
    start "" "out\Interview Assistant-win32-x64\Interview Assistant.exe"
    echo Application started successfully!
    timeout /t 3 /nobreak >nul
    goto start
) else (
    echo ❌ Built application not found.
    echo.
    echo You need to build the application first. Select option 3 to build.
    pause
    goto start
)

:build
echo.
echo Building Interview Assistant for Production...
echo This may take a few minutes...
echo.
echo 📦 Installing dependencies (if needed)...
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies.
        pause
        goto start
    )
)

echo 🔨 Building application...
call npm run make
if errorlevel 1 (
    echo ❌ Build failed. Please check the error messages above.
    pause
    goto start
)

echo ✅ Build completed successfully!
echo 📁 Built application location: out\Interview Assistant-win32-x64\
echo.
echo You can now run the application using option 2 (Production Mode).
pause
goto start

:install
echo.
echo Installing Dependencies...
echo This will install all required Node.js packages...
echo.
echo 📦 Running npm install...
call npm install
if errorlevel 1 (
    echo ❌ Installation failed. Please check your Node.js installation and internet connection.
    pause
    goto start
)

echo ✅ Dependencies installed successfully!
pause
goto start

:settings
echo.
echo Opening Settings Folder...
echo This will open the folder where configuration files are stored.
echo.
echo 📁 Opening: %%APPDATA%%\interview-assistant\
start "" "%APPDATA%\interview-assistant\"
pause
goto start

:exit
echo.
echo Thank you for using Interview Assistant!
echo Visit our GitHub repository for updates and support.
echo.
echo Press any key to exit...
pause >nul
exit