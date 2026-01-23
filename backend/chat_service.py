"""
Chat Service for managing chatbot interactions with Gemini API.
Implements function calling for job search and context management.
"""

import os
import json
import logging
from typing import Optional, List, Tuple
from datetime import datetime
import google.generativeai as genai
from google.generativeai import protos
from bson import ObjectId

from db import db
from jsearch_client import search_jobs, get_job_details, extract_job_cards_from_response, extract_job_card_data

logger = logging.getLogger(__name__)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# System prompt for the career assistant chatbot
SYSTEM_PROMPT = """You are JobBot AI, a highly skilled and professional career assistant powered by advanced AI.

## YOUR CAPABILITIES:
1. **Job Search** - Find relevant jobs matching user's profile, skills, and preferences
2. **Resume Analysis** - Provide detailed resume improvement tips and ATS optimization
3. **Interview Prep** - Offer comprehensive interview preparation with common questions and strategies
4. **Application Help** - Help craft responses to application questions for specific jobs
5. **Career Advice** - Provide industry-specific career guidance and growth strategies
6. **Mock Interviews** - Suggest AI Mock Interview practice for better preparation

## RESPONSE FORMATTING - CRITICAL:
- **Always use Markdown** for formatting your responses
- Use **bold** for important terms and emphasis
- Use bullet points (•) or numbered lists for multiple items
- Use headers (##, ###) to organize longer responses
- Use `code formatting` for technical terms when relevant
- Keep responses **concise but informative** - 2-5 sentences for simple queries
- For complex topics, use structured sections with headers

## PERSONALIZATION - VERY IMPORTANT:
- **Always reference the user's actual skills and experience** from their profile when giving advice
- Match job recommendations to their specific background
- Tailor interview tips based on their experience level
- When analyzing job fit, compare against their actual qualifications

## JOB SEARCH BEHAVIOR:
- **Default country is INDIA (in)** - always use country='in' unless user specifies otherwise
- Keep search queries SIMPLE - just the role/title
- Don't over-filter - use minimal parameters for more results
- When jobs are found, give a brief personalized analysis of fit based on user's profile

## WHEN A JOB IS SELECTED:
- Analyze how well it matches the user's skills
- Point out relevant experience they have
- Identify any skill gaps and how to address them
- Suggest preparation strategies specific to that role

## PROACTIVE SUGGESTIONS:
- After job discussions, suggest: "Would you like to practice for this interview? Try our **AI Mock Interview** feature for realistic voice-based interview simulation!"
- Offer to help with resume tailoring for specific roles
- Suggest relevant skills to highlight

You have access to:
- `search_jobs`: Search job listings (default to India)
- `get_job_details`: Get detailed job information
"""

# Define function declarations for Gemini using proper protobuf types
def get_search_jobs_function():
    """Create the search_jobs function declaration using protos."""
    return protos.FunctionDeclaration(
        name="search_jobs",
        description="Search for job listings in India by default. Keep queries SIMPLE - just the job title/role. Only add filters when user EXPLICITLY requests them.",
        parameters=protos.Schema(
            type=protos.Type.OBJECT,
            properties={
                "query": protos.Schema(
                    type=protos.Type.STRING,
                    description="SIMPLE job title or role only. Examples: 'software developer', 'frontend developer', 'data scientist'. Do NOT add location to query - use country parameter instead."
                ),
                "country": protos.Schema(
                    type=protos.Type.STRING,
                    description="ISO-3166-1 alpha-2 country code. ALWAYS DEFAULT TO 'in' (India) unless user explicitly asks for another country like US, UK, etc."
                ),
                "date_posted": protos.Schema(
                    type=protos.Type.STRING,
                    description="Job posting age filter. Options: 'all', 'today', '3days', 'week', 'month'. Default is 'week' for fresh listings."
                ),
                "employment_types": protos.Schema(
                    type=protos.Type.STRING,
                    description="ONLY use if user explicitly asks. Options: FULLTIME, CONTRACTOR, PARTTIME, INTERN"
                ),
                "job_requirements": protos.Schema(
                    type=protos.Type.STRING,
                    description="ONLY use if user explicitly asks for experience level. Options: under_3_years_experience, more_than_3_years_experience, no_experience, no_degree"
                ),
                "work_from_home": protos.Schema(
                    type=protos.Type.BOOLEAN,
                    description="Set to true ONLY if user explicitly asks for remote/WFH jobs"
                ),
                "num_pages": protos.Schema(
                    type=protos.Type.INTEGER,
                    description="Number of result pages (1-5). Default is 2."
                )
            },
            required=["query"]
        )
    )

