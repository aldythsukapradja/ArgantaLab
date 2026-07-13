@echo off
setlocal

REM Double-click to preview the standalone Jarvis Digital Twin (port 5275).
title Jarvis Digital Twin preview
cd /d "%~dp0apps\hq"

set "PORT=5275"
set "URL=http://127.0.0.1:%PORT%/prototypes/jarvis-digital-twin.html"

if not exist "prototypes\jarvis-digital-twin.html" (
  echo ERROR: The Jarvis prototype has not been built yet.
  echo Run rebuild-and-start-jarvis-preview.bat from the repository root.
  echo.
  pause
  exit /b 1
)

where python >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=python"
) else (
  where py >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3 was not found on PATH.
    echo Install Python 3, then run this launcher again.
    echo.
    pause
    exit /b 1
  )
  set "PYTHON=py -3"
)

echo Starting Jarvis Digital Twin...
echo %URL%
echo.
echo Close this window to stop the preview server.
echo.

REM Open the browser after the static server has had a moment to bind the port.
if /i not "%~1"=="--no-open" start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
%PYTHON% -m http.server %PORT% --bind 127.0.0.1

if errorlevel 1 (
  echo.
  echo The preview server stopped with an error. Port %PORT% may already be in use.
  pause
)

endlocal
