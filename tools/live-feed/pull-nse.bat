@echo off
rem pull-nse.bat - save NSE end-of-day data (delivery %, ban list, circuit bands, bulk/block deals, results calendar, FII/DII) to data\nse\DATE\
cd /d %~dp0
node eod-nse.mjs %1
