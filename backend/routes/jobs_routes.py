"""
Jobs Routes Module
Handles job saving, applying, and retrieval endpoints.
All endpoints require authentication.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from bson import ObjectId
import logging

from core.db import db
from core.auth import get_current_user, TokenData, mask_email
from core.models import (
    GetAppliedJobsResponse, GetAppliedJobsResponseItem,
    GetSavedJobsResponse, GetSavedJobsResponseItem,
    SaveJobRequest, ApplyJobRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["jobs"])


@router.get("/appliedJobs", response_model=GetAppliedJobsResponse)
async def get_applied_jobs(current_user: TokenData = Depends(get_current_user)):
    """
    Get applied jobs for the authenticated user.
    """
    logger.info(f"[GET_APPLIED_JOBS] Request for: {mask_email(current_user.email)}")
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        applied_jobs_data = user.get("applied_jobs", [])
        logger.info(f"[GET_APPLIED_JOBS] Found {len(applied_jobs_data)} applied jobs")
        
        applied_jobs = []
        for job in applied_jobs_data:
            applied_jobs.append(GetAppliedJobsResponseItem(
                job_id=job.get("job_id"),
                job_title=job.get("job_title"),
                company_name=job.get("company_name"),
                job_link=job.get("job_link")
            ))
            
        return GetAppliedJobsResponse(applied_jobs=applied_jobs)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_APPLIED_JOBS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/savedJobs", response_model=GetSavedJobsResponse)
async def get_saved_jobs(current_user: TokenData = Depends(get_current_user)):
    """
    Get saved jobs for the authenticated user.
    """
    logger.info(f"[GET_SAVED_JOBS] Request for: {mask_email(current_user.email)}")
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        saved_jobs_data = user.get("saved_jobs", [])
        logger.info(f"[GET_SAVED_JOBS] Found {len(saved_jobs_data)} saved jobs")
        
        saved_jobs = []
        for job in saved_jobs_data:
            saved_jobs.append(GetSavedJobsResponseItem(
                job_id=job.get("job_id"),
                job_title=job.get("job_title"),
                company_name=job.get("company_name"),
                job_link=job.get("job_link")
            ))
            
        return GetSavedJobsResponse(saved_jobs=saved_jobs)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_SAVED_JOBS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/saveJob")
async def save_job_endpoint(
    request: SaveJobRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Save a job for the authenticated user.
    Security: User identified via JWT token.
    """
    logger.info(f"[SAVE_JOB] Request for: {mask_email(current_user.email)}, job_id: {request.job_id}")
    
    try:
        job_data = {
            "job_id": request.job_id,
            "job_title": request.job_title,
            "company_name": request.company_name,
            "job_link": request.job_link
        }
        
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$addToSet": {"saved_jobs": job_data}}
        )
        logger.info(f"[SAVE_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Job saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SAVE_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/applyJob")
async def apply_job_endpoint(
    request: ApplyJobRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Record job application for the authenticated user.
    Security: User identified via JWT token.
    """
    logger.info(f"[APPLY_JOB] Request for: {mask_email(current_user.email)}, job_id: {request.job_id}")
    
    try:
        job_data = {
            "job_id": request.job_id,
            "job_title": request.job_title,
            "company_name": request.company_name,
            "job_link": request.job_link
        }
        
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$addToSet": {"applied_jobs": job_data}}
        )
        logger.info(f"[APPLY_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Job application recorded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[APPLY_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/savedJob/{job_id}")
async def unsave_job_endpoint(
    job_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Remove a job from user's saved jobs.
    Security: Uses authenticated user's ID directly.
    """
    logger.info(f"[UNSAVE_JOB] Request for: {mask_email(current_user.email)}, job_id: {job_id}")
    try:
        # Remove job by job_id only (more reliable than matching all fields)
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$pull": {"saved_jobs": {"job_id": job_id}}}
        )
        logger.info(f"[UNSAVE_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Job not found in saved jobs")
            
        return {"message": "Job removed from saved jobs"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[UNSAVE_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
