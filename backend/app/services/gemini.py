"""
Service for generating storyboards using Google Gemini API.
"""

import json
import os
import base64
from typing import List, Dict, Any
import google.generativeai as genai
from app.models.storyboard import Storyboard, StoryboardShot, StoryboardGenerationRequest


# Initialize Gemini client
def _get_gemini_client():
    """
    Initialize and return Gemini client.

    Returns:
        GenerativeModel: Configured Gemini model instance
    """
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_AI_API_KEY environment variable not set")
    
    genai.configure(api_key=api_key)
    # Using Gemini 2.5 Flash as specified in plan
    return genai.GenerativeModel("gemini-2.0-flash-exp")


def generate_storyboard(request: StoryboardGenerationRequest) -> Storyboard:
    """
    Generate a storyboard with lyrics and video prompts using Gemini.

    Args:
        request: Storyboard generation request with theme and style guide

    Returns:
        Storyboard: Generated storyboard with shots

    Raises:
        ValueError: If API key is missing or generation fails
        Exception: If API call fails
    """
    model = _get_gemini_client()
    
    # Detect if this is children's content
    is_childrens_content = (
        "children" in request.style_guide.lower() or 
        "lullaby" in request.style_guide.lower() or 
        "under 2" in request.style_guide.lower() or 
        "under 5" in request.style_guide.lower() or
        "toddler" in request.style_guide.lower() or
        "baby" in request.style_guide.lower()
    )
    is_christian_content = (
        "christian" in request.style_guide.lower() or 
        "biblical" in request.style_guide.lower() or 
        "faith" in request.style_guide.lower() or
        "values" in request.style_guide.lower()
    )
    
    # Construct system prompt with explicit JSON structure requirement
    system_prompt = f"""You are a creative director generating a music video storyboard.

Theme: {request.theme}
Style Guide: {request.style_guide}

Generate original lyrics and break them down into time-coded shots. Each shot should have:
- A lyric line
- A duration in seconds (typically 2-5 seconds per line)
- A detailed video prompt that incorporates the style guide keywords

CRITICAL: You MUST output ONLY valid JSON in this exact structure (no markdown, no code blocks):
[
  {{
    "line_index": 1,
    "lyric_line": "The lyric text here",
    "duration_seconds": 3.0,
    "base_video_prompt": "Detailed video prompt that includes style guide elements"
  }},
  {{
    "line_index": 2,
    "lyric_line": "Next lyric line",
    "duration_seconds": 3.5,
    "base_video_prompt": "Next shot description with style guide"
  }}
]

Requirements:
- Include style guide keywords in EVERY base_video_prompt
- Generate {request.num_shots if request.num_shots else "8-12"} shots
- Total duration should be approximately {request.max_duration if request.max_duration else "30-60"} seconds
- Make lyrics creative and match the theme
- Each base_video_prompt should be detailed and cinematic"""
    
    # Add children's content guidelines
    if is_childrens_content:
        system_prompt += """

CHILDREN'S CONTENT REQUIREMENTS (Ages 0-5):
- Lyrics must be age-appropriate, simple, and easy to understand
- For lullabies (ages 0-2): Focus on calming, sleep-inducing themes (stars, moons, dreams, peaceful nature)
- For educational content (ages 2-5): Include positive messages and simple life lessons
- Avoid any scary, dark, or intense themes
- Use gentle, soothing language
- Visual prompts should be calming and peaceful
- Maintain a consistent, friendly tone throughout"""
    
    # Add Christian values integration
    if is_christian_content:
        system_prompt += """

CHRISTIAN VALUES INTEGRATION:
- Naturally integrate biblical themes and Christian values into lyrics
- Focus on: love, kindness, forgiveness, gratitude, honesty, helping others
- Use age-appropriate biblical stories and parables (Noah's Ark, Good Samaritan, etc.)
- Visual prompts should show positive role models demonstrating Christian character
- Emphasize community, fellowship, and caring for others
- Use nature and creation themes that reflect God's love
- Ensure all content aligns with Christian values and teachings"""
    
    system_prompt += "\n\nOutput ONLY the JSON array, nothing else."

    try:
        response = model.generate_content(system_prompt)
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        # Parse JSON
        shots_data = json.loads(response_text)
        
        # Validate and create StoryboardShot objects
        shots = []
        for idx, shot_data in enumerate(shots_data, start=1):
            # Ensure line_index matches array position
            shot_data["line_index"] = idx
            shot = StoryboardShot(**shot_data)
            shots.append(shot)
        
        # Create storyboard
        storyboard = Storyboard(
            shots=shots,
            theme=request.theme,
            style_guide=request.style_guide,
        )
        
        return storyboard
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON from Gemini response: {e}")
    except Exception as e:
        raise Exception(f"Gemini API error: {e}")


