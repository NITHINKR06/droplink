#!/bin/bash
echo ""
echo " DropLink - Starting..."
echo ""

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "YOUR_IP")

# Start backend
echo "[1/2] Starting backend..."
cd backend
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
echo "[2/2] Starting frontend..."
cd frontend
npm install
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo " Backend  : http://localhost:8000"
echo " Frontend : http://localhost:3000"
echo ""
echo " On your mobile, open: http://$LOCAL_IP:3000"
echo " (Make sure PC and mobile are on the same WiFi)"
echo ""
echo " Press Ctrl+C to stop both servers."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
