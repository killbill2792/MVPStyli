-- Supabase Migration Script for Pods Feature
-- Run this in your Supabase SQL Editor

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
CREATE INDEX IF NOT EXISTS idx_pods_ends_at ON public.pods(ends_at);
CREATE INDEX IF NOT EXISTS idx_pod_votes_pod_id ON public.pod_votes(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_comments_pod_id ON public.pod_comments(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_invites_to_user ON public.pod_invites(to_user);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pods
CREATE POLICY "Pods are viewable by owner" ON public.pods
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Pods are viewable by invited users for friends audience" ON public.pods
    FOR SELECT USING (
        audience = 'friends' AND 
        EXISTS (
            SELECT 1 FROM public.pod_invites 
            WHERE pod_id = pods.id 
            AND to_user = auth.uid()::text 
            AND status = 'accepted'
        )
    );

CREATE POLICY "Pods are viewable by everyone for public audiences" ON public.pods
    FOR SELECT USING (audience IN ('style_twins', 'global_mix'));

CREATE POLICY "Users can create pods" ON public.pods
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their own pods" ON public.pods
    FOR UPDATE USING (owner_id = auth.uid()::text);

-- Create RLS policies for pod_votes
CREATE POLICY "Anyone can vote on pods" ON public.pod_votes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Votes are viewable by everyone" ON public.pod_votes
    FOR SELECT USING (true);

-- Create RLS policies for pod_comments
CREATE POLICY "Invited users can comment on friends pods" ON public.pod_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pods 
            WHERE pods.id = pod_comments.pod_id 
            AND pods.audience = 'friends'
            AND (
                pods.owner_id = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM public.pod_invites 
                    WHERE pod_invites.pod_id = pods.id 
                    AND pod_invites.to_user = auth.uid()::text 
                    AND pod_invites.status = 'accepted'
                )
            )
        )
    );

CREATE POLICY "Comments are viewable by pod participants" ON public.pod_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pods 
            WHERE pods.id = pod_comments.pod_id 
            AND (
                pods.owner_id = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM public.pod_invites 
                    WHERE pod_invites.pod_id = pods.id 
                    AND pod_invites.to_user = auth.uid()::text 
                    AND pod_invites.status = 'accepted'
                )
            )
        )
    );

-- Create RLS policies for pod_invites
CREATE POLICY "Pod owners can manage invites" ON public.pod_invites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pods 
            WHERE pods.id = pod_invites.pod_id 
            AND pods.owner_id = auth.uid()::text
        )
    );

CREATE POLICY "Invitees can view their invites" ON public.pod_invites
    FOR SELECT USING (to_user = auth.uid()::text);

CREATE POLICY "Invitees can update their invite status" ON public.pod_invites
    FOR UPDATE USING (to_user = auth.uid()::text);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Create a function to automatically expire pods
CREATE OR REPLACE FUNCTION expire_old_pods()
RETURNS void AS $$
BEGIN
    UPDATE public.pods 
    SET status = 'expired' 
    WHERE status = 'live' 
    AND ends_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function to create notifications when pods reach milestones
CREATE OR REPLACE FUNCTION notify_pod_milestone()
RETURNS TRIGGER AS $$
DECLARE
    pod_owner TEXT;
    confidence_score NUMERIC;
    total_votes INTEGER;
    yes_votes INTEGER;
BEGIN
    -- Get pod owner
    SELECT owner_id INTO pod_owner FROM public.pods WHERE id = NEW.pod_id;
    
    -- Calculate confidence
    SELECT COUNT(*), COUNT(*) FILTER (WHERE choice = 'yes')
    INTO total_votes, yes_votes
    FROM public.pod_votes 
    WHERE pod_id = NEW.pod_id;
    
    IF total_votes > 0 THEN
        confidence_score := (yes_votes + (COUNT(*) FILTER (WHERE choice = 'maybe') * 0.5)) / total_votes * 100;
        
        -- Create notification if confidence reaches 70%
        IF confidence_score >= 70 THEN
            INSERT INTO public.notifications (user_id, type, payload)
            VALUES (pod_owner, 'milestone', jsonb_build_object('pod_id', NEW.pod_id, 'confidence', confidence_score));
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for milestone notifications
CREATE TRIGGER pod_milestone_trigger
    AFTER INSERT ON public.pod_votes
    FOR EACH ROW
    EXECUTE FUNCTION notify_pod_milestone();

-- Create a function to notify when pod expires
CREATE OR REPLACE FUNCTION notify_pod_expired()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'live' AND NEW.status = 'expired' THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (OLD.owner_id, 'expired', jsonb_build_object('pod_id', OLD.id));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expiration notifications
CREATE TRIGGER pod_expired_trigger
    AFTER UPDATE ON public.pods
    FOR EACH ROW
    EXECUTE FUNCTION notify_pod_expired();
