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
 */
export async function saveWorkflow(workflow: WorkflowState): Promise<void> {
  try {
    const { error } = await supabase
      .from("video_workflows")
      .upsert(
        {
          workflow_id: workflow.workflow_id,
          storyboard: workflow.storyboard,
          reference_images: workflow.reference_images,
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
      throw error;
    }
  } catch (error) {
    console.error("Error saving workflow:", error);
    throw error;
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

