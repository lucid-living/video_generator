"""
API endpoints for image feedback and learning system.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from app.services.image_learning_service import (
    analyze_approved_image,
    get_learning_insights,
    enhance_prompt_with_learning
)

router = APIRouter(prefix="/api/learning", tags=["learning"])


class ImageFeedbackRequest(BaseModel):
    """Request model for submitting image feedback."""
    
    image_id: str = Field(..., description="Image ID")
    workflow_id: str = Field(..., description="Workflow ID")
    approved: bool = Field(default=False, description="Whether image is approved")
    favorited: bool = Field(default=False, description="Whether image is favorited")
    rating: Optional[int] = Field(None, ge=1, le=5, description="Optional 1-5 star rating")
    description: str = Field(..., description="Image description")
    style_guide: Optional[str] = Field(None, description="Style guide used")
    prompt_used: Optional[str] = Field(None, description="Prompt used to generate")
    shot_indices: list[int] = Field(default_factory=list, description="Shot indices")
    channel_name: Optional[str] = Field(None, description="Channel name")
    content_type: Optional[str] = Field(None, description="Content type")


class LearningInsightsRequest(BaseModel):
    """Request model for getting learning insights."""
    
    channel_name: Optional[str] = Field(None, description="Filter by channel name")
    content_type: Optional[str] = Field(None, description="Filter by content type")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of images to analyze")


@router.post("/feedback")
async def submit_image_feedback(feedback: ImageFeedbackRequest) -> Dict[str, Any]:
    """
    Submit feedback for a generated image.
    
    This stores the feedback and triggers analysis if the image is approved/favorited.
    """
    try:
        import os
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Prepare feedback data
        feedback_data = {
            "image_id": feedback.image_id,
            "workflow_id": feedback.workflow_id,
            "approved": feedback.approved,
            "favorited": feedback.favorited,
            "rating": feedback.rating,
            "description": feedback.description,
            "style_guide": feedback.style_guide,
            "prompt_used": feedback.prompt_used,
            "shot_indices": feedback.shot_indices,
            "channel_name": feedback.channel_name,
            "content_type": feedback.content_type,
        }
        
        # If approved or favorited, trigger analysis
        if feedback.approved or feedback.favorited:
            # Note: We'd need the actual image data for full analysis
            # For now, we'll analyze based on description and prompt
            analysis = await analyze_approved_image(
                image=None,  # Would need actual image for vision analysis
                style_guide=feedback.style_guide or "",
                prompt_used=feedback.prompt_used or "",
                channel_name=feedback.channel_name,
                content_type=feedback.content_type
            )
            
            feedback_data["visual_characteristics"] = analysis.get("visual_characteristics", {})
            feedback_data["success_factors"] = analysis.get("success_factors", {})
        
        # Upsert feedback
        result = supabase.table("image_feedback").upsert(
            feedback_data,
            on_conflict="image_id"
        ).execute()
        
        return {
            "success": True,
            "message": "Feedback saved successfully",
            "analyzed": feedback.approved or feedback.favorited
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")


@router.get("/favorited-images")
async def get_favorited_images(
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get favorited images with their image data from workflows.
    
    Returns favorited images that can be used as references.
    """
    try:
        import os
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Get favorited image feedback
        response = supabase.table("image_feedback").select(
            "image_id, workflow_id, description, visual_characteristics"
        ).eq("favorited", True).order("created_at", desc=True).limit(limit).execute()
        
        if not response.data:
            return []
        
        feedback_data = response.data if hasattr(response, 'data') else []
        
        # Get actual image data from workflows
        favorited_images = []
        for feedback in feedback_data:
            workflow_id = feedback["workflow_id"]
            image_id = feedback["image_id"]
            
            # Get workflow
            workflow_response = supabase.table("video_workflows").select(
                "reference_images"
            ).eq("workflow_id", workflow_id).execute()
            
            if not workflow_response.data:
                continue
            
            workflow = workflow_response.data[0]
            
            # Find the image in the workflow
            reference_images = workflow.get("reference_images", [])
            image = next((img for img in reference_images if img.get("image_id") == image_id), None)
            
            if image:
                favorited_images.append({
                    "image_id": image_id,
                    "base64_data": image.get("base64_data") or "",
                    "storage_url": image.get("storage_url"),
                    "description": feedback["description"],
                    "visual_characteristics": feedback.get("visual_characteristics"),
                })
        
        return favorited_images
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get favorited images: {str(e)}")


@router.get("/insights")
async def get_insights(
    channel_name: Optional[str] = None,
    content_type: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Get learning insights from approved/favorited images.
    
    Returns patterns and recommendations based on user feedback.
    """
    try:
        insights = await get_learning_insights(
            channel_name=channel_name,
            content_type=content_type,
            limit=limit
        )
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get insights: {str(e)}")


@router.post("/enhance-prompt")
async def enhance_prompt(
    base_prompt: str,
    style_guide: str,
    channel_name: Optional[str] = None,
    content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enhance a prompt with learned patterns from approved images.
    
    Args:
        base_prompt: Original prompt
        style_guide: Style guide
        channel_name: Channel name for filtering insights
        content_type: Content type for filtering insights
        
    Returns:
        Enhanced prompt with learning insights
    """
    try:
        # Get learning insights
        insights = await get_learning_insights(
            channel_name=channel_name,
            content_type=content_type,
            limit=10
        )
        
        # Enhance prompt
        enhanced = enhance_prompt_with_learning(
            base_prompt=base_prompt,
            style_guide=style_guide,
            learning_insights=insights
        )
        
        return {
            "original_prompt": base_prompt,
            "enhanced_prompt": enhanced,
            "insights_used": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enhance prompt: {str(e)}")
