@echo off
REM auto-feed.bat - starts the live feed ONLY on weekdays between 08:55 and 15:35.
REM Run automatically by Windows (09:00 on weekdays and after you sign in). Safe to double-click too.
REM If the feed stops during market hours (e.g. internet drop) it restarts after 30 seconds.
cd /d "%~dp0"
call :inhours
if errorlevel 1 (
  echo Outside market hours - feed not started.
  timeout /t 10 >nul
  exit /b
)
tasklist /V /FI "IMAGENAME eq cmd.exe" | find /I "INTRADAY-FEED" >nul
if not errorlevel 1 (
  echo Feed is already running - nothing to do.
  timeout /t 10 >nul
  exit /b
)
title INTRADAY-FEED
:run
echo [%date% %time%] Starting feed...
node feed.mjs
call :inhours
if errorlevel 1 goto done
echo Feed stopped during market hours - restarting in 30 seconds...
timeout /t 30 /nobreak >nul
goto run
:done
echo Market closed - feed finished for today.
timeout /t 10 >nul
exit /b

:inhours
powershell -NoProfile -Command "$d=Get-Date; $t=$d.TimeOfDay; if([int]$d.DayOfWeek -ge 1 -and [int]$d.DayOfWeek -le 5 -and $t -ge [timespan]'08:55:00' -and $t -le [timespan]'15:35:00'){exit 0}else{exit 1}"
exit /b %errorlevel%
