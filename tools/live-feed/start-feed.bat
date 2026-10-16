@echo off
REM start-feed.bat - starts ONE live feed. Double-click to run. Close this window (or run stop-feed.bat) to stop.
REM Stops any earlier feed window first, so two feeds never run together.
taskkill /F /T /FI "WINDOWTITLE eq INTRADAY-FEED*" >/dev/null 2>&1
title INTRADAY-FEED
cd /d "%~dp0"
node feed.mjs
echo.
echo Feed stopped. Press any key to close.
pause >nul
