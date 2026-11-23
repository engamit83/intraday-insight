@echo off
title NSE-LIVE-NEWS
rem news-live.bat - records NSE announcements + block/bulk deals live until 15:40 (record only, no trading). Owner 23 Nov 14:27.
cd /d %~dp0
node news-live.mjs
echo.
echo News recorder stopped. Press any key to close.
pause >nul
