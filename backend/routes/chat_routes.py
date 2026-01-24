"""
Chat Routes Module
Handles chat creation, messaging, and history management endpoints.
All endpoints require authentication.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from bson import ObjectId
import logging

from db import db
from auth import get_current_user, TokenData, mask_email
from chat_service import create_new_chat, process_chat_message, get_chat_messages
from models import (
    ChatHistoryResponse, ChatHistoryResponseItem,
    ChatMessageRequest, ChatMessageResponse,
    CreateChatRequest, CreateChatResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/chatHistory", response_model=ChatHistoryResponse)
async def chat_history_request(current_user: TokenData = Depends(get_current_user)):
    """
    Get chat history for the authenticated user.
    Returns only id and chat name for listing.
    """
    logger.info(f"[CHAT_HISTORY] Request for: {mask_email(current_user.email)}")
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        chat_history = user.get("chat_history", [])
        logger.info(f"[CHAT_HISTORY] Found {len(chat_history)} chats")
        
        response_chats = []
        for chat in chat_history:
            chat_id = str(chat.get("_id", chat.get("id", "")))
            response_chats.append(ChatHistoryResponseItem(
                id=chat_id,
                chat_name=chat.get("chat_name", "New Chat"),
                chat_id=chat_id
            ))
            
        return ChatHistoryResponse(chats=response_chats)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHAT_HISTORY] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/createChat", response_model=CreateChatResponse)
async def create_chat_endpoint(current_user: TokenData = Depends(get_current_user)):
    """
    Create a new chat session for the authenticated user.
    
    1. Creates permanent context from user profile using Gemini
    2. Initializes chat with context and greeting message
    3. Updates user document with new chat
    """
    logger.info(f"[CREATE_CHAT] Request for: {mask_email(current_user.email)}")
    try:
        result = await create_new_chat(current_user.email)
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


@router.post("/sendMessage", response_model=ChatMessageResponse)
async def send_message_endpoint(
    request: ChatMessageRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Send a message to the chatbot and get a response.
    
    Security: User identified via JWT token.
    
    1. Processes user message with context
    2. Uses Gemini with function calling for job search
    3. Returns bot response and optional job cards
    """
    logger.info(f"[SEND_MESSAGE] Request for: {mask_email(current_user.email)}, chat_id: {request.chat_id}")
    
    try:
        result = await process_chat_message(
            email=current_user.email,
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


@router.get("/getChatMessages")
async def get_chat_messages_endpoint(
    chat_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get all messages for a specific chat session.
    Security: Only returns messages for chats owned by the authenticated user.
    """
    logger.info(f"[GET_CHAT_MESSAGES] Request for: {mask_email(current_user.email)}, chat_id: {chat_id}")
    try:
        result = await get_chat_messages(current_user.email, chat_id)
        logger.info(f"[GET_CHAT_MESSAGES] Found {len(result.get('messages', []))} messages")
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/chat/{chat_id}")
async def delete_chat_session(
    chat_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Delete a chat session.
    Security: Only allows deletion of chats owned by the authenticated user.
    """
    logger.info(f"[DELETE_CHAT] Request for: {mask_email(current_user.email)}, chat_id: {chat_id}")
    try:
        # Use user_id from token to ensure they can only delete their own chats
        result = await db.users.update_one(
            {"_id": ObjectId(current_user.user_id)},
            {"$pull": {"chat_history": {"_id": ObjectId(chat_id)}}}
        )
        logger.info(f"[DELETE_CHAT] DB update - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Chat not found or already deleted")
            
        return {"message": "Chat session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE_CHAT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
