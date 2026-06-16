@echo off
REM start.bat — launch Qdrant + Backend + Frontend on Windows
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set VENV=%BACKEND%\venv\Scripts

echo [START] Launching Qdrant...
tasklist /fi "imagename eq qdrant.exe" 2>nul | find /i "qdrant.exe" >nul
if %errorlevel%==0 (
    echo [WARN]  Qdrant already running
) else (
    start /b "" "%BACKEND%\qdrant.exe" --config-path "%BACKEND%\config\config.yaml" > "%TEMP%\qdrant.log" 2>&1
    timeout /t 3 /nobreak >nul
    echo [START] Qdrant started
)

echo [START] Launching backend...
tasklist /fi "imagename eq python.exe" 2>nul | find /i "python.exe" >nul
if %errorlevel%==0 (
    echo [WARN]  Python already running ^(may be backend^)
)
start /b "" "%VENV%\python.exe" "%BACKEND%\main.py" > "%TEMP%\backend.log" 2>&1
timeout /t 2 /nobreak >nul
echo [START] Backend started

echo [START] Launching frontend...
start /b "" cmd /c "cd /d "%FRONTEND%" && npm run dev" > "%TEMP%\frontend.log" 2>&1
timeout /t 3 /nobreak >nul
echo [START] Frontend started

echo.
echo ========================================
echo   All services launching...
echo ========================================
echo   Frontend  -^>  http://localhost:3000
echo   Backend   -^>  http://localhost:8000
echo   Qdrant    -^>  http://localhost:6333
echo ========================================
echo.
echo Logs:
echo   Qdrant   -^>  %TEMP%\qdrant.log
echo   Backend  -^>  %TEMP%\backend.log
echo   Frontend -^>  %TEMP%\frontend.log
echo.
pause
