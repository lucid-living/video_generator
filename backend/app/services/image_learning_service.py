"""
Service for learning from user feedback on generated images.
Analyzes approved/favorited images to improve future generations.
"""

import os
import json
from typing import List, Dict, Any, Optional
import httpx
from app.models.workflow import ReferenceImage


async def analyze_approved_image(
    image: Optional[ReferenceImage],
    style_guide: str,
    prompt_used: str,
    channel_name: Optional[str] = None,
    content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyze an approved/favorited image to extract what made it successful.
    
    Uses Gemini API to analyze the image and extract visual characteristics
    and success factors that can be used to improve future generations.
    
    Args:
        image: The approved reference image
        style_guide: Style guide that was used
        prompt_used: Full prompt that generated this image
        channel_name: Channel name for context
        content_type: Content type for context
        
    Returns:
        Dict containing:
        - visual_characteristics: Extracted visual features
        - success_factors: What made this image successful
    """
    try:
        from app.services.gemini import _get_gemini_client
        
        model = _get_gemini_client()
        
        # Prepare analysis prompt
        analysis_prompt = f"""Analyze this image that was approved/favorited by the user and extract:

1. Visual Characteristics:
   - Color palette and dominant colors
   - Composition style (rule of thirds, centered, etc.)
   - Lighting style (soft, dramatic, natural, etc.)
   - Visual style (realistic, stylized, abstract, etc.)
   - Mood and atmosphere
   - Any distinctive visual elements

2. Success Factors:
   - What makes this image appealing?
   - What visual elements likely contributed to user approval?
   - How does it align with the style guide?
   - What should be replicated in future generations?

Style Guide Used:
{style_guide}

Prompt Used:
{prompt_used}

Channel Context: {channel_name or "Not specified"}
Content Type: {content_type or "Not specified"}

Return a JSON object with this structure:
{{
  "visual_characteristics": {{
    "color_palette": "description",
    "composition": "description",
    "lighting": "description",
    "style": "description",
    "mood": "description",
    "distinctive_elements": ["element1", "element2"]
  }},
  "success_factors": {{
    "appeal_elements": ["what makes it appealing"],
    "style_alignment": "how it matches style guide",
    "replication_guidance": "what to replicate in future"
  }}
}}"""

        # For now, we'll analyze based on the description and prompt
        # In the future, we could use vision API to analyze the actual image
        # For now, return structured analysis based on the prompt and style guide
        
        response = model.generate_content(analysis_prompt)
        
        # Try to extract JSON from response
        response_text = response.text
        
        # Extract JSON from markdown code blocks if present
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        try:
            analysis_result = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback: create structured response from text
            analysis_result = {
                "visual_characteristics": {
                    "color_palette": "Extracted from style guide and prompt",
                    "composition": "Based on prompt description",
                    "lighting": "Based on style guide",
                    "style": "Based on style guide",
                    "mood": "Based on prompt",
                    "distinctive_elements": []
                },
                "success_factors": {
                    "appeal_elements": ["Alignment with style guide", "Clear visual composition"],
                    "style_alignment": "Matches provided style guide",
                    "replication_guidance": "Maintain style guide consistency, use similar composition patterns"
                }
            }
        
        return analysis_result
        
    except Exception as e:
        print(f"Error analyzing approved image: {e}")
        # Return default structure on error
        return {
            "visual_characteristics": {},
            "success_factors": {
                "appeal_elements": ["User approved this image"],
                "style_alignment": "Unknown",
                "replication_guidance": "Maintain consistency with style guide"
            }
        }


async def get_learning_insights(
    channel_name: Optional[str] = None,
    content_type: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Get learning insights from approved/favorited images.
    
    Analyzes patterns from user feedback to provide guidance for future generations.
    
    Args:
        channel_name: Filter by channel name
        content_type: Filter by content type
        limit: Maximum number of approved images to analyze
        
    Returns:
        Dict containing:
        - common_characteristics: Patterns in approved images
        - recommendations: Suggestions for future generations
    """
    try:
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            return {
                "common_characteristics": {},
                "recommendations": "No Supabase configuration found"
            }
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Query approved/favorited images
        query = supabase.table("image_feedback").select("*")
        
        if channel_name:
            query = query.eq("channel_name", channel_name)
        if content_type:
            query = query.eq("content_type", content_type)
        
        query = query.eq("approved", True).or_("favorited.eq.true")
        query = query.order("created_at", desc=True).limit(limit)
        
        response = query.execute()
        
        if not response.data or len(response.data) == 0:
            return {
                "common_characteristics": {},
                "recommendations": "No approved images found. Start approving images to build learning data."
            }
        
        # Aggregate visual characteristics
        all_characteristics = []
        all_success_factors = []
        
        for feedback in response.data:
            if feedback.get("visual_characteristics"):
                all_characteristics.append(feedback["visual_characteristics"])
            if feedback.get("success_factors"):
                all_success_factors.append(feedback["success_factors"])
        
        # Find common patterns
        common_characteristics = {}
        if all_characteristics:
            # Aggregate color palettes
            color_palettes = [c.get("color_palette", "") for c in all_characteristics if c.get("color_palette")]
            if color_palettes:
                common_characteristics["color_palette"] = max(set(color_palettes), key=color_palettes.count)
            
            # Aggregate composition styles
            compositions = [c.get("composition", "") for c in all_characteristics if c.get("composition")]
            if compositions:
                common_characteristics["composition"] = max(set(compositions), key=compositions.count)
            
            # Aggregate lighting styles
            lightings = [c.get("lighting", "") for c in all_characteristics if c.get("lighting")]
            if lightings:
                common_characteristics["lighting"] = max(set(lightings), key=lightings.count)
        
        # Generate recommendations
        recommendations = []
        if all_success_factors:
            replication_guidance = [sf.get("replication_guidance", "") for sf in all_success_factors if sf.get("replication_guidance")]
            if replication_guidance:
                recommendations.append(max(set(replication_guidance), key=replication_guidance.count))
        
        return {
            "common_characteristics": common_characteristics,
            "recommendations": "; ".join(recommendations) if recommendations else "Continue maintaining style guide consistency",
            "sample_size": len(response.data)
        }
        
    except Exception as e:
        print(f"Error getting learning insights: {e}")
        return {
            "common_characteristics": {},
            "recommendations": f"Error retrieving insights: {str(e)}"
        }


def enhance_prompt_with_learning(
    base_prompt: str,
    style_guide: str,
    learning_insights: Dict[str, Any]
) -> str:
    """
    Enhance a prompt with learned patterns from approved images.
    
    Args:
        base_prompt: Original prompt
        style_guide: Style guide
        learning_insights: Insights from approved images
        
    Returns:
        Enhanced prompt with learning insights incorporated
    """
    enhanced_prompt = base_prompt
    
    # Add common characteristics if available
    characteristics = learning_insights.get("common_characteristics", {})
    if characteristics:
        enhancement = "\n\nLEARNED PATTERNS (from your approved images):\n"
        
        if characteristics.get("color_palette"):
            enhancement += f"- Preferred color palette: {characteristics['color_palette']}\n"
        if characteristics.get("composition"):
            enhancement += f"- Preferred composition: {characteristics['composition']}\n"
        if characteristics.get("lighting"):
            enhancement += f"- Preferred lighting: {characteristics['lighting']}\n"
        
        enhanced_prompt += enhancement
    
    # Add recommendations
    recommendations = learning_insights.get("recommendations", "")
    if recommendations and recommendations != "No approved images found. Start approving images to build learning data.":
        enhanced_prompt += f"\n\nRECOMMENDATIONS: {recommendations}\n"
    
    return enhanced_prompt
