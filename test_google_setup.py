#!/usr/bin/env python3
"""
Quick test script to verify Google AI (Gemini) API setup.
Run this to check if your GOOGLE_AI_API_KEY is working correctly.
"""

import os
import sys
from pathlib import Path

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    # Load environment variables
    root_dir = Path(__file__).parent
    load_dotenv(root_dir / ".env.local")
    load_dotenv(root_dir / ".env")
except ImportError:
    # dotenv not installed, but that's okay - we'll use system env vars
    pass

def test_google_ai_key():
    """Test if Google AI API key is configured and working."""
    print("🔍 Testing Google AI (Gemini) Setup...")
    print("")
    
    # Check if API key is set
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        print("❌ GOOGLE_AI_API_KEY not found in environment variables")
        print("")
        print("To fix:")
        print("1. Get your API key from: https://aistudio.google.com/app/apikey")
        print("2. Add it to your .env.local file:")
        print("   GOOGLE_AI_API_KEY=your-key-here")
        return False
    
    print(f"✅ GOOGLE_AI_API_KEY found: {api_key[:10]}...{api_key[-4:]}")
    
    # Check API key format
    if not api_key.startswith("AIza"):
        print("⚠️  Warning: API key doesn't start with 'AIza' - might be invalid format")
    
    # Try to import and test Gemini
    try:
        import google.generativeai as genai
        print("✅ google.generativeai module imported successfully")
        
        # Configure with API key
        genai.configure(api_key=api_key)
        print("✅ Gemini client configured successfully")
        
        # Try to create a model instance
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        print("✅ Gemini model instance created successfully")
        
        # Try a simple test request
        print("")
        print("🧪 Testing API with a simple request...")
        response = model.generate_content("Say 'Hello' in one word")
        
        if response and response.text:
            print(f"✅ API test successful! Response: {response.text.strip()}")
            print("")
            print("🎉 Google AI setup is working correctly!")
            return True
        else:
            print("⚠️  API responded but no text in response")
            return False
            
    except ImportError as e:
        print(f"❌ Failed to import google.generativeai: {e}")
        print("")
        print("To fix:")
        print("  pip install google-generativeai")
        return False
    except ValueError as e:
        print(f"❌ API key error: {e}")
        print("")
        print("Possible issues:")
        print("1. API key is invalid or expired")
        print("2. API key doesn't have proper permissions")
        print("3. Generative Language API not enabled in Google Cloud Console")
        print("")
        print("Check: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        print("")
        print("Check Railway logs or Google Cloud Console for more details")
        return False

def test_railway_variables():
    """Check what should be in Railway Variables."""
    print("")
    print("📋 Railway Variables Checklist:")
    print("")
    print("Required for Google AI:")
    print("  ✅ GOOGLE_AI_API_KEY - Your Gemini API key")
    print("")
    print("Required for image storage:")
    print("  ✅ SUPABASE_URL - Your Supabase project URL")
    print("  ✅ SUPABASE_ANON_KEY - Your Supabase anon key")
    print("")
    print("Required for image generation:")
    print("  ✅ KIE_AI_API_KEY - Your Kie.ai API key (for Nano Banana Pro)")
    print("")
    print("Optional:")
    print("  ⚪ OPENAI_API_KEY - Fallback for image generation")
    print("  ⚪ CORS_ORIGINS - CORS allowed origins (defaults to localhost)")
    print("  ⚪ BACKEND_URL - Your Railway URL (for callbacks)")
    print("")
    print("NOT needed (deprecated):")
    print("  ❌ GOOGLE_CLIENT_ID - Google Drive (we use Supabase now)")
    print("  ❌ GOOGLE_CLIENT_SECRET - Google Drive (we use Supabase now)")

if __name__ == "__main__":
    print("=" * 60)
    print("Google AI (Gemini) Setup Verification")
    print("=" * 60)
    print("")
    
    success = test_google_ai_key()
    test_railway_variables()
    
    print("")
    print("=" * 60)
    if success:
        print("✅ All Google AI tests passed!")
        sys.exit(0)
    else:
        print("❌ Google AI setup needs attention")
        print("")
        print("Next steps:")
        print("1. Get API key from: https://aistudio.google.com/app/apikey")
        print("2. Enable Generative Language API: https://console.cloud.google.com/apis/library")
        print("3. Add GOOGLE_AI_API_KEY to Railway Variables")
        sys.exit(1)
