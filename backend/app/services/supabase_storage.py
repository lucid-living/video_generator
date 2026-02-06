"""
Service for storing reference images in Supabase Storage.
Organizes images by workflow/project in storage buckets.
"""

import os
import base64
from typing import Optional
from supabase import create_client, Client


def _get_supabase_client() -> Client:
    """
    Initialize and return Supabase client.
    
    Returns:
        Client: Supabase client instance
        
    Raises:
        ValueError: If Supabase credentials are missing
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
        )
    
    return create_client(supabase_url, supabase_key)


# Storage bucket name for reference images
REFERENCE_IMAGES_BUCKET = "reference-images"


async def upload_image_to_storage(
    image_data_base64: str,
    image_id: str,
    workflow_id: str,
    description: str
) -> str:
    """
    Upload an image to Supabase Storage in the workflow's folder.
    
    Args:
        image_data_base64: Base64 encoded image data (data URI format, e.g., "data:image/png;base64,...")
        image_id: Unique identifier for the image
        workflow_id: Workflow/project identifier
        description: Description of the image (for metadata)
        
    Returns:
        str: Public URL of the uploaded image
        
    Raises:
        ValueError: If image data is invalid
        Exception: If upload fails
    """
    try:
        supabase = _get_supabase_client()
        
        # Extract base64 data from data URI if present
        if image_data_base64.startswith("data:image"):
            # Remove data URI prefix (e.g., "data:image/png;base64,")
            header, base64_data = image_data_base64.split(",", 1)
            # Extract content type from header
            content_type = header.split(";")[0].split(":")[1]
        else:
            # Assume it's already pure base64
            base64_data = image_data_base64
            content_type = "image/png"  # Default to PNG
        
        # Decode base64 to bytes
        try:
            image_bytes = base64.b64decode(base64_data)
        except Exception as e:
            raise ValueError(f"Invalid base64 image data: {str(e)}")
        
        # Create file path: workflow_id/image_id.png
        file_path = f"{workflow_id}/{image_id}.png"
        
        # Upload to Supabase Storage
        # Note: We use the 'reference-images' bucket
        # The bucket should be created in Supabase dashboard with public access
        response = supabase.storage.from_(REFERENCE_IMAGES_BUCKET).upload(
            path=file_path,
            file=image_bytes,
            file_options={
                "content-type": content_type,
                "upsert": True  # Overwrite if exists
            }
        )
        
        # Get public URL
        # Supabase storage public URLs follow this pattern:
        # {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
        public_url = supabase.storage.from_(REFERENCE_IMAGES_BUCKET).get_public_url(file_path)
        
        return public_url
        
    except ValueError:
        raise
    except Exception as e:
        error_msg = str(e)
        if "bucket" in error_msg.lower() and "not found" in error_msg.lower():
            raise Exception(
                f"Storage bucket '{REFERENCE_IMAGES_BUCKET}' not found. "
                f"Please create it in your Supabase dashboard with public access enabled."
            )
        raise Exception(f"Failed to upload image to Supabase Storage: {error_msg}")


async def delete_image_from_storage(
    storage_url: str
) -> None:
    """
    Delete an image from Supabase Storage.
    
    Args:
        storage_url: Public URL of the image to delete
        
    Raises:
        ValueError: If URL is invalid
        Exception: If deletion fails
    """
    try:
        supabase = _get_supabase_client()
        
        # Extract file path from URL
        # URL format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
        if "/storage/v1/object/public/" not in storage_url:
            raise ValueError(f"Invalid Supabase Storage URL format: {storage_url}")
        
        # Extract path after the bucket name
        parts = storage_url.split("/storage/v1/object/public/")
        if len(parts) != 2:
            raise ValueError(f"Could not parse storage URL: {storage_url}")
        
        path_with_bucket = parts[1]
        # Remove bucket name (everything before first /)
        if "/" not in path_with_bucket:
            raise ValueError(f"Could not extract file path from URL: {storage_url}")
        
        file_path = "/".join(path_with_bucket.split("/")[1:])  # Remove bucket name
        
        # Delete from storage
        supabase.storage.from_(REFERENCE_IMAGES_BUCKET).remove([file_path])
        
    except ValueError:
        raise
    except Exception as e:
        raise Exception(f"Failed to delete image from Supabase Storage: {str(e)}")


async def get_image_from_storage(
    image_id: str,
    workflow_id: str
) -> Optional[bytes]:
    """
    Download an image from Supabase Storage.
    
    Args:
        image_id: Unique identifier for the image
        workflow_id: Workflow/project identifier
        
    Returns:
        Optional[bytes]: Image bytes if found, None otherwise
    """
    try:
        supabase = _get_supabase_client()
        
        file_path = f"{workflow_id}/{image_id}.png"
        
        response = supabase.storage.from_(REFERENCE_IMAGES_BUCKET).download(file_path)
        
        return response
        
    except Exception as e:
        # If file not found, return None
        if "not found" in str(e).lower() or "404" in str(e).lower():
            return None
        raise Exception(f"Failed to download image from Supabase Storage: {str(e)}")
