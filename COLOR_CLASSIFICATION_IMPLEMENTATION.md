# Color Classification System Implementation

## Overview

This document describes the complete Lab + ΔE color classification system for garment color matching. The system uses perceptual color distance (Lab color space) instead of color names to accurately classify garments into 4-season palette categories.

## Architecture

### 1. Color Utilities (`lib/colorClassification.ts`)

**Core Functions:**
- `hexToRgb(hex)` - Converts hex to RGB
- `rgbToXyz(rgb)` - Converts RGB to XYZ (sRGB color space)
- `xyzToLab(xyz)` - Converts XYZ to Lab (CIE Lab, D65 white point)
- `deltaE(lab1, lab2)` - Calculates ΔE distance using CIE76 formula
- `hexToLab(hex)` - Convenience function for direct hex → Lab conversion

**Palette Structure:**
- Precomputed Lab values for all 80 palette colors (4 seasons × 4 groups × 5 colors)
- Computed once at module load for performance
- Structure: `PALETTE[season][group][index]` where each color has `{ name, hex, lab }`

**Classification Function:**
- `classifyGarment(hex)` - Main classification function
  - Converts input hex → Lab
  - Compares to ALL palette colors
  - Finds best match (minimum ΔE)
  - Applies gating:
    - If `minDeltaE > 12` → `unclassified`
    - If `(runnerUpDeltaE - bestDeltaE) < 2` → `ambiguous`
  - Returns `ClassificationResult` with season, group, and metadata

### 2. Database Schema

**Migration:** `scripts/ADD_COLOR_CLASSIFICATION_TO_GARMENTS.sql`

**New Fields:**
- `dominant_hex` (TEXT) - The garment's color hex code
- `lab_l`, `lab_a`, `lab_b` (NUMERIC) - Lab color space values
- `season_tag` (TEXT) - 'spring' | 'summer' | 'autumn' | 'winter' | NULL
- `group_tag` (TEXT) - 'neutrals' | 'accents' | 'brights' | 'softs' | NULL
- `nearest_palette_color_name` (TEXT) - Name of nearest palette match
- `min_delta_e` (NUMERIC) - Minimum ΔE distance (lower = better match)
- `classification_status` (TEXT) - 'ok' | 'unclassified' | 'ambiguous'

**Indexes:**
- `idx_garments_season_group` - Fast querying by season + group
- `idx_garments_classification_status` - Filter by status
- `idx_garments_min_delta_e` - Sort by match quality

### 3. API Endpoints

#### A. Garments API (`api/garments/index.ts`)

**Updated POST/PUT handlers:**
- Accepts `color_hex` in request body
- Automatically classifies color on create/update
- Stores classification results in database
- Classification happens server-side, not client-side

**Example POST request:**
```json
{
  "name": "Coral Blouse",
  "category": "upper",
  "color_hex": "#FF6F61",
  "color": "Coral",
  ...
}
```

**Response includes classification:**
```json
{
  "garment": {
    "id": "...",
    "season_tag": "spring",
    "group_tag": "accents",
    "min_delta_e": 3.2,
    "classification_status": "ok",
    ...
  }
}
```

#### B. Suggested Products API (`api/suggested-products/index.ts`)

**Endpoint:** `GET /api/suggested-products`

**Query Parameters:**
- `season` (required) - 'spring' | 'summer' | 'autumn' | 'winter'
- `group` (required) - 'neutrals' | 'accents' | 'brights' | 'softs'
- `limit` (optional) - Number of results (default: 20, max: 100)
- `minDeltaE` (optional) - Filter by maximum ΔE (e.g., only show matches with ΔE < 5)

**Example:**
```
GET /api/suggested-products?season=spring&group=accents&limit=20
```

**Response:**
```json
{
  "products": [
    {
      "id": "...",
      "name": "Coral Blouse",
      "season_tag": "spring",
      "group_tag": "accents",
      "min_delta_e": 3.2,
      ...
    }
  ],
  "count": 15,
  "season": "spring",
  "group": "accents",
  "limit": 20
}
```

**Features:**
- Only returns products with `classification_status = 'ok'`
- Sorted by `min_delta_e` ascending (best matches first)
- Only active garments (`is_active = true`)
- Fast indexed queries

### 4. Frontend Integration

**File:** `screens/StyleVaultScreen.js`

**Updated Function:** `loadCategoryProducts(category)`

**Behavior:**
1. Tries to call `/api/suggested-products` endpoint first
2. Converts API response to product format
3. Falls back to old client-side filtering if API fails
4. Uses environment variable: `EXPO_PUBLIC_API_BASE` or `EXPO_PUBLIC_API_URL`

## Usage Examples

### 1. Classify a Garment on Upload

```typescript
import { classifyGarment } from '../lib/colorClassification';

const hex = '#FF6F61'; // Coral
const result = classifyGarment(hex);

console.log(result);
// {
//   seasonTag: 'spring',
//   groupTag: 'accents',
//   dominantHex: '#FF6F61',
//   lab: { L: 68.5, a: 45.2, b: 32.1 },
//   nearestPaletteColor: { name: 'Coral', hex: '#FF6F61' },
//   minDeltaE: 0.0,
//   classificationStatus: 'ok'
// }
```

