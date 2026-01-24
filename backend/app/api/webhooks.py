"""
API endpoints for webhook callbacks from external services.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import logging

from app.services.imagen import handle_kie_callback
from app.services.suno import convert_suno_result_to_audio_asset

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

logger = logging.getLogger(__name__)


class KieCallbackPayload(BaseModel):
    """
    Callback payload structure from Kie.ai API.
    
    Based on Kie.ai documentation, the callback includes:
    - taskId: The task identifier
    - state: Task state (success, fail, etc.)
    - resultJson: JSON string containing result URLs and metadata
    - failMsg: Error message if task failed
    - failCode: Error code if task failed
    """
    taskId: Optional[str] = None
    task_id: Optional[str] = None  # Support snake_case variant
    state: Optional[str] = None
    resultJson: Optional[str] = None
    result_json: Optional[str] = None  # Support snake_case variant
    failMsg: Optional[str] = None
    fail_msg: Optional[str] = None  # Support snake_case variant
    failCode: Optional[str] = None
    fail_code: Optional[str] = None  # Support snake_case variant
    code: Optional[int] = None  # API response code
    msg: Optional[str] = None  # API response message
    data: Optional[Dict[str, Any]] = None  # Nested data structure


@router.post("/kie-callback")
async def kie_callback(request: Request, payload: Optional[KieCallbackPayload] = None):
    """
    Webhook endpoint to receive task completion callbacks from Kie.ai API.
    
    This endpoint receives POST requests from Kie.ai when image generation tasks complete.
    The callback includes task status and result URLs for generated images.
    
    Args:
        request: FastAPI request object
        payload: Callback payload from Kie.ai (auto-parsed from JSON body)
    
    Returns:
        dict: Acknowledgment response
    
    Note:
        Kie.ai will POST to this URL when a generation task completes.
        The callback payload structure matches the Get Task Details API response.
    """
    try:
        # Try to parse JSON body if payload wasn't auto-parsed
        if payload is None:
            try:
                body = await request.json()
                payload = KieCallbackPayload(**body)
            except Exception as e:
                logger.error(f"Failed to parse callback payload: {e}")
                # Try to parse as nested structure (some APIs wrap in 'data')
                try:
                    body = await request.json()
                    if "data" in body:
                        payload = KieCallbackPayload(**body["data"])
                    else:
                        raise HTTPException(status_code=400, detail="Invalid callback payload format")
                except:
                    raise HTTPException(status_code=400, detail=f"Invalid callback payload: {str(e)}")
        
        # Normalize field names (support both camelCase and snake_case)
        task_id = payload.taskId or payload.task_id
        state = payload.state
        result_json_str = payload.resultJson or payload.result_json
        fail_msg = payload.failMsg or payload.fail_msg
        fail_code = payload.failCode or payload.fail_code
        
        # Handle nested data structure (some APIs wrap in 'data')
        if payload.data:
            task_id = task_id or payload.data.get("taskId") or payload.data.get("task_id")
            state = state or payload.data.get("state")
            result_json_str = result_json_str or payload.data.get("resultJson") or payload.data.get("result_json")
            fail_msg = fail_msg or payload.data.get("failMsg") or payload.data.get("fail_msg")
            fail_code = fail_code or payload.data.get("failCode") or payload.data.get("fail_code")
        
        if not task_id:
            logger.warning("Callback received without taskId")
            return {"status": "error", "message": "Missing taskId in callback"}
        
        logger.info(f"Received Kie.ai callback for task {task_id}, state: {state}")
        
        # Process the callback
        await handle_kie_callback(
            task_id=task_id,
            state=state,
            result_json_str=result_json_str,
            fail_msg=fail_msg,
            fail_code=fail_code
        )
        
        return {
            "status": "success",
            "message": "Callback processed",
            "taskId": task_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Kie.ai callback: {e}", exc_info=True)
        # Still return 200 to acknowledge receipt (don't want Kie.ai to retry)
        return {
            "status": "error",
            "message": f"Error processing callback: {str(e)}"
        }


@router.get("/kie-callback")
async def kie_callback_get():
    """
    GET endpoint for webhook verification (some services use GET for verification).
    
    Returns:
        dict: Verification response
    """
    return {
        "status": "ok",
        "message": "Kie.ai webhook endpoint is active"
    }


class SunoCallbackPayload(BaseModel):
    """
    Callback payload structure from Kie.ai Suno API.
    
    Based on Suno API documentation, the callback includes:
    - code: Response status code (200 = success)
    - msg: Response message
    - data: Nested data with callbackType, task_id, and data array
    """
    code: Optional[int] = None
    msg: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@router.post("/suno-callback")
async def suno_callback(request: Request, payload: Optional[SunoCallbackPayload] = None):
    """
    Webhook endpoint to receive music generation callbacks from Kie.ai Suno API.
    
    This endpoint receives POST requests from Kie.ai when music generation tasks complete.
    The callback includes task status and result URLs for generated audio.
    
    Args:
        request: FastAPI request object
        payload: Callback payload from Kie.ai Suno API (auto-parsed from JSON body)
    
    Returns:
        dict: Acknowledgment response
    
    Note:
        Kie.ai will POST to this URL when a music generation task completes.
        Callback types: "text" (text generation), "first" (first track), "complete" (all tracks)
    """
    try:
        # Try to parse JSON body if payload wasn't auto-parsed
        if payload is None:
            try:
                body = await request.json()
                payload = SunoCallbackPayload(**body)
            except Exception as e:
                logger.error(f"Failed to parse Suno callback payload: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid callback payload: {str(e)}")
        
        logger.info(f"Received Suno callback: code={payload.code}, msg={payload.msg}")
        
        if payload.code != 200:
            logger.warning(f"Suno callback indicates error: {payload.msg} (code: {payload.code})")
            return {
                "status": "error",
                "message": payload.msg or "Generation failed",
                "code": payload.code
            }
        
        if not payload.data:
            logger.warning("Suno callback missing data")
            return {
                "status": "error",
                "message": "Missing data in callback"
            }
        
        callback_type = payload.data.get("callbackType", "complete")
        task_id = payload.data.get("task_id")
        tracks_data = payload.data.get("data", [])
        
        logger.info(f"Suno callback: type={callback_type}, task_id={task_id}, tracks={len(tracks_data)}")
        
        # Process tracks (usually 2 variations are generated)
        for track in tracks_data:
            audio_id = track.get("id")
            audio_url = track.get("audio_url")
            duration = track.get("duration", 0.0)
            prompt = track.get("prompt", "")
            title = track.get("title", "")
            
            logger.info(f"Generated track: {title} ({audio_id}) - {audio_url}")
            
            # TODO: Store the audio asset in the workflow
            # For now, we just log it. In a full implementation, you'd:
            # 1. Look up the workflow by task_id
            # 2. Update the workflow's audio_asset with the generated audio
            # 3. Save the workflow back to the database
        
        return {
            "status": "success",
            "message": "Callback processed",
            "callbackType": callback_type,
            "task_id": task_id,
            "tracks_count": len(tracks_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Suno callback: {e}", exc_info=True)
        # Still return 200 to acknowledge receipt (don't want Kie.ai to retry)
        return {
            "status": "error",
            "message": f"Error processing callback: {str(e)}"
        }


@router.get("/suno-callback")
async def suno_callback_get():
    """
    GET endpoint for webhook verification.
    
    Returns:
        dict: Verification response
    """
    return {
        "status": "ok",
        "message": "Suno webhook endpoint is active"
    }

