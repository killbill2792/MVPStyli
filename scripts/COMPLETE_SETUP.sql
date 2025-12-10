-- =====================================================
-- COMPLETE SETUP FOR STYLIT
-- Run this ENTIRE script in Supabase SQL Editor
-- This sets up everything properly!
-- =====================================================

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    height TEXT,
    weight TEXT,
    top_size TEXT,
    bottom_size TEXT,
    shoe_size TEXT,
    chest TEXT,
    underbust TEXT,
    waist TEXT,
    hips TEXT,
    shoulder TEXT,
    sleeve TEXT,
    inseam TEXT,
    thigh TEXT,
    neck TEXT,
    bra_size TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chest TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS underbust TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS waist TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hips TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shoulder TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sleeve TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inseam TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS thigh TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS neck TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bra_size TEXT;

-- Enable RLS but create permissive policy
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create policies that allow all operations
CREATE POLICY "Public read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- Insert profiles for all auth users
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
    name = CASE 
        WHEN EXCLUDED.email = 'esther@stylit.com' THEN 'Esther'
        WHEN EXCLUDED.email = 'john@stylit.com' THEN 'John'
        WHEN EXCLUDED.email = 'stylit@stylit.com' THEN 'Stylit'
        ELSE COALESCE(public.profiles.name, INITCAP(SPLIT_PART(EXCLUDED.email, '@', 1)))
    END,
    email = EXCLUDED.email,
    updated_at = NOW();

-- ==================== FRIENDS ====================
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Friends read access" ON public.friends;
DROP POLICY IF EXISTS "Friends insert" ON public.friends;
CREATE POLICY "Friends read access" ON public.friends FOR SELECT USING (true);
CREATE POLICY "Friends insert" ON public.friends FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);

-- Set up friendships for Stylit <-> Esther and Stylit <-> John
DO $$
DECLARE
    stylit_id UUID;
    esther_id UUID;
    john_id UUID;
BEGIN
    SELECT id INTO stylit_id FROM auth.users WHERE email = 'stylit@stylit.com';
    SELECT id INTO esther_id FROM auth.users WHERE email = 'esther@stylit.com';
    SELECT id INTO john_id FROM auth.users WHERE email = 'john@stylit.com';

    IF stylit_id IS NOT NULL AND esther_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, esther_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        RAISE NOTICE 'Added: Stylit -> Esther';
    END IF;

    IF stylit_id IS NOT NULL AND john_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (stylit_id, john_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        RAISE NOTICE 'Added: Stylit -> John';
    END IF;

    IF esther_id IS NOT NULL AND stylit_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (esther_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        RAISE NOTICE 'Added: Esther -> Stylit';
    END IF;

    IF john_id IS NOT NULL AND stylit_id IS NOT NULL THEN
        INSERT INTO public.friends (user_id, friend_id, status)
        VALUES (john_id, stylit_id, 'accepted')
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        RAISE NOTICE 'Added: John -> Stylit';
    END IF;
END $$;

-- ==================== POD INVITES ====================
CREATE TABLE IF NOT EXISTS public.pod_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL,
    from_user UUID NOT NULL,
    to_user UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pod_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pod invites read" ON public.pod_invites;
DROP POLICY IF EXISTS "Pod invites insert" ON public.pod_invites;
DROP POLICY IF EXISTS "Pod invites update" ON public.pod_invites;
CREATE POLICY "Pod invites read" ON public.pod_invites FOR SELECT USING (true);
CREATE POLICY "Pod invites insert" ON public.pod_invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Pod invites update" ON public.pod_invites FOR UPDATE USING (true);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    payload JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;
DROP POLICY IF EXISTS "Notifications update" ON public.notifications;
CREATE POLICY "Notifications read" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Notifications insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications update" ON public.notifications FOR UPDATE USING (true);

-- ==================== POD_VOTES ====================
-- Ensure pod_votes has proper policies
ALTER TABLE public.pod_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pod votes read" ON public.pod_votes;
DROP POLICY IF EXISTS "Pod votes insert" ON public.pod_votes;
CREATE POLICY "Pod votes read" ON public.pod_votes FOR SELECT USING (true);
CREATE POLICY "Pod votes insert" ON public.pod_votes FOR INSERT WITH CHECK (true);

-- ==================== PODS ====================
-- Ensure pods has proper policies and has visibility column
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS product_url TEXT;

ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pods read" ON public.pods;
DROP POLICY IF EXISTS "Pods insert" ON public.pods;
DROP POLICY IF EXISTS "Pods update" ON public.pods;
CREATE POLICY "Pods read" ON public.pods FOR SELECT USING (true);
CREATE POLICY "Pods insert" ON public.pods FOR INSERT WITH CHECK (true);
CREATE POLICY "Pods update" ON public.pods FOR UPDATE USING (true);

-- ==================== TRY ON HISTORY ====================
CREATE TABLE IF NOT EXISTS public.try_on_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    result_url TEXT NOT NULL,
    product_name TEXT,
    product_image TEXT,
    product_url TEXT,
    visibility TEXT DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.try_on_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Try on history read" ON public.try_on_history;
DROP POLICY IF EXISTS "Try on history insert" ON public.try_on_history;
DROP POLICY IF EXISTS "Try on history update" ON public.try_on_history;
CREATE POLICY "Try on history read" ON public.try_on_history FOR SELECT USING (true);
CREATE POLICY "Try on history insert" ON public.try_on_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Try on history update" ON public.try_on_history FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_tryon_user ON public.try_on_history(user_id);

-- ==================== SAVED FITS ====================
CREATE TABLE IF NOT EXISTS public.saved_fits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    title TEXT,
    price TEXT,
    product_url TEXT,
    visibility TEXT DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_fits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Saved fits read" ON public.saved_fits;
DROP POLICY IF EXISTS "Saved fits insert" ON public.saved_fits;
DROP POLICY IF EXISTS "Saved fits update" ON public.saved_fits;
CREATE POLICY "Saved fits read" ON public.saved_fits FOR SELECT USING (true);
CREATE POLICY "Saved fits insert" ON public.saved_fits FOR INSERT WITH CHECK (true);
CREATE POLICY "Saved fits update" ON public.saved_fits FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_saved_fits_user ON public.saved_fits(user_id);

-- ==================== VERIFICATION ====================
SELECT '✅ PROFILES' as section;
SELECT id, name, email, avatar_url FROM public.profiles LIMIT 5;

SELECT '✅ FRIENDS' as section;
SELECT 
    p1.email as user,
    p2.email as friend,
    p2.name as friend_name
FROM public.friends f
JOIN public.profiles p1 ON f.user_id = p1.id
JOIN public.profiles p2 ON f.friend_id = p2.id;

SELECT '🎉 SETUP COMPLETE!' as status;
