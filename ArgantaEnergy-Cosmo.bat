@echo off
REM Compatibility launcher — ArgantaEnergy now uses COSMO as its canonical UI.
REM
REM This used to duplicate the launch logic, including the bug where the browser was
REM opened before the dev server existed. Delegating instead, so there is exactly one
REM place that knows how to start the app and only one place to fix.
call "%~dp0ArgantaEnergy-Launch.bat" %*
