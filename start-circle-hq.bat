@echo off
REM Double-click to start the Circle HQ founder OS (React/Vite, port 5273).
title Circle HQ dev server
cd /d "%~dp0apps\hq"
echo Starting Circle HQ on http://localhost:5273/ ...
echo (Close this window to stop the server.)
echo.
start "" http://localhost:5273/
call npm run dev
pause
