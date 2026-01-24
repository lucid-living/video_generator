/**
 * Utility functions for constructing final video prompts.
 */

import type { Storyboard, StoryboardShot, FinalVideoPrompt } from "../types/storyboard";

/**
 * Construct final video prompt by concatenating style guide and base prompt.
 *
 * Args:
 *   styleGuide: Visual style guide text
 *   basePrompt: Base video prompt from storyboard shot
 *
 * Returns:
 *   Final video prompt string
 */
export function constructFinalPrompt(
  styleGuide: string,
  basePrompt: string
): string {
  return `${styleGuide}. ${basePrompt}`;
}

/**
 * Generate final video prompts for all shots in a storyboard.
 *
 * Args:
 *   storyboard: The storyboard containing shots
 *   referenceImageIds: Optional mapping of shot indices to reference image IDs
 *
 * Returns:
 *   Array of final video prompts ready for video generation
 */
export function generateFinalPrompts(
  storyboard: Storyboard,
  referenceImageIds?: Map<number, string[]>
): FinalVideoPrompt[] {
  return storyboard.shots.map((shot: StoryboardShot) => {
    const finalPrompt = constructFinalPrompt(
      storyboard.style_guide,
      shot.base_video_prompt
    );

    const imageIds = referenceImageIds?.get(shot.line_index) || [];

    return {
      shot_index: shot.line_index,
      final_prompt: finalPrompt,
      duration_seconds: shot.duration_seconds,
      reference_image_ids: imageIds,
    };
  });
}

/**
 * Reconstruct full lyrics from storyboard shots.
 *
 * Args:
 *   storyboard: The storyboard containing lyric lines
 *
 * Returns:
 *   Complete lyrics text
 */
export function reconstructLyrics(storyboard: Storyboard): string {
  return storyboard.shots
    .map((shot) => shot.lyric_line)
    .join("\n");
}




