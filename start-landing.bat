@echo off
REM Double-click to start the Arganta landing page (port 5174).
title Arganta Landing dev server
cd /d "%~dp0apps\landing"
echo Starting Arganta Landing on http://localhost:5174/ ...
echo (Close this window to stop the server.)
echo.
start "" http://localhost:5174/
call npm run dev -- --port 5174 --strictPort
pause
