"""
Authentication Routes Module
Handles user registration, login, logout, token refresh, and password management.
Implements industry-standard security practices.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Request
from bson import ObjectId
import logging

from db import db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
    TokenData,
    PasswordValidator,
    sanitize_email,
    mask_email,
    rate_limiter,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from models import (
    RegisterRequest, RegisterResponse,
    LoginRequest, LoginResponse,
    RefreshTokenRequest, RefreshTokenResponse,
    ChangePasswordRequest, ChangePasswordResponse,
    LogoutResponse, UserProfileResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


# ==================== REGISTRATION ====================

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    
    - Validates email uniqueness
    - Validates password strength (OWASP guidelines)
    - Hashes password with bcrypt
    - Creates user record
    """
    logger.info(f"[REGISTER] Registration attempt for: {mask_email(request.email)}")
    
    try:
        email = sanitize_email(request.email)
        
        # Check if user already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            logger.warning(f"[REGISTER] Email already registered: {mask_email(email)}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists"
            )
        
        # Validate password strength
        is_valid, error_message = PasswordValidator.validate(request.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        # Hash password
        password_hash = hash_password(request.password)
        
        # Create user document
        now = datetime.now(timezone.utc).isoformat()
        user_doc = {
            "email": email,
            "password_hash": password_hash,
            "name": request.name.strip(),
            "phone": None,
            "location": None,
            "skills": [],
            "experience": [],
            "education": [],
            "profile_summary": None,
            "is_active": True,
            "is_verified": False,  # Email verification can be implemented later
            "is_onboarded": False,  # Set to True after resume upload
            "created_at": now,
            "updated_at": now,
            # Application data
            "chat_history": [],
            "saved_jobs": [],
            "applied_jobs": [],
            "interviews": []
        }
        
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        logger.info(f"[REGISTER] User registered successfully: {mask_email(email)}")
        
        return RegisterResponse(
            message="Registration successful. Please login to continue.",
            user_id=user_id,
            email=email
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[REGISTER] Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )


# ==================== LOGIN ====================

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, req: Request):
    """
    Authenticate user and issue tokens.
    
    - Validates credentials
    - Implements rate limiting for brute force protection
    - Returns access and refresh tokens
    """
    email = sanitize_email(request.email)
    client_ip = req.client.host if req.client else "unknown"
    rate_key = f"{email}:{client_ip}"
    
    logger.info(f"[LOGIN] Login attempt for: {mask_email(email)}")
    
    # Check for rate limiting / lockout
    if rate_limiter.is_locked_out(rate_key):
        remaining = rate_limiter.get_lockout_remaining(rate_key)
        logger.warning(f"[LOGIN] Account locked out: {mask_email(email)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Please try again in {remaining} seconds.",
            headers={"Retry-After": str(remaining)}
        )
    
    try:
        # Find user by email
        user = await db.users.find_one({"email": email})
        
        if not user:
            # Record failed attempt (use same error message to prevent email enumeration)
            rate_limiter.record_attempt(rate_key, False)
            logger.warning(f"[LOGIN] User not found: {mask_email(email)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check if account is active
        if not user.get("is_active", True):
            logger.warning(f"[LOGIN] Inactive account: {mask_email(email)}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled. Please contact support."
            )
        
        # Verify password
        if not verify_password(request.password, user.get("password_hash", "")):
            rate_limiter.record_attempt(rate_key, False)
            logger.warning(f"[LOGIN] Invalid password for: {mask_email(email)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Record successful login
        rate_limiter.record_attempt(rate_key, True)
        
        # Generate tokens
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, email)
        refresh_token = create_refresh_token(user_id, email)
        
        # Update last login timestamp
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Prepare user data (exclude sensitive fields)
        user_data = {
            "email": user.get("email"),
            "name": user.get("name"),
            "phone": user.get("phone"),
            "location": user.get("location"),
            "skills": user.get("skills", []),
            "experience": user.get("experience", []),
            "education": user.get("education", []),
            "profile_summary": user.get("profile_summary"),
            "is_verified": user.get("is_verified", False),
            "is_onboarded": user.get("is_onboarded", False),
            # Include application data
            "chat_history": _serialize_chat_history(user.get("chat_history", [])),
            "saved_jobs": user.get("saved_jobs", []),
            "applied_jobs": user.get("applied_jobs", []),
            "interviews": user.get("interviews", [])
        }
        
        logger.info(f"[LOGIN] Login successful: {mask_email(email)}")
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_data
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again."
        )


