@echo off
title Kingdom - Player 2 (port 8323)
REM ---------------------------------------------------------------
REM  Launches a SECOND Character Lab + Buya Arena dev server on
REM  port 8323 and opens it in your browser. A different port means
REM  a different browser origin, so this session's login is
REM  independent from Player 1's (localStorage isn't shared).
REM  Keep THIS window open while playing. Close it to stop.
REM ---------------------------------------------------------------
cd /d "%~dp0apps\kingdom\web"
if not exist node_modules (
  echo Installing dependencies for the first run, this can take a minute...
  call npm install
)
echo Starting Kingdom - Player 2...
echo Opening http://localhost:8323/ in your browser.
echo.
echo   Keep this window open while playing.
echo   Close this window (or press Ctrl+C) to stop the server.
echo.
start "" "http://localhost:8323/"
call npm run dev -- --port 8323
