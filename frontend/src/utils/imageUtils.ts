/**
 * Utility functions for handling images (base64, URLs, etc.)
 */

/**
 * [DEPRECATED] Convert an image URL to base64 data URI.
 * 
 * ⚠️ WARNING: This function causes unnecessary egress by downloading images.
 * The backend API (Kie.ai) accepts URLs directly, so this conversion is NOT needed.
 * 
 * Use URLs directly instead of converting to base64 to save bandwidth/egress costs.
 * 
 * @deprecated Use URLs directly instead. This function is kept for backward compatibility only.
 */
export async function urlToBase64(url: string): Promise<string> {
  console.warn(
    "⚠️ urlToBase64 is deprecated and causes unnecessary egress. " +
    "Use URLs directly instead. The backend accepts URLs."
  );
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
 * Normalize style guide images - pass URLs directly without conversion.
 * 
 * ⚠️ CRITICAL: This function NO LONGER converts URLs to base64 to prevent egress.
 * The backend API (Kie.ai) accepts URLs directly, so conversion is unnecessary and wasteful.
 * 
 * This function now simply passes URLs through and keeps base64 as-is.
 * No downloading/conversion happens, saving bandwidth and egress costs.
 * 
 * @param images Array of image strings (URLs or base64)
 * @returns Same array, passed through without conversion
 */
export async function normalizeStyleGuideImages(
  images: string[]
): Promise<string[]> {
  // ⚠️ REMOVED: URL to base64 conversion to prevent egress
  // The backend accepts URLs directly, so we just pass them through
  // This saves bandwidth by avoiding unnecessary downloads
  
  console.log(
    `✅ normalizeStyleGuideImages: Passing ${images.length} image(s) directly ` +
    `(no base64 conversion - saves egress!)`
  );
  
  // Simply return images as-is - backend accepts both URLs and base64
  return images;
}

/**
 * [DEPRECATED] Load an image from Supabase Storage URL and convert to base64 data URI.
 * 
 * ⚠️ WARNING: This function causes unnecessary egress by downloading images.
 * Use storage URLs directly instead of converting to base64.
 * 
 * @deprecated Use storage URLs directly instead. This function is kept for backward compatibility only.
 */
export async function loadImageFromSupabaseStorage(storageUrl: string): Promise<string> {
  console.warn(
    "⚠️ loadImageFromSupabaseStorage is deprecated and causes unnecessary egress. " +
    "Use storage URLs directly instead."
  );
  return urlToBase64(storageUrl);
}
