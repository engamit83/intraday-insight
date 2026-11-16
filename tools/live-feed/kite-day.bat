@echo off
title ZERODHA-DAY
rem kite-day.bat - saves today's 1-minute candles of our stocks + indices from Zerodha (record only). Needs today's login.
cd /d %~dp0
node kite-day.mjs %*
echo.
echo Done - Claude reads data\kite\progress.log. Press any key to close.
pause >nul
