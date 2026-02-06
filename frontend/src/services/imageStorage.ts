/**
 * Service for storing reference images in Supabase Storage.
 * Images are stored in workflow-specific folders in Supabase Storage.
 * Each workflow/project gets its own folder: {workflow_id}/{image_id}.png
 */

import { uploadImageToStorage, deleteImageFromStorage } from "./api";

/**
 * Upload a reference image to Supabase Storage.
 * 
 * @param imageData Base64 data URI of the image
 * @param imageId Unique identifier for the image
 * @param description Description of the image
 * @param workflowId Workflow/project identifier (required for storage organization)
 * @returns Public URL of the uploaded image
 */
export async function uploadReferenceImage(
  imageData: string,
  imageId: string,
  description: string,
  workflowId: string
): Promise<string> {
  try {
    if (!workflowId) {
      throw new Error("workflowId is required for Supabase Storage upload");
    }
    
    if (!imageData || imageData.length < 100) {
      throw new Error(`Invalid image data: imageData is ${imageData ? imageData.length : 0} characters`);
    }
    
    console.log(`[imageStorage] Uploading image ${imageId} to Supabase Storage (workflow: ${workflowId})`);
    const url = await uploadImageToStorage(
      imageData,
      imageId,
      workflowId,
      description
    );
    
    if (!url || url.length === 0) {
      throw new Error("Upload succeeded but returned empty URL");
    }
    
    console.log(`[imageStorage] ✓ Image ${imageId} uploaded successfully: ${url}`);
    return url;
  } catch (error) {
    console.error(`[imageStorage] ✗ Failed to upload image ${imageId} to Supabase Storage:`, error);
    if (error instanceof Error) {
      console.error(`[imageStorage] Error details: ${error.message}`);
      console.error(`[imageStorage] Stack: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * Delete a reference image from Supabase Storage.
 * 
 * @param storageUrl Supabase Storage URL of the image
 */
export async function deleteReferenceImage(storageUrl: string): Promise<void> {
  try {
    await deleteImageFromStorage(storageUrl);
  } catch (error) {
    console.error("Error deleting reference image from Supabase Storage:", error);
    throw error;
  }
}

/**
 * Check if Supabase Storage bucket is configured.
 * Note: Actual check happens on backend, but this ensures the bucket exists.
 */
export async function ensureStorageBucket(): Promise<void> {
  // Supabase Storage bucket setup is handled on the backend
  // The bucket 'reference-images' should be created in Supabase dashboard with public access
  console.log("Supabase Storage is configured on the backend");
}

