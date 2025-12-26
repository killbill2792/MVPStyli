-- Complete Migration: Circumference-Only Measurements in Inches
-- This script handles both scenarios:
-- 1. If garment_sizes table doesn't exist, creates it with correct columns
-- 2. If it exists with old columns, adds new columns and migrates data
-- 3. Ensures all measurements are stored as circumference in inches

-- ============================================
-- PART 1: Create garment_sizes table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS garment_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  size_label TEXT NOT NULL, -- S, M, L, XL, etc.
  
  -- Circumference measurements (in inches)
  chest_circumference DECIMAL(6,2), -- Chest circumference in inches
  waist_circumference DECIMAL(6,2), -- Waist circumference in inches
  hip_circumference DECIMAL(6,2), -- Hip circumference in inches
  garment_length_in DECIMAL(6,2), -- Total length in inches
  
  -- Upper body measurements (in inches)
  shoulder_width_in DECIMAL(6,2), -- Shoulder width in inches
  sleeve_length_in DECIMAL(6,2), -- Sleeve length in inches (only if sleeves exist)
  
  -- Lower body measurements (circumference and lengths in inches)
  inseam_in DECIMAL(6,2), -- Inseam in inches
  rise_in DECIMAL(6,2), -- Rise in inches (optional but recommended for jeans)
  thigh_circumference DECIMAL(6,2), -- Thigh circumference in inches
  leg_opening_circumference DECIMAL(6,2), -- Leg opening circumference in inches
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(garment_id, size_label)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_garment_sizes_garment_id ON garment_sizes(garment_id);
CREATE INDEX IF NOT EXISTS idx_garment_sizes_size_label ON garment_sizes(size_label);

-- ============================================
-- PART 2: Add new columns if table exists with old schema
-- ============================================
ALTER TABLE garment_sizes 
  ADD COLUMN IF NOT EXISTS chest_circumference DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS waist_circumference DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS hip_circumference DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS garment_length_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS shoulder_width_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS sleeve_length_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS inseam_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS rise_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS thigh_circumference DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS leg_opening_circumference DECIMAL(6,2);

-- ============================================
-- PART 3: Migrate existing data from old columns to new columns
-- ============================================
-- Only migrate if old columns have data and new columns are null
UPDATE garment_sizes
SET 
  chest_circumference = CASE 
    WHEN chest_width IS NOT NULL AND chest_circumference IS NULL 
    THEN (chest_width * 2) / 2.54  -- Convert flat cm to circumference inches
    ELSE chest_circumference 
  END,
  waist_circumference = CASE 
    WHEN waist_width IS NOT NULL AND waist_circumference IS NULL 
    THEN (waist_width * 2) / 2.54 
    ELSE waist_circumference 
  END,
  hip_circumference = CASE 
    WHEN hip_width IS NOT NULL AND hip_circumference IS NULL 
    THEN (hip_width * 2) / 2.54 
    ELSE hip_circumference 
  END,
  garment_length_in = CASE 
    WHEN garment_length IS NOT NULL AND garment_length_in IS NULL 
    THEN garment_length / 2.54  -- Convert cm to inches
    ELSE garment_length_in 
  END,
  shoulder_width_in = CASE 
    WHEN shoulder_width IS NOT NULL AND shoulder_width_in IS NULL 
    THEN shoulder_width / 2.54 
    ELSE shoulder_width_in 
  END,
  sleeve_length_in = CASE 
    WHEN sleeve_length IS NOT NULL AND sleeve_length_in IS NULL 
    THEN sleeve_length / 2.54 
    ELSE sleeve_length_in 
  END,
  inseam_in = CASE 
    WHEN inseam IS NOT NULL AND inseam_in IS NULL 
    THEN inseam / 2.54 
    ELSE inseam_in 
  END,
  rise_in = CASE 
    WHEN rise IS NOT NULL AND rise_in IS NULL 
    THEN rise / 2.54 
    ELSE rise_in 
  END,
  thigh_circumference = CASE 
    WHEN thigh_width IS NOT NULL AND thigh_circumference IS NULL 
    THEN (thigh_width * 2) / 2.54 
    ELSE thigh_circumference 
  END,
  leg_opening_circumference = CASE 
    WHEN leg_opening IS NOT NULL AND leg_opening_circumference IS NULL 
    THEN (leg_opening * 2) / 2.54 
    ELSE leg_opening_circumference 
  END
WHERE 
  (chest_width IS NOT NULL OR waist_width IS NOT NULL OR hip_width IS NOT NULL OR
   garment_length IS NOT NULL OR shoulder_width IS NOT NULL OR sleeve_length IS NOT NULL OR
   inseam IS NOT NULL OR rise IS NOT NULL OR thigh_width IS NOT NULL OR leg_opening IS NOT NULL)
  AND
  (chest_circumference IS NULL OR waist_circumference IS NULL OR hip_circumference IS NULL OR
   garment_length_in IS NULL OR shoulder_width_in IS NULL OR sleeve_length_in IS NULL OR
   inseam_in IS NULL OR rise_in IS NULL OR thigh_circumference IS NULL OR leg_opening_circumference IS NULL);

-- ============================================
-- PART 4: Enable RLS and create policies
-- ============================================
ALTER TABLE garment_sizes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role full access sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow all users to read garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to insert garment sizes" ON garment_sizes;

-- Service role full access
CREATE POLICY "Service role full access sizes" ON garment_sizes
  FOR ALL USING (auth.role() = 'service_role');

-- Anon role full access (for API)
CREATE POLICY "Anon role full access sizes" ON garment_sizes
  FOR ALL USING (auth.role() = 'anon');

-- Allow all authenticated users to read
CREATE POLICY "Allow all users to read garment sizes" ON garment_sizes
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert garment sizes" ON garment_sizes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- ============================================
-- PART 5: Create function for updated_at trigger (if it doesn't exist)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 6: Create trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_garment_sizes_updated_at ON garment_sizes;

CREATE TRIGGER update_garment_sizes_updated_at
  BEFORE UPDATE ON garment_sizes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 7: Verify migration (optional - can be run separately)
-- ============================================
-- Uncomment to check migration results:
-- SELECT 
--   size_label,
--   chest_circumference,
--   waist_circumference,
--   hip_circumference,
--   garment_length_in
-- FROM garment_sizes
-- LIMIT 10;

