@echo off
REM feed-watchdog.bat - run by Windows every 5 minutes on weekdays 09:00-15:30 (owner 10 Nov: "if feed dnt start for working day it shd keep on
REM detecting and trying till market ends, automatically; holidays and weekends feed shd not start").
REM   holiday (data\nse-holidays.json) / weekend / outside 08:58-15:28 -> nothing
REM   no feed program and no feed loop                -> start the feed (auto-feed.bat)
REM   feed program there but today's log silent > 4 min -> hung: stop it (the auto-feed loop restarts it; if no loop, start one)
REM Finds the feed by its program (node ... feed.mjs), not by window title (works inside Windows Terminal too). Log: logs\watchdog-DAY.txt
cd /d "%~dp0"
if not exist logs mkdir logs
for /f "usebackq delims=" %%R in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Get-Date; $day=$d.ToString('yyyy-MM-dd'); $h=@(); try{ $h=Get-Content 'data\nse-holidays.json' -Raw | ConvertFrom-Json }catch{}; $t=$d.TimeOfDay; if([int]$d.DayOfWeek -lt 1 -or [int]$d.DayOfWeek -gt 5 -or $h -contains $day -or $t -lt [timespan]'08:58:00' -or $t -gt [timespan]'15:28:00'){ 'SKIP' } else { $p=Get-CimInstance Win32_Process; $node=$p | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*feed.mjs*' }; $loop=$p | Where-Object { $_.Name -eq 'cmd.exe' -and ($_.CommandLine -like '*auto-feed.bat*' -or $_.CommandLine -like '*start-feed.bat*') }; $log='logs\feed-'+$day+'.log'; if(-not $node -and -not $loop){ 'START' } elseif($node -and (Test-Path $log) -and ((Get-Date)-(Get-Item $log).LastWriteTime).TotalMinutes -gt 4){ $node | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; if($loop){ 'HUNG-LOOP' } else { 'HUNG' } } else { 'OK' } }"`) do set R=%%R
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd')"`) do set DAY=%%D
echo [%date% %time%] check: %R%>> "logs\watchdog-%DAY%.txt"
if "%R%"=="START" (
  echo [%date% %time%] feed not running - starting it>> "logs\watchdog-%DAY%.txt"
  start "" /min "%~dp0auto-feed.bat"
)
if "%R%"=="HUNG-LOOP" echo [%date% %time%] feed silent over 4 minutes - stopped it, the auto-feed loop restarts it>> "logs\watchdog-%DAY%.txt"
if "%R%"=="HUNG" (
  echo [%date% %time%] feed silent over 4 minutes - stopped it and started it again>> "logs\watchdog-%DAY%.txt"
  timeout /t 3 /nobreak >nul
  start "" /min "%~dp0auto-feed.bat"
)
exit /b
