-- =====================================================
-- UPDATE STYLE ALGO V3
-- Adds weighting for search_query and tryon_upload
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.recalculate_style_profile(UUID);

CREATE OR REPLACE FUNCTION public.recalculate_style_profile(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    final_tags TEXT[];
    final_colors TEXT[];
    final_categories TEXT[];
BEGIN
    -- -------------------------------------------------------
    -- 1. Calculate Top Tags
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success', 'tryon_attempt') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                WHEN event_type = 'search_query' THEN 2
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
    -- 2. Calculate Top Colors
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success', 'tryon_attempt') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                WHEN event_type = 'search_query' THEN 2
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
    -- 3. Calculate Top Categories
    -- -------------------------------------------------------
    WITH scores AS (
        SELECT
            CASE 
                WHEN event_type IN ('vote_yes', 'save_fit', 'tryon_success', 'tryon_attempt') THEN 3
                WHEN event_type = 'vote_maybe' THEN 1
                WHEN event_type = 'vote_no' THEN -2
                WHEN event_type = 'pod_resolved' THEN 5
                WHEN event_type = 'product_view' THEN 1
                WHEN event_type = 'search_query' THEN 2
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
        WHERE payload->>'category' IS NOT NULL AND payload->>'category' != 'other'
    )
    SELECT array_agg(category ORDER BY total_score DESC) INTO final_categories
    FROM (
        SELECT category, SUM(score) as total_score
        FROM expanded_categories
        GROUP BY category
        HAVING SUM(score) > 0
        LIMIT 5
    ) c;

    -- -------------------------------------------------------
    -- 4. Update Profile
    -- -------------------------------------------------------
    INSERT INTO public.user_style_profile (user_id, top_style_tags, top_colors, top_categories, updated_at)
    VALUES (
        target_user_id, 
        COALESCE(final_tags, '{}'), 
        COALESCE(final_colors, '{}'), 
        COALESCE(final_categories, '{}'), 
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

