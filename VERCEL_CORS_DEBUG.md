# Vercel CORS Debugging Guide

## What I Fixed

I've updated the backend to:
1. ✅ Add CORS headers to **all error responses** (400, 500, validation errors)
2. ✅ Enable CORS debug logging by default (check Railway logs)
3. ✅ Better error messages showing which origin is being blocked

## Next Steps

### 1. Deploy the Updated Backend

The code changes need to be deployed to Railway. If you're using GitHub auto-deploy:
- Commit and push the changes
- Railway will automatically redeploy

Or manually trigger a redeploy in Railway.

### 2. Check Railway Logs

After deploying, check your Railway backend logs:

1. Go to Railway → Your Backend Service → Deployments → Latest → View Logs
2. Look for messages like:
   ```
   CORS configured with X allowed origin(s)
     - https://your-vercel-app.vercel.app
     - http://localhost:5173
   ```
3. When a request comes in, you'll see:
   ```
   CORS Debug: Request from origin: https://your-vercel-app.vercel.app
   CORS Debug: Allowed origins: ['https://your-vercel-app.vercel.app', ...]
   ```

### 3. Verify CORS_ORIGINS in Railway

Make sure your Railway backend has the **exact** Vercel URL:

1. Railway → Backend Service → Variables
2. Check `CORS_ORIGINS` value
3. It should be: `https://your-vercel-app.vercel.app,http://localhost:5173,http://localhost:3000`

**Common Issues:**
- ❌ Missing `https://` prefix
- ❌ Trailing slash: `https://app.vercel.app/` (should be no slash)
- ❌ Wrong domain (check your Vercel dashboard for the exact URL)
- ❌ Spaces around commas

### 4. Find Your Exact Vercel URL

1. Go to [vercel.com](https://vercel.com) → Your Project
2. Go to **Settings** → **Domains**
3. Your production URL will be listed (usually `your-project.vercel.app`)
4. Copy the **exact** URL (including `https://`)

### 5. Test the Fix

After updating and redeploying:

1. Try your frontend again
2. Check Railway logs for CORS debug messages
3. If you see `CORS Debug: WARNING - Origin ... not in allowed origins`, the URL doesn't match

## Debugging Commands

### Check CORS Headers

```bash
# Replace with your actual URLs
FRONTEND_URL="https://your-app.vercel.app"
BACKEND_URL="https://videogenerator-production.up.railway.app"

# Test preflight request
curl -X OPTIONS \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$BACKEND_URL/api/assets/generate-reference-image" \
  -v
```

Look for `Access-Control-Allow-Origin: https://your-app.vercel.app` in the response.

### Test Actual Request

```bash
curl -X POST \
  -H "Origin: $FRONTEND_URL" \
  -H "Content-Type: application/json" \
  -d '{"style_guide":"test","description":"test","shot_indices":[1]}' \
  "$BACKEND_URL/api/assets/generate-reference-image" \
  -v
```

## What the Logs Will Tell You

### ✅ Good (CORS Working):
```
CORS configured with 3 allowed origin(s)
  - https://your-app.vercel.app
  - http://localhost:5173
  - http://localhost:3000
CORS Debug: Request from origin: https://your-app.vercel.app
CORS Debug: ✅ Origin https://your-app.vercel.app is allowed
```

### ❌ Bad (CORS Not Working):
```
CORS Debug: Request from origin: https://your-app.vercel.app
CORS Debug: Allowed origins: ['https://different-url.vercel.app', ...]
CORS Debug: WARNING - Origin https://your-app.vercel.app not in allowed origins list
CORS Debug: This will cause CORS errors!
```

If you see the warning, the URL in `CORS_ORIGINS` doesn't match the actual Vercel URL.

## Still Not Working?

1. **Check Railway logs** - Look for the CORS debug messages
2. **Verify the exact Vercel URL** - Copy it directly from Vercel dashboard
3. **Check for typos** - URLs are case-sensitive
4. **Redeploy after changing CORS_ORIGINS** - Railway should auto-redeploy
5. **Clear browser cache** - Sometimes browsers cache CORS errors

## Quick Checklist

- [ ] Backend code deployed to Railway
- [ ] `CORS_ORIGINS` includes exact Vercel URL (no trailing slash, with https://)
- [ ] Railway logs show CORS configuration on startup
- [ ] Railway logs show origin is allowed when request comes in
- [ ] Browser console shows CORS error is gone
