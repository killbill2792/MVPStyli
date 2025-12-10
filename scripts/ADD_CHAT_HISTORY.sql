-- Add chat history table for persisting AI chat conversations

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('user', 'ai')),
    message TEXT,
    image_url TEXT,
    products JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
DROP POLICY IF EXISTS "Users can read own conversations" ON public.chat_conversations;
CREATE POLICY "Users can read own conversations" ON public.chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.chat_conversations;
CREATE POLICY "Users can insert own conversations" ON public.chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations" ON public.chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages (access via conversation ownership)
DROP POLICY IF EXISTS "Users can read own messages" ON public.chat_messages;
CREATE POLICY "Users can read own messages" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_conversations 
            WHERE id = chat_messages.conversation_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
CREATE POLICY "Users can insert own messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_conversations 
            WHERE id = chat_messages.conversation_id 
            AND user_id = auth.uid()
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at);

-- For non-logged in users or demo, allow public access (temporary for MVP)
DROP POLICY IF EXISTS "Public read conversations" ON public.chat_conversations;
CREATE POLICY "Public read conversations" ON public.chat_conversations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert conversations" ON public.chat_conversations;
CREATE POLICY "Public insert conversations" ON public.chat_conversations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update conversations" ON public.chat_conversations;
CREATE POLICY "Public update conversations" ON public.chat_conversations FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete conversations" ON public.chat_conversations;
CREATE POLICY "Public delete conversations" ON public.chat_conversations FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read messages" ON public.chat_messages;
CREATE POLICY "Public read messages" ON public.chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert messages" ON public.chat_messages;
CREATE POLICY "Public insert messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

