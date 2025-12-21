-- Add product_data JSONB column to saved_fits table
-- Run this in Supabase SQL Editor

-- Check if column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saved_fits' 
        AND column_name = 'product_data'
    ) THEN
        -- Add product_data column as JSONB
        ALTER TABLE public.saved_fits 
        ADD COLUMN product_data JSONB;
        
        RAISE NOTICE 'Added product_data column to saved_fits';
    ELSE
        RAISE NOTICE 'product_data column already exists';
    END IF;
END $$;

-- Verify the column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'saved_fits' 
AND column_name = 'product_data';

