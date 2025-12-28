-- Add color_hex column to garments table
-- This stores the hex code of the product color picked from the image

ALTER TABLE garments 
ADD COLUMN IF NOT EXISTS color_hex TEXT;

-- Add comment
COMMENT ON COLUMN garments.color_hex IS 'Hex code of the product color (e.g., #FF5733) picked from the product image';

