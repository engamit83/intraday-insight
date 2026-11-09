@echo off
rem news-history.bat - download NSE company news history 2022..today (announcements, results, board meetings, bulk/block deals, ban list, delivery %). Takes 1-3 hours. Safe to re-run.
cd /d %~dp0
node news-history.mjs %1 %2
echo.
echo Finished - you can close this window.
pause
