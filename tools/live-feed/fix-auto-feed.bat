@echo off
REM fix-auto-feed.bat - run ONCE (double-click). Makes the 09:00 feed start reliable (owner "do it" 29 Oct 17:36):
REM   - starts as soon as possible if 09:00 was missed (laptop asleep / locked)
REM   - also runs on battery, and does not stop if the laptop switches to battery
REM   - wakes the laptop at 09:00 to start the feed
REM Changes ONLY our two "IntradayFeed" tasks. Result is written to logs\fix-auto-feed.txt.
cd /d "%~dp0"
if not exist logs mkdir logs
powershell -NoProfile -ExecutionPolicy Bypass -Command "$o=@(); $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 8); foreach($n in 'IntradayFeed-Start-0900','IntradayFeed-Stop-1540'){ try { Set-ScheduledTask -TaskName $n -Settings $s -ErrorAction Stop | Out-Null; $t=Get-ScheduledTask -TaskName $n; $o += ('{0}: OK  battery-blocked={1}  start-if-missed={2}  wake-laptop={3}' -f $n,$t.Settings.DisallowStartIfOnBatteries,$t.Settings.StartWhenAvailable,$t.Settings.WakeToRun) } catch { $o += ('{0}: FAILED {1}' -f $n,$_.Exception.Message) } }; $o | Tee-Object -FilePath 'logs\fix-auto-feed.txt'"
echo.
echo Done. Expected: OK, battery-blocked=False, start-if-missed=True, wake-laptop=True. Press any key to close.
pause >nul
