@echo off
REM stop-feed.bat - stops the live feed window started by start-feed.bat
taskkill /F /T /FI "WINDOWTITLE eq INTRADAY-FEED*"
timeout /t 3 >nul
