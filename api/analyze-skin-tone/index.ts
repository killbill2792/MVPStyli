/**
 * Skin Tone Analysis API (Production-Friendly with Enhanced Heuristic Face Detection)
 * - Uses enhanced heuristic face detection with strict validation
 * - Multiple validation checks to ensure face presence
 * - Robust sampling inside detected faceBox (many samples, trimmed mean)
 * - Simple skin-pixel filter to avoid beard/eyes/lips
 * - Lighting bias detection (warm cast) and confidence penalty
 * - ALWAYS returns a season (never null), but includes:
 *    - seasonConfidence
 *    - needsConfirmation (UI can ask user to confirm/change)
 *
 * No paid APIs. Uses Sharp only (lightweight, works on Vercel).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

type Undertone = 'warm' | 'cool' | 'neutral';
type Depth = 'light' | 'medium' | 'deep';
type Clarity = 'muted' | 'clear' | 'vivid';
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

type FaceBox = { x: number; y: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

// Convert RGB to Lab (D65)
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

// Convert RGB to HSV for saturation measure
function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
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

/**
 * Lab-based skin pixel check (more stable than RGB rules).
 * Uses Lab color space for better skin tone detection across diverse lighting.
 */
function isLikelySkinPixelFromLab(lab: { l: number; a: number; b: number }): boolean {
  const { l, a, b } = lab;
  // Lab-based skin filtering - broad enough for many skin tones but excludes extreme colors
  if (l < 18 || l > 92) return false; // Lightness range
  if (a < -5 || a > 28) return false; // Red-green axis
  if (b < 0 || b > 38) return false; // Yellow-blue axis
  return true;
}

/**
 * Lightweight RGB skin-pixel check (fallback for initial filtering).
 * Purpose: avoid sampling beard/eyes/lips/background.
 * Updated per spec: remove strict RGB minimums, use brightness check instead.
 */
function isLikelySkinPixel(r: number, g: number, b: number) {
  // Brightness check (replaces individual RGB minimums)
  const brightness = r + g + b;
  if (brightness < 60) return false; // Too dark

  // Balanced brightness range - skin can vary widely
  const v = brightness / (3 * 255);
  if (v < 0.12 || v > 0.90) return false;

  // Skin typically has R > G > B, with R higher than B
  const rb = r - b;
  if (rb < 5) return false;

  // Skin has moderate saturation - allow wider range (per spec: >= 0.04, cap at 0.65)
  const { s } = rgbToHsv(r, g, b);
  if (s < 0.04 || s > 0.65) return false;

  // Avoid extreme red (lips, red objects)
  if (r > 220 && g < 80 && b < 80) return false;

  // Skin typically has R >= G (skin is warm, not green-tinted)
  if (r < g - 10) return false;

  // Additional check: skin typically has G closer to R than to B
  const rgDiff = Math.abs(r - g);
  const gbDiff = Math.abs(g - b);
  if (gbDiff > rgDiff * 2.0) return false;

  return true;
}

/**
 * Apply gray-world lighting correction to skin samples.
 * Uses face region RGB average as illuminant proxy.
 * Returns corrected samples and correction metadata.
 */
function applyLightingCorrection(
  samples: Array<{ r: number; g: number; b: number }>
): {
  corrected: Array<{ r: number; g: number; b: number }>;
  gains: { r: number; g: number; b: number };
  gainsClamped: boolean;
} {
  if (samples.length === 0) {
    return { corrected: [], gains: { r: 1, g: 1, b: 1 }, gainsClamped: false };
  }

  // Compute mean RGB of skin samples (trimmed mean for robustness)
  const sorted = [...samples].sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  const trim = Math.floor(sorted.length * 0.1); // 10% trim
  const kept = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
  
  let sumR = 0, sumG = 0, sumB = 0;
  for (const s of kept) {
    sumR += s.r;
    sumG += s.g;
    sumB += s.b;
  }
  const n = kept.length || 1;
  const rBar = sumR / n;
  const gBar = sumG / n;
  const bBar = sumB / n;

  // Skip correction if too dark/invalid
  if (rBar < 10 || gBar < 10 || bBar < 10) {
    return { corrected: samples, gains: { r: 1, g: 1, b: 1 }, gainsClamped: false };
  }

  // Compute gains
  const M = (rBar + gBar + bBar) / 3;
  let gainR = M / rBar;
  let gainG = M / gBar;
  let gainB = M / bBar;

  // Clamp gains to avoid crazy corrections
  const minGain = 0.75;
  const maxGain = 1.35;
  let gainsClamped = false;
  if (gainR < minGain || gainR > maxGain) {
    gainR = clamp(gainR, minGain, maxGain);
    gainsClamped = true;
  }
  if (gainG < minGain || gainG > maxGain) {
    gainG = clamp(gainG, minGain, maxGain);
    gainsClamped = true;
  }
  if (gainB < minGain || gainB > maxGain) {
    gainB = clamp(gainB, minGain, maxGain);
    gainsClamped = true;
  }

  // Apply correction to all samples
  const corrected = samples.map(s => ({
    r: clamp(Math.round(s.r * gainR), 0, 255),
    g: clamp(Math.round(s.g * gainG), 0, 255),
    b: clamp(Math.round(s.b * gainB), 0, 255),
  }));

  return {
    corrected,
    gains: { r: gainR, g: gainG, b: gainB },
    gainsClamped,
  };
}

/**
 * Compute median of array
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute Median Absolute Deviation (MAD)
 */
function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map(v => Math.abs(v - med));
  return median(deviations);
}

/**
 * Determine undertone using b* primarily (skin warmth = yellow).
 * Simple and conservative thresholds to reduce false confident calls.
 */
