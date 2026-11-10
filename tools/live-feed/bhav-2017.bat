@echo off
rem bhav-2017.bat - NSE official daily files for 2017-2021 (final-exam years). About 20-30 minutes. Safe to re-run.
cd /d %~dp0
node bhav-history.mjs 2017-01-01 2021-12-31
echo.
echo Finished - you can close this window.
pause
