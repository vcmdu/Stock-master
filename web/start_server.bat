@echo off
echo Starting StockMaster Pro Local Server...
echo.
echo URL: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"

:: Try Python 3
python -m http.server 8000
if %errorlevel% neq 0 (
    echo.
    echo Python 3 command failed. Trying 'py' launcher...
    py -m http.server 8000
)

if %errorlevel% neq 0 (
    echo.
    echo Error: Python is not found or failed to start.
    echo Please install Python from https://www.python.org/downloads/
    echo.
    pause
)
