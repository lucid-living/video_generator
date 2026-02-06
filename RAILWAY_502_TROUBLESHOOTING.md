# Railway 502 Error Troubleshooting

## Your Current Situation

✅ **App starts successfully** - Logs show:
- `INFO: Uvicorn running on http://0.0.0.0:8080`
- `INFO: Application startup complete.`

❌ **But getting 502 errors** when accessing:
- `https://videogenerator-production.up.railway.app/`
- `https://videogenerator-production.up.railway.app/docs`

## Most Likely Causes

### 1. Missing Environment Variables (Most Common)

The app starts, but crashes when handling requests because required environment variables are missing.

**Check Railway Variables:**
1. Go to Railway dashboard → Your service → **Variables** tab
2. Verify these are set:
   - `SUPABASE_URL` (required for image storage)
   - `SUPABASE_ANON_KEY` (required for image storage)
   - `GOOGLE_AI_API_KEY` (required for storyboard generation)
   - `KIE_AI_API_KEY` (required for image generation)
   - `CORS_ORIGINS` (should include your frontend URL or `*`)

**If missing, add them:**
- Railway → Variables → New Variable
- Add each variable with its value
- Railway will automatically redeploy

### 2. App Crashing on First Request

Even though the app starts, it might crash when handling the first request due to:
- Missing Supabase credentials (causes error in `supabase_storage.py`)
- Missing API keys (causes error in API endpoints)

**Check Railway Logs:**
1. Railway dashboard → Your service → **Deployments** → Click latest deployment
2. Scroll to the **bottom** of the logs
3. Look for Python tracebacks or error messages after the startup messages
4. Common errors:
   - `ValueError: Supabase credentials not configured`
   - `ValueError: KIE_AI_API_KEY environment variable not set`
   - `ImportError` or `ModuleNotFoundError`

### 3. Port Mismatch (Less Likely)

Railway set `PORT=8080` and your app is listening on 8080, which is correct. But verify:
- Railway → Settings → Check if there's a port configuration
- Should be set to use Railway's `PORT` environment variable (automatic)

## Quick Fixes

### Fix 1: Add Missing Environment Variables

Go to Railway → Variables and ensure these are set:

```env
# Required for image storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Required for AI features
GOOGLE_AI_API_KEY=your-google-ai-key
KIE_AI_API_KEY=your-kie-ai-key

# Optional but recommended
OPENAI_API_KEY=your-openai-key  # Fallback for image generation
CORS_ORIGINS=*  # Or specific frontend URL

# Backend URL (set after first deploy)
BACKEND_URL=https://videogenerator-production.up.railway.app
```

### Fix 2: Make Environment Variables Optional (Temporary)

If you want the app to start even without all env vars, we can make them optional. But this is **not recommended** - better to set them properly.

### Fix 3: Check Railway Service Health

1. Railway dashboard → Your service
2. Check **Metrics** tab - look for:
   - CPU usage
   - Memory usage
   - Request rate
3. If metrics show 0 requests, Railway might not be routing correctly

### Fix 4: Test Health Endpoint Directly

Try accessing the health endpoint:
```bash
curl https://videogenerator-production.up.railway.app/health
```

This endpoint doesn't require any environment variables, so it should work if the app is running.

## Debugging Steps

1. **Check Latest Logs:**
   ```bash
   # In Railway dashboard, go to Deployments → Latest → View Logs
   # Look for any errors AFTER the startup messages
   ```

2. **Test Health Endpoint:**
   ```bash
   curl https://videogenerator-production.up.railway.app/health
   # Should return: {"status":"healthy"}
   ```

3. **Test Root Endpoint:**
   ```bash
   curl https://videogenerator-production.up.railway.app/
   # Should return API info
   ```

4. **Check Environment Variables:**
   - Railway → Variables tab
   - Verify all required vars are set
   - Check for typos in variable names

5. **Redeploy:**
   - After adding/updating variables, Railway auto-redeploys
   - Or manually trigger: Deployments → Redeploy

## Expected Behavior After Fix

Once environment variables are set correctly:

1. **Health check should work:**
   ```bash
   curl https://videogenerator-production.up.railway.app/health
   # Returns: {"status":"healthy"}
   ```

2. **Root endpoint should work:**
   ```bash
   curl https://videogenerator-production.up.railway.app/
   # Returns: {"message":"AI Music Video Generator API",...}
   ```

3. **Docs should be accessible:**
   - Visit: `https://videogenerator-production.up.railway.app/docs`
   - Should show Swagger UI

## Next Steps

1. **Check Railway Variables** - Add any missing ones
2. **Check Railway Logs** - Look for error messages after startup
3. **Test Health Endpoint** - Verify basic connectivity
4. **Share Logs** - If still failing, share the error messages from Railway logs

The most common issue is missing `SUPABASE_URL` and `SUPABASE_ANON_KEY` - add those first!
