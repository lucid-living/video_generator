"""
Pydantic models for workflow state and data structures.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.storyboard import Storyboard, StoryboardShot


class ReferenceImage(BaseModel):
    """
    Reference image generated for visual consistency.

    Attributes:
        image_id: Unique identifier for the image
        base64_data: Base64 encoded PNG image data
        description: Description of what the image represents
        shot_indices: List of shot indices this image applies to
        approved: Whether user has approved this image (optional)
        storage_url: URL if saved to storage (optional)
        saved_to_style_guide: Whether saved to style guide (optional)
    """

    image_id: str = Field(..., description="Unique identifier")
    base64_data: str = Field(..., description="Base64 encoded PNG data")
    description: str = Field(..., description="Description of the image")
    shot_indices: List[int] = Field(default_factory=list, description="Applicable shot indices")
    approved: bool | None = Field(None, description="Whether user approved this image")
    favorited: bool | None = Field(None, description="Whether user favorited this image (beyond approval)")
    rating: int | None = Field(None, ge=1, le=5, description="Optional 1-5 star rating")
    storage_url: str | None = Field(None, description="URL if saved to storage")
    saved_to_style_guide: bool | None = Field(None, description="Whether saved to style guide")


class AudioAsset(BaseModel):
    """
    Generated audio asset from Suno API.

    Attributes:
        audio_id: Unique identifier
        file_url: URL or path to audio file (can be "task://{task_id}" for pending tasks)
        duration_seconds: Duration of the audio track (0.0 for pending tasks)
        lyrics: Full lyrics used to generate the audio
    """

    audio_id: str = Field(..., description="Unique identifier")
    file_url: str = Field(..., description="URL or path to audio file (or task://{task_id} for pending)")
    duration_seconds: float = Field(..., ge=0, description="Duration in seconds (0.0 for pending tasks)")
    lyrics: str = Field(..., description="Full lyrics text")


class VideoClip(BaseModel):
    """
    Generated video clip for a single shot.

    Attributes:
        shot_index: The storyboard shot this clip corresponds to
        clip_url: URL or path to video clip file
        duration_seconds: Duration of the clip
        final_prompt: The complete prompt used for generation
    """

    shot_index: int = Field(..., ge=1, description="Corresponding shot index")
    clip_url: str = Field(..., description="URL or path to clip file")
    duration_seconds: float = Field(..., gt=0, description="Duration in seconds")
    final_prompt: str = Field(..., description="Complete prompt used")


class WorkflowState(BaseModel):
    """
    Complete workflow state persisted in Firestore.

    Attributes:
        workflow_id: Unique identifier for the workflow
        storyboard: The generated storyboard
        audio_asset: Generated audio (if available)
        reference_images: Generated reference images (if available)
        video_clips: Generated video clips (if available)
        final_video_url: URL to final assembled video (if available)
        status: Current workflow status
    """

    workflow_id: str = Field(..., description="Unique workflow identifier")
    storyboard: Storyboard = Field(..., description="The storyboard")
    audio_asset: Optional[AudioAsset] = Field(None, description="Generated audio")
    reference_images: List[ReferenceImage] = Field(
        default_factory=list, description="Reference images"
    )
    video_clips: List[VideoClip] = Field(default_factory=list, description="Video clips")
    final_video_url: Optional[str] = Field(None, description="Final video URL")
    status: str = Field(
        default="planning",
        description="Workflow status: planning, assets, generation, complete",
    )


class FinalVideoPrompt(BaseModel):
    """
    Final video prompt with all context for video generation.

    Attributes:
        shot_index: The storyboard shot index
        final_prompt: Complete prompt (style guide + base prompt)
        duration_seconds: Duration for this clip
        reference_image_ids: IDs of reference images to use
    """

    shot_index: int = Field(..., ge=1, description="Storyboard shot index")
    final_prompt: str = Field(..., description="Complete prompt with style guide")
    duration_seconds: float = Field(..., gt=0, description="Duration in seconds")
    reference_image_ids: List[str] = Field(
        default_factory=list, description="Reference image IDs to use"
    )




