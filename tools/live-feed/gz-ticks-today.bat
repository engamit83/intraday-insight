@echo off
title COMPRESS-TODAYS-TICKS
rem gz-ticks-today.bat - makes data\ticks-TODAY.csv.gz (original kept) so Claude can copy the day off the laptop. Record only.
cd /d %~dp0
node gz-ticks.mjs
echo.
echo Done - Claude reads data\gz-ticks.log. Press any key to close.
pause >nul
