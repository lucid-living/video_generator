# Pixar Lullaby Video Generator - User Guide

## Overview

This video generator is optimized for creating **Pixar-style animated lullaby videos** for children (ages 0-5) with Christian values, designed for a **3x per week production schedule** with **team collaboration** (you and your sister).

## Key Features for Your Use Case

### 1. **Pixar Lullaby Preset** 🎬
- **One-click style setup**: Click the "🎬 Pixar Lullaby" button in the Style Guide Builder
- **Pre-configured for your needs**:
  - Pixar-style 3D animation (Inside Out, Soul, Coco, Up, Toy Story)
  - Children's content safety guidelines (ages 0-5)
  - Christian values integration
  - Calming, sleep-inducing visuals for lullabies
  - Educational content guidelines for ages 2-5

### 2. **Children's Content Safety**
The system automatically detects children's content and enforces:
- **Age-appropriate visuals**: No scary, dark, or intense imagery
- **Calming elements**: Soft colors, gentle movements, peaceful landscapes
- **Lullaby optimization**: Stars, moons, clouds, bedtime themes
- **Educational focus**: Clear, simple visual storytelling for ages 2-5

### 3. **Christian Values Integration**
When Christian content is detected, the system:
- **Integrates biblical themes** naturally into lyrics and visuals
- **Focuses on positive values**: Love, kindness, forgiveness, gratitude, honesty
- **Uses age-appropriate stories**: Noah's Ark, Good Samaritan, etc.
- **Shows positive role models** demonstrating Christian character
- **Emphasizes community and fellowship** in visual storytelling

### 4. **Character Consistency**
- **Reuse favorited images**: Your best images are saved and can be used as references
- **Multiple reference images**: Use 3-5 images showing similar characters/styles
- **Direct image references (img2img)**: Gemini 3.0 Pro Image uses your images directly
- **Style extraction**: AI learns from your favorited images to enhance future prompts

### 5. **Team Collaboration**
- **Shared style guides**: Save and load style guide templates
- **Consistent brand**: Pixar Lullaby preset ensures both you and your sister use the same style
- **Workflow persistence**: All work is saved to Supabase, accessible by both team members

## Quick Start Workflow (3x Per Week)

### Step 1: Set Up Style Guide (One-Time or Per Project)
1. Click **"🎬 Pixar Lullaby"** button in Style Guide Builder
2. Review and customize the preset if needed
3. **Save as template** for quick reuse: Click "Save Style Guide" → Name it (e.g., "Main Channel Style")
4. **Upload your best images**: Add reference images that have worked well

### Step 2: Create New Video
1. **Enter theme**: E.g., "Bedtime prayer", "Sharing toys", "Being kind to animals"
2. **Load saved style**: Click "Load Saved Style" → Select your template
3. **Generate storyboard**: The system will create lyrics and shots with Christian values integrated
4. **Review and edit**: Adjust durations, prompts, or lyrics as needed

### Step 3: Generate Assets
1. **Generate reference images**: 
   - Select your favorited images from previous videos
   - Upload new reference images if needed
   - Use 3-5 images for best character consistency
2. **Generate music**: Use Suno to create the lullaby track
3. **Review images**: Favorite the ones you like for future use

### Step 4: Generate Video
1. **Generate video clips**: System uses your reference images for consistency
2. **Assemble final video**: Automatic assembly with audio sync

## Best Practices for Consistency

### Character Consistency Across Videos
1. **Favorite your best images**: Click the ⭐ button on images you want to reuse
2. **Use multiple references**: Select 3-5 favorited images when generating new videos
3. **Maintain style guide**: Keep the same Pixar Lullaby style guide across all videos
4. **Reuse successful elements**: Characters, color schemes, and compositions that worked well

### Speed Up Production (3x Per Week)
1. **Save style guide templates**: Don't recreate the style guide each time
2. **Build a reference image library**: Favorite images from each video
3. **Reuse themes**: Similar themes can reuse similar reference images
4. **Batch similar videos**: Create multiple videos with similar themes in one session

### Team Collaboration
1. **Shared templates**: Both you and your sister can load the same style guide template
2. **Consistent naming**: Use clear names for saved templates (e.g., "Main Channel - Pixar Lullaby")
3. **Reference image sharing**: Favorited images are available to both team members
4. **Workflow tracking**: Each workflow is saved with a unique ID for easy reference

## Technical Details

### Pixar Style Detection
The system automatically detects when you're using Pixar style and enhances prompts with:
- Specific Pixar film references (Inside Out, Soul, Coco, etc.)
- 3D animation requirements (smooth forms, subsurface scattering, etc.)
- Character design guidelines (friendly, expressive, charming)
- Color and lighting specifications

### Children's Content Detection
Automatically detected when style guide contains:
- "children", "lullaby", "under 2", "under 5", "toddler", "baby"

### Christian Content Detection
Automatically detected when style guide contains:
- "christian", "biblical", "faith", "values"

### Image Learning System
- **Favorited images** are analyzed by AI to extract visual characteristics
- **Success patterns** are identified and used to enhance future prompts
- **Channel-specific learning**: Insights are filtered by channel name for brand consistency

## Troubleshooting

### Images Not Consistent?
- **Use more reference images**: Select 3-5 favorited images instead of 1-2
- **Check style guide**: Ensure Pixar Lullaby preset is loaded
- **Favorite successful images**: The system learns from your favorites

### Videos Taking Too Long?
- **Reuse style guides**: Don't recreate from scratch each time
- **Batch reference images**: Upload multiple images at once
- **Save workflows**: Don't lose progress if you need to pause

### Team Not Aligned?
- **Use shared templates**: Both team members load the same style guide template
- **Document preferences**: Add notes in the style guide's "Additional Notes" section
- **Review favorited images**: Check what images your team member has favorited

## Next Steps (Future Enhancements)

1. **Character Database**: Track recurring characters across videos
2. **Quick Video Templates**: Pre-made storyboard templates for common themes
3. **Batch Processing**: Generate multiple videos at once
4. **Analytics Integration**: Track which videos/images perform best
5. **Automated Scheduling**: Plan 3 videos per week with reminders
