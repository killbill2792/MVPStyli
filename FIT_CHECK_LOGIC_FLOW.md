# Fit Check Logic Flow Documentation

## Overview
Fit Check (formerly "Ask AI") uses **rule-based logic only** by default. Gemini AI is only called when the user explicitly clicks the "Gemini" button.

## Logic Files Used

### ✅ Active Logic Files (Rule-Based, NO-AI)

1. **`lib/fitLogic.js`** - Size & Fit Recommendations
   - **Purpose**: Determines recommended size, backup size, risk level, confidence, and measurement insights
   - **Input**: User body measurements (in inches), product size chart (in inches), fit type, fabric stretch
   - **Output**: Size recommendation with insights
   - **Status**: ✅ Active and used

2. **`lib/styleSuitability.js`** - Color & Body Shape Suitability
   - **Purpose**: Evaluates if product color matches user's color profile and if silhouette suits body shape
   - **Input**: User color profile (undertone/season), body shape, product color, category, fit type
   - **Output**: Color verdict (great/ok/risky) and body shape verdict (flattering/neutral/risky)
   - **Status**: ✅ Active and used

3. **`lib/fabricComfort.js`** - Fabric Comfort Analysis
   - **Purpose**: Analyzes fabric material for comfort factors (stretch, wrinkle, itch, cling, sheer, sweat)
   - **Input**: Product material/fabric keywords
   - **Output**: Comfort verdict and insights
   - **Status**: ✅ Active and used

### ❌ Redundant/Unused Files

1. **`lib/askAI.ts`** - OLD AI-based logic
   - **Status**: ❌ **NOT USED** - Functions `generateFitAdvice`, `generateSizeAdvice`, `generateStyleAdvice` are imported but never called
   - **Action**: Can be removed (or kept for reference, but not used in Fit Check)

## Fit Check Input/Output Flow

### Input Data Sources

1. **User Profile** (from Supabase `profiles` table):
   - Body measurements: `chest_in`, `waist_in`, `hips_in`, `shoulder_in`, `inseam_in`, `height_in` (in inches)
   - Color profile: `color_tone` (undertone), `color_season` (season)
   - Body shape: `body_shape`
   - Gender: `gender`

2. **Product Data** (from product object):
   - `sizeChart`: Array of size objects with measurements (circumference in inches)
   - `color`: Product color string
   - `category`: 'upper', 'lower', 'dresses'
   - `fit_type`: 'slim', 'regular', 'relaxed', 'oversized'
   - `fabric_stretch`: 'none', 'low', 'medium', 'high'
   - `material`: Material description

### Processing Flow

```
1. Load User Profile from Supabase
   ↓
2. Load Color Profile (from colorAnalysis)
   ↓
3. Build userProfileForFitLogic (convert to inches if needed)
   ↓
4. Build productForFitLogic (extract sizeChart, fitType, fabricStretch)
   ↓
5. Call fitLogic.recommendSizeAndFit() → FIT & SIZE section
   ↓
6. Call styleSuitability.evaluateSuitability() → COLOR & BODY SHAPE sections
   ↓
7. Call fabricComfort.analyzeFabricComfort() → FABRIC & COMFORT section
   ↓
8. Build HOW TO WEAR data (rule-based from category/fit)
   ↓
9. Display all sections in UI
```

### Output Sections (5 Sections)

1. **FIT & SIZE** (from `fitLogic.js`)
   - Status: Perfect Fit / Good Fit / Good with Tweaks / Runs Small / Runs Large / High Risk
   - Recommended Size: e.g., "M"
   - Backup Size: e.g., "L"
   - Measurement Deltas: 2-5 bullets (e.g., "Chest ease ≈ 1 1/2 in")
   - Stylist Translation: Human-readable summary sentence

2. **COLOR** (from `styleSuitability.js`)
   - Verdict: Great / OK / Risky
   - Reasons: 2-4 bullets
   - Alternate Colors: 2-3 suggestions

3. **BODY SHAPE** (from `styleSuitability.js`)
   - Verdict: Flattering / Flattering with Tweaks / Neutral / Risky
   - Reasons: 2-4 bullets
   - Tweak Tip: 1 styling suggestion

4. **FABRIC & COMFORT** (from `fabricComfort.js`)
   - Verdict: Comfortable / Okay / Risky / Need Fabric Info
   - Insights: 2-4 bullets about stretch, wrinkle, itch, cling, sheer, sweat

5. **HOW TO WEAR / OCCASIONS** (rule-based)
   - Best For: 3-5 chips (e.g., "Work", "Casual", "Date Night")
   - Styling Tips: 2-4 bullets

## Current Issues & Fixes Needed

### ✅ Fixed
- Removed broken `askAI.js` import
- Updated user profile to use inches (`In` suffix)
- Fixed color detection to handle empty strings
- Removed unused state variables

### ⚠️ Still Need to Fix

1. **Measurement Units**: 
   - User body measurements still stored in cm in database
   - Need to update UI to support inches/cm toggle and store in inches
   - Need to update AdminGarmentsScreen to use circumference (not flat) and store in inches

2. **Size Chart Display**:
   - ProductScreen size chart shows "0" instead of actual measurements
   - Need to display circumference measurements from `garment_sizes` table

3. **Database Migration**:
   - Need to run `MIGRATE_TO_CIRCUMFERENCE_INCHES.sql` in Supabase
   - This will add new circumference columns and migrate existing data

## Summary

**Fit Check uses ONLY these 3 rule-based logic files:**
- ✅ `lib/fitLogic.js` - Size recommendations
- ✅ `lib/styleSuitability.js` - Color & body shape
- ✅ `lib/fabricComfort.js` - Fabric comfort

**Redundant file (can be removed):**
- ❌ `lib/askAI.ts` - Not used in Fit Check

**Gemini AI:**
- Only called when user clicks "Gemini" button explicitly
- Not used for default Fit Check analysis

