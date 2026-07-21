@echo off
REM ArgantaEnergy — run full data truth checks (validation). Click to run.
cd /d "%~dp0apps\energy"
node scripts\validate.mjs
echo.
pause
