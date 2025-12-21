-- Cleanup empty "New Chat" conversations that have no messages or only have default messages
-- Run this in Supabase SQL Editor

-- Delete conversations with title "New Chat" that have no messages
DELETE FROM public.chat_conversations 
WHERE title = 'New Chat' 
AND id NOT IN (
  SELECT DISTINCT conversation_id 
  FROM public.chat_messages 
  WHERE type = 'user'
);

-- Also delete any orphaned messages (messages without a valid conversation)
DELETE FROM public.chat_messages 
WHERE conversation_id NOT IN (
  SELECT id FROM public.chat_conversations
);

-- Show remaining conversations
SELECT id, title, created_at, updated_at 
FROM public.chat_conversations 
ORDER BY updated_at DESC;

