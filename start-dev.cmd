@echo off
echo Starting Interview Assistant in development mode...

REM Check if node_modules exists
if not exist "node_modules" (
    echo Dependencies not installed. Running npm install...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Check if .env file exists, create placeholder if not
if not exist ".env" (
    echo Creating .env file with placeholder API keys...
    echo DEEPGRAM_API_KEY=placeholder_deepgram_api_key > .env
    echo DEEPSEEK_API_KEY=placeholder_deepseek_api_key >> .env
    echo ⚠️  Please update .env with your actual API keys
)

echo Starting development server...
echo The application will be available at http://localhost:9000
echo.
echo Press Ctrl+C to stop the server.
echo.

call npm start
