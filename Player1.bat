@echo off
title Kingdom - Player 1 (port 8322)
REM ---------------------------------------------------------------
REM  Launches the Character Lab + Buya Arena dev server on port 8322
REM  and opens it in your browser. Separate port from Player 2 so
REM  each browser keeps its own login session (different origin).
REM  Keep THIS window open while playing. Close it to stop.
REM ---------------------------------------------------------------
cd /d "%~dp0apps\kingdom\web"
if not exist node_modules (
  echo Installing dependencies for the first run, this can take a minute...
  call npm install
)
echo Starting Kingdom - Player 1...
echo Opening http://localhost:8322/ in your browser.
echo.
echo   Keep this window open while playing.
echo   Close this window (or press Ctrl+C) to stop the server.
echo.
start "" "http://localhost:8322/"
call npm run dev
