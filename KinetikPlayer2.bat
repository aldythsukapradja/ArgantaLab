@echo off
setlocal
title Kinetik Sync Test - Player 2 (KEYLA)
cd /d "%~dp0"

REM ============================================================
REM  KinetikCircle two-player SYNC test - PLAYER 2
REM
REM  Opens KinetikCircle in a SEPARATE isolated browser profile
REM  so this window has its OWN login (log in as KEYLA). Run
REM  KinetikPlayer1.bat first (or alongside) for BAGINDA. Both
REM  must join the SAME circle to see each other in realtime.
REM
REM  To test the DEPLOYED app instead, set URL below to
REM  https://circle.arganta.app/  (only after the fix is deployed).
REM ============================================================
set "URL=http://localhost:5180/"
set "PROFILE=%TEMP%\kinetik-sync-p2"

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
  echo Open %URL% yourself in a SECOND InPrivate window instead.
  echo.
  pause
  exit /b 1
)

REM --- 5. Open an ISOLATED browser profile (own login) ---
echo Opening Player 2 window...
start "" "%BROWSER%" --user-data-dir="%PROFILE%" --new-window "%URL%"

echo.
echo ============================================================
echo   PLAYER 2  ==^>  log in as  KEYLA  (PIN 1234)
echo   Then click the  Bloom  pill to open the farm.
echo   You should see Player 1 (Baginda) live in the same farm.
echo ============================================================
echo.
echo (You can close THIS window; the server windows must stay open.)
timeout /t 8 /nobreak >nul
endlocal
