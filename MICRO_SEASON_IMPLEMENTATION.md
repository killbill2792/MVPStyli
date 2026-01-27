# Micro-Season Implementation

## Overview

The app now uses a **micro-season system** with 12 specific seasons, while displaying only the **parent season** (4 seasons) to users. This provides more accurate color matching while keeping the UI simple.

## Architecture

### Parent Seasons (Displayed to User)
- **Spring** (warm • light)
- **Summer** (cool • light)
- **Autumn** (warm • deep)
- **Winter** (cool • deep)

### Micro-Seasons (Internal Use Only)
1. **Light Spring** (warm • light • delicate)
2. **Warm Spring** / True Spring (warm • bright • clear)
3. **Bright Spring** (warm • clear • vibrant)
4. **Soft Summer** (cool • soft • muted)
5. **Cool Summer** / True Summer (cool • soft • airy)
6. **Light Summer** (cool • light • soft)
7. **Deep Autumn** / True Autumn (warm • deep • rich)
8. **Soft Autumn** (warm • muted • soft)
9. **Warm Autumn** (warm • muted • earthy)
10. **Bright Winter** (cool • bright • clear)
11. **Cool Winter** / True Winter (cool • deep • high contrast)
12. **Deep Winter** (cool • deep • saturated)

## Flow

```
User Uploads Photo
    ↓
Analyze Skin Tone (Lab, undertone, depth, clarity)
    ↓
Determine Parent Season (e.g., "Autumn") ← SHOWN TO USER
    ↓
Determine Micro-Season (e.g., "soft_autumn") ← INTERNAL ONLY
    ↓
Store: season="autumn", microSeason="soft_autumn"
    ↓
Display: "Autumn's Colors for you" (parent season name)
    ↓
Use: soft_autumn palette colors (micro-season)
    ↓
FitCheck: Match products using soft_autumn palette
```

## Implementation Details

### 1. Palette Structure (`lib/colorClassification.ts`)

- **12 micro-season palettes** with precomputed Lab values
- Each micro-season has 20 colors (5 neutrals, 5 accents, 5 brights, 5 softs)
- Total: 240 colors across all micro-seasons

### 2. Classification (`classifyGarment()`)

- Classifies products into **micro-seasons** (not parent seasons)
- Returns both `microSeasonTag` and `seasonTag` (parent) for backward compatibility
- Uses Lab + ΔE distance matching

### 3. Skin Tone Analysis (`api/analyze-skin-tone/index.ts`)

- Determines parent season (shown to user)
- Determines micro-season internally (not shown)
- Returns both in API response

### 4. StyleVault Screen

- **Displays**: Parent season name (e.g., "Autumn's Colors for you")
- **Uses**: Micro-season palette colors (e.g., soft_autumn colors)
- **API**: Queries by micro-season when available for more accurate results

### 5. FitCheck Analysis

- **Uses**: Micro-season palettes for color matching
- **Explains**: Why colors work/don't work in human terms:
  - "This muted, soft color harmonizes beautifully with your delicate coloring"
  - "This vibrant, high-contrast color is too intense for your soft, muted coloring"
  - "This warm-toned color will clash with your cool undertones"
- **No technical jargon**: No mention of ΔE numbers or technical terms

### 6. Database Schema

**New Column**: `micro_season_tag` in `garments` table
- Stores micro-season (e.g., 'soft_autumn')
- `season_tag` still stores parent season (for backward compatibility)

**Migration**: `scripts/ADD_MICRO_SEASON_TO_GARMENTS.sql`

### 7. API Endpoints

**`/api/suggested-products`**
- Accepts `microSeason` parameter (optional)
- If provided: queries by `micro_season_tag` (more accurate)
- If not: queries by `season_tag` (parent season, less specific)

**`/api/analyze-skin-tone`**
- Returns `season` (parent, shown to user)
- Returns `microSeason` (internal use only)

## User Experience

### What Users See:
- ✅ "Autumn's Colors for you" (parent season)
- ✅ Color swatches from their specific micro-season palette
- ✅ FitCheck explanations in plain language

### What Users Don't See:
- ❌ "Soft Autumn" (micro-season name)
- ❌ Technical terms like "ΔE = 3.2"
- ❌ Color space details

## Benefits

1. **More Accurate**: 12 micro-seasons vs 4 parent seasons = 3x more specific
2. **Better Matching**: Products matched to exact micro-season palette
3. **User-Friendly**: Simple parent season names, not overwhelming
4. **Backward Compatible**: Still works with parent season queries
5. **Human-Readable**: FitCheck explains in terms users understand

## Example

**User Profile:**
- Parent Season: "Autumn" (shown)
- Micro-Season: "soft_autumn" (internal)
- Depth: "medium"
- Clarity: "muted"

**StyleVault:**
- Shows: "Autumn's Colors for you"
- Displays: Soft Autumn palette colors (muted corals, soft terracottas, etc.)

**FitCheck:**
- Product: Bright coral (#FF725C)
- Classification: bright_spring
- Result: "This vibrant, high-contrast color is too intense for your soft, muted coloring. It will overpower your delicate features."
- Suggestion: "Try muted, soft tones like muted coral or soft terracotta instead."

## Files Modified

1. `lib/colorClassification.ts` - 12 micro-season palettes, classification logic
2. `lib/styleSuitability.js` - FitCheck with micro-seasons and improved messaging
3. `screens/StyleVaultScreen.js` - Uses micro-season palettes, shows parent season
4. `api/analyze-skin-tone/index.ts` - Determines and returns micro-season
5. `api/garments/index.ts` - Stores micro_season_tag
6. `api/suggested-products/index.ts` - Supports micro-season queries
7. `lib/colorAnalysis.ts` - Handles microSeason in color profile
8. `components/AskAISheet.js` - Passes microSeason to FitCheck
9. `scripts/ADD_MICRO_SEASON_TO_GARMENTS.sql` - Database migration

## Next Steps

1. Run database migration: `scripts/ADD_MICRO_SEASON_TO_GARMENTS.sql`
2. Re-classify existing garments (they'll get micro_season_tag on next update)
3. Test with real user photos to verify micro-season determination
4. Monitor FitCheck feedback to ensure explanations are clear
