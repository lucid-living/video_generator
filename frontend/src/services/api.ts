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

// Debug: Log the API URL being used (remove in production)
if (import.meta.env.DEV) {
  console.log("🔍 API Base URL configured:", API_BASE_URL);
}

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
  style?: string,
  title?: string,
  instrumental?: boolean,
  model?: string,
  customMode?: boolean
): Promise<AudioAsset> {
  // FastAPI expects query parameters for this endpoint
  const params = new URLSearchParams();
  params.append("lyrics", lyrics);
  if (style) params.append("style", style);
  if (title) params.append("title", title);
  params.append("instrumental", String(instrumental || false));
  params.append("model", model || "V5");
  params.append("custom_mode", String(customMode !== undefined ? customMode : true));
  
  // Use GET with query params, or POST with empty body and query params
  const response = await apiClient.post<AudioAsset>(
    `/api/assets/generate-music?${params.toString()}`,
    null, // Empty body
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

/**
 * Get music generation task status and results.
 */
export async function getMusicTaskStatus(taskId: string): Promise<any> {
  const response = await apiClient.get(`/api/assets/music-task/${taskId}`);
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
  reference_image_base64?: string,
  reference_images_base64?: string[]
): Promise<ReferenceImage> {
  // Import here to avoid circular dependencies
  const { normalizeStyleGuideImages } = await import("../utils/imageUtils");
  
  // Normalize style guide images (convert URLs to base64 if needed)
  const normalizedImages = style_guide_images
    ? await normalizeStyleGuideImages(style_guide_images)
    : [];

  // Support both single image (backward compatibility) and multiple images
  const referenceImages = reference_images_base64 && reference_images_base64.length > 0
    ? reference_images_base64
    : (reference_image_base64 ? [reference_image_base64] : []);

  const response = await apiClient.post<ReferenceImage>(
    "/api/assets/generate-reference-image",
    {
      style_guide,
      description,
      shot_indices,
      previous_images: previous_images || [],
      style_guide_images: normalizedImages,
      use_image_reference: use_image_reference || (referenceImages.length > 0),
      reference_images_base64: referenceImages,
      // Keep old field for backward compatibility
      reference_image_base64: reference_image_base64 || "",
    }
  );
  return response.data;
}

/**
 * Submit feedback for a generated image.
 */
export async function submitImageFeedback(
  imageId: string,
  workflowId: string,
  approved: boolean,
  favorited: boolean,
  description: string,
  rating?: number,
  styleGuide?: string,
  promptUsed?: string,
  shotIndices?: number[],
  channelName?: string,
  contentType?: string
): Promise<{ success: boolean; message: string; analyzed: boolean }> {
  const response = await apiClient.post("/api/learning/feedback", {
    image_id: imageId,
    workflow_id: workflowId,
    approved,
    favorited,
    rating,
    description,
    style_guide: styleGuide,
    prompt_used: promptUsed,
    shot_indices: shotIndices || [],
    channel_name: channelName,
    content_type: contentType,
  });
  return response.data;
}

/**
 * Get learning insights from approved/favorited images.
 */
export async function getLearningInsights(
  channelName?: string,
  contentType?: string,
  limit: number = 10
): Promise<{
  common_characteristics: Record<string, any>;
  recommendations: string;
  sample_size: number;
}> {
  const params = new URLSearchParams();
  if (channelName) params.append("channel_name", channelName);
  if (contentType) params.append("content_type", contentType);
  params.append("limit", limit.toString());
  
  const response = await apiClient.get(`/api/learning/insights?${params.toString()}`);
  return response.data;
}

/**
 * Enhance a prompt with learned patterns.
 */
export async function enhancePromptWithLearning(
  basePrompt: string,
  styleGuide: string,
  channelName?: string,
  contentType?: string
): Promise<{
  original_prompt: string;
  enhanced_prompt: string;
  insights_used: any;
}> {
  const response = await apiClient.post("/api/learning/enhance-prompt", {
    base_prompt: basePrompt,
    style_guide: styleGuide,
    channel_name: channelName,
    content_type: contentType,
  });
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

/**
 * Upload an image to Supabase Storage.
 */
export async function uploadImageToStorage(
  imageData: string,
  imageId: string,
  workflowId: string,
  description: string
): Promise<string> {
  const response = await apiClient.post<{ url: string }>(
    "/api/assets/upload-image",
    {
      image_data_base64: imageData,
      image_id: imageId,
      workflow_id: workflowId,
      description,
    }
  );
  return response.data.url;
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImageFromStorage(storageUrl: string): Promise<void> {
  await apiClient.delete("/api/assets/delete-image", {
    data: {
      storage_url: storageUrl,
    },
  });
}

/**
 * [DEPRECATED] Legacy function - use uploadImageToStorage instead.
 * Upload an image to Supabase Storage (previously Google Drive).
 */
export async function uploadImageToGoogleDrive(
  imageData: string,
  imageId: string,
  workflowId: string,
  description: string
): Promise<string> {
  return uploadImageToStorage(imageData, imageId, workflowId, description);
}

/**
 * [DEPRECATED] Legacy function - use deleteImageFromStorage instead.
 * Delete an image from Supabase Storage (previously Google Drive).
 */
export async function deleteImageFromGoogleDrive(fileUrl: string): Promise<void> {
  return deleteImageFromStorage(fileUrl);
}



