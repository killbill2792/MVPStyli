-- =====================================================
-- FIX GET_STYLE_TWINS SQL ERROR
-- Fixes "missing FROM-clause entry for table 'p'" error
-- IMPORTANT: Run this in Supabase SQL Editor to fix the function
-- =====================================================

-- Drop existing function completely
DROP FUNCTION IF EXISTS public.get_style_twins(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_style_twins(target_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    match_score INTEGER,
    name TEXT,
    avatar_url TEXT,
    top_tags TEXT[]
) AS $$
DECLARE
    my_tags TEXT[];
    my_colors TEXT[];
    my_categories TEXT[];
BEGIN
    -- Get current user's profile
    SELECT top_style_tags, top_colors, top_categories 
    INTO my_tags, my_colors, my_categories
    FROM public.user_style_profile
    WHERE public.user_style_profile.user_id = target_user_id;

    -- If no profile, return empty
    IF my_tags IS NULL THEN 
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        prof.id as user_id,  -- FIX: Changed from p.id to prof.id (prof is the profiles table alias)
        (
            -- Jaccard-ish similarity
            -- Tags weight: 40
            (CASE WHEN array_length(usp.top_style_tags, 1) > 0 THEN 
                (SELECT COUNT(*) FROM unnest(usp.top_style_tags) t WHERE t = ANY(my_tags))::float / 
                GREATEST(1, array_length(usp.top_style_tags, 1) + array_length(my_tags, 1) - (SELECT COUNT(*) FROM unnest(usp.top_style_tags) t WHERE t = ANY(my_tags))) 
            ELSE 0 END * 40)
            +
            -- Colors weight: 30
            (CASE WHEN array_length(usp.top_colors, 1) > 0 THEN 
                (SELECT COUNT(*) FROM unnest(usp.top_colors) c WHERE c = ANY(my_colors))::float / 
                GREATEST(1, array_length(usp.top_colors, 1) + array_length(my_colors, 1) - (SELECT COUNT(*) FROM unnest(usp.top_colors) c WHERE c = ANY(my_colors)))
            ELSE 0 END * 30)
            +
            -- Categories weight: 30
            (CASE WHEN array_length(usp.top_categories, 1) > 0 THEN 
                (SELECT COUNT(*) FROM unnest(usp.top_categories) k WHERE k = ANY(my_categories))::float / 
                GREATEST(1, array_length(usp.top_categories, 1) + array_length(my_categories, 1) - (SELECT COUNT(*) FROM unnest(usp.top_categories) k WHERE k = ANY(my_categories)))
            ELSE 0 END * 30)
        )::INTEGER as match_score,
        prof.name,
        prof.avatar_url,
        usp.top_style_tags as top_tags
    FROM public.user_style_profile usp
    JOIN public.profiles prof ON usp.user_id = prof.id
    WHERE usp.user_id != target_user_id
    ORDER BY match_score DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

