"""
Test script for Kie.ai Suno API integration.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try loading from backend directory
    env_path = Path(__file__).parent / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)

# Also try loading from project root
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.suno import generate_music_via_api, get_music_details


async def test_suno_api():
    """Test the Suno API with a simple prompt."""
    
    # Support both case variations
    api_key = os.getenv("KIE_AI_API_KEY") or os.getenv("KIE_AI_API_key")
    if not api_key:
        print("❌ KIE_AI_API_KEY or KIE_AI_API_key not found in environment variables")
        print("Please set it in .env.local file in the project root")
        return False
    
    print("✅ KIE_AI_API_KEY found")
    print(f"Backend URL: {os.getenv('BACKEND_URL', 'http://localhost:8000')}")
    print("\n" + "="*50)
    print("Testing Suno API with simple prompt...")
    print("="*50 + "\n")
    
    # Test with a simple prompt (non-custom mode)
    test_lyrics = "A calm and relaxing piano track with soft melodies"
    
    try:
        print(f"📝 Prompt: {test_lyrics}")
        print("🚀 Starting music generation...\n")
        
        result = await generate_music_via_api(
            lyrics=test_lyrics,
            style=None,
            title="Test Track",
            instrumental=False,
            model="V5",
            custom_mode=False,  # Simpler mode for testing
        )
        
        task_id = result.get("taskId")
        if not task_id:
            print("❌ No task ID returned from API")
            print(f"Response: {result}")
            return False
        
        print(f"✅ Generation started!")
        print(f"📋 Task ID: {task_id}")
        print(f"\n⏳ Polling for completion (this may take 1-3 minutes)...\n")
        
        # Poll for completion
        max_attempts = 60  # 5 minutes max (60 * 5 seconds)
        attempt = 0
        
        while attempt < max_attempts:
            attempt += 1
            await asyncio.sleep(5)  # Wait 5 seconds between polls
            
            try:
                details = await get_music_details(task_id)
                
                # Check if we have results
                if details.get("data") and isinstance(details.get("data"), list):
                    tracks = details["data"]
                    if tracks and len(tracks) > 0:
                        print(f"\n✅ Generation complete! Found {len(tracks)} track(s)\n")
                        
                        for i, track in enumerate(tracks, 1):
                            print(f"Track {i}:")
                            print(f"  Title: {track.get('title', 'N/A')}")
                            print(f"  Duration: {track.get('duration', 0):.2f} seconds")
                            print(f"  Audio URL: {track.get('audio_url', 'N/A')}")
                            print(f"  Stream URL: {track.get('stream_audio_url', 'N/A')}")
                            print()
                        
                        return True
                
                # Check status
                status = details.get("state", "unknown")
                if status == "fail":
                    error_msg = details.get("failMsg", "Unknown error")
                    print(f"❌ Generation failed: {error_msg}")
                    return False
                
                if attempt % 6 == 0:  # Print status every 30 seconds
                    print(f"⏳ Still generating... (attempt {attempt}/{max_attempts})")
                    
            except Exception as e:
                print(f"⚠️  Error checking status: {e}")
                if attempt >= max_attempts:
                    print(f"\n❌ Max attempts reached. Task may still be processing.")
                    print(f"   You can check status later with task ID: {task_id}")
                    return False
        
        print(f"\n⏳ Timeout reached. Task may still be processing.")
        print(f"   Task ID: {task_id}")
        print(f"   Check status later or wait for callback.")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🎵 Suno API Test Script\n")
    success = asyncio.run(test_suno_api())
    sys.exit(0 if success else 1)
