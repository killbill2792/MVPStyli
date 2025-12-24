-- Create friends table for bidirectional friendships
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

-- Enable RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
CREATE POLICY "Users can view their own friendships" ON public.friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friends;
CREATE POLICY "Users can create friendships" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friends;
CREATE POLICY "Users can update their own friendships" ON public.friends
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Add foreign key constraint for friend_id to profiles (if profiles table exists)
-- This is optional, but helps with joins
-- ALTER TABLE public.friends 
--   ADD CONSTRAINT friends_friend_id_fkey 
--   FOREIGN KEY (friend_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



