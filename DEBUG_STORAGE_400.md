# Debugging Storage 400 Error

## Current Issue

You're getting a `400 Bad Request` when trying to upload images to Supabase Storage.

## Step 1: Check Railway Logs (Most Important!)

The backend now logs detailed error messages. Check Railway logs:

1. Go to **Railway** → Backend Service → **Deployments** → Latest → **View Logs**
2. Look for messages starting with:
   - `📤 Upload request:` - Shows what data was received
   - `❌ Validation error:` - Shows validation failures
   - `❌ Supabase Storage upload error:` - Shows storage errors

**What to look for:**
- `"Supabase credentials not configured"` → Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Railway
- `"Storage bucket 'reference-images' not found"` → Create the bucket in Supabase dashboard
- `"image_data_base64 is required"` → Frontend isn't sending image data correctly
- `"Invalid base64 image data"` → Image data format is wrong

## Step 2: Check What's Being Sent

The frontend now logs more details. Check your browser console for:
- `[api] Upload error details:` - Shows the backend's error response
- `[imageStorage] Backend error detail:` - Shows the specific error message

## Step 3: Verify Railway Variables

Make sure these are set in **Railway** (not Vercel):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**How to check:**
1. Railway → Backend Service → **Variables** tab
2. Look for `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. If missing, add them

## Step 4: Verify Supabase Storage Bucket

The bucket `reference-images` must exist and be public:

1. Go to **Supabase Dashboard** → **Storage**
2. Check if `reference-images` bucket exists
3. If not, create it:
   - Click "New bucket"
   - Name: `reference-images`
   - Set to **Public** (important!)
   - Enable public access in policies

## Step 5: Test the Request

After checking logs, you should see a specific error message. Common ones:

### Error: "Supabase credentials not configured"
**Fix:** Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Railway variables

### Error: "Storage bucket 'reference-images' not found"
**Fix:** Create the bucket in Supabase dashboard (see Step 4)

### Error: "image_data_base64 is required"
**Fix:** Check frontend code - image data might be empty or not being sent

### Error: "Invalid base64 image data"
**Fix:** Check image data format - should be `data:image/png;base64,...` or pure base64

## Quick Checklist

- [ ] Checked Railway logs for detailed error message
- [ ] `SUPABASE_URL` is set in Railway variables
- [ ] `SUPABASE_ANON_KEY` is set in Railway variables
- [ ] `reference-images` bucket exists in Supabase
- [ ] Bucket is set to **Public**
- [ ] Bucket has public read access policies
- [ ] Railway backend has been redeployed after adding variables

## After Fixing

Once you add the missing variables to Railway:
1. Railway will auto-redeploy
2. Check Railway logs - should see `✅ Successfully uploaded image`
3. Try uploading again from your frontend
4. Check browser console - should see `✓ Image uploaded successfully`

## Still Not Working?

1. **Share the Railway log error message** - It will tell us exactly what's wrong
2. **Check browser console** - Look for `[api] Upload error details:` to see backend response
3. **Verify variables** - Double-check Railway variables are correct (no typos, no extra spaces)

The improved error handling will now show you the exact error message from the backend!
