-- Add micro_season_tag column to garments table
-- This stores the specific micro-season (e.g., 'soft_autumn', 'bright_winter') 
-- while season_tag stores the parent season (e.g., 'autumn', 'winter')

ALTER TABLE garments
ADD COLUMN IF NOT EXISTS micro_season_tag TEXT;

-- Add index for faster querying by micro-season
CREATE INDEX IF NOT EXISTS idx_garments_micro_season_tag ON garments (micro_season_tag);

-- Add index for combined micro-season + group queries
CREATE INDEX IF NOT EXISTS idx_garments_micro_season_group ON garments (micro_season_tag, group_tag);

-- Note: micro_season_tag can be one of:
-- 'light_spring', 'warm_spring', 'bright_spring',
-- 'soft_summer', 'cool_summer', 'light_summer',
-- 'deep_autumn', 'soft_autumn', 'warm_autumn',
-- 'bright_winter', 'cool_winter', 'deep_winter'