function determineUndertoneFromLab(
  lab: { l: number; a: number; b: number },
  lightingSeverity?: number
): {
  undertone: Undertone;
  confidence: number;
  chroma: number;
  warmScore: number;
  coolScore: number;
  lean?: 'warm' | 'cool';
} {
  const { a, b } = lab;
  const chroma = Math.sqrt(a * a + b * b);
  const warmth = b; // Simple and works
  const pink = a;

  // Adjust neutral band if lighting severity is high
  const neutralBandThreshold = lightingSeverity && lightingSeverity > 0.35 ? 8 : 6;

  console.log('🎨 [UNDERTONE] Computing undertone:', {
    a: a.toFixed(2),
    b: b.toFixed(2),
    chroma: chroma.toFixed(2),
    warmth: warmth.toFixed(2),
    pink: pink.toFixed(2),
    neutralBandThreshold,
    lightingSeverity,
  });

  // Undertone decision (conservative thresholds)
  let undertone: Undertone;
  let lean: 'warm' | 'cool' | undefined;

  if (Math.abs(b) < neutralBandThreshold) {
    // Neutral band: |b| < 6 (or 8 if high lighting)
    undertone = 'neutral';
    // Determine lean for neutral cases
    if (b > 0) {
      lean = 'warm';
    } else if (b < 0) {
      lean = 'cool';
    }
    console.log('🎨 [UNDERTONE] Neutral band detected:', { b: b.toFixed(2), lean });
  } else if (b >= 8) {
    // Warm: b >= 8
    undertone = 'warm';
    console.log('🎨 [UNDERTONE] Warm detected:', { b: b.toFixed(2) });
  } else if (b <= -8) {
    // Cool: b <= -8
    undertone = 'cool';
    console.log('🎨 [UNDERTONE] Cool detected:', { b: b.toFixed(2) });
  } else {
    // Between thresholds: "lean warm/cool" with lower confidence
    undertone = 'neutral';
    if (b > 0) {
      lean = 'warm';
    } else {
      lean = 'cool';
    }
    console.log('🎨 [UNDERTONE] Between thresholds, lean detected:', { b: b.toFixed(2), lean });
  }

  // Undertone confidence (simple)
  const undertoneStrength = clamp(Math.abs(b) / 12, 0, 1);
  let undertoneConfidence = 0.5 + 0.4 * undertoneStrength;

  // If in neutral band, force confidence <= 0.6
  if (Math.abs(b) < neutralBandThreshold) {
    undertoneConfidence = Math.min(undertoneConfidence, 0.6);
  }

  // Reduce confidence if lighting severity is high
  if (lightingSeverity && lightingSeverity > 0.35) {
    undertoneConfidence = clamp(undertoneConfidence - 0.1, 0, 1);
    console.log('🎨 [UNDERTONE] High lighting severity, reducing confidence by 0.1');
  }

  undertoneConfidence = clamp(undertoneConfidence, 0, 1);

  console.log('🎨 [UNDERTONE] Final result:', {
    undertone,
    lean,
    confidence: undertoneConfidence.toFixed(3),
    undertoneStrength: undertoneStrength.toFixed(3),
  });

  // For compatibility
  const warmScore = warmth;
  const coolScore = -warmth; // Negative b = cool

  return { undertone, confidence: undertoneConfidence, chroma, warmScore, coolScore, lean };
}

/**
 * Determine depth from L* (current thresholds are fine).
 * Light: L > 65, Medium: 45 < L <= 65, Deep: L <= 45
 */
function determineDepthFromL(l: number, madL?: number): { depth: Depth; confidence: number } {
  console.log('🎨 [DEPTH] Computing depth:', { l: l.toFixed(2), madL: madL?.toFixed(2) });
  
  // Current thresholds (OK per user)
  // Light: L > 65
  // Medium: 45 < L <= 65
  // Deep: L <= 45
  
  let depth: Depth;
  if (l > 65) {
    depth = 'light';
  } else if (l <= 45) {
    depth = 'deep';
  } else {
    depth = 'medium';
  }

  // Depth confidence
  const dist = Math.min(Math.abs(l - 65), Math.abs(l - 45));
  let conf_d = clamp(0.62 + dist / 28, 0.55, 0.92);
  
  // Subtract 0.06 if MAD_L noisy
  if (madL !== undefined && madL > 10) {
    conf_d = clamp(conf_d - 0.06, 0, 1);
    console.log('🎨 [DEPTH] MAD_L noisy, reducing confidence');
  }

  console.log('🎨 [DEPTH] Final result:', { depth, confidence: conf_d.toFixed(3) });

  return { depth, confidence: conf_d };
}

/**
 * Determine clarity using Lab chroma (not HSV saturation).
 * C = sqrt(a^2 + b^2)
 * Updated thresholds: Muted (C < 10), Clear (10 <= C < 18), Vivid (C >= 18)
 */
function determineClarityFromLab(lab: { a: number; b: number }, madB?: number): {
  clarity: Clarity;
  confidence: number;
  chroma: number;
  avgSat: number; // Still compute for debugging
} {
  // Compute chroma from corrected Lab
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);

  console.log('🎨 [CLARITY] Computing clarity:', {
    a: lab.a.toFixed(2),
    b: lab.b.toFixed(2),
    chroma: chroma.toFixed(2),
    madB: madB?.toFixed(2),
  });

  // Updated clarity thresholds
  // Muted: C < 10
  // Clear: 10 <= C < 18
  // Vivid: C >= 18
  let clarity: Clarity;
  if (chroma < 10) {
    clarity = 'muted';
  } else if (chroma < 18) {
    clarity = 'clear';
  } else {
    clarity = 'vivid';
  }

  // Clarity confidence (distance to nearest threshold)
  const d = Math.min(Math.abs(chroma - 10), Math.abs(chroma - 18));
  let conf_c = clamp(0.55 + d / 10, 0.55, 0.9);
  
  // Subtract 0.06 if MAD_b noisy
  if (madB !== undefined && madB > 4.5) {
    conf_c = clamp(conf_c - 0.06, 0, 1);
    console.log('🎨 [CLARITY] MAD_b noisy, reducing confidence');
  }

  console.log('🎨 [CLARITY] Final result:', {
    clarity,
    confidence: conf_c.toFixed(3),
    distanceToBoundary: d.toFixed(2),
  });

  // Still compute avgSat for debugging (but don't use for clarity)
  const avgSat = 0; // Will be computed from samples if needed

  return { clarity, confidence: conf_c, chroma, avgSat };
}

/**
 * Detect warm lighting cast using overall image average.
 * If R and G are significantly higher than B -> warm cast.
 */
function estimateWarmLightingBias(avg: { r: number; g: number; b: number }) {
  const rn = avg.r / 255,
    gn = avg.g / 255,
    bn = avg.b / 255;
  const warmIndex = (rn + gn) / 2 - bn; // positive => warm
  const isWarm = warmIndex > 0.08;
  const severity = clamp((warmIndex - 0.08) / 0.18, 0, 1);
  return { isWarm, severity, warmIndex: Math.round(warmIndex * 1000) / 1000 };
}

