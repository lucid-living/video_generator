"""
Service for analyzing visual style from reference images using OpenAI GPT-4 Vision API.
"""

import json
import os
import base64
from typing import List, Dict, Any
import httpx
from openai import OpenAI


def analyze_style_from_images(images: List[str]) -> Dict[str, Any]:
    """
    Analyze reference images to extract comprehensive style guide information.
    
    Uses OpenAI GPT-4 Vision API to analyze visual style and extract detailed style guide
    sections including animation style, character design, color palette, lighting,
    camera composition, textures, mood, and more.
    
    Args:
        images: List of base64-encoded image data URIs (data:image/...;base64,...)
    
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
    
    # Get OpenAI API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable not set. "
            "Please set your OpenAI API key in the .env file."
        )
    
    client = OpenAI(api_key=api_key)
    
    # Limit to first 5 images to avoid token limits and improve reliability
    # Large base64 images can exceed token limits
    images_to_analyze = images[:5] if len(images) > 5 else images
    if len(images) > 5:
        print(f"Warning: Analyzing only first 5 of {len(images)} images to avoid token limits")
    
    # Prepare image content for OpenAI Vision API
    image_contents = []
    for img_data_uri in images_to_analyze:
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
        
        # OpenAI Vision API expects image_url format with base64
        image_contents.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{base64_data}"
            }
        })
    
    # Construct comprehensive analysis prompt
    analysis_prompt = """You are a professional visual style analyst specializing in animation and video production. Your task is to analyze reference images and extract detailed technical style guide information for creating consistent visual content.

IMPORTANT: These images are reference materials for a creative project. Analyze them purely from a technical and artistic perspective to extract visual style characteristics.

For the provided reference images, analyze and extract the following technical style information:

1. **Animation Style**: Describe the animation technique (2D, 3D, stop-motion, etc.), animation quality, movement style, frame rate feel, and any distinctive animation characteristics.

2. **Character Design**: Describe character proportions, facial features, body shapes, clothing style, distinctive design elements, silhouette, and any recurring character design patterns.

3. **Color Palette**: List the dominant colors, color temperature (warm/cool), saturation levels, color harmony (complementary, analogous, etc.), and any specific color combinations or gradients.

4. **Lighting & Atmosphere**: Describe lighting style (soft/hard, natural/artificial), light sources, shadow characteristics, atmosphere, fog/haze, time of day, and overall lighting mood.

5. **Camera & Composition**: Describe camera angles, shot types (close-up, wide, etc.), composition rules (rule of thirds, symmetry, etc.), depth of field, camera movement style, and framing choices.

6. **Textures & Materials**: Describe surface textures, material properties (shiny, matte, rough, smooth), rendering style, detail level, and any distinctive material characteristics.

7. **Mood & Tone**: Describe the emotional tone, atmosphere, energy level, and overall feeling conveyed by the visual style.

8. **Reference Films/Inspiration**: If recognizable, list similar films, shows, or animation studios that share this style.

9. **Additional Notes**: Any other important style characteristics, technical details, or unique elements that should be preserved.

You MUST respond with ONLY valid JSON in this exact structure (no markdown, no code blocks, no additional text):
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

Be thorough and specific. Extract every visual detail that would help recreate this exact style. Respond with JSON only."""
    
    response_text = ""
    try:
        # Use OpenAI GPT-4 Vision API
        response = client.chat.completions.create(
            model="gpt-4o",  # GPT-4 Omni supports vision and is more cost-effective
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": analysis_prompt},
                        *image_contents
                    ]
                }
            ],
            max_tokens=3000,  # Increased for detailed analysis
            temperature=0.2,  # Lower temperature for more consistent, factual analysis
            response_format={"type": "json_object"}  # Force JSON response
        )
        
        response_text = response.choices[0].message.content.strip()
        
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
        raise ValueError(f"Failed to parse JSON from OpenAI response: {e}. Response was: {response_text[:500] if response_text else 'No response'}")
    except Exception as e:
        raise Exception(f"OpenAI Vision API error: {e}")

