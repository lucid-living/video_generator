# Frontend Deployment to Vercel

This guide covers deploying the React frontend to Vercel.

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- Railway backend deployed and accessible
- Supabase project configured

## Quick Deploy Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Sign up/Login to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up or log in with GitHub

2. **Import Your Project:**
   - Click **"Add New..."** → **"Project"**
   - Import your GitHub repository: `lucid-living/video_generator`
   - Vercel will auto-detect it's a Vite project

3. **Configure Project Settings:**
   - **Root Directory:** Select `frontend` (or configure it)
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

4. **Set Environment Variables:**
   Click **"Environment Variables"** and add:
   
   ```env
   # Supabase Configuration (Required)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   
   # Backend API URL (Required - Your Railway backend)
   VITE_API_URL=https://your-railway-backend.up.railway.app
   
   # Optional: Content Machine Integration
   VITE_CONTENT_MACHINE_API_URL=http://localhost:8001
   ```
   
   **Important:** Replace with your actual values:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `VITE_API_URL`: Your Railway backend URL (e.g., `https://videogenerator-production.up.railway.app`)

5. **Deploy:**
   - Click **"Deploy"**
   - Vercel will build and deploy your frontend
   - Your app will be available at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

4. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for environment variables, add them or set them later in the dashboard

5. **Set Environment Variables:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add VITE_API_URL
   ```
   Enter the values when prompted.

6. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://owgvmzuvyiutuuouwfjq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_API_URL` | Your Railway backend URL | `https://videogenerator-production.up.railway.app` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CONTENT_MACHINE_API_URL` | Content Machine API URL (if using) | `http://localhost:8001` |

## After Deployment

### 1. Update Railway CORS Settings

Make sure your Railway backend allows requests from your Vercel frontend:

1. Go to Railway dashboard → Your backend service → **Variables**
2. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://your-project.vercel.app,http://localhost:5173
   ```
   Or set it to `*` for development (not recommended for production)

3. Railway will automatically redeploy

### 2. Test Your Deployment

1. **Visit your Vercel URL:**
   - Should load the frontend application
   - Check browser console for any errors

2. **Test API Connection:**
   - Try generating a storyboard
   - Check if it connects to your Railway backend

3. **Test Supabase Connection:**
   - Try saving a workflow
   - Check if data persists in Supabase

## Troubleshooting

### Build Fails

1. **Check Build Logs:**
   - Vercel dashboard → Your deployment → **Build Logs**
   - Look for error messages

2. **Common Issues:**
   - Missing environment variables → Add them in Vercel dashboard
   - TypeScript errors → Fix in code before deploying
   - Missing dependencies → Check `package.json`

### Frontend Can't Connect to Backend

1. **Check Environment Variables:**
   - Vercel dashboard → Your project → **Settings** → **Environment Variables**
   - Verify `VITE_API_URL` is set correctly
   - Make sure it's set for **Production** environment

2. **Check CORS:**
   - Railway backend must allow your Vercel domain
   - Update `CORS_ORIGINS` in Railway variables

3. **Check Backend is Running:**
   - Test Railway backend directly: `curl https://your-railway-url/health`
   - Should return: `{"status":"healthy"}`

### Supabase Connection Issues

1. **Check Environment Variables:**
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
   - Make sure they're correct (no typos)

2. **Check Supabase Project:**
   - Verify your Supabase project is active
   - Check if RLS policies allow public access (if needed)

## Custom Domain (Optional)

1. **Add Custom Domain:**
   - Vercel dashboard → Your project → **Settings** → **Domains**
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Environment Variables:**
   - Update `CORS_ORIGINS` in Railway to include your custom domain

## Continuous Deployment

Vercel automatically deploys when you push to your GitHub repository:

- **Push to `main` branch** → Deploys to production
- **Push to other branches** → Creates preview deployments

No manual deployment needed after initial setup!

## Project Structure for Vercel

Vercel needs to know the frontend is in the `frontend/` directory. Configure this in:

**Vercel Dashboard → Settings → General → Root Directory:**
- Set to `frontend`

Or use `vercel.json` in the project root (if deploying from root):

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install"
}
```

## Next Steps

1. ✅ Deploy frontend to Vercel
2. ✅ Set environment variables
3. ✅ Update Railway CORS settings
4. ✅ Test the full application
5. ✅ Set up custom domain (optional)

Your frontend should now be live and connected to your Railway backend!
