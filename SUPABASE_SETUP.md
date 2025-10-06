# Supabase Setup Instructions

## 1. Create Tables in Supabase

Go to your Supabase project dashboard → SQL Editor and run this script:

```sql
-- Create pods table
CREATE TABLE IF NOT EXISTS public.pods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('friends', 'style_twins', 'global_mix')),
    duration_mins INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL DEFAULT 'My Look',
    summary TEXT
);

-- Create pod_votes table
CREATE TABLE IF NOT EXISTS public.pod_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    voter_id TEXT,
    choice TEXT NOT NULL CHECK (choice IN ('yes', 'maybe', 'no')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pod_comments table
CREATE TABLE IF NOT EXISTS public.pod_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pod_invites table
CREATE TABLE IF NOT EXISTS public.pod_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    to_user TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pods_owner_id ON public.pods(owner_id);
CREATE INDEX IF NOT EXISTS idx_pods_status ON public.pods(status);
CREATE INDEX IF NOT EXISTS idx_pod_votes_pod_id ON public.pod_votes(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_comments_pod_id ON public.pod_comments(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_invites_to_user ON public.pod_invites(to_user);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
```

## 2. Enable Row Level Security (Optional)

If you want to enable RLS for security, run this additional script:

```sql
-- Enable RLS
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create basic policies (adjust as needed)
CREATE POLICY "Allow all operations" ON public.pods FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pod_votes FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pod_comments FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.pod_invites FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.notifications FOR ALL USING (true);
```

## 3. Test the Setup

After running the SQL script:

1. Go to your Supabase project dashboard
2. Navigate to "Table Editor"
3. You should see the new tables: `pods`, `pod_votes`, `pod_comments`, `pod_invites`, `notifications`
4. Test the app - the Pods feature should now work without errors

## 4. Environment Variables

Make sure your `.env.local` file has:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

That's it! The Pods feature should now work properly with your Supabase database.
