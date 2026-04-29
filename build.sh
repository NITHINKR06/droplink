#!/bin/bash
# DropLink - Build script
# Compiles React frontend and places it inside backend/static/
# Run this once before deploying

set -e

echo ""
echo "⬡ DropLink Build Script"
echo "========================"
echo ""

# Build frontend
echo "[1/2] Installing frontend dependencies..."
cd frontend
npm install

echo "[2/2] Building React app..."
npm run build

echo ""
echo "Copying build to backend/static/..."
cd ..
rm -rf backend/static
cp -r frontend/build backend/static

echo ""
echo "✓ Build complete!"
echo ""
echo "Your deploy folder is: backend/"
echo ""
echo "To run locally:"
echo "  cd backend && uvicorn main:app --host 0.0.0.0 --port 8000"
echo ""
echo "To deploy to Railway/Render:"
echo "  Push the entire project to GitHub, then:"
echo "  - Set root directory: backend"
echo "  - Build command:      (leave blank, static folder is pre-built)"
echo "  - Start command:      uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo ""
