/**
 * Service for saving and loading style guide templates.
 */

import { createClient } from "@supabase/supabase-js";
import type { StyleGuideData } from "../components/StyleGuideBuilder";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface StyleGuideTemplate {
  id: string;
  name: string;
  description?: string;
  style_guide_data: StyleGuideData;
  created_at: string;
  updated_at: string;
}

/**
 * Save a style guide template.
 */
export async function saveStyleGuideTemplate(
  name: string,
  data: StyleGuideData,
  description?: string,
  templateId?: string
): Promise<StyleGuideTemplate> {
  try {
    const templateData = {
      name,
      description: description || null,
      style_guide_data: data,
      updated_at: new Date().toISOString(),
    };

    if (templateId) {
      // Update existing template
      const { data: updated, error } = await supabase
        .from("style_guide_templates")
        .update(templateData)
        .eq("id", templateId)
        .select()
        .single();

      if (error) throw error;
      return updated;
    } else {
      // Create new template
      const { data: created, error } = await supabase
        .from("style_guide_templates")
        .insert({
          ...templateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return created;
    }
  } catch (error) {
    console.error("Error saving style guide template:", error);
    throw error;
  }
}

/**
 * Load all style guide templates.
 */
export async function listStyleGuideTemplates(): Promise<StyleGuideTemplate[]> {
  try {
    const { data, error } = await supabase
      .from("style_guide_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error loading style guide templates:", error);
    throw error;
  }
}

/**
 * Load a specific style guide template by ID.
 */
export async function loadStyleGuideTemplate(id: string): Promise<StyleGuideTemplate | null> {
  try {
    const { data, error } = await supabase
      .from("style_guide_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error loading style guide template:", error);
    return null;
  }
}

/**
 * Delete a style guide template.
 */
export async function deleteStyleGuideTemplate(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("style_guide_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting style guide template:", error);
    throw error;
  }
}


