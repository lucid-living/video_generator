# Railway CORS Fix Guide

## Problem

You're seeing CORS errors like:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://videogenerator-production.up.railway.app/api/assets/generate-reference-image. (Reason: CORS header 'Access-Control-Allow-Origin' missing).
```

This happens because your frontend (deployed on Railway) is trying to access your backend (also on Railway), but the backend's `CORS_ORIGINS` environment variable doesn't include your frontend's URL.

## Solution

### Step 1: Find Your Frontend Railway URL

1. Go to [railway.app](https://railway.app) and log in
2. Open your project
3. Find your **frontend service** (the React app)
4. Go to the **Settings** tab or **Deployments** tab
5. Look for **Public Domain** - it will look like:
   - `https://your-frontend-name.up.railway.app` or
   - `https://your-frontend-name.railway.app`

**Note:** If you don't have a public domain set up:
- Go to your frontend service → Settings → Generate Domain
- Railway will create a public URL for you

### Step 2: Update Backend CORS_ORIGINS

1. Go to your **backend service** in Railway (the FastAPI app)
2. Go to the **Variables** tab
3. Find the `CORS_ORIGINS` variable (or create it if it doesn't exist)
4. Update it to include your frontend URL:

**Format:**
```
https://your-frontend-name.up.railway.app,http://localhost:5173,http://localhost:3000
```

**Example:**
```
https://videogenerator-frontend.up.railway.app,http://localhost:5173,http://localhost:3000
```

**Important:**
- Separate multiple URLs with commas (no spaces around commas)
- Include `http://localhost:5173` and `http://localhost:3000` for local development
- Use `https://` for Railway URLs (Railway provides HTTPS automatically)
- No trailing slashes

### Step 3: Verify and Redeploy

1. After updating `CORS_ORIGINS`, Railway will automatically redeploy your backend
2. Wait for the deployment to complete (check the Deployments tab)
3. Test your frontend - the CORS errors should be gone!

## Quick Test

After updating CORS_ORIGINS, test if it's working:

```bash
# Replace with your actual URLs
FRONTEND_URL="https://your-frontend-name.up.railway.app"
BACKEND_URL="https://videogenerator-production.up.railway.app"

# Test CORS headers
curl -H "Origin: $FRONTEND_URL" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     "$BACKEND_URL/api/assets/generate-reference-image" \
     -v
```

You should see `Access-Control-Allow-Origin: https://your-frontend-name.up.railway.app` in the response headers.

## Troubleshooting

### Still Getting CORS Errors?

1. **Check Railway Variables:**
   - Make sure `CORS_ORIGINS` is set correctly
   - No typos in the URL
   - URLs are separated by commas (no spaces)

2. **Check Frontend URL:**
   - Make sure you're using the correct frontend Railway URL
   - Check if the frontend has a public domain set up

3. **Check Backend Logs:**
   - Railway → Backend Service → Deployments → Latest → View Logs
   - Look for CORS configuration messages:
     ```
     CORS configured with X allowed origin(s)
       - https://your-frontend-url.up.railway.app
     ```

4. **Enable CORS Debugging:**
   - Add `DEBUG_CORS=true` to your Railway backend variables
   - This will log all incoming request origins
   - Check logs to see what origin is being blocked

5. **Verify URLs Match:**
   - The origin in the error message should match one of the URLs in `CORS_ORIGINS`
   - Check for trailing slashes, `http://` vs `https://`, etc.

### Common Mistakes

❌ **Wrong:**
```
CORS_ORIGINS=https://frontend.railway.app, https://backend.railway.app
```
(Spaces around commas)

✅ **Correct:**
```
CORS_ORIGINS=https://frontend.railway.app,https://backend.railway.app
```

❌ **Wrong:**
```
CORS_ORIGINS=https://frontend.railway.app/
```
(Trailing slash)

✅ **Correct:**
```
CORS_ORIGINS=https://frontend.railway.app
```

❌ **Wrong:**
```
CORS_ORIGINS=http://frontend.railway.app
```
(Using http instead of https)

✅ **Correct:**
```
CORS_ORIGINS=https://frontend.railway.app
```

## Alternative: Allow All Origins (Development Only)

⚠️ **WARNING:** Only use this for development/testing, NOT for production!

If you want to allow all origins temporarily:

1. Set `CORS_ORIGINS=*` in Railway backend variables
2. This will allow requests from any origin
3. **Remove this before going to production** - it's a security risk

## Production Best Practices

1. **Always specify exact frontend URLs** - don't use wildcards
2. **Include localhost URLs** for local development: `http://localhost:5173,http://localhost:3000`
3. **Use HTTPS** for all production URLs
4. **Test CORS** after every deployment
5. **Monitor logs** for CORS-related errors

## Code Changes Made

The backend code has been updated to:
- Strip whitespace from CORS origins (handles spaces around commas)
- Filter out empty strings
- Log CORS configuration on startup
- Optional CORS debugging middleware (enable with `DEBUG_CORS=true`)

These changes make the CORS configuration more robust and easier to debug.