def get_job_details_function():
    """Create the get_job_details function declaration using protos."""
    return protos.FunctionDeclaration(
        name="get_job_details",
        description="Get detailed information about a specific job by its ID. Use this when a user selects a job or asks for more details about a particular position.",
        parameters=protos.Schema(
            type=protos.Type.OBJECT,
            properties={
                "job_id": protos.Schema(
                    type=protos.Type.STRING,
                    description="The unique identifier of the job to get details for"
                ),
                "country": protos.Schema(
                    type=protos.Type.STRING,
                    description="ISO-3166-1 alpha-2 country code. Default is 'us'."
                )
            },
            required=["job_id"]
        )
    )

# Create the model with function calling capability
def get_chat_model():
    """Get a Gemini model configured for chat with function calling."""
    tools = protos.Tool(
        function_declarations=[
            get_search_jobs_function(),
            get_job_details_function()
        ]
    )
    return genai.GenerativeModel(
        'gemini-2.5-flash-lite',
        tools=[tools],
        system_instruction=SYSTEM_PROMPT
    )


async def create_permanent_context(user_data: dict) -> dict:
    """
    Create a permanent context from user profile for the chat session.
    Keeps raw resume data (skills, experience, projects) for personalized responses.
    
    Args:
        user_data: User document from database
    
    Returns:
        Dictionary containing both raw profile data and AI-generated summary
    """
    # Store raw resume data for direct reference
    raw_profile = {
        "name": user_data.get("name", ""),
        "email": user_data.get("email", ""),
        "location": user_data.get("location", "India"),
        "skills": user_data.get("skills", []),
        "experience": user_data.get("experience", []),
        "education": user_data.get("education", []),
        "projects": user_data.get("projects", []),
        "certifications": user_data.get("certificationsAndAchievementsAndAwards", []),
        "profile_summary": user_data.get("profile_summary", "")
    }
    
    # Build formatted profile for AI
    profile_parts = []
    if raw_profile["name"]:
        profile_parts.append(f"**Name:** {raw_profile['name']}")
    if raw_profile["location"]:
        profile_parts.append(f"**Location:** {raw_profile['location']}")
    if raw_profile["skills"]:
        profile_parts.append(f"**Technical Skills:** {', '.join(raw_profile['skills'])}")
    if raw_profile["experience"]:
        exp_list = "\n".join(f"  • {exp}" for exp in raw_profile['experience'])
        profile_parts.append(f"**Work Experience:**\n{exp_list}")
    if raw_profile["education"]:
        edu_list = "\n".join(f"  • {edu}" for edu in raw_profile['education'])
        profile_parts.append(f"**Education:**\n{edu_list}")
    if raw_profile["projects"]:
        proj_list = "\n".join(f"  • {proj}" for proj in raw_profile['projects'][:5])
        profile_parts.append(f"**Projects:**\n{proj_list}")
    if raw_profile["certifications"]:
        cert_list = "\n".join(f"  • {cert}" for cert in raw_profile['certifications'][:5])
        profile_parts.append(f"**Certifications & Awards:**\n{cert_list}")
    if raw_profile["profile_summary"]:
        profile_parts.append(f"**Profile Summary:** {raw_profile['profile_summary']}")
    
    formatted_profile = "\n\n".join(profile_parts)
    
    # Generate AI summary for quick reference
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    prompt = f"""Analyze this candidate's profile and create a concise 2-3 sentence professional summary.
Focus on: experience level, key technical strengths, and ideal job types.

{formatted_profile}

Professional Summary:"""
    
    try:
        response = model.generate_content(prompt)
        ai_summary = response.text.strip()
    except Exception as e:
        logger.error(f"Error creating AI summary: {str(e)}")
        skills_str = ', '.join(raw_profile['skills'][:5]) if raw_profile['skills'] else 'various technologies'
        ai_summary = f"Candidate with skills in {skills_str} based in {raw_profile['location']}."
    
    return {
        "raw_profile": raw_profile,
        "formatted_profile": formatted_profile,
        "ai_summary": ai_summary
    }


