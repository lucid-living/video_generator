/**
 * Component for previewing generated video assets.
 */

import type { WorkflowState } from "../types/storyboard";

interface VideoPreviewProps {
  workflow: WorkflowState;
}

export function VideoPreview({ workflow }: VideoPreviewProps) {
  return (
    <div className="video-preview">
      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>

      {workflow.audio_asset && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Audio Track</h3>
          <audio controls src={workflow.audio_asset.file_url} className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {workflow.reference_images.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Reference Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {workflow.reference_images.map((img) => (
              <div key={img.image_id} className="border rounded-lg overflow-hidden">
                <img
                  src={img.storage_url || img.base64_data || ""}
                  alt={img.description}
                  className="w-full h-auto"
                />
                <p className="p-2 text-sm text-gray-600">{img.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {workflow.video_clips.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Video Clips</h3>
          <div className="space-y-4">
            {workflow.video_clips.map((clip) => (
              <div key={clip.shot_index} className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Shot {clip.shot_index} ({clip.duration_seconds}s)
                </p>
                <video controls src={clip.clip_url} className="w-full">
                  Your browser does not support the video element.
                </video>
              </div>
            ))}
          </div>
        </div>
      )}

      {workflow.final_video_url && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Final Video</h3>
          <video controls src={workflow.final_video_url} className="w-full">
            Your browser does not support the video element.
          </video>
        </div>
      )}

      {!workflow.audio_asset &&
        workflow.reference_images.length === 0 &&
        workflow.video_clips.length === 0 &&
        !workflow.final_video_url && (
          <p className="text-gray-500">No preview available yet.</p>
        )}
    </div>
  );
}




