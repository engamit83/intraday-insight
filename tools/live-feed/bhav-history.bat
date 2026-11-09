@echo off
rem bhav-history.bat - NSE official daily file (official close, traded value, delivery %) for every trading day 2022..today. About 20-40 minutes. Safe to re-run.
cd /d %~dp0
node bhav-history.mjs %1 %2
echo.
echo Finished - you can close this window.
pause