async def summarize_conversation(messages: List[dict]) -> str:
    """
    Create a summary of conversation history.
    
    Args:
        messages: List of message dictionaries
    
    Returns:
        Summary string
    """
    if not messages:
        return ""
    
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    # Format messages for summarization
    conversation_text = "\n".join([
        f"{msg['sender'].upper()}: {msg['message']}" 
        for msg in messages
    ])
    
    prompt = f"""Summarize the following conversation between a user and a job search assistant.
Focus on:
1. What jobs/positions the user is interested in
2. Any preferences mentioned (location, salary, remote, etc.)
3. Key advice or information provided
4. Any jobs that were discussed or selected

Keep the summary concise (max 150 words).

Conversation:
{conversation_text}

Summary:"""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error summarizing conversation: {str(e)}")
        return ""


def build_context_prompt(chat_context: dict, current_message: str, selected_job_id: Optional[str] = None) -> str:
    """
    Build the context prompt combining permanent context, summary, and recent messages.
    
    Args:
        chat_context: Chat context dictionary
        current_message: Current user message
        selected_job_id: Optional job ID if user selected a job (for new selection)
    
    Returns:
        Complete context prompt
    """
    parts = []
    
    # Add permanent context (user profile) - now supports both old string format and new dict format
    permanent_context = chat_context.get("permanent_context")
    if permanent_context:
        if isinstance(permanent_context, dict):
            # New format with raw profile data
            raw_profile = permanent_context.get("raw_profile", {})
            ai_summary = permanent_context.get("ai_summary", "")
            
            # Build comprehensive profile section
            profile_section = "[USER PROFILE - ALWAYS REFERENCE THIS FOR PERSONALIZED ADVICE]\n"
            profile_section += f"**Summary:** {ai_summary}\n\n"
            
            if raw_profile.get("name"):
                profile_section += f"**Name:** {raw_profile['name']}\n"
            if raw_profile.get("location"):
                profile_section += f"**Location:** {raw_profile['location']}\n"
            
            if raw_profile.get("skills"):
                profile_section += f"\n**Technical Skills:** {', '.join(raw_profile['skills'])}\n"
            
            if raw_profile.get("experience"):
                profile_section += f"\n**Work Experience:**\n"
                for exp in raw_profile['experience'][:5]:
                    profile_section += f"  • {exp}\n"
            
            if raw_profile.get("projects"):
                profile_section += f"\n**Projects:**\n"
                for proj in raw_profile['projects'][:5]:
                    profile_section += f"  • {proj}\n"
            
            if raw_profile.get("education"):
                profile_section += f"\n**Education:**\n"
                for edu in raw_profile['education'][:3]:
                    profile_section += f"  • {edu}\n"
            
            if raw_profile.get("certifications"):
                profile_section += f"\n**Certifications:**\n"
                for cert in raw_profile['certifications'][:3]:
                    profile_section += f"  • {cert}\n"
            
            parts.append(profile_section)
        else:
            # Old string format - backwards compatibility
            parts.append(f"[USER PROFILE]\n{permanent_context}\n")
    
    # Add PERSISTED selected job context if applicable
    selected_job = chat_context.get("selected_job")
    if selected_job:
        job_title = selected_job.get('job_title', 'Unknown Position')
        employer_name = selected_job.get('employer_name', 'Unknown Company')
        job_description = selected_job.get('job_description', '')
        job_location = selected_job.get('job_location', 'Not specified')
        job_employment_type = selected_job.get('job_employment_type', '')
        job_highlights = selected_job.get('job_highlights', {})
        
        job_context = f"""[CURRENTLY SELECTED JOB - Answer all questions in context of this job]
**Position:** {job_title}
**Company:** {employer_name}
**Location:** {job_location}
**Type:** {job_employment_type}

**Job Description:**
{job_description[:2000] if job_description else 'No description available'}
"""
        if job_highlights:
            if job_highlights.get('Qualifications'):
                job_context += f"\n**Required Qualifications:**\n" + "\n".join(f"  • {q}" for q in job_highlights['Qualifications'][:5])
            if job_highlights.get('Responsibilities'):
                job_context += f"\n**Key Responsibilities:**\n" + "\n".join(f"  • {r}" for r in job_highlights['Responsibilities'][:5])
        
        parts.append(job_context + "\n")
    
    # Add conversation summary
    if chat_context.get("conversation_summary"):
        parts.append(f"[CONVERSATION HISTORY SUMMARY]\n{chat_context['conversation_summary']}\n")
    
    # Add recent messages (last 5 exchanges)
    if chat_context.get("recent_messages"):
        parts.append("[RECENT CONVERSATION]")
        for msg in chat_context["recent_messages"][-10:]:  # Last 10 messages (5 exchanges)
            parts.append(f"{msg['sender'].upper()}: {msg['message']}")
        parts.append("")
    
    # Add current message
    parts.append(f"[CURRENT MESSAGE]\nUSER: {current_message}")
    
    return "\n".join(parts)


