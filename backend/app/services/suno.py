"""
Service for generating music using Suno.
Note: Suno API is not publicly available, so this service provides
a URL/instructions for manual generation via Suno's web interface.
"""

import os
from typing import Optional
from app.models.workflow import AudioAsset


def get_suno_generation_url(lyrics: str, style: Optional[str] = None) -> str:
    """
    Generate a Suno URL with pre-filled lyrics for manual generation.
    
    Args:
        lyrics: Complete lyrics text (reconstructed from storyboard)
        style: Optional music style description
        
    Returns:
        str: URL to Suno's web interface with lyrics pre-filled
    """
    # Suno's web interface URL
    base_url = "https://suno.com/create"
    
    # Encode lyrics and style as URL parameters
    # Note: Suno may not support direct URL parameters, but we can provide
    # a link that opens their create page with instructions
    params = []
    if lyrics:
        # Truncate lyrics if too long for URL
        lyrics_short = lyrics[:500] if len(lyrics) > 500 else lyrics
        params.append(f"prompt={lyrics_short.replace(' ', '+')}")
    if style:
        params.append(f"style={style.replace(' ', '+')}")
    
    if params:
        return f"{base_url}?{'&'.join(params)}"
    return base_url


async def generate_music(lyrics: str, style: Optional[str] = None) -> AudioAsset:
    """
    Get Suno generation URL and instructions (no API available).
    
    Args:
        lyrics: Complete lyrics text (reconstructed from storyboard)
        style: Optional music style description

    Returns:
        AudioAsset: Audio asset with generation URL and instructions
        
    Note:
        Since Suno API is not publicly available, this returns a URL
        to Suno's web interface where users can manually generate music.
        The audio_asset will need to be updated manually with the generated
        audio URL after the user creates it on Suno.
    """
    # Check if API key exists (for future use if API becomes available)
    api_key = os.getenv("SUNO_API_KEY")
    
    if api_key:
        # If API key exists, try to use API (future implementation)
        # For now, fall back to URL generation
        pass
    
    # Generate URL for manual creation
    generation_url = get_suno_generation_url(lyrics, style)
    
    # Return AudioAsset with the generation URL
    # The user will need to manually update this with the actual audio URL
    # after generating on Suno
    return AudioAsset(
        audio_id=f"suno_manual_{hash(lyrics) % 1000000}",
        file_url=generation_url,  # This is the generation URL, not the audio file
        duration_seconds=0.0,  # Will be updated after generation
        lyrics=lyrics,
    )



