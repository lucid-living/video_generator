# Supabase Storage Setup Guide

This project uses Supabase Storage to store reference images, organized by workflow/project. Each workflow gets its own folder in the `reference-images` bucket.

## Setup Steps

### 1. Create Storage Bucket

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket**
5. Configure the bucket:
   - **Name**: `reference-images`
   - **Public bucket**: ✅ **Enable** (uncheck "Private bucket")
   - This allows images to be accessed via public URLs
6. Click **Create bucket**

### 2. Configure Bucket Policies (Recommended)

For better security, configure policies to control access:

#### Public Read Access (Required)
1. Go to **Storage** → **Policies** → `reference-images`
2. Click **New Policy**
3. Create a policy for SELECT operations:
   - **Policy Name**: `Public Read Access`
   - **Allowed Operation**: `SELECT`
   - **Policy Definition**: `true` (allows anyone to read)
   - Click **Save**

#### Authenticated Upload (Optional - for backend)
If you want to restrict uploads to authenticated users only:

1. Create a policy for INSERT operations:
   - **Policy Name**: `Authenticated Upload`
   - **Allowed Operation**: `INSERT`
   - **Policy Definition**: `auth.role() = 'authenticated'`
   - Click **Save**

**Note**: For backend uploads, you can use the service role key instead of the anon key, which bypasses RLS policies.

### 3. Environment Variables

Ensure your backend `.env.local` file includes:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# For backend uploads, you can also use service role key (bypasses RLS)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important**: 
- The `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required for the backend to upload images
- The service role key is optional but recommended for backend operations as it bypasses RLS policies

### 4. Verify Setup

1. Start your backend server
2. Generate a reference image in the app
3. Check the Supabase Storage dashboard - you should see:
   - Bucket: `reference-images`
   - Folder structure: `{workflow_id}/{image_id}.png`

## Image Organization

Images are organized in Supabase Storage as:
- **Bucket**: `reference-images`
- **Folder per workflow**: `{workflow_id}/`
- **File naming**: `{workflow_id}/{image_id}.png`

Example structure:
```
reference-images/
  ├── workflow_1234567890_abc123/
  │   ├── img_001.png
  │   ├── img_002.png
  │   └── ...
  └── workflow_1234567891_def456/
      ├── img_001.png
      └── ...
```

## Public URLs

Images uploaded to Supabase Storage are accessible via public URLs:
```
https://{your-project}.supabase.co/storage/v1/object/public/reference-images/{workflow_id}/{image_id}.png
```

These URLs are automatically generated and returned by the backend API when images are uploaded.

## Troubleshooting

### Images not uploading

1. **Check bucket exists**: Verify `reference-images` bucket exists in Supabase dashboard
2. **Check bucket is public**: Ensure "Public bucket" is enabled
3. **Check environment variables**: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
4. **Check backend logs**: Look for error messages about bucket not found or authentication failures

### Images not displaying

1. **Check bucket policies**: Ensure SELECT policy allows public read access
2. **Check URL format**: Verify the storage URL follows the correct format
3. **Check CORS**: Supabase Storage should handle CORS automatically, but verify if issues persist

### Permission errors

- If using anon key: Ensure bucket policies allow the operation
- If using service role key: It bypasses RLS, so should work regardless of policies
- Check that the key has the correct permissions in Supabase dashboard

## Migration from Google Drive

If you were previously using Google Drive:

1. **Old images**: Images stored in Google Drive will continue to work if they have valid URLs
2. **New images**: All new images will be stored in Supabase Storage
3. **Migration**: You can manually migrate old images by downloading from Google Drive and re-uploading through the app

## Benefits of Supabase Storage

- ✅ **Integrated**: Same platform as your database
- ✅ **Simple**: No OAuth setup required
- ✅ **Fast**: CDN-backed storage for quick access
- ✅ **Scalable**: Handles large files efficiently
- ✅ **Cost-effective**: Generous free tier
- ✅ **Public URLs**: Easy to share and display images
