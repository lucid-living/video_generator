"""
Service for generating video clips using Kling or Hailuo API.
"""

import os
import time
import jwt
import httpx
from typing import List, Optional
from app.models.workflow import VideoClip, FinalVideoPrompt, ReferenceImage


def _generate_kling_jwt_token(access_key: str, secret_key: str) -> str:
    """
    Generate JWT token for Kling AI API authentication.
    
    Args:
        access_key: Kling API access key
        secret_key: Kling API secret key
        
    Returns:
        str: JWT token string
        
    Note:
        Follows JWT (RFC 7519) standard as specified by Kling AI.
        The token includes the access key in the payload and is signed with the secret key.
    """
    # JWT payload - typically includes issuer (access key) and expiration
    # Expiration set to 1 hour (3600 seconds) - adjust based on API requirements
    payload = {
        "iss": access_key,  # Issuer: access key
        "exp": int(time.time()) + 3600,  # Expiration: 1 hour from now
        "iat": int(time.time()),  # Issued at: current time
    }
    
    # Generate JWT token using HS256 algorithm (HMAC SHA-256)
    # The secret key is used as the signing key
    token = jwt.encode(
        payload,
        secret_key,
        algorithm="HS256"
    )
    
    return token


def _get_kling_auth_token() -> str:
    """
    Get authentication token for Kling API.
    
    Returns:
        str: Bearer token for Authorization header
        
    Raises:
        ValueError: If required credentials are missing
    """
    # Check for new JWT-based authentication (Access Key + Secret Key)
    access_key = os.getenv("KLING_ACCESS_KEY")
    secret_key = os.getenv("KLING_SECRET_KEY")
    
    if access_key and secret_key:
        # Generate JWT token using access key and secret key
        return _generate_kling_jwt_token(access_key, secret_key)
    
    # Fallback to legacy single API key (for backward compatibility)
    api_key = os.getenv("KLING_API_KEY")
    if api_key:
        return api_key
    
    raise ValueError(
        "Kling API credentials not found. "
        "Please set either KLING_ACCESS_KEY and KLING_SECRET_KEY, "
        "or KLING_API_KEY (legacy)."
    )


async def generate_video_clip(
    prompt: FinalVideoPrompt,
    reference_images: Optional[List[ReferenceImage]] = None,
) -> VideoClip:
    """
    Generate a video clip using Kling or Hailuo API.

    Args:
        prompt: Final video prompt with style guide and base prompt
        reference_images: Optional reference images for style consistency

    Returns:
        VideoClip: Generated video clip with file URL

    Raises:
        ValueError: If API key is missing
        Exception: If API call fails

    Note:
        Kling AI uses JWT-based authentication with Access Key and Secret Key.
        The JWT token is generated and used as a Bearer token.
    """
    # Determine which API to use (Kling or Hailuo)
    kling_access_key = os.getenv("KLING_ACCESS_KEY")
    kling_secret_key = os.getenv("KLING_SECRET_KEY")
    kling_legacy_key = os.getenv("KLING_API_KEY")
    hailuo_key = os.getenv("HAILUO_API_KEY")
    
    use_kling = bool(kling_access_key and kling_secret_key) or bool(kling_legacy_key)
    
    if not use_kling and not hailuo_key:
        raise ValueError(
            "Either Kling API credentials (KLING_ACCESS_KEY + KLING_SECRET_KEY) "
            "or HAILUO_API_KEY must be set"
        )
    
    # Get authentication token
    if use_kling:
        auth_token = _get_kling_auth_token()
        api_url = os.getenv("KLING_API_URL", "https://api.kling.ai")
    else:
        auth_token = hailuo_key
        api_url = os.getenv("HAILUO_API_URL", "https://api.hailuo.ai")
    
    # Prepare reference images
    ref_images_data = []
    if reference_images:
        for ref_img in reference_images:
            if ref_img.image_id in prompt.reference_image_ids:
                ref_images_data.append(ref_img.base64_data)
    
    # Construct request payload
    payload = {
        "prompt": prompt.final_prompt,
        "duration": prompt.duration_seconds,
    }
    
    if ref_images_data:
        payload["reference_images"] = ref_images_data
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # Note: Actual endpoint may vary - adjust based on API documentation
            endpoint = "/v1/video/generate" if use_kling else "/v1/generate"
            response = await client.post(
                f"{api_url}{endpoint}",
                json=payload,
                headers=headers,
                timeout=300.0,  # Video generation can take time
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Extract video URL and metadata
            # Note: Adjust field names based on actual API response
            clip_url = data.get("video_url") or data.get("url")
            duration = data.get("duration", prompt.duration_seconds)
            
            if not clip_url:
                raise ValueError("Video API did not return video URL")
            
            return VideoClip(
                shot_index=prompt.shot_index,
                clip_url=clip_url,
                duration_seconds=duration,
                final_prompt=prompt.final_prompt,
            )
            
        except httpx.HTTPStatusError as e:
            raise Exception(
                f"Video API HTTP error: {e.response.status_code} - {e.response.text}"
            )
        except Exception as e:
            raise Exception(f"Video API error: {e}")


