"""
FastAPI application entry point.
"""

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
import os
from pathlib import Path

from app.api import planning, assets, generation, webhooks, learning

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
cors_origins_env = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
)

# Parse CORS origins: split by comma, strip whitespace, remove trailing slashes, filter out empty strings
cors_origins = [
    origin.strip().rstrip("/")  # Remove trailing slashes for consistent matching
    for origin in cors_origins_env.split(",") 
    if origin.strip()
]

# Log CORS configuration for debugging (don't log in production if sensitive)
if cors_origins:
    print(f"CORS configured with {len(cors_origins)} allowed origin(s)")
    for origin in cors_origins:
        print(f"  - {origin}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


class CORSPreflightMiddleware(BaseHTTPMiddleware):
    """
    Middleware to explicitly handle OPTIONS preflight requests and ensure CORS headers are set.
    This runs before CORSMiddleware to catch OPTIONS requests.
    """
    async def dispatch(self, request: Request, call_next):
        # Handle OPTIONS preflight requests explicitly
        if request.method == "OPTIONS":
            origin = request.headers.get("origin")
            if origin:
                # Normalize origin (remove trailing slash) for comparison
                normalized_origin = origin.rstrip("/")
                # Check if normalized origin matches any allowed origin (also normalized)
                if normalized_origin in cors_origins:
                    print(f"CORS Preflight: Handling OPTIONS request from {origin}")
                    response = JSONResponse(
                        status_code=200,
                        content={}
                    )
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
                    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
                    response.headers["Access-Control-Max-Age"] = "3600"
                    return response
                else:
                    print(f"CORS Preflight: WARNING - Origin {origin} (normalized: {normalized_origin}) not in allowed origins: {cors_origins}")
        
        return await call_next(request)


class CORSDebugMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log CORS-related information for debugging.
    """
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        if origin:
            normalized_origin = origin.rstrip("/")
            print(f"CORS Debug: Request from origin: {origin} (normalized: {normalized_origin})")
            print(f"CORS Debug: Allowed origins: {cors_origins}")
            if normalized_origin in cors_origins:
                print(f"CORS Debug: ✅ Origin {origin} is allowed")
            else:
                print(f"CORS Debug: WARNING - Origin {origin} (normalized: {normalized_origin}) not in allowed origins list")
                print(f"CORS Debug: This will cause CORS errors!")
        return await call_next(request)


# Add CORS preflight middleware first (runs last, so handles OPTIONS before other middleware)
app.add_middleware(CORSPreflightMiddleware)
# Add CORS debug middleware (always enabled to help debug CORS issues)
app.add_middleware(CORSDebugMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for validation errors to provide better error messages.
    Ensures CORS headers are included in error responses.
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
    
    # Get origin from request headers
    origin = request.headers.get("origin")
    
    # Create response with CORS headers
    response = JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": "Validation error",
            "errors": error_details
        }
    )
    
    # Add CORS headers if origin is in allowed origins (normalize for comparison)
    if origin:
        normalized_origin = origin.rstrip("/")
        if normalized_origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handler for HTTPException to ensure CORS headers are included.
    """
    # Get origin from request headers
    origin = request.headers.get("origin")
    
    # Create response with CORS headers
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    
    # Add CORS headers if origin is in allowed origins (normalize for comparison)
    if origin:
        normalized_origin = origin.rstrip("/")
        if normalized_origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
        else:
            print(f"CORS Warning: Origin {origin} (normalized: {normalized_origin}) not in allowed origins: {cors_origins}")
    
    return response


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler for unexpected errors.
    Ensures CORS headers are included in error responses.
    """
    import traceback
    error_trace = traceback.format_exc()
    print(f"Unexpected error: {error_trace}")
    
    # Get origin from request headers
    origin = request.headers.get("origin")
    
    # Create response with CORS headers
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__
        }
    )
    
    # Add CORS headers if origin is in allowed origins (normalize for comparison)
    if origin:
        normalized_origin = origin.rstrip("/")
        if normalized_origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


# Include routers
app.include_router(planning.router)
app.include_router(assets.router)
app.include_router(generation.router)
app.include_router(webhooks.router)
app.include_router(learning.router)


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


