@echo off
title LashiraBloom
cd /d "%~dp0apps\lashira\web"

if not exist "node_modules" (
  echo ============================================
  echo  First run - installing LashiraBloom...
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
echo  Starting LashiraBloom - your browser will open automatically.
echo  Leave this window open while you play. Close it to stop the game.
echo.
call npm run dev
pause
