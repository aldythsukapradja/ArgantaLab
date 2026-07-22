@echo off
REM ─── ArgantaStudio one-click launcher (repo root shortcut) ──────────────────
REM Double-click to start ArgantaStudio and open it in your browser.
title ArgantaStudio
cd /d "%~dp0apps\studio"

echo.
echo   ArgantaStudio - starting up...
echo   ------------------------------------

if not exist "node_modules\" (
  echo   First run - installing dependencies. This can take a minute...
  call npm install
)

REM If a ComfyUI server is reachable, sovereign generation uses your GPU.
REM Otherwise it falls back to the built-in deterministic engine (still works).
if not defined COMFY_URL set "COMFY_URL=http://127.0.0.1:8188"
echo   ComfyUI endpoint: %COMFY_URL%  (edit apps\studio\.env.local to change)

start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3200/studio"

echo   Opening http://localhost:3200/studio
echo   Close this window to stop the app.
echo.

call npm run dev
