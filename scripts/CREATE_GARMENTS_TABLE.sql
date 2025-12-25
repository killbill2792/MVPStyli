-- Create garments table for storing garment products with detailed measurements
-- Supports upper, lower, and dresses for both men and women

CREATE TABLE IF NOT EXISTS garments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Product classification
  category TEXT NOT NULL CHECK (category IN ('upper', 'lower', 'dresses')),
  gender TEXT CHECK (gender IN ('men', 'women', 'unisex')),
  
  -- Image storage (Supabase will store and provide URLs)
  image_url TEXT,
  additional_images TEXT[],
  
  -- Basic product info
  brand TEXT,
  price DECIMAL(10,2),
  material TEXT,
  color TEXT,
  size TEXT,
  product_link TEXT, -- Link to original product page
  measurement_unit TEXT DEFAULT 'cm' CHECK (measurement_unit IN ('cm', 'in')), -- Unit used for input (stored in cm)
  
  -- Upper body measurements (optional, not all garments have all measurements)
  chest DECIMAL(6,2), -- Chest circumference in cm
  waist DECIMAL(6,2), -- Waist circumference in cm
  hip DECIMAL(6,2), -- Hip circumference in cm
  front_length DECIMAL(6,2), -- Front length from shoulder to hem in cm
  back_length DECIMAL(6,2), -- Back length from neck to hem in cm
  sleeve_length DECIMAL(6,2), -- Sleeve length from shoulder to cuff in cm
  back_width DECIMAL(6,2), -- Back width across shoulders in cm
  arm_width DECIMAL(6,2), -- Arm width/bicep girth in cm
  shoulder_width DECIMAL(6,2), -- Shoulder width in cm
  collar_girth DECIMAL(6,2), -- Collar/neck circumference in cm
  cuff_girth DECIMAL(6,2), -- Cuff circumference in cm
  armscye_depth DECIMAL(6,2), -- Armhole depth in cm
  across_chest_width DECIMAL(6,2), -- Width across chest area in cm
  
  -- Lower body measurements
  front_rise DECIMAL(6,2), -- Front rise from waist to crotch in cm
  back_rise DECIMAL(6,2), -- Back rise from waist to crotch in cm
  inseam DECIMAL(6,2), -- Inseam from crotch to hem in cm
  outseam DECIMAL(6,2), -- Outseam from waist to hem in cm
  thigh_girth DECIMAL(6,2), -- Thigh circumference in cm
  knee_girth DECIMAL(6,2), -- Knee circumference in cm
  hem_girth DECIMAL(6,2), -- Bottom hem circumference in cm
  
  -- Dress-specific measurements
  side_neck_to_hem DECIMAL(6,2), -- Side neck to hem length in cm
  back_neck_to_hem DECIMAL(6,2), -- Back neck to hem length in cm
  
  -- Additional metadata
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_garments_category ON garments(category);
CREATE INDEX IF NOT EXISTS idx_garments_gender ON garments(gender);
CREATE INDEX IF NOT EXISTS idx_garments_brand ON garments(brand);
CREATE INDEX IF NOT EXISTS idx_garments_is_active ON garments(is_active);
CREATE INDEX IF NOT EXISTS idx_garments_created_at ON garments(created_at);

-- Enable Row Level Security
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all users to read active garments
CREATE POLICY "Allow all users to read active garments" ON garments
  FOR SELECT USING (is_active = true);

-- Policy: Allow authenticated users to insert garments (admin functionality)
CREATE POLICY "Allow authenticated users to insert garments" ON garments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to update garments (admin functionality)
CREATE POLICY "Allow authenticated users to update garments" ON garments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to delete garments (admin functionality)
CREATE POLICY "Allow authenticated users to delete garments" ON garments
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_garments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_garments_updated_at
  BEFORE UPDATE ON garments
  FOR EACH ROW
  EXECUTE FUNCTION update_garments_updated_at();

