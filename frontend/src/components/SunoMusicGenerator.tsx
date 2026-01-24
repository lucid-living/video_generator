/**
 * Component for generating music with Kie.ai Suno API.
 * Supports both API-based generation and manual fallback.
 */

import { useState, useEffect, useRef } from "react";
import { generateMusic, getMusicTaskStatus } from "../services/api";
import type { AudioAsset } from "../types/storyboard";

interface SunoMusicGeneratorProps {
  lyrics: string;
  style?: string;
  onMusicGenerated?: (audio: AudioAsset) => void;
}

export function SunoMusicGenerator({
  lyrics,
  style,
  onMusicGenerated,
}: SunoMusicGeneratorProps) {
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [useApi, setUseApi] = useState(true); // Toggle between API and manual
  const pollCountRef = useRef<number>(0); // Use ref to persist poll count across renders

  // Generate Suno URL with lyrics
  const getSunoUrl = () => {
    const baseUrl = "https://suno.com/create";
    // Note: Suno may not support direct URL parameters
    // This opens their create page where user can paste lyrics
    return baseUrl;
  };

  // Poll for task status if we have a task ID
  useEffect(() => {
    if (!taskId || !useApi) {
      pollCountRef.current = 0; // Reset when taskId is cleared
      return;
    }
    
    // Reset poll count when new task starts
    pollCountRef.current = 0;
    const maxPolls = 60; // Stop polling after 5 minutes (60 * 5 seconds)
    
    const pollInterval = setInterval(async () => {
      pollCountRef.current++;
      const currentCount = pollCountRef.current;
      
      // Stop polling after max attempts
      if (currentCount > maxPolls) {
        clearInterval(pollInterval);
        setGenerationStatus("Generation taking longer than expected. The callback will update when ready.");
        setIsGenerating(false);
        return;
      }
      
      try {
        const status = await getMusicTaskStatus(taskId);
        const statusMsg = status.msg || status.message || "Checking status...";
        setGenerationStatus(`${statusMsg} (${currentCount}/${maxPolls})`);
        
        // Check if we have completed tracks
        const data = status.data;
        if (data) {
          // If data is an array with tracks
          if (Array.isArray(data) && data.length > 0) {
            const firstTrack = data[0];
            if (firstTrack.audio_url) {
              const audioAsset: AudioAsset = {
                audio_id: firstTrack.id || taskId,
                file_url: firstTrack.audio_url,
                duration_seconds: firstTrack.duration || 0,
                lyrics: lyrics,
              };
              onMusicGenerated?.(audioAsset);
              setIsGenerating(false);
              setGenerationStatus("Generation complete!");
              clearInterval(pollInterval);
              pollCountRef.current = 0; // Reset for next time
              return;
            }
          }
          
          // If data has a status field indicating processing
          if (data.status === "processing" || data.message) {
            // Still processing, continue polling
            return;
          }
        }
      } catch (error) {
        // Don't log errors for processing tasks - it's expected
        // Only update status periodically
        if (currentCount % 6 === 0) { // Update status every 30 seconds
          setGenerationStatus(`Waiting for generation... (${currentCount}/${maxPolls})`);
        }
      }
    }, 5000); // Poll every 5 seconds
    
    return () => {
      clearInterval(pollInterval);
      // Don't reset pollCountRef here - let it persist if taskId changes
    };
  }, [taskId, useApi, lyrics, onMusicGenerated]);

  const handleOpenSuno = () => {
    const url = getSunoUrl();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleGenerateWithApi = async () => {
    if (!lyrics.trim()) {
      alert("Please provide lyrics to generate music");
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("Starting generation...");
    setTaskId(null);

    try {
      const audioAsset = await generateMusic(
        lyrics,
        style,
        "Generated Track", // Default title
        false, // Not instrumental
        "V5", // Use V5 model
        false // Use non-custom mode for simplicity
      );

      // Check if we got a task ID (API mode)
      if (audioAsset.file_url?.startsWith("task://")) {
        const extractedTaskId = audioAsset.file_url.replace("task://", "");
        setTaskId(extractedTaskId);
        setGenerationStatus("Generation started! Waiting for completion...");
      } else {
        // Manual mode - user needs to upload/enter URL
        setGenerationStatus("API not available. Please use manual upload below.");
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Failed to generate music:", error);
      alert(`Failed to generate music: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setAudioFile(file);
      // Create a preview URL for the audio player
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl(url);
      
      // Try to get duration from the audio file
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
      });
    } else {
      alert("Please select an audio file (MP3, WAV, etc.)");
    }
  };

  const handleSubmitAudio = async () => {
    if (!audioUrl.trim() && !audioFile) {
      alert("Please either paste an audio URL or upload an audio file");
      return;
    }

    setIsUploading(true);

    try {
      let finalUrl = audioUrl.trim();
      
      // If user uploaded a file, convert it to a data URL
      if (audioFile) {
        const reader = new FileReader();
        finalUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioFile);
        });
      } else {
        // Validate that the URL is a direct audio file
        // Suno page URLs won't work - need direct audio file URLs
        if (audioUrl.includes("suno.com/s/") || audioUrl.includes("suno.com/song/")) {
          alert(
            "⚠️ This looks like a Suno page URL, not a direct audio file URL.\n\n" +
            "To get the direct audio URL:\n" +
            "1. Open the Suno song page\n" +
            "2. Right-click the audio player\n" +
            "3. Select 'Copy audio address' or 'Inspect element'\n" +
            "4. Look for a URL starting with 'https://cdn.suno.ai/' or similar\n\n" +
            "Alternatively, download the audio file from Suno and upload it using the file upload option below."
          );
          setIsUploading(false);
          return;
        }
      }

      const audioAsset: AudioAsset = {
        audio_id: `suno_${Date.now()}`,
        file_url: finalUrl,
        duration_seconds: duration || 0,
        lyrics: lyrics,
      };

      onMusicGenerated?.(audioAsset);
      
      // Clean up preview URL if we used file upload
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
        setAudioFile(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save audio");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
      <div>
        <h3 className="text-lg font-semibold mb-2">Generate Music with Suno</h3>
        <div className="flex items-center gap-2 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useApi}
              onChange={(e) => setUseApi(e.target.checked)}
              className="rounded"
            />
            <span>Use Kie.ai API (automatic generation)</span>
          </label>
        </div>
        {useApi && (
          <p className="text-sm text-gray-600 mb-4">
            Using Kie.ai Suno API for automatic music generation. Music will be generated in the background.
          </p>
        )}
        {!useApi && (
          <p className="text-sm text-gray-600 mb-4">
            Manual mode: Generate your music on Suno's website, then paste the audio URL here.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {/* Lyrics Display */}
        <div>
          <label className="block text-sm font-medium mb-2">Lyrics to Generate:</label>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 max-h-40 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans">{lyrics}</pre>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(lyrics)}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            📋 Copy Lyrics
          </button>
        </div>

        {/* API Generation Button */}
        {useApi && (
          <>
            <button
              onClick={handleGenerateWithApi}
              disabled={isGenerating || !lyrics.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? "⏳ Generating..." : "🎵 Generate Music with API"}
            </button>
            {generationStatus && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                {generationStatus}
              </div>
            )}
            <div className="text-sm text-gray-500 text-center">or</div>
          </>
        )}

        {/* Manual Mode: Open Suno Button */}
        {!useApi && (
          <>
            <button
              onClick={handleOpenSuno}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              🎵 Open Suno to Generate Music
            </button>
            <div className="text-sm text-gray-500 text-center">or</div>
          </>
        )}

        {/* File Upload Option */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Upload Audio File (Recommended):
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          {audioFile && (
            <div className="text-sm text-green-600">
              ✓ Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
          {audioPreviewUrl && (
            <div className="mt-2">
              <audio controls src={audioPreviewUrl} className="w-full">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 text-center">or</div>

        {/* Manual URL Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Paste Direct Audio File URL:
          </label>
          <input
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://cdn.suno.ai/audio.mp3 (direct audio file URL)"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
              placeholder="Duration (seconds)"
              step="0.1"
              min="0"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              onClick={handleSubmitAudio}
              disabled={(!audioUrl.trim() && !audioFile) || isUploading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isUploading ? "Saving..." : "✓ Save Audio"}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md">
          <strong>Instructions:</strong>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>Click "Open Suno" to go to Suno's website</li>
            <li>Paste the lyrics (copied above) into Suno</li>
            <li>Generate your music track</li>
            <li>
              <strong>Option A (Recommended):</strong> Download the audio file from Suno, then upload it using the file upload above
            </li>
            <li>
              <strong>Option B:</strong> Get the direct audio file URL (not the page URL) - look for URLs starting with "https://cdn.suno.ai/" or similar
            </li>
            <li>Paste the direct audio URL or upload the file, then click "Save Audio"</li>
          </ol>
          <p className="mt-2 text-red-600">
            ⚠️ Note: Suno page URLs (like suno.com/s/...) won't work. You need the direct audio file URL or the downloaded file.
          </p>
        </div>
      </div>
    </div>
  );
}

