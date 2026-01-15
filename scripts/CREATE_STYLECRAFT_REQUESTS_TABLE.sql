-- Create stylecraft_requests table to track beta testing interest
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.stylecraft_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT,
  min_budget INTEGER,
  max_budget INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'contacted', 'completed'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stylecraft_requests ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own requests
CREATE POLICY "Users can insert stylecraft requests" 
  ON public.stylecraft_requests 
  FOR INSERT 
  WITH CHECK (true);

-- Allow users to view their own requests
CREATE POLICY "Users can view own stylecraft requests" 
  ON public.stylecraft_requests 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admin can view all (you can adjust this policy as needed)
-- For now, allowing authenticated users to view for simplicity
-- You can restrict this to admin only if needed

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stylecraft_requests_user_id ON public.stylecraft_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_stylecraft_requests_created_at ON public.stylecraft_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stylecraft_requests_status ON public.stylecraft_requests(status);

SELECT 'stylecraft_requests table created successfully!' as status;
