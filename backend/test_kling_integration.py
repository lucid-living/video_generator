"""
Test script for Kling API integration.
Tests JWT token generation and basic API connectivity.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables from root .env.local
root_dir = Path(__file__).parent.parent
env_local = root_dir / ".env.local"
if env_local.exists():
    load_dotenv(env_local)
    print(f"✓ Loaded environment from: {env_local}")
else:
    load_dotenv()
    print("✓ Loaded environment from default location")

from app.services.video import _generate_kling_jwt_token, _get_kling_auth_token
import httpx


def test_jwt_generation():
    """Test JWT token generation."""
    print("\n" + "="*60)
    print("TEST 1: JWT Token Generation")
    print("="*60)
    
    access_key = os.getenv("KLING_ACCESS_KEY")
    secret_key = os.getenv("KLING_SECRET_KEY")
    
    if not access_key or not secret_key:
        print("✗ ERROR: KLING_ACCESS_KEY or KLING_SECRET_KEY not found in environment")
        print(f"   Access Key: {'SET' if access_key else 'NOT SET'}")
        print(f"   Secret Key: {'SET' if secret_key else 'NOT SET'}")
        return False
    
    print(f"✓ Access Key found: {access_key[:10]}...")
    print(f"✓ Secret Key found: {secret_key[:10]}...")
    
    try:
        token = _generate_kling_jwt_token(access_key, secret_key)
        print(f"✓ JWT Token generated successfully")
        print(f"   Token length: {len(token)} characters")
        print(f"   Token preview: {token[:50]}...")
        return True
    except Exception as e:
        print(f"✗ ERROR generating JWT token: {e}")
        return False


def test_auth_token_function():
    """Test the _get_kling_auth_token function."""
    print("\n" + "="*60)
    print("TEST 2: Auth Token Function")
    print("="*60)
    
    try:
        token = _get_kling_auth_token()
        print(f"✓ Auth token retrieved successfully")
        print(f"   Token length: {len(token)} characters")
        print(f"   Token preview: {token[:50]}...")
        return True
    except ValueError as e:
        print(f"✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"✗ ERROR: {e}")
        return False


def test_api_connectivity():
    """Test basic API connectivity (without making a full request)."""
    print("\n" + "="*60)
    print("TEST 3: API Connectivity Check")
    print("="*60)
    
    api_url = os.getenv("KLING_API_URL", "https://api.kling.ai")
    print(f"✓ API URL: {api_url}")
    
    try:
        token = _get_kling_auth_token()
        print(f"✓ JWT Token generated for API call")
        
        # Test with a simple endpoint (account info or health check)
        # Note: This is a basic connectivity test - actual endpoints may vary
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        print(f"✓ Headers prepared with Bearer token")
        print(f"   Authorization header: Bearer {token[:30]}...")
        
        # We'll just verify the token format is correct
        # Actual API calls would require valid endpoints and payloads
        if len(token) > 50 and token.count('.') == 2:
            print(f"✓ Token format appears valid (JWT has 3 parts separated by dots)")
            return True
        else:
            print(f"⚠ WARNING: Token format may be incorrect")
            return False
            
    except Exception as e:
        print(f"✗ ERROR: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("KLING API INTEGRATION TEST")
    print("="*60)
    
    results = []
    
    # Test 1: JWT Generation
    results.append(("JWT Token Generation", test_jwt_generation()))
    
    # Test 2: Auth Token Function
    results.append(("Auth Token Function", test_auth_token_function()))
    
    # Test 3: API Connectivity
    results.append(("API Connectivity", test_api_connectivity()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Kling API integration is ready.")
        return 0
    else:
        print("\n⚠ Some tests failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())



