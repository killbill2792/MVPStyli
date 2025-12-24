-- ============================================
-- FIX SAVED FITS TABLE
-- Run this in Supabase SQL Editor to fix saved fits persistence
-- ============================================

-- Drop and recreate the saved_fits table with proper structure
DROP TABLE IF EXISTS public.saved_fits CASCADE;

CREATE TABLE public.saved_fits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    title TEXT,
    price NUMERIC,
    product_url TEXT,
    visibility TEXT DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISABLE Row Level Security for simplicity (allow all operations)
ALTER TABLE public.saved_fits DISABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_saved_fits_user ON public.saved_fits(user_id);
CREATE INDEX idx_saved_fits_created ON public.saved_fits(created_at DESC);

-- Grant full access
GRANT ALL ON public.saved_fits TO anon;
GRANT ALL ON public.saved_fits TO authenticated;

-- ============================================
-- FIX TRY_ON_HISTORY TABLE
-- ============================================

DROP TABLE IF EXISTS public.try_on_history CASCADE;

CREATE TABLE public.try_on_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    result_url TEXT NOT NULL,
    product_image TEXT,
    product_name TEXT,
    product_url TEXT,
    visibility TEXT DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISABLE Row Level Security for simplicity
ALTER TABLE public.try_on_history DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_try_on_history_user ON public.try_on_history(user_id);
CREATE INDEX idx_try_on_history_created ON public.try_on_history(created_at DESC);

-- Grant full access
GRANT ALL ON public.try_on_history TO anon;
GRANT ALL ON public.try_on_history TO authenticated;

-- ============================================
-- VERIFY TABLES EXIST
-- ============================================
SELECT 'saved_fits' as table_name, count(*) as row_count FROM public.saved_fits
UNION ALL
SELECT 'try_on_history' as table_name, count(*) as row_count FROM public.try_on_history;


