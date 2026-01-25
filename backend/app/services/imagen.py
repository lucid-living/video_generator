"""
Service for generating reference images using OpenAI DALL-E API.
"""

import os
import base64
import asyncio
from typing import List
import httpx
import json
from app.models.workflow import ReferenceImage
from app.services.task_manager import get_task_manager




async def generate_reference_image(
    style_guide: str, 
    description: str, 
    shot_indices: List[int], 
    previous_images: List[dict] = None,
    style_guide_images: List[str] = None,
    use_image_reference: bool = False,
    reference_images_base64: List[str] = None
) -> ReferenceImage:
    """
    Generate a reference image for visual consistency using OpenAI DALL-E API.

    Args:
        style_guide: Visual style guide text (can be structured with sections)
        description: Description of what to generate (character, setting, prop)
        shot_indices: List of shot indices this image applies to
        previous_images: List of previous image descriptions for consistency
        style_guide_images: List of base64 reference images from style guide
        use_image_reference: Whether to use image references (for Gemini API)
        reference_images_base64: List of base64 encoded reference images (up to 14 for Gemini API) or single string for backward compatibility

    Returns:
        ReferenceImage: Generated image with base64 data

    Raises:
        ValueError: If API key is missing or generation fails
        Exception: If API call fails
    """
    if previous_images is None:
        previous_images = []
    if style_guide_images is None:
        style_guide_images = []
    
    # Normalize reference_images_base64 to always be a list
    if reference_images_base64 is None:
        reference_images_base64 = []
    elif isinstance(reference_images_base64, str):
        # Backward compatibility: convert single string to list
        reference_images_base64 = [reference_images_base64] if reference_images_base64 else []
    elif isinstance(reference_images_base64, list):
        if len(reference_images_base64) > 14:
            raise ValueError(f"Maximum 14 reference images allowed for Gemini API, got {len(reference_images_base64)}")
    else:
        # Unknown type, convert to empty list
        reference_images_base64 = []
    
    # Enhance Pixar style guide with more specific references
    enhanced_style_guide = style_guide
    is_childrens_content = (
        "children" in style_guide.lower() or 
        "lullaby" in style_guide.lower() or 
        "under 2" in style_guide.lower() or 
        "under 5" in style_guide.lower() or
        "toddler" in style_guide.lower() or
        "baby" in style_guide.lower()
    )
    is_christian_content = (
        "christian" in style_guide.lower() or 
        "biblical" in style_guide.lower() or 
        "faith" in style_guide.lower() or
        "values" in style_guide.lower()
    )
    
    if "pixar" in style_guide.lower() or "3d animation" in style_guide.lower():
        pixar_enhancements = f"""

CRITICAL STYLE REQUIREMENTS - Must match Pixar Animation Studios exactly:
- Style reference: "Inside Out", "Soul", "Coco", "Up", "Toy Story", "Monsters Inc"
- 3D animated character style with smooth, rounded forms
- Expressive, exaggerated facial features showing clear emotions
- Bright, saturated colors with soft, diffused lighting
- Clean, polished 3D surfaces with subtle subsurface scattering (skin glow)
- Consistent character proportions and design language across all frames
- Stylized realism: realistic human proportions but with cartoonish appeal and charm
- Soft, natural shadows with ambient occlusion in creases
- NO photorealistic textures - everything must look like high-quality 3D animation
- Warm, inviting color palette with good contrast between light and shadow
- Smooth, flowing character poses that suggest movement
- Characters should have the distinctive Pixar "appeal" - friendly, expressive, charming"""
        
        # Add children's content safety guidelines
        if is_childrens_content:
            pixar_enhancements += """

CHILDREN'S CONTENT SAFETY & APPROPRIATENESS (Ages 0-5):
- All content must be age-appropriate for children under 5
- Calming, soothing visual elements for lullabies (ages 0-2)
- Soft, gentle movements and transitions
- No sudden movements, loud colors, or startling elements
- Characters must be friendly, approachable, and non-threatening
- Use calming color palettes: soft blues, gentle purples, warm pastels
- Bedtime/sleep themes: stars, moons, clouds, peaceful landscapes
- Educational content (ages 2-5): clear, simple visual storytelling
- Characters should model positive behaviors and emotions
- Avoid any scary, dark, or intense imagery"""
        
        # Add Christian values integration
        if is_christian_content:
            pixar_enhancements += """

CHRISTIAN VALUES & CONTENT GUIDELINES:
- Integrate biblical themes and values naturally into visual storytelling
- Characters should demonstrate: kindness, love, forgiveness, gratitude, honesty
- Visual metaphors for faith: light, growth, community, helping others
- Positive role models showing Christian character traits
- Age-appropriate biblical stories and parables (Noah's Ark, Good Samaritan, etc.)
- Inclusive, welcoming visual representation of community and fellowship
- Nature and creation themes that reflect God's love
- Avoid any content that contradicts Christian values
- Focus on love, hope, and positive messages"""
        
        enhanced_style_guide = style_guide + pixar_enhancements
    
    # Add reference images context (describe them in the prompt since DALL-E 3 doesn't accept image inputs)
    reference_images_context = ""
    if style_guide_images:
        reference_images_context = "\n\nSTYLE GUIDE REFERENCE IMAGES:\n"
        reference_images_context += "The style guide includes reference images that establish the visual style. "
        reference_images_context += "These images show the desired character design, color palette, lighting, and overall aesthetic. "
        reference_images_context += "This image MUST match the visual style shown in those references.\n"
    
    # Build consistency context from previous images
    # This is critical for character consistency across shots
    consistency_context = ""
    if previous_images:
        consistency_context = "\n\nCRITICAL - Character and Visual Consistency:\n"
        consistency_context += "The following images show the SAME characters from previous shots. This new image MUST:\n"
        consistency_context += "- Use the EXACT same character design, facial features, proportions, and style as shown in previous images\n"
        consistency_context += "- Match the same color palette, lighting style, and visual aesthetic\n"
        consistency_context += "- Maintain the same animation style and quality\n"
        consistency_context += "- Continue the same visual narrative sequence\n\n"
        consistency_context += "Previous shots in sequence (use these as character/style references):\n"
        for idx, prev_img in enumerate(previous_images[-3:], 1):  # Reference last 3 images
            prev_desc = prev_img.get("description", "")
            prev_shot = prev_img.get("shot_indices", [])
            # Use full description, not truncated, for better character reference
            shot_num = prev_shot[0] if prev_shot else '?'
            consistency_context += f"  Shot {shot_num}: {prev_desc}\n"
    
    # Construct prompt with priority on storyboard prompt
    # Strategy: Put storyboard prompt first, then style guide, then consistency context
    # This ensures the storyboard prompt isn't truncated if we hit the limit
    base_prompt = f"Video prompt from storyboard: {description}"
    
    # Calculate available space for style guide and context (reserve space for base prompt)
    # DALL-E 3 has 4000 character limit, reserve at least 500 for base prompt + formatting
    available_space = 3500 - len(base_prompt) - len(consistency_context) - len(reference_images_context)
    
    # Truncate style guide if needed, but preserve base prompt
    style_guide_text = enhanced_style_guide
    if len(style_guide_text) + len(reference_images_context) + len(consistency_context) + len(base_prompt) > 4000:
        # Prioritize: base prompt > consistency > style guide
        style_guide_max_len = max(500, available_space - 200)  # Keep at least 500 chars for style guide
        if len(style_guide_text) > style_guide_max_len:
            style_guide_text = style_guide_text[:style_guide_max_len] + "..."
            print(f"Warning: Style guide truncated to {style_guide_max_len} characters to preserve storyboard prompt")
    
    # Construct final prompt: base prompt first, then style guide, then context
    prompt = f"{base_prompt}\n\nStyle Guide: {style_guide_text}{reference_images_context}{consistency_context}"
    
    # Final validation - if still too long, truncate from the end (but preserve base prompt)
    if len(prompt) > 4000:
        # Keep base prompt + style guide start, truncate consistency context if needed
        base_and_style = f"{base_prompt}\n\nStyle Guide: {style_guide_text}{reference_images_context}"
        remaining_space = 4000 - len(base_and_style) - 50  # Reserve 50 for formatting
        if remaining_space > 0 and consistency_context:
            truncated_consistency = consistency_context[:remaining_space] + "..."
            prompt = f"{base_and_style}{truncated_consistency}"
        else:
            prompt = base_and_style[:3997] + "..."
        print(f"Warning: Prompt truncated to 4000 characters (preserved storyboard prompt)")
    
    # Check if Kie.ai API key is available - prefer Nano Banana Pro for better quality
    kie_api_key = os.getenv("KIE_AI_API_KEY")
    
    # If image reference is requested, use Nano Banana Pro API via Kie.ai (supports image inputs)
    if use_image_reference and reference_images_base64:
        return await _generate_with_nano_banana_pro(
            prompt, description, shot_indices, reference_images_base64, style_guide
        )
    
    # If Kie.ai API key is available, use Nano Banana Pro even without reference image
    # (better quality and character consistency)
    if kie_api_key:
        print(f"Using Nano Banana Pro via Kie.ai (no reference image)")
        # Generate without reference image - Nano Banana Pro still provides better quality
        return await _generate_with_nano_banana_pro(
            prompt, description, shot_indices, [], style_guide
        )
    
    # Fallback to DALL-E 3 if Kie.ai API key is not available
    # Get OpenAI API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable not set. "
            "Please set your OpenAI API key in the .env.local file."
        )
    
    # Log request details for debugging
    print(f"Generating image with DALL-E 3:")
    print(f"  Prompt length: {len(prompt)} characters")
    print(f"  Style guide: {style_guide[:50]}...")
    print(f"  Description: {description[:50]}...")
    
    try:
        # Use OpenAI DALL-E 3 API
        dalle_api_url = "https://api.openai.com/v1/images/generations"
        
        request_payload = {
            "model": "dall-e-3",
            "prompt": prompt,
            "size": "1792x1024",  # 16:9 landscape format for YouTube (closest to 1080x720)
            "quality": "standard",
            "response_format": "b64_json",  # Get base64 encoded image
        }
        
        print(f"Sending request to DALL-E API:")
        print(f"  URL: {dalle_api_url}")
        print(f"  Model: {request_payload['model']}")
        print(f"  Size: {request_payload['size']}")
        print(f"  Quality: {request_payload['quality']}")
        print(f"  Prompt: {prompt[:200]}...")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                dalle_api_url,
                json=request_payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,  # Image generation can take time
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response content-type: {response.headers.get('content-type', 'unknown')}")
            
            if response.status_code == 200:
                data = response.json()
                # DALL-E returns base64 in b64_json format
                if "data" in data and len(data["data"]) > 0:
                    image_base64 = data["data"][0]["b64_json"]
                    # Ensure proper data URI format
                    if not image_base64.startswith("data:image"):
                        image_base64 = f"data:image/png;base64,{image_base64}"
                else:
                    raise ValueError("DALL-E API did not return image data in response")
            elif response.status_code == 401:
                raise ValueError("Invalid OpenAI API key. Please check your OPENAI_API_KEY.")
            elif response.status_code == 429:
                raise ValueError(
                    "OpenAI API rate limit exceeded. Please wait a moment and try again."
                )
            elif response.status_code == 400:
                # Try to get detailed error from OpenAI API
                try:
                    error_data = response.json()
                    error_info = error_data.get("error", {})
                    error_msg = error_info.get("message", "Unknown error")
                    error_type = error_info.get("type", "Unknown type")
                    error_code = error_info.get("code", "Unknown code")
                    
                    # Log full error for debugging
                    print(f"DALL-E 400 Error Details:")
                    print(f"  Type: {error_type}")
                    print(f"  Code: {error_code}")
                    print(f"  Message: {error_msg}")
                    print(f"  Full response: {error_data}")
                    print(f"  Prompt length: {len(prompt)} characters")
                    print(f"  Prompt preview: {prompt[:100]}...")
                    
                    raise ValueError(f"DALL-E API error ({error_type}): {error_msg}")
                except Exception as parse_error:
                    # If we can't parse JSON, show raw response
                    error_text = response.text if hasattr(response, 'text') else str(response.content[:500])
                    print(f"DALL-E 400 Error (unparseable): {error_text}")
                    raise ValueError(f"DALL-E API error: {error_text}")
            else:
                # For other status codes, try to get error message
                try:
                    error_data = response.json()
                    error_info = error_data.get("error", {})
                    error_msg = error_info.get("message", response.text[:500])
                except:
                    error_msg = response.text[:500] if hasattr(response, 'text') else str(response.content[:500])
                
                print(f"DALL-E API Error Status {response.status_code}: {error_msg}")
                raise ValueError(f"DALL-E API error: Status {response.status_code} - {error_msg}")
        
        image_id = f"dalle_{hash(prompt) % 1000000}"
        
        return ReferenceImage(
            image_id=image_id,
            base64_data=image_base64,
            description=description,
            shot_indices=shot_indices,
        )
        
    except ValueError as e:
        raise e
    except httpx.TimeoutException:
        raise Exception("Image generation timed out. Please try again.")
    except Exception as e:
        raise Exception(f"Image generation error: {e}")


