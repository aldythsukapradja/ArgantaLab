@echo off
setlocal
REM Double-click to start the LOCAL ComfyUI image server (NVIDIA, port 8188).
REM The server lives OUTSIDE this repo at C:\ComfyUI (installed by
REM tools\comfyui\install-comfyui.ps1). This launcher only starts it with
REM VRAM flags tuned for the RTX 3070 Ti Laptop (8GB).
title ComfyUI local server

set "COMFY=C:\ComfyUI\ComfyUI_windows_portable"

if not exist "%COMFY%\run_nvidia_gpu.bat" (
  echo ERROR: ComfyUI is not installed at %COMFY%.
  echo Run the installer first:
  echo   powershell -ExecutionPolicy Bypass -File "%~dp0tools\comfyui\install-comfyui.ps1"
  echo.
  pause
  exit /b 1
)

echo Starting ComfyUI on http://127.0.0.1:8188 ...
echo (Close this window to stop the server.)
echo.
start "" http://127.0.0.1:8188

cd /d "%COMFY%"
REM --normalvram is fine for 8GB with SD1.5. If you hit out-of-memory on SDXL or
REM batches, change --normalvram to --lowvram below.
REM --enable-cors-header lets the HQ panel (served on another localhost port)
REM call this server from the browser. Localhost-only, so this is safe.
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --normalvram --listen 127.0.0.1 --port 8188 --enable-cors-header "*"

pause
endlocal