### 2. Create Garment with Classification

```javascript
const response = await fetch(`${API_BASE}/api/garments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Coral Blouse',
    category: 'upper',
    color_hex: '#FF6F61', // Classification happens automatically
    color: 'Coral',
    // ... other fields
  })
});
```

### 3. Query Suggested Products

```javascript
const response = await fetch(
  `${API_BASE}/api/suggested-products?season=spring&group=accents&limit=20`
);
const { products } = await response.json();
// Products are already sorted by match quality (min_delta_e)
```

## Gating Logic Explained

### Gate 1: Minimum ΔE Threshold (12)

**Purpose:** Prevent false matches for colors that are too far from any palette color.

**Rule:** If `minDeltaE > 12`, the color is marked as `unclassified`.

**Rationale:** 
- ΔE < 1: Not perceptible
- ΔE 1-2: Perceptible on close inspection
- ΔE 2-10: Perceptible at a glance
- ΔE > 12: Colors are clearly different

**Example:**
```typescript
// A very dark brown (#1A1A1A) might have ΔE > 12 from all palette colors
// Result: { classificationStatus: 'unclassified', seasonTag: null, groupTag: null }
```

### Gate 2: Ambiguity Detection (ΔE difference < 2)

**Purpose:** Prevent classification when multiple seasons/groups are equally close.

**Rule:** If `(runnerUpDeltaE - bestDeltaE) < 2`, the match is marked as `ambiguous`.

**Rationale:** When two matches are within 2 ΔE of each other, the classification is uncertain.

**Example:**
```typescript
// A color might be:
// - Spring Accents: ΔE = 4.5
// - Summer Softs: ΔE = 5.8
// Difference = 1.3 < 2 → ambiguous
// Result: { classificationStatus: 'ambiguous', seasonTag: null, groupTag: null }
```

## Sanity Tests

### Test 1: Coral (#FF7F50)
```typescript
const result = classifyGarment('#FF7F50');
// Expected: spring → accents (or brights)
// Should NOT match: summer, winter softs
```

### Test 2: Dusty Rose (#D8A7A7)
```typescript
const result = classifyGarment('#D8A7A7');
// Expected: summer → softs
// Should NOT match: winter brights
```

### Test 3: Charcoal (#333333)
```typescript
const result = classifyGarment('#333333');
// Expected: autumn or winter → neutrals
// Should NOT match: spring brights
```

### Test 4: Unclassified Color
```typescript
const result = classifyGarment('#000000'); // Pure black
// If minDeltaE > 12: { classificationStatus: 'unclassified' }
```

## Performance Considerations

1. **Precomputed Lab Values:** All palette colors have Lab values computed once at module load
2. **Database Indexes:** Fast queries by season + group
3. **Classification on Upload:** Classification happens once, not on every query
4. **Sorted Results:** Database sorts by `min_delta_e` (indexed)

## Migration Steps

1. **Run Database Migration:**
   ```sql
   -- Execute scripts/ADD_COLOR_CLASSIFICATION_TO_GARMENTS.sql in Supabase
   ```

2. **Deploy API Changes:**
   - Deploy updated `api/garments/index.ts`
   - Deploy new `api/suggested-products/index.ts`

3. **Update Frontend:**
   - Frontend automatically uses new API if available
   - Falls back to old method if API URL not configured

4. **Reclassify Existing Garments (Optional):**
   ```sql
   -- Update existing garments with color_hex
   UPDATE garments 
   SET 
     dominant_hex = color_hex,
     lab_l = ...,
     season_tag = ...,
     ...
   WHERE color_hex IS NOT NULL;
   ```

## Troubleshooting

### Issue: No products returned from suggested-products API

**Check:**
1. Are garments classified? (`classification_status = 'ok'`)
2. Do garments have `color_hex` set?
3. Are garments active? (`is_active = true`)

### Issue: Classification returns 'unclassified'

**Possible causes:**
1. Color is too far from palette (ΔE > 12)
2. Color hex is invalid
3. Check `min_delta_e` value in database

### Issue: Classification returns 'ambiguous'

**Possible causes:**
1. Color is equally close to multiple seasons/groups
2. Check both `min_delta_e` and runner-up ΔE values
3. Consider adjusting ambiguity threshold (currently 2)

## Future Enhancements

1. **CIEDE2000:** More accurate ΔE calculation (currently using CIE76)
2. **Batch Classification:** Classify multiple garments at once
3. **Reclassification Endpoint:** Reclassify all garments with updated palette
4. **Classification Confidence Score:** Return confidence percentage
5. **Multi-Color Support:** Classify garments with multiple colors

## References

- [CIE Lab Color Space](https://en.wikipedia.org/wiki/CIELAB_color_space)
- [Delta E](https://en.wikipedia.org/wiki/Color_difference#Delta_E)
- [sRGB Color Space](https://en.wikipedia.org/wiki/SRGB)
