-- Create style_guide_templates table for saving reusable style guides
CREATE TABLE IF NOT EXISTS style_guide_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  style_guide_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_style_guide_templates_name ON style_guide_templates(name);
CREATE INDEX IF NOT EXISTS idx_style_guide_templates_updated_at ON style_guide_templates(updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE style_guide_templates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
-- For now, allowing all authenticated users to read/write
CREATE POLICY "Allow all operations on style_guide_templates"
  ON style_guide_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);


