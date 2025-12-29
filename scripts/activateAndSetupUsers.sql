-- SQL Script to Activate Users and Set Metadata
-- Run this in Supabase SQL Editor AFTER creating users via Auth Dashboard or App

-- Step 1: Activate stylit@stylit.com (existing user)
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'Stylit User',
    'gender', 'other',
    'location', 'San Francisco, USA'
  )
WHERE email = 'stylit@stylit.com';

-- Step 2: Activate and set metadata for new users
-- Note: Replace the UUIDs with actual user IDs from auth.users after creating them

-- For esther@stylit.com
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'Esther',
    'gender', 'female',
    'location', 'New York, USA'
  )
WHERE email = 'esther@stylit.com';

-- For sheba@stylit.com
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'Sheba',
    'gender', 'female',
    'location', 'Los Angeles, USA'
  )
WHERE email = 'sheba@stylit.com';

-- For amy@stylit.com
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'Amy',
    'gender', 'female',
    'location', 'Chicago, USA'
  )
WHERE email = 'amy@stylit.com';

-- For john@stylit.com
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'John',
    'gender', 'male',
    'location', 'Tokyo, Japan'
  )
WHERE email = 'john@stylit.com';

-- For helloworld27@stylit.com
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'name', 'Hello World',
    'gender', 'male',
    'location', 'Paris, France'
  )
WHERE email = 'helloworld27@stylit.com';

-- Step 3: Create profiles table if it doesn't exist
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

-- Step 4: Create saved_fits table if it doesn't exist
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

-- Step 5: Create boards table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'friends', 'private')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Enable RLS and create policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_fits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view all saved fits" ON public.saved_fits;
DROP POLICY IF EXISTS "Users can manage own saved fits" ON public.saved_fits;

DROP POLICY IF EXISTS "Users can view all boards" ON public.boards;
DROP POLICY IF EXISTS "Users can manage own boards" ON public.boards;

-- Create new policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view all saved fits" ON public.saved_fits FOR SELECT USING (true);
CREATE POLICY "Users can manage own saved fits" ON public.saved_fits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view all boards" ON public.boards FOR SELECT USING (true);
CREATE POLICY "Users can manage own boards" ON public.boards FOR ALL USING (auth.uid() = user_id);

-- Step 7: Create profiles for all users
INSERT INTO public.profiles (id, email, name, gender, location)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'gender', 'other'),
  COALESCE(raw_user_meta_data->>'location', 'Unknown')
FROM auth.users
WHERE email IN (
  'stylit@stylit.com',
  'esther@stylit.com',
  'sheba@stylit.com',
  'amy@stylit.com',
  'john@stylit.com',
  'helloworld27@stylit.com'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  gender = EXCLUDED.gender,
  location = EXCLUDED.location,
  updated_at = NOW();

-- Verify activation
SELECT 
  email,
  email_confirmed_at IS NOT NULL as is_activated,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'gender' as gender,
  raw_user_meta_data->>'location' as location
FROM auth.users
WHERE email IN (
  'stylit@stylit.com',
  'esther@stylit.com',
  'sheba@stylit.com',
  'amy@stylit.com',
  'john@stylit.com',
  'helloworld27@stylit.com'
);






