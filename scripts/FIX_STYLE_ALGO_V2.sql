-- =====================================================
-- FIX STYLE ALGORITHM V2
-- Resolves "relation expanded_colors does not exist" and schema cache issues
-- =====================================================

-- 1. Reload Schema Cache (Fixes "Could not find table" errors)
NOTIFY pgrst, 'reload schema';

-- 2. Drop and Re-create the Recalculate Function with CORRECT SCOPING
DROP FUNCTION IF EXISTS public.recalculate_style_profile(UUID);

CREATE OR REPLACE FUNCTION public.recalculate_style_profile(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    final_tags TEXT[];
    final_colors TEXT[];
    final_categories TEXT[];
BEGIN
    -- -------------------------------------------------------
    -- 1. Calculate Top Tags (Independent Query)
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                ELSE 0
            END as score,
            payload
        FROM public.user_events
        WHERE user_id = target_user_id
          AND created_at > NOW() - INTERVAL '30 days'
    ),
    expanded_tags AS (
        SELECT 
            jsonb_array_elements_text(payload->'tags') as tag,
            score
        FROM scores
        WHERE payload ? 'tags'
    )
    SELECT array_agg(tag ORDER BY total_score DESC) INTO final_tags
    FROM (
        SELECT tag, SUM(score) as total_score
        FROM expanded_tags
        GROUP BY tag
        HAVING SUM(score) > 0
        LIMIT 5
    ) t;

    -- -------------------------------------------------------
    -- 2. Calculate Top Colors (Independent Query)
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                ELSE 0
            END as score,
            payload
        FROM public.user_events
        WHERE user_id = target_user_id
          AND created_at > NOW() - INTERVAL '30 days'
    ),
    expanded_colors AS (
        SELECT 
            jsonb_array_elements_text(payload->'colors') as color,
            score
        FROM scores
        WHERE payload ? 'colors'
    )
    SELECT array_agg(color ORDER BY total_score DESC) INTO final_colors
    FROM (
        SELECT color, SUM(score) as total_score
        FROM expanded_colors
        GROUP BY color
        HAVING SUM(score) > 0
        LIMIT 5
    ) c;

    -- -------------------------------------------------------
    -- 3. Calculate Top Categories (Independent Query)
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                ELSE 0
            END as score,
            payload
        FROM public.user_events
        WHERE user_id = target_user_id
          AND created_at > NOW() - INTERVAL '30 days'
    ),
    expanded_categories AS (
        SELECT 
            payload->>'category' as category,
            score
        FROM scores
        WHERE payload->>'category' IS NOT NULL
    )
    SELECT array_agg(category ORDER BY total_score DESC) INTO final_categories
    FROM (
        SELECT category, SUM(score) as total_score
        FROM expanded_categories
        GROUP BY category
        HAVING SUM(score) > 0
        LIMIT 3
    ) cat;

    -- -------------------------------------------------------
    -- 4. Update Profile
    -- -------------------------------------------------------
    INSERT INTO public.user_style_profile (user_id, top_style_tags, top_colors, top_categories, updated_at)
    VALUES (
        target_user_id,
        COALESCE(final_tags, ARRAY[]::TEXT[]),
        COALESCE(final_colors, ARRAY[]::TEXT[]),
        COALESCE(final_categories, ARRAY[]::TEXT[]),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        top_style_tags = EXCLUDED.top_style_tags,
        top_colors = EXCLUDED.top_colors,
        top_categories = EXCLUDED.top_categories,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'tags', final_tags,
        'colors', final_colors,
        'categories', final_categories
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ Style Algo Fixed & Schema Reloaded' as status;

