-- Migration: Convert to Circumference-Only Measurements in Inches
-- This migration:
-- 1. Converts garment_sizes from flat measurements (cm) to circumference (inches)
-- 2. Updates all measurement fields to store in inches
-- 3. Removes flat measurement concepts

-- Step 1: Add new circumference columns to garment_sizes (in inches)
ALTER TABLE garment_sizes 
  ADD COLUMN IF NOT EXISTS chest_circumference DECIMAL(6,2), -- Chest circumference in inches
  ADD COLUMN IF NOT EXISTS waist_circumference DECIMAL(6,2), -- Waist circumference in inches
  ADD COLUMN IF NOT EXISTS hip_circumference DECIMAL(6,2), -- Hip circumference in inches
  ADD COLUMN IF NOT EXISTS garment_length_in DECIMAL(6,2), -- Total length in inches
  ADD COLUMN IF NOT EXISTS shoulder_width_in DECIMAL(6,2), -- Shoulder width in inches
  ADD COLUMN IF NOT EXISTS sleeve_length_in DECIMAL(6,2), -- Sleeve length in inches
  ADD COLUMN IF NOT EXISTS inseam_in DECIMAL(6,2), -- Inseam in inches
  ADD COLUMN IF NOT EXISTS rise_in DECIMAL(6,2), -- Rise in inches
  ADD COLUMN IF NOT EXISTS thigh_circumference DECIMAL(6,2), -- Thigh circumference in inches
  ADD COLUMN IF NOT EXISTS leg_opening_circumference DECIMAL(6,2); -- Leg opening circumference in inches

-- Step 2: Migrate existing data (convert flat cm to circumference inches)
-- Formula: circumference = flat_width * 2 (convert cm to inches: / 2.54)
-- Only migrate if old columns have data and new columns are null
UPDATE garment_sizes
SET 
  chest_circumference = CASE 
    WHEN chest_width IS NOT NULL AND chest_circumference IS NULL 
    THEN (chest_width * 2) / 2.54 
    ELSE chest_circumference 
  END,
  waist_circumference = CASE 
    WHEN waist_width IS NOT NULL AND waist_circumference IS NULL 
    THEN (waist_width * 2) / 2.54 
    ELSE waist_circumference 
  END,
  hip_circumference = CASE 
    WHEN hip_width IS NOT NULL AND hip_circumference IS NULL 
    THEN (hip_width * 2) / 2.54 
    ELSE hip_circumference 
  END,
  garment_length_in = CASE 
    WHEN garment_length IS NOT NULL AND garment_length_in IS NULL 
    THEN garment_length / 2.54 
    ELSE garment_length_in 
  END,
  shoulder_width_in = CASE 
    WHEN shoulder_width IS NOT NULL AND shoulder_width_in IS NULL 
    THEN shoulder_width / 2.54 
    ELSE shoulder_width_in 
  END,
  sleeve_length_in = CASE 
    WHEN sleeve_length IS NOT NULL AND sleeve_length_in IS NULL 
    THEN sleeve_length / 2.54 
    ELSE sleeve_length_in 
  END,
  inseam_in = CASE 
    WHEN inseam IS NOT NULL AND inseam_in IS NULL 
    THEN inseam / 2.54 
    ELSE inseam_in 
  END,
  rise_in = CASE 
    WHEN rise IS NOT NULL AND rise_in IS NULL 
    THEN rise / 2.54 
    ELSE rise_in 
  END,
  thigh_circumference = CASE 
    WHEN thigh_width IS NOT NULL AND thigh_circumference IS NULL 
    THEN (thigh_width * 2) / 2.54 
    ELSE thigh_circumference 
  END,
  leg_opening_circumference = CASE 
    WHEN leg_opening IS NOT NULL AND leg_opening_circumference IS NULL 
    THEN (leg_opening * 2) / 2.54 
    ELSE leg_opening_circumference 
  END;

-- Step 3: Drop old flat measurement columns (after migration)
-- Commented out for safety - uncomment after verifying migration
-- ALTER TABLE garment_sizes 
--   DROP COLUMN IF EXISTS chest_width,
--   DROP COLUMN IF EXISTS waist_width,
--   DROP COLUMN IF EXISTS hip_width,
--   DROP COLUMN IF EXISTS garment_length,
--   DROP COLUMN IF EXISTS shoulder_width,
--   DROP COLUMN IF EXISTS sleeve_length,
--   DROP COLUMN IF EXISTS inseam,
--   DROP COLUMN IF EXISTS rise,
--   DROP COLUMN IF EXISTS thigh_width,
--   DROP COLUMN IF EXISTS leg_opening;

-- Step 4: Update profiles table to store body measurements in inches
-- Add columns if they don't exist (they might already exist)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chest_in DECIMAL(6,2), -- Chest circumference in inches
  ADD COLUMN IF NOT EXISTS waist_in DECIMAL(6,2), -- Waist circumference in inches
  ADD COLUMN IF NOT EXISTS hips_in DECIMAL(6,2), -- Hip circumference in inches
  ADD COLUMN IF NOT EXISTS shoulder_in DECIMAL(6,2), -- Shoulder width in inches
  ADD COLUMN IF NOT EXISTS sleeve_in DECIMAL(6,2), -- Arm/sleeve length in inches
  ADD COLUMN IF NOT EXISTS inseam_in DECIMAL(6,2), -- Inseam in inches
  ADD COLUMN IF NOT EXISTS thigh_in DECIMAL(6,2), -- Thigh circumference in inches
  ADD COLUMN IF NOT EXISTS height_in DECIMAL(6,2); -- Height in inches

-- Step 5: Migrate existing body measurements from cm to inches (if old columns exist)
-- This assumes old columns are named: chest, waist, hips, shoulder, sleeve, inseam, thigh, height
-- Convert cm to inches: value / 2.54
UPDATE profiles
SET 
  chest_in = CASE 
    WHEN chest IS NOT NULL AND chest_in IS NULL 
    THEN chest / 2.54 
    ELSE chest_in 
  END,
  waist_in = CASE 
    WHEN waist IS NOT NULL AND waist_in IS NULL 
    THEN waist / 2.54 
    ELSE waist_in 
  END,
  hips_in = CASE 
    WHEN hips IS NOT NULL AND hips_in IS NULL 
    THEN hips / 2.54 
    ELSE hips_in 
  END,
  shoulder_in = CASE 
    WHEN shoulder IS NOT NULL AND shoulder_in IS NULL 
    THEN shoulder / 2.54 
    ELSE shoulder_in 
  END,
  sleeve_in = CASE 
    WHEN sleeve IS NOT NULL AND sleeve_in IS NULL 
    THEN sleeve / 2.54 
    ELSE sleeve_in 
  END,
  inseam_in = CASE 
    WHEN inseam IS NOT NULL AND inseam_in IS NULL 
    THEN inseam / 2.54 
    ELSE inseam_in 
  END,
  thigh_in = CASE 
    WHEN thigh IS NOT NULL AND thigh_in IS NULL 
    THEN thigh / 2.54 
    ELSE thigh_in 
  END,
  height_in = CASE 
    WHEN height IS NOT NULL AND height_in IS NULL 
    THEN height / 2.54 
    ELSE height_in 
  END
WHERE chest IS NOT NULL OR waist IS NOT NULL OR hips IS NOT NULL;

-- Note: Old columns (chest, waist, hips, etc.) are kept for now to avoid breaking existing code
-- They can be dropped in a future migration after all code is updated

