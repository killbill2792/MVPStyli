-- =====================================================
-- ADD GUEST VOTING COLUMNS TO pod_votes
-- Enables web guest voting with name and comment support
-- =====================================================

-- Add guest voting columns
ALTER TABLE public.pod_votes
ADD COLUMN IF NOT EXISTS guest_id TEXT,
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_comment TEXT,
ADD COLUMN IF NOT EXISTS vote_source TEXT DEFAULT 'app' CHECK (vote_source IN ('app', 'web')),
ADD COLUMN IF NOT EXISTS from_user_id UUID;

-- Create unique constraint to prevent duplicate guest votes per pod per device
-- Only applies when guest_id is not null (guest votes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_votes_guest_unique 
ON public.pod_votes(pod_id, guest_id) 
WHERE guest_id IS NOT NULL;

-- Create index for guest_id lookups
CREATE INDEX IF NOT EXISTS idx_pod_votes_guest_id ON public.pod_votes(guest_id) WHERE guest_id IS NOT NULL;

-- Create index for vote_source
CREATE INDEX IF NOT EXISTS idx_pod_votes_source ON public.pod_votes(vote_source);

-- Create index for from_user_id (who shared the link)
CREATE INDEX IF NOT EXISTS idx_pod_votes_from_user ON public.pod_votes(from_user_id) WHERE from_user_id IS NOT NULL;

-- Update existing votes to have vote_source='app'
UPDATE public.pod_votes SET vote_source = 'app' WHERE vote_source IS NULL;

