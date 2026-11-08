@echo off
rem kite-bundle.bat - pack each finished year of Zerodha data into 2 files for the analysis side
cd /d %~dp0
node kite-bundle.mjs %1
