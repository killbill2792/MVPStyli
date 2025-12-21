-- ============================================
-- FIX POD DELETION AND IMAGE ISSUES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add deleted_at column to pods table for soft-delete tracking
ALTER TABLE public.pods 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pods_deleted_at ON public.pods(deleted_at);

-- 2. Update RLS policies to allow pod deletion by owner
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete their own pods" ON public.pods;
DROP POLICY IF EXISTS "pod_deletion_policy" ON public.pods;

-- Create policy that allows owners to delete their pods
CREATE POLICY "pod_deletion_policy" ON public.pods
  FOR DELETE
  USING (auth.uid()::text = owner_id);

-- 3. Clean up any pods that should have been deleted but weren't
-- This will help identify orphaned pods
-- (Run this manually if needed, don't auto-delete)

-- 4. Add a function to check for Replicate URLs in try_on_history
-- This helps identify which try-ons need image migration
CREATE OR REPLACE FUNCTION check_replicate_urls()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  result_url TEXT,
  is_replicate BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.result_url,
    (t.result_url LIKE '%replicate.delivery%' OR t.result_url LIKE '%replicate.com%') as is_replicate,
    t.created_at
  FROM public.try_on_history t
  WHERE t.result_url IS NOT NULL
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION check_replicate_urls() TO authenticated;
GRANT EXECUTE ON FUNCTION check_replicate_urls() TO anon;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check for pods that might be orphaned (no image_url or broken URLs)
-- SELECT id, owner_id, title, image_url, status, created_at 
-- FROM public.pods 
-- WHERE image_url IS NULL OR image_url = '' OR image_url NOT LIKE 'http%'
-- ORDER BY created_at DESC;

-- Check for try-ons with Replicate URLs
-- SELECT * FROM check_replicate_urls() WHERE is_replicate = true;

