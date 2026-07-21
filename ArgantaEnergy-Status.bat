@echo off
REM ArgantaEnergy — status snapshot (mirror + canonical data). Click to run.
cd /d "%~dp0apps\energy"
node scripts\status.mjs
echo.
pause
