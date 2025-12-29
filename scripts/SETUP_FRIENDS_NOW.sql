-- =====================================================
-- SETUP FRIENDS TABLE AND ADD ESTHER & JOHN TO STYLIT
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Step 1: Create the friends table
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    friend_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Step 2: Disable RLS for easier testing (you can enable later)
ALTER TABLE public.friends DISABLE ROW LEVEL SECURITY;

-- Step 3: Add Esther and John to Stylit's friends list
-- This finds the user IDs automatically and creates bidirectional friendships

DO $$
DECLARE
    stylit_id UUID;
    esther_id UUID;
    john_id UUID;
BEGIN
    -- Get Stylit's user ID
    SELECT id INTO stylit_id FROM auth.users WHERE email = 'stylit@stylit.com' LIMIT 1;
    
    -- Get Esther's user ID
    SELECT id INTO esther_id FROM auth.users WHERE email = 'esther@stylit.com' LIMIT 1;
    
    -- Get John's user ID
    SELECT id INTO john_id FROM auth.users WHERE email = 'john@stylit.com' LIMIT 1;
    
    -- Show what we found
    RAISE NOTICE 'Stylit ID: %', stylit_id;
    RAISE NOTICE 'Esther ID: %', esther_id;
    RAISE NOTICE 'John ID: %', john_id;
    
    -- Add Stylit <-> Esther friendship (both directions)
    IF stylit_id IS NOT NULL AND esther_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, esther_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (esther_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        
        RAISE NOTICE 'Added Stylit <-> Esther friendship';
    ELSE
        RAISE NOTICE 'Could not add Esther friendship - missing user';
    END IF;
    
    -- Add Stylit <-> John friendship (both directions)
    IF stylit_id IS NOT NULL AND john_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, john_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (john_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        
        RAISE NOTICE 'Added Stylit <-> John friendship';
    ELSE
        RAISE NOTICE 'Could not add John friendship - missing user';
    END IF;
END $$;

-- Step 4: Verify the friendships were created
SELECT 
    f.id,
    u1.email as user_email,
    u2.email as friend_email,
    f.status,
    f.created_at
FROM public.friends f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
WHERE u1.email = 'stylit@stylit.com' OR u2.email = 'stylit@stylit.com';

-- Done! You should see the friendships listed above.






