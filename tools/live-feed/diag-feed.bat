@echo off
REM diag-feed.bat - READ-ONLY check (changes nothing). Double-click once. Writes logs\diag-feed.txt for Claude:
REM   our 3 scheduled tasks (last run, result, next run, conditions) + today's sleep/wake events.
cd /d "%~dp0"
if not exist logs mkdir logs
set OUT=logs\diag-feed.txt
echo === %date% %time% > %OUT%
for %%T in ("IntradayFeed-Start-0900" "IntradayFeed-Watchdog" "IntradayFeed-Stop-1540") do (
  echo. >> %OUT%
  echo ===== %%~T >> %OUT%
  schtasks /Query /TN %%T /V /FO LIST >> %OUT% 2>&1
)
echo. >> %OUT%
echo ===== power settings / last wake >> %OUT%
powercfg /a >> %OUT% 2>&1
powercfg /lastwake >> %OUT% 2>&1
echo. >> %OUT%
echo ===== sleep/wake/boot events since yesterday 18:00 >> %OUT%
powershell -NoProfile -Command "$s=(Get-Date).Date.AddHours(-6); Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$s} -ErrorAction SilentlyContinue | Where-Object { $_.ProviderName -in 'Microsoft-Windows-Kernel-Power','Microsoft-Windows-Power-Troubleshooter','Microsoft-Windows-Kernel-General','EventLog','User32' -and $_.Id -in 1,12,13,41,42,105,107,109,506,507,1074,6005,6006,6008 } | Sort-Object TimeCreated | ForEach-Object { '{0:dd-MM HH:mm:ss}  {1}  id {2}  {3}' -f $_.TimeCreated,$_.ProviderName,$_.Id,(($_.Message -split [char]10)[0]) }" >> %OUT% 2>&1
echo. >> %OUT%
echo ===== task scheduler history today (if enabled) >> %OUT%
powershell -NoProfile -Command "$s=(Get-Date).Date; Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; StartTime=$s} -ErrorAction SilentlyContinue | Where-Object { $_.Message -like '*IntradayFeed*' } | Sort-Object TimeCreated | Select-Object -First 60 | ForEach-Object { '{0:HH:mm:ss}  id {1}  {2}' -f $_.TimeCreated,$_.Id,(($_.Message -split [char]10)[0]) }" >> %OUT% 2>&1
type %OUT%
echo.
echo Done - Claude reads logs\diag-feed.txt. Press any key to close.
pause >nul
