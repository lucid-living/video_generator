/**
 * Service for storing reference images in Google Drive.
 * Images are stored in project-specific folders in Google Drive.
 * Each workflow/project gets its own folder: "AI Music Video Generator Projects/Workflow_{workflow_id}/"
 */

import { uploadImageToGoogleDrive, deleteImageFromGoogleDrive } from "./api";

/**
 * Upload a reference image to Google Drive.
 * 
 * @param imageData Base64 data URI of the image
 * @param imageId Unique identifier for the image
 * @param description Description of the image
 * @param workflowId Workflow/project identifier (required for Google Drive organization)
 * @returns Public shareable URL of the uploaded image
 */
export async function uploadReferenceImage(
  imageData: string,
  imageId: string,
  description: string,
  workflowId: string
): Promise<string> {
  try {
    if (!workflowId) {
      throw new Error("workflowId is required for Google Drive upload");
    }
    
    const url = await uploadImageToGoogleDrive(
      imageData,
      imageId,
      workflowId,
      description
    );
    
    return url;
  } catch (error) {
    console.error("Error uploading reference image to Google Drive:", error);
    throw error;
  }
}

/**
 * Delete a reference image from Google Drive.
 * 
 * @param storageUrl Google Drive file URL or file ID
 */
export async function deleteReferenceImage(storageUrl: string): Promise<void> {
  try {
    await deleteImageFromGoogleDrive(storageUrl);
  } catch (error) {
    console.error("Error deleting reference image from Google Drive:", error);
    throw error;
  }
}

/**
 * Check if Google Drive is configured.
 * Note: This is a placeholder - actual check happens on backend.
 */
export async function ensureStorageBucket(): Promise<void> {
  // Google Drive setup is handled on the backend
  // This function exists for compatibility
  console.log("Google Drive storage is configured on the backend");
}

