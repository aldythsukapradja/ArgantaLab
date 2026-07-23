@echo off
REM Compatibility launcher — ArgantaEnergy now uses COSMO as its canonical UI.
cd /d "%~dp0apps\energy"
echo Starting ArgantaEnergy on http://localhost:5279/ ...
echo (Leave this window open. Close it to stop the server.)
echo.
start "" "http://localhost:5279/"
call npm run dev
pause
