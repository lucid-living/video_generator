/**
 * Utility functions for handling images (base64, URLs, etc.)
 */

/**
 * Convert an image URL to base64 data URI.
 * Useful for converting Supabase storage URLs to base64 for API calls.
 */
export async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting URL to base64:", error);
    throw error;
  }
}

/**
 * Check if a string is a URL (starts with http:// or https://).
 */
export function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Convert style guide images (which may be URLs or base64) to base64 format.
 * This is needed because the backend API expects base64 format.
 */
export async function normalizeStyleGuideImages(
  images: string[]
): Promise<string[]> {
  const normalized: string[] = [];
  
  for (const image of images) {
    if (isUrl(image)) {
      // Convert URL to base64
      try {
        const base64 = await urlToBase64(image);
        normalized.push(base64);
      } catch (error) {
        console.warn(`Failed to convert image URL to base64: ${image}`, error);
        // Skip this image if conversion fails
      }
    } else {
      // Already base64, use as-is
      normalized.push(image);
    }
  }
  
  return normalized;
}

/**
 * Load an image from Supabase Storage URL and convert to base64 data URI.
 * Useful for loading images that are stored in Supabase Storage.
 * 
 * @param storageUrl Supabase Storage URL
 * @returns Base64 data URI of the image
 */
export async function loadImageFromSupabaseStorage(storageUrl: string): Promise<string> {
  return urlToBase64(storageUrl);
}

