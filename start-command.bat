@echo off
REM ============================================================
REM  Arganta Command Center - open the launcher hub.
REM  Reads your BRIDGE_TOKEN from tools\arganta-bridge\.env (never
REM  committed) and opens the page already connected. Change or
REM  clear it any time from the "Bridge" button in the page itself.
REM ============================================================
title Arganta Command Center
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-command-center.ps1" -Root "%ROOT%"
if errorlevel 1 (
  echo.
  echo Something went wrong opening the Command Center ^(see error above^).
  pause
)
