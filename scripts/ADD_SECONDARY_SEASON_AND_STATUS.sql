-- ============================================================================
-- Add Secondary Season and Updated Classification Status to Garments Table
-- ============================================================================
-- This migration adds support for:
-- 1. Secondary season classification (for crossover colors that work in multiple seasons)
-- 2. Updated classification status: 'great', 'good', 'ambiguous', 'unclassified'
--
-- Run this migration after ADD_MICRO_SEASON_TO_GARMENTS.sql

-- ============================================================================
-- STEP 1: Add secondary classification columns
-- ============================================================================

-- Secondary micro-season (e.g., 'soft_autumn' when primary is 'light_spring')
ALTER TABLE garments
ADD COLUMN IF NOT EXISTS secondary_micro_season_tag TEXT;

-- Secondary parent season (e.g., 'autumn' when primary is 'spring')
ALTER TABLE garments
ADD COLUMN IF NOT EXISTS secondary_season_tag TEXT 
CHECK (secondary_season_tag IN ('spring', 'summer', 'autumn', 'winter') OR secondary_season_tag IS NULL);

-- Secondary group (neutrals, accents, brights, softs)
ALTER TABLE garments
ADD COLUMN IF NOT EXISTS secondary_group_tag TEXT 
CHECK (secondary_group_tag IN ('neutrals', 'accents', 'brights', 'softs') OR secondary_group_tag IS NULL);

-- Secondary ΔE value (how close to the secondary season palette)
ALTER TABLE garments
ADD COLUMN IF NOT EXISTS secondary_delta_e NUMERIC;

-- ============================================================================
-- STEP 2: Update classification_status CHECK constraint
-- ============================================================================
-- Old values: 'ok', 'unclassified', 'ambiguous'
-- New values: 'great', 'good', 'ambiguous', 'unclassified'

-- First, migrate existing 'ok' values to 'good' (we'll re-classify to get 'great' vs 'good')
UPDATE garments 
SET classification_status = 'good' 
WHERE classification_status = 'ok';

-- Drop old constraint and add new one
ALTER TABLE garments 
DROP CONSTRAINT IF EXISTS garments_classification_status_check;

ALTER TABLE garments
ADD CONSTRAINT garments_classification_status_check 
CHECK (classification_status IN ('great', 'good', 'ambiguous', 'unclassified') OR classification_status IS NULL);

-- ============================================================================
-- STEP 3: Add indexes for secondary season queries
-- ============================================================================

-- Index for querying products by secondary season
CREATE INDEX IF NOT EXISTS idx_garments_secondary_season_tag 
ON garments (secondary_season_tag) 
WHERE secondary_season_tag IS NOT NULL;

-- Combined index for OR queries (primary OR secondary season)
CREATE INDEX IF NOT EXISTS idx_garments_both_seasons 
ON garments (season_tag, secondary_season_tag);

-- Index for secondary group queries
CREATE INDEX IF NOT EXISTS idx_garments_secondary_group 
ON garments (secondary_group_tag) 
WHERE secondary_group_tag IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN garments.secondary_micro_season_tag IS 
'Secondary micro-season for crossover colors (e.g., soft_autumn when primary is light_spring)';

COMMENT ON COLUMN garments.secondary_season_tag IS 
'Secondary parent season for crossover colors, used to show product in multiple season suggestions';

COMMENT ON COLUMN garments.secondary_group_tag IS 
'Secondary color group (neutrals, accents, brights, softs) for the secondary season match';

COMMENT ON COLUMN garments.secondary_delta_e IS 
'ΔE distance to secondary season palette (how close the color is to secondary season)';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After running this migration, you should re-classify existing garments to:
-- 1. Populate secondary_season_tag for crossover colors
-- 2. Update classification_status to 'great' or 'good' (currently all are 'good')
--
-- To re-classify a garment, call the garments API with a PUT/PATCH including color_hex
-- Or create a batch re-classification script
-- ============================================================================
