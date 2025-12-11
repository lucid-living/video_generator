/**
 * Component for generating music with Suno.
 * Since Suno API is not publicly available, this component provides
 * a link to Suno's web interface with pre-filled lyrics.
 */

import { useState } from "react";
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

  // Generate Suno URL with lyrics
  const getSunoUrl = () => {
    const baseUrl = "https://suno.com/create";
    // Note: Suno may not support direct URL parameters
    // This opens their create page where user can paste lyrics
    return baseUrl;
  };

  const handleOpenSuno = () => {
    const url = getSunoUrl();
    window.open(url, "_blank", "noopener,noreferrer");
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
        <p className="text-sm text-gray-600 mb-4">
          Suno API is not publicly available. Generate your music on Suno's website,
          then paste the audio URL here.
        </p>
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

        {/* Open Suno Button */}
        <button
          onClick={handleOpenSuno}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          🎵 Open Suno to Generate Music
        </button>

        <div className="text-sm text-gray-500 text-center">or</div>

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

