# Micro-Season Determination Logic

## How Micro-Season is Determined

The micro-season is determined from:
- **Parent Season** (spring, summer, autumn, winter)
- **Depth** (light, medium, deep)
- **Clarity** (muted, clear, vivid)

## Mapping Rules

### Spring Micro-Seasons

1. **Light Spring**
   - Depth: `light`
   - Clarity: `muted` or `clear`
   - Characteristics: Warm • Light • Delicate

2. **Warm Spring** (True Spring)
   - Depth: `medium`
   - Clarity: `clear` or `vivid`
   - Characteristics: Warm • Bright • Clear
   - **Default** for Spring

3. **Bright Spring**
   - Depth: `medium` or `light`
   - Clarity: `vivid` or `clear`
   - Characteristics: Warm • Clear • Vibrant

### Summer Micro-Seasons

1. **Soft Summer**
   - Clarity: `muted`
   - Characteristics: Cool • Soft • Muted

2. **Cool Summer** (True Summer)
   - Default for Summer
   - Characteristics: Cool • Soft • Airy

3. **Light Summer**
   - Depth: `light`
   - Characteristics: Cool • Light • Soft

### Autumn Micro-Seasons

1. **Deep Autumn** (True Autumn)
   - Depth: `deep`
   - Clarity: `clear` or `vivid`
   - Characteristics: Warm • Deep • Rich

2. **Soft Autumn**
   - Clarity: `muted`
   - Characteristics: Warm • Muted • Soft

3. **Warm Autumn**
   - Default for Autumn
   - Characteristics: Warm • Muted • Earthy

### Winter Micro-Seasons

1. **Bright Winter**
   - Clarity: `vivid` or `clear`
   - Characteristics: Cool • Bright • Clear

2. **Cool Winter** (True Winter)
   - Default for Winter
   - Characteristics: Cool • Deep • High Contrast

3. **Deep Winter**
   - Depth: `deep`
   - Characteristics: Cool • Deep • Saturated

## Examples

**User 1:**
- Parent: Autumn
- Depth: Deep
- Clarity: Clear
- → **Deep Autumn**

**User 2:**
- Parent: Spring
- Depth: Light
- Clarity: Muted
- → **Light Spring**

**User 3:**
- Parent: Summer
- Depth: Medium
- Clarity: Muted
- → **Soft Summer**

**User 4:**
- Parent: Winter
- Depth: Deep
- Clarity: Vivid
- → **Bright Winter** (clarity takes priority)

## Implementation

Function: `determineMicroSeason(parentSeason, depth, clarity)`

Located in: `lib/colorClassification.ts`

Used by:
- `api/analyze-skin-tone/index.ts` - Determines micro-season from analysis
- `lib/styleSuitability.js` - Uses micro-season for FitCheck
- `screens/StyleVaultScreen.js` - Gets micro-season palette colors
