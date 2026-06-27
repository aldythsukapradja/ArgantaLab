@echo off
REM Double-click to start ALL local dev servers at once.
echo Starting all Arganta local servers...
echo.

REM Arganta Landing (port 5174)
start "Arganta Landing" cmd /k "cd /d "%~dp0apps\landing" && npm install && echo Arganta Landing on http://localhost:5174/ && npm run dev -- --port 5174 --strictPort"

REM KinetikCircle app (port 5180)
start "KinetikCircle" cmd /k "cd /d "%~dp0apps\kinetik" && echo KinetikCircle on http://localhost:5180/ && npm run dev"

REM Circle HQ (port 5273)
start "Circle HQ" cmd /k "cd /d "%~dp0apps\hq" && echo Circle HQ on http://localhost:5273/ && npm run dev"

REM ArgantaLab (port 5176)
start "ArgantaLab" cmd /k "cd /d "%~dp0apps\web" && echo ArgantaLab on http://localhost:5176/ && npm run dev -- --port 5176 --strictPort"

REM Give servers 3 seconds to boot, then open all in browser
timeout /t 3 /nobreak > nul
start "" http://localhost:5174/
start "" http://localhost:5180/
start "" http://localhost:5273/
start "" http://localhost:5176/

echo All servers started. Close the terminal windows to stop them.
pause
