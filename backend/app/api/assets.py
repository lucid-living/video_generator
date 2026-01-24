"""
API endpoints for Phase 2: Asset Generation (Music and Images).
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from app.models.workflow import AudioAsset, ReferenceImage
from app.services.suno import generate_music
from app.services.imagen import generate_reference_image
from app.services.style_analyzer import analyze_style_from_images
from app.services.google_drive import upload_image_to_drive, delete_image_from_drive

router = APIRouter(prefix="/api/assets", tags=["assets"])


class ReferenceImageRequest(BaseModel):
    """Request model for generating reference images."""
    
    style_guide: str = Field(..., description="Visual style guide text")
    description: str = Field(..., description="Description of what to generate")
    shot_indices: List[int] = Field(..., description="List of shot indices this image applies to")
    previous_images: List[dict] = Field(default_factory=list, description="Previous generated images for consistency")
    style_guide_images: List[str] = Field(default_factory=list, description="Reference images from style guide (base64)")
    use_image_reference: bool = Field(default=False, description="Use previous image as direct reference (requires API that supports image inputs)")
    reference_image_base64: str = Field(default="", description="Base64 encoded reference image to use for img2img generation (deprecated, use reference_images_base64)")
    reference_images_base64: List[str] = Field(default_factory=list, description="List of base64 encoded reference images to use for img2img generation (up to 14 for Gemini API)", max_length=14)


class StyleAnalysisRequest(BaseModel):
    """Request model for analyzing style from reference images/videos."""
    
    images: List[str] = Field(..., description="List of base64-encoded image data URIs to analyze", min_length=1)


@router.post("/generate-music", response_model=AudioAsset)
async def create_music(lyrics: str, style: str | None = None) -> AudioAsset:
    """
    Get Suno generation URL and instructions.
    
    Note: Suno API is not publicly available. This endpoint returns
    a URL to Suno's web interface where users can manually generate music.

    Args:
        lyrics: Complete lyrics text
        style: Optional music style description

    Returns:
        AudioAsset: Audio asset with generation URL (user must manually
                   update with actual audio URL after generating on Suno)

    Raises:
        HTTPException: If generation fails
    """
    try:
        audio = await generate_music(lyrics, style)
        return audio
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Music generation failed: {str(e)}")


@router.post("/generate-reference-image", response_model=ReferenceImage)
async def create_reference_image(request: ReferenceImageRequest) -> ReferenceImage:
    """
    Generate a reference image for visual consistency.

    Args:
        request: Reference image generation request with style_guide, description, and shot_indices

    Returns:
        ReferenceImage: Generated reference image

    Raises:
        HTTPException: If generation fails
    """
    try:
        # Support both old single image format and new multiple images format
        reference_images = request.reference_images_base64
        if not reference_images and request.reference_image_base64:
            # Backward compatibility: convert single image to list
            reference_images = [request.reference_image_base64]
        
        # Use image reference if any reference images are provided
        use_image_reference = request.use_image_reference or len(reference_images) > 0
        
        image = await generate_reference_image(
            request.style_guide,
            request.description,
            request.shot_indices,
            request.previous_images,
            request.style_guide_images,
            use_image_reference,
            reference_images
        )
        return image
    except ValueError as e:
        # Include the full error message for debugging
        error_msg = str(e)
        import traceback
        print(f"ValueError in generate-reference-image: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        # Include full error details for debugging
        error_msg = f"Image generation failed: {str(e)}"
        import traceback
        print(f"Exception in generate-reference-image: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/analyze-style", response_model=Dict[str, Any])
async def analyze_style_guide(request: StyleAnalysisRequest) -> Dict[str, Any]:
    """
    Analyze reference images/videos to extract comprehensive style guide information.
    
    Uses OpenAI GPT-4 Vision API to analyze visual style and automatically populate
    style guide sections based on the provided reference images.
    
    Args:
        request: Style analysis request with list of base64-encoded images
    
    Returns:
        Dict containing extracted style guide sections:
        {
            "animationStyle": str,
            "characterDesign": str,
            "colorPalette": str,
            "lighting": str,
            "cameraComposition": str,
            "texturesMaterials": str,
            "moodTone": str,
            "referenceFilms": str,
            "additionalNotes": str
        }
    
    Raises:
        HTTPException: If analysis fails
    """
    try:
        print(f"Received analyze-style request with {len(request.images) if request.images else 0} image(s)")
        
        # Validate request
        if not request.images:
            print("ERROR: No images in request")
            raise HTTPException(
                status_code=400, 
                detail="No images provided. Please upload at least one image."
            )
        
        if len(request.images) == 0:
            print("ERROR: Images array is empty")
            raise HTTPException(
                status_code=400,
                detail="Images array is empty. Please upload at least one image."
            )
        
        # Check image format
        first_image = request.images[0]
        if not first_image:
            print("ERROR: First image is None or empty")
            raise HTTPException(
                status_code=400,
                detail="Invalid image data: first image is empty."
            )
        
        print(f"First image length: {len(first_image)} characters")
        print(f"First image starts with: {first_image[:50]}...")
        
        print(f"Analyzing {len(request.images)} image(s) for style extraction...")
        
        style_data = analyze_style_from_images(request.images)
        print("Style analysis completed successfully")
        return style_data
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        print(f"ValueError in style analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Style analysis error: {error_trace}")
        raise HTTPException(
            status_code=500, 
            detail=f"Style analysis failed: {str(e)}"
        )


class GoogleDriveUploadRequest(BaseModel):
    """Request model for uploading images to Google Drive."""
    
    image_data_base64: str = Field(..., description="Base64 encoded image data (data URI format)")
    image_id: str = Field(..., description="Unique identifier for the image")
    workflow_id: str = Field(..., description="Workflow/project identifier")
    description: str = Field(..., description="Description of the image")


class GoogleDriveDeleteRequest(BaseModel):
    """Request model for deleting images from Google Drive."""
    
    file_url: str = Field(..., description="Google Drive file URL or file ID")


@router.post("/upload-to-drive")
async def upload_image_to_google_drive(request: GoogleDriveUploadRequest) -> dict:
    """
    Upload an image to Google Drive in the workflow's folder.
    
    Args:
        request: Upload request with image data, image_id, workflow_id, and description
        
    Returns:
        dict: {"url": str} - Public shareable URL of the uploaded image
        
    Raises:
        HTTPException: If upload fails
    """
    try:
        url = await upload_image_to_drive(
            request.image_data_base64,
            request.image_id,
            request.workflow_id,
            request.description
        )
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Drive upload failed: {str(e)}")


@router.delete("/delete-from-drive")
async def delete_image_from_google_drive(request: GoogleDriveDeleteRequest) -> dict:
    """
    Delete an image from Google Drive.
    
    Args:
        request: Delete request with file URL or file ID
        
    Returns:
        dict: {"success": bool} - Success status
        
    Raises:
        HTTPException: If deletion fails
    """
    try:
        await delete_image_from_drive(request.file_url)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Drive deletion failed: {str(e)}")



