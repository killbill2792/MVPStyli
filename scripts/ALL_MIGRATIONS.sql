-- ============================================
-- ALL DATABASE MIGRATIONS
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Migration 1: Add product_url column to pods table
ALTER TABLE public.pods 
ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Migration 2: Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Create indexes for friends table
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

-- Enable Row Level Security
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friends table
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
CREATE POLICY "Users can view their own friendships" ON public.friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friends;
CREATE POLICY "Users can create friendships" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friends;
CREATE POLICY "Users can update their own friendships" ON public.friends
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Migration 3: Setup initial friendships (optional - can be done via app)
-- This will create friendships between stylit, esther, and john if they exist
DO $$
DECLARE
    stylit_id UUID;
    esther_id UUID;
    john_id UUID;
BEGIN
    -- Get user IDs from profiles
    SELECT id INTO stylit_id FROM public.profiles WHERE email = 'stylit@stylit.com' LIMIT 1;
    SELECT id INTO esther_id FROM public.profiles WHERE email = 'esther@stylit.com' LIMIT 1;
    SELECT id INTO john_id FROM public.profiles WHERE email = 'john@stylit.com' LIMIT 1;

    -- Create friendships if users exist and friendships don't already exist
    IF stylit_id IS NOT NULL AND esther_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, esther_id, 'accepted'), (esther_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
    END IF;

    IF stylit_id IS NOT NULL AND john_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, john_id, 'accepted'), (john_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
    END IF;
END $$;

-- Verify migrations
SELECT 'Migrations complete!' as status;
SELECT COUNT(*) as product_url_column_exists FROM information_schema.columns 
    WHERE table_name = 'pods' AND column_name = 'product_url';
SELECT COUNT(*) as friends_table_exists FROM information_schema.tables 
    WHERE table_name = 'friends';


