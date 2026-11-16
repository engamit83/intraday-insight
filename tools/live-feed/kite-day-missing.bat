@echo off
title ZERODHA-MISSING-DAYS
rem kite-day-missing.bat - saves Zerodha 1-minute candles for the market days our feed missed (record only). Zerodha keeps no past ticks.
cd /d %~dp0
node kite-day.mjs 2026-11-02 2026-11-03 2026-11-04 2026-11-05 2026-11-10 2026-11-11 2026-11-13 2026-11-16
echo.
echo Done - Claude reads data\kite\progress.log. Press any key to close.
pause >nul
