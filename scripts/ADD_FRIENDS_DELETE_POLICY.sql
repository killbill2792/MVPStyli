-- Add DELETE policy for friends table
-- This allows users to delete their own friendships
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friends;
CREATE POLICY "Users can delete their own friendships" ON public.friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);
