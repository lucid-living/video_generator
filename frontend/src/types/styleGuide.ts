/**
 * TypeScript types for comprehensive style guide system.
 */

export interface StyleGuideSection {
  id: string;
  title: string;
  content: string;
  referenceImages: string[]; // Base64 data URIs
}

export interface StyleGuide {
  name: string;
  version: string;
  
  // Core Style Sections
  animationStyle: StyleGuideSection;
  characterDesign: StyleGuideSection;
  colorPalette: StyleGuideSection;
  lighting: StyleGuideSection;
  cameraComposition: StyleGuideSection;
  texturesMaterials: StyleGuideSection;
  moodTone: StyleGuideSection;
  
  // Additional sections
  additionalNotes?: string;
  referenceFilms?: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface StyleGuideTemplate {
  id: string;
  name: string;
  description: string;
  styleGuide: StyleGuide;
  isDefault: boolean;
}


