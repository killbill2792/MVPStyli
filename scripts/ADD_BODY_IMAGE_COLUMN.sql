-- Add body_image_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_image_url TEXT;

