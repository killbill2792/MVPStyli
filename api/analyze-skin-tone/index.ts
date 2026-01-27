/**
 * Skin Tone + Season API (Sharp-only, production-friendly)
 * Improvements:
 * - Stronger skin sampling (ellipse mask + HSV+Lab candidate gate)
 * - Shadow + highlight rejection using L* percentiles
 * - Better color constancy: Shades-of-Gray (p-norm)
 * - Returns top-2 season candidates + confidence
 * - "needsConfirmation" is honest and meaningful
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

type Undertone = 'warm' | 'cool' | 'neutral';
type Depth = 'light' | 'medium' | 'deep';
type Clarity = 'muted' | 'clear' | 'vivid';
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

type DetectionMethod = 'provided' | 'cropInfo' | 'faceBox' | 'heuristic';

type CropInfoInput = { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number };
type FaceBoxInput = { x: number; y: number; width: number; height: number }; // normalized 0..1
type BoxPx = { x: number; y: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// RGB -> HSV (0..360, 0..1, 0..1)
function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

// RGB -> Lab (D65)
function rgbToLab(r: number, g: number, blue: number) {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = blue / 255;

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  let x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) / 0.95047;
  let y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175) / 1.0;
  let z = (rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);
  return { l, a, b };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function mad(values: number[]): number {
  if (!values.length) return 0;
  const med = median(values);
  return median(values.map(v => Math.abs(v - med)));
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.floor(p * (s.length - 1)), 0, s.length - 1);
  return s[idx];
}

/**
 * Stronger "skin candidate" filter.
 * Classic fast gating that works well in production to prevent "always Autumn" bias.
 */
function isSkinCandidate(r: number, g: number, b: number): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);

  // brightness window
  if (v < 0.22 || v > 0.95) return false;

  // saturation window (raise the floor so gray pixels don't pass)
  if (s < 0.12 || s > 0.65) return false;

  // Hue gate: skin is mostly in red/orange/yellow range (wrap-around handled)
  const skinHue = (h >= 0 && h <= 55) || (h >= 320 && h <= 360);
  if (!skinHue) return false;

  // RGB ordering + separation gate: reject hair/background
  // (tuned to be permissive across skin tones but still filter non-skin)
  if (!(r > g && g >= b)) return false;
  if ((r - g) < 8) return false;
  if ((r - b) < 18) return false;

  // reject near-white / blown highlights (often makeup + phone smoothing)
  if (r > 245 && g > 245 && b > 245) return false;

  // Lab gate (optional but helps)
  const lab = rgbToLab(r, g, b);
  if (lab.l < 18 || lab.l > 92) return false;
  if (lab.a < -8 || lab.a > 35) return false;
  if (lab.b < -5 || lab.b > 45) return false;

  return true;
}

/**
 * Shades-of-Gray color constancy on candidate pixels.
 */
function applyShadesOfGrayCorrection(
  samples: Array<{ r: number; g: number; b: number }>,
  pNorm: number = 6
): {
  corrected: Array<{ r: number; g: number; b: number }>;
  gains: { r: number; g: number; b: number };
  gainsClamped: boolean;
} {
  if (!samples.length) return { corrected: [], gains: { r: 1, g: 1, b: 1 }, gainsClamped: false };

  let sumRp = 0, sumGp = 0, sumBp = 0;
  for (const s of samples) {
    sumRp += Math.pow(s.r, pNorm);
    sumGp += Math.pow(s.g, pNorm);
    sumBp += Math.pow(s.b, pNorm);
  }
  const n = samples.length;
  const rP = Math.pow(sumRp / n, 1 / pNorm);
  const gP = Math.pow(sumGp / n, 1 / pNorm);
  const bP = Math.pow(sumBp / n, 1 / pNorm);

  if (rP < 10 || gP < 10 || bP < 10) return { corrected: samples, gains: { r: 1, g: 1, b: 1 }, gainsClamped: false };

  const M = (rP + gP + bP) / 3;
  let gainR = M / rP;
  let gainG = M / gP;
  let gainB = M / bP;

  const minGain = 0.70;
  const maxGain = 1.45;
  const before = { r: gainR, g: gainG, b: gainB };
  gainR = clamp(gainR, minGain, maxGain);
  gainG = clamp(gainG, minGain, maxGain);
  gainB = clamp(gainB, minGain, maxGain);
  const gainsClamped = before.r !== gainR || before.g !== gainG || before.b !== gainB;

  const corrected = samples.map(s => ({
    r: clamp(Math.round(s.r * gainR), 0, 255),
    g: clamp(Math.round(s.g * gainG), 0, 255),
    b: clamp(Math.round(s.b * gainB), 0, 255),
  }));

  return { corrected, gains: { r: gainR, g: gainG, b: gainB }, gainsClamped };
}

function estimateWarmLightingBias(avg: { r: number; g: number; b: number }) {
  const rn = avg.r / 255, gn = avg.g / 255, bn = avg.b / 255;
  const warmIndex = (rn + gn) / 2 - bn;
  const isWarm = warmIndex > 0.08;
  const severity = clamp((warmIndex - 0.08) / 0.18, 0, 1);
  return { isWarm, severity, warmIndex: Math.round(warmIndex * 1000) / 1000 };
}

/**
 * Compute robust Lab statistics from Lab samples.
 * Returns median Lab, MAD values, median chroma, and sample count.
 */