async def execute_function_call(function_name: str, function_args: dict) -> Tuple[dict, Optional[List[dict]]]:
    """
    Execute a function call and return the result.
    
    Args:
        function_name: Name of the function to execute
        function_args: Arguments for the function
    
    Returns:
        Tuple of (function result, job cards if applicable)
    """
    job_cards = None
    
    if function_name == "search_jobs":
        # Default to India (in) for job searches
        result = await search_jobs(
            query=function_args.get("query", ""),
            num_pages=min(function_args.get("num_pages", 2), 3),  # Default 2 pages, max 3
            country=function_args.get("country", "in"),  # Default to India
            date_posted=function_args.get("date_posted", "week"),  # Default to last week
            employment_types=function_args.get("employment_types"),
            job_requirements=function_args.get("job_requirements"),
            work_from_home=function_args.get("work_from_home", False)
        )
        print(f"[CHAT_SERVICE] Job search executed - Country: {function_args.get('country', 'in')}, Query: {function_args.get('query')}")
        
        # Extract job cards for frontend
        job_cards = extract_job_cards_from_response(result)
        
        # Create a summary for the model
        jobs_data = result.get("data", [])
        if jobs_data:
            job_summaries = []
            for job in jobs_data[:10]:  # Limit to 10 jobs for context
                summary = f"- {job.get('job_title')} at {job.get('employer_name')} ({job.get('job_location', 'Location not specified')})"
                if job.get('job_salary') or (job.get('job_min_salary') and job.get('job_max_salary')):
                    if job.get('job_min_salary') and job.get('job_max_salary'):
                        summary += f" - ${job['job_min_salary']:,.0f}-${job['job_max_salary']:,.0f}"
                    elif job.get('job_salary'):
                        summary += f" - {job['job_salary']}"
                job_summaries.append(summary)
            
            return {
                "status": "success",
                "total_jobs_found": len(jobs_data),
                "jobs_summary": "\n".join(job_summaries)
            }, job_cards
        else:
            return {
                "status": "no_results",
                "message": "No jobs found matching the search criteria."
            }, []
    
    elif function_name == "get_job_details":
        result = await get_job_details(
            job_id=function_args.get("job_id", ""),
            country=function_args.get("country", "in")  # Default to India
        )
        
        jobs_data = result.get("data", [])
        if jobs_data:
            job = jobs_data[0]
            # Extract detailed info for the model
            job_details = {
                "status": "success",
                "job_title": job.get("job_title"),
                "employer_name": job.get("employer_name"),
                "job_location": job.get("job_location"),
                "job_description": job.get("job_description", "")[:2000],  # Limit description length
                "job_employment_type": job.get("job_employment_type"),
                "job_apply_link": job.get("job_apply_link"),
                "job_highlights": job.get("job_highlights", {}),
                "job_qualifications": job.get("job_highlights", {}).get("Qualifications", []),
                "job_responsibilities": job.get("job_highlights", {}).get("Responsibilities", [])
            }
            
            if job.get("job_min_salary") and job.get("job_max_salary"):
                job_details["salary_range"] = f"${job['job_min_salary']:,.0f} - ${job['job_max_salary']:,.0f} {job.get('job_salary_period', 'yearly')}"
            
            # Return full job details as selected job
            job_card = extract_job_card_data(job)
            return job_details, job_card
        else:
            return {
                "status": "error",
                "message": "Job details not found."
            }, None
    
    return {"status": "error", "message": f"Unknown function: {function_name}"}, None


