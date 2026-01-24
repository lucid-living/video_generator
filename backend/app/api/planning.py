"""
API endpoints for Phase 1: Creative Planning and Storyboarding.
"""

from fastapi import APIRouter, HTTPException
from app.models.storyboard import Storyboard, StoryboardGenerationRequest
from app.services.gemini import generate_storyboard

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.post("/generate-storyboard", response_model=Storyboard)
async def create_storyboard(request: StoryboardGenerationRequest) -> Storyboard:
    """
    Generate a storyboard with lyrics and video prompts.

    Args:
        request: Storyboard generation request with theme and style guide

    Returns:
        Storyboard: Generated storyboard

    Raises:
        HTTPException: If generation fails
    """
    try:
        storyboard = generate_storyboard(request)
        return storyboard
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storyboard generation failed: {str(e)}")




