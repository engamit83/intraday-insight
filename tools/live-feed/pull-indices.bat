@echo off
title INTRADAY-INDEX-HISTORY
cd /d %~dp0
echo Pulling index history (Nifty, sectors, India VIX: daily, 60/30/15/5/1-minute) - a few minutes. Do not close.
node pull-run.mjs indices daily 60minute 30minute 15minute 5minute 1minute
echo Done. You can close this window.
pause