function computeRobustLabStats(labSamples: Array<{ l: number; a: number; b: number }>) {
  if (!labSamples.length) {
    return {
      medianLab: { l: 0, a: 0, b: 0 },
      mad: { l: 0, a: 0, b: 0 },
      medianChroma: 0,
      chromaP70: 0,
      sampleCount: 0,
    };
  }

  const Ls = labSamples.map(x => x.l);
  const As = labSamples.map(x => x.a);
  const Bs = labSamples.map(x => x.b);

  const medL = median(Ls);
  const medA = median(As);
  const medB = median(Bs);

  const madLVal = mad(Ls);
  const madAVal = mad(As);
  const madBVal = mad(Bs);

  const chromas = labSamples.map(x => Math.sqrt(x.a * x.a + x.b * x.b));
  const medianChroma = median(chromas);

  // NEW: percentile chroma (more stable than median for faces)
  const chromaP70 = percentile(chromas, 0.70);

  return {
    medianLab: { l: medL, a: medA, b: medB },
    mad: { l: madLVal, a: madAVal, b: madBVal },
    medianChroma,
    chromaP70,
    sampleCount: labSamples.length,
  };
}

function computeUndertone(params: {
  a: number;
  b: number;
  chroma: number;
  lightingSeverity: number;
}) {
  const { a, b, chroma, lightingSeverity } = params;

  // warmth proxy: b relative to a (yellow vs pink)
  // Higher warmth => warmer (more yellow), lower => cooler (more pink)
  const warmth = b - 0.5 * a;

  let undertone: Undertone = 'neutral';
  let lean: 'warm' | 'cool' | undefined;

  if (warmth > 12) undertone = 'warm';
  else if (warmth < 6) undertone = 'cool';
  else {
    undertone = 'neutral';
    lean = warmth >= 9 ? 'warm' : 'cool';
  }

  let confidence = clamp(0.55 + (Math.min(chroma, 18) / 18) * 0.25, 0.55, 0.85);
  if (lightingSeverity > 0.35) confidence = clamp(confidence - 0.08, 0, 1);

  return { undertone, lean, chroma, confidence };
}

function computeDepth(params: { l: number; madL: number }) {
  const { l, madL } = params;
  let depth: Depth = l > 65 ? 'light' : l <= 45 ? 'deep' : 'medium';
  const dist = Math.min(Math.abs(l - 65), Math.abs(l - 45));
  let confidence = clamp(0.62 + dist / 28, 0.55, 0.92);
  if (madL > 10) confidence = clamp(confidence - 0.06, 0, 1);
  return { depth, confidence };
}

function computeClarity(params: { a: number; b: number; chroma: number; madB: number }) {
  const { chroma, madB } = params;
  let clarity: Clarity = chroma < 10 ? 'muted' : chroma < 18 ? 'clear' : 'vivid';
  const d = Math.min(Math.abs(chroma - 10), Math.abs(chroma - 18));
  let confidence = clamp(0.55 + d / 10, 0.55, 0.9);
  if (madB > 4.5) confidence = clamp(confidence - 0.06, 0, 1);
  return { clarity, chroma, confidence };
}

/**
 * Season scoring (returns top-2 candidates).
 * This alone boosts real-world accuracy because “hard” cases are inherently ambiguous.
 */
