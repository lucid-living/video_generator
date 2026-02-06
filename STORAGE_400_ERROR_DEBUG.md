# Storage 400 Error Debugging Guide

## What is AxiosError?

**AxiosError** is an error thrown by the Axios HTTP client library when a request fails. In your case:

- **Error Type**: `AxiosError`
- **Error Code**: `ERR_BAD_REQUEST` 
- **HTTP Status**: `400 Bad Request`

This means the server received your request but rejected it because something was wrong with the request data or format.

## Common Causes of 400 Errors on `/api/assets/upload-image`

### 1. Missing Supabase Credentials (Most Likely)

**Symptom**: Error mentions "credentials not configured" or "Supabase credentials"

**Fix**: Add these environment variables in Railway:
- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key

**How to check**: Railway → Backend Service → Variables → Look for `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### 2. Missing Storage Bucket

**Symptom**: Error mentions "bucket 'reference-images' not found"

**Fix**: Create the bucket in Supabase:
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `reference-images`
3. Set it to **Public** (so images can be accessed via URL)
4. Enable public access in bucket policies

### 3. Invalid Image Data

**Symptom**: Error mentions "Invalid base64 image data"

**Possible causes**:
- Image data is empty or too short
- Base64 encoding is corrupted
- Missing `data:image/png;base64,` prefix

**Fix**: Check the frontend code that's sending the image data

### 4. Missing Required Fields

**Symptom**: Error mentions "required and cannot be empty"

**Required fields**:
- `image_data_base64` - Base64 encoded image (data URI format)
- `image_id` - Unique identifier for the image
- `workflow_id` - Workflow/project identifier

## How to Debug

### Step 1: Check Railway Logs

After the error occurs, check Railway logs:
1. Railway → Backend Service → Deployments → Latest → View Logs
2. Look for messages starting with:
   - `📤 Upload request:` - Shows what data was received
   - `❌ Validation error:` - Shows validation failures
   - `❌ Supabase Storage upload error:` - Shows storage errors

### Step 2: Check Environment Variables

Verify these are set in Railway:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Test Supabase Connection

You can test if Supabase is configured correctly by checking Railway logs on startup. Look for any Supabase-related errors.

### Step 4: Check Browser Console

In your browser's developer tools (Console tab), expand the AxiosError to see:
- `response.data` - The actual error message from the server
- `response.status` - Should be 400
- `response.headers` - Response headers

## Quick Fix Checklist

- [ ] `SUPABASE_URL` is set in Railway variables
- [ ] `SUPABASE_ANON_KEY` is set in Railway variables  
- [ ] Storage bucket `reference-images` exists in Supabase
- [ ] Bucket `reference-images` is set to **Public**
- [ ] Bucket has proper policies (public read access)
- [ ] Railway backend has been redeployed after adding variables

## Expected Behavior After Fix

When working correctly, Railway logs should show:
```
📤 Upload request: image_id=dalle_45153, workflow_id=xxx, image_data_length=12345, description_length=50
✅ Successfully uploaded image dalle_45153 to storage: https://xxx.supabase.co/storage/v1/object/public/reference-images/xxx/dalle_45153.png
```

## Still Not Working?

1. **Check Railway logs** - Look for the exact error message
2. **Verify Supabase credentials** - Make sure they're correct (no typos, no extra spaces)
3. **Test bucket access** - Try uploading manually in Supabase dashboard
4. **Check network tab** - In browser dev tools, see the actual request/response

The improved error handling will now show more specific error messages in the logs to help identify the exact issue!
