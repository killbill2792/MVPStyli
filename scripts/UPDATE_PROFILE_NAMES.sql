-- =====================================================
-- UPDATE PROFILE NAMES FOR ESTHER AND JOHN
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, ensure the profiles table exists and has the right columns
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

-- Disable RLS for easier access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Update or insert profile for Esther
INSERT INTO public.profiles (id, name, email)
SELECT id, 'Esther', 'esther@stylit.com'
FROM auth.users WHERE email = 'esther@stylit.com'
ON CONFLICT (id) DO UPDATE SET name = 'Esther', email = 'esther@stylit.com';

-- Update or insert profile for John
INSERT INTO public.profiles (id, name, email)
SELECT id, 'John', 'john@stylit.com'
FROM auth.users WHERE email = 'john@stylit.com'
ON CONFLICT (id) DO UPDATE SET name = 'John', email = 'john@stylit.com';

-- Update or insert profile for Stylit
INSERT INTO public.profiles (id, name, email)
SELECT id, 'Stylit', 'stylit@stylit.com'
FROM auth.users WHERE email = 'stylit@stylit.com'
ON CONFLICT (id) DO UPDATE SET name = 'Stylit', email = 'stylit@stylit.com';

-- Verify the profiles
SELECT id, name, email FROM public.profiles;





