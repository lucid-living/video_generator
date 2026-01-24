# AI Music Video Generation Project - Architecture Plan

## Project Overview

This project creates an automated machine learning pipeline that generates branded music videos from text prompts. The system integrates multiple AI services to create a complete, brand-consistent music video production workflow.

## Technology Stack

### Frontend
- **Framework**: React.js
- **State Management**: Supabase (for persistence)
- **Development**: TypeScript, Vite (recommended)

### Backend
- **Framework**: FastAPI (Python)
- **API Integrations**:
  - Gemini API (via Google AI) - Creative planning & storyboarding
  - Suno Web Interface - Music generation (no public API available)
  - Imagen API (Nano Banana via Gemini) - Image generation for style consistency
  - Kling/Hailuo API - Text-to-video generation

### Data Storage
- **Primary**: Supabase PostgreSQL (workflow state, storyboards, metadata)
- **File Storage**: Local filesystem or cloud storage for generated assets (audio, images, video clips)

## System Architecture

### Three-Phase Workflow

```
Phase 1: Planning → Phase 2: Assets → Phase 3: Generation
```

#### Phase 1: Creative Planning and Storyboarding
- **Input**: Theme, Style Guide (text)
- **Processing**: GPT/Gemini generates structured JSON storyboard
- **Output**: Storyboard JSON with lyrics, time-coded shots, video prompts

#### Phase 2: Asset Generation
- **Input**: Storyboard JSON, Style Guide
- **Processing**: 
  - Suno web interface generates audio track (user manually generates and provides URL)
  - Nano Banana (via Gemini API) generates reference images
- **Output**: Audio file URL (from Suno), Reference images (base64 PNG)

#### Phase 3: Video Generation and Assembly
- **Input**: Storyboard, Audio, Reference Images
- **Processing**:
  - Kling/Hailuo API generates video clips
  - Post-processing assembles final video
- **Output**: Final MP4 video

## Data Flow

### Storyboard JSON Schema
```json
[
  {
    "line_index": 1,
    "lyric_line": "The neon city sleeps beneath a digital rain,",
    "duration_seconds": 3.0,
    "base_video_prompt": "Cinematic high-angle shot of a lone figure standing on a skyscraper rooftop..."
  }
]
```

### Style Guide Structure
- Centralized text variable containing visual identity keywords
- Injected into all prompts for consistency
- Examples: "cyberpunk", "neon lighting", "futuristic aesthetic"

## Project Structure

```
video_generator/
├── frontend/                 # React.js application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── StoryboardEditor.tsx
│   │   │   ├── StyleGuideInput.tsx
│   │   │   ├── VideoPreview.tsx
│   │   │   └── SunoMusicGenerator.tsx
│   │   ├── services/         # API client services
│   │   │   ├── supabase.ts
│   │   │   └── api.ts
│   │   ├── types/            # TypeScript types
│   │   │   └── storyboard.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── planning.py   # Phase 1 endpoints
│   │   │   ├── assets.py    # Phase 2 endpoints
│   │   │   └── generation.py # Phase 3 endpoints
│   │   ├── services/         # External API integrations
│   │   │   ├── gemini.py     # GPT/Gemini storyboard generation
│   │   │   ├── suno.py       # Music generation
│   │   │   ├── imagen.py     # Image generation
│   │   │   └── video.py      # Video generation (Kling/Hailuo)
│   │   ├── models/           # Pydantic models
│   │   │   ├── storyboard.py
│   │   │   └── workflow.py
│   │   └── main.py           # FastAPI app
│   ├── tests/                # Pytest tests
│   ├── requirements.txt
│   └── .env.example
│
├── PLANNING.md              # This file
├── TASK.md                  # Task tracking
└── README.md                # Setup and usage instructions
```

## Key Design Principles

### 1. Consistency Strategy
- **Style Guide Injection**: All prompts include style guide text
- **Reference Images**: High-fidelity images lock visual style
- **Prompt Concatenation**: `[Style Guide] + [Base Prompt]` for every shot

### 2. Data Persistence
- All workflow state saved to Supabase PostgreSQL
- Enables resumable workflows
- Version control for storyboard iterations

### 3. Modularity
- Each phase is independently testable
- API integrations are isolated services
- Clear separation between frontend and backend

### 4. Error Handling
- Graceful degradation if external APIs fail
- Retry logic for transient failures
- User feedback for all async operations

## API Integration Patterns

### Gemini API (Storyboard Generation)
- **Input**: Theme, Style Guide, optional constraints
- **Output**: Structured JSON storyboard
- **Validation**: Pydantic models ensure schema compliance

### Suno (Music Generation)
- **Input**: Complete lyrics (reconstructed from storyboard)
- **Method**: Web interface (no public API available)
- **Output**: Audio file URL (user provides after manual generation)
- **Storage**: URL stored in workflow state

### Imagen API (Reference Images)
- **Input**: Style Guide + character/setting description
- **Output**: Base64 PNG images
- **Usage**: Passed as reference to video generation API

### Kling/Hailuo API (Video Generation)
- **Input**: Final prompt, duration, reference images
- **Output**: Video clip URLs or files
- **Note**: Currently external/manual step per plan

## Development Guidelines

### Code Style
- **Python**: PEP8, type hints, Black formatter
- **TypeScript**: ESLint, Prettier
- **Documentation**: Google-style docstrings

### Testing
- Unit tests for all services (Pytest)
- Integration tests for API workflows
- Frontend component tests (React Testing Library)

### File Size Limits
- No file longer than 500 lines
- Split into modules when approaching limit

## Environment Variables

### Backend (.env or .env.local in project root)
```env
# Gemini API (for storyboard and image generation)
GOOGLE_AI_API_KEY=

# Google Drive API (for image storage)
# Download OAuth 2.0 credentials from Google Cloud Console
# Place credentials.json in the backend directory
GOOGLE_DRIVE_CREDENTIALS_FILE=credentials.json  # Optional: custom path
GOOGLE_DRIVE_TOKEN_FILE=token.json  # Optional: custom path (auto-generated)

# Video Generation API (Kling AI)
# New JWT-based authentication (recommended)
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
KLING_API_URL=
# Legacy single API key (for backward compatibility)
KLING_API_KEY=
# Alternative: Hailuo API
HAILUO_API_KEY=
HAILUO_API_URL=

# Backend
BACKEND_URL=http://localhost:8000  # Used for Kie.ai callback URL (must be publicly accessible in production)

# Kie.ai API (for Nano Banana Pro image generation)
KIE_AI_API_KEY=  # Get your key at https://kie.ai/nano-banana-pro

# Content Machine Integration (optional)
# If you have Content Machine running, the frontend can fetch channel information
# Set VITE_CONTENT_MACHINE_API_URL in frontend/.env.local
```

### Frontend (.env.local in frontend directory)
```env
# Supabase (CRM project)
VITE_SUPABASE_URL=https://owgvmzuvyiutuuouwfjq.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API
VITE_API_URL=http://localhost:8000
```

**Note**: Suno does not require an API key - users generate music via Suno's web interface and provide the audio URL manually.

## Next Steps

See TASK.md for current development tasks and priorities.


