@echo off
REM Double-click to start the KinetikCircle local dev server.
title KinetikCircle dev server
cd /d "%~dp0apps\kinetik"
echo Starting KinetikCircle on http://localhost:5180/ ...
echo (Close this window to stop the server.)
echo.
start "" http://localhost:5180/
call npm run dev
pause
