"""
Test Nano Banana / Gemini Image Generation
Test if we can use Gemini API for image generation (Nano Banana).
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from root .env.local
root_dir = Path(__file__).parent.parent
env_local = root_dir / ".env.local"
if env_local.exists():
    load_dotenv(env_local)
    print(f"✓ Loaded environment from: {env_local}")
else:
    load_dotenv()

print("="*60)
print("NANO BANANA / GEMINI IMAGE GENERATION TEST")
print("="*60)

# Check for API key
api_key = os.getenv("GOOGLE_AI_API_KEY")
if not api_key:
    print("✗ ERROR: GOOGLE_AI_API_KEY not found")
    sys.exit(1)

print(f"✓ Google AI API Key found: {api_key[:20]}...")

# Configure Gemini
try:
    genai.configure(api_key=api_key)
    print("✓ Gemini API configured")
except Exception as e:
    print(f"✗ ERROR configuring Gemini: {e}")
    sys.exit(1)

# Try to use Gemini for image generation
print("\n" + "="*60)
print("Testing Image Generation with Gemini")
print("="*60)

# First, let's check what models are available
try:
    print("\nChecking available models...")
    models = genai.list_models()
    image_models = []
    for model in models:
        if 'image' in model.name.lower() or 'imagen' in model.name.lower():
            image_models.append(model.name)
            print(f"  ✓ Found image model: {model.name}")
    
    if not image_models:
        print("  ⚠ No image-specific models found")
        print("\nTrying Gemini 2.0 Flash for image generation...")
        
        # Try with Gemini 2.0 Flash which might support image generation
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        print("✓ Using gemini-2.0-flash-exp model")
        
        prompt = "Generate an image of a futuristic cyberpunk cityscape at night with neon lights, cinematic style"
        print(f"✓ Prompt: {prompt}")
        
        print("\nGenerating image...")
        response = model.generate_content(prompt)
        
        print("✓ Response received!")
        print(f"Response type: {type(response)}")
        if hasattr(response, 'text'):
            print(f"Response text preview: {response.text[:200]}...")
        if hasattr(response, 'parts'):
            print(f"Response has {len(response.parts)} parts")
            for i, part in enumerate(response.parts):
                print(f"  Part {i}: {type(part)}")
                if hasattr(part, 'inline_data'):
                    print(f"    Has inline_data (image data)")
                if hasattr(part, 'text'):
                    print(f"    Has text: {part.text[:100]}...")
        
except Exception as e:
    print(f"✗ ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("TEST COMPLETE")
print("="*60)
