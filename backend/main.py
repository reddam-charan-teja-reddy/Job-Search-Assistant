"""
Job Search Assistant API - Main Application Entry Point

This is the main FastAPI application that orchestrates all route modules.
The application has been modularized into separate route files for better
maintainability and separation of concerns.

Route Modules:
- auth_routes: Authentication (register, login, logout, token refresh)
- user_routes: User onboarding and profile management
- chat_routes: Chat creation, messaging, and history
- jobs_routes: Job saving, applying, and retrieval
- interview_routes: Interview creation, Retell AI integration, and analytics

Security Features:
- JWT-based authentication with access and refresh tokens
- Password hashing with bcrypt (cost factor 12)
- Rate limiting on login attempts
- CORS protection
- Security headers middleware
"""
import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
import logging
import time

# Load environment variables from .env file
load_dotenv()

# Import route modules
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.chat_routes import router as chat_router
from routes.jobs_routes import router as jobs_router
from routes.interview_routes import router as interview_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== SECURITY MIDDLEWARE ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        
        # Remove server header to hide implementation details
        if "server" in response.headers:
            del response.headers["server"]
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for monitoring and debugging."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log request (mask sensitive paths)
        path = request.url.path
        if "/auth/" in path:
            # Don't log full auth paths for security
            logger.info(
                f"{request.method} {path} - {response.status_code} - {process_time:.3f}s"
            )
        else:
            logger.info(
                f"{request.method} {path} - {response.status_code} - {process_time:.3f}s"
            )
        
        return response


# ==================== APPLICATION SETUP ====================

# Initialize FastAPI app
app = FastAPI(
    title="Job Search Assistant API",
    description="AI-powered job search and interview preparation platform with secure authentication",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Configure CORS middleware
# In production, replace "*" with specific allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["X-Request-ID"],
    max_age=600,  # Cache preflight requests for 10 minutes
)


# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to prevent information leakage."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    # Don't expose internal error details in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again later."}
    )


# ==================== INCLUDE ROUTERS ====================

# Authentication routes (public endpoints for register/login)
app.include_router(auth_router)

# User routes (profile management)
app.include_router(user_router)

# Chat routes (AI chat functionality)
app.include_router(chat_router)

# Jobs routes (job saving and tracking)
app.include_router(jobs_router)

# Interview routes (mock interview functionality)
app.include_router(interview_router)


# ==================== HEALTH CHECK ENDPOINTS ====================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "Job Search Assistant API is running",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "version": "2.0.0"}


# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    # Command to run the app: uvicorn main:app --reload
    uvicorn.run(app, host="0.0.0.0", port=8000)
