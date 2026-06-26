@echo off
REM Double-click to start the ArgantaLab kids React app (port 5176).
title ArgantaLab dev server
cd /d "%~dp0apps\web"
echo Starting ArgantaLab on http://localhost:5176/ ...
echo (Close this window to stop the server.)
echo.
start "" http://localhost:5176/
call npm run dev -- --port 5176 --strictPort
pause
