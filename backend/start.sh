#!/bin/bash
# Startup script for Railway/Render deployment
# Reads PORT environment variable and starts uvicorn

PORT=${PORT:-8000}
echo "Starting uvicorn on port $PORT"
uvicorn app.main:app --host 0.0.0.0 --port $PORT
