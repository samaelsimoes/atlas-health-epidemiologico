@echo off
cd /d "%~dp0frontend"
if not exist node_modules call npm install --registry=https://registry.npmjs.org
call npm run dev
pause
