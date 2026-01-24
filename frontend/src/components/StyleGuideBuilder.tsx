/**
 * Comprehensive Style Guide Builder - Studio-style interface.
 * Allows creating detailed style guides with images, structured sections, and templates.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  saveStyleGuideTemplate, 
  listStyleGuideTemplates, 
  loadStyleGuideTemplate,
  type StyleGuideTemplate 
} from "../services/styleGuideStorage";
import { analyzeStyleFromImages } from "../services/api";
import { fetchChannels, isContentMachineAvailable, type Channel } from "../services/contentMachineApi";
import type { ReferenceImage } from "../types/storyboard";

export interface StyleGuideData {
  // Channel & Brand Information
  channelName: string;
  channelDescription: string;
  targetAudience: string;
  contentType: string;
  brandValues: string;
  brandMessaging: string;
  brandTone: string;
  contentStrategy: string;
  viewerPreferences: string;
  
  // Visual Style (existing)
  animationStyle: string;
  characterDesign: string;
  colorPalette: string;
  lighting: string;
  cameraComposition: string;
  texturesMaterials: string;
  moodTone: string;
  referenceImages: string[]; // Base64 data URIs
  referenceFilms: string;
  additionalNotes: string;
}

interface StyleGuideBuilderProps {
  value: string; // Current simple style guide (for backward compatibility)
  onChange: (value: string) => void; // Outputs compiled style guide text
  onDetailedChange?: (data: StyleGuideData) => void; // Optional: detailed data callback
  generatedImages?: ReferenceImage[]; // Generated reference images that can be added to style guide
}

export function StyleGuideBuilder({
  value,
  onChange,
  onDetailedChange,
  generatedImages = [],
}: StyleGuideBuilderProps) {
  const [activeTab, setActiveTab] = useState<"simple" | "detailed">("simple");
  const [simpleGuide, setSimpleGuide] = useState(value);
  const [templates, setTemplates] = useState<StyleGuideTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const loadDropdownRef = useRef<HTMLDivElement>(null);
  
  // Content Machine integration
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [contentMachineAvailable, setContentMachineAvailable] = useState(false);
  
  // Detailed style guide sections
  const [styleData, setStyleData] = useState<StyleGuideData>({
    // Channel & Brand Information
    channelName: "",
    channelDescription: "",
    targetAudience: "",
    contentType: "",
    brandValues: "",
    brandMessaging: "",
    brandTone: "",
    contentStrategy: "",
    viewerPreferences: "",
    
    // Visual Style
    animationStyle: "",
    characterDesign: "",
    colorPalette: "",
    lighting: "",
    cameraComposition: "",
    texturesMaterials: "",
    moodTone: "",
    referenceImages: [],
    referenceFilms: "",
    additionalNotes: "",
  });

  // Load templates on mount and when dropdown opens
  useEffect(() => {
    loadTemplates();
  }, []);

  // Check Content Machine availability and load channels
  useEffect(() => {
    const checkAndLoadChannels = async () => {
      const available = isContentMachineAvailable();
      setContentMachineAvailable(available);
      
      if (available) {
        setLoadingChannels(true);
        try {
          const loadedChannels = await fetchChannels();
          setChannels(loadedChannels);
        } catch (error) {
          console.error("Failed to load channels from Content Machine:", error);
          // Don't show error to user - just disable the feature
          setContentMachineAvailable(false);
        } finally {
          setLoadingChannels(false);
        }
      }
    };
    
    checkAndLoadChannels();
  }, []);

  // Reload templates when dropdown opens
  useEffect(() => {
    if (showLoadDropdown) {
      loadTemplates();
    }
  }, [showLoadDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (loadDropdownRef.current && !loadDropdownRef.current.contains(event.target as Node)) {
        setShowLoadDropdown(false);
      }
    };

    if (showLoadDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLoadDropdown]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    setTemplateError(null);
    try {
      const loaded = await listStyleGuideTemplates();
      setTemplates(loaded);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplateError("Failed to load saved styles. Make sure the database table exists.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const template = await loadStyleGuideTemplate(templateId);
      if (template) {
        // Merge with default values to ensure backward compatibility with old templates
        const defaultData: StyleGuideData = {
          // Channel & Brand (defaults for old templates)
          channelName: "",
          channelDescription: "",
          targetAudience: "",
          contentType: "",
          brandValues: "",
          brandMessaging: "",
          brandTone: "",
          contentStrategy: "",
          viewerPreferences: "",
          // Visual Style (defaults for old templates)
          animationStyle: "",
          characterDesign: "",
          colorPalette: "",
          lighting: "",
          cameraComposition: "",
          texturesMaterials: "",
          moodTone: "",
          referenceImages: [],
          referenceFilms: "",
          additionalNotes: "",
        };
        // Merge: defaults first, then loaded data (loaded data overrides defaults)
        const loadedData: StyleGuideData = {
          ...defaultData,
          ...template.style_guide_data,
        };
        setStyleData(loadedData);
        setSelectedTemplateId(templateId);
        setTemplateName(template.name);
        const compiled = compileStyleGuide(loadedData);
        onChange(compiled);
        setSimpleGuide(compiled); // Update simple guide text as well
        onDetailedChange?.(loadedData);
        // Switch to detailed mode to show all the loaded sections
        setActiveTab("detailed");
      }
    } catch (err) {
      console.error("Failed to load template:", err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);
    try {
      // Remove reference images from data before saving to avoid size issues
      // Reference images are base64 and can be very large
      const dataToSave: StyleGuideData = {
        ...styleData,
        referenceImages: [], // Don't save images in template to keep size manageable
      };
      
      await saveStyleGuideTemplate(
        templateName.trim(),
        dataToSave,
        undefined,
        selectedTemplateId || undefined
      );
      setShowSaveDialog(false);
      setTemplateName(""); // Clear the name field
      await loadTemplates();
      alert("Style guide saved successfully!");
    } catch (err) {
      console.error("Failed to save template:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to save style guide template: ${errorMessage}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleAddGeneratedImage = (image: ReferenceImage) => {
    // Use storage URL if available, otherwise use base64
    const imageData = image.storage_url || image.base64_data;
    const updated = {
      ...styleData,
      referenceImages: [...styleData.referenceImages, imageData],
    };
    setStyleData(updated);
    
    // Compile and update
    const compiled = compileStyleGuide(updated);
    onChange(compiled);
    onDetailedChange?.(updated);
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setStyleData((prev) => ({
            ...prev,
            referenceImages: [...prev.referenceImages, base64],
          }));
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleAnalyzeStyle = async () => {
    if (styleData.referenceImages.length === 0) {
      setAnalysisError("Please upload at least one reference image to analyze");
      return;
    }

    setAnalyzingStyle(true);
    setAnalysisError(null);

    try {
      console.log(`Analyzing ${styleData.referenceImages.length} image(s)...`);
      console.log("First image preview:", styleData.referenceImages[0]?.substring(0, 50) + "...");
      
      // Call the analysis API
      const analysisResult = await analyzeStyleFromImages(styleData.referenceImages);
      
      // Merge analysis results with existing data (don't overwrite if user already filled something)
      const updatedData: StyleGuideData = {
        ...styleData,
        animationStyle: styleData.animationStyle || analysisResult.animationStyle,
        characterDesign: styleData.characterDesign || analysisResult.characterDesign,
        colorPalette: styleData.colorPalette || analysisResult.colorPalette,
        lighting: styleData.lighting || analysisResult.lighting,
        cameraComposition: styleData.cameraComposition || analysisResult.cameraComposition,
        texturesMaterials: styleData.texturesMaterials || analysisResult.texturesMaterials,
        moodTone: styleData.moodTone || analysisResult.moodTone,
        referenceFilms: styleData.referenceFilms || analysisResult.referenceFilms,
        additionalNotes: styleData.additionalNotes || analysisResult.additionalNotes,
      };

      setStyleData(updatedData);
      
      // Compile and update
      const compiled = compileStyleGuide(updatedData);
      onChange(compiled);
      onDetailedChange?.(updatedData);
      
      // Switch to detailed mode to show the results
      setActiveTab("detailed");
    } catch (err) {
      console.error("Style analysis failed:", err);
      setAnalysisError(err instanceof Error ? err.message : "Failed to analyze style. Please try again.");
    } finally {
      setAnalyzingStyle(false);
    }
  };

  const removeImage = (index: number) => {
    setStyleData((prev) => ({
      ...prev,
      referenceImages: prev.referenceImages.filter((_, i) => i !== index),
    }));
  };

  const compileStyleGuide = useCallback((data: StyleGuideData): string => {
    const sections: string[] = [];

    // Channel & Brand Information (add first for context)
    const brandSections: string[] = [];
    if (data.channelName) {
      brandSections.push(`CHANNEL: ${data.channelName}`);
    }
    if (data.channelDescription) {
      brandSections.push(`CHANNEL DESCRIPTION:\n${data.channelDescription}`);
    }
    if (data.targetAudience) {
      brandSections.push(`TARGET AUDIENCE:\n${data.targetAudience}`);
    }
    if (data.contentType) {
      brandSections.push(`CONTENT TYPE: ${data.contentType}`);
    }
    if (data.brandValues) {
      brandSections.push(`BRAND VALUES:\n${data.brandValues}`);
    }
    if (data.brandMessaging) {
      brandSections.push(`BRAND MESSAGING:\n${data.brandMessaging}`);
    }
    if (data.brandTone) {
      brandSections.push(`BRAND TONE:\n${data.brandTone}`);
    }
    if (data.contentStrategy) {
      brandSections.push(`CONTENT STRATEGY:\n${data.contentStrategy}`);
    }
    if (data.viewerPreferences) {
      brandSections.push(`VIEWER PREFERENCES:\n${data.viewerPreferences}`);
    }
    
    if (brandSections.length > 0) {
      sections.push(`BRAND & CHANNEL IDENTITY:\n${brandSections.join("\n\n")}`);
    }

    // Visual Style
    if (data.animationStyle) {
      sections.push(`ANIMATION STYLE:\n${data.animationStyle}`);
    }

    if (data.characterDesign) {
      sections.push(`CHARACTER DESIGN:\n${data.characterDesign}`);
    }

    if (data.colorPalette) {
      sections.push(`COLOR PALETTE:\n${data.colorPalette}`);
    }

    if (data.lighting) {
      sections.push(`LIGHTING:\n${data.lighting}`);
    }

    if (data.cameraComposition) {
      sections.push(`CAMERA & COMPOSITION:\n${data.cameraComposition}`);
    }

    if (data.texturesMaterials) {
      sections.push(`TEXTURES & MATERIALS:\n${data.texturesMaterials}`);
    }

    if (data.moodTone) {
      sections.push(`MOOD & TONE:\n${data.moodTone}`);
    }

    if (data.referenceFilms) {
      sections.push(`REFERENCE FILMS: ${data.referenceFilms}`);
    }

    if (data.additionalNotes) {
      sections.push(`ADDITIONAL NOTES:\n${data.additionalNotes}`);
    }

    return sections.join("\n\n");
  }, []);

  const handleSectionChange = (section: keyof StyleGuideData, content: string) => {
    const updated = { ...styleData, [section]: content };
    setStyleData(updated);
    
    // Compile and update
    const compiled = compileStyleGuide(updated);
    onChange(compiled);
    onDetailedChange?.(updated);
  };

  const handleSimpleChange = (newValue: string) => {
    setSimpleGuide(newValue);
    onChange(newValue);
  };

  const handleLoadAndClose = async (templateId: string) => {
    await handleLoadTemplate(templateId);
    setShowLoadDropdown(false);
  };

  const handleChannelSelect = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    setSelectedChannelId(channelId);
    
    // Auto-populate brand fields from channel
    const updatedData: StyleGuideData = {
      ...styleData,
      channelName: channel.name || styleData.channelName,
      contentType: channel.channel_type || styleData.contentType,
      // Channel link can be used as additional context
      channelDescription: styleData.channelDescription || 
        (channel.channel_link ? `Channel: ${channel.name}\nLink: ${channel.channel_link}` : styleData.channelDescription),
    };
    
    setStyleData(updatedData);
    
    // Compile and update
    const compiled = compileStyleGuide(updatedData);
    onChange(compiled);
    onDetailedChange?.(updatedData);
  };

  const handleLoadPixarLullabyPreset = () => {
    const presetData: StyleGuideData = {
      // Channel & Brand Information
      channelName: styleData.channelName || "Lullaby Channel",
      channelDescription: styleData.channelDescription || "Animated lullaby videos for children",
      targetAudience: "Children under 2 (helping them sleep better) and children under 5 (teaching Christian values)",
      contentType: "Animated lullaby music videos with storytelling",
      brandValues: "Love, kindness, faith, peace, comfort, Christian values",
      brandMessaging: "Creating peaceful, educational content that helps children sleep while teaching positive Christian values",
      brandTone: "Calming, gentle, warm, nurturing, peaceful, educational",
      contentStrategy: "3 videos per week - consistent Pixar-style animation with recurring characters and themes",
      viewerPreferences: "Parents seeking quality bedtime content that combines sleep aid with positive values education",
      
      // Visual Style - Pixar for Children's Lullabies
      animationStyle: "Pixar-style 3D animation - smooth, polished, high-quality 3D animated style matching Pixar Animation Studios (Inside Out, Soul, Coco, Up, Toy Story). Calming, gentle movements perfect for lullabies. Soft transitions, no sudden movements.",
      characterDesign: "Pixar-style characters with friendly, expressive faces. Rounded, approachable forms. Consistent character designs across all videos. Characters should be warm, inviting, and non-threatening. Age-appropriate for children 0-5.",
      colorPalette: "Soft, calming colors: gentle blues, warm purples, soft pastels, warm whites. Avoid bright, stimulating colors. Use colors that promote relaxation and sleep. Warm, inviting tones with good contrast for visibility.",
      lighting: "Soft, diffused lighting. Warm, gentle light sources. Soft shadows with ambient occlusion. Avoid harsh shadows or dramatic lighting. Create a peaceful, dreamy atmosphere suitable for bedtime.",
      cameraComposition: "Gentle camera movements. Soft focus. Wide, peaceful shots for lullabies. Close-ups for emotional moments. Rule of thirds. Avoid jarring camera movements or quick cuts.",
      texturesMaterials: "Clean, polished 3D surfaces with subtle subsurface scattering (skin glow). Smooth, rounded forms. NO photorealistic textures - everything must look like high-quality 3D animation.",
      moodTone: "Calming, peaceful, soothing, warm, nurturing. Perfect for bedtime. Gentle and educational. Positive and uplifting while remaining peaceful.",
      referenceImages: styleData.referenceImages, // Keep existing images
      referenceFilms: "Pixar: Inside Out, Soul, Coco, Up, Toy Story, Monsters Inc. DreamWorks: How to Train Your Dragon (calming scenes).",
      additionalNotes: "CRITICAL: All content must be age-appropriate for children under 5. For lullabies (ages 0-2): focus on sleep-inducing visuals (stars, moons, clouds, peaceful landscapes). For educational content (ages 2-5): integrate Christian values naturally (kindness, love, helping others, biblical stories). Maintain character consistency across all videos. Use your favorited images as references for best results.",
    };
    
    setStyleData(presetData);
    const compiled = compileStyleGuide(presetData);
    onChange(compiled);
    onDetailedChange?.(presetData);
    setActiveTab("detailed"); // Switch to detailed view to show all sections
  };

  return (
    <div className="style-guide-builder space-y-4">
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium">
          Style Guide
        </label>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleLoadPixarLullabyPreset}
            className="px-3 py-1 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
            title="Load Pixar Lullaby preset - optimized for children's animated lullabies with Christian values"
          >
            <span>🎬 Pixar Lullaby</span>
          </button>
          <div className="relative" ref={loadDropdownRef}>
            <button
              onClick={() => setShowLoadDropdown(!showLoadDropdown)}
              className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"
            >
              <span>Load Saved Style</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showLoadDropdown ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLoadDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {loadingTemplates ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    Loading...
                  </div>
                ) : templateError ? (
                  <div className="p-3 text-sm text-red-600 text-center">
                    {templateError}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    No saved styles yet. Create one in Studio Mode!
                  </div>
                ) : (
                  <div className="py-1">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleLoadAndClose(template.id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-gray-500 truncate">{template.description}</div>
                          )}
                        </div>
                        <svg 
                          className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveTab("simple")}
            className={`px-3 py-1 text-sm rounded-md ${
              activeTab === "simple"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setActiveTab("detailed")}
            className={`px-3 py-1 text-sm rounded-md ${
              activeTab === "detailed"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Studio Mode
          </button>
        </div>
      </div>

      {activeTab === "simple" ? (
        <div>
          <textarea
            value={simpleGuide}
            onChange={(e) => handleSimpleChange(e.target.value)}
            placeholder="Enter visual style guide (e.g., 'Pixar 3D animation style, like Inside Out')"
            className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            This style guide will be injected into all video prompts for consistency.
          </p>
        </div>
      ) : (
        <div className="space-y-6 border border-gray-200 rounded-lg p-6 bg-white">
          {/* Brand & Channel Identity Section */}
          <div className="border-b border-gray-300 pb-6 mb-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900">🎯 Brand & Channel Identity</h3>
            <p className="text-sm text-gray-600 mb-4">
              Define your channel's brand identity and content strategy to ensure consistent visual style across all generated content.
            </p>
            
            {/* Content Machine Integration */}
            {contentMachineAvailable && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    📺 Load from Content Machine
                  </label>
                  {loadingChannels && (
                    <span className="text-xs text-gray-500">Loading channels...</span>
                  )}
                </div>
                {channels.length > 0 ? (
                  <select
                    value={selectedChannelId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleChannelSelect(e.target.value);
                      } else {
                        setSelectedChannelId(null);
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    <option value="">-- Select a channel to auto-fill --</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} {channel.channel_type ? `(${channel.channel_type})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-600">
                    No channels found in Content Machine. Create channels there first, or fill in manually below.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Select a channel from Content Machine to automatically populate channel name and type.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              {/* Channel Name */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={styleData.channelName}
                  onChange={(e) => handleSectionChange("channelName", e.target.value)}
                  placeholder="e.g., TechExplained, CreativeStudio, GamingHub"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Channel Description */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Channel Description
                </label>
                <textarea
                  value={styleData.channelDescription}
                  onChange={(e) => handleSectionChange("channelDescription", e.target.value)}
                  placeholder="Describe what your channel is about, its mission, and what makes it unique..."
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Target Audience
                </label>
                <textarea
                  value={styleData.targetAudience}
                  onChange={(e) => handleSectionChange("targetAudience", e.target.value)}
                  placeholder="Describe your target viewers: demographics, interests, preferences, what they value..."
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Content Type
                </label>
                <input
                  type="text"
                  value={styleData.contentType}
                  onChange={(e) => handleSectionChange("contentType", e.target.value)}
                  placeholder="e.g., Educational tutorials, Entertainment, Product reviews, Storytelling"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Brand Values */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Brand Values
                </label>
                <textarea
                  value={styleData.brandValues}
                  onChange={(e) => handleSectionChange("brandValues", e.target.value)}
                  placeholder="What does your brand stand for? Core values, principles, what you want to communicate..."
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Brand Messaging */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Brand Messaging
                </label>
                <textarea
                  value={styleData.brandMessaging}
                  onChange={(e) => handleSectionChange("brandMessaging", e.target.value)}
                  placeholder="Key messages you want to convey through your content. What should viewers take away?"
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Brand Tone */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Brand Tone & Voice
                </label>
                <textarea
                  value={styleData.brandTone}
                  onChange={(e) => handleSectionChange("brandTone", e.target.value)}
                  placeholder="How should your brand sound? Professional, friendly, humorous, authoritative, casual..."
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Content Strategy */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Content Strategy & What Works
                </label>
                <textarea
                  value={styleData.contentStrategy}
                  onChange={(e) => handleSectionChange("contentStrategy", e.target.value)}
                  placeholder="What content performs well? What topics, formats, or approaches resonate with your audience?"
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Viewer Preferences */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  Viewer Preferences & Insights
                </label>
                <textarea
                  value={styleData.viewerPreferences}
                  onChange={(e) => handleSectionChange("viewerPreferences", e.target.value)}
                  placeholder="What do your viewers like? Visual preferences, content length, style preferences, engagement patterns..."
                  className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Visual Style Section */}
          <div className="border-b border-gray-300 pb-6 mb-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900">🎨 Visual Style</h3>
            <p className="text-sm text-gray-600 mb-4">
              Define the visual aesthetic that matches your brand identity and resonates with your audience.
            </p>
          </div>

          {/* Animation Style */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Animation Style
            </label>
            <textarea
              value={styleData.animationStyle}
              onChange={(e) => handleSectionChange("animationStyle", e.target.value)}
              placeholder="e.g., Pixar Animation Studios style (Inside Out, Soul, Coco). Smooth 3D animation with expressive characters, soft edges, stylized realism..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Character Design */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Character Design
            </label>
            <textarea
              value={styleData.characterDesign}
              onChange={(e) => handleSectionChange("characterDesign", e.target.value)}
              placeholder="e.g., Expressive facial features, rounded forms, consistent proportions, friendly appeal, distinctive silhouette..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Color Palette
            </label>
            <textarea
              value={styleData.colorPalette}
              onChange={(e) => handleSectionChange("colorPalette", e.target.value)}
              placeholder="e.g., Warm, saturated colors. Primary: soft blues and greens. Accent: warm yellows and oranges. Avoid harsh contrasts..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Lighting */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Lighting & Atmosphere
            </label>
            <textarea
              value={styleData.lighting}
              onChange={(e) => handleSectionChange("lighting", e.target.value)}
              placeholder="e.g., Soft, diffused lighting. Warm key lights from top-left. Soft shadows with ambient occlusion. No harsh shadows..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Camera & Composition */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Camera & Composition
            </label>
            <textarea
              value={styleData.cameraComposition}
              onChange={(e) => handleSectionChange("cameraComposition", e.target.value)}
              placeholder="e.g., Dynamic camera angles, rule of thirds, close-ups for emotion, wide shots for context..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Textures & Materials */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Textures & Materials
            </label>
            <textarea
              value={styleData.texturesMaterials}
              onChange={(e) => handleSectionChange("texturesMaterials", e.target.value)}
              placeholder="e.g., Smooth, polished surfaces. Subtle subsurface scattering on skin. Soft fabric textures. No photorealistic details..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Mood & Tone */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Mood & Tone
            </label>
            <textarea
              value={styleData.moodTone}
              onChange={(e) => handleSectionChange("moodTone", e.target.value)}
              placeholder="e.g., Warm, inviting, peaceful, emotional. Conveying comfort and safety. Gentle and nurturing atmosphere..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Reference Films */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Reference Films / Inspiration
            </label>
            <input
              type="text"
              value={styleData.referenceFilms}
              onChange={(e) => handleSectionChange("referenceFilms", e.target.value)}
              placeholder="e.g., Inside Out, Soul, Coco, Up, Toy Story"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Reference Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Reference Images (Mood Board)
              </label>
              {styleData.referenceImages.length > 0 && (
                <span className="text-xs text-gray-500">
                  {styleData.referenceImages.length} image{styleData.referenceImages.length !== 1 ? 's' : ''} uploaded
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAnalyzeStyle}
                  disabled={analyzingStyle || styleData.referenceImages.length === 0}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                    styleData.referenceImages.length === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : analyzingStyle
                      ? "bg-purple-500 text-white cursor-wait"
                      : "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer shadow-md hover:shadow-lg"
                  }`}
                  title={
                    styleData.referenceImages.length === 0
                      ? "Upload images first to enable analysis"
                      : "Analyze uploaded images to automatically extract style guide information"
                  }
                >
                  {analyzingStyle ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Analyze Style
                    </>
                  )}
                </button>
              </div>
              
              {analysisError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                  {analysisError}
                </div>
              )}
              
              {styleData.referenceImages.length > 0 && !analyzingStyle && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Upload your reference images, then click "AI Analyze Style" to automatically extract style guide information! For videos, extract key frames as images first.
                </div>
              )}
              
              {/* Add Generated Images */}
              {generatedImages.length > 0 && (
                <div className="border border-blue-200 rounded-md p-3 bg-blue-50">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Add Generated Images to Style Guide:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {generatedImages.map((img) => (
                      <button
                        key={img.image_id}
                        onClick={() => handleAddGeneratedImage(img)}
                        className="relative group border-2 border-dashed border-blue-300 rounded-md overflow-hidden hover:border-blue-500 transition-colors"
                      >
                        <img
                          src={img.base64_data}
                          alt={img.description}
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <span className="text-white text-xs opacity-0 group-hover:opacity-100">
                            + Add
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {styleData.referenceImages.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {styleData.referenceImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-24 object-cover rounded-md border border-gray-200"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Upload reference images or add generated images to establish visual style. Use "AI Analyze Style" to automatically extract detailed style information from your references. These will be described in prompts for consistency.
            </p>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900">
              Additional Notes
            </label>
            <textarea
              value={styleData.additionalNotes}
              onChange={(e) => handleSectionChange("additionalNotes", e.target.value)}
              placeholder="Any additional style requirements or specific instructions..."
              className="w-full p-3 border border-gray-300 rounded-md min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              💡 <strong>Studio Mode:</strong> This comprehensive style guide will be compiled and used for all image and video generation. 
              Each section helps ensure visual consistency across your entire project.
            </p>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Style
            </button>
          </div>

          {/* Save Dialog */}
          {showSaveDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Save Style Guide</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">
                      Style Name
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Pixar Animation Style"
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowSaveDialog(false);
                        setTemplateName("");
                      }}
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate || !templateName.trim()}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {savingTemplate ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

