@echo off
echo Starting Interview Assistant...

REM Check if built executable exists
if exist "out\Interview Assistant-win32-x64\Interview Assistant.exe" (
    echo Launching built application...
    start "" "out\Interview Assistant-win32-x64\Interview Assistant.exe"
    echo Application started successfully!
) else (
    echo Built application not found.
    echo Please build the application first with: npm run make
    echo Or run in development mode with: npm start
    pause
    exit /b 1
)
