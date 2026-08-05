@echo off
REM ArgantaEnergy — launch the canonical COSMO UI. Click to run.
REM
REM Two things used to break this:
REM   1. the browser was opened BEFORE `npm run dev`, so it hit a dead port while Vite
REM      was still booting and showed "can't connect"
REM   2. vite.config sets strictPort:true, so if an earlier dev server is still holding
REM      5279 the new one EXITS with an error instead of picking another port — and the
REM      already-opened browser then pointed at nothing
REM
REM So: reuse a server that is already up, and otherwise wait for the port to answer
REM before opening the browser.
REM
REM NOTE the probe targets 'localhost', not '127.0.0.1'. Node 17+ resolves localhost to
REM IPv6 first, so Vite binds ::1 and never listens on IPv4 — probing 127.0.0.1
REM reported the port CLOSED while the server was plainly serving.
setlocal
set PORT=5279
set URL=http://localhost:%PORT%/

cd /d "%~dp0apps\energy"

REM --- is a server already running on this port? -----------------------------
powershell -NoProfile -Command ^
  "try { $c = New-Object Net.Sockets.TcpClient('localhost', %PORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  echo ArgantaEnergy is already running on %URL%
  echo Opening the browser. This window can be closed.
  start "" %URL%
  timeout /t 2 >nul
  exit /b 0
)

echo Starting ArgantaEnergy dev server on %URL%
echo (Leave this window open. Close it to stop the server.)
echo.

REM --- open the browser only once the port actually answers ------------------
REM Runs hidden alongside the server; gives up after ~60s so it can never hang.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command ^
  "$n=0; while ($n -lt 120) { try { $c = New-Object Net.Sockets.TcpClient('localhost', %PORT%); $c.Close(); Start-Process '%URL%'; break } catch { Start-Sleep -Milliseconds 500; $n++ } }"

call npm run dev

REM If we reach here the server stopped. Say why rather than closing instantly.
echo.
echo The dev server has stopped. If it exited straight away, port %PORT% was probably
echo still held by a previous run — close that window, then launch again.
pause
endlocal
