-- Add skin tone analysis columns to profiles table
-- Run this in Supabase SQL Editor

-- Add confidence and skinHex columns for skin tone analysis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skin_tone_confidence DECIMAL(3,2); -- 0.00 to 1.00
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skin_hex TEXT; -- Hex color of detected skin tone

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('skin_tone_confidence', 'skin_hex', 'color_tone', 'color_depth', 'color_season');

SELECT 'Skin tone columns added successfully!' as status;

