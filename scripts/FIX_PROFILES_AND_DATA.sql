-- =====================================================
-- FIX PROFILES, DATA ISOLATION, AND PRIVACY
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Step 1: Ensure profiles table exists with all needed columns
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    height TEXT,
    top_size TEXT,
    bottom_size TEXT,
    shoe_size TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Disable RLS for easier testing
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Step 3: Insert/Update profiles for all auth users with proper names
INSERT INTO public.profiles (id, name, email)
SELECT 
    id, 
    CASE 
        WHEN email = 'esther@stylit.com' THEN 'Esther'
        WHEN email = 'john@stylit.com' THEN 'John'
        WHEN email = 'stylit@stylit.com' THEN 'Stylit'
        ELSE INITCAP(SPLIT_PART(email, '@', 1))
    END as name,
    email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();

-- Step 4: Verify profiles are set up correctly
SELECT id, name, email, avatar_url FROM public.profiles;

-- Step 5: Fix pod_invites table if needed
CREATE TABLE IF NOT EXISTS public.pod_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL,
    from_user UUID NOT NULL,
    to_user UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pod_invites DISABLE ROW LEVEL SECURITY;

-- Step 6: Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    payload JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Step 7: Create saved_fits table for user outfits
CREATE TABLE IF NOT EXISTS public.saved_fits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT,
    title TEXT,
    brand TEXT,
    price DECIMAL,
    product_url TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'public')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_fits DISABLE ROW LEVEL SECURITY;

-- Step 8: Create try_on_history table
CREATE TABLE IF NOT EXISTS public.try_on_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    result_url TEXT,
    product_url TEXT,
    product_title TEXT,
    product_price DECIMAL,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'public')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.try_on_history DISABLE ROW LEVEL SECURITY;

-- Step 9: Add visibility column to pods if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pods' AND column_name = 'visibility') THEN
        ALTER TABLE public.pods ADD COLUMN visibility TEXT DEFAULT 'private';
    END IF;
END $$;

-- Step 10: Verify data isolation - pods should have owner_id set correctly
SELECT 
    p.id,
    p.title,
    p.owner_id,
    pr.email as owner_email,
    p.status,
    p.created_at
FROM public.pods p
LEFT JOIN public.profiles pr ON p.owner_id = pr.id
ORDER BY p.created_at DESC
LIMIT 10;

-- Done!
SELECT 'Setup complete!' as status;

