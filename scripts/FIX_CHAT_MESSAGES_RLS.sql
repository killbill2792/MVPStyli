-- Fix RLS policies for chat_messages to allow products JSONB to be saved
-- Run this in Supabase SQL Editor

-- First, check current policies
SELECT tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'chat_messages';

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can read own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public insert messages" ON public.chat_messages;

-- Create permissive policies for MVP (allow all operations)
CREATE POLICY "Anyone can read messages" ON public.chat_messages
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert messages" ON public.chat_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update messages" ON public.chat_messages
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete messages" ON public.chat_messages
    FOR DELETE USING (true);

-- Verify the products column exists and is JSONB
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'chat_messages'
    AND column_name = 'products';

-- Test insert with products (this should work after running the policies above)
-- You can run this manually to test:
/*
INSERT INTO public.chat_messages (conversation_id, type, message, products)
VALUES (
    'test-conv-id',
    'ai',
    'Test message',
    '[{"id": "test1", "name": "Test Product", "image": "https://example.com/image.jpg"}]'::jsonb
);
*/

