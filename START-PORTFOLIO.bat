@echo off
cd /d "%~dp0"
echo Starting the portfolio at http://localhost:4173 ...
start "" "http://localhost:4173"
node server.js
pause
