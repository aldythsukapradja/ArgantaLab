@echo off
REM Double-click to start Kingdom (command center + walkable client) on port 5599.
REM Serves the whole repo statically; the app lives under /apps/kingdom/.
title Kingdom dev server
cd /d "%~dp0"
echo Starting Kingdom on http://localhost:5599/ ...
echo   Command center : http://localhost:5599/apps/kingdom/command/
echo   Walkable client: http://localhost:5599/apps/kingdom/game/
echo (Close this window to stop the server.)
echo.
start "" http://localhost:5599/apps/kingdom/command/
python -m http.server 5599
pause
