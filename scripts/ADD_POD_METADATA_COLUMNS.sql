-- =====================================================
-- ADD POD METADATA COLUMNS
-- Adds product_tags, product_colors, product_category to pods table
-- Also adds metadata JSONB column to pod_votes for multi-image selections
-- =====================================================

-- Add product metadata columns to pods table
ALTER TABLE public.pods 
ADD COLUMN IF NOT EXISTS product_tags TEXT[],
ADD COLUMN IF NOT EXISTS product_colors TEXT[],
ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Add metadata column to pod_votes for storing selected option in multi-image pods
ALTER TABLE public.pod_votes
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pods_product_category ON public.pods(product_category);
CREATE INDEX IF NOT EXISTS idx_pod_votes_metadata ON public.pod_votes USING GIN(metadata);

