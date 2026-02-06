# Dockerfile for FastAPI backend
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/

# Copy startup script
COPY backend/start.sh ./backend/start.sh
RUN chmod +x ./backend/start.sh

# Set working directory to backend
WORKDIR /app/backend

# Expose port (Railway/Render will set PORT env var)
EXPOSE 8000

# Run the application using startup script
# Use shell form to properly expand PORT environment variable in the script
CMD ["sh", "-c", "./start.sh"]

