# FitCheck Scoring Fixes

## Issues Identified

1. **Wrong answers for browns in autumn**: System was only checking against user's specific micro-season palette, not all autumn micro-seasons
2. **Delta E alone insufficient**: Need to also analyze garment's undertone/depth/clarity and compare to user's
3. **Micro-note implementation wrong**: Should be contextual advice only for OK/Risky, not always shown

## Fixes Implemented

### 1. Check ALL Micro-Seasons in Parent Season

**Problem**: A brown color for autumn user was marked "risky" because it only checked against the user's specific micro-season (e.g., soft_autumn), but browns work for ALL autumn types.

**Solution**: Now checks against ALL micro-seasons in the parent season:
```javascript
// Get all micro-seasons for the user's parent season
const allMicroSeasonsForSeason = Object.keys(MICRO_TO_PARENT)
  .filter(ms => MICRO_TO_PARENT[ms] === userSeason);

// Check distance to colors in ALL autumn micro-seasons
for (const ms of allMicroSeasonsForSeason) {
  const palette = getMicroSeasonPalette(ms);
  // ... check all colors in this palette
}
```

### 2. Added Undertone/Depth/Clarity Analysis

**Problem**: Delta E distance alone doesn't tell us WHY a color works or doesn't work. We need to understand if the garment's attributes match the user's.

**Solution**: Now computes garment's undertone, depth, and clarity from Lab values:
```javascript
// Compute garment's attributes
const garmentUndertone = computeGarmentUndertone(garmentLab);
const garmentDepth = computeGarmentDepth(garmentLab);
const garmentClarity = computeGarmentClarity(garmentLab);

// Check compatibility
const attributeCompatibility = checkAttributeCompatibility(
  garmentUndertone, garmentDepth, garmentClarity,
  userSeason, userDepth, userClarity
);
```

**Functions**:
- `computeGarmentUndertone(lab)`: Uses b* - 0.5*a* to determine warm/cool/neutral
- `computeGarmentDepth(lab)`: Uses L* (lightness) to determine light/medium/deep
- `computeGarmentClarity(lab)`: Uses chroma (sqrt(a²+b²)) to determine muted/clear

### 3. Combined Scoring: Delta E + Attribute Compatibility

**Problem**: A color might have high ΔE but still work if attributes match (e.g., brown for autumn).

**Solution**: Rating now considers BOTH:
```javascript
// Adjust rating based on both ΔE and attribute compatibility
if (minDistance <= 8 && attributeCompatibility.score >= 2) {
  rating = 'great';
} else if (minDistance <= 14 && attributeCompatibility.score >= 1) {
  rating = 'good';
} else if (minDistance <= 22 && attributeCompatibility.score >= 0) {
  rating = 'ok';
} else if (minDistance <= 30 && attributeCompatibility.score >= -1) {
  // If attributes match well, be more lenient with ΔE
  rating = 'ok';
} else {
  rating = 'risky';
}

// Special case: Same parent season + good attributes = upgrade rating
if (closestMicroSeason && MICRO_TO_PARENT[closestMicroSeason] === userSeason) {
  if (attributeCompatibility.score >= 1 && minDistance <= 35) {
    if (rating === 'risky') rating = 'ok';
    else if (rating === 'ok' && minDistance <= 25) rating = 'good';
  }
}
```

### 4. Attribute Compatibility Scoring

**Function**: `checkAttributeCompatibility()`

**Scoring**:
- Undertone match: +1 point (warm for autumn/spring, cool for summer/winter)
- Depth match: +1 point (same depth)
- Clarity match: +1 point (same clarity)
- Adjacent values: +0.5 points (e.g., light-medium, medium-deep)
- Mismatches: -0.5 to -1 points

**Total score**: 2 = perfect, 1 = good, 0 = neutral, -1 = mismatch, -2 = strong mismatch

### 5. Fixed Micro-Note Implementation

**Problem**: Micro-note was always shown, not contextual.

**Solution**: Now only shows for OK/Risky with specific advice:
```javascript
{(colorSuitability?.verdict === 'ok' || colorSuitability?.verdict === 'risky') && (
  <Text style={styles.colorMicroNote}>
    💡 Near your face matters most. {colorSuitability?.verdict === 'risky' 
      ? 'Consider wearing this away from your face or layering with a season-friendly piece near your face.'
      : 'Try layering with a season-friendly piece near your face for best results.'}
  </Text>
)}
```

### 6. Improved Explanations

**Problem**: Explanations didn't explain WHY based on specific mismatches.

**Solution**: Now includes specific mismatch reasons:
```javascript
const mismatchReasons = [];
if (attributeCompatibility?.reasons?.includes('undertone_mismatch')) {
  mismatchReasons.push('undertone mismatch');
}
if (attributeCompatibility?.reasons?.includes('clarity_mismatch')) {
  mismatchReasons.push('clarity mismatch');
}
// ... build specific explanation
```

## How It Works Now

1. **Convert garment hex → Lab**
2. **Check distance to ALL micro-seasons in parent season** (not just user's)
3. **Compute garment's undertone/depth/clarity** from Lab
4. **Compare attributes to user's** (compatibility score)
5. **Combine ΔE + attribute score** for final rating
6. **Upgrade rating** if same parent season + good attributes
7. **Generate explanation** with specific mismatch reasons

## Example: Brown for Autumn

**Before**: Brown (#8B4513) might be ΔE=25 from soft_autumn palette → "Risky"

**After**: 
- ΔE=25 from closest autumn micro-season
- Undertone: warm ✓ (matches autumn)
- Depth: medium/deep ✓ (matches autumn)
- Clarity: muted ✓ (matches autumn)
- Attribute score: +2 (perfect match)
- **Result**: "Good" or "OK" (upgraded from risky)

## Testing

To test, try:
- Brown (#8B4513) for autumn user → Should be "Good" or "OK", not "Risky"
- Warm beige (#E6D5B8) for autumn user → Should be "Great"
- Cool blue (#007BFF) for autumn user → Should be "Risky" (undertone mismatch)

## Files Modified

1. `lib/colorScoring.js` - Complete rewrite with attribute analysis
2. `components/AskAISheet.js` - Fixed micro-note to be contextual
