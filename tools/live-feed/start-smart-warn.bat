@echo off
REM start-smart-warn.bat - starts the smart exit warning (alert only) in its own window. Safe to run any time during the day.
cd /d "%~dp0"
start "INTRADAY-SMARTWARN" /min cmd /c node smart-watch.mjs
