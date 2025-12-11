/**
 * Component for generating reference images from storyboard prompts.
 */

import { useState, useEffect, useRef } from "react";
import { generateReferenceImage } from "../services/api";
import { saveWorkflow } from "../services/supabase";
import { uploadReferenceImage } from "../services/imageStorage";
import type { Storyboard, ReferenceImage, WorkflowState } from "../types/storyboard";

interface ReferenceImageGeneratorProps {
  storyboard: Storyboard;
  workflow: WorkflowState;
  onImagesGenerated: (images: ReferenceImage[]) => void;
  styleGuideImages?: string[]; // Reference images from style guide (base64 or URLs)
  onSaveToStyleGuide?: (image: ReferenceImage) => void; // Callback when image is saved to style guide
}

export function ReferenceImageGenerator({
  storyboard,
  workflow,
  onImagesGenerated,
  styleGuideImages = [],
  onSaveToStyleGuide,
}: ReferenceImageGeneratorProps) {
  const [generating, setGenerating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ReferenceImage[]>(
    workflow.reference_images || []
  );
  const [expandedImage, setExpandedImage] = useState<ReferenceImage | null>(null);
  const [savingToStyleGuide, setSavingToStyleGuide] = useState<string | null>(null);
  const generatingRef = useRef<Set<number>>(new Set()); // Track which shots are currently generating
  const generateAllInProgressRef = useRef<boolean>(false); // Track if "Generate All" is in progress
  const [useImageReference, setUseImageReference] = useState<Map<number, string>>(new Map()); // Track which shot uses which previous image as reference

  // Sync generatedImages with workflow when workflow_id changes (e.g., when loading a different project)
  useEffect(() => {
    if (workflow.reference_images) {
      setGeneratedImages(workflow.reference_images);
    }
  }, [workflow.workflow_id]);

  const handleGenerateImage = async (shotIndex: number) => {
    // Prevent duplicate generation - check ref BEFORE any state changes
    if (generatingRef.current.has(shotIndex)) {
      console.log(`Already generating image for shot ${shotIndex}, ignoring duplicate call`);
      return;
    }

    const shot = storyboard.shots.find((s) => s.line_index === shotIndex);
    if (!shot) {
      setError("Shot not found");
      return;
    }

    generatingRef.current.add(shotIndex);
    setGenerating(shotIndex);
    setError(null);

    try {
      // Use the base_video_prompt as the description, combined with style guide
      const description = shot.base_video_prompt;
      
      // Get previous images for consistency (only images from earlier shots)
      // Include the full description and base64 data for better character consistency
      const previousImages = generatedImages
        .filter(img => img.shot_indices[0] < shotIndex)
        .map(img => ({
          description: img.description, // Full description from the storyboard prompt
          shot_indices: img.shot_indices,
          base64_data: img.base64_data,
        }));
      
      // Check if user wants to use a previous image as direct reference
      const referenceImageId = useImageReference.get(shotIndex);
      const referenceImage = referenceImageId 
        ? generatedImages.find(img => img.image_id === referenceImageId)
        : null;
      
      const image = await generateReferenceImage(
        storyboard.style_guide,
        description,
        [shotIndex],
        previousImages,
        styleGuideImages,
        !!referenceImage, // use_image_reference
        referenceImage?.base64_data || "" // reference_image_base64
      );

      // Initialize with approved: false
      const newImage = { ...image, approved: false };
      // Remove any existing images for this shot before adding the new one
      const filteredImages = generatedImages.filter(
        (img) => !img.shot_indices.includes(shotIndex)
      );
      const updatedImages = [...filteredImages, newImage];
      setGeneratedImages(updatedImages);

      // Update workflow with new images
      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: updatedImages,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };

      await saveWorkflow(updatedWorkflow);
      onImagesGenerated(updatedImages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      generatingRef.current.delete(shotIndex);
      setGenerating(null);
    }
  };

  const handleGenerateAll = async () => {
    // Prevent duplicate calls (e.g., from React.StrictMode double-invocation or double-click)
    if (generateAllInProgressRef.current) {
      console.log("Generate All already in progress, ignoring duplicate call");
      return;
    }

    generateAllInProgressRef.current = true;
    setError(null);
    let newImages: ReferenceImage[] = [...generatedImages];
    
    // Generate images for all shots sequentially
    for (const shot of storyboard.shots) {
      // Skip if image already exists for this shot
      const existingImage = newImages.find((img) =>
        img.shot_indices.includes(shot.line_index)
      );
      
      if (existingImage) {
        continue;
      }

      // Prevent duplicate generation - check ref BEFORE setting state
      if (generatingRef.current.has(shot.line_index)) {
        console.log(`Already generating image for shot ${shot.line_index}`);
        continue;
      }

      // Add to ref FIRST, then set state
      generatingRef.current.add(shot.line_index);
      setGenerating(shot.line_index);
      
      try {
        // Get previous images for consistency (only images from earlier shots)
        // Include the full description and base64 data for better character consistency
        const previousImages = newImages
          .filter(img => img.shot_indices[0] < shot.line_index)
          .map(img => ({
            description: img.description, // Full description from the storyboard prompt
            shot_indices: img.shot_indices,
            base64_data: img.base64_data,
          }));
        
        const image = await generateReferenceImage(
          storyboard.style_guide,
          shot.base_video_prompt,
          [shot.line_index],
          previousImages,
          styleGuideImages
        );

        // Initialize with approved: false
        const newImage = { ...image, approved: false };
        newImages = [...newImages, newImage];
        setGeneratedImages(newImages);
      } catch (err) {
        console.error(`Failed to generate image for shot ${shot.line_index}:`, err);
        // Continue with next shot even if one fails
      } finally {
        generatingRef.current.delete(shot.line_index);
      }
    }

    // Clear generating state after all shots are done
    setGenerating(null);
    generateAllInProgressRef.current = false;

    // Save all images to workflow
    try {
      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: newImages,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };
      await saveWorkflow(updatedWorkflow);
      onImagesGenerated(newImages);
    } catch (err) {
      setError("Failed to save images to workflow");
      generateAllInProgressRef.current = false; // Reset on error too
    }
  };

  const getImageForShot = (shotIndex: number): ReferenceImage | undefined => {
    return generatedImages.find((img) => img.shot_indices.includes(shotIndex));
  };

  const handleApproveImage = async (imageId: string) => {
    const updatedImages = generatedImages.map((img) =>
      img.image_id === imageId ? { ...img, approved: true } : img
    );
    setGeneratedImages(updatedImages);

    const updatedWorkflow: WorkflowState = {
      ...workflow,
      reference_images: updatedImages,
    };
    await saveWorkflow(updatedWorkflow);
    onImagesGenerated(updatedImages);
  };

  const handleRejectImage = async (shotIndex: number) => {
    // Remove the rejected image (don't regenerate automatically)
    const updatedImages = generatedImages.filter(
      (img) => !img.shot_indices.includes(shotIndex)
    );
    setGeneratedImages(updatedImages);

    // Clear any reference image selection for this shot
    const newMap = new Map(useImageReference);
    newMap.delete(shotIndex);
    setUseImageReference(newMap);

    const updatedWorkflow: WorkflowState = {
      ...workflow,
      reference_images: updatedImages,
    };
    await saveWorkflow(updatedWorkflow);
    onImagesGenerated(updatedImages);
  };

  const handleRegenerateImage = async (shotIndex: number) => {
    // Remove the existing image
    const updatedImages = generatedImages.filter(
      (img) => !img.shot_indices.includes(shotIndex)
    );
    setGeneratedImages(updatedImages);

    const updatedWorkflow: WorkflowState = {
      ...workflow,
      reference_images: updatedImages,
    };
    await saveWorkflow(updatedWorkflow);
    onImagesGenerated(updatedImages);

    // Generate new image
    await handleGenerateImage(shotIndex);
  };

  const handleSaveToStyleGuide = async (image: ReferenceImage) => {
    setSavingToStyleGuide(image.image_id);
    try {
      // Upload image to Supabase storage
      const storageUrl = await uploadReferenceImage(
        image.base64_data,
        image.image_id,
        image.description
      );

      // Update image with storage URL and saved flag
      const updatedImages = generatedImages.map((img) =>
        img.image_id === image.image_id
          ? { ...img, storage_url: storageUrl, saved_to_style_guide: true }
          : img
      );
      setGeneratedImages(updatedImages);

      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: updatedImages,
      };
      await saveWorkflow(updatedWorkflow);
      onImagesGenerated(updatedImages);

      // Trigger callback to add to style guide (if parent component supports it)
      if (onSaveToStyleGuide) {
        onSaveToStyleGuide(updatedImages.find(img => img.image_id === image.image_id)!);
      }
      
      alert(
        `Image saved to style guide! Storage URL: ${storageUrl}\n\n` +
        `You can now use this image as a reference for future generations.`
      );
    } catch (err) {
      console.error("Failed to save image to style guide:", err);
      alert(
        `Failed to save image to style guide: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSavingToStyleGuide(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium mb-1">Reference Images</h3>
          <p className="text-sm text-gray-600">
            Generate preview images for each shot to visualize the video style
          </p>
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={generating !== null || storyboard.shots.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
        >
          {generating !== null ? "Generating..." : "Generate All Images"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {storyboard.shots.map((shot) => {
          const image = getImageForShot(shot.line_index);
          const isGenerating = generating === shot.line_index;

          return (
            <div
              key={shot.line_index}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    Shot {shot.line_index}
                  </span>
                  {image && (
                    <span className="text-xs text-green-600">✓ Generated</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {shot.lyric_line}
                </p>
              </div>

              {image ? (
                <div className="space-y-2">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setExpandedImage(image)}
                  >
                    <img
                      src={image.base64_data}
                      alt={image.description}
                      className={`w-full h-32 object-cover rounded-md border-2 transition-all ${
                        image.approved
                          ? "border-green-500"
                          : image.approved === false
                          ? "border-yellow-400"
                          : "border-gray-200"
                      } group-hover:opacity-90`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md">
                      <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Click to view full size
                      </span>
                    </div>
                    {image.approved && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {image.description}
                  </p>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {image.approved ? (
                      <>
                        <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded">
                          ✓ Approved
                        </span>
                        {!image.saved_to_style_guide && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveToStyleGuide(image);
                            }}
                            disabled={savingToStyleGuide === image.image_id}
                            className="flex-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {savingToStyleGuide === image.image_id ? "Saving..." : "💾 Save to Style Guide"}
                          </button>
                        )}
                        {image.saved_to_style_guide && (
                          <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded">
                            💾 Saved
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateImage(shot.line_index);
                          }}
                          disabled={generating !== null}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          🔄 Regenerate
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveImage(image.image_id);
                          }}
                          className="flex-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectImage(shot.line_index);
                          }}
                          disabled={generating !== null}
                          className="flex-1 text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full h-32 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center">
                    {isGenerating ? (
                      <div className="text-sm text-gray-500">Generating...</div>
                    ) : (
                      <div className="text-sm text-gray-400">No image</div>
                    )}
                  </div>
                  
                  {/* Reference Image Selection */}
                  {generatedImages.filter(img => img.shot_indices[0] < shot.line_index).length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 block">
                        Use previous image as reference:
                      </label>
                      <select
                        value={useImageReference.get(shot.line_index) || ""}
                        onChange={(e) => {
                          const newMap = new Map(useImageReference);
                          if (e.target.value) {
                            newMap.set(shot.line_index, e.target.value);
                          } else {
                            newMap.delete(shot.line_index);
                          }
                          setUseImageReference(newMap);
                        }}
                        disabled={isGenerating || generating !== null}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">No reference (text prompt only)</option>
                        {generatedImages
                          .filter(img => img.shot_indices[0] < shot.line_index)
                          .map((prevImg) => (
                            <option key={prevImg.image_id} value={prevImg.image_id}>
                              Shot {prevImg.shot_indices[0]} - {prevImg.description.substring(0, 40)}...
                            </option>
                          ))}
                      </select>
                      {useImageReference.get(shot.line_index) && (
                        <p className="text-xs text-blue-600">
                          ✨ Using Nano Banana Pro (KIE_AI_API_KEY) for better character consistency
                        </p>
                      )}
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleGenerateImage(shot.line_index)}
                    disabled={isGenerating || generating !== null}
                    className="w-full px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {isGenerating ? "Generating..." : "Generate Image"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {generatedImages.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          ✓ Generated {generatedImages.length} reference image(s). These will be used as style references for video generation.
        </div>
      )}

      {/* Image Modal/Expanded View */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition-all"
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={expandedImage.base64_data}
              alt={expandedImage.description}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700 font-medium">
                  Shot {expandedImage.shot_indices.join(", ")}
                </p>
                {expandedImage.approved && (
                  <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded">
                    ✓ Approved
                  </span>
                )}
                {expandedImage.saved_to_style_guide && (
                  <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded">
                    💾 Saved to Style Guide
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{expandedImage.description}</p>
              
              {/* Action Buttons in Modal */}
              <div className="flex gap-2">
                {expandedImage.approved ? (
                  <>
                    {!expandedImage.saved_to_style_guide && (
                      <button
                        onClick={() => {
                          handleSaveToStyleGuide(expandedImage);
                        }}
                        disabled={savingToStyleGuide === expandedImage.image_id}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {savingToStyleGuide === expandedImage.image_id ? "Saving..." : "💾 Save to Style Guide"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const shotIndex = expandedImage.shot_indices[0];
                        handleRegenerateImage(shotIndex);
                        setExpandedImage(null);
                      }}
                      disabled={generating !== null}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      🔄 Regenerate
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        handleApproveImage(expandedImage.image_id);
                        setExpandedImage(null);
                      }}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => {
                        const shotIndex = expandedImage.shot_indices[0];
                        handleRejectImage(shotIndex);
                        setExpandedImage(null);
                      }}
                      disabled={generating !== null}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

