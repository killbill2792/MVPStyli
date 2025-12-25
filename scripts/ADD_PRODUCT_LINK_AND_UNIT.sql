-- Migration to add product_link and measurement_unit to existing garments table

-- Add product_link column
ALTER TABLE garments 
ADD COLUMN IF NOT EXISTS product_link TEXT;

-- Add measurement_unit column (defaults to 'cm')
ALTER TABLE garments 
ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'cm' CHECK (measurement_unit IN ('cm', 'in'));

-- Update existing records to have 'cm' as default
UPDATE garments 
SET measurement_unit = 'cm' 
WHERE measurement_unit IS NULL;

