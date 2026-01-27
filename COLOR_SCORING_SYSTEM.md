# Season-Aware Color Compatibility System

## Overview

A unified color scoring system that works for all 12 micro-seasons (4 parent seasons) with strict attribute priority rules.

## Core Principles

### Attribute Priority (Strict Order)
1. **Undertone** (highest priority)
2. **Clarity** (most important after undertone)
3. **Depth** (lowest priority)
4. **Delta E** (distance measurement)

**Rule**: Delta E can NEVER override a clarity mismatch.

## Attribute Computation

### Garment Attributes (from HEX → LAB)

**Undertone:**
- Warm: `a* > 0 AND b* > 0`
- Cool: `a* < 0 OR b* < 0`
- Neutral: otherwise

**Depth:**
- Light: `L* > 70`
- Medium: `45 ≤ L* ≤ 70`
- Deep: `L* < 45`

**Clarity:**
- Muted: `chroma < 20`
- Medium: `20 ≤ chroma ≤ 30`
- Clear: `chroma > 30`

## Attribute Compatibility Scoring

### Undertone
- Exact match: +1
- Neutral overlap: +0.5
- Opposite: -2 (hard fail)

### Clarity (MOST IMPORTANT)
- Exact match: +1
- Adjacent (muted ↔ medium or medium ↔ clear): 0
- Mismatch (muted ↔ clear): -1.5

### Depth
- Exact match: +0.5
- Adjacent: +0.25
- Opposite (light ↔ deep): -1

## Rating Logic (Strict Rules)

### Rule 1: Undertone Mismatch
If undertone mismatch → **RISKY** (always, regardless of ΔE)

### Rule 2: Clarity Mismatch
If clarity mismatch → **max rating = OK** (ΔE can't override)

### Rule 3: Apply ΔE Thresholds
Only if undertone/clarity are compatible:
- ΔE ≤ 6 AND score ≥ 2 → **GREAT**
- ΔE ≤ 12 AND score ≥ 1 → **GOOD**
- ΔE ≤ 22 AND score ≥ 0 → **OK**
- Otherwise → **RISKY**

## Delta E Interpretation

- ΔE ≤ 6 → very close
- ΔE ≤ 10 → close
- ΔE ≤ 14 → acceptable
- ΔE ≤ 22 → weak
- ΔE > 22 → mismatch

**Note**: Delta E is computed only against the user's specific micro-season palette (not all parent season micro-seasons).

## Explanation Format

Each result includes:

1. **Summary** (one line)
   - Explains WHY the rating exists in plain English
   - No jargon

2. **Bullet 1 - Face Impact**
   - Explains visible effect (fresh/clear/lifted OR dull/grey/heavy/shadowed)

3. **Bullet 2 - What Usually Goes Wrong**
   - Explains common issues (washed out, harsh contrast, shadows, redness)

4. **Bullet 3 - How to Wear It Better** (only if rating ≠ Great)
   - Suggests layering, neckline opening, or moving color away from face
   - ❌ Never says "Try alternatives"
   - ✔ Explains WHY and HOW

## Consistency Rule

The same color MUST be classified the same way in:
- Palette screen
- FitCheck
- Suggested products

**No color may appear as:**
- "Recommended" in palette
- "Risky" in FitCheck

If mismatch occurs → logic is wrong.

## UI Language Rules

- Avoid jargon unless explained
- Instead of "Clarity mismatch" → "This color is brighter than your natural softness"
- Human-readable explanations only

## Validation

Before returning a result, the system confirms:
1. Undertone match
2. Clarity alignment
3. Depth alignment
4. Then applies Delta E

If clarity fails → downgrade rating regardless of ΔE.

## Examples

### Example 1: Great Match
- Garment: Warm, Medium, Muted
- User: Autumn, Warm, Medium, Muted
- ΔE: 4
- **Result**: GREAT

### Example 2: Clarity Mismatch
- Garment: Warm, Medium, Clear
- User: Autumn, Warm, Medium, Muted
- ΔE: 8
- **Result**: OK (clarity mismatch limits to OK)

### Example 3: Undertone Mismatch
- Garment: Cool, Medium, Muted
- User: Autumn, Warm, Medium, Muted
- ΔE: 5
- **Result**: RISKY (undertone mismatch = always risky)

## Implementation Files

- `lib/colorScoring.js` - Main scoring logic
- `lib/colorClassification.ts` - Color space conversions and palettes
- `lib/styleSuitability.js` - Integration with FitCheck
- `components/AskAISheet.js` - UI display

## Global Application

All rules work dynamically for all 12 micro-seasons:
- No hardcoded logic for any single season
- Same rules apply to Spring, Summer, Autumn, Winter
- Micro-season determined from parent season + depth + clarity
