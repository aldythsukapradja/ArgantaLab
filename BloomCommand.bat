@echo off
title Bloom Command - Dashboard
cd /d "%~dp0apps\lashira\command"

if not exist "node_modules" (
  echo ============================================
  echo  First run - installing Bloom Command...
  echo  This happens once and may take a minute.
  echo ============================================
  call npm install
  if errorlevel 1 (
    echo.
    echo Install failed. Make sure Node.js is installed ^(https://nodejs.org^).
    pause
    exit /b 1
  )
)

echo.
echo  Starting Bloom Command dashboard - your browser will open automatically.
echo  Sign in with Google (admin) to manage. Leave this window open.
echo.
call npm run dev
pause
