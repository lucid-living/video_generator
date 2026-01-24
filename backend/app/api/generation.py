"""
API endpoints for Phase 3: Video Generation and Assembly.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.workflow import VideoClip, FinalVideoPrompt, ReferenceImage
from app.services.video import generate_video_clip

router = APIRouter(prefix="/api/generation", tags=["generation"])


@router.post("/generate-clip", response_model=VideoClip)
async def create_video_clip(
    prompt: FinalVideoPrompt,
    reference_images: Optional[List[ReferenceImage]] = None,
) -> VideoClip:
    """
    Generate a video clip for a single shot.

    Args:
        prompt: Final video prompt with style guide and base prompt
        reference_images: Optional reference images for style consistency

    Returns:
        VideoClip: Generated video clip

    Raises:
        HTTPException: If generation fails

    Note:
        This endpoint orchestrates video generation. Actual video assembly
        is handled separately.
    """
    try:
        clip = await generate_video_clip(prompt, reference_images)
        return clip
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")




