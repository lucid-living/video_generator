/**
 * API client for backend communication.
 */

import axios from "axios";
import type {
  Storyboard,
  StoryboardGenerationRequest,
  AudioAsset,
  ReferenceImage,
  VideoClip,
  FinalVideoPrompt,
} from "../types/storyboard";

// Support both NEXT_PUBLIC_ (from root .env.local) and VITE_ prefixes
const API_BASE_URL = import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Generate a storyboard from theme and style guide.
 */
export async function generateStoryboard(
  request: StoryboardGenerationRequest
): Promise<Storyboard> {
  const response = await apiClient.post<Storyboard>(
    "/api/planning/generate-storyboard",
    request
  );
  return response.data;
}

/**
 * Generate music track from lyrics.
 */
export async function generateMusic(
  lyrics: string,
  style?: string
): Promise<AudioAsset> {
  const response = await apiClient.post<AudioAsset>("/api/assets/generate-music", {
    lyrics,
    style,
  });
  return response.data;
}

/**
 * Generate a reference image.
 */
export async function generateReferenceImage(
  style_guide: string,
  description: string,
  shot_indices: number[],
  previous_images?: Array<{ description: string; shot_indices: number[]; base64_data?: string }>,
  style_guide_images?: string[],
  use_image_reference?: boolean,
  reference_image_base64?: string
): Promise<ReferenceImage> {
  // Import here to avoid circular dependencies
  const { normalizeStyleGuideImages } = await import("../utils/imageUtils");
  
  // Normalize style guide images (convert URLs to base64 if needed)
  const normalizedImages = style_guide_images
    ? await normalizeStyleGuideImages(style_guide_images)
    : [];

  const response = await apiClient.post<ReferenceImage>(
    "/api/assets/generate-reference-image",
    {
      style_guide,
      description,
      shot_indices,
      previous_images: previous_images || [],
      style_guide_images: normalizedImages,
      use_image_reference: use_image_reference || false,
      reference_image_base64: reference_image_base64 || "",
    }
  );
  return response.data;
}

/**
 * Generate a video clip.
 */
export async function generateVideoClip(
  prompt: FinalVideoPrompt,
  reference_images?: ReferenceImage[]
): Promise<VideoClip> {
  const response = await apiClient.post<VideoClip>(
    "/api/generation/generate-clip",
    {
      prompt,
      reference_images,
    }
  );
  return response.data;
}

/**
 * Analyze reference images/videos to extract style guide information.
 */
export interface StyleAnalysisResult {
  animationStyle: string;
  characterDesign: string;
  colorPalette: string;
  lighting: string;
  cameraComposition: string;
  texturesMaterials: string;
  moodTone: string;
  referenceFilms: string;
  additionalNotes: string;
}

export async function analyzeStyleFromImages(
  images: string[]
): Promise<StyleAnalysisResult> {
  const response = await apiClient.post<StyleAnalysisResult>(
    "/api/assets/analyze-style",
    {
      images,
    }
  );
  return response.data;
}