/**
 * Season selection with proper gating (especially for neutral undertone).
 * Rule 1: If undertone is Warm → only score Spring/Autumn
 * Rule 2: If undertone is Cool → only score Summer/Winter
 * Rule 3: If undertone is Neutral → DO NOT pick a single season unless "lean" exists
 */
function decideSeasonAlways(
  undertone: Undertone,
  depth: Depth,
  clarity: Clarity,
  undertoneConfidence: number,
  depthConfidence: number,
  clarityConfidence: number,
  warmLightingSeverity: number,
  labInfo?: { chroma: number; warmScore: number; coolScore: number; lean?: 'warm' | 'cool' },
  labValues?: { l: number; a: number; b: number },
  avgSat?: number,
  madB?: number,
  madL?: number,
  gainsClamped?: boolean
): { season: Season; seasonConfidence: number; needsConfirmation: boolean; reason: string } {
  const l = labValues?.l ?? 50;
  const a = labValues?.a ?? 0;
  const b = labValues?.b ?? 0;
  const C = labInfo?.chroma ?? Math.sqrt(a * a + b * b);
  const lean = labInfo?.lean;

  console.log('🎨 [SEASON] ========== SEASON DECISION START ==========');
  console.log('🎨 [SEASON] Inputs:', {
    undertone,
    depth,
    clarity,
    l: l.toFixed(2),
    a: a.toFixed(2),
    b: b.toFixed(2),
    C: C.toFixed(2),
    lean,
    undertoneConfidence: undertoneConfidence.toFixed(3),
    depthConfidence: depthConfidence.toFixed(3),
    clarityConfidence: clarityConfidence.toFixed(3),
    warmLightingSeverity: warmLightingSeverity.toFixed(3),
  });

  let season: Season;
  let seasonConfidence: number;
  let needsConfirmation: boolean;
  let reason: string;

  // Rule 1: Warm undertone → only Spring/Autumn
  if (undertone === 'warm') {
    console.log('🎨 [SEASON] Warm undertone detected - considering Spring/Autumn only');
    
    // Warm mapping:
    // If L > 60 and C >= 10 → Spring
    // Else → Autumn
    if (l > 60 && C >= 10) {
      season = 'spring';
      reason = `WARM → Spring (L=${l.toFixed(1)} > 60, C=${C.toFixed(1)} >= 10)`;
    } else {
      season = 'autumn';
      reason = `WARM → Autumn (L=${l.toFixed(1)} <= 60 or C=${C.toFixed(1)} < 10)`;
    }
    
    seasonConfidence = clamp(undertoneConfidence * 0.9, 0, 0.95);
    needsConfirmation = undertoneConfidence < 0.70 || seasonConfidence < 0.72;
    
    console.log('🎨 [SEASON] Warm result:', { season, seasonConfidence: seasonConfidence.toFixed(3), needsConfirmation });
  }
  // Rule 2: Cool undertone → only Summer/Winter
  else if (undertone === 'cool') {
    console.log('🎨 [SEASON] Cool undertone detected - considering Summer/Winter only');
    
    // Cool mapping:
    // If L > 55 and C < 12 → Summer
    // Else → Winter
    if (l > 55 && C < 12) {
      season = 'summer';
      reason = `COOL → Summer (L=${l.toFixed(1)} > 55, C=${C.toFixed(1)} < 12)`;
    } else {
      season = 'winter';
      reason = `COOL → Winter (L=${l.toFixed(1)} <= 55 or C=${C.toFixed(1)} >= 12)`;
    }
    
    seasonConfidence = clamp(undertoneConfidence * 0.9, 0, 0.95);
    needsConfirmation = undertoneConfidence < 0.70 || seasonConfidence < 0.72;
    
    console.log('🎨 [SEASON] Cool result:', { season, seasonConfidence: seasonConfidence.toFixed(3), needsConfirmation });
  }
  // Rule 3: Neutral undertone → use lean if available
  else {
    console.log('🎨 [SEASON] Neutral undertone detected - using lean logic');
    console.log('🎨 [SEASON] Neutral details:', { b: b.toFixed(2), lean, l: l.toFixed(2), C: C.toFixed(2) });
    
    // Neutral mapping (important):
    // If |b| < 6 (neutral):
    //   Candidate set = based on depth:
    //   If L <= 50 (deep): candidates = Autumn vs Winter
    //   If L > 50: candidates = Spring vs Summer
    //   Pick lean based on sign of b:
    //   If b > 0 → lean Autumn (or Spring for light)
    //   If b < 0 → lean Winter (or Summer for light)
    //   Always set needsConfirmation=true
    //   And cap seasonConfidence <= 0.55
    
    if (Math.abs(b) < 6) {
      // True neutral - use depth-based candidates with lean
      if (l <= 50) {
        // Deep: Autumn vs Winter
        if (b > 0 || lean === 'warm') {
          season = 'autumn';
          reason = `NEUTRAL (deep, lean warm) → Autumn (L=${l.toFixed(1)} <= 50, b=${b.toFixed(2)} > 0)`;
        } else {
          season = 'winter';
          reason = `NEUTRAL (deep, lean cool) → Winter (L=${l.toFixed(1)} <= 50, b=${b.toFixed(2)} < 0)`;
        }
      } else {
        // Light: Spring vs Summer
        if (b > 0 || lean === 'warm') {
          season = 'spring';
          reason = `NEUTRAL (light, lean warm) → Spring (L=${l.toFixed(1)} > 50, b=${b.toFixed(2)} > 0)`;
        } else {
          season = 'summer';
          reason = `NEUTRAL (light, lean cool) → Summer (L=${l.toFixed(1)} > 50, b=${b.toFixed(2)} < 0)`;
        }
      }
      
      // Always cap confidence and set needsConfirmation for neutral
      seasonConfidence = Math.min(clamp(undertoneConfidence * 0.7, 0, 0.55), 0.55);
      needsConfirmation = true;
      
      console.log('🎨 [SEASON] Neutral result:', {
        season,
        seasonConfidence: seasonConfidence.toFixed(3),
        needsConfirmation,
        note: 'Capped at 0.55 for neutral',
      });
    } else {
      // Between thresholds (6-8 or -8 to -6): still neutral but with lean
      console.log('🎨 [SEASON] Between thresholds, using lean:', lean);
      
      if (l <= 50) {
        // Deep
        if (b > 0 || lean === 'warm') {
          season = 'autumn';
          reason = `NEUTRAL-LEAN-WARM (deep) → Autumn (L=${l.toFixed(1)} <= 50, b=${b.toFixed(2)})`;
        } else {
          season = 'winter';
          reason = `NEUTRAL-LEAN-COOL (deep) → Winter (L=${l.toFixed(1)} <= 50, b=${b.toFixed(2)})`;
        }
      } else {
        // Light
        if (b > 0 || lean === 'warm') {
          season = 'spring';
          reason = `NEUTRAL-LEAN-WARM (light) → Spring (L=${l.toFixed(1)} > 50, b=${b.toFixed(2)})`;
        } else {
          season = 'summer';
          reason = `NEUTRAL-LEAN-COOL (light) → Summer (L=${l.toFixed(1)} > 50, b=${b.toFixed(2)})`;
        }
      }
      
      seasonConfidence = clamp(undertoneConfidence * 0.75, 0, 0.65);
      needsConfirmation = true;
      
      console.log('🎨 [SEASON] Neutral-lean result:', {
        season,
        seasonConfidence: seasonConfidence.toFixed(3),
        needsConfirmation,
      });
    }
  }

  // Apply additional penalties
  if ((madB !== undefined && madB > 4.5) || (madL !== undefined && madL > 10)) {
    seasonConfidence = clamp(seasonConfidence - 0.08, 0, 1);
    console.log('🎨 [SEASON] MAD noisy, reducing confidence');
  }
  if (gainsClamped) {
    seasonConfidence = clamp(seasonConfidence - 0.06, 0, 1);
    console.log('🎨 [SEASON] Gains clamped, reducing confidence');
  }

  // Final clamp
  seasonConfidence = clamp(seasonConfidence, 0, 0.95);

  // Update needsConfirmation based on final confidence
  if (seasonConfidence < 0.72) {
    needsConfirmation = true;
  }

  console.log('🎨 [SEASON] ========== SEASON DECISION END ==========');
  console.log('🎨 [SEASON] Final result:', {
    season,
    seasonConfidence: seasonConfidence.toFixed(3),
    needsConfirmation,
    reason,
  });

  return {
    season,
    seasonConfidence: Math.round(seasonConfidence * 100) / 100,
    needsConfirmation,
    reason,
  };
}

