-- =====================================================
-- STYLE ENGINE SETUP
-- Run this script to set up the Taste Fingerprint & Style Twins logic
-- =====================================================

-- 1. User Events Table
CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'tryon_success', 'product_view', 'vote_yes', 'vote_maybe', 'vote_no', 'save_fit', 'pod_resolved'
    product_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb, -- { tags: [], colors: [], category: "" }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own events" ON public.user_events;
CREATE POLICY "Users can insert own events" ON public.user_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own events" ON public.user_events;
CREATE POLICY "Users can read own events" ON public.user_events FOR SELECT USING (auth.uid() = user_id);

-- 2. User Style Profile Table
CREATE TABLE IF NOT EXISTS public.user_style_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    top_style_tags TEXT[],
    top_colors TEXT[],
    top_categories TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_style_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access profile" ON public.user_style_profile;
CREATE POLICY "Public read access profile" ON public.user_style_profile FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_style_profile;
CREATE POLICY "Users can update own profile" ON public.user_style_profile FOR UPDATE USING (auth.uid() = user_id);

-- 3. Function to Recalculate Style Profile
CREATE OR REPLACE FUNCTION public.recalculate_style_profile(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    tag_scores JSONB;
    color_scores JSONB;
    category_scores JSONB;
    
    -- Results
    final_tags TEXT[];
    final_colors TEXT[];
    final_categories TEXT[];
BEGIN
    -- Aggregate scores based on events in the last 30 days
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
    ),
    expanded_colors AS (
        SELECT 
            jsonb_array_elements_text(payload->'colors') as color,
            score
        FROM scores
        WHERE payload ? 'colors'
    ),
    expanded_categories AS (
        SELECT 
            payload->>'category' as category,
            score
        FROM scores
        WHERE payload->>'category' IS NOT NULL
    )
    
    -- Calculate top tags
    SELECT array_agg(tag ORDER BY total_score DESC) INTO final_tags
    FROM (
        SELECT tag, SUM(score) as total_score
        FROM expanded_tags
        GROUP BY tag
        HAVING SUM(score) > 0
        LIMIT 5
    ) t;
    
    -- Calculate top colors
    SELECT array_agg(color ORDER BY total_score DESC) INTO final_colors
    FROM (
        SELECT color, SUM(score) as total_score
        FROM expanded_colors
        GROUP BY color
        HAVING SUM(score) > 0
        LIMIT 5
    ) c;
    
    -- Calculate top categories
    SELECT array_agg(category ORDER BY total_score DESC) INTO final_categories
    FROM (
        SELECT category, SUM(score) as total_score
        FROM expanded_categories
        GROUP BY category
        HAVING SUM(score) > 0
        LIMIT 3
    ) cat;

    -- Update or Insert into profile
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

-- 4. Function to Find Style Twins
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
        p.id as user_id,
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
    AND (
        -- Match score calculation repeated for filtering > 0 (optimization)
        -- Just returning all for now, let frontend filter or limit
        true
    )
    ORDER BY match_score DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper to reset everything (for dev)
CREATE OR REPLACE FUNCTION public.reset_style_engine()
RETURNS VOID AS $$
BEGIN
    TRUNCATE public.user_events CASCADE;
    TRUNCATE public.user_style_profile CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ Style Engine Setup Complete' as status;

