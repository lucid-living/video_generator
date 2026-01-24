# Deployment Guide

This guide covers deploying the FastAPI backend to make it publicly accessible for Kie.ai callbacks.

## Quick Deploy Options

### Option 1: Railway (Recommended - Easiest)

Railway is the simplest option with automatic deployments from GitHub.

#### Steps:

1. **Sign up at [railway.app](https://railway.app)**

2. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the deployment:**
   - Railway will auto-detect the Dockerfile
   - Set the root directory to `/` (project root)

4. **Add environment variables:**
   - Go to your project → Variables
   - Add these variables:
     ```
     BACKEND_URL=https://your-app-name.railway.app
     GOOGLE_AI_API_KEY=your-key
     KIE_AI_API_KEY=your-key
     OPENAI_API_KEY=your-key (optional, fallback)
     KLING_ACCESS_KEY=your-key (optional)
     KLING_SECRET_KEY=your-key (optional)
     CORS_ORIGINS=https://your-frontend-url.com,http://localhost:5173
     ```

5. **Deploy:**
   - Railway will automatically deploy
   - Your app will be available at `https://your-app-name.railway.app`
   - Update `BACKEND_URL` variable to match your Railway URL

6. **Test the webhook:**
   - Visit `https://your-app-name.railway.app/api/webhooks/kie-callback`
   - Should return: `{"status":"ok","message":"Kie.ai webhook endpoint is active"}`

---

### Option 2: Render

Render offers free tier hosting with easy setup.

#### Steps:

1. **Sign up at [render.com](https://render.com)**

2. **Create a new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure the service:**
   - **Name:** `video-generator-backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory:** Leave empty (project root)

4. **Add environment variables:**
   - Go to Environment section
   - Add all required variables (same as Railway above)
   - Set `BACKEND_URL` to your Render URL after first deploy

5. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your app will be at `https://video-generator-backend.onrender.com` (or custom domain)

---

### Option 3: Fly.io

Fly.io offers global edge deployment.

#### Steps:

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create app:**
   ```bash
   fly launch
   ```
   - Follow prompts
   - Don't deploy yet (we'll configure first)

4. **Create `fly.toml`:**
   ```toml
   app = "your-app-name"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
     processes = ["app"]

   [[services]]
     http_checks = []
     internal_port = 8000
     processes = ["app"]
     protocol = "tcp"
     script_checks = []
   ```

5. **Set secrets:**
   ```bash
   fly secrets set BACKEND_URL=https://your-app-name.fly.dev
   fly secrets set GOOGLE_AI_API_KEY=your-key
   fly secrets set KIE_AI_API_KEY=your-key
   # ... etc
   ```

6. **Deploy:**
   ```bash
   fly deploy
   ```

---

## After Deployment

### 1. Update Environment Variables

Make sure `BACKEND_URL` points to your deployed URL:
- Railway: `https://your-app-name.railway.app`
- Render: `https://your-app-name.onrender.com`
- Fly.io: `https://your-app-name.fly.dev`

### 2. Test the Webhook Endpoint

Visit: `https://your-deployed-url/api/webhooks/kie-callback`

Should return:
```json
{
  "status": "ok",
  "message": "Kie.ai webhook endpoint is active"
}
```

### 3. Update Local Development

Update your local `.env.local`:
```env
BACKEND_URL=https://your-deployed-url
```

Now callbacks will work! The deployed backend will receive callbacks from Kie.ai.

---

## Troubleshooting

### Callbacks Still Not Working?

1. **Check webhook endpoint is accessible:**
   ```bash
   curl https://your-deployed-url/api/webhooks/kie-callback
   ```

2. **Check logs:**
   - Railway: Project → Deployments → View Logs
   - Render: Dashboard → Logs tab
   - Fly.io: `fly logs`

3. **Verify BACKEND_URL:**
   - Make sure it matches your deployed URL exactly
   - Should be `https://` not `http://`

4. **Check CORS:**
   - Make sure `CORS_ORIGINS` includes your frontend URL
   - Or set to `*` for development (not recommended for production)

### Port Issues

- Railway/Render/Fly.io set `PORT` environment variable automatically
- The Dockerfile uses `--port ${PORT:-8000}` to handle this
- Make sure your start command uses `$PORT` or `$PORT` environment variable

---

## Production Considerations

1. **Use HTTPS:** All deployment platforms provide HTTPS automatically
2. **Set CORS properly:** Don't use `*` in production - specify your frontend domain
3. **Monitor logs:** Set up logging/monitoring for production
4. **Rate limiting:** Consider adding rate limiting for production
5. **Database:** If using Supabase, make sure connection strings are secure

