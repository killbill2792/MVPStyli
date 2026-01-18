-- ============================================================================
-- Add Color Classification Fields to Garments Table
-- ============================================================================
-- This migration adds fields for Lab color space classification
-- These fields are populated automatically when a garment is created/updated
-- with a color_hex value

-- Add color classification columns
ALTER TABLE garments
ADD COLUMN IF NOT EXISTS dominant_hex TEXT,
ADD COLUMN IF NOT EXISTS lab_l NUMERIC,
ADD COLUMN IF NOT EXISTS lab_a NUMERIC,
ADD COLUMN IF NOT EXISTS lab_b NUMERIC,
ADD COLUMN IF NOT EXISTS season_tag TEXT CHECK (season_tag IN ('spring', 'summer', 'autumn', 'winter') OR season_tag IS NULL),
ADD COLUMN IF NOT EXISTS group_tag TEXT CHECK (group_tag IN ('neutrals', 'accents', 'brights', 'softs') OR group_tag IS NULL),
ADD COLUMN IF NOT EXISTS nearest_palette_color_name TEXT,
ADD COLUMN IF NOT EXISTS min_delta_e NUMERIC,
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'unclassified' CHECK (classification_status IN ('ok', 'unclassified', 'ambiguous'));

-- Add indexes for fast querying by season and group
CREATE INDEX IF NOT EXISTS idx_garments_season_group ON garments(season_tag, group_tag) WHERE season_tag IS NOT NULL AND group_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_garments_classification_status ON garments(classification_status);
CREATE INDEX IF NOT EXISTS idx_garments_min_delta_e ON garments(min_delta_e) WHERE min_delta_e IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN garments.dominant_hex IS 'The dominant color hex code of the garment';
COMMENT ON COLUMN garments.lab_l IS 'Lab color space L value (lightness)';
COMMENT ON COLUMN garments.lab_a IS 'Lab color space a value (green-red axis)';
COMMENT ON COLUMN garments.lab_b IS 'Lab color space b value (blue-yellow axis)';
COMMENT ON COLUMN garments.season_tag IS 'Classified season: spring, summer, autumn, winter, or NULL if unclassified';
COMMENT ON COLUMN garments.group_tag IS 'Classified group: neutrals, accents, brights, softs, or NULL if unclassified';
COMMENT ON COLUMN garments.nearest_palette_color_name IS 'Name of the nearest palette color match';
COMMENT ON COLUMN garments.min_delta_e IS 'Minimum ΔE distance to nearest palette color (lower = better match)';
COMMENT ON COLUMN garments.classification_status IS 'Classification status: ok (classified), unclassified (ΔE > 12), ambiguous (multiple close matches)';