async def _generate_with_nano_banana_pro(
    prompt: str,
    description: str,
    shot_indices: List[int],
    reference_images_base64: List[str],
    style_guide: str = ""
) -> ReferenceImage:
    """
    Generate image using Nano Banana Pro API via Kie.ai with image-to-image support.
    This allows using multiple previous images as direct references for better character consistency.
    
    Nano Banana Pro uses Gemini 3.0 Pro Image and supports:
    - Up to 14 reference images (Gemini API limit)
    - 1K, 2K, and 4K resolution
    - Better character consistency than text-only prompts
    
    Args:
        prompt: Text prompt for generation
        description: Description of what to generate
        shot_indices: List of shot indices this image applies to
        reference_images_base64: List of base64 encoded reference images (data URI format), up to 14
        style_guide: Style guide text for additional context
    
    Returns:
        ReferenceImage: Generated image with base64 data
    
    Raises:
        ValueError: If API key is missing or generation fails
        Exception: If API call fails
    """
    # Get Kie.ai API key
    api_key = os.getenv("KIE_AI_API_KEY")
    if not api_key:
        raise ValueError(
            "KIE_AI_API_KEY environment variable not set. "
            "Please set your Kie.ai API key in the .env.local file to use image reference feature. "
            "Get your key at https://kie.ai/nano-banana-pro"
        )
    
    # Validate reference images count
    if len(reference_images_base64) > 14:
        raise ValueError(f"Maximum 14 reference images allowed for Gemini API, got {len(reference_images_base64)}")
    
    # Extract base64 data from data URIs if needed
    processed_images = []
    for ref_img in reference_images_base64:
        if ref_img.startswith("data:image"):
            # Extract base64 part: data:image/png;base64,<data>
            processed_images.append(ref_img.split(",", 1)[1])
        elif ref_img.startswith("http://") or ref_img.startswith("https://"):
            # Already a URL, use as-is
            processed_images.append(ref_img)
        else:
            # Assume it's already base64 without data URI prefix
            processed_images.append(ref_img)
    
    print(f"Generating image with Nano Banana Pro (via Kie.ai):")
    print(f"  Prompt length: {len(prompt)} characters")
    print(f"  Using {len(processed_images)} reference image(s)")
    print(f"  Resolution: 2K (for better quality)")
    
    # Get callback URL from environment
    # Try BACKEND_URL first, then Railway's RAILWAY_PUBLIC_DOMAIN, then default to localhost
    backend_url = os.getenv("BACKEND_URL")
    
    # If BACKEND_URL not set, try Railway's public domain (automatically set by Railway)
    if not backend_url:
        railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN")
        if railway_domain:
            backend_url = f"https://{railway_domain}"
            print(f"  Using Railway public domain: {backend_url}")
        else:
            backend_url = "http://localhost:8000"
    
    # Ensure URL has protocol (default to https for production, http for localhost)
    if not backend_url.startswith(("http://", "https://")):
        # If no protocol, assume https for production URLs
        backend_url = f"https://{backend_url}"
    
    # Ensure https for production URLs (Railway uses https)
    if any(domain in backend_url.lower() for domain in [".railway.app", ".up.railway.app", ".onrender.com", ".fly.dev"]):
        backend_url = backend_url.replace("http://", "https://")
    
    callback_url = f"{backend_url}/api/webhooks/kie-callback"
    
    # Check if callback URL is publicly accessible (not localhost)
    # Railway, Render, Fly.io, and other cloud platforms are publicly accessible
    use_callback = not any(host in backend_url.lower() for host in ["localhost", "127.0.0.1", "0.0.0.0"])
    
    if use_callback:
        print(f"  ✓ Callback URL is publicly accessible: {callback_url}")
        print(f"  Using callback mechanism (recommended for production)")
    else:
        print(f"  ⚠ WARNING: Callback URL is localhost ({backend_url}). Callbacks won't work.")
        print(f"  Falling back to polling for task status.")
    
    # Get task manager
    task_manager = get_task_manager()
    
    try:
        # Kie.ai Nano Banana Pro API endpoint (async task-based API)
        # Docs: https://docs.kie.ai/market/google/pro-image-to-image
        kie_api_url = "https://api.kie.ai/api/v1/jobs/createTask"
        
        # Prepare request payload according to Kie.ai API docs
        input_payload = {
            "prompt": prompt,
            "aspect_ratio": "16:9",  # Landscape format for video
            "resolution": "2K",  # 2K for good quality (options: 1K, 2K, 4K)
            "output_format": "png",  # PNG for better quality
        }
        
        # Only include image_input if we have reference images
        # IMPORTANT: Kie.ai API requires URLs, not data URIs or base64
        # If we only have base64, we'll skip image_input and use text-only generation
        # TODO: Upload base64 images to Supabase Storage first to get URLs
        image_urls = []
        for ref_img in processed_images:
            if ref_img.startswith("http://") or ref_img.startswith("https://"):
                # It's already a URL, use it directly
                image_urls.append(ref_img)
            else:
                # It's base64, we can't use it directly with Kie.ai API
                # Skip this image and log a warning
                print(f"  WARNING: Reference image provided as base64, but Kie.ai API requires URLs.")
                print(f"  Skipping this image. TODO: Upload image to Supabase Storage first to get a URL.")
        
        if image_urls:
            input_payload["image_input"] = image_urls
            print(f"  Using {len(image_urls)} reference image URL(s)")
        else:
            # If use_image_reference was requested but we have no valid URLs, 
            # we should still proceed with text-only generation rather than failing
            # The prompt will include style information from previous images
            print(f"  WARNING: No valid image URLs found in reference images.")
            print(f"  Reference images provided as base64, but Kie.ai API requires publicly accessible URLs.")
            print(f"  Falling back to text-only generation with enhanced prompt.")
            print(f"  TIP: Save images to Style Guide first to get URLs, or ensure images have storage_url set.")
            # Don't include image_input in payload - use text-only generation
        
        payload = {
            "model": "nano-banana-pro",
            "input": input_payload,
        }
        
        # Only include callback URL if it's publicly accessible
        if use_callback:
            payload["callBackUrl"] = callback_url
        
        print(f"Sending request to Kie.ai Nano Banana Pro API:")
        print(f"  URL: {kie_api_url}")
        print(f"  Model: {payload['model']}")
        if use_callback:
            print(f"  Callback URL: {callback_url}")
        else:
            print(f"  Using polling (callback URL not publicly accessible)")
        print(f"  Resolution: {payload['input']['resolution']}")
        print(f"  Aspect ratio: {payload['input']['aspect_ratio']}")
        print(f"  Reference images: {len(payload['input'].get('image_input', []))}")
        print(f"  Prompt: {prompt[:200]}...")
        
        async with httpx.AsyncClient() as client:
            # Step 1: Create the generation task
            response = await client.post(
                kie_api_url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,  # Initial request timeout
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response content-type: {response.headers.get('content-type', 'unknown')}")
            
            if response.status_code == 400:
                # Handle 400 Bad Request - usually means invalid parameters
                error_text = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get("msg") or error_data.get("message") or str(error_data)
                    print(f"Kie.ai 400 Error Details: {error_msg}")
                    raise ValueError(f"Kie.ai API rejected the request: {error_msg}. If you're using reference images, ensure they are publicly accessible URLs (not base64). Save images to Style Guide first to get URLs.")
                except:
                    print(f"Kie.ai 400 Error (unparseable): {error_text}")
                    raise ValueError(f"Kie.ai API rejected the request (400 Bad Request). This may happen if reference images are provided as base64 instead of URLs. Error: {error_text[:200]}")
            
            if response.status_code == 200:
                task_data = response.json()
                print(f"Full createTask response: {task_data}")
                
                if task_data.get("code") != 200:
                    raise ValueError(f"Kie.ai API error: {task_data.get('msg', 'Unknown error')}")
                
                # Parse response according to Kie.ai API structure
                result_data = task_data.get("data", {})
                
                # Check if task is already completed synchronously
                state = result_data.get("state")
                
                if state == "success":
                    # Task completed synchronously - extract result URLs from resultJson
                    image_base64 = await _extract_image_from_result(result_data, client)
                elif state == "fail":
                    # Task failed synchronously
                    fail_msg = result_data.get("failMsg") or result_data.get("fail_msg") or "Task failed"
                    fail_code = result_data.get("failCode") or result_data.get("fail_code") or "Unknown"
                    raise ValueError(f"Image generation failed ({fail_code}): {fail_msg}")
                else:
                    # Asynchronous - we have a taskId (or recordId)
                    task_id = result_data.get("taskId") or result_data.get("recordId")
                    record_id = result_data.get("recordId")  # Save recordId separately
                    if not task_id:
                        raise ValueError("Kie.ai API did not return a taskId/recordId and no result found in response")
                    
                    print(f"Task created: {task_id} (taskId: {result_data.get('taskId')}, recordId: {record_id})")
                    
                    if use_callback:
                        # Use callback mechanism (recommended for production - Railway is publicly accessible)
                        print(f"Waiting for callback at {callback_url}...")
                        print(f"  Callbacks should arrive immediately when task completes (per Kie.ai docs)")
                        
                        # Create task tracker and wait for callback
                        task_result = task_manager.create_task(task_id)
                        
                        # Wait for callback (with reasonable timeout, then fallback to polling)
                        # Per Kie.ai docs: callbacks arrive immediately when tasks complete
                        # For Railway/production: callbacks should work, but keep timeout as safety net
                        # Image generation can take 1-3 minutes, so give callbacks plenty of time
                        callback_timeout = 180  # 3 minutes - callbacks arrive immediately when done, this is max wait
                        try:
                            # Wait for callback to complete the task
                            print(f"  Waiting up to {callback_timeout}s for callback...")
                            callback_result_data = await task_result.wait(timeout=callback_timeout)
                            image_base64 = callback_result_data
                            print(f"  ✓ Received callback for task {task_id} (callback worked!)")
                        except TimeoutError:
                            print(f"  ⚠ Callback not received after {callback_timeout}s")
                            print(f"  This might indicate:")
                            print(f"    - Callback URL not accessible from Kie.ai servers")
                            print(f"    - Network/firewall issues")
                            print(f"    - Task taking longer than expected")
                            print(f"  Falling back to polling (reliable fallback)...")
                            # Fall through to polling
                            use_callback = False  # Switch to polling mode
                    
                    if not use_callback:
                        # Use polling mechanism (fallback or primary if localhost)
                        print(f"Polling for results...")
                        try:
                            # Pass recordId if available (createTask returns both taskId and recordId)
                            image_base64 = await _poll_for_task_completion(
                                task_id, api_key, client, max_polls=60, poll_interval=5, record_id=record_id
                            )
                        except ValueError as e:
                            # Log detailed error before re-raising
                            print(f"ERROR: Polling failed with ValueError: {e}")
                            print(f"  Task ID: {task_id}")
                            raise e
                        except Exception as e:
                            # Log detailed error before re-raising
                            print(f"ERROR: Polling failed with Exception: {e}")
                            print(f"  Task ID: {task_id}")
                            import traceback
                            print(f"  Traceback: {traceback.format_exc()}")
                            raise e
                    
            elif response.status_code == 401:
                raise ValueError("Invalid Kie.ai API key. Please check your KIE_AI_API_KEY.")
            elif response.status_code == 402:
                raise ValueError("Insufficient credits in your Kie.ai account.")
            elif response.status_code == 429:
                raise ValueError(
                    "Kie.ai API rate limit exceeded. Please wait a moment and try again."
                )
            else:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("msg") or error_data.get("message") or response.text[:500]
                except:
                    error_msg = response.text[:500] if hasattr(response, 'text') else str(response.content[:500])
                
                print(f"Kie.ai API Error Status {response.status_code}: {error_msg}")
                raise ValueError(f"Kie.ai Nano Banana Pro API error: Status {response.status_code} - {error_msg}")
        
        # Ensure we have an image before returning
        if 'image_base64' not in locals():
            raise ValueError("Image generation completed but no image data was retrieved")
        
        # Create image_id hash from prompt and reference images
        ref_images_hash = "".join([img[:50] for img in processed_images[:3]])  # Use first 3 images for hash
        image_id = f"nbp_{hash(prompt + ref_images_hash) % 1000000}"
        
        return ReferenceImage(
            image_id=image_id,
            base64_data=image_base64,
            description=description,
            shot_indices=shot_indices,
        )
        
    except ValueError as e:
        # Re-raise ValueError as-is (these are user-friendly error messages)
        raise e
    except httpx.TimeoutException:
        raise Exception("Image generation timed out. Please try again.")
    except Exception as e:
        # Include more context in error message
        error_msg = str(e)
        print(f"Nano Banana Pro error details: {error_msg}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise Exception(f"Nano Banana Pro image generation error: {error_msg}")


async def _poll_for_task_completion(
    task_id: str,
    api_key: str,
    client: httpx.AsyncClient,
    max_polls: int = 60,
    poll_interval: int = 5,
    record_id: str = None
) -> str:
    """
    Poll Kie.ai API for task completion using the correct endpoint.
    
    According to Kie.ai documentation:
    - Endpoint: GET /api/v1/jobs/recordInfo
    - Parameter: taskId as query parameter
    - Polling intervals: 2-3s initially, 5-10s after 30s, 15-30s after 2min
    
    Args:
        task_id: Task identifier
        api_key: Kie.ai API key
        client: HTTP client
        max_polls: Maximum number of polling attempts (default 60 = ~5-10 minutes)
        poll_interval: Initial seconds between polls (will be adjusted dynamically)
        record_id: Optional recordId (not used, but kept for compatibility)
    
    Returns:
        str: Base64 encoded image data URI
    
    Raises:
        ValueError: If polling fails or task fails
        Exception: If timeout exceeded
    """
    # Correct endpoint according to Kie.ai documentation
    status_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
    
    # Track elapsed time for dynamic polling intervals
    elapsed_seconds = 0
    
    for poll_count in range(max_polls):
        # Calculate dynamic polling interval based on elapsed time
        # Per Kie.ai best practices:
        # - First 30 seconds: every 2-3 seconds
        # - After 30 seconds: every 5-10 seconds  
        # - After 2 minutes: every 15-30 seconds
        if elapsed_seconds < 30:
            current_interval = 3  # 2-3 seconds
        elif elapsed_seconds < 120:
            current_interval = 8  # 5-10 seconds
        else:
            current_interval = 20  # 15-30 seconds
        
        # Wait before polling (except first iteration)
        if poll_count > 0:
            await asyncio.sleep(current_interval)
            elapsed_seconds += current_interval
        
        # Make GET request with taskId as query parameter
        try:
            print(f"  Poll {poll_count + 1}/{max_polls}: GET {status_url}?taskId={task_id}")
            status_response = await client.get(
                status_url,
                params={"taskId": task_id},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0,
            )
            print(f"  Response status: {status_response.status_code}")
        except Exception as e:
            print(f"  GET request failed: {e}")
            if poll_count >= 10:  # After 10 failed attempts, give up
                raise ValueError(f"Failed to connect to Kie.ai API: {e}")
            continue
        
        # Handle response according to Kie.ai API structure
        if status_response.status_code == 200:
            try:
                response_data = status_response.json()
            except Exception as e:
                print(f"  Failed to parse response JSON: {e}")
                print(f"  Response text: {status_response.text[:500]}")
                if poll_count >= 10:
                    raise ValueError(f"Failed to parse API response: {e}")
                continue
            
            # Check top-level response code
            response_code = response_data.get("code")
            if response_code != 200:
                error_msg = response_data.get("message") or response_data.get("msg") or "Unknown error"
                print(f"  Poll {poll_count + 1}/{max_polls}: API returned error code {response_code}: {error_msg}")
                if poll_count >= 10:
                    raise ValueError(f"Failed to get task status (code {response_code}): {error_msg}")
                continue
            
            # Extract task data
            task_status = response_data.get("data", {})
            state = task_status.get("state")
            
            print(f"  Poll {poll_count + 1}/{max_polls}: State = {state}")
            
            # Handle different task states per Kie.ai documentation
            if state == "success":
                # Task completed successfully - extract result URLs
                result_json_str = task_status.get("resultJson")
                if not result_json_str:
                    raise ValueError("Task completed but no resultJson field found")
                
                try:
                    result_json = json.loads(result_json_str)
                    # Try both resultUrls and image_urls (different models may use different keys)
                    result_urls = result_json.get("resultUrls") or result_json.get("image_urls") or []
                    
                    if not result_urls or len(result_urls) == 0:
                        raise ValueError("resultJson contains no resultUrls or image_urls")
                    
                    result_url = result_urls[0]
                    print(f"  Task completed. Result URL: {result_url[:100]}...")
                    
                    # Download the image
                    image_response = await client.get(result_url, timeout=30.0)
                    if image_response.status_code == 200:
                        image_bytes = image_response.content
                        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                        image_base64 = f"data:image/png;base64,{image_base64}"
                        print(f"  ✓ Successfully downloaded and encoded image")
                        return image_base64
                    else:
                        raise ValueError(f"Failed to download image: HTTP {image_response.status_code}")
                        
                except json.JSONDecodeError as e:
                    raise ValueError(f"Failed to parse resultJson: {e}")
                    
            elif state == "fail":
                # Task failed - extract error details
                fail_msg = task_status.get("failMsg") or task_status.get("fail_msg") or "Task failed"
                fail_code = task_status.get("failCode") or task_status.get("fail_code") or "Unknown"
                raise ValueError(f"Image generation failed ({fail_code}): {fail_msg}")
                
            elif state in ["waiting", "queuing", "generating", "pending", "processing", "running", "queued"]:
                # Task still processing - continue polling
                continue
                
            elif state is None:
                # No state returned - might be still initializing
                print(f"  No state returned, continuing to poll...")
                continue
                
            else:
                # Unknown state - log but continue polling
                print(f"  Unknown state: {state}, continuing to poll...")
                continue
                
        elif status_response.status_code == 404:
            # Task not found - this shouldn't happen if taskId is correct
            error_text = status_response.text[:500]
            print(f"  Poll {poll_count + 1}/{max_polls}: Task not found (404) - {error_text}")
            if poll_count >= 10:
                raise ValueError(f"Task not found (404). Verify taskId is correct: {task_id}")
            continue
            
        else:
            # Other HTTP errors
            error_text = status_response.text[:500]
            print(f"  Poll {poll_count + 1}/{max_polls}: HTTP {status_response.status_code} - {error_text}")
            if poll_count >= 10:
                raise ValueError(f"Status check failed: HTTP {status_response.status_code} - {error_text}")
            continue
    
    raise Exception(f"Image generation timed out after {max_polls * poll_interval} seconds")


async def _extract_image_from_result(result_data: dict, client: httpx.AsyncClient) -> str:
    """
    Extract image from Kie.ai API result data.
    
    Args:
        result_data: Result data from Kie.ai API response
        client: HTTP client for downloading images
    
    Returns:
        str: Base64 encoded image data URI
    
    Raises:
        ValueError: If image extraction fails
    """
    result_json_str = result_data.get("resultJson")
    if not result_json_str:
        raise ValueError("Task completed but no resultJson field found")
    
    try:
        result_json = json.loads(result_json_str)
        # Try both resultUrls and image_urls (different models may use different keys)
        result_urls = result_json.get("resultUrls") or result_json.get("image_urls") or []
        
        if not result_urls or len(result_urls) == 0:
            raise ValueError("resultJson contains no resultUrls or image_urls")
        
        result_url = result_urls[0]  # Use first result URL
        print(f"Result URL found: {result_url[:100]}...")
        
        # Download the image from the URL
        image_response = await client.get(result_url, timeout=30.0)
        if image_response.status_code == 200:
            image_bytes = image_response.content
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            image_base64 = f"data:image/png;base64,{image_base64}"
            print(f"Successfully downloaded and encoded image ({len(image_base64)} chars)")
            return image_base64
        else:
            raise ValueError(f"Failed to download image: HTTP {image_response.status_code}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse resultJson: {e}")


async def handle_kie_callback(
    task_id: str,
    state: str,
    result_json_str: str = None,
    fail_msg: str = None,
    fail_code: str = None
):
    """
    Handle callback from Kie.ai API when image generation completes.
    
    This function is called by the webhook endpoint when Kie.ai POSTs
    the task completion notification.
    
    Args:
        task_id: Task identifier
        state: Task state (success, fail, etc.)
        result_json_str: JSON string containing result URLs (if success)
        fail_msg: Error message (if failed)
        fail_code: Error code (if failed)
    
    Raises:
        ValueError: If task not found or callback processing fails
    """
    task_manager = get_task_manager()
    task_result = task_manager.get_task(task_id)
    
    if not task_result:
        print(f"Warning: Received callback for unknown task: {task_id}")
        return
    
    if state == "success":
        # Task completed successfully - extract image from result
        if not result_json_str:
            task_manager.fail_task(task_id, ValueError("Callback received success state but no resultJson"))
            return
        
        try:
            result_json = json.loads(result_json_str)
            # Try both resultUrls and image_urls (different models may use different keys)
            result_urls = result_json.get("resultUrls") or result_json.get("image_urls") or []
            
            if not result_urls or len(result_urls) == 0:
                task_manager.fail_task(task_id, ValueError("resultJson contains no resultUrls or image_urls"))
                return
            
            # Download the image asynchronously
            result_url = result_urls[0]
            print(f"Callback: Task {task_id} completed. Downloading image from {result_url[:100]}...")
            
            async with httpx.AsyncClient() as client:
                image_response = await client.get(result_url, timeout=30.0)
                if image_response.status_code == 200:
                    image_bytes = image_response.content
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    image_base64 = f"data:image/png;base64,{image_base64}"
                    print(f"Callback: Successfully downloaded image for task {task_id}")
                    task_manager.complete_task(task_id, image_base64)
                else:
                    task_manager.fail_task(
                        task_id,
                        ValueError(f"Failed to download image: HTTP {image_response.status_code}")
                    )
        except json.JSONDecodeError as e:
            task_manager.fail_task(task_id, ValueError(f"Failed to parse resultJson: {e}"))
        except Exception as e:
            task_manager.fail_task(task_id, Exception(f"Error processing callback: {e}"))
    
    elif state == "fail":
        # Task failed
        error_msg = fail_msg or "Task failed"
        error_code = fail_code or "Unknown"
        print(f"Callback: Task {task_id} failed ({error_code}): {error_msg}")
        task_manager.fail_task(
            task_id,
            ValueError(f"Image generation failed ({error_code}): {error_msg}")
        )
    else:
        print(f"Callback: Task {task_id} in state: {state} (not handling)")



