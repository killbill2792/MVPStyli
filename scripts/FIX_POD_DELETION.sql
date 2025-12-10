-- Fix pod deletion RLS policies
-- Run this in your Supabase SQL Editor

-- First, enable full access for pods table (for MVP)
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Pods read" ON public.pods;
DROP POLICY IF EXISTS "Pods insert" ON public.pods;
DROP POLICY IF EXISTS "Pods update" ON public.pods;
DROP POLICY IF EXISTS "Pods delete" ON public.pods;
DROP POLICY IF EXISTS "Anyone can read pods" ON public.pods;
DROP POLICY IF EXISTS "Anyone can insert pods" ON public.pods;
DROP POLICY IF EXISTS "Anyone can update pods" ON public.pods;
DROP POLICY IF EXISTS "Anyone can delete pods" ON public.pods;

-- Create permissive policies for MVP
CREATE POLICY "Anyone can read pods" ON public.pods FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pods" ON public.pods FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pods" ON public.pods FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pods" ON public.pods FOR DELETE USING (true);

-- Same for pod_votes
ALTER TABLE public.pod_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pod votes read" ON public.pod_votes;
DROP POLICY IF EXISTS "Pod votes insert" ON public.pod_votes;
DROP POLICY IF EXISTS "Pod votes delete" ON public.pod_votes;
DROP POLICY IF EXISTS "Anyone can read pod_votes" ON public.pod_votes;
DROP POLICY IF EXISTS "Anyone can insert pod_votes" ON public.pod_votes;
DROP POLICY IF EXISTS "Anyone can delete pod_votes" ON public.pod_votes;
CREATE POLICY "Anyone can read pod_votes" ON public.pod_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pod_votes" ON public.pod_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pod_votes" ON public.pod_votes FOR DELETE USING (true);

-- Same for pod_comments
ALTER TABLE public.pod_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pod comments read" ON public.pod_comments;
DROP POLICY IF EXISTS "Pod comments insert" ON public.pod_comments;
DROP POLICY IF EXISTS "Pod comments delete" ON public.pod_comments;
DROP POLICY IF EXISTS "Anyone can read pod_comments" ON public.pod_comments;
DROP POLICY IF EXISTS "Anyone can insert pod_comments" ON public.pod_comments;
DROP POLICY IF EXISTS "Anyone can delete pod_comments" ON public.pod_comments;
CREATE POLICY "Anyone can read pod_comments" ON public.pod_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pod_comments" ON public.pod_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pod_comments" ON public.pod_comments FOR DELETE USING (true);

-- Same for pod_invites
ALTER TABLE public.pod_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pod invites read" ON public.pod_invites;
DROP POLICY IF EXISTS "Pod invites insert" ON public.pod_invites;
DROP POLICY IF EXISTS "Pod invites delete" ON public.pod_invites;
DROP POLICY IF EXISTS "Anyone can read pod_invites" ON public.pod_invites;
DROP POLICY IF EXISTS "Anyone can insert pod_invites" ON public.pod_invites;
DROP POLICY IF EXISTS "Anyone can delete pod_invites" ON public.pod_invites;
CREATE POLICY "Anyone can read pod_invites" ON public.pod_invites FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pod_invites" ON public.pod_invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pod_invites" ON public.pod_invites FOR DELETE USING (true);

-- Verify by listing policies
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN ('pods', 'pod_votes', 'pod_comments', 'pod_invites');

