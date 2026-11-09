@echo off
rem global-history.bat - download US/Asia/Europe markets, crude, gold, USD/INR, US yields history since 2015. Takes 1 minute.
cd /d %~dp0
node global-history.mjs
echo.
echo Finished - you can close this window.
pause
