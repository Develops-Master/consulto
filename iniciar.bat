@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Necesitas instalar Node.js 22 o superior desde https://nodejs.org & pause & exit /b 1)
start "" http://localhost:3000
node --disable-warning=ExperimentalWarning server\server.js
pause
