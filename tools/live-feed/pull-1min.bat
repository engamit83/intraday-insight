@echo off
title INTRADAY-TODAY-1MIN
cd /d %~dp0
echo Pulling the last ~7 days of 1-minute candles (fills feed gaps) - about 10 minutes. Do not close.
node pull-run.mjs 1minute
echo Done. You can close this window.
pause
