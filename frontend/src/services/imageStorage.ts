/**
 * Service for storing reference images in Supabase Storage.
 * Images are stored in a 'reference-images' bucket and can be linked to style guides.
 */

import { supabase } from "./supabase";

const STORAGE_BUCKET = "reference-images";

/**
 * Upload a reference image to Supabase Storage.
 * 
 * @param imageData Base64 data URI of the image
 * @param imageId Unique identifier for the image
 * @param description Description of the image
 * @returns Public URL of the uploaded image
 */
export async function uploadReferenceImage(
  imageData: string,
  imageId: string,
  description: string
): Promise<string> {
  try {
    // Convert base64 data URI to blob
    const base64Data = imageData.split(",")[1]; // Remove data:image/png;base64, prefix
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/png" });

    // Create filename with image ID
    const filename = `${imageId}.png`;
    const filePath = `${Date.now()}_${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: "image/png",
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error("Failed to get public URL for uploaded image");
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading reference image:", error);
    throw error;
  }
}

/**
 * Delete a reference image from Supabase Storage.
 * 
 * @param storageUrl Public URL of the image to delete
 */
export async function deleteReferenceImage(storageUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const urlParts = storageUrl.split("/");
    const filePath = urlParts.slice(urlParts.indexOf(STORAGE_BUCKET) + 1).join("/");

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error deleting reference image:", error);
    throw error;
  }
}

/**
 * Check if the storage bucket exists, create if it doesn't.
 * Note: This requires admin privileges, so it's best to create the bucket manually in Supabase dashboard.
 */
export async function ensureStorageBucket(): Promise<void> {
  try {
    // Try to list files to check if bucket exists
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1 });

    if (error && error.message.includes("not found")) {
      console.warn(
        `Storage bucket '${STORAGE_BUCKET}' does not exist. ` +
        `Please create it in the Supabase dashboard with public access.`
      );
    }
  } catch (error) {
    console.error("Error checking storage bucket:", error);
  }
}

