-- Check if products are being saved correctly in chat messages
-- Run this in Supabase SQL Editor to debug

-- Show all messages with products
SELECT 
  id,
  conversation_id,
  type,
  message,
  CASE 
    WHEN products IS NULL THEN 'NULL'
    WHEN jsonb_typeof(products) = 'array' THEN 'ARRAY (' || jsonb_array_length(products) || ' items)'
    WHEN jsonb_typeof(products) = 'object' THEN 'OBJECT'
    ELSE 'UNKNOWN: ' || jsonb_typeof(products)
  END as products_type,
  products
FROM public.chat_messages
WHERE products IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Show a sample product structure
SELECT 
  id,
  type,
  message,
  products->0 as first_product,
  jsonb_array_length(products) as product_count
FROM public.chat_messages
WHERE products IS NOT NULL 
  AND jsonb_typeof(products) = 'array'
  AND jsonb_array_length(products) > 0
ORDER BY created_at DESC
LIMIT 5;

