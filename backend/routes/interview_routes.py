"""
Interview Routes Module
Handles interview creation, management, Retell AI integration, and analytics endpoints.
All endpoints except interviewers list require authentication.
"""
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request, Depends, status
from bson import ObjectId
import logging
import google.generativeai as genai

from core.db import db
from core.auth import get_current_user, TokenData, mask_email
from services.interview_service import (
    generate_interview_questions,
    create_interview,
    create_job_interview,
    get_interview_by_id,
    get_user_interviews,
    delete_interview,
    get_all_interviewers,
    get_interviewer_by_id,
    register_retell_call,
    create_interview_response,
    update_interview_response,
    get_interview_responses,
    get_user_interview_history,
    submit_interview_feedback,
    analyze_interview_response
)
from core.models import (
    CreateInterviewRequest, CreateJobInterviewRequest, InterviewResponse,
    GetInterviewsResponse, RegisterCallRequest, RegisterCallResponse,
    InterviewResponseData, GetInterviewHistoryResponse,
    SubmitFeedbackRequest, AnalyzeInterviewRequest,
    UpdateInterviewResponseRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["interviews"])


# Request model for generating interview objective
class GenerateObjectiveRequest(BaseModel):
    job_title: str
    company_name: str
    job_description: str


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/interviewers")
async def get_interviewers():
    """Get all available AI interviewers. Public endpoint."""
    logger.info("Get interviewers request")
    return {"interviewers": get_all_interviewers()}


@router.get("/interviewer/{interviewer_id}")
async def get_interviewer(interviewer_id: int):
    """Get a specific interviewer by ID. Public endpoint."""
    logger.info(f"Get interviewer request: {interviewer_id}")
    interviewer = get_interviewer_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    return interviewer


# ==================== PROTECTED ENDPOINTS ====================

