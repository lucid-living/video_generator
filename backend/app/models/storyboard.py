"""
Pydantic models for storyboard data structures.
"""

from typing import List
from pydantic import BaseModel, Field


class StoryboardShot(BaseModel):
    """
    Represents a single shot in the storyboard.

    Attributes:
        line_index: Sequential index of the lyric line
        lyric_line: The text of the lyric for this shot
        duration_seconds: Duration of this shot in seconds
        base_video_prompt: The video generation prompt for this shot
    """

    line_index: int = Field(..., ge=1, description="Sequential index starting from 1")
    lyric_line: str = Field(..., min_length=1, description="The lyric text for this shot")
    duration_seconds: float = Field(..., gt=0, description="Duration in seconds")
    base_video_prompt: str = Field(
        ..., min_length=1, description="Video generation prompt for this shot"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "line_index": 1,
                "lyric_line": "The neon city sleeps beneath a digital rain,",
                "duration_seconds": 3.0,
                "base_video_prompt": "Cinematic high-angle shot of a lone figure standing on a skyscraper rooftop, looking down at neon streets. Heavy fog.",
            }
        }


class Storyboard(BaseModel):
    """
    Complete storyboard containing all shots and metadata.

    Attributes:
        shots: List of storyboard shots in sequential order
        theme: The overall theme of the video
        style_guide: Visual style guide text
        total_duration: Total duration in seconds (calculated)
    """

    shots: List[StoryboardShot] = Field(..., min_items=1, description="List of storyboard shots")
    theme: str = Field(..., min_length=1, description="Overall theme of the video")
    style_guide: str = Field(..., min_length=1, description="Visual style guide text")
    total_duration: float = Field(default=0.0, description="Total duration in seconds")

    def __init__(self, **data):
        super().__init__(**data)
        # Calculate total duration
        if self.shots:
            self.total_duration = sum(shot.duration_seconds for shot in self.shots)

    class Config:
        json_schema_extra = {
            "example": {
                "theme": "Cyberpunk pirate adventure",
                "style_guide": "Neon-lit cyberpunk aesthetic, dark urban environments, neon lighting, futuristic technology",
                "shots": [
                    {
                        "line_index": 1,
                        "lyric_line": "The neon city sleeps beneath a digital rain,",
                        "duration_seconds": 3.0,
                        "base_video_prompt": "Cinematic high-angle shot of a lone figure standing on a skyscraper rooftop...",
                    }
                ],
            }
        }


class StoryboardGenerationRequest(BaseModel):
    """
    Request model for storyboard generation.

    Attributes:
        theme: The theme for the video
        style_guide: Visual style guide text
        num_shots: Optional number of shots to generate (defaults to AI decision)
        max_duration: Optional maximum total duration in seconds
    """

    theme: str = Field(..., min_length=1, description="Theme for the video")
    style_guide: str = Field(..., min_length=1, description="Visual style guide")
    num_shots: int | None = Field(None, ge=1, description="Optional number of shots")
    max_duration: float | None = Field(None, gt=0, description="Optional max duration in seconds")