async function loadImageBuffer(imageUrl?: string, imageBase64?: string): Promise<Buffer> {
  if (imageBase64) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    return Buffer.from(base64Data, 'base64');
  }
  if (imageUrl) {
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkinToneAnalyzer/1.0)' },
    });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Fetched image is empty');
    return Buffer.from(arrayBuffer);
  }
  throw new Error('Missing image data');
}

function computeHeuristicFaceBox(imageWidth: number, imageHeight: number): FaceBox {
  const estimatedFaceWidth = Math.floor(imageWidth * 0.45);
  const estimatedFaceHeight = Math.floor(imageHeight * 0.5);
  const estimatedX = Math.floor((imageWidth - estimatedFaceWidth) / 2);
  const estimatedY = Math.floor(imageHeight * 0.15);
  return { x: estimatedX, y: estimatedY, width: estimatedFaceWidth, height: estimatedFaceHeight };
}

function clampFaceBoxToBounds(box: FaceBox, imageWidth: number, imageHeight: number) {
  const left = clamp(Math.floor(box.x), 0, imageWidth - 1);
  const top = clamp(Math.floor(box.y), 0, imageHeight - 1);
  const w = clamp(Math.floor(box.width), 1, imageWidth - left);
  const h = clamp(Math.floor(box.height), 1, imageHeight - top);
  return { left, top, width: w, height: h };
}

/**
 * Enhanced heuristic face detection with image scanning
 * Scans the image for face-like regions using skin color detection
 * Returns face box or null if no face detected
 */
