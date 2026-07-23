@echo off
REM ArgantaEnergy — launch the canonical COSMO UI. Click to run.
cd /d "%~dp0apps\energy"
echo Starting ArgantaEnergy dev server on http://localhost:5279 ...
echo (Leave this window open. Close it to stop the server.)
echo.
start "" http://localhost:5279/
call npm run dev
pause
