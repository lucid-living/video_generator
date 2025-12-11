"""
FastAPI application entry point.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
from pathlib import Path

from app.api import planning, assets, generation, webhooks

# Load environment variables
# Try to load from root directory .env.local first, then .env, then backend/.env
root_dir = Path(__file__).parent.parent.parent  # Go up from backend/app/main.py to project root
env_local = root_dir / ".env.local"
env_file = root_dir / ".env"
backend_env = root_dir / "backend" / ".env"

if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)
elif backend_env.exists():
    load_dotenv(backend_env)
else:
    # Fallback to default behavior (looks in current directory)
    load_dotenv()

app = FastAPI(
    title="AI Music Video Generator API",
    description="API for generating branded music videos from text prompts",
    version="1.0.0",
)

# CORS configuration
cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for validation errors to provide better error messages.
    """
    errors = exc.errors()
    error_details = []
    for error in errors:
        error_details.append({
            "field": ".".join(str(loc) for loc in error.get("loc", [])),
            "message": error.get("msg", "Validation error"),
            "type": error.get("type", "unknown")
        })
    
    print(f"Validation error: {error_details}")
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": "Validation error",
            "errors": error_details
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler for unexpected errors.
    """
    import traceback
    error_trace = traceback.format_exc()
    print(f"Unexpected error: {error_trace}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__
        }
    )


# Include routers
app.include_router(planning.router)
app.include_router(assets.router)
app.include_router(generation.router)
app.include_router(webhooks.router)


@app.get("/")
async def root():
    """
    Root endpoint.

    Returns:
        dict: API information
    """
    return {
        "message": "AI Music Video Generator API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        dict: Health status
    """
    return {"status": "healthy"}