async function detectFaceWithEnhancedHeuristic(
  imageBuffer: Buffer, 
  imageWidth: number, 
  imageHeight: number
): Promise<FaceBox | null> {
  try {
    console.log('🎨 [SKIN TONE API] Starting enhanced heuristic face detection...');
    console.log('🎨 [SKIN TONE API] Image dimensions:', { width: imageWidth, height: imageHeight });
    
    // Resize image for faster processing (but keep aspect ratio)
    const maxSize = 500; // Increased for better detection
    const scale = Math.min(maxSize / imageWidth, maxSize / imageHeight, 1);
    const scanWidth = Math.floor(imageWidth * scale);
    const scanHeight = Math.floor(imageHeight * scale);
    
    console.log('🎨 [SKIN TONE API] Scanning at resolution:', { scanWidth, scanHeight, scale });
    
    const { data, info } = await sharp(imageBuffer)
      .resize(scanWidth, scanHeight, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const W = info.width || scanWidth;
    const H = info.height || scanHeight;
    const C = info.channels || 3;
    
    // Scan multiple zones - face can be anywhere in upper 70% of image
    const faceSearchZones = [
      { x0: 0.15, x1: 0.85, y0: 0.05, y1: 0.7, name: 'center' }, // Center region
      { x0: 0.1, x1: 0.9, y0: 0.0, y1: 0.6, name: 'upper' }, // Upper region
      { x0: 0.2, x1: 0.8, y0: 0.1, y1: 0.65, name: 'middle' }, // Middle region
    ];
    
    let bestZone: { x: number; y: number; width: number; height: number; score: number; zone: string } | null = null;
    
    for (const zone of faceSearchZones) {
      let skinPixels = 0;
      let totalPixels = 0;
      let minX = W, minY = H, maxX = 0, maxY = 0;
      
      // Sample more densely for better detection
      const stepX = Math.max(1, Math.floor(W * (zone.x1 - zone.x0) / 30)); // More samples
      const stepY = Math.max(1, Math.floor(H * (zone.y1 - zone.y0) / 30));
      
      for (let y = Math.floor(H * zone.y0); y < Math.floor(H * zone.y1); y += stepY) {
        for (let x = Math.floor(W * zone.x0); x < Math.floor(W * zone.x1); x += stepX) {
          const idx = (y * W + x) * C;
          const r = data[idx];
          const g = data[idx + 1] ?? data[idx];
          const b = data[idx + 2] ?? data[idx];
          
          totalPixels++;
          
          if (isLikelySkinPixel(r, g, b)) {
            skinPixels++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      
      const skinRatio = totalPixels > 0 ? skinPixels / totalPixels : 0;
      
      console.log(`🎨 [SKIN TONE API] Zone "${zone.name}" results:`, {
        skinPixels,
        totalPixels,
        skinRatio: (skinRatio * 100).toFixed(1) + '%',
        bounds: maxX > minX && maxY > minY ? { minX, minY, maxX, maxY } : 'none'
      });
      
      // Lowered thresholds: require at least 35% skin ratio and 50 skin pixels
      if (skinRatio >= 0.35 && skinPixels >= 50 && maxX > minX && maxY > minY) {
        const width = maxX - minX;
        const height = maxY - minY;
        const aspectRatio = width / height;
        
        // More lenient aspect ratio: 0.5 to 1.5 (portrait to landscape)
        if (aspectRatio >= 0.5 && aspectRatio <= 1.5) {
          const score = skinRatio * skinPixels;
          
          console.log(`🎨 [SKIN TONE API] Zone "${zone.name}" passed validation:`, {
            aspectRatio: aspectRatio.toFixed(2),
            score: score.toFixed(1),
            size: { width, height }
          });
          
          if (!bestZone || score > bestZone.score) {
            // Scale back to original image dimensions with padding
            bestZone = {
              x: Math.max(0, (minX / scale) - (width / scale) * 0.15), // Add 15% padding
              y: Math.max(0, (minY / scale) - (height / scale) * 0.15),
              width: (width / scale) * 1.3, // Add 30% padding
              height: (height / scale) * 1.3,
              score: score,
              zone: zone.name
            };
          }
        } else {
          console.log(`🎨 [SKIN TONE API] Zone "${zone.name}" failed aspect ratio check:`, aspectRatio.toFixed(2));
        }
      } else {
        console.log(`🎨 [SKIN TONE API] Zone "${zone.name}" failed threshold check:`, {
          skinRatio: (skinRatio * 100).toFixed(1) + '%',
          skinPixels,
          requiredRatio: '35%',
          requiredPixels: 50
        });
      }
    }
    
    if (!bestZone) {
      console.log('🎨 [SKIN TONE API] No face-like region found in any zone');
      return null;
    }
    
    // Ensure box is within bounds
    const faceBox: FaceBox = {
      x: Math.max(0, Math.floor(bestZone.x)),
      y: Math.max(0, Math.floor(bestZone.y)),
      width: Math.min(imageWidth - Math.floor(bestZone.x), Math.floor(bestZone.width)),
      height: Math.min(imageHeight - Math.floor(bestZone.y), Math.floor(bestZone.height)),
    };
    
    // Ensure minimum size (lowered from 50 to 40)
    if (faceBox.width < 40 || faceBox.height < 40) {
      console.log('🎨 [SKIN TONE API] Detected region too small:', faceBox);
      return null;
    }
    
    console.log('🎨 [SKIN TONE API] Face-like region detected:', {
      zone: bestZone.zone,
      score: bestZone.score.toFixed(1),
      box: faceBox,
      imageSize: { width: imageWidth, height: imageHeight }
    });
    
    return faceBox;
  } catch (error: any) {
    console.error('🎨 [SKIN TONE API] Enhanced heuristic detection error:', error);
    console.error('🎨 [SKIN TONE API] Error stack:', error.stack?.substring(0, 500));
    return null;
  }
}

async function sampleSkinFromFace(faceImage: Buffer): Promise<{
  allSamples: Array<{ r: number; g: number; b: number }>;
  skinSamples: Array<{ r: number; g: number; b: number }>;
  correctedSamples: Array<{ r: number; g: number; b: number }>;
  correctionGains: { r: number; g: number; b: number };
  gainsClamped: boolean;
}> {
  const { data, info } = await sharp(faceImage)
    .resize(160, 160, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width || 160;
  const H = info.height || 160;
  const C = info.channels || 3;

  const zones = [
    { x0: 0.1, x1: 0.38, y0: 0.45, y1: 0.7 }, // left cheek
    { x0: 0.62, x1: 0.9, y0: 0.45, y1: 0.7 }, // right cheek
    { x0: 0.35, x1: 0.65, y0: 0.18, y1: 0.35 }, // mid-forehead
  ];

  const all: Array<{ r: number; g: number; b: number }> = [];
  const skin: Array<{ r: number; g: number; b: number }> = [];

  const steps = 14;
  for (const z of zones) {
    for (let yi = 0; yi < steps; yi++) {
      for (let xi = 0; xi < steps; xi++) {
        const x = Math.floor((z.x0 + ((z.x1 - z.x0) * xi) / (steps - 1)) * (W - 1));
        const y = Math.floor((z.y0 + ((z.y1 - z.y0) * yi) / (steps - 1)) * (H - 1));
        const idx = (y * W + x) * C;
        const r = data[idx];
        const g = data[idx + 1] ?? data[idx];
        const b = data[idx + 2] ?? data[idx];
        const px = { r, g, b };
        all.push(px);
        if (isLikelySkinPixel(r, g, b)) skin.push(px);
      }
    }
  }

  // Apply lighting correction to skin samples
  const { corrected, gains, gainsClamped } = applyLightingCorrection(skin);

  // Filter corrected samples using Lab-based check
  const correctedSkin: Array<{ r: number; g: number; b: number }> = [];
  for (const px of corrected) {
    const lab = rgbToLab(px.r, px.g, px.b);
    if (isLikelySkinPixelFromLab(lab)) {
      correctedSkin.push(px);
    }
  }

  // Use corrected skin samples if we have enough, otherwise fall back to corrected (all)
  const finalCorrected = correctedSkin.length >= 30 ? correctedSkin : corrected;

  return {
    allSamples: all,
    skinSamples: skin,
    correctedSamples: finalCorrected,
    correctionGains: gains,
    gainsClamped,
  };
}

function trimmedMean(samples: Array<{ r: number; g: number; b: number }>, trimRatio = 0.15) {
  if (samples.length === 0) return { r: 0, g: 0, b: 0 };

  const sorted = [...samples].sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  const trim = Math.floor(sorted.length * trimRatio);
  const kept = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));

  let sr = 0,
    sg = 0,
    sb = 0;
  for (const s of kept) {
    sr += s.r;
    sg += s.g;
    sb += s.b;
  }
  const n = kept.length || 1;
  return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // Log request start - this should always appear in Vercel logs
  // NOTE: Vercel logs may not show in real-time. Check Vercel Dashboard > Your Project > Functions > analyze-skin-tone > Logs
  console.log('🎨 [SKIN TONE API] ========== REQUEST STARTED ==========');
  console.log('🎨 [SKIN TONE API] Method:', req.method);
  console.log('🎨 [SKIN TONE API] Timestamp:', new Date().toISOString());
  
  // Force flush logs (Vercel may buffer)
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('🎨 [SKIN TONE API] REQUEST STARTED\n');
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🎨 [SKIN TONE API] OPTIONS request - returning 200');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    console.log('🎨 [SKIN TONE API] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, imageBase64, faceBox } = req.body as {
      imageUrl?: string;
      imageBase64?: string;
      faceBox?: FaceBox;
    };

    console.log('🎨 [SKIN TONE API] Request body:', {
      hasImageUrl: !!imageUrl,
      hasImageBase64: !!imageBase64,
      imageUrlLength: imageUrl?.length || 0,
      imageBase64Length: imageBase64?.length || 0,
      hasFaceBox: !!faceBox,
    });

    if (!imageUrl && !imageBase64) {
      console.error('🎨 [SKIN TONE API] ERROR: Missing imageUrl or imageBase64');
      return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
    }

    console.log('🎨 [SKIN TONE API] Loading image buffer...');
    const imageBuffer = await loadImageBuffer(imageUrl, imageBase64);
    console.log('🎨 [SKIN TONE API] Image buffer loaded, size:', imageBuffer.length, 'bytes');
    
    const meta = await sharp(imageBuffer).metadata();
    console.log('🎨 [SKIN TONE API] Image metadata:', {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      channels: meta.channels,
    });
    
    if (!meta.width || !meta.height) throw new Error('Invalid image metadata');

    const imageWidth = meta.width;
    const imageHeight = meta.height;

    // Overall image average for lighting bias
    const overallRaw = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: odata, info: oinfo } = overallRaw;
    const oC = oinfo.channels || 3;
    let or = 0,
      og = 0,
      ob = 0,
      ocnt = 0;
    for (let i = 0; i < odata.length; i += oC) {
      or += odata[i];
      og += odata[i + 1] ?? odata[i];
      ob += odata[i + 2] ?? odata[i];
      ocnt++;
    }
    const overallAvg = { r: Math.round(or / ocnt), g: Math.round(og / ocnt), b: Math.round(ob / ocnt) };
    const lighting = estimateWarmLightingBias(overallAvg);

    // Face detection: Try enhanced heuristic first, then provided faceBox, then return error
    let actualFaceBox: FaceBox | null = null;
    let detectionMethod = 'unknown';
    
    // 1. Try enhanced heuristic face detection first (if no faceBox provided)
    if (!faceBox) {
      console.log('🎨 [SKIN TONE API] No faceBox provided, attempting enhanced heuristic detection...');
      actualFaceBox = await detectFaceWithEnhancedHeuristic(imageBuffer, imageWidth, imageHeight);
      
      if (actualFaceBox) {
        detectionMethod = 'enhanced_heuristic';
        console.log('🎨 [SKIN TONE API] Enhanced heuristic face detection successful');
      } else {
        console.log('🎨 [SKIN TONE API] Enhanced heuristic detection failed - no face found in image');
        // Return error immediately - don't use basic heuristic for non-face images
        return res.status(400).json({ 
          error: 'FACE_NOT_DETECTED',
          message: 'No face detected in image. Please upload a clear face photo with good lighting.',
          detectionMethod: 'enhanced_heuristic',
        });
      }
    } else {
      // 2. Use provided faceBox if valid
      const valid =
        Number.isFinite(faceBox.x) &&
        Number.isFinite(faceBox.y) &&
        Number.isFinite(faceBox.width) &&
        Number.isFinite(faceBox.height) &&
        faceBox.width > 0 &&
        faceBox.height > 0 &&
        faceBox.x >= 0 &&
        faceBox.y >= 0;
      
      if (valid) {
        actualFaceBox = faceBox;
        detectionMethod = 'provided';
        console.log('🎨 [SKIN TONE API] Using provided faceBox');
      } else {
        console.log('🎨 [SKIN TONE API] Invalid faceBox provided, attempting enhanced heuristic detection...');
        actualFaceBox = await detectFaceWithEnhancedHeuristic(imageBuffer, imageWidth, imageHeight);
        
        if (actualFaceBox) {
          detectionMethod = 'enhanced_heuristic';
          console.log('🎨 [SKIN TONE API] Enhanced heuristic face detection successful');
        } else {
          console.log('🎨 [SKIN TONE API] Enhanced heuristic detection failed - no face found');
          return res.status(400).json({ 
            error: 'FACE_NOT_DETECTED',
            message: 'No face detected in image. Please upload a clear face photo with good lighting.',
            detectionMethod: 'enhanced_heuristic',
          });
        }
      }
    }

    if (!actualFaceBox) {
      return res.status(400).json({ 
        error: 'FACE_NOT_DETECTED',
        message: 'No face detected in image. Please upload a clear face photo with good lighting.',
      });
    }
    
    console.log('🎨 [SKIN TONE API] Using face box:', {
      method: detectionMethod,
      box: actualFaceBox
    });

    const crop = clampFaceBoxToBounds(actualFaceBox, imageWidth, imageHeight);
    const faceImage = await sharp(imageBuffer).extract(crop).toBuffer();

    // Sample skin (with lighting correction)
    const { allSamples, skinSamples, correctedSamples, correctionGains, gainsClamped } = await sampleSkinFromFace(faceImage);
    
    console.log('🎨 [SKIN TONE API] Sampling complete:', {
      totalSamples: allSamples.length,
      skinSamples: skinSamples.length,
      correctedSamples: correctedSamples.length,
      skinRatio: allSamples.length > 0 ? skinSamples.length / allSamples.length : 0,
      correctionGains,
      gainsClamped,
    });
    
    // Face detection validation: stricter thresholds to avoid false positives
    // Need both sufficient skin samples AND high skin ratio to confirm face presence
    const skinRatio = allSamples.length > 0 ? skinSamples.length / allSamples.length : 0;
    const minSkinSamples = 60; // Increased: was 40 - need more samples to confirm face
    const minSkinRatio = 0.45; // Increased: was 0.30 - need higher ratio to confirm face
    
    console.log('🎨 [SKIN TONE API] Face detection validation:', {
      skinRatio,
      skinSamplesCount: skinSamples.length,
      minRequired: minSkinSamples,
      minRatioRequired: minSkinRatio,
      allSamplesCount: allSamples.length,
    });
    
    // Both conditions must be met: sufficient samples AND high ratio
    if (skinSamples.length < minSkinSamples || skinRatio < minSkinRatio) {
      console.error('🎨 [SKIN TONE API] ERROR: Face detection failed');
      console.error('🎨 [SKIN TONE API] Reason:', {
        skinSamplesTooLow: skinSamples.length < minSkinSamples,
        skinRatioTooLow: skinRatio < minSkinRatio,
        skinRatio,
        skinSamples: skinSamples.length,
        totalSamples: allSamples.length,
        threshold: `${minSkinRatio * 100}%`,
      });
      return res.status(400).json({ 
        error: 'FACE_NOT_DETECTED',
        message: 'No face detected in image. Please upload a clear face photo with good lighting.',
        skinRatio,
        totalSamples: allSamples.length,
        skinSamples: skinSamples.length,
        minRequired: minSkinSamples,
        minRatioRequired: minSkinRatio,
      });
    }
    
    // Use corrected samples for analysis (per spec: Step A - lighting correction before Lab)
    const useSamples = correctedSamples.length >= 30 ? correctedSamples : skinSamples;
    if (useSamples.length === 0) {
      console.error('🎨 [SKIN TONE API] ERROR: Not enough corrected samples after validation');
      return res.status(400).json({ 
        error: 'FACE_NOT_DETECTED',
        message: 'No face detected in image. Please upload a clear face photo with good lighting.',
        skinRatio,
        totalSamples: allSamples.length,
        skinSamples: skinSamples.length,
        minRequired: minSkinSamples,
      });
    }
    console.log('🎨 [SKIN TONE API] Using corrected samples:', useSamples.length);
    
    // Step C: Use robust stats (median/trimmed mean) + outlier removal
    // Convert all corrected samples to Lab
    const labSamples = useSamples.map(s => rgbToLab(s.r, s.g, s.b));
    
    // Compute median Lab values (per spec: use median for L*, a*, b*)
    const lValues = labSamples.map(l => l.l);
    const aValues = labSamples.map(l => l.a);
    const bValues = labSamples.map(l => l.b);
    
    const medianL = median(lValues);
    const medianA = median(aValues);
    const medianB = median(bValues);
    
    // Compute MAD for dispersion (per spec)
    const madL = mad(lValues);
    const madA = mad(aValues);
    const madB = mad(bValues);
    
    // Check if noisy (per spec thresholds)
    const isNoisy = madB > 4.5 || madL > 10;
    
    console.log('🎨 [SKIN TONE API] Robust stats:', {
      medianLab: { l: medianL.toFixed(2), a: medianA.toFixed(2), b: medianB.toFixed(2) },
      mad: { l: madL.toFixed(2), a: madA.toFixed(2), b: madB.toFixed(2) },
      isNoisy,
    });
    
    // Use median Lab for analysis
    const lab = { l: medianL, a: medianA, b: medianB };
    
    // Compute RGB from median Lab for display (approximate)
    const skinRgb = trimmedMean(useSamples, 0.20); // 20% trimmed mean for RGB display
    const hex = rgbToHex(skinRgb.r, skinRgb.g, skinRgb.b);
    
    console.log('🎨 [SKIN TONE API] Skin RGB (for display):', skinRgb, 'HEX:', hex);
    console.log('🎨 [SKIN TONE API] LAB values (median):', {
      l: Math.round(lab.l * 10) / 10,
      a: Math.round(lab.a * 10) / 10,
      b: Math.round(lab.b * 10) / 10,
    });
    
    // Determine undertone, depth, clarity using corrected median Lab
    // Pass lighting severity to undertone function for neutral band adjustment
    const undertoneInfo = determineUndertoneFromLab(lab, lighting.severity);
    const { undertone, confidence: undertoneConfidence, lean } = undertoneInfo;
    console.log('🎨 [SKIN TONE API] Undertone:', undertone, 'Confidence:', undertoneConfidence, 'Lean:', lean);

    const { depth, confidence: depthConfidence } = determineDepthFromL(lab.l, madL);
    console.log('🎨 [SKIN TONE API] Depth:', depth, 'Confidence:', depthConfidence);
    
    const { clarity, confidence: clarityConfidence, chroma, avgSat } = determineClarityFromLab(lab, madB);
    console.log('🎨 [SKIN TONE API] Clarity:', clarity, 'Confidence:', clarityConfidence, 'Chroma:', chroma);

    // Season: ALWAYS decide (with new hard gating + proper neutral handling)
    const seasonDecision = decideSeasonAlways(
      undertone,
      depth,
      clarity,
      undertoneConfidence,
      depthConfidence,
      clarityConfidence,
      lighting.severity,
      { chroma, warmScore: undertoneInfo.warmScore, coolScore: undertoneInfo.coolScore, lean },
      lab,
      avgSat,
      madB,
      madL,
      gainsClamped
    );

    // Comprehensive logging - all calculations and decisions
    console.log('🎨 [SKIN TONE API] ========== COMPREHENSIVE ANALYSIS SUMMARY ==========');
    console.log('🎨 [SKIN TONE API] Raw Lab Values (median):', {
      L: lab.l.toFixed(2),
      a: lab.a.toFixed(2),
      b: lab.b.toFixed(2),
      chroma: chroma.toFixed(2),
    });
    console.log('🎨 [SKIN TONE API] Robust Statistics:', {
      medianLab: { L: medianL.toFixed(2), a: medianA.toFixed(2), b: medianB.toFixed(2) },
      mad: { L: madL.toFixed(2), a: madA.toFixed(2), b: madB.toFixed(2) },
      isNoisy,
      sampleCount: useSamples.length,
    });
    console.log('🎨 [SKIN TONE API] Lighting Analysis:', {
      overallAvg: lighting.isWarm ? 'WARM' : 'COOL',
      warmIndex: lighting.warmIndex,
      severity: lighting.severity.toFixed(3),
      correctionGains: correctionGains,
      gainsClamped,
    });
    console.log('🎨 [SKIN TONE API] Component Analysis:', {
      undertone: { value: undertone, confidence: undertoneConfidence.toFixed(3), lean },
      depth: { value: depth, confidence: depthConfidence.toFixed(3) },
      clarity: { value: clarity, confidence: clarityConfidence.toFixed(3), chroma: chroma.toFixed(2) },
    });
    console.log('🎨 [SKIN TONE API] Season Decision:', {
      season: seasonDecision.season.toUpperCase(),
      seasonConfidence: seasonDecision.seasonConfidence.toFixed(3),
      needsConfirmation: seasonDecision.needsConfirmation,
      reason: seasonDecision.reason,
    });

    // Overall confidence (per spec: 0.45*conf_u + 0.30*conf_d + 0.25*conf_c)
    let overallConfidence = 0.45 * undertoneConfidence + 0.30 * depthConfidence + 0.25 * clarityConfidence;
    
    // Apply penalties (per spec)
    if (isNoisy) {
      overallConfidence = clamp(overallConfidence - 0.08, 0, 1);
    }
    if (gainsClamped) {
      overallConfidence = clamp(overallConfidence - 0.06, 0, 1);
    }
    overallConfidence = clamp(overallConfidence, 0, 0.95);

    const timeTaken = Date.now() - startTime;
    
    // Final comprehensive summary for Vercel logs
    console.log('🎨 [SKIN TONE API] ========== FINAL SUMMARY (ALL CALCULATIONS) ==========');
    console.log('🎨 [SKIN TONE API] INPUT VALUES:', {
      'Lab (median)': { L: lab.l.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) },
      'Chroma (C*)': chroma.toFixed(2),
      'MAD': { L: madL.toFixed(2), a: madA.toFixed(2), b: madB.toFixed(2) },
      'Lighting': { severity: lighting.severity.toFixed(3), gainsClamped, gains: correctionGains },
    });
    console.log('🎨 [SKIN TONE API] COMPONENT RESULTS:', {
      'Undertone': { value: undertone, confidence: undertoneConfidence.toFixed(3), lean, b: lab.b.toFixed(2) },
      'Depth': { value: depth, confidence: depthConfidence.toFixed(3), L: lab.l.toFixed(2) },
      'Clarity': { value: clarity, confidence: clarityConfidence.toFixed(3), chroma: chroma.toFixed(2) },
    });
    console.log('🎨 [SKIN TONE API] SEASON SELECTION:', {
      'Season': seasonDecision.season.toUpperCase(),
      'Season Confidence': seasonDecision.seasonConfidence.toFixed(3),
      'Overall Confidence': overallConfidence.toFixed(3),
      'Needs Confirmation': seasonDecision.needsConfirmation,
      'Reason': seasonDecision.reason,
    });
    console.log('🎨 [SKIN TONE API] PERFORMANCE:', {
      'Time Taken': `${timeTaken}ms`,
      'Samples Used': useSamples.length,
      'Face Detection': detectionMethod,
    });
    console.log('🎨 [SKIN TONE API] ========================================================');

    return res.status(200).json({
      rgb: skinRgb,
      hex,
      lab: { l: Math.round(lab.l * 10) / 10, a: Math.round(lab.a * 10) / 10, b: Math.round(lab.b * 10) / 10 },
      undertone,
      depth,
      clarity,
      avgSat: Math.round(avgSat * 1000) / 1000, // Include saturation in response

      // IMPORTANT: never null
      season: seasonDecision.season,

      confidence: Math.round(overallConfidence * 100) / 100,
      seasonConfidence: seasonDecision.seasonConfidence,
      needsConfirmation: seasonDecision.needsConfirmation,

      diagnostics: {
        lighting: {
          overallAvg,
          isWarm: lighting.isWarm,
          warmIndex: lighting.warmIndex,
          severity: Math.round(lighting.severity * 100) / 100,
          correctionGains: correctionGains,
          gainsClamped,
        },
        sampling: {
          totalSamples: allSamples.length,
          skinSamples: skinSamples.length,
          correctedSamples: correctedSamples.length,
          used: 'correctedSamples',
          avgSat: Math.round(avgSat * 1000) / 1000,
          chroma: Math.round(chroma * 100) / 100,
        },
        robustStats: {
          medianLab: { l: Math.round(medianL * 10) / 10, a: Math.round(medianA * 10) / 10, b: Math.round(medianB * 10) / 10 },
          mad: { l: Math.round(madL * 100) / 100, a: Math.round(madA * 100) / 100, b: Math.round(madB * 100) / 100 },
          isNoisy,
        },
        seasonReason: seasonDecision.reason,
        undertoneMeta: {
          chroma: Math.round(chroma * 100) / 100,
          warmScore: Math.round(undertoneInfo.warmScore * 1000) / 1000,
          coolScore: Math.round(undertoneInfo.coolScore * 1000) / 1000,
          undertoneConfidence: Math.round(undertoneConfidence * 100) / 100,
          depthConfidence: Math.round(depthConfidence * 100) / 100,
          clarityConfidence: Math.round(clarityConfidence * 100) / 100,
        },
        faceBoxUsed: crop,
        faceBoxSource: faceBox && actualFaceBox === faceBox ? 'provided' : 'heuristic',
      },
    });
  } catch (error: any) {
    const timeTaken = Date.now() - startTime;
    console.error('🎨 [SKIN TONE API] ========== ERROR ==========');
    console.error('🎨 [SKIN TONE API] Error occurred:', error.message || 'Unknown error');
    console.error('🎨 [SKIN TONE API] Error stack:', error.stack);
    console.error('🎨 [SKIN TONE API] Time taken before error:', `${timeTaken}ms`);
    console.error('🎨 [SKIN TONE API] ==========================================');
    
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      undertone: 'neutral',
      depth: 'medium',
      clarity: 'muted',
      season: 'autumn', // safe fallback
      confidence: 0,
      seasonConfidence: 0,
      needsConfirmation: true,
    });
  }
}