def _serialize_chat_history(chat_history: list) -> list:
    """Serialize chat history, converting ObjectIds to strings."""
    serialized = []
    for chat in chat_history:
        serialized_chat = dict(chat)
        if "_id" in serialized_chat:
            serialized_chat["_id"] = str(serialized_chat["_id"])
        serialized.append(serialized_chat)
    return serialized


# ==================== TOKEN REFRESH ====================

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    
    - Validates refresh token
    - Issues new access token
    - Does NOT issue new refresh token (to prevent token theft escalation)
    """
    logger.info("[REFRESH] Token refresh attempt")
    
    try:
        token_data = decode_refresh_token(request.refresh_token)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        # Verify user still exists and is active
        user = await db.users.find_one({"_id": ObjectId(token_data.user_id)})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled"
            )
        
        # Issue new access token
        new_access_token = create_access_token(token_data.user_id, token_data.email)
        
        logger.info(f"[REFRESH] Token refreshed for: {mask_email(token_data.email)}")
        
        return RefreshTokenResponse(
            access_token=new_access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[REFRESH] Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


# ==================== LOGOUT ====================

@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    Logout user.
    
    Note: With stateless JWT, true logout requires client-side token deletion.
    For enhanced security, implement token blacklisting with Redis.
    """
    logger.info(f"[LOGOUT] User logged out: {mask_email(current_user.email)}")
    
    # In a production system with Redis, you would blacklist the token here:
    # await redis.setex(f"blacklist:{token_jti}", token_expiry_seconds, "1")
    
    return LogoutResponse(message="Logged out successfully")


# ==================== PASSWORD CHANGE ====================

@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Change user password.
    
    - Requires current password verification
    - Validates new password strength
    - Updates password hash
    """
    logger.info(f"[CHANGE_PASSWORD] Password change request for: {mask_email(current_user.email)}")
    
    try:
        # Get user from database
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify current password
        if not verify_password(request.current_password, user.get("password_hash", "")):
            logger.warning(f"[CHANGE_PASSWORD] Invalid current password: {mask_email(current_user.email)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Validate new password strength
        is_valid, error_message = PasswordValidator.validate(request.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        # Check new password is different from current
        if verify_password(request.new_password, user.get("password_hash", "")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Hash and update password
        new_password_hash = hash_password(request.new_password)
        
        await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {
                "$set": {
                    "password_hash": new_password_hash,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"[CHANGE_PASSWORD] Password changed successfully: {mask_email(current_user.email)}")
        
        return ChangePasswordResponse(message="Password changed successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHANGE_PASSWORD] Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


# ==================== GET CURRENT USER ====================

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: TokenData = Depends(get_current_user)):
    """
    Get current authenticated user's profile.
    """
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserProfileResponse(
            email=user.get("email"),
            name=user.get("name"),
            phone=user.get("phone"),
            location=user.get("location"),
            skills=user.get("skills", []),
            experience=user.get("experience", []),
            education=user.get("education", []),
            profile_summary=user.get("profile_summary"),
            is_verified=user.get("is_verified", False),
            created_at=user.get("created_at")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_ME] Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )


# ==================== VALIDATE TOKEN ====================

@router.get("/validate")
async def validate_token(current_user: TokenData = Depends(get_current_user)):
    """
    Validate if the current access token is valid.
    Useful for frontend to check authentication status.
    """
    return {
        "valid": True,
        "user_id": current_user.user_id,
        "email": current_user.email
    }
