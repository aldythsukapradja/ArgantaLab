@echo off
REM Double-click to download the SD1.5 checkpoint into ComfyUI Desktop's shared
REM models folder. ~4GB. Safe to re-run (skips if already present).
title Download SD1.5 checkpoint
set "DIR=%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared\models\checkpoints"
if not exist "%DIR%" mkdir "%DIR%"
set "FILE=%DIR%\v1-5-pruned-emaonly.safetensors"

if exist "%FILE%" (
  echo Already downloaded: %FILE%
  echo Nothing to do.
  pause
  exit /b 0
)

echo Downloading SD1.5 (~4GB) into:
echo   %DIR%
echo This can take a while depending on your connection...
echo.
powershell -NoProfile -Command "Start-BitsTransfer -Source 'https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors' -Destination '%FILE%'"

if exist "%FILE%" (
  echo.
  echo DONE -^> %FILE%
) else (
  echo.
  echo Download did not complete. Check your connection and re-run.
)
pause
