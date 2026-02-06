# Environment Variables: Vercel vs Railway

## Important: Variables Go in Different Places!

Your app has **two separate deployments**:
- **Frontend (Vercel)** - React app that users interact with
- **Backend (Railway)** - FastAPI server that handles API requests

Each needs different environment variables!

---

## ✅ Frontend Variables (Vercel)

These go in **Vercel** → Your Project → Settings → Environment Variables:

```env
# Supabase (for frontend database access)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL (points to Railway)
VITE_API_URL=https://videogenerator-production.up.railway.app

# Optional: Content Machine Integration
VITE_CONTENT_MACHINE_API_URL=http://localhost:8001
```

**Note**: Frontend variables must start with `VITE_` to be accessible in the React app.

---

## ✅ Backend Variables (Railway)

These go in **Railway** → Backend Service → Variables:

### Required for Image Generation:
```env
# At least ONE of these is required for image generation:
KIE_AI_API_KEY=your-kie-ai-key          # For Nano Banana Pro (recommended)
# OR
OPENAI_API_KEY=your-openai-key          # Fallback for DALL-E 3
# OR  
GOOGLE_AI_API_KEY=your-google-ai-key    # For Gemini image generation
```

### Required for Storage Uploads:
```env
# Supabase Storage (for storing generated images)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# OR use service role key (bypasses RLS):
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Required for CORS:
```env
# Allow your Vercel frontend to make requests
CORS_ORIGINS=https://video-generator-green.vercel.app,http://localhost:5173,http://localhost:3000
```

### Optional (for other features):
```env
# Backend URL (for callbacks)
BACKEND_URL=https://videogenerator-production.up.railway.app

# Video Generation (optional)
KLING_ACCESS_KEY=your-kling-access-key
KLING_SECRET_KEY=your-kling-secret-key
KLING_API_URL=https://api.kling.ai

# Storyboard Generation (optional)
GOOGLE_AI_API_KEY=your-google-ai-key
```

---

## 🔍 How to Check What's Missing

### Check Railway Logs

After deploying, check Railway logs for error messages:
- `❌ ValueError: KIE_AI_API_KEY environment variable not set` → Add `KIE_AI_API_KEY` to Railway
- `❌ Supabase credentials not configured` → Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Railway
- `CORS Debug: WARNING - Origin ... not in allowed origins` → Add Vercel URL to `CORS_ORIGINS` in Railway

### Check Vercel Logs

Check Vercel deployment logs for:
- `VITE_API_URL` not found → Add it to Vercel environment variables
- `VITE_SUPABASE_URL` not found → Add it to Vercel environment variables

---

## 📋 Quick Checklist

### Railway (Backend) Variables:
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- [ ] `KIE_AI_API_KEY` OR `OPENAI_API_KEY` OR `GOOGLE_AI_API_KEY` - At least one for image generation
- [ ] `CORS_ORIGINS` - Include your Vercel URL: `https://video-generator-green.vercel.app`

### Vercel (Frontend) Variables:
- [ ] `VITE_SUPABASE_URL` - Your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key  
- [ ] `VITE_API_URL` - Your Railway backend URL: `https://videogenerator-production.up.railway.app`

---

## 🚨 Common Mistakes

### ❌ Wrong: Adding backend variables to Vercel
```
# Don't add these to Vercel!
KIE_AI_API_KEY=xxx          # Backend only!
SUPABASE_URL=xxx            # Backend only (frontend uses VITE_SUPABASE_URL)
```

### ❌ Wrong: Adding frontend variables to Railway
```
# Don't add these to Railway!
VITE_SUPABASE_URL=xxx       # Frontend only!
VITE_API_URL=xxx            # Frontend only!
```

### ✅ Correct: Separate variables for each service
- **Vercel**: Only `VITE_*` variables
- **Railway**: Only backend variables (no `VITE_` prefix)

---

## 🔄 After Adding Variables

1. **Railway**: Automatically redeploys when you add/update variables
2. **Vercel**: You may need to trigger a redeploy:
   - Go to Deployments → Click "..." → Redeploy
   - Or push a new commit to trigger auto-deploy

---

## 💡 Why This Matters

- **Frontend (Vercel)** makes HTTP requests to **Backend (Railway)**
- **Backend (Railway)** needs API keys to call external services (Kie.ai, OpenAI, Supabase Storage)
- **Frontend (Vercel)** only needs to know where the backend is (`VITE_API_URL`)

Think of it like this:
- Vercel = Your restaurant (frontend)
- Railway = Your kitchen (backend)
- API Keys = Ingredients (only kitchen needs them!)
