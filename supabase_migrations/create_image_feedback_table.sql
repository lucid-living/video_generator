-- Create image_feedback table for tracking user preferences and learning from approved images
CREATE TABLE IF NOT EXISTS image_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  
  -- User feedback
  approved BOOLEAN DEFAULT FALSE,
  favorited BOOLEAN DEFAULT FALSE,  -- Beyond approval - user's favorite images
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- Optional 1-5 star rating
  
  -- Image metadata for learning
  description TEXT NOT NULL,
  style_guide TEXT,  -- Style guide used when generating
  prompt_used TEXT,  -- Full prompt that generated this image
  shot_indices INTEGER[],  -- Which shots this image applies to
  
  -- Analysis results (populated by AI analysis)
  visual_characteristics JSONB,  -- Extracted visual features (colors, composition, style, etc.)
  success_factors JSONB,  -- What made this image successful (AI analysis)
  
  -- Context
  channel_name TEXT,  -- Channel this was generated for
  content_type TEXT,  -- Type of content
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_image_feedback_image_id ON image_feedback(image_id);
CREATE INDEX IF NOT EXISTS idx_image_feedback_workflow_id ON image_feedback(workflow_id);
CREATE INDEX IF NOT EXISTS idx_image_feedback_approved ON image_feedback(approved) WHERE approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_image_feedback_favorited ON image_feedback(favorited) WHERE favorited = TRUE;
CREATE INDEX IF NOT EXISTS idx_image_feedback_channel_name ON image_feedback(channel_name);
CREATE INDEX IF NOT EXISTS idx_image_feedback_created_at ON image_feedback(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE image_feedback ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on image_feedback"
  ON image_feedback
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create a view for learning patterns (approved/favorited images)
CREATE OR REPLACE VIEW image_learning_patterns AS
SELECT 
  channel_name,
  content_type,
  jsonb_object_agg(
    key, 
    value
  ) FILTER (WHERE key IS NOT NULL) as common_characteristics,
  COUNT(*) as approval_count
FROM (
  SELECT 
    channel_name,
    content_type,
    jsonb_object_keys(visual_characteristics) as key,
    jsonb_object_values(visual_characteristics) as value
  FROM image_feedback
  WHERE approved = TRUE OR favorited = TRUE
) subquery
GROUP BY channel_name, content_type;