@router.post("/generateInterviewObjective")
async def generate_interview_objective(
    request: GenerateObjectiveRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Generate an interview objective using Gemini AI based on job details.
    Requires authentication.
    """
    logger.info(f"[GEN_OBJECTIVE] Request by: {mask_email(current_user.email)} for: {request.job_title}")
    try:
        prompt = f"""Based on the following job details, generate a concise interview objective (2-3 sentences) 
that describes what skills and topics the mock interview will assess. Focus on key competencies 
needed for the role.

Job Title: {request.job_title}
Company: {request.company_name}
Job Description: {request.job_description[:1500] if request.job_description else 'Not provided'}

Generate ONLY the objective text, no extra formatting or explanation. The objective should:
1. Mention specific technical skills to be assessed
2. Include relevant soft skills for the role
3. Be encouraging and professional in tone

Example format: "This interview will assess your [specific skills] abilities, focusing on [key areas]. 
We'll explore your experience with [technologies/methodologies] and evaluate your [soft skills]."
"""
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        
        objective = response.text.strip()
        logger.info(f"Generated objective: {objective[:100]}...")
        
        return {"objective": objective}
    except Exception as e:
        logger.error(f"Error generating interview objective: {str(e)}")
        default_objective = f"Practice technical and behavioral interview for the {request.job_title} position at {request.company_name}. Focus on demonstrating relevant skills, problem-solving abilities, and cultural fit."
        return {"objective": default_objective}


@router.post("/createInterview", response_model=InterviewResponse)
async def create_interview_endpoint(
    request: CreateInterviewRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Create a new mock interview session.
    Generates questions based on the objective and optional job context.
    Security: User identified via JWT token.
    """
    logger.info(f"[CREATE_INTERVIEW] Request by: {mask_email(current_user.email)}")
    
    try:
        context = ""
        if request.job_description:
            context = f"Job: {request.job_title} at {request.company_name}\n{request.job_description}"
        
        generated = await generate_interview_questions(
            name=request.name,
            objective=request.objective,
            context=context,
            number=request.question_count
        )
        
        interview = await create_interview(
            user_email=current_user.email,
            name=request.name,
            objective=request.objective,
            interviewer_id=request.interviewer_id,
            questions=generated.get("questions", []),
            description=generated.get("description", ""),
            time_duration=request.time_duration,
            job_id=request.job_id,
            job_title=request.job_title,
            company_name=request.company_name
        )
        
        return InterviewResponse(
            id=interview["id"],
            name=interview["name"],
            description=interview["description"],
            objective=interview["objective"],
            interviewer_id=interview["interviewer_id"],
            questions=interview["questions"],
            question_count=interview["question_count"],
            time_duration=interview["time_duration"],
            is_active=interview["is_active"],
            response_count=interview["response_count"],
            job_id=interview.get("job_id"),
            job_title=interview.get("job_title"),
            company_name=interview.get("company_name"),
            created_at=interview["created_at"],
            url=interview["url"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/createJobInterview", response_model=InterviewResponse)
async def create_job_interview_endpoint(
    request: CreateJobInterviewRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Create a mock interview tailored to a specific job listing.
    Security: User identified via JWT token.
    """
    logger.info(f"[CREATE_JOB_INTERVIEW] Request by: {mask_email(current_user.email)}, job: {request.job_title}")
    
    try:
        interview = await create_job_interview(
            user_email=current_user.email,
            job_id=request.job_id,
            job_title=request.job_title,
            company_name=request.company_name,
            job_description=request.job_description,
            interviewer_id=request.interviewer_id,
            question_count=request.question_count,
            time_duration=request.time_duration
        )
        
        return InterviewResponse(
            id=interview["id"],
            name=interview["name"],
            description=interview["description"],
            objective=interview["objective"],
            interviewer_id=interview["interviewer_id"],
            questions=interview["questions"],
            question_count=interview["question_count"],
            time_duration=interview["time_duration"],
            is_active=interview["is_active"],
            response_count=interview["response_count"],
            job_id=interview.get("job_id"),
            job_title=interview.get("job_title"),
            company_name=interview.get("company_name"),
            created_at=interview["created_at"],
            url=interview["url"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating job interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interviews", response_model=GetInterviewsResponse)
async def get_user_interviews_endpoint(current_user: TokenData = Depends(get_current_user)):
    """Get all interviews for the authenticated user."""
    logger.info(f"[GET_INTERVIEWS] Request by: {mask_email(current_user.email)}")
    try:
        interviews = await get_user_interviews(current_user.email)
        return GetInterviewsResponse(
            interviews=[
                InterviewResponse(
                    id=i["id"],
                    name=i["name"],
                    description=i.get("description", ""),
                    objective=i["objective"],
                    interviewer_id=i["interviewer_id"],
                    questions=i["questions"],
                    question_count=i["question_count"],
                    time_duration=i["time_duration"],
                    is_active=i["is_active"],
                    response_count=i["response_count"],
                    job_id=i.get("job_id"),
                    job_title=i.get("job_title"),
                    company_name=i.get("company_name"),
                    created_at=i["created_at"],
                    url=i["url"]
                )
                for i in interviews
            ]
        )
    except Exception as e:
        logger.error(f"Error getting interviews: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interview/{interview_id}")
async def get_interview_endpoint(
    interview_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get a specific interview by ID. Validates ownership."""
    logger.info(f"[GET_INTERVIEW] Request by: {mask_email(current_user.email)}, id: {interview_id}")
    try:
        interview = await get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Security: Check ownership (interview should belong to current user)
        # This requires interview to have user_email field
        if interview.get("user_email") and interview["user_email"].lower() != current_user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own interviews"
            )
        
        return interview
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/interview/{interview_id}")
async def delete_interview_endpoint(
    interview_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete an interview. Validates ownership."""
    logger.info(f"[DELETE_INTERVIEW] Request by: {mask_email(current_user.email)}, id: {interview_id}")
    try:
        # First check ownership
        interview = await get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        if interview.get("user_email") and interview["user_email"].lower() != current_user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own interviews"
            )
        
        success = await delete_interview(interview_id)
        if not success:
            raise HTTPException(status_code=404, detail="Interview not found")
        return {"message": "Interview deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/registerCall", response_model=RegisterCallResponse)
async def register_call_endpoint(
    request: RegisterCallRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Register a call with Retell AI for voice interview.
    Returns call_id and access_token needed to start the voice call.
    Security: User identified via JWT token.
    """
    logger.info(f"[REGISTER_CALL] Request by: {mask_email(current_user.email)}, interview: {request.interview_id}")
    
    try:
        # Get interview details
        interview = await get_interview_by_id(request.interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Get user profile for resume context
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        # Build candidate resume context
        resume_context = ""
        if user:
            resume_parts = []
            if user.get("profile_summary"):
                resume_parts.append(f"Profile: {user.get('profile_summary')}")
            if user.get("skills"):
                resume_parts.append(f"Skills: {', '.join(user.get('skills', []))}")
            if user.get("experience"):
                exp_text = "; ".join(user.get("experience", [])[:3])
                resume_parts.append(f"Experience: {exp_text}")
            if user.get("education"):
                edu_text = "; ".join(user.get("education", [])[:2])
                resume_parts.append(f"Education: {edu_text}")
            resume_context = " | ".join(resume_parts)
        
        # Build questions list
        questions = interview.get("questions", [])
        questions_list = []
        for i, q in enumerate(questions, 1):
            question_text = q.get('question', '') if isinstance(q, dict) else str(q)
            questions_list.append(f"{i}. {question_text}")
        questions_text = "\n".join(questions_list)
        
        # Build job context
        job_title = interview.get("job_title", "")
        company_name = interview.get("company_name", "")
        time_duration = interview.get("time_duration", "10")
        
        # Build the objective with full context
        base_objective = interview.get("objective", "Assess the candidate's skills and experience")
        
        job_context_str = ""
        if job_title and company_name:
            job_context_str = f"for the {job_title} role at {company_name}"
        elif job_title:
            job_context_str = f"for the {job_title} role"
        
        # Build realistic interview objective
        full_objective = f"""{base_objective}

INTERVIEW FLOW:
1. WARM-UP: Start with a friendly greeting. Introduce yourself briefly, thank them for their time, and ask a simple ice-breaker like "How are you doing today?" or "Tell me a bit about yourself"
2. TRANSITION: After the warm-up, naturally transition into the interview questions
3. QUESTIONING: Ask questions from the list one at a time. Listen actively. Ask 1-2 follow-ups if needed, then move on
4. FEEDBACK: If an answer is unclear or incorrect, gently probe deeper or offer a hint. Don't just accept vague answers
5. WRAP-UP: After all questions, ask if they have questions for you, then thank them and end professionally

INTERVIEWER BEHAVIOR:
- Be warm but professional, like a real hiring manager
- Use the candidate's name occasionally
- React naturally: "That's interesting", "I see", "Good point"
- If answer is weak/wrong: probe with "Can you elaborate?" or "What if [scenario]?" - don't just move on
- Acknowledge good answers briefly before moving on
- Keep responses concise - this is about THEM, not you

{f"Context: This is {job_context_str}. " if job_context_str else ""}Candidate: {resume_context if resume_context else "Background not provided"}

RULES: {len(questions)} questions total. Max 2 follow-ups per question. Cover ALL questions. Stay on topic."""

        # IMPORTANT: Variable names MUST match the placeholders in the Retell agent prompt
        dynamic_data = {
            "mins": time_duration,
            "name": request.user_name,
            "objective": full_objective,
            "questions": questions_text,
            "candidate_name": request.user_name,
            "job_title": job_title,
            "company_name": company_name,
            "total_questions": str(len(questions)),
            "candidate_background": resume_context,
        }
        
        print(f"\n[REGISTER_CALL] ========== RETELL CALL REGISTRATION ==========")
        print(f"[REGISTER_CALL] Interview: {interview.get('name')}")
        print(f"[REGISTER_CALL] Candidate: {request.user_name}")
        print(f"[REGISTER_CALL] Duration: {time_duration} mins")
        print(f"[REGISTER_CALL] Job: {job_title} at {company_name}" if job_title else "[REGISTER_CALL] Generic interview")
        print(f"[REGISTER_CALL] Total Questions: {len(questions)}")
        print(f"[REGISTER_CALL] ================================================\n")
        
        result = await register_retell_call(
            interviewer_id=request.interviewer_id,
            dynamic_data=dynamic_data
        )
        
        # Create interview response record
        await create_interview_response(
            interview_id=request.interview_id,
            name=request.user_name,
            email=current_user.email,
            call_id=result.get("call_id", "")
        )
        
        return RegisterCallResponse(
            call_id=result.get("call_id", ""),
            access_token=result.get("access_token", "")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering call: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateInterviewResponse")
async def update_interview_response_endpoint(
    request: UpdateInterviewResponseRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Update an interview response (e.g., mark as ended, update duration)."""
    logger.info(f"[UPDATE_RESPONSE] Request by: {mask_email(current_user.email)}, call: {request.call_id}")
    try:
        updates = {}
        if request.is_ended is not None:
            updates["is_ended"] = request.is_ended
        if request.duration is not None:
            updates["duration"] = request.duration
        if request.tab_switch_count is not None:
            updates["tab_switch_count"] = request.tab_switch_count
        
        success = await update_interview_response(request.call_id, updates)
        if not success:
            raise HTTPException(status_code=404, detail="Response not found")
        return {"message": "Response updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating response: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interviewHistory", response_model=GetInterviewHistoryResponse)
async def get_interview_history_endpoint(current_user: TokenData = Depends(get_current_user)):
    """Get the authenticated user's interview practice history with analytics."""
    logger.info(f"[GET_HISTORY] Request by: {mask_email(current_user.email)}")
    try:
        responses = await get_user_interview_history(current_user.email)
        return GetInterviewHistoryResponse(
            responses=[
                InterviewResponseData(
                    id=r["id"],
                    interview_id=r["interview_id"],
                    name=r["name"],
                    email=r["email"],
                    call_id=r["call_id"],
                    candidate_status=r.get("candidate_status", "pending"),
                    duration=r.get("duration", 0),
                    is_analysed=r.get("is_analysed", False),
                    is_ended=r.get("is_ended", False),
                    created_at=r["created_at"],
                    analytics=r.get("analytics"),
                    interview_name=r.get("interview_name"),
                    job_title=r.get("job_title"),
                    company_name=r.get("company_name")
                )
                for r in responses
            ]
        )
    except Exception as e:
        logger.error(f"Error getting interview history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interviewResponses/{interview_id}")
async def get_interview_responses_endpoint(
    interview_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get all responses for a specific interview. Validates ownership."""
    logger.info(f"[GET_RESPONSES] Request by: {mask_email(current_user.email)}, interview: {interview_id}")
    try:
        # First verify ownership of the interview
        interview = await get_interview_by_id(interview_id)
        if interview and interview.get("user_email"):
            if interview["user_email"].lower() != current_user.email.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view responses for your own interviews"
                )
        
        responses = await get_interview_responses(interview_id)
        return {"responses": responses}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting interview responses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyzeInterview")
async def analyze_interview_endpoint(
    request: AnalyzeInterviewRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Analyze an interview recording and generate insights."""
    logger.info(f"[ANALYZE] Request by: {mask_email(current_user.email)}, call: {request.call_id}")
    try:
        analytics = await analyze_interview_response(request.call_id)
        if "error" in analytics:
            raise HTTPException(status_code=400, detail=analytics["error"])
        return analytics
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submitInterviewFeedback")
async def submit_feedback_endpoint(
    request: SubmitFeedbackRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Submit feedback for an interview experience."""
    logger.info(f"[SUBMIT_FEEDBACK] Request by: {mask_email(current_user.email)}, interview: {request.interview_id}")
    
    try:
        feedback_id = await submit_interview_feedback(
            interview_id=request.interview_id,
            email=current_user.email,
            feedback=request.feedback,
            satisfaction=request.satisfaction
        )
        return {"message": "Feedback submitted successfully", "feedback_id": feedback_id}
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WEBHOOK (No Auth - uses Retell signature) ====================

@router.post("/retellWebhook")
async def retell_webhook(request: Request):
    """
    Webhook endpoint for Retell AI to send call events.
    Note: In production, verify Retell webhook signature for security.
    """
    logger.info("Retell webhook received")
    try:
        body = await request.json()
        event_type = body.get("event")
        call_id = body.get("call_id")
        
        logger.info(f"Retell webhook event: {event_type} for call: {call_id}")
        
        if event_type == "call_ended":
            await update_interview_response(call_id, {
                "is_ended": True,
                "duration": body.get("duration", 0)
            })
        
        elif event_type == "call_analyzed":
            await update_interview_response(call_id, {
                "details": body,
                "is_analysed": True
            })
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Error processing Retell webhook: {str(e)}")
        return {"status": "error", "message": str(e)}
