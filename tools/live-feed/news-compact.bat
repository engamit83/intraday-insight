@echo off
rem news-compact.bat - pack all downloaded NSE news into one file for Claude. About 1 minute.
cd /d %~dp0
node news-compact.mjs
echo.
echo Finished - you can close this window.
pause
