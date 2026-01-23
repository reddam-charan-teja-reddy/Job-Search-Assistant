from pydantic import BaseModel, Field
from typing import List, Optional

from jsonschema import ValidationError
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from models import (
    UserOnboardingRequest, UserOnboardingResponse, User,
    ChatHistoryResponse, ChatHistoryResponseItem,
    GetAppliedJobsResponse, GetAppliedJobsResponseItem,
    GetSavedJobsResponse, GetSavedJobsResponseItem,
    SaveJobRequest, ApplyJobRequest, UserProfileUpdateRequest,
    ChatMessageRequest, ChatMessageResponse,
    CreateChatRequest, CreateChatResponse,
    GetChatMessagesRequest, GetChatMessagesResponse,
    SignInRequest, SignInResponse,
    # Interview models
    CreateInterviewRequest, CreateJobInterviewRequest, InterviewResponse,
    GetInterviewsResponse, RegisterCallRequest, RegisterCallResponse,
    CreateInterviewResponseRequest, InterviewResponseData, GetInterviewHistoryResponse,
    SubmitFeedbackRequest, AnalyzeInterviewRequest, InterviewAnalytics,
    UpdateInterviewResponseRequest, InterviewerInfo
)
from bson import ObjectId
import json
from PyPDF2 import PdfReader
import io
import google.generativeai as genai
import logging

from dotenv import load_dotenv
load_dotenv()

