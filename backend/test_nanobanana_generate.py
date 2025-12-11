"""
Test actual image generation with Nano Banana / Gemini Image models.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
import base64

# Load environment variables
root_dir = Path(__file__).parent.parent
env_local = root_dir / ".env.local"
if env_local.exists():
    load_dotenv(env_local)

api_key = os.getenv("GOOGLE_AI_API_KEY")
if not api_key:
    print("✗ ERROR: GOOGLE_AI_API_KEY not found")
    sys.exit(1)

genai.configure(api_key=api_key)

print("="*60)
print("TESTING IMAGE GENERATION")
print("="*60)

# Try with Gemini 2.5 Flash Image (Nano Banana)
print("\nTesting with: gemini-2.5-flash-image (Nano Banana)")
print("-" * 60)

try:
    model = genai.GenerativeModel("gemini-2.5-flash-image")
    prompt = "A futuristic cyberpunk cityscape at night with neon lights, cinematic style, high quality"
    
    print(f"Prompt: {prompt}")
    print("Generating image...")
    
    response = model.generate_content(prompt)
    
    print("✓ Image generation successful!")
    print(f"Response type: {type(response)}")
    
    # Check response structure
    if hasattr(response, 'parts'):
        print(f"Response has {len(response.parts)} parts")
        for i, part in enumerate(response.parts):
            print(f"\nPart {i}:")
            print(f"  Type: {type(part)}")
            
            # Check for image data
            if hasattr(part, 'inline_data'):
                data = part.inline_data
                print(f"  ✓ Has inline_data!")
                print(f"    MIME type: {data.mime_type}")
                print(f"    Data length: {len(data.data)} bytes")
                print(f"    Base64 preview: {data.data[:50]}...")
                
                # Save to file for testing
                image_bytes = base64.b64decode(data.data)
                output_path = Path(__file__).parent / "test_generated_image.png"
                with open(output_path, "wb") as f:
                    f.write(image_bytes)
                print(f"  ✓ Image saved to: {output_path}")
            
            if hasattr(part, 'text'):
                print(f"  Text: {part.text[:100]}...")
    
    if hasattr(response, 'text'):
        print(f"\nResponse text: {response.text[:200]}...")
        
except Exception as e:
    print(f"✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
    
    # Try alternative model
    print("\n" + "="*60)
    print("Trying alternative: imagen-4.0-generate-001")
    print("-" * 60)
    
    try:
        model = genai.GenerativeModel("imagen-4.0-generate-001")
        prompt = "A futuristic cyberpunk cityscape at night with neon lights, cinematic style"
        
        print(f"Prompt: {prompt}")
        print("Generating image...")
        
        response = model.generate_content(prompt)
        
        print("✓ Image generation successful!")
        if hasattr(response, 'parts'):
            for i, part in enumerate(response.parts):
                if hasattr(part, 'inline_data'):
                    data = part.inline_data
                    image_bytes = base64.b64decode(data.data)
                    output_path = Path(__file__).parent / "test_generated_image_imagen.png"
                    with open(output_path, "wb") as f:
                        f.write(image_bytes)
                    print(f"✓ Image saved to: {output_path}")
    except Exception as e2:
        print(f"✗ ERROR with imagen-4.0: {e2}")

print("\n" + "="*60)
print("TEST COMPLETE")
print("="*60)


