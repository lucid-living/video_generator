# Frontend Connection Fix

## Problem

Browser console shows:
```
Failed to load resource: net::ERR_CONNECTION_REFUSED :8000/api/assets/gen...e-reference-image
```

This means your frontend is trying to connect to `localhost:8000` instead of your Railway backend.

## Solution

### Step 1: Verify Frontend Environment Variable

Check your `frontend/.env.local` file (or root `.env.local`):

```env
VITE_API_URL=https://videogenerator-production.up.railway.app
```

**Important:** Make sure it's set to your Railway URL, NOT `http://localhost:8000`

### Step 2: Restart Frontend Dev Server

Vite only loads environment variables when it starts. After changing `.env.local`:

1. **Stop the current dev server** (Ctrl+C in terminal)
2. **Restart it:**
   ```bash
   cd frontend
   npm run dev
   ```

### Step 3: Verify in Browser

1. Open browser console (F12)
2. Check what URL is being used:
   - Look for network requests
   - They should show: `https://videogenerator-production.up.railway.app/api/...`
   - NOT: `http://localhost:8000/api/...`

### Step 4: Check Which .env File is Being Used

Vite checks both locations (root takes precedence):
- `/home/lucid/Documents/Apps/video_generator/.env.local` ✅ (takes precedence)
- `/home/lucid/Documents/Apps/video_generator/frontend/.env.local`

Make sure `VITE_API_URL` is set in the root `.env.local` file.

### Step 5: Debug Environment Variable Loading

Add this temporarily to see what URL is being used:

In `frontend/src/services/api.ts`, add a console log:

```typescript
const API_BASE_URL = import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
console.log("API Base URL:", API_BASE_URL); // Add this line
```

Then check browser console - it should show your Railway URL.

## Quick Fix Checklist

- [ ] `VITE_API_URL` is set to Railway URL in `.env.local`
- [ ] Frontend dev server has been restarted
- [ ] Browser console shows Railway URL (not localhost)
- [ ] Railway backend is running (test with curl)

## Test Railway Backend

Before fixing frontend, verify Railway backend works:

```bash
curl https://videogenerator-production.up.railway.app/health
```

Should return: `{"status":"healthy"}`

If this fails, fix Railway backend first!
