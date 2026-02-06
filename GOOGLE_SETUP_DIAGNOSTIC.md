# Google Setup Diagnostic Guide

## Network Errors - Google-Related Causes

If you're seeing network errors, here's how to check if it's Google-related:

### 1. Check Railway Logs for Google Errors

Go to Railway → Your service → Deployments → Latest → View Logs

Look for these error patterns:

#### Missing GOOGLE_AI_API_KEY:
```
ValueError: GOOGLE_AI_API_KEY environment variable not set
```
**Fix:** Add `GOOGLE_AI_API_KEY` to Railway Variables

#### Google API Connection Errors:
```
google.api_core.exceptions.ServiceUnavailable
google.api_core.exceptions.DeadlineExceeded
```
**Fix:** Check your API key is valid and has proper permissions

#### Google Drive Errors (if legacy endpoints called):
```
ValueError: Google Drive credentials not found
```
**Fix:** Not needed anymore - we use Supabase Storage. But if you see this, it means old code is being called.

### 2. Test Specific Endpoints

#### Test Health Endpoint (No Google Required):
```bash
curl https://videogenerator-production.up.railway.app/health
```
Should return: `{"status":"healthy"}`

If this fails → **Not a Google issue**, it's a basic connectivity problem.

#### Test Storyboard Generation (Requires GOOGLE_AI_API_KEY):
```bash
curl -X POST https://videogenerator-production.up.railway.app/api/planning/generate-storyboard \
  -H "Content-Type: application/json" \
  -d '{
    "theme": "test",
    "style_guide": "test"
  }'
```

**If you get:**
- `500 Internal Server Error` with "GOOGLE_AI_API_KEY not set" → **Missing API key**
- `Network Error` or `502` → **Backend not responding** (not Google-specific)

### 3. Required Google Environment Variables

Check Railway → Variables tab. You need:

#### Required:
- ✅ `GOOGLE_AI_API_KEY` - For Gemini storyboard generation
  - Get from: https://aistudio.google.com/app/apikey

#### Optional (Not needed anymore):
- ❌ `GOOGLE_CLIENT_ID` - Only if using Google Drive (deprecated)
- ❌ `GOOGLE_CLIENT_SECRET` - Only if using Google Drive (deprecated)
- ❌ `GOOGLE_DRIVE_TOKEN_FILE` - Only if using Google Drive (deprecated)

### 4. Common Network Error Scenarios

#### Scenario A: Frontend Can't Connect to Backend
**Symptoms:**
- Browser console: `ERR_CONNECTION_REFUSED` or `Network Error`
- Frontend shows "Network Error" message

**Check:**
1. Is Railway backend running? (Check Railway dashboard)
2. Is `VITE_API_URL` set correctly in frontend `.env.local`?
3. Is backend returning 502? (Test with curl)

**Not Google-related** - This is a connectivity issue.

#### Scenario B: Backend Returns 500 on Storyboard Generation
**Symptoms:**
- Frontend can connect to backend
- But storyboard generation fails with 500 error

**Check Railway logs for:**
- `GOOGLE_AI_API_KEY environment variable not set`
- `google.api_core.exceptions` errors

**This IS Google-related** - Missing or invalid API key.

#### Scenario C: CORS Errors
**Symptoms:**
- Browser console: `CORS policy` errors
- Network requests fail with CORS errors

**Fix:**
- Set `CORS_ORIGINS` in Railway Variables
- Should include your frontend URL: `http://localhost:5173` (for local dev)
- Or set to `*` for development (not recommended for production)

**Not Google-related** - This is a CORS configuration issue.

### 5. Quick Diagnostic Steps

1. **Check Railway Backend is Running:**
   ```bash
   curl https://videogenerator-production.up.railway.app/health
   ```
   ✅ Should return: `{"status":"healthy"}`
   ❌ If 502 → Backend not running (check Railway logs)

2. **Check Google AI API Key is Set:**
   - Railway → Variables → Look for `GOOGLE_AI_API_KEY`
   - If missing → Add it
   - If present → Verify it's valid (not expired/revoked)

3. **Check Frontend Configuration:**
   - Open browser console (F12)
   - Look for the API URL being used
   - Should show: `https://videogenerator-production.up.railway.app`
   - If showing `localhost:8000` → Frontend env var not set correctly

4. **Test with Minimal Request:**
   ```bash
   # This doesn't require Google
   curl https://videogenerator-production.up.railway.app/
   ```
   ✅ Should return API info
   ❌ If fails → Backend issue, not Google

### 6. Most Likely Issues

Based on your symptoms:

1. **"Network Error" in browser:**
   - Most likely: Frontend pointing to wrong URL or backend not accessible
   - Less likely: Google API key missing (would show 500, not network error)

2. **Backend returns 502:**
   - Port mismatch (we fixed this with PORT=8000)
   - Missing environment variables causing crash
   - Check Railway logs for Python errors

3. **Backend returns 500 on specific endpoints:**
   - Missing `GOOGLE_AI_API_KEY` → Add to Railway Variables
   - Invalid API key → Regenerate at https://aistudio.google.com/app/apikey
   - API quota exceeded → Check Google Cloud Console

### 7. Next Steps

1. **Check Railway Logs** - Look for specific error messages
2. **Verify Environment Variables** - Make sure `GOOGLE_AI_API_KEY` is set
3. **Test Health Endpoint** - Verify basic connectivity
4. **Check Browser Console** - See exact error message

Share the specific error message from Railway logs or browser console, and I can help pinpoint the exact issue!
