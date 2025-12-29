-- SQL script to activate users and create demo data
-- Run this in Supabase SQL Editor

-- Activate existing user (stylit@stylit.com)
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    confirmed_at = NOW()
WHERE email = 'stylit@stylit.com';

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    gender TEXT,
    location TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_fits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.saved_fits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    title TEXT NOT NULL,
    brand TEXT,
    price DECIMAL(10,2),
    url TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'friends', 'private')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create boards table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'friends', 'private')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_fits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view all saved fits" ON public.saved_fits FOR SELECT USING (true);
CREATE POLICY "Users can manage own saved fits" ON public.saved_fits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view all boards" ON public.boards FOR SELECT USING (true);
CREATE POLICY "Users can manage own boards" ON public.boards FOR ALL USING (auth.uid() = user_id);

-- Note: After running this script, you'll need to:
-- 1. Create the users via the app's signup or Supabase Auth dashboard
-- 2. Then run the JavaScript setup script to add demo data
-- OR manually insert demo data using the user IDs from auth.users






