/**
 * TypeScript types for storyboard data structures.
 */

export interface StoryboardShot {
  line_index: number;
  lyric_line: string;
  duration_seconds: number;
  base_video_prompt: string;
}

export interface Storyboard {
  shots: StoryboardShot[];
  theme: string;
  style_guide: string;
  total_duration: number;
}

export interface StoryboardGenerationRequest {
  theme: string;
  style_guide: string;
  num_shots?: number;
  max_duration?: number;
}

export interface ReferenceImage {
  image_id: string;
  base64_data: string;
  description: string;
  shot_indices: number[];
  approved?: boolean; // Whether user has approved this image
  storage_url?: string; // URL if saved to Supabase storage
  saved_to_style_guide?: boolean; // Whether saved to style guide
}

export interface AudioAsset {
  audio_id: string;
  file_url: string;
  duration_seconds: number;
  lyrics: string;
}

export interface VideoClip {
  shot_index: number;
  clip_url: string;
  duration_seconds: number;
  final_prompt: string;
}

export interface WorkflowState {
  workflow_id: string;
  storyboard: Storyboard;
  audio_asset?: AudioAsset;
  reference_images: ReferenceImage[];
  video_clips: VideoClip[];
  final_video_url?: string;
  status: "planning" | "assets" | "generation" | "complete";
}

export interface FinalVideoPrompt {
  shot_index: number;
  final_prompt: string;
  duration_seconds: number;
  reference_image_ids: string[];
}




