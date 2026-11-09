@echo off
rem bhav-compact.bat - pack the NSE official daily files into one small file for the replay. 1 minute.
cd /d %~dp0
node bhav-compact.mjs
echo.
echo Finished - you can close this window.
pause
