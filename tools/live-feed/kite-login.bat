@echo off
rem kite-login.bat - log in to Zerodha once (you type your own password/OTP in the browser). Needed before kite-history.bat.
cd /d %~dp0
node kite-login.mjs
pause
