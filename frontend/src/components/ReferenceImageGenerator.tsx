/**
 * Component for generating reference images from storyboard prompts.
 */

import { useState, useEffect, useRef } from "react";
import { generateReferenceImage, submitImageFeedback } from "../services/api";
import { saveWorkflow } from "../services/supabase";
import { uploadReferenceImage } from "../services/imageStorage";
import { ReferenceImageLibrary } from "./ReferenceImageLibrary";
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
  const [useImageReference, setUseImageReference] = useState<Map<number, string>>(new Map()); // Track which shot uses which previous image as reference (deprecated, use useImageReferences)
  const [useImageReferences, setUseImageReferences] = useState<Map<number, string[]>>(new Map()); // Track which shot uses which previous images as references (up to 14)
  const [userReferenceImages, setUserReferenceImages] = useState<string[]>([]); // User-uploaded/favorited reference images

  // Sync generatedImages with workflow when workflow_id changes (e.g., when loading a different project)
  useEffect(() => {
    if (workflow.reference_images && workflow.reference_images.length > 0) {
      console.log(`Loading ${workflow.reference_images.length} images from workflow ${workflow.workflow_id}`);
      
      // Use images directly - browsers can display storage_urls natively without base64 conversion
      // This saves egress bandwidth by not downloading and converting images unnecessarily
      const images = workflow.reference_images.map((img) => {
        // Validate that image has either storage_url or base64_data for display
        if (!img.storage_url && (!img.base64_data || img.base64_data.length < 100)) {
          console.warn(
            `Image ${img.image_id} has no storage_url and no base64_data - may not display correctly. ` +
            `Please regenerate this image.`
          );
          setError(
            `Warning: Some images cannot be displayed (missing data). ` +
            `Please regenerate images for shots: ${img.shot_indices.join(", ")}`
          );
        }
        return img;
      });
      
      // Sort images to prioritize approved ones and ensure consistent ordering
      // Approved images first, then by image_id for consistency
      const sortedImages = images.sort((a, b) => {
        // Approved images come first
        if (a.approved && !b.approved) return -1;
        if (!a.approved && b.approved) return 1;
        // Then sort by image_id for consistency
        return a.image_id.localeCompare(b.image_id);
      });
      
      console.log(`Loaded ${sortedImages.length} images (using storage URLs directly to save bandwidth)`);
      setGeneratedImages(sortedImages);
    } else {
      console.log("No reference images in workflow, clearing state");
      setGeneratedImages([]);
    }
  }, [workflow.workflow_id, workflow.reference_images]);

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
      
      // Check if user wants to use previous images as direct references
      const referenceImageIds = useImageReferences.get(shotIndex) || [];
      // Also check old single image reference for backward compatibility
      const oldReferenceImageId = useImageReference.get(shotIndex);
      const allReferenceImageIds = oldReferenceImageId && !referenceImageIds.includes(oldReferenceImageId)
        ? [...referenceImageIds, oldReferenceImageId]
        : referenceImageIds;
      
      // Get reference images - use storage_url directly (no base64 conversion needed!)
      // Kie.ai API accepts URLs directly, so we avoid egress by NOT downloading/converting images
      const referenceImagesFromGenerated = allReferenceImageIds
        .map(id => generatedImages.find(img => img.image_id === id))
        .filter((img): img is ReferenceImage => img !== undefined)
        .map((img) => {
          // Prefer storage_url - Kie.ai API accepts URLs directly (saves egress!)
          if (img.storage_url) {
            return img.storage_url;
          }
          // If we have base64_data (newly generated, not yet uploaded), we need to upload it first
          // But for now, skip it - user should save image first to get storage_url
          if (img.base64_data && img.base64_data.length > 100) {
            console.warn(`Image ${img.image_id} has base64_data but no storage_url. Upload it to storage first to use as reference.`);
            // TODO: Could auto-upload here, but that would cause egress. Better to require explicit upload.
            return null;
          }
          // No data available - return null to filter out
          console.warn(`Image ${img.image_id} has no base64_data and no storage_url - cannot use as reference`);
          return null;
        });
      
      // Filter out null/empty values and combine user-uploaded/favorited reference images
      // User images come first (they're the most important), then generated images
      // Limit to 14 total (Gemini API limit)
      const validReferenceImages = referenceImagesFromGenerated.filter(
        (img): img is string => img !== null && img !== "" && img.length > 0
      );
      
      const allReferenceImages = [
        ...userReferenceImages,
        ...validReferenceImages
      ].slice(0, 14);
      
      console.log(`Using ${allReferenceImages.length} reference image(s) for generation (${validReferenceImages.length} from generated, ${userReferenceImages.length} from user)`);
      console.log(`✅ Using storage URLs directly - no base64 conversion needed (saves egress!)`);
      
      const image = await generateReferenceImage(
        storyboard.style_guide,
        description,
        [shotIndex],
        previousImages,
        styleGuideImages,
        allReferenceImages.length > 0, // use_image_reference
        "", // reference_image_base64 (deprecated, use reference_images_base64)
        allReferenceImages // reference_images_base64
      );

      // Initialize with approved: false
      const newImage = { ...image, approved: false };
      
      // Automatically upload to Supabase Storage to avoid database size limits
      // Store URL instead of base64_data in database
      let imageWithStorage: ReferenceImage = newImage;
      try {
        console.log(`Uploading image ${newImage.image_id} to Supabase Storage...`);
        const storageUrl = await uploadReferenceImage(
          newImage.base64_data,
          newImage.image_id,
          newImage.description,
          workflow.workflow_id
        );
        console.log(`Image uploaded successfully: ${storageUrl}`);
        imageWithStorage = {
          ...newImage,
          storage_url: storageUrl,
          // Keep base64_data in memory for immediate display, but don't save to DB
        };
      } catch (uploadError) {
        console.error(`Failed to upload image ${newImage.image_id} to storage:`, uploadError);
        setError(`Warning: Failed to upload image to storage. Image will be saved with base64 data (may cause slow saves). Error: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`);
        // Continue with base64_data if upload fails (fallback)
        // This ensures images can still be displayed even if storage upload fails
      }
      
      // Remove any existing images for this shot before adding the new one
      const filteredImages = generatedImages.filter(
        (img) => !img.shot_indices.includes(shotIndex)
      );
      
      // Create image for database (without base64_data if we have storage_url)
      // CRITICAL: Never save images without at least one of storage_url or base64_data
      const imageForDatabase: ReferenceImage = imageWithStorage.storage_url
        ? {
            ...imageWithStorage,
            base64_data: "", // Don't store base64 in DB if we have storage_url
          }
        : imageWithStorage.base64_data && imageWithStorage.base64_data.length > 100
        ? imageWithStorage // Keep base64_data if no storage_url (but base64 exists)
        : (() => {
            // This should never happen, but if it does, throw an error
            console.error(`CRITICAL: Cannot save image ${imageWithStorage.image_id} - no storage_url and no base64_data`);
            throw new Error(`Cannot save image ${imageWithStorage.image_id} - missing both storage_url and base64_data`);
          })();
      
      const updatedImages = [...filteredImages, imageForDatabase];
      // For display, use storage_url directly - don't keep base64_data in memory to save space
      // Browser can display storage_url directly without base64 conversion
      const updatedImagesForDisplay = [...filteredImages, imageWithStorage.storage_url 
        ? { ...imageWithStorage, base64_data: "" } // Clear base64_data if we have storage_url
        : imageWithStorage]; // Keep base64_data only if no storage_url (newly generated, not yet uploaded)
      setGeneratedImages(updatedImagesForDisplay);

      // Update workflow with new images (database version without large base64)
      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: updatedImages,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };

      try {
        await saveWorkflow(updatedWorkflow);
        console.log(`Workflow saved successfully with ${updatedImages.length} images`);
      } catch (saveError) {
        console.error("Failed to save workflow:", saveError);
        throw new Error(`Failed to save workflow: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
      }
      
      onImagesGenerated(updatedImagesForDisplay);
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
    let newImagesForDatabase: ReferenceImage[] = [...generatedImages.map(img => 
      // Convert display images (with base64) to database format (without base64 if storage_url exists)
      img.storage_url && img.base64_data ? { ...img, base64_data: "" } : img
    )];
    let newImagesForDisplay: ReferenceImage[] = [...generatedImages];
    
    // Generate images for all shots sequentially
    for (const shot of storyboard.shots) {
      // Skip if image already exists for this shot
      const existingImage = newImagesForDisplay.find((img) =>
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
        // Use display images which have base64_data for API calls
        const previousImages = newImagesForDisplay
          .filter(img => img.shot_indices[0] < shot.line_index)
          .map(img => ({
            description: img.description,
            shot_indices: img.shot_indices,
            base64_data: img.base64_data || img.storage_url || "",
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
        
        // Automatically upload to Supabase Storage to avoid database size limits
        let imageWithStorage: ReferenceImage = newImage;
        try {
          console.log(`Uploading image ${newImage.image_id} to Supabase Storage...`);
          const storageUrl = await uploadReferenceImage(
            newImage.base64_data,
            newImage.image_id,
            newImage.description,
            workflow.workflow_id
          );
          console.log(`Image uploaded successfully: ${storageUrl}`);
          imageWithStorage = {
            ...newImage,
            storage_url: storageUrl,
          };
        } catch (uploadError) {
          console.error(`Failed to upload image ${newImage.image_id} to storage:`, uploadError);
          setError(`Warning: Failed to upload image to storage. Image will be saved with base64 data (may cause slow saves). Error: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`);
          // Continue with base64_data if upload fails (fallback)
        }
        
        // Create image for database (without base64_data if we have storage_url)
        // CRITICAL: Never save images without at least one of storage_url or base64_data
        const imageForDatabase: ReferenceImage = imageWithStorage.storage_url
          ? {
              ...imageWithStorage,
              base64_data: "", // Don't store base64 in DB if we have storage_url
            }
          : imageWithStorage.base64_data && imageWithStorage.base64_data.length > 100
          ? imageWithStorage // Keep base64_data if no storage_url (but base64 exists)
          : (() => {
              // This should never happen, but if it does, log error and skip this image
              console.error(`CRITICAL: Cannot save image ${imageWithStorage.image_id} - no storage_url and no base64_data`);
              return imageWithStorage; // Return as-is, saveWorkflow will filter it out
            })();
        
        // Remove any existing image for this shot
        newImagesForDatabase = newImagesForDatabase.filter(
          (img) => !img.shot_indices.includes(shot.line_index)
        );
        newImagesForDisplay = newImagesForDisplay.filter(
          (img) => !img.shot_indices.includes(shot.line_index)
        );
        
        // Add new images
        newImagesForDatabase = [...newImagesForDatabase, imageForDatabase];
        // For display, use storage_url directly - don't keep base64_data in memory to save space
        newImagesForDisplay = [...newImagesForDisplay, imageWithStorage.storage_url 
          ? { ...imageWithStorage, base64_data: "" } // Clear base64_data if we have storage_url
          : imageWithStorage]; // Keep base64_data only if no storage_url (newly generated, not yet uploaded)
        
        setGeneratedImages(newImagesForDisplay);
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

    // Save all images to workflow (database version without base64)
    try {
      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: newImagesForDatabase,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };
      await saveWorkflow(updatedWorkflow);
      console.log(`Workflow saved successfully with ${newImagesForDatabase.length} images`);
      onImagesGenerated(newImagesForDisplay);
    } catch (err) {
      console.error("Failed to save workflow:", err);
      setError(`Failed to save images to workflow: ${err instanceof Error ? err.message : "Unknown error"}`);
      generateAllInProgressRef.current = false; // Reset on error too
    }
  };

  const getImageForShot = (shotIndex: number): ReferenceImage | undefined => {
    // Find all images for this shot
    const imagesForShot = generatedImages.filter((img) => img.shot_indices.includes(shotIndex));
    
    if (imagesForShot.length === 0) {
      return undefined;
    }
    
    // Prioritize approved images - if any approved image exists, return the first approved one
    const approvedImage = imagesForShot.find((img) => img.approved === true);
    if (approvedImage) {
      return approvedImage;
    }
    
    // Otherwise, return the most recent image (last in array, as they're added sequentially)
    return imagesForShot[imagesForShot.length - 1];
  };

  const handleApproveImage = async (imageId: string) => {
    try {
      // Mark the selected image as approved
      // Also unapprove any other images for the same shots to ensure only one approved image per shot
      const imageToApprove = generatedImages.find((img) => img.image_id === imageId);
      if (!imageToApprove) {
        setError("Image not found");
        return;
      }

      const updatedImages = generatedImages.map((img) => {
        // Approve the selected image
        if (img.image_id === imageId) {
          return { ...img, approved: true };
        }
        // Unapprove any other images that share the same shot indices
        if (img.shot_indices.some((idx) => imageToApprove.shot_indices.includes(idx))) {
          return { ...img, approved: false };
        }
        return img;
      });
      
      setGeneratedImages(updatedImages);

      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: updatedImages,
      };
      
      await saveWorkflow(updatedWorkflow);
      onImagesGenerated(updatedImages);
      
      // Submit feedback for learning (non-blocking)
      try {
        await submitImageFeedback(
          imageToApprove.image_id,
          workflow.workflow_id,
          true, // approved
          imageToApprove.favorited || false,
          imageToApprove.description,
          imageToApprove.rating,
          storyboard.style_guide,
          undefined, // prompt_used
          imageToApprove.shot_indices,
          undefined, // channel_name
          undefined // content_type
        );
      } catch (feedbackError) {
        console.warn("Failed to submit feedback (non-critical):", feedbackError);
      }
      
      // Clear any previous errors on success
      setError(null);
    } catch (error) {
      console.error("Failed to approve image:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to approve image: ${errorMessage}`);
      // Don't throw - let the user see the error and try again
    }
  };

  const handleFavoriteImage = async (imageId: string, favorited: boolean) => {
    try {
      const imageToFavorite = generatedImages.find((img) => img.image_id === imageId);
      if (!imageToFavorite) {
        setError("Image not found");
        return;
      }

      const updatedImages = generatedImages.map((img) => {
        if (img.image_id === imageId) {
          return { ...img, favorited };
        }
        return img;
      });
      
      setGeneratedImages(updatedImages);

      const updatedWorkflow: WorkflowState = {
        ...workflow,
        reference_images: updatedImages,
      };
      
      await saveWorkflow(updatedWorkflow);
      onImagesGenerated(updatedImages);
      
      // Submit feedback for learning (non-blocking)
      try {
        await submitImageFeedback(
          imageToFavorite.image_id,
          workflow.workflow_id,
          imageToFavorite.approved || false,
          favorited,
          imageToFavorite.description,
          imageToFavorite.rating,
          storyboard.style_guide,
          undefined,
          imageToFavorite.shot_indices,
          undefined,
          undefined
        );
      } catch (feedbackError) {
        console.warn("Failed to submit feedback (non-critical):", feedbackError);
      }
      
      setError(null);
    } catch (error) {
      console.error("Failed to favorite image:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to favorite image: ${errorMessage}`);
    }
  };

  const handleRejectImage = async (shotIndex: number) => {
    // Remove the rejected image (don't regenerate automatically)
    const updatedImages = generatedImages.filter(
      (img) => !img.shot_indices.includes(shotIndex)
    );
    setGeneratedImages(updatedImages);

    // Clear any reference image selections for this shot
    const newMap = new Map(useImageReference);
    newMap.delete(shotIndex);
    setUseImageReference(newMap);
    
    const newReferencesMap = new Map(useImageReferences);
    newReferencesMap.delete(shotIndex);
    setUseImageReferences(newReferencesMap);

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
      // Upload image to Supabase Storage
      const storageUrl = await uploadReferenceImage(
        image.base64_data,
        image.image_id,
        image.description,
        workflow.workflow_id
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
      {/* Reference Image Library - Upload/Select Your Own Images */}
      <ReferenceImageLibrary
        onSelectImages={(images) => {
          setUserReferenceImages(images);
        }}
        selectedImages={userReferenceImages}
        maxSelections={14}
        showStyleExtraction={true}
        onStyleExtracted={() => {
          // Could update the storyboard style guide or show a notification
          alert("Style extracted! Consider updating your style guide with this information.");
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium mb-1">Reference Images</h3>
          <p className="text-sm text-gray-600">
            Generate preview images for each shot to visualize the video style
            {userReferenceImages.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({userReferenceImages.length} reference image{userReferenceImages.length !== 1 ? 's' : ''} selected)
              </span>
            )}
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
                      src={image.storage_url || image.base64_data || ""}
                      alt={image.description}
                      className={`w-full h-32 object-cover rounded-md border-2 transition-all ${
                        image.approved
                          ? "border-green-500"
                          : image.approved === false
                          ? "border-yellow-400"
                          : "border-gray-200"
                      } group-hover:opacity-90`}
                      onError={async (e) => {
                        const target = e.target as HTMLImageElement;
                        const originalSrc = target.src;
                        
                        console.error(`Failed to load image ${image.image_id}:`, {
                          has_base64: !!image.base64_data && image.base64_data.length > 100,
                          has_storage_url: !!image.storage_url,
                          storage_url: image.storage_url,
                          attempted_src: originalSrc,
                        });
                        
                        // If storage_url failed, try to reload from storage with a fresh fetch
                        if (image.storage_url && originalSrc === image.storage_url) {
                          console.log(`Attempting to reload image ${image.image_id} from storage...`);
                          try {
                            // Try fetching with cache busting
                            const response = await fetch(`${image.storage_url}?t=${Date.now()}`, {
                              method: 'GET',
                              mode: 'cors',
                              cache: 'no-cache',
                            });
                            
                            if (response.ok) {
                              const blob = await response.blob();
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const base64 = reader.result as string;
                                console.log(`Successfully reloaded image ${image.image_id} from storage`);
                                target.src = base64;
                                // Update the image in state with the loaded base64
                                const updatedImages = generatedImages.map((img) =>
                                  img.image_id === image.image_id
                                    ? { ...img, base64_data: base64 }
                                    : img
                                );
                                setGeneratedImages(updatedImages);
                              };
                              reader.onerror = () => {
                                console.error(`Failed to convert blob to base64 for image ${image.image_id}`);
                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='sans-serif' font-size='12'%3EFailed to load%3C/text%3E%3C/svg%3E";
                              };
                              reader.readAsDataURL(blob);
                              return; // Don't show error placeholder yet
                            } else {
                              console.error(`Storage fetch failed with status ${response.status}: ${response.statusText}`);
                            }
                          } catch (fetchError) {
                            console.error(`Error fetching from storage:`, fetchError);
                          }
                        }
                        
                        // Show error placeholder if all retries failed
                        target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='sans-serif' font-size='12'%3EFailed to load%3C/text%3E%3C/svg%3E";
                      }}
                      onLoad={() => {
                        console.log(`Successfully loaded image ${image.image_id}`);
                      }}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFavoriteImage(image.image_id, !image.favorited);
                          }}
                          className={`text-xs px-2 py-1 rounded ${
                            image.favorited
                              ? "bg-yellow-500 text-white hover:bg-yellow-600"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title={image.favorited ? "Remove from favorites" : "Add to favorites"}
                        >
                          {image.favorited ? "⭐ Favorited" : "☆ Favorite"}
                        </button>
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
                  
                  {/* Reference Images Selection (Multiple - up to 14) */}
                  {generatedImages.filter(img => img.shot_indices[0] < shot.line_index).length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 block font-medium">
                        Use previous images as references (up to 14 for Gemini API):
                      </label>
                      <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                        {generatedImages
                          .filter(img => img.shot_indices[0] < shot.line_index)
                          .map((prevImg) => {
                            const selectedIds = useImageReferences.get(shot.line_index) || [];
                            const isSelected = selectedIds.includes(prevImg.image_id);
                            const isAtLimit = selectedIds.length >= 14 && !isSelected;
                            
                            return (
                              <label
                                key={prevImg.image_id}
                                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-blue-50 border border-blue-200"
                                    : isAtLimit
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newMap = new Map(useImageReferences);
                                    const currentIds = newMap.get(shot.line_index) || [];
                                    
                                    if (e.target.checked) {
                                      // Add to selection (limit to 14)
                                      if (currentIds.length < 14) {
                                        const newIds = [...currentIds, prevImg.image_id];
                                        newMap.set(shot.line_index, newIds);
                                        setUseImageReferences(newMap);
                                      }
                                    } else {
                                      // Remove from selection
                                      const newIds = currentIds.filter(id => id !== prevImg.image_id);
                                      if (newIds.length > 0) {
                                        newMap.set(shot.line_index, newIds);
                                      } else {
                                        newMap.delete(shot.line_index);
                                      }
                                      setUseImageReferences(newMap);
                                    }
                                  }}
                                  disabled={isGenerating || generating !== null || isAtLimit}
                                  className="mt-0.5 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium text-gray-900">
                                      Shot {prevImg.shot_indices[0]}
                                    </span>
                                    {isSelected && (
                                      <span className="text-xs text-blue-600">✓</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 line-clamp-1">
                                    {prevImg.description.substring(0, 50)}...
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                      {(useImageReferences.get(shot.line_index) || []).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-blue-600 font-medium">
                            ✨ Using Nano Banana Pro (KIE_AI_API_KEY) with {(useImageReferences.get(shot.line_index) || []).length} reference image(s) for better character consistency
                          </p>
                          <p className="text-xs text-gray-500">
                            Selected: {(useImageReferences.get(shot.line_index) || []).map(id => {
                              const img = generatedImages.find(i => i.image_id === id);
                              return img ? `Shot ${img.shot_indices[0]}` : '';
                            }).filter(Boolean).join(', ')}
                            {(useImageReferences.get(shot.line_index) || []).length >= 14 && (
                              <span className="text-orange-600 ml-1">(Limit reached)</span>
                            )}
                          </p>
                          {(useImageReferences.get(shot.line_index) || []).some(id => {
                            const img = generatedImages.find(i => i.image_id === id);
                            return img && !img.storage_url;
                          }) && (
                            <p className="text-xs text-amber-600">
                              ⚠ Note: Some images use base64. For best results, save images to Style Guide first to get URLs.
                            </p>
                          )}
                        </div>
                      )}
                      {(useImageReferences.get(shot.line_index) || []).length === 0 && (
                        <p className="text-xs text-gray-500 italic">
                          No references selected - will use text prompt only
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
              src={expandedImage.storage_url || expandedImage.base64_data || ""}
              onError={async (e) => {
                const target = e.target as HTMLImageElement;
                const originalSrc = target.src;
                
                console.error(`Failed to load expanded image ${expandedImage.image_id}:`, {
                  has_base64: !!expandedImage.base64_data && expandedImage.base64_data.length > 100,
                  has_storage_url: !!expandedImage.storage_url,
                  storage_url: expandedImage.storage_url,
                  attempted_src: originalSrc,
                });
                
                // Try to reload from storage
                if (expandedImage.storage_url && originalSrc === expandedImage.storage_url) {
                  try {
                    const response = await fetch(`${expandedImage.storage_url}?t=${Date.now()}`, {
                      method: 'GET',
                      mode: 'cors',
                      cache: 'no-cache',
                    });
                    
                    if (response.ok) {
                      const blob = await response.blob();
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64 = reader.result as string;
                        target.src = base64;
                        // Update the expanded image
                        setExpandedImage({ ...expandedImage, base64_data: base64 });
                      };
                      reader.readAsDataURL(blob);
                      return;
                    }
                  } catch (error) {
                    console.error(`Error reloading expanded image:`, error);
                  }
                }
                
                // Show error placeholder
                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%23f3f4f6' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='sans-serif' font-size='16'%3EImage failed to load%3C/text%3E%3C/svg%3E";
              }}
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

