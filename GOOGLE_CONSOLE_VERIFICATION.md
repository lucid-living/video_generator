# Google Console Verification Guide

## What You Need in Google Console

For this project, you only need **Google AI (Gemini) API** - NOT Google Drive API.

### Required: Google AI Studio API Key

1. **Go to Google AI Studio:**
   - Visit: https://aistudio.google.com/app/apikey
   - Sign in with your Google account

2. **Create or Verify API Key:**
   - Click "Create API Key" or view existing keys
   - Copy your API key (starts with `AIza...`)
   - This is your `GOOGLE_AI_API_KEY`

3. **Verify API Key is Active:**
   - Key should show as "Active" or "Enabled"
   - Check if there are any usage/quota limits
   - Make sure it's not expired or revoked

4. **Check API Access:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Generative Language API"
   - Make sure it's **Enabled** for your project
   - This is required for Gemini to work

### NOT Required: Google Drive Setup

You **don't need** Google Drive API anymore since we switched to Supabase Storage:
- ❌ No need to enable Google Drive API
- ❌ No need for OAuth credentials
- ❌ No need for credentials.json file

## Verifying Your Setup

### Step 1: Check API Key in Railway

1. Railway Dashboard → Your service → **Variables**
2. Look for `GOOGLE_AI_API_KEY`
3. Verify it matches your key from Google AI Studio
4. Should start with `AIza...`

### Step 2: Test API Key Locally

```bash
# Test if your API key works
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

Replace `YOUR_API_KEY` with your actual key. Should return JSON response, not an error.

### Step 3: Check Railway Logs for Google Errors

Railway → Deployments → Latest → View Logs

Look for these patterns:

#### ✅ Good Signs:
- No errors about `GOOGLE_AI_API_KEY`
- App starts successfully
- No `google.api_core.exceptions` errors

#### ❌ Bad Signs:
```
ValueError: GOOGLE_AI_API_KEY environment variable not set
```
→ **Fix:** Add API key to Railway Variables

```
google.api_core.exceptions.PermissionDenied
```
→ **Fix:** API key doesn't have proper permissions or API not enabled

```
google.api_core.exceptions.QuotaExceeded
```
→ **Fix:** API quota exceeded, check Google Cloud Console

```
google.api_core.exceptions.InvalidArgument
```
→ **Fix:** API key format is wrong or invalid

## Diagnosing Network Errors

### Is it Google-Related?

**Test 1: Health Endpoint (No Google Required)**
```bash
curl https://videogenerator-production.up.railway.app/health
```
- ✅ Returns `{"status":"healthy"}` → Backend works, Google not the issue
- ❌ Returns 502/error → Backend issue, not Google

**Test 2: Root Endpoint (No Google Required)**
```bash
curl https://videogenerator-production.up.railway.app/
```
- ✅ Returns API info → Backend works
- ❌ Returns error → Backend issue

**Test 3: Storyboard Generation (Requires Google)**
```bash
curl -X POST https://videogenerator-production.up.railway.app/api/planning/generate-storyboard \
  -H "Content-Type: application/json" \
  -d '{"theme":"test","style_guide":"test"}'
```

- ✅ Returns storyboard → Google setup is correct
- ❌ Returns 500 with "GOOGLE_AI_API_KEY" error → Google setup issue
- ❌ Returns 502 → Backend not responding (not Google issue)
- ❌ Returns CORS error → CORS configuration issue (not Google)

### Common Network Error Types

#### 1. ERR_CONNECTION_REFUSED
**Meaning:** Can't connect to backend at all
**Not Google-related** - This is a connectivity issue
**Check:**
- Is Railway backend running?
- Is `VITE_API_URL` correct in frontend?
- Is backend accessible at Railway URL?

#### 2. CORS Error
**Meaning:** Browser blocking request due to CORS policy
**Not Google-related** - This is a CORS configuration issue
**Fix:**
- Set `CORS_ORIGINS` in Railway Variables
- Should include your frontend URL: `http://localhost:5173`

#### 3. 502 Bad Gateway
**Meaning:** Railway can't reach your app
**Not Google-related** - Backend not responding
**Check:**
- Railway logs for startup errors
- Port configuration (should be 8000)
- Missing environment variables causing crash

#### 4. 500 Internal Server Error
**Meaning:** Backend crashed while processing request
**Might be Google-related** if error mentions Google API
**Check Railway logs for:**
- `GOOGLE_AI_API_KEY` errors
- `google.api_core.exceptions` errors
- If no Google errors → Not Google-related

#### 5. Network Error (Generic)
**Meaning:** Request failed for unknown reason
**Check browser console (F12) for:**
- Exact error message
- HTTP status code
- Request URL
- This will tell you if it's Google-related

## Quick Diagnostic Checklist

### Google Setup ✅
- [ ] API key created in Google AI Studio
- [ ] API key added to Railway Variables as `GOOGLE_AI_API_KEY`
- [ ] Generative Language API enabled in Google Cloud Console
- [ ] API key is active (not expired/revoked)

### Backend Setup ✅
- [ ] Railway backend is running (check dashboard)
- [ ] Health endpoint works: `/health`
- [ ] Port is set to 8000 in Railway Variables
- [ ] No startup errors in Railway logs

### Frontend Setup ✅
- [ ] `VITE_API_URL` set to Railway URL in `.env.local`
- [ ] Frontend dev server restarted after env changes
- [ ] Browser console shows correct API URL

### CORS Setup ✅
- [ ] `CORS_ORIGINS` set in Railway Variables
- [ ] Includes `http://localhost:5173` (for local dev)
- [ ] Or set to `*` for testing (not recommended for production)

## What to Check in Google Cloud Console

1. **Go to:** https://console.cloud.google.com/

2. **Select your project** (or create one)

3. **Enable Generative Language API:**
   - APIs & Services → Library
   - Search: "Generative Language API"
   - Click "Enable"

4. **Check API Credentials:**
   - APIs & Services → Credentials
   - Verify your API key exists
   - Check if it has restrictions (should allow all APIs or at least Generative Language API)

5. **Check Quotas/Limits:**
   - APIs & Services → Dashboard
   - Look for "Generative Language API"
   - Check if you're hitting quota limits

6. **Check Billing:**
   - Billing → Overview
   - Make sure billing is enabled (required for some API usage)
   - Check if you have free tier credits remaining

## Next Steps

1. **Verify Google AI Studio:**
   - Check API key exists and is active
   - Copy the key value

2. **Verify Railway Variables:**
   - Add/update `GOOGLE_AI_API_KEY` with your key
   - Make sure no typos

3. **Test Backend:**
   - Test `/health` endpoint (doesn't need Google)
   - Test `/api/planning/generate-storyboard` (needs Google)

4. **Check Browser Console:**
   - Open F12 → Console tab
   - Look for exact error messages
   - Share the error to identify if it's Google-related

5. **Check Railway Logs:**
   - Look for Google-related error messages
   - Share any errors you find

## Summary

**Google Console Setup:**
- ✅ Need: Google AI Studio API key
- ✅ Need: Generative Language API enabled
- ❌ Don't need: Google Drive API (we use Supabase now)

**Network Errors:**
- Most network errors are **NOT Google-related**
- Google errors usually show as 500 errors with specific messages
- Check browser console and Railway logs for exact error messages

Share what you find in:
1. Browser console (F12 → Console)
2. Railway logs (after testing an endpoint)
3. Results of the curl tests above

This will help identify if it's Google-related or something else!
