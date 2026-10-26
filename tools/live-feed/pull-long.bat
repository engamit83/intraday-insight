@echo off
title INTRADAY-LONG-HISTORY
cd /d %~dp0
echo Pulling long Sharekhan history (daily, 60-min, 30-min, 15-min) - about 20-40 minutes. Do not close.
node pull-run.mjs daily 60minute 30minute 15minute
echo Done. You can close this window.
pause
