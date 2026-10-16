@echo off
REM setup-auto-feed.bat - run ONCE (double-click). Sets up the automatic feed:
REM   1) weekdays 09:00  -> start the feed (auto-feed.bat)
REM   2) after you sign in to Windows -> start the feed if it is market hours
REM   3) weekdays 15:40  -> stop the feed (stop-feed.bat)
REM To undo: open Task Scheduler and delete the two "IntradayFeed" tasks, and delete
REM "intraday-auto-feed.bat" from your Startup folder (Win+R, type shell:startup).
cd /d "%~dp0"
echo Setting up the automatic feed...
schtasks /Create /F /TN "IntradayFeed-Start-0900" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 09:00 /TR "%~dp0auto-feed.bat"
schtasks /Create /F /TN "IntradayFeed-Stop-1540" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 15:40 /TR "%~dp0stop-feed.bat"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
(
  echo @echo off
  echo REM Starts the intraday feed 1 minute after sign-in, only if it is market hours.
  echo timeout /t 60 /nobreak ^>nul
  echo start "" "%~dp0auto-feed.bat"
) > "%STARTUP%\intraday-auto-feed.bat"
echo.
echo Checking what was created:
schtasks /Query /TN "IntradayFeed-Start-0900" | find "IntradayFeed"
schtasks /Query /TN "IntradayFeed-Stop-1540" | find "IntradayFeed"
if exist "%STARTUP%\intraday-auto-feed.bat" (echo Sign-in start: OK) else (echo Sign-in start: FAILED)
echo.
echo Done. Take a photo or copy this window and send it to Claude. Press any key to close.
pause >nul
