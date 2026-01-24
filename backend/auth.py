"""
Authentication & Security Module
Implements industry-standard security practices:
- Password hashing with bcrypt (cost factor 12)
- JWT tokens with RS256 or HS256 signing
- Token refresh mechanism
- Rate limiting ready
- Secure password validation
"""
import os
import secrets
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
import logging

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

# JWT Settings - Use environment variables in production
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # Short-lived access token
REFRESH_TOKEN_EXPIRE_DAYS = 7    # Longer-lived refresh token

# Password hashing context with bcrypt
# Cost factor 12 is recommended for production (takes ~250ms per hash)
# Using bcrypt directly due to passlib compatibility issues with newer bcrypt versions
import bcrypt

def _hash_password_bcrypt(password: str) -> str:
    """Hash password using bcrypt directly."""
    # bcrypt has a 72-byte limit, so truncate if needed
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def _verify_password_bcrypt(plain_password: str, hashed_password: str) -> bool:
    """Verify password using bcrypt directly."""
    try:
        password_bytes = plain_password.encode('utf-8')[:72]
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


# ==================== PASSWORD SECURITY ====================

class PasswordValidator:
    """Validates password strength according to OWASP guidelines."""
    
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    
    @staticmethod
    def validate(password: str) -> Tuple[bool, str]:
        """
        Validate password strength.
        Returns (is_valid, error_message)
        """
        if len(password) < PasswordValidator.MIN_LENGTH:
            return False, f"Password must be at least {PasswordValidator.MIN_LENGTH} characters long"
        
        if len(password) > PasswordValidator.MAX_LENGTH:
            return False, f"Password must be at most {PasswordValidator.MAX_LENGTH} characters long"
        
        # Check for at least one uppercase letter
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        
        # Check for at least one lowercase letter
        if not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        
        # Check for at least one digit
        if not re.search(r'\d', password):
            return False, "Password must contain at least one number"
        
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', password):
            return False, "Password must contain at least one special character"
        
        return True, ""


def hash_password(password: str) -> str:
    """Hash password using bcrypt with automatic salt generation."""
    return _hash_password_bcrypt(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash. Uses constant-time comparison."""
    try:
        return _verify_password_bcrypt(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False


# ==================== JWT TOKEN MANAGEMENT ====================

class TokenData(BaseModel):
    """Data extracted from JWT token."""
    user_id: str
    email: str
    token_type: str = "access"


def create_access_token(user_id: str, email: str) -> str:
    """
    Create a short-lived access token.
    Contains minimal claims to reduce token size.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,  # Subject (user ID)
        "email": email,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),  # Issued at
        "jti": secrets.token_urlsafe(16),   # Unique token ID for revocation
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, email: str) -> str:
    """
    Create a longer-lived refresh token.
    Used to obtain new access tokens without re-authentication.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Decode and validate an access token.
    Returns TokenData if valid, None if invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != "access":
            logger.warning("Invalid token type for access token")
            return None
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            return None
        
        return TokenData(user_id=user_id, email=email, token_type="access")
    
    except JWTError as e:
        logger.warning(f"JWT decode error: {str(e)}")
        return None


def decode_refresh_token(token: str) -> Optional[TokenData]:
    """
    Decode and validate a refresh token.
    Returns TokenData if valid, None if invalid.
    """
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != "refresh":
            logger.warning("Invalid token type for refresh token")
            return None
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            return None
        
        return TokenData(user_id=user_id, email=email, token_type="refresh")
    
    except JWTError as e:
        logger.warning(f"Refresh token decode error: {str(e)}")
        return None


# ==================== AUTHENTICATION DEPENDENCIES ====================

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> TokenData:
    """
    Dependency to get the current authenticated user from JWT token.
    Raises HTTPException if authentication fails.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    token = credentials.credentials
    token_data = decode_access_token(token)
    
    if not token_data:
        raise credentials_exception
    
    return token_data


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[TokenData]:
    """
    Optional authentication dependency.
    Returns TokenData if authenticated, None otherwise.
    Does not raise exception for unauthenticated requests.
    """
    if not credentials:
        return None
    
    token = credentials.credentials
    return decode_access_token(token)


# ==================== SECURITY UTILITIES ====================

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


def sanitize_email(email: str) -> str:
    """Sanitize and normalize email address."""
    return email.lower().strip()


def mask_email(email: str) -> str:
    """Mask email for logging (privacy protection)."""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


# ==================== RATE LIMITING HELPERS ====================

class RateLimitInfo:
    """Simple in-memory rate limit tracking (use Redis in production)."""
    
    def __init__(self):
        self._attempts: dict = {}
        self._lockouts: dict = {}
    
    def record_attempt(self, key: str, success: bool) -> None:
        """Record a login attempt."""
        now = datetime.now(timezone.utc)
        
        if key not in self._attempts:
            self._attempts[key] = []
        
        # Keep only attempts from last 15 minutes
        self._attempts[key] = [
            (t, s) for t, s in self._attempts[key]
            if now - t < timedelta(minutes=15)
        ]
        
        self._attempts[key].append((now, success))
        
        # Check for too many failed attempts
        failed_attempts = sum(1 for _, s in self._attempts[key] if not s)
        if failed_attempts >= 5:
            # Lock out for 15 minutes
            self._lockouts[key] = now + timedelta(minutes=15)
    
    def is_locked_out(self, key: str) -> bool:
        """Check if a key is currently locked out."""
        if key not in self._lockouts:
            return False
        
        if datetime.now(timezone.utc) > self._lockouts[key]:
            del self._lockouts[key]
            return False
        
        return True
    
    def get_lockout_remaining(self, key: str) -> int:
        """Get remaining lockout time in seconds."""
        if key not in self._lockouts:
            return 0
        
        remaining = self._lockouts[key] - datetime.now(timezone.utc)
        return max(0, int(remaining.total_seconds()))


# Global rate limiter instance
rate_limiter = RateLimitInfo()
