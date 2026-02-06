# Railway Port Mismatch Fix

## Problem
- Railway is routing traffic to **port 8000**
- But your app started on **port 8080** (Railway set `PORT=8080`)
- Result: 502 Bad Gateway errors

## Solution

Set `PORT=8000` explicitly in Railway's environment variables to match Railway's routing configuration.

### Steps:

1. **Go to Railway Dashboard:**
   - Open your project → Your service
   - Click on **Variables** tab

2. **Add/Update PORT variable:**
   - Click **New Variable** (or edit existing PORT if it exists)
   - **Name:** `PORT`
   - **Value:** `8000`
   - Click **Add** or **Save**

3. **Redeploy:**
   - Railway will automatically redeploy when you add/update variables
   - Or manually trigger: **Deployments** → **Redeploy**

4. **Verify:**
   - Check logs - should now show: `Starting uvicorn on port 8000`
   - Test: `curl https://videogenerator-production.up.railway.app/health`
   - Should return: `{"status":"healthy"}`

## Why This Happens

Railway sometimes sets PORT automatically based on various factors, but your routing configuration expects port 8000. By explicitly setting `PORT=8000`, you ensure the app listens on the port Railway is routing to.

## Alternative: Update Railway Routing

If you prefer to use port 8080:
1. Railway Dashboard → Your service → **Settings**
2. Find port configuration
3. Change routing port to 8080

But it's easier to just set `PORT=8000` in environment variables!
