@echo off
title ZERODHA-HISTORY
rem kite-history.bat - download Zerodha 1-minute history (newest year first). Takes a few hours; can be stopped and started again.
cd /d %~dp0
node kite-history.mjs
pause
