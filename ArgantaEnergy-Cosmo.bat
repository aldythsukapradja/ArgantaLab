@echo off
REM ArgantaEnergy (COSMO migrated UI) — launch the viewer in the new design.
REM Click to run. The classic UI is still available via ArgantaEnergy-Launch.bat.
cd /d "%~dp0apps\energy"
echo Starting ArgantaEnergy (COSMO migrated UI) on http://localhost:5279/?ui=cosmo ...
echo (Leave this window open. Close it to stop the server.)
echo (Classic UI: run ArgantaEnergy-Launch.bat instead.)
echo.
start "" "http://localhost:5279/?ui=cosmo"
call npm run dev
pause