from db import db
from gemini_client import model
from chat_service import create_new_chat, process_chat_message, get_chat_messages
# Import interview service
from interview_service import (
    generate_interview_questions,
    create_interview,
    create_job_interview,
    get_interview_by_id,
    get_user_interviews,
    update_interview,
    delete_interview,
    get_all_interviewers,
    get_interviewer_by_id,
    register_retell_call,
    create_interview_response,
    update_interview_response,
    get_response_by_call_id,
    get_interview_responses,
    get_user_interview_history,
    submit_interview_feedback,
    analyze_interview_response
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# user onboarding process

@app.post("/api/onboardFileUpload", response_model=UserOnboardingResponse)
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
        Ensure the output matches the JSON schema provided.
        
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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/signIn", response_model=SignInResponse)
async def sign_in(request: SignInRequest):
    """ Sign in endpoint - checks if user exists by email.
        If user exists, returns their profile data along with saved jobs, applied jobs, and chat history.
        If user doesn't exist, returns exists=False.
    """
    logger.info(f"[SIGN_IN] Sign in request for email: {request.email}")
    try:
        user = await db.users.find_one({"email": request.email})
        logger.info(f"[SIGN_IN] DB query completed. User found: {user is not None}")
        
        if user:
            # User exists, return their profile
            logger.info(f"[SIGN_IN] User found: {user.get('name', 'Unknown')}")
            
            user_profile = UserOnboardingResponse(
                name=user.get("name", ""),
                email=user.get("email", ""),
                phone=user.get("phone", ""),
                location=user.get("location", ""),
                skills=user.get("skills", []),
                experience=user.get("experience", []),
                profile_summary=user.get("profile_summary", ""),
                education=user.get("education"),
                certificationsAndAchievementsAndAwards=user.get("certificationsAndAchievementsAndAwards"),
                projects=user.get("projects"),
                about=user.get("about")
            )
            
            # Get saved jobs
            saved_jobs = user.get("saved_jobs", [])
            logger.info(f"[SIGN_IN] Saved jobs count: {len(saved_jobs)}")
            
            # Get applied jobs
            applied_jobs = user.get("applied_jobs", [])
            logger.info(f"[SIGN_IN] Applied jobs count: {len(applied_jobs)}")
            
            # Get chat history (convert ObjectId to string)
            chat_history_raw = user.get("chat_history", [])
            chat_history = []
            for chat in chat_history_raw:
                chat_data = {
                    "id": str(chat.get("_id", "")),
                    "chat_id": str(chat.get("_id", "")),
                    "chat_name": chat.get("chat_name", "New Chat"),
                    "messages": chat.get("messages", []),
                    "created_at": chat.get("created_at", "")
                }
                chat_history.append(chat_data)
            logger.info(f"[SIGN_IN] Chat history count: {len(chat_history)}")
            
            return SignInResponse(
                exists=True, 
                user=user_profile,
                saved_jobs=saved_jobs,
                applied_jobs=applied_jobs,
                chat_history=chat_history
            )
        else:
            logger.info(f"[SIGN_IN] No user found with email: {request.email}")
            return SignInResponse(exists=False, user=None)
    except Exception as e:
        logger.error(f"[SIGN_IN] Error in sign in: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/confirmOnboardingDetails")
async def confirm_onboarding_details(onboard_confirmed_details: UserOnboardingResponse):
    """ Once the user confirms the details sent by the backend after parsing the resume,
        this endpoint is called to save the details in the database.
    """
    logger.info(f"[ONBOARD] Confirming onboarding details for email: {onboard_confirmed_details.email}")
    try:
        user_data = onboard_confirmed_details.model_dump()
        # Check if user already exists? For now, just insert.
        # We might want to use email as a unique identifier.
        existing_user = await db.users.find_one({"email": user_data["email"]})
        logger.info(f"[ONBOARD] DB query - existing user: {existing_user is not None}")
        
        if existing_user:
             # Update existing user or raise error? Let's update for now or just return existing.
             # Assuming we want to create a new one or update.
             await db.users.update_one({"email": user_data["email"]}, {"$set": user_data})
             logger.info(f"[ONBOARD] Updated existing user: {user_data['email']}")
             return {"message": "User details updated successfully", "email": user_data["email"]}
        
        # Initialize chat_history for new users
        user_data["chat_history"] = []
        user_data["saved_jobs"] = []
        user_data["applied_jobs"] = []

        result = await db.users.insert_one(user_data)
        logger.info(f"[ONBOARD] Inserted new user: {user_data['email']}, ID: {result.inserted_id}")
        return {"message": "User onboarded successfully", "id": str(result.inserted_id)}
    except Exception as e:
        logger.error(f"[ONBOARD] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#home page endpoints

@app.get("/api/chatHistoryRequest", response_model=ChatHistoryResponse)
async def chat_history_request(email: str):
    """ Endpoint to handle chat history requests.
        For home page chat history retrieval.
        1. Fetch chat history from the database for the user.
        2. Return the chat history to the frontend.
        3. return only the id, and chat name for listing on home page.
    """
    logger.info(f"[CHAT_HISTORY] Request for email: {email}")
    try:
        user = await db.users.find_one({"email": email})
        logger.info(f"[CHAT_HISTORY] DB query - user found: {user is not None}")
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        chat_history = user.get("chat_history", [])
        logger.info(f"[CHAT_HISTORY] Found {len(chat_history)} chats")
        response_chats = []
        for chat in chat_history:
            # Handle potential missing fields or different structure
            # Assuming chat object has _id or id
            chat_id = str(chat.get("_id", chat.get("id", "")))
            
            response_chats.append(ChatHistoryResponseItem(
                id=chat_id,
                chat_name=chat.get("chat_name", "New Chat"),
                chat_id=chat_id
            ))
            
        return ChatHistoryResponse(chats=response_chats)
    except Exception as e:
        logger.error(f"[CHAT_HISTORY] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/getAppliedJobs", response_model=GetAppliedJobsResponse)
async def get_applied_jobs(email: str):
    """ Endpoint to get applied jobs for the user.
        1. Fetch applied jobs from the database for the user.
        2. Return the applied jobs to the frontend.
    """
    logger.info(f"[GET_APPLIED_JOBS] Request for email: {email}")
    try:
        user = await db.users.find_one({"email": email})
        logger.info(f"[GET_APPLIED_JOBS] DB query - user found: {user is not None}")
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
    except Exception as e:
        logger.error(f"[GET_APPLIED_JOBS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/getSavedJobs", response_model=GetSavedJobsResponse)
async def get_saved_jobs(email: str):
    """ Endpoint to get saved jobs for the user.
        1. Fetch saved jobs from the database for the user.
        2. Return the saved jobs to the frontend.
    """
    logger.info(f"[GET_SAVED_JOBS] Request for email: {email}")
    try:
        user = await db.users.find_one({"email": email})
        logger.info(f"[GET_SAVED_JOBS] DB query - user found: {user is not None}")
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
    except Exception as e:
        logger.error(f"[GET_SAVED_JOBS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/saveJob")
async def save_job_endpoint(request: SaveJobRequest):
    """ Endpoint to save a job for the user.
        1. Save the job to the user's saved jobs in the database.
    """
    logger.info(f"[SAVE_JOB] Request for email: {request.email}, job_id: {request.job_id}")
    try:
        job_data = {
            "job_id": request.job_id,
            "job_title": request.job_title,
            "company_name": request.company_name,
            "job_link": request.job_link
        }
        
        result = await db.users.update_one(
            {"email": request.email},
            {"$addToSet": {"saved_jobs": job_data}}
        )
        logger.info(f"[SAVE_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Job saved successfully"}
    except Exception as e:
        logger.error(f"[SAVE_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applyJob")
async def apply_job_endpoint(request: ApplyJobRequest):
    """ Endpoint to apply to a job for the user.
        1. Apply to the job via jsearch api.
        2. Save the job to the user's applied jobs in the database.
        3. after user clicks apply, in the job interface, a new tab will open with job link and job applied request popup will appear asking for confirmation
        4. once confirmed the this endpoint will be called to save the applied job in applied category
    """
    logger.info(f"[APPLY_JOB] Request for email: {request.email}, job_id: {request.job_id}")
    try:
        # 1. Apply to the job via jsearch api.
        # Note: Actual JSearch API integration for application is not implemented here as per current context.
        # Assuming this endpoint is primarily for tracking the application after user confirmation.
        
        job_data = {
            "job_id": request.job_id,
            "job_title": request.job_title,
            "company_name": request.company_name,
            "job_link": request.job_link
        }
        
        result = await db.users.update_one(
            {"email": request.email},
            {"$addToSet": {"applied_jobs": job_data}}
        )
        logger.info(f"[APPLY_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Job applied successfully"}
    except Exception as e:
        logger.error(f"[APPLY_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/updateUserProfile")
async def update_user_profile(request: UserProfileUpdateRequest):
    """ Endpoint to update user profile details.
        1. Update the user profile details in the database.
    """
    logger.info(f"[UPDATE_PROFILE] Request for email: {request.email}")
    try:
        update_data = request.model_dump(exclude_unset=True)
        email = update_data.pop("email")
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = await db.users.update_one(
            {"email": email},
            {"$set": update_data}
        )
        logger.info(f"[UPDATE_PROFILE] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "User profile updated successfully"}
    except Exception as e:
        logger.error(f"[UPDATE_PROFILE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/unsaveJob")
async def unsave_job_endpoint(request: SaveJobRequest):
    """ Endpoint to unsave a job for the user.
        1. Remove the job from the user's saved jobs in the database.
    """
    logger.info(f"[UNSAVE_JOB] Request for email: {request.email}, job_id: {request.job_id}")
    try:
        job_data = {
            "job_id": request.job_id,
            "job_title": request.job_title,
            "company_name": request.company_name,
            "job_link": request.job_link
        }
        
        result = await db.users.update_one(
            {"email": request.email},
            {"$pull": {"saved_jobs": job_data}}
        )
        logger.info(f"[UNSAVE_JOB] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Job unsaved successfully"}
    except Exception as e:
        logger.error(f"[UNSAVE_JOB] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/deleteChatSession")
async def delete_chat_session(email: str, chat_id: str):
    """ Endpoint to delete a chat session for the user.
        1. Remove the chat session from the user's chat history in the database.
    """
    logger.info(f"[DELETE_CHAT] Request for email: {email}, chat_id: {chat_id}")
    try:
        result = await db.users.update_one(
            {"email": email},
            {"$pull": {"chat_history": {"_id": ObjectId(chat_id)}}}
        )
        logger.info(f"[DELETE_CHAT] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Chat session deleted successfully"}
    except Exception as e:
        logger.error(f"[DELETE_CHAT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Chat endpoints

@app.post("/api/createChat", response_model=CreateChatResponse)
async def create_chat_endpoint(request: CreateChatRequest):
    """
    Create a new chat session for the user.
    1. Creates permanent context from user profile using Gemini
    2. Initializes chat with context and greeting message
    3. Updates user document with new chat
    """
    logger.info(f"[CREATE_CHAT] Request for email: {request.email}")
    try:
        result = await create_new_chat(request.email)
        logger.info(f"[CREATE_CHAT] Chat created: {result.get('chat_id', 'N/A')}")
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return CreateChatResponse(
            chat_id=result["chat_id"],
            chat_name=result["chat_name"],
            initial_message=result["initial_message"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CREATE_CHAT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sendMessage", response_model=ChatMessageResponse)
async def send_message_endpoint(request: ChatMessageRequest):
    """
    Send a message to the chatbot and get a response.
    1. Processes user message with context
    2. Uses Gemini with function calling for job search
    3. Returns bot response and optional job cards
    """
    logger.info(f"[SEND_MESSAGE] Request for email: {request.email}, chat_id: {request.chat_id}")
    print(f"[SEND_MESSAGE] message={request.message[:50] if request.message else 'None'}...")
    print(f"[SEND_MESSAGE] selected_job_id={request.selected_job_id}, has_job_data={request.selected_job_data is not None}")
    try:
        result = await process_chat_message(
            email=request.email,
            chat_id=request.chat_id,
            user_message=request.message,
            selected_job_id=request.selected_job_id,
            selected_job_data=request.selected_job_data
        )
        logger.info(f"[SEND_MESSAGE] Chat processed, response keys: {list(result.keys()) if result else 'None'}")
        
        if "error" in result and result.get("message", "").startswith("User not found"):
            raise HTTPException(status_code=404, detail=result["message"])
        
        response = ChatMessageResponse(
            message=result.get("message", ""),
            jobs=result.get("jobs"),
            selected_job_details=result.get("selected_job_details")
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"[SEND_MESSAGE] Error: {str(e)}")
        logger.error(f"[SEND_MESSAGE] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/getChatMessages")
async def get_chat_messages_endpoint(email: str, chat_id: str):
    """
    Get all messages for a specific chat session.
    """
    logger.info(f"[GET_CHAT_MESSAGES] Request for email: {email}, chat_id: {chat_id}")
    try:
        result = await get_chat_messages(email, chat_id)
        logger.info(f"[GET_CHAT_MESSAGES] Found {len(result.get('messages', []))} messages")
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INTERVIEW ENDPOINTS ====================

class GenerateObjectiveRequest(BaseModel):
    job_title: str
    company_name: str
    job_description: str

@app.post("/api/generateInterviewObjective")
async def generate_interview_objective(request: GenerateObjectiveRequest):
    """
    Generate an interview objective using Gemini AI based on job details.
    This helps users understand what the mock interview will focus on.
    """
    logger.info(f"Generate interview objective for: {request.job_title} at {request.company_name}")
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
        # Return a default objective on error
        default_objective = f"Practice technical and behavioral interview for the {request.job_title} position at {request.company_name}. Focus on demonstrating relevant skills, problem-solving abilities, and cultural fit."
        return {"objective": default_objective}


@app.get("/api/interviewers")
async def get_interviewers():
    """Get all available AI interviewers."""
    logger.info("Get interviewers request")
    return {"interviewers": get_all_interviewers()}


@app.get("/api/interviewer/{interviewer_id}")
async def get_interviewer(interviewer_id: int):
    """Get a specific interviewer by ID."""
    logger.info(f"Get interviewer request: {interviewer_id}")
    interviewer = get_interviewer_by_id(interviewer_id)
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    return interviewer


@app.post("/api/createInterview", response_model=InterviewResponse)
async def create_interview_endpoint(request: CreateInterviewRequest):
    """
    Create a new mock interview session.
    Generates questions based on the objective and optional job context.
    """
    logger.info(f"Create interview request for email: {request.email}")
    try:
        # Generate questions
        context = ""
        if request.job_description:
            context = f"Job: {request.job_title} at {request.company_name}\n{request.job_description}"
        
        generated = await generate_interview_questions(
            name=request.name,
            objective=request.objective,
            context=context,
            number=request.question_count
        )
        
        # Create interview
        interview = await create_interview(
            user_email=request.email,
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
    except Exception as e:
        logger.error(f"Error creating interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/createJobInterview", response_model=InterviewResponse)
async def create_job_interview_endpoint(request: CreateJobInterviewRequest):
    """
    Create a mock interview tailored to a specific job listing.
    This is the key integration point between job search and interview prep.
    """
    logger.info(f"Create job interview request for email: {request.email}, job: {request.job_title}")
    try:
        interview = await create_job_interview(
            user_email=request.email,
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
    except Exception as e:
        logger.error(f"Error creating job interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews", response_model=GetInterviewsResponse)
async def get_user_interviews_endpoint(email: str):
    """Get all interviews for a user."""
    logger.info(f"Get interviews request for email: {email}")
    try:
        interviews = await get_user_interviews(email)
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


@app.get("/api/interview/{interview_id}")
async def get_interview_endpoint(interview_id: str):
    """Get a specific interview by ID."""
    logger.info(f"Get interview request: {interview_id}")
    try:
        interview = await get_interview_by_id(interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        return interview
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/interview/{interview_id}")
async def delete_interview_endpoint(interview_id: str):
    """Delete an interview."""
    logger.info(f"Delete interview request: {interview_id}")
    try:
        success = await delete_interview(interview_id)
        if not success:
            raise HTTPException(status_code=404, detail="Interview not found")
        return {"message": "Interview deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/registerCall", response_model=RegisterCallResponse)
async def register_call_endpoint(request: RegisterCallRequest):
    """
    Register a call with Retell AI for voice interview.
    Returns call_id and access_token needed to start the voice call.
    """
    logger.info(f"[REGISTER_CALL] Register call request for interview: {request.interview_id}")
    try:
        # Get interview details
        interview = await get_interview_by_id(request.interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Get user profile for resume context
        user = await db.users.find_one({"email": request.user_email})
        
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
        
        # Build questions list - format for the Retell agent
        questions = interview.get("questions", [])
        questions_list = []
        for i, q in enumerate(questions, 1):
            question_text = q.get('question', '') if isinstance(q, dict) else str(q)
            questions_list.append(f"{i}. {question_text}")
        questions_text = "\n".join(questions_list)
        
        # Build job context
        job_title = interview.get("job_title", "")
        company_name = interview.get("company_name", "")
        
        # Get interview duration (default 10 minutes)
        time_duration = interview.get("time_duration", "10")
        
        # Build the objective with full context
        base_objective = interview.get("objective", "Assess the candidate's skills and experience")
        
        # Build job context string
        job_context_str = ""
        if job_title and company_name:
            job_context_str = f"for the {job_title} role at {company_name}"
        elif job_title:
            job_context_str = f"for the {job_title} role"
        
        # Build realistic interview objective with natural flow
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
        # The agent uses: {{mins}}, {{name}}, {{objective}}, {{questions}}
        dynamic_data = {
            # These are the EXACT variable names the Retell agent expects
            "mins": time_duration,  # For {{mins}} - interview duration
            "name": request.user_name,  # For {{name}} - candidate name
            "objective": full_objective,  # For {{objective}} - interview objective with rules
            "questions": questions_text,  # For {{questions}} - the questions list
            
            # Additional variables that might be useful if agent prompt is updated
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
        print(f"[REGISTER_CALL] Questions being sent:")
        for q in questions_list[:3]:
            print(f"[REGISTER_CALL]   {q}")
        if len(questions_list) > 3:
            print(f"[REGISTER_CALL]   ... and {len(questions_list) - 3} more")
        print(f"[REGISTER_CALL] Objective Preview: {full_objective[:150]}...")
        print(f"[REGISTER_CALL] ================================================\n")
        
        result = await register_retell_call(
            interviewer_id=request.interviewer_id,
            dynamic_data=dynamic_data
        )
        
        # Create interview response record
        await create_interview_response(
            interview_id=request.interview_id,
            name=request.user_name,
            email=request.user_email,
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


@app.post("/api/updateInterviewResponse")
async def update_interview_response_endpoint(request: UpdateInterviewResponseRequest):
    """Update an interview response (e.g., mark as ended, update duration)."""
    logger.info(f"Update interview response request for call: {request.call_id}")
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


@app.get("/api/interviewHistory", response_model=GetInterviewHistoryResponse)
async def get_interview_history_endpoint(email: str):
    """Get a user's interview practice history with analytics."""
    logger.info(f"Get interview history request for email: {email}")
    try:
        responses = await get_user_interview_history(email)
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


@app.get("/api/interviewResponses/{interview_id}")
async def get_interview_responses_endpoint(interview_id: str):
    """Get all responses for a specific interview."""
    logger.info(f"Get interview responses request for interview: {interview_id}")
    try:
        responses = await get_interview_responses(interview_id)
        return {"responses": responses}
    except Exception as e:
        logger.error(f"Error getting interview responses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyzeInterview")
async def analyze_interview_endpoint(request: AnalyzeInterviewRequest):
    """Analyze an interview recording and generate insights."""
    logger.info(f"Analyze interview request for call: {request.call_id}")
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


@app.post("/api/submitInterviewFeedback")
async def submit_feedback_endpoint(request: SubmitFeedbackRequest):
    """Submit feedback for an interview experience."""
    logger.info(f"Submit feedback request for interview: {request.interview_id}")
    try:
        feedback_id = await submit_interview_feedback(
            interview_id=request.interview_id,
            email=request.email,
            feedback=request.feedback,
            satisfaction=request.satisfaction
        )
        return {"message": "Feedback submitted successfully", "feedback_id": feedback_id}
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Webhook endpoint for Retell AI callbacks
@app.post("/api/retellWebhook")
async def retell_webhook(request: Request):
    """
    Webhook endpoint for Retell AI to send call events.
    Handles call completion, transcripts, and analysis triggers.
    """
    logger.info("Retell webhook received")
    try:
        body = await request.json()
        event_type = body.get("event")
        call_id = body.get("call_id")
        
        logger.info(f"Retell webhook event: {event_type} for call: {call_id}")
        
        if event_type == "call_ended":
            # Update response as ended
            await update_interview_response(call_id, {
                "is_ended": True,
                "duration": body.get("duration", 0)
            })
            
            # Optionally trigger analysis
            # await analyze_interview_response(call_id)
        
        elif event_type == "call_analyzed":
            # Retell has analyzed the call, store the analysis
            call_analysis = body.get("call_analysis", {})
            await update_interview_response(call_id, {
                "details": body,
                "is_analysed": True
            })
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Error processing Retell webhook: {str(e)}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    # command to run the app: uvicorn main:app --reload
    uvicorn.run(app, host="0.0.0.0", port=8000)