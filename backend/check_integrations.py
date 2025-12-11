"""
Check which API integrations are configured and which are missing.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from root .env.local
root_dir = Path(__file__).parent.parent
env_local = root_dir / ".env.local"
if env_local.exists():
    load_dotenv(env_local)
else:
    load_dotenv()

print("="*60)
print("API INTEGRATION STATUS CHECK")
print("="*60)

integrations = {
    "✅ Kling API (Video Generation)": {
        "KLING_ACCESS_KEY": "Access Key",
        "KLING_SECRET_KEY": "Secret Key",
        "KLING_API_URL": "API URL (optional)",
    },
    "❓ Gemini API (Storyboard Generation)": {
        "GOOGLE_AI_API_KEY": "Google AI API Key",
    },
    "✅ Suno (Music Generation)": {
        "NOTE": "No API key needed - uses Suno web interface",
    },
    "✅ Nano Banana / Gemini Image (Image Generation)": {
        "GOOGLE_AI_API_KEY": "Google AI API Key (shared with Gemini)",
    },
    "ℹ️ Supabase (Data Persistence)": {
        "NOTE": "Frontend-only - configure in frontend/.env.local",
        "VITE_SUPABASE_URL": "Supabase Project URL (frontend only)",
        "VITE_SUPABASE_ANON_KEY": "Supabase Anon Key (frontend only)",
    },
}

all_configured = True

for service_name, required_vars in integrations.items():
    print(f"\n{service_name}")
    print("-" * 60)
    
    service_configured = True
    for var_name, description in required_vars.items():
        if var_name == "NOTE":
            print(f"  ℹ️ {description}")
            continue
        value = os.getenv(var_name)
        if value:
            # Show partial value for security
            preview = value[:10] + "..." if len(value) > 10 else value
            print(f"  ✓ {description}: SET ({preview})")
        else:
            if "frontend only" in description.lower():
                print(f"  ℹ️ {description} (check frontend/.env.local)")
            else:
                print(f"  ✗ {description}: NOT SET")
                if "optional" not in description.lower():
                    service_configured = False
                    all_configured = False
    
    if not service_configured:
        print(f"  ⚠ This service is NOT fully configured")

print("\n" + "="*60)
print("SUMMARY")
print("="*60)

if all_configured:
    print("🎉 All integrations are configured!")
else:
    print("⚠ Some integrations are missing. See above for details.")
    print("\nTo complete setup, add missing keys to your .env.local file:")
    print(f"  Location: {env_local}")


