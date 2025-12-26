-- Add fit_preference column to profiles table
-- This field stores the user's preferred fit style: snug, regular, relaxed, or oversized

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS fit_preference TEXT CHECK (fit_preference IN ('snug', 'regular', 'relaxed', 'oversized'));

-- Add comment for documentation
COMMENT ON COLUMN profiles.fit_preference IS 'User preferred fit style: snug, regular, relaxed, or oversized';

