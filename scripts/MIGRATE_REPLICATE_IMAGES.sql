-- ============================================
-- MIGRATE REPLICATE IMAGES TO PERMANENT STORAGE
-- This script identifies try-ons with Replicate URLs that need migration
-- Run this in Supabase SQL Editor to see which try-ons need fixing
-- ============================================

-- Find all try-ons with Replicate URLs
SELECT 
  id,
  user_id,
  result_url,
  product_name,
  created_at,
  CASE 
    WHEN result_url LIKE '%replicate.delivery%' THEN 'replicate.delivery'
    WHEN result_url LIKE '%replicate.com%' THEN 'replicate.com'
    ELSE 'other'
  END as url_type
FROM public.try_on_history
WHERE result_url LIKE '%replicate.delivery%' 
   OR result_url LIKE '%replicate.com%'
ORDER BY created_at DESC;

-- Count by type
SELECT 
  CASE 
    WHEN result_url LIKE '%replicate.delivery%' THEN 'replicate.delivery'
    WHEN result_url LIKE '%replicate.com%' THEN 'replicate.com'
    ELSE 'permanent'
  END as url_type,
  COUNT(*) as count
FROM public.try_on_history
WHERE result_url IS NOT NULL
GROUP BY url_type;

-- ============================================
-- NOTE: Actual migration must be done via API
-- The uploadRemoteImage function in lib/upload.ts
-- should be called for each Replicate URL to
-- upload them to Supabase Storage
-- ============================================

