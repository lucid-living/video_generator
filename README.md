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

### Supabase Storage Setup

The app uses Supabase Storage to store reference images, organized by workflow/project. Setup:

1. **Create Storage Bucket**:
   - Go to your Supabase project dashboard
   - Navigate to **Storage** in the left sidebar
   - Click **New bucket**
   - Name: `reference-images`
   - **Important**: Enable **Public bucket** (uncheck "Private bucket")
   - Click **Create bucket**

2. **Configure Bucket Policies** (Optional but recommended):
   - Go to **Storage** → **Policies** → `reference-images`
   - Add policies for public read access:
     - **Policy Name**: Public Read
     - **Allowed Operation**: SELECT
     - **Policy Definition**: `true` (allows public read access)
   - Add policies for authenticated uploads:
     - **Policy Name**: Authenticated Upload
     - **Allowed Operation**: INSERT
     - **Policy Definition**: `auth.role() = 'authenticated'` (or use service role key for backend)

3. **Environment Variables**:
   - Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in your backend `.env.local`
   - The backend uses these to upload images to Supabase Storage

**Note**: Images are organized in Supabase Storage as:
- Bucket: `reference-images`
- Folder per workflow: `{workflow_id}/`
- Each image is stored as: `{workflow_id}/{image_id}.png`

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
# - SUPABASE_URL (your Supabase project URL)
# - SUPABASE_ANON_KEY (your Supabase anon/service key for storage)
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