async def process_chat_message(
    email: str,
    chat_id: str,
    user_message: str,
    selected_job_id: Optional[str] = None,
    selected_job_data: Optional[dict] = None
) -> dict:
    """
    Process a chat message and generate a response using Gemini with function calling.
    
    Args:
        email: User's email
        chat_id: Chat session ID
        user_message: User's message
        selected_job_id: Optional job ID if user selected a job
        selected_job_data: Optional full job data if user selected a job (avoids re-fetching)
    
    Returns:
        dict with response message, optional job cards, and optional selected job details
    """
    # Fetch user and chat data
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "User not found. Please complete onboarding first.", "jobs": None}
    
    # Find the chat in user's chat history
    chat_history = user.get("chat_history", [])
    chat = None
    chat_index = -1
    for i, c in enumerate(chat_history):
        if str(c.get("_id")) == chat_id or str(c.get("id")) == chat_id:
            chat = c
            chat_index = i
            break
    
    if not chat:
        return {"message": "Chat session not found.", "jobs": None}
    
    # Get chat context
    chat_context = chat.get("context", {
        "permanent_context": "",
        "conversation_summary": "",
        "recent_messages": [],
        "selected_job": None
    })
    
    # Check if user wants to clear the selected job
    clear_job_keywords = ["clear job", "remove job", "forget job", "different job", "change job", "new search", "clear selection", "start fresh"]
    user_message_lower = user_message.lower()
    if any(keyword in user_message_lower for keyword in clear_job_keywords):
        chat_context["selected_job"] = None
        print(f"[CHAT_SERVICE] Cleared selected job from context")
    
    # If new job data is provided, update the persisted selected job
    if selected_job_data:
        chat_context["selected_job"] = selected_job_data
        print(f"[CHAT_SERVICE] Stored new job in context: {selected_job_data.get('job_title')} at {selected_job_data.get('employer_name')}")
    
    # Build the prompt with context (includes persisted selected_job)
    context_prompt = build_context_prompt(chat_context, user_message, selected_job_id)
    
    # Return the currently selected job (either new or persisted)
    selected_job_details = selected_job_data or chat_context.get("selected_job")
    
    # Log current job context
    if selected_job_details:
        print(f"[CHAT_SERVICE] Job in context: {selected_job_details.get('job_title')} at {selected_job_details.get('employer_name')}")
    else:
        print(f"[CHAT_SERVICE] No job currently selected")
    
    # Create chat model with function calling
    model = get_chat_model()
    
    # Generate response
    try:
        print(f"\n[CHAT_SERVICE] Processing message for email: {email}, chat_id: {chat_id}")
        print(f"[CHAT_SERVICE] User message: {user_message[:100]}...")
        print(f"[CHAT_SERVICE] Selected job ID: {selected_job_id}")
        print(f"[CHAT_SERVICE] Context prompt length: {len(context_prompt)} chars")
        
        # Start a chat session for proper multi-turn with function calling
        chat_session = model.start_chat(enable_automatic_function_calling=False)
        
        # Send initial message
        response = chat_session.send_message(context_prompt)
        print(f"[CHAT_SERVICE] Got response from Gemini")
        
        # Check for function calls
        job_cards = None
        final_response_text = ""
        
        # Handle function calls if present
        if response.candidates[0].content.parts:
            print(f"[CHAT_SERVICE] Response has {len(response.candidates[0].content.parts)} parts")
            
            # Check if there's a function call
            function_call_part = None
            text_response = ""
            
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    function_call_part = part.function_call
                elif hasattr(part, 'text') and part.text:
                    text_response += part.text
            
            if function_call_part:
                function_name = function_call_part.name
                print(f"[CHAT_SERVICE] Function call detected: {function_name}")
                
                # Convert args properly - handle MapComposite type
                try:
                    if function_call_part.args:
                        function_args = {key: value for key, value in function_call_part.args.items()}
                    else:
                        function_args = {}
                    print(f"[CHAT_SERVICE] Function args: {function_args}")
                except Exception as arg_error:
                    print(f"[CHAT_SERVICE] Error converting args: {arg_error}")
                    function_args = {}
                
                logger.info(f"Executing function: {function_name} with args: {function_args}")
                
                # Execute the function
                function_result, cards = await execute_function_call(function_name, function_args)
                print(f"[CHAT_SERVICE] Function result status: {function_result.get('status', 'unknown')}")
                
                if function_name == "search_jobs" and cards:
                    job_cards = cards
                    print(f"[CHAT_SERVICE] Got {len(cards)} job cards")
                elif function_name == "get_job_details" and cards:
                    selected_job_details = cards
                    print(f"[CHAT_SERVICE] Got job details")
                
                # Send function result back using chat session
                print(f"[CHAT_SERVICE] Sending function result back to Gemini...")
                function_response_part = protos.Part(
                    function_response=protos.FunctionResponse(
                        name=function_name,
                        response={"result": json.dumps(function_result)}
                    )
                )
                
                # Send the function response through the chat session
                # Pass the Part directly - ChatSession will handle the wrapping
                final_response = chat_session.send_message(function_response_part)
                
                # Extract text from response, handling potential function calls
                try:
                    final_response_text = final_response.text
                except ValueError:
                    # Response might contain another function call, extract any text parts
                    for part in final_response.candidates[0].content.parts:
                        if hasattr(part, 'text') and part.text:
                            final_response_text = part.text
                            break
                    if not final_response_text:
                        final_response_text = "I found the information you requested. Let me know if you need anything else!"
                
                print(f"[CHAT_SERVICE] Got final response: {final_response_text[:100] if final_response_text else 'empty'}...")
            else:
                final_response_text = text_response
                print(f"[CHAT_SERVICE] Got text response: {final_response_text[:100] if final_response_text else 'empty'}...")
        
        if not final_response_text:
            final_response_text = response.text if hasattr(response, 'text') else "I'm here to help you with your job search. What would you like to know?"
        
        # Update chat messages
        timestamp = datetime.utcnow().isoformat()
        new_user_message = {
            "sender": "user",
            "message": user_message,
            "timestamp": timestamp,
            "selected_job_id": selected_job_id
        }
        new_bot_message = {
            "sender": "bot",
            "message": final_response_text,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Update recent messages in context (keep last 10 = 5 exchanges)
        recent_messages = chat_context.get("recent_messages", [])
        recent_messages.extend([new_user_message, new_bot_message])
        if len(recent_messages) > 10:
            # Summarize older messages and update summary
            old_messages = recent_messages[:-10]
            if old_messages:
                current_summary = chat_context.get("conversation_summary", "")
                messages_to_summarize = old_messages
                if current_summary:
                    messages_to_summarize = [{"sender": "system", "message": f"Previous summary: {current_summary}"}] + old_messages
                new_summary = await summarize_conversation(messages_to_summarize)
                chat_context["conversation_summary"] = new_summary
            recent_messages = recent_messages[-10:]
        
        chat_context["recent_messages"] = recent_messages
        
        # Update chat in database
        messages = chat.get("messages", [])
        messages.append({
            "sender": "user",
            "message": user_message,
            "timestamp": timestamp
        })
        messages.append({
            "sender": "bot",
            "message": final_response_text,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Update chat name if it's the first real message
        chat_name = chat.get("chat_name", "New Chat")
        if len(messages) <= 3:  # Initial bot greeting + first user message + response
            chat_name = user_message[:50] + ("..." if len(user_message) > 50 else "")
        
        # Update in database
        await db.users.update_one(
            {"email": email, f"chat_history.{chat_index}._id": chat["_id"]},
            {
                "$set": {
                    f"chat_history.{chat_index}.messages": messages,
                    f"chat_history.{chat_index}.context": chat_context,
                    f"chat_history.{chat_index}.chat_name": chat_name
                }
            }
        )
        
        return {
            "message": final_response_text,
            "jobs": job_cards,
            "selected_job_details": selected_job_details,
            "chat_name": chat_name
        }
        
    except Exception as e:
        import traceback
        print(f"[CHAT_SERVICE] ERROR in process_chat_message: {str(e)}")
        print(f"[CHAT_SERVICE] Error type: {type(e)}")
        print(f"[CHAT_SERVICE] Traceback:\n{traceback.format_exc()}")
        logger.error(f"Error processing chat message: {str(e)}")
        return {
            "message": "I apologize, but I encountered an error. Please try again.",
            "jobs": None,
            "error": str(e)
        }


async def create_new_chat(email: str) -> dict:
    """
    Create a new chat session for a user.
    
    Args:
        email: User's email
    
    Returns:
        dict with chat_id, chat_name, and initial_message
    """
    # Fetch user data
    user = await db.users.find_one({"email": email})
    if not user:
        return {"error": "User not found. Please complete onboarding first."}
    
    # Create permanent context from user profile
    permanent_context = await create_permanent_context(user)
    
    # Generate chat ID
    chat_id = ObjectId()
    
    # Initial bot message with markdown formatting
    user_name = user.get("name", "").split()[0] if user.get("name") else "there"
    
    # Get skills for personalized greeting
    skills = user.get("skills", [])
    skills_mention = ""
    if skills:
        top_skills = skills[:3]
        skills_mention = f"\n\nI see you have experience with **{', '.join(top_skills)}** - great skills for today's job market! 🎯"
    
    initial_message = f"""## Hello {user_name}! 👋

I'm **JobBot AI**, your personal career assistant powered by advanced AI.

I've analyzed your profile and I'm ready to help you with:

• 🔍 **Job Search** - Find roles matching your skills in India
• 📝 **Resume Tips** - Optimize your resume for ATS systems
• 🎤 **Interview Prep** - Practice with AI mock interviews
• 💡 **Career Advice** - Get personalized guidance
{skills_mention}

**What would you like to explore today?** Try asking:
- *"Find me frontend developer jobs"*
- *"How can I improve my resume?"*
- *"Help me prepare for interviews"*"""
    
    # Create chat object
    new_chat = {
        "_id": chat_id,
        "chat_name": "New Job Search",
        "messages": [
            {
                "sender": "bot",
                "message": initial_message,
                "timestamp": datetime.utcnow().isoformat()
            }
        ],
        "context": {
            "permanent_context": permanent_context,
            "conversation_summary": "",
            "recent_messages": []
        },
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Add chat to user's chat history
    await db.users.update_one(
        {"email": email},
        {"$push": {"chat_history": new_chat}}
    )
    
    return {
        "chat_id": str(chat_id),
        "chat_name": "New Job Search",
        "initial_message": initial_message
    }


async def get_chat_messages(email: str, chat_id: str) -> dict:
    """
    Get all messages for a specific chat.
    
    Args:
        email: User's email
        chat_id: Chat session ID
    
    Returns:
        dict with messages and chat_name
    """
    user = await db.users.find_one({"email": email})
    if not user:
        return {"error": "User not found"}
    
    chat_history = user.get("chat_history", [])
    for chat in chat_history:
        if str(chat.get("_id")) == chat_id or str(chat.get("id")) == chat_id:
            return {
                "messages": chat.get("messages", []),
                "chat_name": chat.get("chat_name", "New Chat")
            }
    
    return {"error": "Chat not found"}