function computeSeason(params: {
  undertone: Undertone;
  lean?: 'warm' | 'cool';
  depth: Depth;
  clarity: Clarity;
  l: number;
  a: number;
  b: number;
  C: number;
  warmLightingSeverity: number;
  undertoneConfidence: number;
  depthConfidence: number;
  clarityConfidence: number;
}): Array<{ season: Season; score: number; reason: string }> {
  // CRITICAL: Log entry to verify function is called
  console.log('🎨 [COMPUTE_SEASON] ========== FUNCTION CALLED ==========');
  console.log('🎨 [COMPUTE_SEASON] Input params:', {
    undertone: params.undertone,
    lean: params.lean,
    L: params.l.toFixed(2),
    C: params.C.toFixed(2),
    depth: params.depth,
    clarity: params.clarity,
  });

  const { undertone, lean, L, C } = {
    undertone: params.undertone,
    lean: params.lean,
    L: params.l,
    C: params.C,
  };

  // CRITICAL FIX: Neutral + very muted (C < 7) should return Summer/Autumn based on L + lean
  // This is the PRIMARY fix for "always autumn" issue
  // Changed threshold from C < 6 to C < 7 to catch borderline cases
  if (params.undertone === 'neutral' && params.C < 7) {
    console.log('🎨 [COMPUTE_SEASON] ✅ OVERRIDE TRIGGERED: Neutral + C<7 detected');
    console.log('🎨 [COMPUTE_SEASON] C value:', params.C.toFixed(2), '< 7, L:', params.l.toFixed(2), 'lean:', params.lean);
    
    // Use L (lightness) to determine: Light → Summer, Dark → Autumn
    // FIXED: Adjusted thresholds - L > 52 is light, L < 48 is dark, 48-52 is medium
    const isLight = params.l > 52;
    const isDark = params.l < 48;
    const isMedium = !isLight && !isDark; // 48 <= L <= 52
    
    let baseSummer = 0.75;
    let baseAutumn = 0.75;
    
    if (isLight) {
      // Light + muted → Summer is more likely
      baseSummer = 1.0;
      baseAutumn = (params.lean === 'warm') ? 0.80 : 0.65;
    } else if (isDark) {
      // Dark + muted → Autumn is more likely
      baseAutumn = 1.0;
      baseSummer = (params.lean === 'cool') ? 0.80 : 0.65;
    } else {
      // Medium (48-52): use lean STRONGLY to break tie
      // This is the key fix - medium cases should respect lean more
      if (params.lean === 'cool') {
        baseSummer = 1.0;
        baseAutumn = 0.75;
      } else if (params.lean === 'warm') {
        baseAutumn = 1.0;
        baseSummer = 0.75;
      } else {
        // No lean: truly ambiguous, give both high scores
        baseSummer = 0.90;
        baseAutumn = 0.90;
      }
    }

    const reasonSummer = isLight ? 'summer favored (light L>' + params.l.toFixed(1) + ')' : 
                          isDark ? 'summer less likely (dark L=' + params.l.toFixed(1) + ')' :
                          params.lean === 'cool' ? 'summer favored (medium, cool lean)' : 'summer/autumn ambiguous';
    const reasonAutumn = isDark ? 'autumn favored (dark L<' + params.l.toFixed(1) + ')' :
                          isLight ? 'autumn less likely (light L=' + params.l.toFixed(1) + ')' :
                          params.lean === 'warm' ? 'autumn favored (medium, warm lean)' : 'summer/autumn ambiguous';
    
    const out = [
      { season: 'summer' as const, score: baseSummer, reason: `neutral + very muted (C<7, L=${params.l.toFixed(1)}) → ${reasonSummer}` },
      { season: 'autumn' as const, score: baseAutumn, reason: `neutral + very muted (C<7, L=${params.l.toFixed(1)}) → ${reasonAutumn}` },
      { season: 'spring' as const, score: 0.15, reason: 'very low chroma (C<7) makes spring unlikely' },
      { season: 'winter' as const, score: 0.15, reason: 'very low chroma (C<7) makes winter unlikely' },
    ].sort((a, b) => b.score - a.score);

    // normalize
    const max = out[0].score || 1;
    const normalized = out.map(x => ({ ...x, score: x.score / max }));
    console.log('🎨 [COMPUTE_SEASON] Override result:', normalized.map(x => `${x.season}=${x.score.toFixed(3)}`).join(', '));
    console.log('🎨 [COMPUTE_SEASON] Winner:', normalized[0]?.season, 'L-based decision');
    return normalized;
  }
  
  console.log('🎨 [COMPUTE_SEASON] No override - proceeding with normal scoring');

  // SIMPLIFIED: Direct L/C-based scoring with undertone gating
  // No complex fallbacks - clear thresholds only
  const s: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  const why: Record<Season, string[]> = { spring: [], summer: [], autumn: [], winter: [] };

  console.log('🎨 [SCORING] Starting with:', { undertone, lean, L: L.toFixed(1), C: C.toFixed(1) });

  // Rule 1: Undertone gating - only allow matching seasons
  const canBeSpring = undertone === 'warm' || (undertone === 'neutral' && lean === 'warm');
  const canBeAutumn = undertone === 'warm' || (undertone === 'neutral' && lean === 'warm');
  const canBeSummer = undertone === 'cool' || (undertone === 'neutral' && lean === 'cool');
  const canBeWinter = undertone === 'cool' || (undertone === 'neutral' && lean === 'cool');
  
  console.log('🎨 [SCORING] Gating flags:', { canBeSpring, canBeAutumn, canBeSummer, canBeWinter });

  // Rule 2: Direct L/C threshold scoring (no normalized values, no fallbacks)
  
  // SPRING: Light (L > 55) + Good chroma (C > 10) + Warm undertone
  // IMPROVED: Better scoring for medium-light cases
  if (canBeSpring) {
    if (L > 62 && C > 10) {
      s.spring = 1.0;
      why.spring.push('L>62 and C>10: very light warm');
    } else if (L > 58 && C > 10) {
      s.spring = 0.85;
      why.spring.push('L>58 and C>10: light warm');
    } else if (L > 55 && C > 10) {
      s.spring = 0.70;
      why.spring.push('L>55 and C>10: medium-light warm');
    } else if (L > 52 && C > 12) {
      s.spring = 0.60;
      why.spring.push('L>52 and C>12: medium warm with good chroma');
    } else if (L > 50 && C > 8) {
      // IMPROVED: Require minimum chroma for medium cases
      s.spring = 0.50;
      why.spring.push('L>50 and C>8: medium warm with decent chroma');
    } else if (L > 50) {
      s.spring = 0.35;
      why.spring.push('L>50 but C<=8: medium warm but low chroma');
    } else {
      s.spring = 0.20;
      why.spring.push('L<=50: deeper warm (spring unlikely)');
    }
  }

  // AUTUMN: Deeper (L < 55) + Muted (C < 12) + Warm undertone
  // RESTRICTED: Only score autumn for clearly deep+muted cases, no fallback
  if (canBeAutumn) {
    if (L < 48 && C < 11) {
      s.autumn = 0.90;
      why.autumn.push('L<48 and C<11: deep muted warm');
    } else if (L < 50 && C < 12) {
      s.autumn = 0.75;
      why.autumn.push('L<50 and C<12: medium-deep muted warm');
    } else if (L < 52 && C < 12) {
      s.autumn = 0.60;
      why.autumn.push('L<52 and C<12: medium muted warm');
    } else if (L < 55 && C < 10) {
      // TIGHTER: Only if C < 10 (not 14), and L clearly below 55
      s.autumn = 0.50;
      why.autumn.push('L<55 and C<10: medium-light muted warm');
    } else if (L >= 55) {
      s.autumn = 0.10;
      why.autumn.push('L>=55: light warm (autumn very unlikely)');
    } else {
      // REMOVED FALLBACK: Don't give autumn points for ambiguous cases
      s.autumn = 0.0;
      why.autumn.push('ambiguous: not clearly deep+muted (no fallback)');
    }
  }

  // SUMMER: Light (L > 55) + Muted (C < 12) + Cool undertone
  if (canBeSummer) {
    if (L > 62 && C < 12) {
      s.summer = 1.0;
      why.summer.push('L>62 and C<12: very light muted cool');
    } else if (L > 58 && C < 12) {
      s.summer = 0.85;
      why.summer.push('L>58 and C<12: light muted cool');
    } else if (L > 55 && C < 12) {
      s.summer = 0.70;
      why.summer.push('L>55 and C<12: medium-light muted cool');
    } else if (L > 50) {
      s.summer = 0.50;
      why.summer.push('L>50: medium cool');
    } else {
      s.summer = 0.25;
      why.summer.push('L<=50: deeper cool (summer unlikely)');
    }
  }

  // WINTER: Deeper (L < 55) + Vivid (C > 12) + Cool undertone
  if (canBeWinter) {
    if (L < 50 && C > 14) {
      s.winter = 0.90;
      why.winter.push('L<50 and C>14: deep vivid cool');
    } else if (L < 52 && C > 12) {
      s.winter = 0.75;
      why.winter.push('L<52 and C>12: medium-deep vivid cool');
    } else if (L < 55 && C > 12) {
      s.winter = 0.60;
      why.winter.push('L<55 and C>12: medium vivid cool');
    } else if (L >= 55) {
      s.winter = 0.30;
      why.winter.push('L>=55: light cool (winter unlikely)');
    } else {
      s.winter = 0.40;
      why.winter.push('fallback: medium cool');
    }
  }

  // For neutral without lean, allow all but with reduced scores
  // RESTRICTED: Only boost if clearly in that season's zone
  if (undertone === 'neutral' && !lean) {
    console.log('🎨 [SCORING] Neutral without lean - applying neutral logic');
    // Recalculate with neutral logic - but be more restrictive
    if (L > 58 && C > 12) {
      s.spring = Math.max(s.spring, 0.55);
      why.spring.push('neutral no-lean: L>58 and C>12');
    }
    if (L > 60 && C < 12) {
      s.summer = Math.max(s.summer, 0.55);
      why.summer.push('neutral no-lean: L>60 and C<12');
    }
    if (L < 50 && C < 10) {
      // TIGHTER: C < 10 (not 11) for autumn
      s.autumn = Math.max(s.autumn, 0.55);
      why.autumn.push('neutral no-lean: L<50 and C<10');
    }
    if (L < 50 && C > 14) {
      s.winter = Math.max(s.winter, 0.55);
      why.winter.push('neutral no-lean: L<50 and C>14');
    }
  }

  const out = (Object.keys(s) as Season[])
    .map(season => ({ season, score: s[season], reason: why[season].join('; ') }))
    .sort((a, b) => b.score - a.score);

  // Log raw scores
  console.log('🎨 [SCORING] Raw scores:', 
    out.map(x => `${x.season}=${x.score.toFixed(3)}`).join(', '));
  console.log('🎨 [SCORING] Reasons:', 
    out.map(x => `${x.season}: ${x.reason}`).join(' | '));

  // Normalize to 0..1
  const max = out[0]?.score ?? 1;
  const normalized = out.map(x => ({ ...x, score: max > 0 ? x.score / max : 0 }));
  
  console.log('🎨 [SCORING] Normalized:', 
    normalized.map(x => `${x.season}=${x.score.toFixed(3)}`).join(', '));
  console.log('🎨 [SCORING] Winner:', normalized[0]?.season, 'score:', normalized[0]?.score.toFixed(3));
  
  // SAFETY CHECK: If all scores are very low (max < 0.1), log a warning
  if (max < 0.1) {
    console.warn('🎨 [SCORING] ⚠️ WARNING: All scores are very low (max=', max.toFixed(3), '). Results may be unreliable.');
    console.warn('🎨 [SCORING] This suggests the input values (L, C, undertone) are outside expected ranges.');
  }
  
  // SAFETY CHECK: If autumn wins but score is very close to others, log warning
  if (normalized[0]?.season === 'autumn' && normalized.length > 1) {
    const autumnScore = normalized[0].score;
    const secondScore = normalized[1].score;
    const diff = autumnScore - secondScore;
    if (diff < 0.05) {
      console.warn('🎨 [SCORING] ⚠️ WARNING: Autumn winning by tiny margin (diff=', diff.toFixed(3), '). Consider manual review.');
    }
  }
  
  return normalized;
}

