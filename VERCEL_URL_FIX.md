# Quick Fix: Add Vercel URL to Railway CORS

## Your Vercel URL
```
https://video-generator-green.vercel.app
```

## Action Required

Go to Railway → Backend Service → Variables → `CORS_ORIGINS`

**Current value (probably):**
```
http://localhost:5173,http://localhost:3000
```

**Update to:**
```
https://video-generator-green.vercel.app,http://localhost:5173,http://localhost:3000
```

**Important:**
- No spaces around commas
- No trailing slash
- Exact URL: `https://video-generator-green.vercel.app` (not `.vercel.app/`)

After updating, Railway will auto-redeploy and CORS should work!
