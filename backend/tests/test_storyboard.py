"""
Unit tests for storyboard models and generation.
"""

import pytest
from app.models.storyboard import StoryboardShot, Storyboard, StoryboardGenerationRequest


def test_storyboard_shot_creation():
    """Test creating a storyboard shot."""
    shot = StoryboardShot(
        line_index=1,
        lyric_line="Test lyric",
        duration_seconds=3.0,
        base_video_prompt="Test prompt",
    )
    assert shot.line_index == 1
    assert shot.lyric_line == "Test lyric"
    assert shot.duration_seconds == 3.0


def test_storyboard_shot_validation():
    """Test storyboard shot validation."""
    # Should fail with negative duration
    with pytest.raises(Exception):
        StoryboardShot(
            line_index=1,
            lyric_line="Test",
            duration_seconds=-1.0,
            base_video_prompt="Test",
        )


def test_storyboard_total_duration():
    """Test storyboard calculates total duration."""
    shots = [
        StoryboardShot(
            line_index=1,
            lyric_line="Line 1",
            duration_seconds=3.0,
            base_video_prompt="Prompt 1",
        ),
        StoryboardShot(
            line_index=2,
            lyric_line="Line 2",
            duration_seconds=4.0,
            base_video_prompt="Prompt 2",
        ),
    ]
    storyboard = Storyboard(
        shots=shots,
        theme="Test theme",
        style_guide="Test style",
    )
    assert storyboard.total_duration == 7.0


def test_storyboard_generation_request():
    """Test storyboard generation request model."""
    request = StoryboardGenerationRequest(
        theme="Test theme",
        style_guide="Test style",
        num_shots=5,
        max_duration=30.0,
    )
    assert request.theme == "Test theme"
    assert request.num_shots == 5




