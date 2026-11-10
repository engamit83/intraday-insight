@echo off
REM setup-watchdog.bat - run ONCE. Creates the Windows task "IntradayFeed-Watchdog": every 5 minutes, weekdays 09:00-15:30,
REM runs feed-watchdog.bat (starts or restarts the feed if it is not running; does nothing on holidays/weekends).
REM Undo: schtasks /Delete /TN "IntradayFeed-Watchdog" /F
cd /d "%~dp0"
if not exist logs mkdir logs
schtasks /Create /F /TN "IntradayFeed-Watchdog" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 09:00 /RI 5 /DU 06:30 /TR "\"%~dp0feed-watchdog.bat\"" > logs\setup-watchdog.txt 2>&1
powershell -NoProfile -Command "$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; try { Set-ScheduledTask -TaskName 'IntradayFeed-Watchdog' -Settings $s -ErrorAction Stop | Out-Null; 'settings OK' } catch { 'settings FAILED ' + $_.Exception.Message }" >> logs\setup-watchdog.txt 2>&1
schtasks /Query /TN "IntradayFeed-Watchdog" /V /FO LIST | findstr /I "TaskName Status Repeat Next" >> logs\setup-watchdog.txt 2>&1
type logs\setup-watchdog.txt
echo.
echo Done - Claude reads logs\setup-watchdog.txt. Press any key to close.
pause >nul
