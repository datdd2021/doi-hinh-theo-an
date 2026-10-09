@echo off
rem Bấm đúp file này để mở app "Đội Hình Theo Ấn" (cần cài Node.js).
rem Cửa sổ đen này là server của app: đóng nó thì app ngừng chạy.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org roi chay lai. & pause & exit /b 1)
start "" http://localhost:5173
node tools\serve.mjs
pause
