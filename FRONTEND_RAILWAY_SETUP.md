# Frontend Configuration for Railway Backend

Your frontend is currently pointing to `localhost:8000`, but you have Railway configured. Here's how to connect them:

## Step 1: Find Your Railway Backend URL

1. Go to [railway.app](https://railway.app) and log in
2. Open your project
3. Click on your backend service
4. Go to the **Settings** tab
5. Look for **Public Domain** or check the **Deployments** tab for the URL
6. Your Railway URL will look like: `https://your-app-name.up.railway.app` or `https://your-app-name.railway.app`

## Step 2: Update Frontend Environment Variables

Create or update `frontend/.env.local`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API - Point to Railway instead of localhost
VITE_API_URL=https://your-app-name.up.railway.app

# Optional: Content Machine Integration
VITE_CONTENT_MACHINE_API_URL=http://localhost:8001
```

**Important**: Replace `https://your-app-name.up.railway.app` with your actual Railway URL!

## Step 3: Verify Railway Backend is Running

1. Visit your Railway dashboard
2. Check the **Deployments** tab - make sure there's a successful deployment
3. Check the **Logs** tab - make sure the backend is running without errors
4. Test the backend directly:
   ```bash
   curl https://your-app-name.up.railway.app/docs
   ```
   Should return the Swagger UI HTML

## Step 4: Restart Frontend Dev Server

After updating `.env.local`:

```bash
cd frontend
npm run dev
```

The frontend will now connect to your Railway backend instead of localhost!

## Troubleshooting

### Still Getting Connection Refused?

1. **Check Railway is deployed:**
   - Railway dashboard → Deployments → Should show "Active"
   - Check logs for any errors

2. **Check CORS settings:**
   - In Railway, go to Variables
   - Make sure `CORS_ORIGINS` includes your frontend URL
   - Or set it to `*` for development (not recommended for production)

3. **Check Railway URL:**
   - Make sure you're using `https://` not `http://`
   - Railway provides HTTPS automatically

4. **Test backend directly:**
   ```bash
   curl https://your-railway-url/api/webhooks/kie-callback
   ```
   Should return: `{"status":"ok","message":"Kie.ai webhook endpoint is active"}`

### Railway Backend Not Deployed?

If Railway isn't deployed yet:

1. **Connect GitHub repo:**
   - Railway dashboard → New Project → Deploy from GitHub repo
   - Select your repository

2. **Configure service:**
   - Railway will auto-detect the Dockerfile
   - Make sure root directory is `/` (project root)

3. **Add environment variables:**
   - Go to Variables tab
   - Add all required variables (see DEPLOYMENT.md)

4. **Deploy:**
   - Railway will automatically deploy
   - Wait for deployment to complete

## Development vs Production

### Option A: Always Use Railway (Recommended)
- Set `VITE_API_URL` to your Railway URL in `frontend/.env.local`
- Frontend always connects to Railway backend
- No need to run backend locally

### Option B: Use Localhost for Development
- Keep `VITE_API_URL=http://localhost:8000` for local development
- Run backend locally: `cd backend && uvicorn app.main:app --reload`
- Use Railway URL only in production builds

### Option C: Use Environment-Specific Config
- Create `frontend/.env.local` for local development (localhost)
- Create `frontend/.env.production` for production (Railway URL)
- Vite will automatically use the right file

## Quick Check Script

Run this to verify your setup:

```bash
# Check if Railway backend is accessible
RAILWAY_URL="https://your-app-name.up.railway.app"
curl -s "$RAILWAY_URL/docs" > /dev/null && echo "✅ Railway backend is accessible" || echo "❌ Railway backend is not accessible"

# Check frontend env var
cd frontend
grep VITE_API_URL .env.local && echo "✅ Frontend API URL is configured" || echo "❌ Frontend API URL not configured"
```
