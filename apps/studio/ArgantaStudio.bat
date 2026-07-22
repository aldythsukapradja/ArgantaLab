@echo off
REM ─── ArgantaStudio one-click launcher ───────────────────────────────────────
REM Starts the dev server and opens the app in your browser.
title ArgantaStudio
cd /d "%~dp0"

echo.
echo   ArgantaStudio - starting up...
echo   ------------------------------------

REM Install dependencies on first run (node_modules missing).
if not exist "node_modules\" (
  echo   First run - installing dependencies. This can take a minute...
  call npm install
)

REM Open the browser a few seconds after the server begins booting.
start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3200/studio"

echo   Opening http://localhost:3200/studio
echo   Close this window to stop the app.
echo.

call npm run dev
