/**
 * Reference Image Library Component
 * 
 * Allows users to upload and manage their own reference images that have worked well.
 * Supports:
 * - Uploading images from their computer
 * - Selecting from favorited/approved images
 * - Using multiple images as references (up to 14)
 * - Style extraction from images
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";
import { analyzeStyleFromImages } from "../services/api";
import type { ReferenceImage } from "../types/storyboard";

interface ReferenceImageLibraryProps {
  onSelectImages: (images: string[]) => void; // Callback with selected image base64/URLs
  selectedImages?: string[]; // Currently selected images
  maxSelections?: number; // Maximum number of images to select (default: 14)
  showStyleExtraction?: boolean; // Show option to extract style from images
  onStyleExtracted?: (styleGuide: string) => void; // Callback when style is extracted
}

export function ReferenceImageLibrary({
  onSelectImages,
  selectedImages = [],
  maxSelections = 14,
  showStyleExtraction = true,
  onStyleExtracted,
}: ReferenceImageLibraryProps) {
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; data: string; name: string }>>([]);
  const [favoritedImages, setFavoritedImages] = useState<Array<{ id: string; data: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [extractingStyle, setExtractingStyle] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "favorites" | "library">("upload");

  // Load favorited images from database
  useEffect(() => {
    loadFavoritedImages();
  }, []);

  const loadFavoritedImages = async () => {
    try {
      setLoading(true);
      // Fetch favorited images from API (which gets image data from workflows)
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE_URL}/api/learning/favorited-images?limit=50`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch favorited images: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        const favorites = data.map((item) => ({
          id: item.image_id,
          data: item.storage_url || item.base64_data || "", // Use storage URL if available, fallback to base64
          description: item.description || "Favorited image",
        }));
        setFavoritedImages(favorites);
      }
    } catch (error) {
      console.error("Failed to load favorited images:", error);
      // Don't show error to user - just disable favorites tab
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newImage = {
            id: `upload_${Date.now()}_${Math.random()}`,
            data: base64,
            name: file.name,
          };
          setUploadedImages((prev) => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleSelectImage = (imageData: string) => {
    if (selectedImages.includes(imageData)) {
      // Deselect
      onSelectImages(selectedImages.filter((img) => img !== imageData));
    } else {
      // Select (if under limit)
      if (selectedImages.length < maxSelections) {
        onSelectImages([...selectedImages, imageData]);
      } else {
        alert(`Maximum ${maxSelections} reference images allowed (Gemini API limit)`);
      }
    }
  };

  const handleExtractStyle = async () => {
    if (selectedImages.length === 0) {
      alert("Please select at least one image to extract style from");
      return;
    }

    setExtractingStyle(true);
    try {
      const styleResult = await analyzeStyleFromImages(selectedImages);
      
      // Compile style guide from analysis
      const styleGuide = [
        `ANIMATION STYLE:\n${styleResult.animationStyle}`,
        `CHARACTER DESIGN:\n${styleResult.characterDesign}`,
        `COLOR PALETTE:\n${styleResult.colorPalette}`,
        `LIGHTING:\n${styleResult.lighting}`,
        `CAMERA & COMPOSITION:\n${styleResult.cameraComposition}`,
        `TEXTURES & MATERIALS:\n${styleResult.texturesMaterials}`,
        `MOOD & TONE:\n${styleResult.moodTone}`,
        `REFERENCE FILMS: ${styleResult.referenceFilms}`,
        `ADDITIONAL NOTES:\n${styleResult.additionalNotes}`,
      ]
        .filter((section) => section.split("\n")[1]?.trim()) // Only include non-empty sections
        .join("\n\n");

      if (onStyleExtracted) {
        onStyleExtracted(styleGuide);
      }
      
      alert("Style extracted successfully! It has been added to your style guide.");
    } catch (error) {
      console.error("Failed to extract style:", error);
      alert(`Failed to extract style: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExtractingStyle(false);
    }
  };

  const allImages = [
    ...uploadedImages.map((img) => ({ id: img.id, data: img.data, source: "upload" as const })),
    ...favoritedImages.map((img) => ({ id: img.id, data: img.data, source: "favorite" as const })),
  ];

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Reference Image Library</h3>
        <div className="text-sm text-gray-500">
          {selectedImages.length} / {maxSelections} selected
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Upload your own images or select from favorites. Use multiple images (up to {maxSelections}) as direct references for better consistency.
        <br />
        <strong>Best Practice:</strong> Use 3-5 reference images showing similar style, characters, or scenes for best results.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "upload"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Upload New
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "favorites"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Favorites ({favoritedImages.length})
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900">
              Upload Reference Images
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Upload images that have worked well for you. These will be used as direct references.
            </p>
          </div>

          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {uploadedImages.map((img) => (
                <div
                  key={img.id}
                  className={`relative border-2 rounded-md overflow-hidden cursor-pointer transition-all ${
                    selectedImages.includes(img.data)
                      ? "border-blue-600 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => handleSelectImage(img.data)}
                >
                  <img
                    src={img.data}
                    alt={img.name}
                    className="w-full h-24 object-cover"
                  />
                  {selectedImages.includes(img.data) && (
                    <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <div>
          {favoritedImages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No favorited images yet.</p>
              <p className="text-sm mt-2">Favorite images you like to use them as references later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {favoritedImages.map((img) => (
                <div
                  key={img.id}
                  className={`relative border-2 rounded-md overflow-hidden cursor-pointer transition-all ${
                    selectedImages.includes(img.data)
                      ? "border-blue-600 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => handleSelectImage(img.data)}
                >
                  {img.data ? (
                    <>
                      <img
                        src={img.data}
                        alt={img.description}
                        className="w-full h-24 object-cover"
                      />
                      {selectedImages.includes(img.data) && (
                        <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                      {img.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Images Summary */}
      {selectedImages.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">
              Selected Images ({selectedImages.length})
            </span>
            {showStyleExtraction && (
              <button
                onClick={handleExtractStyle}
                disabled={extractingStyle}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {extractingStyle ? "Extracting..." : "🎨 Extract Style"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            These images will be used as direct references (img2img) for generation. 
            {showStyleExtraction && " Click 'Extract Style' to also enhance your style guide."}
          </p>
        </div>
      )}

      {/* Best Practices Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        <strong>💡 Best Approach (2024):</strong>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li><strong>Direct Image References (img2img):</strong> Most powerful - Gemini 3.0 Pro Image uses your images directly (up to 14)</li>
          <li><strong>Multiple Images:</strong> Use 3-5 images showing similar style/characters for best consistency</li>
          <li><strong>Hybrid Approach:</strong> Use images as references AND extract style to enhance prompts</li>
          <li><strong>Your Best Images:</strong> Upload images that worked well - the system learns from them</li>
        </ul>
      </div>
    </div>
  );
}
