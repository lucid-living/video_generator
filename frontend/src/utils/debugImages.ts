/**
 * Debug utility to check and recover reference images from Supabase.
 * Run this from browser console: window.debugImages()
 */

import { supabase } from "../services/supabase";
import type { ReferenceImage } from "../types/storyboard";

export async function debugImages(): Promise<void> {
  console.log("=".repeat(80));
  console.log("REFERENCE IMAGE DEBUG TOOL");
  console.log("=".repeat(80));
  console.log();

  try {
    // Query all workflows
    console.log("Querying workflows from Supabase...");
    const { data: workflows, error } = await supabase
      .from("video_workflows")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error querying workflows:", error);
      return;
    }

    if (!workflows || workflows.length === 0) {
      console.log("No workflows found in database.");
      return;
    }

    console.log(`Found ${workflows.length} workflow(s)\n`);

    let totalImages = 0;
    let imagesWithData = 0;
    let imagesWithStorageUrl = 0;
    let imagesMissingData = 0;
    const recoverableImages: Array<{
      workflowId: string;
      image: ReferenceImage;
      hasBase64: boolean;
      hasStorageUrl: boolean;
    }> = [];

    for (let idx = 0; idx < workflows.length; idx++) {
      const workflow = workflows[idx];
      const workflowId = workflow.workflow_id || "unknown";
      const referenceImages = workflow.reference_images || [];

      console.log("=".repeat(80));
      console.log(`WORKFLOW ${idx + 1}: ${workflowId}`);
      console.log("=".repeat(80));
      console.log(`Status: ${workflow.status || "unknown"}`);
      console.log(`Reference Images Count: ${referenceImages.length}`);

      if (referenceImages && referenceImages.length > 0) {
        totalImages += referenceImages.length;

        for (let imgIdx = 0; imgIdx < referenceImages.length; imgIdx++) {
          const img = referenceImages[imgIdx];
          const imageId = img.image_id || "unknown";
          const shotIndices = img.shot_indices || [];
          const description =
            (img.description || "").length > 60
              ? (img.description || "").substring(0, 60) + "..."
              : img.description || "";
          const base64Data = img.base64_data || "";
          const storageUrl = img.storage_url || "";
          const approved = img.approved || false;

          console.log(`\n  Image ${imgIdx + 1}:`);
          console.log(`    ID: ${imageId}`);
          console.log(`    Shot Indices: ${shotIndices.join(", ")}`);
          console.log(`    Description: ${description}`);
          console.log(`    Approved: ${approved}`);
          console.log(`    Storage URL: ${storageUrl || "None"}`);

          const hasBase64 = base64Data && base64Data.length > 1000;
          const hasStorageUrl = !!storageUrl;

          if (hasBase64) {
            console.log(`    Base64 Data: ${base64Data.length} characters`);
            console.log(`    Base64 Preview: ${base64Data.substring(0, 100)}...`);
            imagesWithData++;
            recoverableImages.push({
              workflowId,
              image: img as ReferenceImage,
              hasBase64: true,
              hasStorageUrl: false,
            });
          } else if (hasStorageUrl) {
            console.log(`    ✓ Has storage URL - can be loaded from Supabase Storage`);
            imagesWithStorageUrl++;
            recoverableImages.push({
              workflowId,
              image: img as ReferenceImage,
              hasBase64: false,
              hasStorageUrl: true,
            });
          } else {
            console.log(`    ⚠ Missing both storage URL and base64 data`);
            imagesMissingData++;
          }
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Images Found: ${totalImages}`);
    console.log(`Images with Base64 Data: ${imagesWithData}`);
    console.log(`Images with Storage URL: ${imagesWithStorageUrl}`);
    console.log(`Images Missing Data: ${imagesMissingData}`);

    if (imagesWithData > 0) {
      console.log(
        `\n✓ Found ${imagesWithData} image(s) with base64 data that can be recovered!`
      );
    }
    if (imagesWithStorageUrl > 0) {
      console.log(
        `✓ Found ${imagesWithStorageUrl} image(s) with storage URLs that can be loaded!`
      );
    }
    if (imagesMissingData > 0) {
      console.log(
        `⚠ ${imagesMissingData} image(s) are missing data and may be lost.`
      );
    }

    // Store recoverable images in window for easy access
    (window as any).recoverableImages = recoverableImages;
    console.log(
      `\n💡 Recoverable images stored in window.recoverableImages for further inspection`
    );

    return;
  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

// Make it available globally for browser console access
if (typeof window !== "undefined") {
  (window as any).debugImages = debugImages;
  console.log(
    "💡 Debug tool loaded! Run window.debugImages() in the console to check for recoverable images."
  );
}

