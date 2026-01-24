"""
Script to recover and check stored reference images from Supabase database.
This will help identify what image data exists and potentially recover lost images.
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
        )
    
    return create_client(supabase_url, supabase_key)


def recover_images():
    """Recover and display information about stored reference images."""
    print("=" * 80)
    print("REFERENCE IMAGE RECOVERY TOOL")
    print("=" * 80)
    print()
    
    try:
        supabase = get_supabase_client()
        
        # Query all workflows
        print("Querying workflows from Supabase...")
        response = supabase.table("video_workflows").select("*").execute()
        
        if not response.data:
            print("No workflows found in database.")
            return
        
        print(f"Found {len(response.data)} workflow(s)\n")
        
        total_images = 0
        images_with_data = 0
        images_with_storage_url = 0
        images_missing_data = 0
        
        for idx, workflow in enumerate(response.data, 1):
            workflow_id = workflow.get("workflow_id", "unknown")
            reference_images = workflow.get("reference_images", [])
            
            print(f"\n{'=' * 80}")
            print(f"WORKFLOW {idx}: {workflow_id}")
            print(f"{'=' * 80}")
            print(f"Status: {workflow.get('status', 'unknown')}")
            print(f"Reference Images Count: {len(reference_images)}")
            
            if reference_images:
                total_images += len(reference_images)
                
                for img_idx, img in enumerate(reference_images, 1):
                    image_id = img.get("image_id", "unknown")
                    shot_indices = img.get("shot_indices", [])
                    description = img.get("description", "")[:60] + "..." if len(img.get("description", "")) > 60 else img.get("description", "")
                    base64_data = img.get("base64_data", "")
                    storage_url = img.get("storage_url", "")
                    approved = img.get("approved", False)
                    
                    print(f"\n  Image {img_idx}:")
                    print(f"    ID: {image_id}")
                    print(f"    Shot Indices: {shot_indices}")
                    print(f"    Description: {description}")
                    print(f"    Approved: {approved}")
                    print(f"    Storage URL: {storage_url if storage_url else 'None'}")
                    
                    if base64_data:
                        base64_length = len(base64_data)
                        print(f"    Base64 Data: {base64_length} characters")
                        if base64_length > 100:
                            print(f"    Base64 Preview: {base64_data[:100]}...")
                            images_with_data += 1
                        else:
                            print(f"    Base64 Data: Empty or too short")
                            images_missing_data += 1
                    else:
                        print(f"    Base64 Data: Missing")
                        images_missing_data += 1
                    
                    if storage_url:
                        images_with_storage_url += 1
                        print(f"    ✓ Has storage URL - can be recovered from Supabase Storage")
                    elif base64_data and len(base64_data) > 1000:
                        print(f"    ✓ Has base64 data - can be saved")
                    else:
                        print(f"    ⚠ Missing both storage URL and base64 data")
        
        print(f"\n{'=' * 80}")
        print("SUMMARY")
        print(f"{'=' * 80}")
        print(f"Total Images Found: {total_images}")
        print(f"Images with Base64 Data: {images_with_data}")
        print(f"Images with Storage URL: {images_with_storage_url}")
        print(f"Images Missing Data: {images_missing_data}")
        
        if images_with_data > 0:
            print(f"\n✓ Found {images_with_data} image(s) with base64 data that can be recovered!")
        if images_with_storage_url > 0:
            print(f"✓ Found {images_with_storage_url} image(s) with storage URLs that can be loaded!")
        if images_missing_data > 0:
            print(f"⚠ {images_missing_data} image(s) are missing data and may be lost.")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    recover_images()

