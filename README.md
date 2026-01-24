# AI Music Video Generator

An automated machine learning pipeline that generates branded music videos from text prompts. This system integrates multiple AI services to create complete, brand-consistent music video productions.

## Features

- **Automated Storyboarding**: Generate structured storyboards with lyrics and time-coded video prompts using Gemini AI
- **Music Generation**: Create original music tracks using Suno web interface
- **Visual Consistency**: Generate reference images with Nano Banana (Gemini) to maintain brand style
- **Video Generation**: Orchestrate video clip generation with Kling/Hailuo APIs
- **Workflow Persistence**: Save and resume projects using Supabase

## Technology Stack

- **Frontend**: React.js with TypeScript
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **AI Services**: Gemini, Suno (web interface), Nano Banana (via Gemini), Kling/Hailuo

## Project Structure

```
video_generator/
├── frontend/          # React.js application
├── backend/           # FastAPI application
├── PLANNING.md        # Architecture documentation
└── TASK.md            # Task tracking
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Supabase project (CRM project)
- API keys for:
  - Google AI (Gemini) - for storyboard and image generation
  - Kling or Hailuo - for video generation
  - Suno account (for web interface, no API key needed)

### Google Drive Setup

The app uses Google Drive to store reference images, organized by project/workflow. Setup:

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Drive API**:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google Drive API"
   - Click **Enable**

3. **Create OAuth 2.0 Credentials**:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Desktop app**
   - Name it (e.g., "AI Music Video Generator")
   - Click **Create**
   - Download the credentials JSON file

4. **Place Credentials File**:
   - Rename the downloaded file to `credentials.json`
   - Place it in the `backend/` directory
   - Add `credentials.json` and `token.json` to `.gitignore` (token.json is auto-generated)

5. **First Run Authentication**:
   - When you first run the backend, it will open a browser window
   - Sign in with your Google account
   - Grant permissions to access Google Drive
   - A `token.json` file will be created automatically

**Note**: Images are organized in Google Drive as:
- Main folder: `AI Music Video Generator Projects`
- Subfolder per workflow: `Workflow_{workflow_id}/`
- Each image is stored as: `{image_id}.png`

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Create .env.local file in project root with your API keys:
# - GOOGLE_AI_API_KEY (for Gemini storyboard generation)
# - KIE_AI_API_KEY (for Nano Banana Pro image generation)
# - OPENAI_API_KEY (fallback for DALL-E image generation)
# - BACKEND_URL=http://localhost:8000 (for callback URL)
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
API documentation (Swagger UI) at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
# Create .env.local with your Supabase config and API URL:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_API_URL=http://localhost:8000
# VITE_CONTENT_MACHINE_API_URL=http://localhost:8001  # Optional: for Content Machine integration
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

### Phase 1: Planning
1. **Define Theme & Style Guide**: Enter your video theme and visual style preferences in the web interface
2. **Generate Storyboard**: Click "Generate Storyboard" - AI generates lyrics and time-coded video prompts
3. **Edit Storyboard**: Refine durations and prompts as needed in the storyboard editor

### Phase 2: Asset Generation
4. **Generate Music**: 
   - Click "Open Suno" to open Suno's web interface
   - Paste the lyrics from the storyboard
   - Generate your music track on Suno
   - Copy the audio URL and paste it back into the app
5. **Generate Reference Images**: 
   - Create style-consistent reference images via Nano Banana (Gemini API)
   - **Review & Approve**: Click on each generated image to view it full-size
   - **Approve** images you like - they'll be marked with a green checkmark
   - **Reject & Regenerate** images you don't like - they'll be automatically regenerated
   - **Save to Style Guide**: For approved images, click "Save to Style Guide" to upload them to Supabase storage. These saved images will be used as references for future image generations, ensuring visual consistency across projects.

### Phase 3: Video Generation
6. **Generate Video Clips**: For each storyboard shot, generate video clips using Kling/Hailuo API
7. **Assemble Final Video**: Combine all clips with the audio track (post-processing step)

**Note**: Video generation (Phase 3) is currently an external/manual step per the project plan. The API structure is in place for when the integration is ready.

## Deployment

For production deployment and making the backend publicly accessible (required for Kie.ai callbacks), see `DEPLOYMENT.md`.

Quick options:
- **Railway** (recommended): Auto-deploy from GitHub, free tier available
- **Render**: Free tier, easy setup
- **Fly.io**: Global edge deployment

## Development

See `PLANNING.md` for detailed architecture documentation.
See `TASK.md` for current development tasks.

## License

[Your License Here]

