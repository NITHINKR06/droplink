@echo off
echo.
echo  DropLink - Starting...
echo.

:: Start backend
echo [1/2] Starting backend server...
cd backend
start "DropLink Backend" cmd /k "pip install -r requirements.txt -q && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

:: Wait a moment
timeout /t 3 /nobreak >nul

:: Build and serve frontend
echo [2/2] Starting frontend...
cd frontend
start "DropLink Frontend" cmd /k "npm install && npm start"
cd ..

echo.
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:3000
echo.
echo  On your mobile, open: http://YOUR_PC_IP:3000
echo  Find your IP with: ipconfig
echo.
pause
