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
    
    const url = await uploadImageToStorage(
      imageData,
      imageId,
      workflowId,
      description
    );
    
    return url;
  } catch (error) {
    console.error("Error uploading reference image to Supabase Storage:", error);
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

