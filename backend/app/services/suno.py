"""
Service for generating music using Kie.ai Suno API.
"""

import os
import httpx
from typing import Optional, Dict, Any
from app.models.workflow import AudioAsset


def _get_kie_api_key() -> str:
    """Get Kie.ai API key from environment."""
    # Single canonical env var name for clarity
    api_key = os.getenv("KIE_AI_API_KEY")
    if not api_key:
        raise ValueError("KIE_AI_API_KEY environment variable is required for Suno API")
    return api_key


def _get_backend_url() -> str:
    """Get backend URL for callback."""
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    return backend_url


async def generate_music_via_api(
    lyrics: str,
    style: Optional[str] = None,
    title: Optional[str] = None,
    instrumental: bool = False,
    model: str = "V5",
    custom_mode: bool = True,
) -> Dict[str, Any]:
    """
    Generate music using Kie.ai Suno API.
    
    Args:
        lyrics: Lyrics text (used as prompt in custom mode, or description in non-custom mode)
        style: Music style (required in custom mode)
        title: Track title (required in custom mode)
        instrumental: Whether to generate instrumental music
        model: Model version (V4, V4_5, V4_5PLUS, V4_5ALL, V5)
        custom_mode: Whether to use custom mode (more control)
        
    Returns:
        Dict with task_id for tracking generation status
        
    Raises:
        ValueError: If required parameters are missing
        Exception: If API call fails
    """
    api_key = _get_kie_api_key()
    backend_url = _get_backend_url()
    callback_url = f"{backend_url}/api/webhooks/suno-callback"
    
    # Prepare request payload
    payload: Dict[str, Any] = {
        "customMode": custom_mode,
        "instrumental": instrumental,
        "callBackUrl": callback_url,
        "model": model,
    }
    
    if custom_mode:
        # Custom mode requirements
        if not style:
            raise ValueError("style is required when customMode is true")
        if not title:
            raise ValueError("title is required when customMode is true")
        
        payload["style"] = style
        payload["title"] = title
        
        if not instrumental:
            if not lyrics:
                raise ValueError("prompt (lyrics) is required when customMode is true and instrumental is false")
            payload["prompt"] = lyrics
    else:
        # Non-custom mode: only prompt is required
        if not lyrics:
            raise ValueError("prompt is required when customMode is false")
        payload["prompt"] = lyrics
        # Truncate to 500 characters for non-custom mode
        if len(lyrics) > 500:
            payload["prompt"] = lyrics[:500]
    
    # Make API request
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.kie.ai/api/v1/generate",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        
        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("msg", f"HTTP {response.status_code}")
            raise Exception(f"Suno API error: {error_msg} (code: {response.status_code})")
        
        result = response.json()
        
        if result.get("code") != 200:
            error_msg = result.get("msg", "Unknown error")
            raise Exception(f"Suno API error: {error_msg} (code: {result.get('code')})")
        
        return result.get("data", {})


async def get_music_details(task_id: str) -> Dict[str, Any]:
    """
    Get music generation task details and results.
    
    Args:
        task_id: Task ID returned from generate_music_via_api
        
    Returns:
        Dict with task status and results if complete
        Returns None if task not found (404) - task may still be processing
    """
    api_key = _get_kie_api_key()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Try the task endpoint - note: Kie.ai may not have a polling endpoint
        # The callback is the primary mechanism for getting results
        try:
            response = await client.get(
                f"https://api.kie.ai/api/v1/task/{task_id}",
                headers={
                    "Authorization": f"Bearer {api_key}",
                },
            )
        except httpx.RequestError as e:
            raise Exception(f"Failed to connect to Kie.ai API: {str(e)}")
        
        # Handle 404 - task might not exist yet or endpoint doesn't exist
        if response.status_code == 404:
            # Task not found - might still be processing or endpoint doesn't exist
            # Return a status indicating we should wait for callback
            return {
                "status": "processing",
                "message": "Task not found - may still be processing. Waiting for callback.",
                "task_id": task_id
            }
        
        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("msg", f"HTTP {response.status_code}")
            raise Exception(f"Suno API error: {error_msg} (code: {response.status_code})")
        
        result = response.json()
        
        if result.get("code") != 200:
            error_msg = result.get("msg", "Unknown error")
            raise Exception(f"Suno API error: {error_msg} (code: {result.get('code')})")
        
        return result.get("data", {})


def convert_suno_result_to_audio_asset(
    suno_data: Dict[str, Any],
    lyrics: str,
    task_id: Optional[str] = None
) -> AudioAsset:
    """
    Convert Suno API result to AudioAsset.
    
    Args:
        suno_data: Single track data from Suno API callback
        lyrics: Original lyrics used for generation
        task_id: Optional task ID
        
    Returns:
        AudioAsset object
    """
    audio_id = suno_data.get("id", task_id or f"suno_{hash(lyrics) % 1000000}")
    audio_url = suno_data.get("audio_url", "")
    duration = suno_data.get("duration", 0.0)
    
    return AudioAsset(
        audio_id=str(audio_id),
        file_url=audio_url,
        duration_seconds=float(duration),
        lyrics=lyrics,
    )


# Legacy function for backward compatibility
async def generate_music(lyrics: str, style: Optional[str] = None) -> AudioAsset:
    """
    Legacy function - attempts to use API if key is available, otherwise returns manual URL.
    
    Args:
        lyrics: Complete lyrics text
        style: Optional music style description
        
    Returns:
        AudioAsset: Audio asset (may contain task_id if API is used)
    """
    try:
        # Try to use API
        api_key = os.getenv("KIE_AI_API_KEY")
        if api_key:
            # Use non-custom mode for simplicity (only prompt required)
            result = await generate_music_via_api(
                lyrics=lyrics,
                style=style,
                title="Generated Track",
                instrumental=False,
                model="V5",
                custom_mode=False,  # Simpler mode
            )
            
            task_id = result.get("taskId")
            if task_id:
                # Return AudioAsset with task_id in file_url temporarily
                # The callback will update this with the actual audio URL
                return AudioAsset(
                    audio_id=f"suno_task_{task_id}",
                    file_url=f"task://{task_id}",  # Special format to indicate it's a task
                    duration_seconds=0.0,
                    lyrics=lyrics,
                )
    except Exception as e:
        # Fall back to manual generation if API fails
        print(f"Suno API not available, falling back to manual: {e}")
    
    # Fallback: return manual generation URL
    generation_url = get_suno_generation_url(lyrics, style)
    
    return AudioAsset(
        audio_id=f"suno_manual_{hash(lyrics) % 1000000}",
        file_url=generation_url,
        duration_seconds=0.0,
        lyrics=lyrics,
    )


def get_suno_generation_url(lyrics: str, style: Optional[str] = None) -> str:
    """
    Generate a Suno URL with pre-filled lyrics for manual generation.
    (Legacy function for fallback)
    
    Args:
        lyrics: Complete lyrics text
        style: Optional music style description
        
    Returns:
        str: URL to Suno's web interface
    """
    return "https://suno.com/create"
