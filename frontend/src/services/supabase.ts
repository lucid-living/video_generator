/**
 * Supabase integration for workflow persistence.
 */

import { createClient } from "@supabase/supabase-js";
import type { WorkflowState } from "../types/storyboard";

// Supabase configuration - should be in environment variables
// Support both NEXT_PUBLIC_ (from root .env.local) and VITE_ prefixes
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_ prefixed versions)"
  );
}

// Initialize Supabase client
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

/**
 * Save workflow state to Supabase.
 * 
 * Note: Strips base64_data from reference_images to prevent database timeouts.
 * Only storage_url is saved to the database. base64_data should be loaded
 * from storage when needed for display.
 */
export async function saveWorkflow(workflow: WorkflowState): Promise<void> {
  try {
    // Strip base64_data from reference_images before saving to prevent database timeouts
    // Large base64 strings can cause PostgreSQL statement timeouts (error 57014)
    const referenceImagesForDatabase = workflow.reference_images.map((img) => {
      // CRITICAL: Never save images without both storage_url AND base64_data
      // If we have a storage_url, we can safely remove base64_data
      if (img.storage_url) {
        return {
          ...img,
          base64_data: "", // Remove base64_data when storage_url exists
        };
      } else {
        // If no storage_url, we MUST keep base64_data or the image will be lost
        if (!img.base64_data || img.base64_data.length < 100) {
          console.error(
            `CRITICAL: Image ${img.image_id} has no storage_url and no valid base64_data. ` +
            `This image cannot be displayed. Skipping save for this image.`
          );
          // Return null to filter out - we can't save images we can't display
          return null;
        }
        
        // If base64_data is very large (>500KB), warn but still save it
        // Better to have slow saves than lost images
        if (img.base64_data.length > 500000) {
          console.warn(
            `Image ${img.image_id} has no storage_url and very large base64_data (${Math.round(img.base64_data.length / 1000)}KB). ` +
            `This may cause database timeouts. Consider uploading to storage first.`
          );
        }
        
        // Keep base64_data - it's the only way to display this image
        return img;
      }
    }).filter((img): img is NonNullable<typeof img> => img !== null); // Remove null entries

    // Log the size of data being saved for debugging
    const dataSize = JSON.stringify(referenceImagesForDatabase).length;
    console.log(`Saving workflow ${workflow.workflow_id} with ${referenceImagesForDatabase.length} images (${dataSize} bytes)`);

    const { error } = await supabase
      .from("video_workflows")
      .upsert(
        {
          workflow_id: workflow.workflow_id,
          storyboard: workflow.storyboard,
          reference_images: referenceImagesForDatabase,
          video_clips: workflow.video_clips,
          audio_asset: workflow.audio_asset,
          final_video_url: workflow.final_video_url,
          status: workflow.status,
        },
        {
          onConflict: "workflow_id",
        }
      );

    if (error) {
      // Provide more detailed error information
      const errorMessage = error.message || "Unknown error";
      const errorCode = error.code || "UNKNOWN";
      console.error("Supabase error saving workflow:", {
        code: errorCode,
        message: errorMessage,
        details: error.details,
        hint: error.hint,
      });
      
      // Create a more user-friendly error message
      if (errorCode === "57014") {
        throw new Error("Database timeout: The workflow is too large. Please ensure all images are uploaded to storage.");
      } else if (errorCode === "PGRST204") {
        throw new Error("No rows returned: The workflow may not exist.");
      } else {
        throw new Error(`Failed to save workflow: ${errorMessage} (${errorCode})`);
      }
    }
  } catch (error) {
    console.error("Error saving workflow:", error);
    // Re-throw with better error message if it's not already an Error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to save workflow: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

/**
 * Load workflow state from Supabase.
 */
export async function loadWorkflow(workflowId: string): Promise<WorkflowState | null> {
  try {
    const { data, error } = await supabase
      .from("video_workflows")
      .select("*")
      .eq("workflow_id", workflowId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    // Map Supabase data to WorkflowState
    return {
      workflow_id: data.workflow_id,
      storyboard: data.storyboard,
      reference_images: data.reference_images || [],
      video_clips: data.video_clips || [],
      status: data.status || "planning",
      // Optional fields
      audio_asset: data.audio_asset || undefined,
      final_video_url: data.final_video_url || undefined,
    } as WorkflowState;
  } catch (error) {
    console.error("Error loading workflow:", error);
    throw error;
  }
}

/**
 * List all workflows from Supabase.
 */
export async function listWorkflows(): Promise<WorkflowState[]> {
  try {
    const { data, error } = await supabase
      .from("video_workflows")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!data) {
      return [];
    }

    // Map Supabase data to WorkflowState array
    return data.map((item) => ({
      workflow_id: item.workflow_id,
      storyboard: item.storyboard,
      reference_images: item.reference_images || [],
      video_clips: item.video_clips || [],
      status: item.status || "planning",
      audio_asset: item.audio_asset || undefined,
      final_video_url: item.final_video_url || undefined,
    })) as WorkflowState[];
  } catch (error) {
    console.error("Error listing workflows:", error);
    throw error;
  }
}

/**
 * Delete a workflow from Supabase.
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("video_workflows")
      .delete()
      .eq("workflow_id", workflowId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error deleting workflow:", error);
    throw error;
  }
}

/**
 * Generate a unique workflow ID.
 */
export function generateWorkflowId(): string {
  return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

