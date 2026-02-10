#!/usr/bin/env python3
"""
Check if storage URLs are being saved correctly in Supabase.
Run this to diagnose missing storage_url issues.
"""

import os
import sys
import json
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from supabase import create_client

def get_supabase_client():
    """Initialize Supabase client."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("ERROR: Missing Supabase credentials")
        print("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)

def check_storage_urls():
    """Check storage URLs in all workflows."""
    print("=" * 80)
    print("STORAGE URL CHECK")
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
        images_with_storage_url = 0
        images_without_storage_url = 0
        images_with_base64 = 0
        images_missing_both = 0
        
        problematic_images = []
        
        for workflow in response.data:
            workflow_id = workflow.get("workflow_id", "unknown")
            reference_images = workflow.get("reference_images", [])
            
            if not reference_images:
                continue
            
            print(f"Workflow: {workflow_id}")
            print(f"  Images: {len(reference_images)}")
            
            for img in reference_images:
                total_images += 1
                image_id = img.get("image_id", "unknown")
                storage_url = img.get("storage_url")
                base64_data = img.get("base64_data", "")
                base64_len = len(base64_data) if base64_data else 0
                
                has_storage_url = bool(storage_url)
                has_base64 = base64_len > 100  # Meaningful base64 data
                
                if has_storage_url:
                    images_with_storage_url += 1
                    status = "✓ Has storage_url"
                elif has_base64:
                    images_with_base64 += 1
                    status = f"⚠ No storage_url, but has base64 ({base64_len} chars)"
                else:
                    images_missing_both += 1
                    images_without_storage_url += 1
                    status = "❌ Missing both storage_url and base64_data"
                    problematic_images.append({
                        "workflow_id": workflow_id,
                        "image_id": image_id,
                        "description": img.get("description", "")[:50]
                    })
                
                print(f"    {image_id}: {status}")
                if storage_url:
                    print(f"      URL: {storage_url[:80]}...")
            
            print()
        
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total Images: {total_images}")
        print(f"✓ With storage_url: {images_with_storage_url}")
        print(f"⚠ With base64 only: {images_with_base64}")
        print(f"❌ Missing both: {images_missing_both}")
        print()
        
        if problematic_images:
            print("PROBLEMATIC IMAGES (missing storage_url and base64_data):")
            for img in problematic_images:
                print(f"  - Workflow: {img['workflow_id']}, Image: {img['image_id']}")
                print(f"    Description: {img['description']}")
            print()
            print("These images cannot be displayed and may need to be regenerated.")
        else:
            print("✓ All images have either storage_url or base64_data!")
        
        # Check storage bucket
        print()
        print("Checking storage bucket...")
        try:
            # Try to list files in the bucket
            storage_response = supabase.storage.from_("reference-images").list()
            if storage_response:
                print(f"✓ Storage bucket 'reference-images' is accessible")
                print(f"  Found {len(storage_response)} files/folders")
            else:
                print("⚠ Storage bucket exists but appears empty")
        except Exception as e:
            print(f"❌ Error accessing storage bucket: {e}")
            print("  Make sure the 'reference-images' bucket exists and is public")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    check_storage_urls()
