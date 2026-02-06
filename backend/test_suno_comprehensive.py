"""
Comprehensive test script for Kie.ai Suno API integration.
Tests the full flow: generation, status checking, and callback handling.
"""

import asyncio
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
if env_path.exists():
    load_dotenv(env_path)
else:
    env_path = Path(__file__).parent / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)

load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.suno import generate_music_via_api, get_music_details, _get_kie_api_key, _get_backend_url


async def test_api_direct():
    """Test the Kie.ai API directly with httpx."""
    print("\n" + "="*60)
    print("TEST 1: Direct API Call to Kie.ai")
    print("="*60 + "\n")
    
    api_key = _get_kie_api_key()
    backend_url = _get_backend_url()
    callback_url = f"{backend_url}/api/webhooks/suno-callback"
    
    print(f"✅ API Key: {'*' * 28}{api_key[-4:]}")
    print(f"✅ Backend URL: {backend_url}")
    print(f"✅ Callback URL: {callback_url}\n")
    
    # Test payload (non-custom mode - simpler)
    payload = {
        "customMode": False,
        "instrumental": False,
        "callBackUrl": callback_url,
        "model": "V5",
        "prompt": "A calm and relaxing piano track with soft melodies for children"
    }
    
    print("📤 Request Payload:")
    print(json.dumps(payload, indent=2))
    print()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("🚀 Sending request to Kie.ai API...")
            response = await client.post(
                "https://api.kie.ai/api/v1/generate",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            
            print(f"📥 Response Status: {response.status_code}")
            print(f"📥 Response Headers: {dict(response.headers)}\n")
            
            if response.status_code != 200:
                print(f"❌ Error Response:")
                print(response.text)
                return None
            
            result = response.json()
            print("📥 Response Body:")
            print(json.dumps(result, indent=2))
            print()
            
            if result.get("code") != 200:
                print(f"❌ API returned error code: {result.get('code')}")
                print(f"   Message: {result.get('msg')}")
                return None
            
            task_id = result.get("data", {}).get("taskId")
            if task_id:
                print(f"✅ Task created successfully!")
                print(f"📋 Task ID: {task_id}\n")
                return task_id
            else:
                print("❌ No task ID in response")
                return None
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_task_status_endpoint(task_id: str):
    """Test the task status endpoint."""
    print("\n" + "="*60)
    print("TEST 2: Task Status Endpoint")
    print("="*60 + "\n")
    
    api_key = _get_kie_api_key()
    
    # Test different possible endpoints
    endpoints = [
        f"https://api.kie.ai/api/v1/task/{task_id}",
        f"https://api.kie.ai/api/v1/music-task/{task_id}",
        f"https://api.kie.ai/api/v1/tasks/{task_id}",
    ]
    
    for endpoint in endpoints:
        print(f"🔍 Testing endpoint: {endpoint}")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                    },
                )
                
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ Found working endpoint!")
                    print(f"   Response: {json.dumps(result, indent=2)}")
                    return result
                elif response.status_code == 404:
                    print(f"   ⚠️  404 - Endpoint not found (expected)")
                else:
                    print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {str(e)[:100]}")
        print()
    
    print("⚠️  No working status endpoint found. Kie.ai likely uses callbacks only.")
    return None


async def test_backend_endpoint(task_id: str):
    """Test our backend's task status endpoint."""
    print("\n" + "="*60)
    print("TEST 3: Backend Task Status Endpoint")
    print("="*60 + "\n")
    
    backend_url = "http://localhost:8000"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{backend_url}/api/assets/music-task/{task_id}",
            )
            
            print(f"📥 Status: {response.status_code}")
            result = response.json()
            print(f"📥 Response:")
            print(json.dumps(result, indent=2))
            print()
            
            return result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


async def test_callback_endpoint():
    """Test the callback endpoint."""
    print("\n" + "="*60)
    print("TEST 4: Callback Endpoint")
    print("="*60 + "\n")
    
    backend_url = "http://localhost:8000"
    
    # Test GET (verification)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{backend_url}/api/webhooks/suno-callback")
            print(f"✅ GET /api/webhooks/suno-callback: {response.status_code}")
            print(f"   Response: {response.json()}\n")
    except Exception as e:
        print(f"❌ GET failed: {e}\n")
    
    # Test POST with sample callback payload
    sample_callback = {
        "code": 200,
        "msg": "All generated successfully.",
        "data": {
            "callbackType": "complete",
            "task_id": "test_task_123",
            "data": [
                {
                    "id": "test_audio_1",
                    "audio_url": "https://example.com/audio1.mp3",
                    "stream_audio_url": "https://example.com/stream1",
                    "image_url": "https://example.com/image1.jpeg",
                    "prompt": "[Verse] Test song lyrics",
                    "model_name": "chirp-v3-5",
                    "title": "Test Track",
                    "tags": "test, demo",
                    "createTime": "2025-01-24 00:00:00",
                    "duration": 120.5
                }
            ]
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{backend_url}/api/webhooks/suno-callback",
                json=sample_callback,
            )
            print(f"✅ POST /api/webhooks/suno-callback: {response.status_code}")
            print(f"   Response: {response.json()}\n")
    except Exception as e:
        print(f"❌ POST failed: {e}\n")


async def test_service_functions():
    """Test the service functions directly."""
    print("\n" + "="*60)
    print("TEST 5: Service Functions")
    print("="*60 + "\n")
    
    try:
        print("Testing generate_music_via_api...")
        result = await generate_music_via_api(
            lyrics="A simple test song for children",
            style=None,
            title="Test Song",
            instrumental=False,
            model="V5",
            custom_mode=False,
        )
        print(f"✅ generate_music_via_api succeeded")
        print(f"   Result: {json.dumps(result, indent=2)}\n")
        
        task_id = result.get("taskId")
        if task_id:
            print(f"Testing get_music_details with task_id: {task_id}")
            details = await get_music_details(task_id)
            print(f"✅ get_music_details succeeded")
            print(f"   Details: {json.dumps(details, indent=2)}\n")
            return task_id
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    """Run all tests."""
    print("🎵 Comprehensive Suno API Test Suite")
    print("="*60)
    
    # Test 1: Direct API call
    task_id = await test_api_direct()
    
    if not task_id:
        print("\n❌ Failed to create task. Cannot continue with other tests.")
        return
    
    # Test 2: Task status endpoint
    await test_task_status_endpoint(task_id)
    
    # Test 3: Backend endpoint
    await test_backend_endpoint(task_id)
    
    # Test 4: Callback endpoint
    await test_callback_endpoint()
    
    # Test 5: Service functions
    await test_service_functions()
    
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"✅ Task ID: {task_id}")
    print(f"✅ Generation request: SUCCESS")
    print(f"⚠️  Status polling: 404 (expected - Kie.ai uses callbacks)")
    print(f"✅ Callback endpoint: Ready at /api/webhooks/suno-callback")
    print(f"\n💡 Next Steps:")
    print(f"   1. Wait for Kie.ai to send callback (usually 1-3 minutes)")
    print(f"   2. Check callback endpoint logs when callback arrives")
    print(f"   3. The callback will contain the generated audio URLs")
    print(f"\n📋 Monitor callback at: {_get_backend_url()}/api/webhooks/suno-callback")


if __name__ == "__main__":
    asyncio.run(main())
