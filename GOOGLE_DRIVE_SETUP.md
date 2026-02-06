# Google Drive Setup Guide

> **⚠️ DEPRECATED**: This project now uses Supabase Storage instead of Google Drive.
> 
> **Please see [SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md) for current setup instructions.**
> 
> This file is kept for reference only. Google Drive integration is no longer actively maintained.

---

This project **previously** used Google Drive to store reference images, organized by workflow/project. Each project gets its own folder in Google Drive.

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: "AI Music Video Generator" (or your preferred name)
4. Click **Create**

### 2. Enable Google Drive API

1. In your Google Cloud project, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click on **Google Drive API**
4. Click **Enable**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (unless you have a Google Workspace)
   - App name: "AI Music Video Generator"
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Click **Add or Remove Scopes**
     - Search for "drive.file"
     - Select `.../auth/drive.file` (Read/write access to files created by the app)
     - Click **Update** → **Save and Continue**
   - Test users: Add your email address
   - Click **Save and Continue** → **Back to Dashboard**

4. Create OAuth Client ID:
   - Application type: **Desktop app**
   - Name: "AI Music Video Generator Desktop"
   - Click **Create**
   - Click **Download JSON** (or copy the credentials)

### 4. Place Credentials File

1. Rename the downloaded file to `credentials.json`
2. Place it in the `backend/` directory:
   ```
   backend/
   ├── credentials.json  ← Place here
   ├── app/
   └── ...
   ```

3. Add to `.gitignore`:
   ```
   # Google Drive credentials (sensitive)
   backend/credentials.json
   backend/token.json
   ```

### 5. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- `google-auth`
- `google-auth-oauthlib`
- `google-auth-httplib2`
- `google-api-python-client`

### 6. First Run Authentication

When you first start the backend server:

```bash
cd backend
uvicorn app.main:app --reload
```

1. The server will detect that `token.json` doesn't exist
2. It will automatically open a browser window
3. Sign in with your Google account
4. Grant permissions to access Google Drive
5. A `token.json` file will be created automatically in the `backend/` directory

**Note**: The `token.json` file stores your authentication token. Keep it secure and don't commit it to git.

## How It Works

### Folder Structure

Images are organized in Google Drive as:

```
AI Music Video Generator Projects/
├── Workflow_workflow_1234567890_abc123/
│   ├── image_001.png
│   ├── image_002.png
│   └── ...
├── Workflow_workflow_9876543210_xyz789/
│   ├── image_001.png
│   └── ...
└── ...
```

- **Main folder**: `AI Music Video Generator Projects` (created automatically)
- **Workflow folders**: One folder per workflow/project (`Workflow_{workflow_id}`)
- **Images**: Each image is stored as `{image_id}.png`

### Image URLs

Images are uploaded with public read access and get shareable URLs like:
```
https://drive.google.com/uc?export=view&id={file_id}
```

These URLs can be used directly in `<img>` tags or loaded via fetch.

## Troubleshooting

### "Credentials file not found"

- Make sure `credentials.json` is in the `backend/` directory
- Check that the file is named exactly `credentials.json` (not `credentials (1).json`)
- Verify the file contains valid JSON

### "Token expired" or Authentication errors

- Delete `backend/token.json`
- Restart the backend server
- Re-authenticate when prompted

### "Permission denied" errors

- Make sure you granted all requested permissions during OAuth
- Check that the Google Drive API is enabled in your Google Cloud project
- Verify your OAuth consent screen is configured correctly

### Images not loading

- Check that images are being uploaded successfully (check backend logs)
- Verify the Google Drive URLs are accessible
- Make sure images have public read permissions (set automatically)

## Environment Variables

Optional environment variables (defaults shown):

```env
GOOGLE_DRIVE_CREDENTIALS_FILE=credentials.json
GOOGLE_DRIVE_TOKEN_FILE=token.json
```

These can be set in your `.env.local` file if you want custom paths.

## Security Notes

- **Never commit** `credentials.json` or `token.json` to git
- Keep your OAuth credentials secure
- The app only requests `drive.file` scope (read/write access to files created by the app)
- Images are stored with public read access for easy sharing

## Benefits Over Supabase Storage

- ✅ **Better organization**: Each project gets its own folder
- ✅ **Easy access**: View images directly in Google Drive
- ✅ **No bucket setup**: No need to configure storage buckets
- ✅ **Familiar interface**: Google Drive is widely used
- ✅ **Automatic backup**: Google Drive handles backups
- ✅ **Easy sharing**: Can share entire project folders if needed

