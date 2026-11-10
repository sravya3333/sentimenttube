@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
)
echo Starting SentimentTube at http://localhost:3000
start "" http://localhost:3000
call npm run dev
pause
