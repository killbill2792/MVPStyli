-- Add face image and color profile columns to profiles table
-- Run this in Supabase SQL Editor

-- Add face_image_url column for storing user's face photo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS face_image_url TEXT;

-- Add body_image_url if not already added
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_image_url TEXT;

-- Add color profile columns for skin tone analysis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color_tone TEXT; -- 'warm', 'cool', 'neutral'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color_depth TEXT; -- 'light', 'medium', 'deep'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color_season TEXT; -- 'spring', 'summer', 'autumn', 'winter'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_colors TEXT[]; -- Array of colors that suit user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avoid_colors TEXT[]; -- Array of colors to avoid

-- Add body shape column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_shape TEXT; -- 'hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('face_image_url', 'body_image_url', 'color_tone', 'color_depth', 'color_season', 'best_colors', 'avoid_colors', 'body_shape');

SELECT 'Color profile columns added successfully!' as status;

