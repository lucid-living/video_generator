/**
 * Main application component.
 */

import { useState, useEffect, useCallback } from "react";
import { StyleGuideBuilder } from "./components/StyleGuideBuilder";
import { StoryboardEditor } from "./components/StoryboardEditor";
import { VideoPreview } from "./components/VideoPreview";
import { SunoMusicGenerator } from "./components/SunoMusicGenerator";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { ReferenceImageGenerator } from "./components/ReferenceImageGenerator";
import { Login } from "./components/Login";
import { generateStoryboard } from "./services/api";
import { saveWorkflow, generateWorkflowId, listWorkflows, supabase } from "./services/supabase";
import "./utils/debugImages"; // Load debug utility
import type {
  Storyboard,
  WorkflowState,
  StoryboardGenerationRequest,
  AudioAsset,
  ReferenceImage,
} from "./types/storyboard";
import type { User } from "@supabase/supabase-js";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("");
  const [styleGuide, setStyleGuide] = useState("");
  const [styleGuideImages, setStyleGuideImages] = useState<string[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Check auth state on mount
  useEffect(() => {
    // Check current session
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load last workflow on mount (only if authenticated)
  useEffect(() => {
    if (!user) return;
    const loadLastWorkflow = async () => {
      try {
        const workflows = await listWorkflows();
        if (workflows.length > 0) {
          const lastWorkflow = workflows[0]; // Most recently updated
          handleSelectWorkflow(lastWorkflow);
        }
      } catch (err) {
        console.error("Failed to load last workflow:", err);
      }
    };
    loadLastWorkflow();
  }, []);

  // Auto-save theme and styleGuide to workflow
  const autoSaveInputs = useCallback(async () => {
    if (workflow && (theme.trim() || styleGuide.trim())) {
      // Create a draft workflow with just theme/styleGuide
      // This allows saving even before storyboard is generated
      const draftWorkflow: WorkflowState = {
        ...workflow,
        storyboard: workflow.storyboard || {
          shots: [],
          theme: theme.trim(),
          style_guide: styleGuide.trim(),
          total_duration: 0,
        },
      };
      
      // Update theme/styleGuide in storyboard if it exists
      if (draftWorkflow.storyboard) {
        draftWorkflow.storyboard.theme = theme.trim() || draftWorkflow.storyboard.theme;
        draftWorkflow.storyboard.style_guide = styleGuide.trim() || draftWorkflow.storyboard.style_guide;
      }

      try {
        await saveWorkflow(draftWorkflow);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }
  }, [workflow, theme, styleGuide]);

  // Debounced auto-save for theme and styleGuide
  useEffect(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (workflow) {
      const timer = setTimeout(() => {
        autoSaveInputs();
      }, 2000); // Save 2 seconds after user stops typing
      setAutoSaveTimer(timer);
    }

    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [theme, styleGuide, workflow]);

  const handleSelectWorkflow = (selectedWorkflow: WorkflowState | null) => {
    if (selectedWorkflow) {
      setWorkflow(selectedWorkflow);
      setStoryboard(selectedWorkflow.storyboard);
      setTheme(selectedWorkflow.storyboard?.theme || "");
      setStyleGuide(selectedWorkflow.storyboard?.style_guide || "");
    } else {
      // New project - clear everything
      setWorkflow(null);
      setStoryboard(null);
      setTheme("");
      setStyleGuide("");
    }
  };

  const handleNewProject = async () => {
    const newWorkflowId = generateWorkflowId();
    const newWorkflow: WorkflowState = {
      workflow_id: newWorkflowId,
      storyboard: {
        shots: [],
        theme: "",
        style_guide: "",
        total_duration: 0,
      },
      reference_images: [],
      video_clips: [],
      status: "planning",
    };
    setWorkflow(newWorkflow);
    setStoryboard(null);
    setTheme("");
    setStyleGuide("");
    // Save immediately so it appears in sidebar
    try {
      await saveWorkflow(newWorkflow);
    } catch (err) {
      console.error("Failed to save new project:", err);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!theme.trim() || !styleGuide.trim()) {
      setError("Please enter both theme and style guide");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const request: StoryboardGenerationRequest = {
        theme,
        style_guide: styleGuide,
      };

      const generated = await generateStoryboard(request);
      setStoryboard(generated);

      // Create or update workflow
      const workflowId = workflow?.workflow_id || generateWorkflowId();
      const updatedWorkflow: WorkflowState = {
        workflow_id: workflowId,
        storyboard: generated,
        reference_images: workflow?.reference_images || [],
        video_clips: workflow?.video_clips || [],
        audio_asset: workflow?.audio_asset,
        status: workflow?.status || "planning",
      };

      setWorkflow(updatedWorkflow);
      await saveWorkflow(updatedWorkflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate storyboard");
    } finally {
      setGenerating(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Clear workflow state on sign out
    setWorkflow(null);
    setStoryboard(null);
    setTheme("");
    setStyleGuide("");
  };

  // Show login page if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => setLoading(true)} />;
  }

  const handleStoryboardUpdate = async (updated: Storyboard) => {
    setStoryboard(updated);
    if (workflow) {
      const updatedWorkflow = {
        ...workflow,
        storyboard: updated,
      };
      setWorkflow(updatedWorkflow);
      await saveWorkflow(updatedWorkflow);
    }
  };

  const handleMusicGenerated = async (audio: AudioAsset) => {
    if (workflow) {
      const updatedWorkflow = {
        ...workflow,
        audio_asset: audio,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };
      setWorkflow(updatedWorkflow);
      await saveWorkflow(updatedWorkflow);
    }
  };

  const handleImagesGenerated = async (images: ReferenceImage[]) => {
    if (workflow) {
      const updatedWorkflow = {
        ...workflow,
        reference_images: images,
        status: workflow.status === "planning" ? "assets" : workflow.status,
      };
      setWorkflow(updatedWorkflow);
      await saveWorkflow(updatedWorkflow);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Auth Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-end gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <span className="text-sm text-gray-600 truncate max-w-[180px]">{user.email}</span>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Sign out
        </button>
      </div>

      {/* Sidebar */}
      <ProjectSidebar
        currentWorkflowId={workflow?.workflow_id || null}
        onSelectWorkflow={handleSelectWorkflow}
        onNewProject={handleNewProject}
      />

      {/* Main Content */}
      <div className="flex-1 ml-64 pt-12">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              AI Music Video Generator
            </h1>
            <p className="text-gray-600">
              Generate branded music videos from text prompts
            </p>
          </header>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Phase 1: Planning */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Phase 1: Planning</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="theme" className="block text-sm font-medium mb-2">
                  Theme
                </label>
                <input
                  id="theme"
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Enter video theme (e.g., 'Cyberpunk pirate adventure')"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <StyleGuideBuilder 
                value={styleGuide} 
                onChange={setStyleGuide}
                onDetailedChange={(data) => {
                  setStyleGuideImages(data.referenceImages);
                }}
                generatedImages={workflow?.reference_images || []}
              />

              <button
                onClick={handleGenerateStoryboard}
                disabled={generating || !theme.trim() || !styleGuide.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {generating ? "Generating..." : "Generate Storyboard"}
              </button>
            </div>
          </section>

          {/* Storyboard Editor */}
          {storyboard && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-4">Edit Storyboard</h2>
              <StoryboardEditor
                storyboard={storyboard}
                onUpdate={handleStoryboardUpdate}
              />
            </section>
          )}

          {/* Phase 2: Asset Generation */}
          {storyboard && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-4">Phase 2: Asset Generation</h2>
              
              <div className="space-y-6">
                {/* Music Generation */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Music Generation</h3>
                  <SunoMusicGenerator
                    lyrics={storyboard.shots.map((s) => s.lyric_line).join("\n")}
                    style={storyboard.style_guide}
                    onMusicGenerated={handleMusicGenerated}
                  />
                </div>

                {/* Reference Image Generation */}
                {workflow && (
                  <div>
                <ReferenceImageGenerator
                  storyboard={storyboard}
                  workflow={workflow}
                  onImagesGenerated={handleImagesGenerated}
                  styleGuideImages={styleGuideImages}
                  onSaveToStyleGuide={(image) => {
                    // Add saved image to style guide images
                    const imageData = image.storage_url || image.base64_data;
                    setStyleGuideImages([...styleGuideImages, imageData]);
                  }}
                />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Video Preview */}
          {workflow && (
            <section className="bg-white rounded-lg shadow p-6">
              <VideoPreview workflow={workflow} />
            </section>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;



