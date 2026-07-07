@echo off
setlocal
title Kinetik Sync Test - Player 1 (BAGINDA)
cd /d "%~dp0"

REM ============================================================
REM  KinetikCircle two-player SYNC test - PLAYER 1
REM
REM  Opens KinetikCircle in an ISOLATED browser profile so this
REM  window keeps its OWN login (log in as BAGINDA). Run
REM  KinetikPlayer2.bat for the second window (KEYLA). Both must
REM  be in the SAME circle to see each other's farm in realtime.
REM
REM  Uses LOCAL dev servers so the sync fixes are exercised:
REM    KinetikCircle -> http://localhost:5180
REM    LashiraBloom  -> http://localhost:5185  (embedded)
REM  To test the DEPLOYED app instead, set URL below to
REM  https://circle.arganta.app/  (only after the fix is deployed).
REM ============================================================
set "URL=http://localhost:5180/"
set "PROFILE=%TEMP%\kinetik-sync-p1"

REM --- 1. Start the KinetikCircle dev server (5180) if not already up ---
netstat -ano | find ":5180" | find "LISTENING" >nul
if errorlevel 1 (
  echo Starting KinetikCircle dev server on :5180 ...
  start "KinetikCircle :5180" cmd /k "cd /d "%~dp0apps\kinetik" ^&^& npm run dev"
) else (
  echo KinetikCircle already running on :5180.
)

REM --- 2. Start the LashiraBloom game dev server (5185) if not already up ---
netstat -ano | find ":5185" | find "LISTENING" >nul
if errorlevel 1 (
  echo Starting LashiraBloom game dev server on :5185 ...
  start "LashiraBloom :5185" cmd /k "cd /d "%~dp0apps\lashira\web" ^&^& npm run dev -- --port 5185 --strictPort"
) else (
  echo LashiraBloom game already running on :5185.
)

REM --- 3. Give the servers a moment to boot ---
echo Waiting for servers to boot...
timeout /t 6 /nobreak >nul

REM --- 4. Find a Chromium browser (Edge preferred, Chrome fallback) ---
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined BROWSER (
  echo.
  echo Could not find Edge or Chrome automatically.
  echo Open %URL% yourself in a PRIVATE / InPrivate window instead.
  echo.
  pause
  exit /b 1
)

REM --- 5. Open an ISOLATED browser profile (own login) ---
echo Opening Player 1 window...
start "" "%BROWSER%" --user-data-dir="%PROFILE%" --new-window "%URL%"

echo.
echo ============================================================
echo   PLAYER 1  ==^>  log in as  BAGINDA  (PIN 1234)
echo   Then click the  Bloom  pill to open the farm.
echo   Now run  KinetikPlayer2.bat  and log in as KEYLA.
echo ============================================================
echo.
echo (You can close THIS window; the server windows must stay open.)
timeout /t 8 /nobreak >nul
endlocal
