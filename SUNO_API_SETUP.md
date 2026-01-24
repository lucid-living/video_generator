# Kie.ai Suno API Integration

This document explains how to use the Kie.ai Suno API for automatic music generation.

## Setup

### 1. Get Your API Key

1. Visit [Kie.ai API Key Management](https://kie.ai/api-key)
2. Create or copy your API key
3. Add it to your backend `.env.local` file:

```env
KIE_AI_API_KEY=your_api_key_here
BACKEND_URL=http://localhost:8000  # For callback URL (must be publicly accessible in production)
```

### 2. How It Works

The integration supports two modes:

#### **API Mode (Automatic)**
- Uses Kie.ai Suno API for automatic music generation
- Music is generated asynchronously in the background
- The system polls for completion and automatically updates when ready
- Requires `KIE_AI_API_KEY` to be set

#### **Manual Mode (Fallback)**
- Opens Suno's website for manual generation
- User generates music on Suno and uploads the result
- Works without API key

## Usage

### In the Frontend

1. **Enable API Mode**: Check the "Use Kie.ai API" checkbox in the Suno Music Generator component
2. **Enter Lyrics**: The lyrics from your storyboard are automatically used
3. **Click "Generate Music with API"**: The system will:
   - Submit the generation request to Kie.ai
   - Show status updates
   - Poll for completion every 5 seconds
   - Automatically update the workflow when music is ready

### API Parameters

The system uses these default settings:
- **Model**: V5 (superior musical expression, faster generation)
- **Mode**: Non-custom mode (simpler, only prompt required)
- **Instrumental**: false (includes vocals/lyrics)
- **Title**: "Generated Track" (default)

You can customize these in the backend API endpoint if needed.

## Callback System

The system uses webhooks to receive generation updates:

1. **Callback URL**: `{BACKEND_URL}/api/webhooks/suno-callback`
2. **Callback Types**:
   - `text`: Text generation complete
   - `first`: First track complete
   - `complete`: All tracks complete (usually 2 variations)

The callback endpoint automatically processes completed tracks and updates workflows.

## Testing

### Test the API

1. **Start the backend**:
   ```bash
   cd backend
   source venv_linux/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Generate a storyboard** with lyrics

4. **In the Music Generation section**:
   - Check "Use Kie.ai API"
   - Click "Generate Music with API"
   - Watch the status updates
   - Music should appear automatically when complete

### Verify Callback Endpoint

The callback endpoint should be accessible at:
- `http://localhost:8000/api/webhooks/suno-callback` (GET for verification)
- `http://localhost:8000/api/webhooks/suno-callback` (POST for callbacks)

**Note**: For production, `BACKEND_URL` must be publicly accessible so Kie.ai can send callbacks.

## Troubleshooting

### API Key Not Working
- Verify `KIE_AI_API_KEY` is set in `.env.local`
- Check that the API key is valid at [Kie.ai API Key Management](https://kie.ai/api-key)
- Ensure you have sufficient credits

### Callback Not Receiving Updates
- Verify `BACKEND_URL` is set correctly
- Ensure the backend is publicly accessible (for production)
- Check backend logs for callback errors
- The system will fall back to polling if callbacks fail

### Generation Taking Too Long
- Music generation typically takes 1-3 minutes
- The system polls every 5 seconds
- You can check task status manually via: `GET /api/assets/music-task/{task_id}`

### Fallback to Manual Mode
- If API key is missing, the system automatically falls back to manual mode
- Uncheck "Use Kie.ai API" to force manual mode
- Manual mode requires uploading the generated audio file

## API Documentation

For full API documentation, see:
- [Kie.ai Suno API Docs](https://docs.kie.ai/suno-api/generate-music)
- [Complete Documentation Index](https://docs.kie.ai/llms.txt)

## Models Available

- **V5**: Superior musical expression, faster generation (recommended)
- **V4_5PLUS**: Richer sound, max 8 min
- **V4_5**: Smarter prompts, faster generations, max 8 min
- **V4_5ALL**: Smarter prompts, faster generations, max 8 min
- **V4**: Improved vocal quality, max 4 min

## Character Limits

### Non-Custom Mode (Default)
- `prompt`: Maximum 500 characters

### Custom Mode
- **V4**: `prompt` 3000 chars, `style` 200 chars
- **V4_5 & V4_5PLUS**: `prompt` 5000 chars, `style` 1000 chars
- **V4_5ALL**: `prompt` 5000 chars, `style` 1000 chars
- **V5**: `prompt` 5000 chars, `style` 1000 chars
- `title`: Maximum 80 characters (all models)
