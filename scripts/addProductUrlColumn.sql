-- Add product_url column to pods table
-- Run this in Supabase SQL Editor

ALTER TABLE public.pods 
ADD COLUMN IF NOT EXISTS product_url TEXT;





