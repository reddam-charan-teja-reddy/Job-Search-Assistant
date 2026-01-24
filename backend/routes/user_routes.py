"""
User Routes Module
Handles user onboarding and profile management endpoints.
All endpoints require authentication except onboarding.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends, status
from bson import ObjectId
from PyPDF2 import PdfReader
import io
import logging
import json
import google.generativeai as genai

from core.db import db
from clients.gemini_client import model
from core.auth import get_current_user, TokenData, mask_email
from core.models import (
    UserOnboardingResponse,
    UserProfileUpdateRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["users"])


# ==================== ONBOARDING (No Auth Required) ====================

@router.post("/onboardFileUpload", response_model=UserOnboardingResponse)
async def onboard_user(request: Request):
    """ The resume file is uploaded by the user via frontend and sent to this endpoint 
        for parsing and extracting details.
        1. the file is parsed using pypdf 2
        2. the parsed text is sent to Gemini 2.5 model along with the onboarding response pydantic model
           for extracting details
        3. the response from Gemini is validated using pydantic model and sent back to 
           frontend for confirmation
    """
    content = await request.body()
    if not content.startswith(b'%PDF-'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        prompt = f"""
        Extract the following details from the resume text provided below.
        Ensure the output matches the JSON schema provided and the fields are filled appropriately based on the resume content and what fields are the schema accepting.
        
        Resume Text:
        {text}
        """

        # Hardcoded schema to avoid Pydantic/Gemini compatibility issues
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "location": {"type": "string"},
                "skills": {"type": "array", "items": {"type": "string"}},
                "experience": {"type": "array", "items": {"type": "string"}},
                "profile_summary": {"type": "string"},
                "education": {"type": "array", "items": {"type": "string"}},
                "certificationsAndAchievementsAndAwards": {"type": "array", "items": {"type": "string"}},
                "projects": {"type": "array", "items": {"type": "string"}},
                "about": {"type": "string"}
            },
            "required": ["name", "email", "phone", "location", "skills", "experience", "profile_summary"]
        }

        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=schema
            )
        )
        
        # Clean up the response text if necessary (sometimes it might contain markdown code blocks)
        response_text = response.text
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        return UserOnboardingResponse.model_validate_json(response_text.strip())

    except Exception as e:
        logger.error(f"[ONBOARD] Error parsing resume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PROTECTED ENDPOINTS ====================

@router.post("/updateProfile")
async def update_profile_from_resume(
    user_data: UserOnboardingResponse,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Update user profile with parsed resume data.
    Requires authentication - uses token to identify user.
    """
    logger.info(f"[UPDATE_PROFILE_RESUME] Request for: {mask_email(current_user.email)}")
    try:
        update_data = {
            "name": user_data.name,
            "phone": user_data.phone,
            "location": user_data.location,
            "skills": user_data.skills,
            "experience": user_data.experience,
            "education": user_data.education,
            "profile_summary": user_data.profile_summary,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$set": update_data}
        )
        logger.info(f"[UPDATE_PROFILE_RESUME] DB update - matched: {result.matched_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Profile updated successfully from resume"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[UPDATE_PROFILE_RESUME] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirmOnboardingDetails")
async def confirm_onboarding_details(
    user_data: UserOnboardingResponse,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Confirm onboarding details after resume upload.
    Sets is_onboarded to true and updates profile data.
    """
    logger.info(f"[CONFIRM_ONBOARDING] Request for: {mask_email(current_user.email)}")
    try:
        update_data = {
            "name": user_data.name,
            "phone": user_data.phone,
            "location": user_data.location,
            "skills": user_data.skills,
            "experience": user_data.experience,
            "education": user_data.education,
            "profile_summary": user_data.profile_summary,
            "is_onboarded": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$set": update_data}
        )
        logger.info(f"[CONFIRM_ONBOARDING] DB update - matched: {result.matched_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Onboarding completed successfully", "id": current_user.user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CONFIRM_ONBOARDING] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/updateUserProfile")
async def update_user_profile(
    request: UserProfileUpdateRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Update specific user profile fields.
    Requires authentication - validates that user can only update their own profile.
    """
    logger.info(f"[UPDATE_PROFILE] Request for: {mask_email(current_user.email)}")
    
    # Security: Ensure user can only update their own profile
    if request.email and request.email.lower() != current_user.email.lower():
        logger.warning(f"[UPDATE_PROFILE] Attempted to update another user's profile: {mask_email(request.email)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    try:
        update_data = request.model_dump(exclude_unset=True, exclude={"email"})
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$set": update_data}
        )
        logger.info(f"[UPDATE_PROFILE] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "User profile updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[UPDATE_PROFILE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile")
async def get_user_profile(current_user: TokenData = Depends(get_current_user)):
    """
    Get current user's full profile data.
    Requires authentication.
    """
    logger.info(f"[GET_PROFILE] Request for: {mask_email(current_user.email)}")
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return profile data without sensitive fields
        return {
            "email": user.get("email"),
            "name": user.get("name"),
            "phone": user.get("phone"),
            "location": user.get("location"),
            "skills": user.get("skills", []),
            "experience": user.get("experience", []),
            "education": user.get("education", []),
            "profile_summary": user.get("profile_summary"),
            "is_verified": user.get("is_verified", False),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_PROFILE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/account")
async def delete_account(current_user: TokenData = Depends(get_current_user)):
    """
    Delete user account and all associated data.
    This is a destructive operation that cannot be undone.
    """
    logger.info(f"[DELETE_ACCOUNT] Request for: {mask_email(current_user.email)}")
    try:
        # Delete user document (this cascades to all embedded data)
        result = await db.users.delete_one({"_id": ObjectId(current_user.user_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"[DELETE_ACCOUNT] Account deleted: {mask_email(current_user.email)}")
        return {"message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE_ACCOUNT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
