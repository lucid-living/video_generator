#!/bin/bash
# Launch script for local development
# This script starts both backend and frontend in separate terminal windows/tabs

echo "🚀 Starting AI Music Video Generator..."
echo ""

# Check if we're in the project root
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists python3; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start backend
echo "🔧 Starting backend..."
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Start backend in background
echo "🚀 Starting FastAPI backend on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd ..

# Start frontend
echo "🎨 Starting frontend..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing Node.js dependencies..."
    npm install
fi

# Start frontend
echo "🚀 Starting React frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ Both services are starting!"
echo ""
echo "📍 Backend API: http://localhost:8000"
echo "📍 Backend Docs: http://localhost:8000/docs"
echo "📍 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait
