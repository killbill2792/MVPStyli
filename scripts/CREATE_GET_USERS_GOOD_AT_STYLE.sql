-- Function to find users who are good at a specific style (based on pod's style)
-- This is used for Style Twins tab - finds users whose style profiles match the pod's style
-- Style Twins = people who are good at this style, not people like me
CREATE OR REPLACE FUNCTION public.get_users_good_at_style(
    pod_tags TEXT[],
    pod_colors TEXT[],
    pod_category TEXT
)
RETURNS TABLE (
    user_id UUID,
    match_score INTEGER,
    name TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        prof.id as user_id,
        (
            -- Tags match: 40% weight
            (CASE 
                WHEN pod_tags IS NOT NULL AND array_length(pod_tags, 1) > 0 THEN
                    (SELECT COUNT(*)::float / GREATEST(1, array_length(pod_tags, 1))
                     FROM unnest(pod_tags) pt
                     WHERE pt = ANY(usp.top_style_tags)) * 40
                ELSE 0 
            END)
            +
            -- Colors match: 30% weight
            (CASE 
                WHEN pod_colors IS NOT NULL AND array_length(pod_colors, 1) > 0 THEN
                    (SELECT COUNT(*)::float / GREATEST(1, array_length(pod_colors, 1))
                     FROM unnest(pod_colors) pc
                     WHERE pc = ANY(usp.top_colors)) * 30
                ELSE 0 
            END)
            +
            -- Category match: 30% weight
            (CASE 
                WHEN pod_category IS NOT NULL AND pod_category = ANY(usp.top_categories) THEN 30
                ELSE 0 
            END)
        )::INTEGER as match_score,
        prof.name,
        prof.avatar_url
    FROM public.user_style_profile usp
    JOIN public.profiles prof ON usp.user_id = prof.id
    WHERE (
        -- Must have at least one match
        (pod_tags IS NOT NULL AND array_length(pod_tags, 1) > 0 AND 
         EXISTS (SELECT 1 FROM unnest(pod_tags) pt WHERE pt = ANY(usp.top_style_tags)))
        OR
        (pod_colors IS NOT NULL AND array_length(pod_colors, 1) > 0 AND 
         EXISTS (SELECT 1 FROM unnest(pod_colors) pc WHERE pc = ANY(usp.top_colors)))
        OR
        (pod_category IS NOT NULL AND pod_category = ANY(usp.top_categories))
    )
    ORDER BY match_score DESC
    LIMIT 50; -- Get more users to ensure we have enough pods
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
