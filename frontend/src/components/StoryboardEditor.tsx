/**
 * Component for editing storyboard shots (durations and prompts).
 */

import { useState, useEffect } from "react";
import type { Storyboard, StoryboardShot } from "../types/storyboard";

interface StoryboardEditorProps {
  storyboard: Storyboard;
  onUpdate: (storyboard: Storyboard) => void;
  disabled?: boolean;
}

export function StoryboardEditor({
  storyboard,
  onUpdate,
  disabled = false,
}: StoryboardEditorProps) {
  const [localStoryboard, setLocalStoryboard] = useState<Storyboard>(storyboard);

  // Sync local state when storyboard prop changes
  useEffect(() => {
    setLocalStoryboard(storyboard);
  }, [storyboard]);

  const updateShot = (index: number, updates: Partial<StoryboardShot>) => {
    const newShots = [...localStoryboard.shots];
    newShots[index] = { ...newShots[index], ...updates };
    
    const updated = {
      ...localStoryboard,
      shots: newShots,
      total_duration: newShots.reduce((sum, shot) => sum + shot.duration_seconds, 0),
    };
    
    setLocalStoryboard(updated);
    onUpdate(updated);
  };

  return (
    <div className="storyboard-editor">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Storyboard Editor</h2>
        <p className="text-sm text-gray-600">
          Total Duration: {localStoryboard.total_duration.toFixed(1)}s
        </p>
      </div>

      <div className="space-y-4">
        {localStoryboard.shots.map((shot, index) => (
          <div
            key={shot.line_index}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div className="mb-2">
              <span className="text-sm font-medium text-gray-500">
                Shot {shot.line_index}
              </span>
            </div>

            <div className="mb-3">
              <p className="text-lg font-medium text-gray-800 mb-1">
                {shot.lyric_line}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`duration-${index}`}
                  className="block text-sm font-medium mb-1"
                >
                  Duration (seconds)
                </label>
                <input
                  id={`duration-${index}`}
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={shot.duration_seconds}
                  onChange={(e) =>
                    updateShot(index, {
                      duration_seconds: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="mt-3">
              <label
                htmlFor={`prompt-${index}`}
                className="block text-sm font-medium mb-1"
              >
                Video Prompt
              </label>
              <textarea
                id={`prompt-${index}`}
                value={shot.base_video_prompt}
                onChange={(e) =>
                  updateShot(index, { base_video_prompt: e.target.value })
                }
                disabled={disabled}
                className="w-full p-2 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}