function decidePrimarySeason(scored: Array<{ season: Season; score: number }>) {
  const top1 = scored[0];
  const top2 = scored[1];
  // confidence based on separation
  const sep = clamp((top1.score - (top2?.score ?? 0)) / 0.35, 0, 1);
  // base confidence
  const seasonConfidence = clamp(0.45 + 0.45 * sep, 0, 0.95);
  const needsConfirmation = seasonConfidence < 0.72;
  return { season: top1.season, seasonConfidence, needsConfirmation, sep };
}

async function loadImageBuffer(imageUrl?: string, imageBase64?: string): Promise<Buffer> {
  if (imageBase64) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    return Buffer.from(base64Data, 'base64');
  }
  if (imageUrl) {
    const resp = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkinToneAnalyzer/3.0)' } });
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status} ${resp.statusText}`);
    const ab = await resp.arrayBuffer();
    if (ab.byteLength === 0) throw new Error('Fetched image is empty');
    return Buffer.from(ab);
  }
  throw new Error('Missing image data');
}

async function loadImageWithOrientation(imageBuffer: Buffer): Promise<{ buffer: Buffer; metadata: sharp.Metadata }> {
  const rotated = sharp(imageBuffer).rotate();
  const metadata = await rotated.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Invalid image metadata');
  const rotatedBuffer = await rotated.toBuffer();
  return { buffer: rotatedBuffer, metadata };
}

function toIntBox(box: BoxPx): BoxPx {
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
}

function clampBox(box: BoxPx, imgW: number, imgH: number, minSize = 220): BoxPx | null {
  let x = Math.max(0, Math.round(box.x));
  let y = Math.max(0, Math.round(box.y));
  let width = Math.round(box.width);
  let height = Math.round(box.height);

  width = Math.min(width, imgW - x);
  height = Math.min(height, imgH - y);

  if (width < minSize || height < minSize) return null;
  if (x < 0 || y < 0 || x + width > imgW || y + height > imgH) return null;
  return { x, y, width, height };
}

function computeHeuristicFaceBox(imageWidth: number, imageHeight: number): BoxPx {
  const w = Math.floor(imageWidth * 0.55);
  const h = Math.floor(imageHeight * 0.55);
  const x = Math.floor((imageWidth - w) / 2);
  const y = Math.floor(imageHeight * 0.10);
  return { x, y, width: w, height: h };
}

/**
 * Improved sampling:
 * - ellipse mask centered in crop
 * - discard top/bottom bands (hair/chin)
 * - keep candidate pixels
 * - reject shadows/highlights using L* percentiles
 * - apply shades-of-gray correction on remaining samples
 */
async function sampleSkinFromFace(faceImage: Buffer) {
  const target = 220;
  const { data, info } = await sharp(faceImage).resize(target, target, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width || target;
  const H = info.height || target;
  const C = info.channels || 3;

  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const rx = W * 0.42;
  const ry = H * 0.48;

  const candidates: Array<{ r: number; g: number; b: number; l: number }> = [];
  const step = 3;
  
  // Track filtering statistics
  let totalInEllipse = 0;
  let totalAfterSpatial = 0;
  let totalAfterSkinCheck = 0;
  const rejectionReasons: Record<string, number> = {
    brightness: 0,
    saturation: 0,
    hue: 0,
    rgbOrder: 0,
    rgbSeparation: 0,
    nearWhite: 0,
    labBounds: 0,
  };

  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1.0) continue;
      
      totalInEllipse++;

      // Correct cheek-only sampling mask
      // exclude center strip (nose bridge / highlight zone)
      if (x > W * 0.42 && x < W * 0.58 && y > H * 0.18 && y < H * 0.78) continue;

      // exclude mouth zone
      if (y > H * 0.62) continue;

      totalAfterSpatial++;

        const idx = (y * W + x) * C;
        const r = data[idx];
        const g = data[idx + 1] ?? data[idx];
        const b = data[idx + 2] ?? data[idx];

      // Track rejection reasons for debugging
      const { h, s, v } = rgbToHsv(r, g, b);
      if (v < 0.22 || v > 0.95) { rejectionReasons.brightness++; continue; }
      if (s < 0.12 || s > 0.65) { rejectionReasons.saturation++; continue; }
      const skinHue = (h >= 0 && h <= 55) || (h >= 320 && h <= 360);
      if (!skinHue) { rejectionReasons.hue++; continue; }
      if (!(r > g && g >= b)) { rejectionReasons.rgbOrder++; continue; }
      if ((r - g) < 8 || (r - b) < 18) { rejectionReasons.rgbSeparation++; continue; }
      if (r > 245 && g > 245 && b > 245) { rejectionReasons.nearWhite++; continue; }
      const labCheck = rgbToLab(r, g, b);
      if (labCheck.l < 18 || labCheck.l > 92 || labCheck.a < -8 || labCheck.a > 35 || labCheck.b < -5 || labCheck.b > 45) {
        rejectionReasons.labBounds++;
        continue;
      }

      // Passed all checks
      totalAfterSkinCheck++;

      const lab = rgbToLab(r, g, b);
      candidates.push({ r, g, b, l: lab.l });
    }
  }

  // Log filtering statistics to verify isSkinCandidate() is working
  console.log('🎨 [FILTERING STATS] ========== PIXEL FILTERING ==========');
  console.log('🎨 [FILTERING STATS] totalInEllipse:', totalInEllipse);
  console.log('🎨 [FILTERING STATS] totalAfterSpatial (cheeks only):', totalAfterSpatial);
  console.log('🎨 [FILTERING STATS] totalAfterSkinCheck (isSkinCandidate):', totalAfterSkinCheck);
  console.log('🎨 [FILTERING STATS] skinRatio (afterSkinCheck / afterSpatial):', 
    totalAfterSpatial > 0 ? (totalAfterSkinCheck / totalAfterSpatial).toFixed(3) : 'N/A');
  console.log('🎨 [FILTERING STATS] Filtered out:', totalAfterSpatial - totalAfterSkinCheck, 'pixels');
  if (totalAfterSkinCheck === totalAfterSpatial) {
    console.warn('🎨 [FILTERING STATS] ⚠️ WARNING: isSkinCandidate() is not filtering any pixels!');
  }
  console.log('🎨 [FILTERING STATS] Rejection breakdown:', rejectionReasons);
  console.log('🎨 [FILTERING STATS] ===================================');

  if (candidates.length < 140) {
    return {
      ok: false as const,
      candidateCount: candidates.length,
      keptCount: 0,
      raw: [] as Array<{ r: number; g: number; b: number }>,
      corrected: [] as Array<{ r: number; g: number; b: number }>,
      gains: { r: 1, g: 1, b: 1 },
      gainsClamped: false,
      Lstats: { pL05: 0, pL90: 0, pL97: 0 },
    };
  }

  const Ls = candidates.map(p => p.l);
  const pL05 = percentile(Ls, 0.05);
  const pL90 = percentile(Ls, 0.90);
  const pL97 = percentile(Ls, 0.97);

  const kept = candidates.filter(p => p.l >= pL05 && p.l <= pL97);
  
  // Store raw samples before correction
  const raw = kept.map(p => ({ r: p.r, g: p.g, b: p.b }));

  const { corrected, gains, gainsClamped } = applyShadesOfGrayCorrection(
    raw,
    6
  );

  return {
    ok: true as const,
    candidateCount: candidates.length,
    keptCount: kept.length,
    raw,
    corrected,
    gains,
    gainsClamped,
    Lstats: { pL05, pL90, pL97 },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageUrl, imageBase64, cropInfo, faceBox, croppedFaceBase64 } = req.body as {
      imageUrl?: string;
      imageBase64?: string;
      cropInfo?: CropInfoInput;
      faceBox?: FaceBoxInput;
      croppedFaceBase64?: string;
    };

    let faceImageBuffer: Buffer;
    let method: DetectionMethod = 'heuristic';
    let cropBox: BoxPx | null = null;

    // lighting from full image or crop
    let overallAvg = { r: 0, g: 0, b: 0 };
    let lighting = { isWarm: false, severity: 0, warmIndex: 0 };

    if (croppedFaceBase64) {
      method = 'provided';
      const base64Data = croppedFaceBase64.includes(',') ? croppedFaceBase64.split(',')[1] : croppedFaceBase64;
      faceImageBuffer = Buffer.from(base64Data, 'base64');

      const o = await sharp(faceImageBuffer).resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const oC = o.info.channels || 3;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < o.data.length; i += oC) {
        sr += o.data[i];
        sg += o.data[i + 1] ?? o.data[i];
        sb += o.data[i + 2] ?? o.data[i];
        n++;
      }
      overallAvg = { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
      lighting = estimateWarmLightingBias(overallAvg);
    } else {
      const raw = await loadImageBuffer(imageUrl, imageBase64);
      const { buffer: img, metadata } = await loadImageWithOrientation(raw);
      const W = metadata.width!;
      const H = metadata.height!;

      // lighting from full image
      const o = await sharp(img).resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const oC = o.info.channels || 3;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < o.data.length; i += oC) {
        sr += o.data[i];
        sg += o.data[i + 1] ?? o.data[i];
        sb += o.data[i + 2] ?? o.data[i];
        n++;
      }
      overallAvg = { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
      lighting = estimateWarmLightingBias(overallAvg);

      if (cropInfo) {
        method = 'cropInfo';
        cropBox = clampBox(toIntBox({ x: cropInfo.x, y: cropInfo.y, width: cropInfo.width, height: cropInfo.height }), W, H, 220);
        if (!cropBox) return res.status(400).json({ error: 'INVALID_CROP_BOX' });
      } else if (faceBox) {
        method = 'faceBox';
        const px: BoxPx = { x: faceBox.x * W, y: faceBox.y * H, width: faceBox.width * W, height: faceBox.height * H };
        cropBox = clampBox(toIntBox(px), W, H, 220);
        if (!cropBox) return res.status(400).json({ error: 'INVALID_CROP_BOX' });
      } else {
        method = 'heuristic';
        cropBox = clampBox(computeHeuristicFaceBox(W, H), W, H, 220);
        if (!cropBox) return res.status(400).json({ error: 'FACE_NOT_DETECTED' });
      }

      faceImageBuffer = await sharp(img).extract({ left: cropBox.x, top: cropBox.y, width: cropBox.width, height: cropBox.height }).toBuffer();
    }

    const sampling = await sampleSkinFromFace(faceImageBuffer);
    if (!sampling.ok || sampling.corrected.length < 180) {
      return res.status(400).json({
        error: 'LOW_QUALITY_SAMPLES',
        message: 'Not enough usable skin pixels. Try daylight near a window, avoid shadows, no filters.',
        needsConfirmation: true,
        diagnostics: { method, cropBox, lighting, sampling },
      });
    }

    // Store references to ensure we don't accidentally overwrite
    const skinSamples = sampling.raw;  // RAW samples (before lighting correction)
    const correctedSamples = sampling.corrected;  // CORRECTED samples (after lighting correction)

    // 1) RAW stats (for undertone) - MUST use skinSamples
    const rawLabSamples = skinSamples.map(p => rgbToLab(p.r, p.g, p.b));
    const rawStats = computeRobustLabStats(rawLabSamples);
    
    // 2) CORRECTED stats (for depth/clarity/season stability) - MUST use correctedSamples
    const corrLabSamples = correctedSamples.map(p => rgbToLab(p.r, p.g, p.b));
    const corrStats = computeRobustLabStats(corrLabSamples);

    // Validation: Ensure counts match
    if (rawStats.sampleCount !== skinSamples.length) {
      console.error(`❌ [VALIDATION ERROR] rawStats.sampleCount (${rawStats.sampleCount}) !== skinSamples.length (${skinSamples.length})`);
    }
    if (corrStats.sampleCount !== correctedSamples.length) {
      console.error(`❌ [VALIDATION ERROR] corrStats.sampleCount (${corrStats.sampleCount}) !== correctedSamples.length (${correctedSamples.length})`);
    }

    // Log both raw and corrected stats BEFORE undertone computation
    console.log('🎨 [RAW STATS] ========== RAW STATS (for undertone) ==========');
    console.log('🎨 [RAW STATS] sampleCount:', rawStats.sampleCount, '(expected:', skinSamples.length, ')');
    console.log('🎨 [RAW STATS] medianLab:', {
      L: rawStats.medianLab.l.toFixed(2),
      a: rawStats.medianLab.a.toFixed(2),
      b: rawStats.medianLab.b.toFixed(2),
    });
    console.log('🎨 [RAW STATS] medianChroma:', rawStats.medianChroma.toFixed(2));
    console.log('🎨 [RAW STATS] ===================================================');

    console.log('🎨 [CORR STATS] ========== CORRECTED STATS (for depth/clarity) ==========');
    console.log('🎨 [CORR STATS] sampleCount:', corrStats.sampleCount, '(expected:', correctedSamples.length, ')');
    console.log('🎨 [CORR STATS] medianLab:', {
      L: corrStats.medianLab.l.toFixed(2),
      a: corrStats.medianLab.a.toFixed(2),
      b: corrStats.medianLab.b.toFixed(2),
    });
    console.log('🎨 [CORR STATS] medianChroma:', corrStats.medianChroma.toFixed(2));
    console.log('🎨 [CORR STATS] ===================================================');

    // Summary log for quick verification in Vercel logs
    console.log('🎨 [STATS SUMMARY] RAW:', {
      sampleCount: rawStats.sampleCount,
      skinSamplesLength: skinSamples.length,
      match: rawStats.sampleCount === skinSamples.length ? '✅' : '❌',
      medianLab: `L=${rawStats.medianLab.l.toFixed(1)}, a=${rawStats.medianLab.a.toFixed(1)}, b=${rawStats.medianLab.b.toFixed(1)}`,
      medianChroma: rawStats.medianChroma.toFixed(2),
    });
    console.log('🎨 [STATS SUMMARY] CORR:', {
      sampleCount: corrStats.sampleCount,
      correctedSamplesLength: correctedSamples.length,
      match: corrStats.sampleCount === correctedSamples.length ? '✅' : '❌',
      medianLab: `L=${corrStats.medianLab.l.toFixed(1)}, a=${corrStats.medianLab.a.toFixed(1)}, b=${corrStats.medianLab.b.toFixed(1)}`,
      medianChroma: corrStats.medianChroma.toFixed(2),
    });

    // Use chromaP70 (70th percentile) instead of medianChroma for better stability
    const corrChroma = (corrStats as any).chromaP70 ?? corrStats.medianChroma;
    const rawChroma = (rawStats as any).chromaP70 ?? rawStats.medianChroma;

    // Undertone MUST use RAW chromaP70
    const undertoneInfo = computeUndertone({
      a: rawStats.medianLab.a,
      b: rawStats.medianLab.b,
      chroma: rawChroma,
      lightingSeverity: lighting.severity, // only as confidence penalty, not to "correct" hue
    });

    // Use RAW for depth, CORRECTED chromaP70 for clarity/season
    const depthInfo = computeDepth({ l: rawStats.medianLab.l, madL: rawStats.mad.l });
    const clarityInfo = computeClarity({
      a: corrStats.medianLab.a,
      b: corrStats.medianLab.b,
      chroma: corrChroma,
      madB: corrStats.mad.b,
    });

    // Log raw chroma vs corrected chroma to verify the bug
    console.log('🎨 [CHROMA COMPARISON] RAW chromaP70:', rawChroma.toFixed(2), 'vs CORRECTED chromaP70:', corrChroma.toFixed(2), 
      'diff:', (rawChroma - corrChroma).toFixed(2));

    // DEBUG: Log undertone detection
    const warmth = rawStats.medianLab.b - 0.5 * rawStats.medianLab.a;
    console.log('🎨 [UNDERTONE DETECTION] ========== UNDERTONE ==========');
    console.log('🎨 [UNDERTONE DETECTION] Using RAW Lab values:', {
      L: rawStats.medianLab.l.toFixed(2),
      a: rawStats.medianLab.a.toFixed(2),
      b: rawStats.medianLab.b.toFixed(2),
      chroma: rawStats.medianChroma.toFixed(2),
      warmth: warmth.toFixed(2), // warmth = b - 0.5*a
    });
    console.log('🎨 [UNDERTONE DETECTION] Result:', {
      undertone: undertoneInfo.undertone,
      lean: undertoneInfo.lean,
      confidence: undertoneInfo.confidence.toFixed(3),
      lightingSeverity: lighting.severity.toFixed(3),
    });
    console.log('🎨 [UNDERTONE DETECTION] Depth (from RAW):', depthInfo);
    console.log('🎨 [UNDERTONE DETECTION] Clarity (from RAW):', clarityInfo);
    console.log('🎨 [UNDERTONE DETECTION] ==============================');

    // Season should use RAW undertone + CORRECTED chromaP70
    console.log('🎨 [HANDLER] About to call computeSeason with:', {
      undertone: undertoneInfo.undertone,
      lean: undertoneInfo.lean,
      C: corrChroma.toFixed(2),
      L: corrStats.medianLab.l.toFixed(2),
    });
    
    const ranked = computeSeason({
      undertone: undertoneInfo.undertone,
      lean: undertoneInfo.lean,
      depth: depthInfo.depth,
      clarity: clarityInfo.clarity,
      l: corrStats.medianLab.l,
      a: corrStats.medianLab.a,
      b: corrStats.medianLab.b,
      C: corrChroma,
      warmLightingSeverity: lighting.severity,
      undertoneConfidence: undertoneInfo.confidence,
      depthConfidence: depthInfo.confidence,
      clarityConfidence: clarityInfo.confidence,
    });
    
    console.log('🎨 [HANDLER] computeSeason returned:', ranked.map(r => `${r.season}=${r.score.toFixed(3)}`).join(', '));
    
    // DEBUG: Log scoring results to diagnose "always autumn" issue
    console.log('🎨 [SEASON SCORING] ========== SEASON SCORES ==========');
    console.log('🎨 [SEASON SCORING] Input:', {
      undertone: undertoneInfo.undertone,
      lean: undertoneInfo.lean,
      L: corrStats.medianLab.l.toFixed(2),
      C: corrChroma.toFixed(2),
      depth: depthInfo.depth,
      clarity: clarityInfo.clarity,
    });
    console.log('🎨 [SEASON SCORING] Note: Undertone from RAW, L/C from CORRECTED chromaP70');
    console.log('🎨 [SEASON SCORING] Ranked scores:', ranked.map(r => ({
      season: r.season,
      score: r.score.toFixed(3),
      reason: r.reason,
    })));
    console.log('🎨 [SEASON SCORING] ===================================');
    
    const top2 = ranked.slice(0, 2);
    
    // CRITICAL CHECK: If autumn is winning but scores are suspicious, investigate
    if (ranked[0]?.season === 'autumn') {
      console.log('🎨 [SEASON DECISION] ⚠️ AUTUMN IS WINNING - INVESTIGATING');
      console.log('🎨 [SEASON DECISION] All ranked scores:', ranked.map(r => ({
        season: r.season,
        score: r.score.toFixed(4),
        reason: r.reason.substring(0, 100),
      })));
      console.log('🎨 [SEASON DECISION] Top 2 scores:', top2.map(r => ({
        season: r.season,
        score: r.score.toFixed(4),
      })));
      
      // If autumn is winning but spring is very close, that's suspicious
      const springRank = ranked.findIndex(r => r.season === 'spring');
      if (springRank >= 0 && springRank < 3) {
        const springScore = ranked[springRank].score;
        const autumnScore = ranked[0].score;
        const diff = autumnScore - springScore;
        console.log('🎨 [SEASON DECISION] Spring rank:', springRank, 'Score diff:', diff.toFixed(4));
        if (diff < 0.05 && corrStats.medianLab.l > 50) {
          console.warn('🎨 [SEASON DECISION] ⚠️ WARNING: Autumn winning by tiny margin with L>50. This may be a bug!');
        }
      }
    }
    
    const primary = decidePrimarySeason(top2);
    
    console.log('🎨 [SEASON DECISION] Primary:', {
      season: primary.season,
      confidence: primary.seasonConfidence.toFixed(3),
      needsConfirmation: primary.needsConfirmation,
      separation: primary.sep.toFixed(3),
    });

    // quality / confirmation logic (realistic, not "always autumn")
    const isNoisy = corrStats.mad.b > 4.5 || corrStats.mad.l > 10;

    const qualityIssues: string[] = [];
    let needsConfirmation = primary.needsConfirmation;

    if (sampling.corrected.length < 260) { qualityIssues.push('Not enough stable pixels'); needsConfirmation = true; }
    if (isNoisy) { qualityIssues.push('Uneven lighting / shadows'); needsConfirmation = true; }
    if (lighting.severity > 0.45) { qualityIssues.push('Strong warm lighting cast'); needsConfirmation = true; }
    if (corrChroma < 4) { qualityIssues.push('Image too gray or washed out'); needsConfirmation = true; }

    const qualityMessages = needsConfirmation
      ? ['Try daylight near a window', 'Avoid heavy shadows', 'Disable beauty filters / HDR if possible']
      : [];

    // display rgb from corrected using trimmed mean
    const sorted = [...sampling.corrected].sort((p, q) => (p.r + p.g + p.b) - (q.r + q.g + q.b));
    const trim = Math.floor(sorted.length * 0.15);
    const kept = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
    let sr = 0, sg = 0, sb = 0;
    for (const p of kept) { sr += p.r; sg += p.g; sb += p.b; }
    const n = kept.length || 1;
    const rgb = { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

    // overall confidence
    let overallConfidence = 0.45 * undertoneInfo.confidence + 0.30 * depthInfo.confidence + 0.25 * clarityInfo.confidence;
    if (isNoisy) overallConfidence = clamp(overallConfidence - 0.08, 0, 1);
    if (sampling.gainsClamped) overallConfidence = clamp(overallConfidence - 0.06, 0, 1);
    overallConfidence = clamp(overallConfidence, 0, 0.95);

    const ms = Date.now() - start;

    // Determine micro-season internally (not shown to user, but used for color matching)
    let microSeason: string | null = null;
    try {
      const { determineMicroSeason } = await import('../../lib/colorClassification');
      microSeason = determineMicroSeason(
        primary.season,
        depthInfo.depth,
        clarityInfo.clarity
      );
    } catch (error) {
      console.warn('Could not determine micro-season:', error);
    }

    return res.status(200).json({
      rgb,
      hex,
      // Return corrected Lab for display only (season analysis uses RAW)
      lab: { l: Math.round(corrStats.medianLab.l * 10) / 10, a: Math.round(corrStats.medianLab.a * 10) / 10, b: Math.round(corrStats.medianLab.b * 10) / 10 },
      undertone: undertoneInfo.undertone,
      depth: depthInfo.depth,
      clarity: clarityInfo.clarity,

      // Primary season + confidence (shown to user)
      season: primary.season,
      seasonConfidence: Math.round(primary.seasonConfidence * 100) / 100,
      needsConfirmation,
      
      // Micro-season (internal use only, not displayed to user)
      microSeason: microSeason || null,

      // Top-2 to improve real-world accuracy and UX
      seasonCandidates: top2.map(x => ({
        season: x.season,
        score: Math.round(x.score * 100) / 100,
        reason: ranked.find(r => r.season === x.season)?.reason ?? '',
      })),

      confidence: Math.round(overallConfidence * 100) / 100,

      qualityIssues: qualityIssues.length ? qualityIssues : undefined,
      qualityMessages: qualityMessages.length ? qualityMessages : undefined,

      diagnostics: {
        method,
        cropBox,
        lighting: { ...lighting, overallAvg },
        sampling: {
          candidateCount: sampling.candidateCount,
          keptCount: sampling.keptCount,
          usedCount: sampling.corrected.length,
          Lstats: sampling.Lstats,
          correctionGains: sampling.gains,
          gainsClamped: sampling.gainsClamped,
        },
        robustStats: {
          madL: Math.round(corrStats.mad.l * 100) / 100,
          madB: Math.round(corrStats.mad.b * 100) / 100,
          chroma: Math.round(clarityInfo.chroma * 100) / 100,
        },
        labValues: {
          raw: {
            L: Math.round(rawStats.medianLab.l * 10) / 10,
            a: Math.round(rawStats.medianLab.a * 10) / 10,
            b: Math.round(rawStats.medianLab.b * 10) / 10,
            C: Math.round(rawStats.medianChroma * 10) / 10,
            sampleCount: rawStats.sampleCount,
          },
          corrected: {
            L: Math.round(corrStats.medianLab.l * 10) / 10,
            a: Math.round(corrStats.medianLab.a * 10) / 10,
            b: Math.round(corrStats.medianLab.b * 10) / 10,
            C: Math.round(corrStats.medianChroma * 10) / 10,
            sampleCount: corrStats.sampleCount,
          },
        },
        perf: { ms },
      },
    });
  } catch (e: any) {
    console.error('SKIN API error', e?.message ?? e);
    return res.status(500).json({
      error: e?.message ?? 'Unknown error',
      undertone: 'neutral',
      depth: 'medium',
      clarity: 'muted',
      season: 'autumn',
      seasonConfidence: 0,
      needsConfirmation: true,
      confidence: 0,
    });
  }
}