def analyze_style_from_images(images: List[str]) -> Dict[str, Any]:
    """
    Analyze reference images/videos to extract comprehensive style guide information.
    
    Uses Gemini Vision API to analyze visual style and extract detailed style guide
    sections including animation style, character design, color palette, lighting,
    camera composition, textures, mood, and more.
    
    Args:
        images: List of base64-encoded image data URIs (data:image/...;base64,...)
                Can also include video frames extracted as images
    
    Returns:
        Dict containing style guide sections:
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
        ValueError: If API key is missing or no images provided
        Exception: If API call fails
    """
    if not images:
        raise ValueError("At least one image is required for style analysis")
    
    model = _get_gemini_client()
    
    # Extract base64 data from data URIs
    image_parts = []
    for img_data_uri in images:
        mime_type = "image/png"  # Default
        
        # Handle data URI format: data:image/png;base64,<base64_data>
        if img_data_uri.startswith("data:"):
            # Extract mime type and base64 data
            parts = img_data_uri.split(",", 1)
            header = parts[0]  # data:image/png;base64
            base64_data = parts[1]
            
            # Extract mime type from header
            if "image/" in header:
                mime_part = header.split("image/")[1].split(";")[0]
                mime_type = f"image/{mime_part}"
        else:
            # Assume it's already base64
            base64_data = img_data_uri
        
        # Decode base64 to bytes for Gemini
        try:
            image_bytes = base64.b64decode(base64_data)
            image_parts.append({
                "mime_type": mime_type,
                "data": image_bytes
            })
        except Exception as e:
            raise ValueError(f"Failed to decode image data: {e}")
    
    # Construct comprehensive analysis prompt
    analysis_prompt = """You are a professional visual style analyst for animation and video production. 
Analyze the provided reference images/videos and extract detailed style guide information.

For each reference image, analyze and extract:

1. **Animation Style**: Describe the animation technique (2D, 3D, stop-motion, etc.), animation quality, 
   movement style, frame rate feel, and any distinctive animation characteristics.

2. **Character Design**: Describe character proportions, facial features, body shapes, clothing style, 
   distinctive design elements, silhouette, and any recurring character design patterns.

3. **Color Palette**: List the dominant colors, color temperature (warm/cool), saturation levels, 
   color harmony (complementary, analogous, etc.), and any specific color combinations or gradients.

4. **Lighting & Atmosphere**: Describe lighting style (soft/hard, natural/artificial), light sources, 
   shadow characteristics, atmosphere, fog/haze, time of day, and overall lighting mood.

5. **Camera & Composition**: Describe camera angles, shot types (close-up, wide, etc.), composition rules 
   (rule of thirds, symmetry, etc.), depth of field, camera movement style, and framing choices.

6. **Textures & Materials**: Describe surface textures, material properties (shiny, matte, rough, smooth), 
   rendering style, detail level, and any distinctive material characteristics.

7. **Mood & Tone**: Describe the emotional tone, atmosphere, energy level, and overall feeling conveyed 
   by the visual style.

8. **Reference Films/Inspiration**: If recognizable, list similar films, shows, or animation studios 
   that share this style.

9. **Additional Notes**: Any other important style characteristics, technical details, or unique elements 
   that should be preserved.

CRITICAL: Output ONLY valid JSON in this exact structure (no markdown, no code blocks):
{
  "animationStyle": "Detailed description of animation style...",
  "characterDesign": "Detailed description of character design...",
  "colorPalette": "Detailed description of color palette...",
  "lighting": "Detailed description of lighting and atmosphere...",
  "cameraComposition": "Detailed description of camera work and composition...",
  "texturesMaterials": "Detailed description of textures and materials...",
  "moodTone": "Detailed description of mood and tone...",
  "referenceFilms": "List of similar films/shows/studios (comma-separated)",
  "additionalNotes": "Any additional style notes..."
}

Be thorough and specific. Extract every visual detail that would help recreate this exact style."""
    
    try:
        # Use Gemini Vision API with multiple images
        response = model.generate_content([analysis_prompt] + image_parts)
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        # Parse JSON response
        style_data = json.loads(response_text)
        
        # Ensure all required fields exist with defaults
        result = {
            "animationStyle": style_data.get("animationStyle", ""),
            "characterDesign": style_data.get("characterDesign", ""),
            "colorPalette": style_data.get("colorPalette", ""),
            "lighting": style_data.get("lighting", ""),
            "cameraComposition": style_data.get("cameraComposition", ""),
            "texturesMaterials": style_data.get("texturesMaterials", ""),
            "moodTone": style_data.get("moodTone", ""),
            "referenceFilms": style_data.get("referenceFilms", ""),
            "additionalNotes": style_data.get("additionalNotes", ""),
        }
        
        return result
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON from Gemini response: {e}")
    except Exception as e:
        raise Exception(f"Gemini Vision API error: {e}")




