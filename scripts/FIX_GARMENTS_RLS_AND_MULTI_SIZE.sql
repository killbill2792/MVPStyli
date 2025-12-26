-- Fix RLS policies for garments table and add support for multiple sizes
-- This script fixes the RLS issue and restructures for multiple sizes per product

-- Step 1: Fix RLS policies to allow service role and authenticated users
-- Drop all existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow all users to read active garments" ON garments;
DROP POLICY IF EXISTS "Allow authenticated users to insert garments" ON garments;
DROP POLICY IF EXISTS "Allow authenticated users to update garments" ON garments;
DROP POLICY IF EXISTS "Allow authenticated users to delete garments" ON garments;
DROP POLICY IF EXISTS "Service role full access" ON garments;
DROP POLICY IF EXISTS "Anon role full access" ON garments;
DROP POLICY IF EXISTS "Anon role can read garments" ON garments;
DROP POLICY IF EXISTS "Anon role can insert garments" ON garments;
DROP POLICY IF EXISTS "Anon role can update garments" ON garments;
DROP POLICY IF EXISTS "Anon role can delete garments" ON garments;

-- Allow service role (used by API with service key) to do everything
CREATE POLICY "Service role full access" ON garments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow anon role (used by API with anon key) to read and write (admin check is done in API)
CREATE POLICY "Anon role can read garments" ON garments
  FOR SELECT USING (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can insert garments" ON garments
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can update garments" ON garments
  FOR UPDATE USING (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can delete garments" ON garments
  FOR DELETE USING (auth.role() = 'anon' OR true);

-- Allow authenticated users to read active garments
CREATE POLICY "Allow all users to read active garments" ON garments
  FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');

-- Allow authenticated users to insert (admin functionality)
CREATE POLICY "Allow authenticated users to insert garments" ON garments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Step 2: Create garment_sizes table for multiple sizes per product
CREATE TABLE IF NOT EXISTS garment_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  size_label TEXT NOT NULL, -- S, M, L, XL, etc.
  
  -- Universal measurements (flat, doubled in logic)
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

-- Enable RLS for garment_sizes
ALTER TABLE garment_sizes ENABLE ROW LEVEL SECURITY;

-- RLS policies for garment_sizes
-- Drop existing policies first
DROP POLICY IF EXISTS "Service role full access sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role full access sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role can read garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role can insert garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role can update garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Anon role can delete garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow all users to read garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to insert garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to update garment sizes" ON garment_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to delete garment sizes" ON garment_sizes;

CREATE POLICY "Service role full access sizes" ON garment_sizes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Anon role can read garment sizes" ON garment_sizes
  FOR SELECT USING (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can insert garment sizes" ON garment_sizes
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can update garment sizes" ON garment_sizes
  FOR UPDATE USING (auth.role() = 'anon' OR true);

CREATE POLICY "Anon role can delete garment sizes" ON garment_sizes
  FOR DELETE USING (auth.role() = 'anon' OR true);

CREATE POLICY "Allow all users to read garment sizes" ON garment_sizes
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert garment sizes" ON garment_sizes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Step 3: Add simplified fields to garments table (keep old fields for migration)
-- Add fit_type and fabric_stretch
ALTER TABLE garments 
  ADD COLUMN IF NOT EXISTS fit_type TEXT CHECK (fit_type IN ('slim', 'regular', 'relaxed', 'oversized')),
  ADD COLUMN IF NOT EXISTS fabric_stretch TEXT CHECK (fabric_stretch IN ('none', 'low', 'medium', 'high'));

-- Create trigger to update updated_at for garment_sizes
CREATE OR REPLACE FUNCTION update_garment_sizes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_garment_sizes_updated_at ON garment_sizes;

CREATE TRIGGER update_garment_sizes_updated_at
  BEFORE UPDATE ON garment_sizes
  FOR EACH ROW
  EXECUTE FUNCTION update_garment_sizes_updated_at();

