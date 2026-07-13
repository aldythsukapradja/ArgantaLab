@echo off
setlocal

REM Rebuild the repository-derived knowledge graph, then launch its preview.
title Rebuild Jarvis Digital Twin
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found on PATH.
  echo Install Node.js, then run this launcher again.
  echo.
  pause
  exit /b 1
)

echo Rebuilding Jarvis Digital Twin from the HQ knowledge base...
echo.
node "apps\hq\scripts\build-jarvis-digital-twin.mjs"

if errorlevel 1 (
  echo.
  echo ERROR: The Jarvis prototype build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Starting the preview...
echo.
call "%~dp0start-jarvis-preview.bat" %*

endlocal
