@echo off
rem master-search.bat - find the India VIX scrip code in Sharekhan master list (needs today Sharekhan login)
cd /d %~dp0
node master-search.mjs VIX
pause
