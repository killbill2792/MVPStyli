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
 * Lightweight skin-pixel check.
 * Purpose: avoid sampling beard/eyes/lips/background.
 * Made more strict to avoid false positives on non-face images.
 */
function isLikelySkinPixel(r: number, g: number, b: number) {
  // Balanced brightness range - skin can vary widely
  const v = (r + g + b) / (3 * 255);
  if (v < 0.12 || v > 0.90) return false; // Allow wider range for different skin tones

  // Skin typically has R > G > B, with R higher than B
  const rb = r - b;
  if (rb < 5) return false; // More lenient for darker skin tones
  if (r < 35 || g < 20 || b < 10) return false; // Lower minimums for darker skin

  // Skin has moderate saturation - but allow wider range
  const { s } = rgbToHsv(r, g, b);
  if (s < 0.08 || s > 0.60) return false; // Wider saturation range

  // Avoid extreme red (lips, red objects) - but be less strict
  if (r > 220 && g < 80 && b < 80) return false; // Only reject very extreme red

  // Skin typically has R >= G (skin is warm, not green-tinted)
  // But allow some green for certain skin tones
  if (r < g - 10) return false; // Allow small green component

  // Additional check: skin typically has G closer to R than to B
  // But make this less strict
  const rgDiff = Math.abs(r - g);
  const gbDiff = Math.abs(g - b);
  if (gbDiff > rgDiff * 2.0) return false; // More lenient ratio

  return true;
}

function determineUndertoneFromLab(lab: { l: number; a: number; b: number }): {
  undertone: Undertone;
  confidence: number;
  chroma: number;
  warmScore: number;
  coolScore: number;
} {
  const { a, b } = lab;
  const chroma = Math.sqrt(a * a + b * b);

  // Improved undertone calculation based on LAB color space
  // In LAB: positive a = red/magenta (cool), negative a = green (warm)
  //         positive b = yellow (warm), negative b = blue (cool)
  // For skin: warm = yellow/golden (positive b, slightly negative a)
  //           cool = pink/rosy (positive a, slightly negative b)
  
  // More accurate warm/cool scoring
  const warmScore = (b > 0 ? b / 20 : 0) + (a < 0 ? -a / 40 : 0);
  const coolScore = (a > 0 ? a / 30 : 0) + (b < 0 ? -b / 25 : 0);
  
  // Calculate the dominant direction
  const scoreDiff = warmScore - coolScore;
  const absDiff = Math.abs(scoreDiff);
  
  let undertone: Undertone = 'neutral';
  let confidence = 0.55;

  // More aggressive thresholds - be more sensitive to differences
  // Use actual LAB values directly for better differentiation
  // Warm: positive b (yellow) - even small values matter
  // Cool: positive a (red/pink) - even small values matter
  
  // Lower thresholds to catch more variation
  if (b > 1.5 && scoreDiff > 0.1) {
    // Yellow component present = warm
    undertone = 'warm';
    confidence = clamp(0.6 + Math.min(absDiff * 0.6, 0.3), 0.55, 0.92);
  } else if (a > 1.5 && scoreDiff < -0.1) {
    // Red/pink component present = cool
    undertone = 'cool';
    confidence = clamp(0.6 + Math.min(absDiff * 0.6, 0.3), 0.55, 0.92);
  } else if (absDiff > 0.08) {
    // Even small differences matter - use the stronger signal
    undertone = scoreDiff > 0 ? 'warm' : 'cool';
    confidence = clamp(0.55 + Math.min(absDiff * 0.5, 0.25), 0.5, 0.85);
  } else {
    // Truly neutral - scores are very close
    undertone = 'neutral';
    confidence = clamp(0.65 - (absDiff * 3), 0.5, 0.8);
  }

  return { undertone, confidence, chroma, warmScore, coolScore };
}

function determineDepthFromL(l: number): { depth: Depth; confidence: number } {
  // More nuanced depth detection with better thresholds
  // Light: L > 65 (fair to light skin)
  // Medium: 45 < L <= 65 (medium skin tones)
  // Deep: L <= 45 (deep/dark skin)
  
  if (l > 65) {
    // Light skin tones
    const lightness = (l - 65) / 35; // Normalize 65-100 range
    return { depth: 'light', confidence: clamp(0.7 + lightness * 0.25, 0.65, 0.95) };
  } else if (l <= 45) {
    // Deep skin tones
    const darkness = (45 - l) / 45; // Normalize 0-45 range
    return { depth: 'deep', confidence: clamp(0.7 + darkness * 0.25, 0.65, 0.95) };
  } else {
    // Medium skin tones (45 < L <= 65)
    // Check if closer to light or deep
    const distToLight = l - 45;
    const distToDeep = 65 - l;
    const minDist = Math.min(distToLight, distToDeep);
    const confidence = clamp(0.65 + (minDist / 10) * 0.2, 0.65, 0.9);
    return { depth: 'medium', confidence };
  }
}

function determineClarityFromSamples(samples: Array<{ r: number; g: number; b: number }>): {
  clarity: Clarity;
  confidence: number;
  avgSat: number;
} {
  if (samples.length === 0) return { clarity: 'muted', confidence: 0.5, avgSat: 0 };

  const sats = samples.map((s) => rgbToHsv(s.r, s.g, s.b).s);
  const avgSat = sats.reduce((a, c) => a + c, 0) / sats.length;

  let clarity: Clarity = 'muted';
  // More nuanced clarity detection
  // Skin tones have relatively low saturation, so thresholds are lower
  // Vivid: high saturation (bright, clear skin)
  // Clear: moderate saturation (clear but not overly bright)
  // Muted: low saturation (soft, muted skin)
  
  // Adjusted thresholds based on typical skin saturation ranges
  if (avgSat >= 0.16) {
    clarity = 'vivid';
  } else if (avgSat >= 0.08) {
    clarity = 'clear';
  } else {
    clarity = 'muted';
  }

  // Calculate confidence based on distance from thresholds
  const d1 = Math.min(Math.abs(avgSat - 0.08), Math.abs(avgSat - 0.16));
  const confidence = clamp(0.6 + d1 * 1.5, 0.55, 0.9);

  return { clarity, confidence, avgSat };
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
 * NEW: Always return a Season.
 * - seasonConfidence is separate from overall confidence
 * - needsConfirmation tells UI to ask user to confirm/change
 */
function decideSeasonAlways(
  undertone: Undertone,
  depth: Depth,
  clarity: Clarity,
  undertoneConfidence: number,
  depthConfidence: number,
  clarityConfidence: number,
  warmLightingSeverity: number,
  labInfo?: { chroma: number; warmScore: number; coolScore: number },
  labValues?: { l: number; a: number; b: number },
  avgSat?: number
): { season: Season; seasonConfidence: number; needsConfirmation: boolean; reason: string } {
  // Start from component avg
  let base = (undertoneConfidence + depthConfidence + clarityConfidence) / 3;

  // Lighting penalty (warm cast can fake warm undertone and vividness)
  base = clamp(base - warmLightingSeverity * 0.15, 0, 1);

  // --- Color Season Decision Logic ---
  // Based on traditional color analysis theory:
  // - Undertone (warm/cool/neutral) determines warm vs cool seasons
  // - Depth/Value (light/medium/deep) determines light vs deep seasons
  // - Clarity/Chroma (muted/clear/vivid) determines soft vs bright seasons
  //
  // Seasons:
  // - Spring: Warm + Light + Clear/Vivid (bright warm)
  // - Summer: Cool + Light/Medium + Muted (soft cool)
  // - Autumn: Warm + Medium/Deep + Muted (warm earth tones)
  // - Winter: Cool + Deep + Clear/Vivid (cool bright)
  
  let season: Season;
  let reason = '';

  // Use actual LAB values directly for scoring-based decision
  const l = labValues?.l ?? 50;
  const a = labValues?.a ?? 0;
  const b = labValues?.b ?? 0;
  const saturation = avgSat ?? 0.1;
  
  // Calculate season scores directly from numeric values
  // This approach is more sensitive to actual differences
  let springScore = 0;
  let summerScore = 0;
  let autumnScore = 0;
  let winterScore = 0;
  
  // Spring: Warm + Light + Clear/Vivid (bright warm)
  // Key: Light skin with warm undertone and higher saturation
  if (b > 0 || undertone === 'warm' || undertone === 'neutral') {
    // Lightness scoring - spring prefers lighter
    if (l > 65) springScore += 4;
    else if (l > 55) springScore += 2;
    else if (l > 50) springScore += 1;
    
    // Saturation scoring - spring needs higher saturation
    if (saturation > 0.14) springScore += 4;
    else if (saturation > 0.11) springScore += 2;
    else if (saturation > 0.09) springScore += 1;
    
    // Yellow component - warm indicator
    if (b > 6) springScore += 3;
    else if (b > 3) springScore += 2;
    else if (b > 1) springScore += 1;
    
    // Penalty for too dark
    if (l < 50) springScore -= 2;
  }
  
  // Summer: Cool + Light/Medium + Muted (soft cool)
  // Key: Light to medium cool with lower saturation
  if (a > 0 || undertone === 'cool' || undertone === 'neutral') {
    // Lightness scoring
    if (l > 60) summerScore += 3;
    else if (l > 50) summerScore += 2;
    else if (l > 45) summerScore += 1;
    
    // Lower saturation preferred
    if (saturation < 0.10) summerScore += 4;
    else if (saturation < 0.12) summerScore += 2;
    else if (saturation < 0.14) summerScore += 1;
    
    // Pink/red component
    if (a > 4) summerScore += 3;
    else if (a > 2) summerScore += 2;
    else if (a > 0.5) summerScore += 1;
    
    // Penalty for too dark or too saturated
    if (l < 45) summerScore -= 2;
    if (saturation > 0.15) summerScore -= 1;
  }
  
  // Autumn: Warm + Medium/Deep + Muted (warm earth tones)
  // Key: Medium to deep warm with lower saturation
  if (b > 0 || undertone === 'warm' || undertone === 'neutral') {
    // Medium to deep preferred
    if (l < 60 && l > 45) autumnScore += 4;
    else if (l < 65 && l > 40) autumnScore += 3;
    else if (l < 50) autumnScore += 2;
    else if (l < 70) autumnScore += 1;
    
    // Lower saturation preferred
    if (saturation < 0.11) autumnScore += 4;
    else if (saturation < 0.13) autumnScore += 2;
    else if (saturation < 0.15) autumnScore += 1;
    
    // Yellow component
    if (b > 4) autumnScore += 2;
    else if (b > 2) autumnScore += 1;
    
    // Penalty for too light or too saturated
    if (l > 65) autumnScore -= 2;
    if (saturation > 0.14) autumnScore -= 2;
  }
  
  // Winter: Cool + Deep + Clear/Vivid (cool bright)
  // Key: Deep cool with higher saturation
  if (a > 0 || undertone === 'cool' || undertone === 'neutral') {
    // Deep preferred
    if (l < 50) winterScore += 4;
    else if (l < 55) winterScore += 3;
    else if (l < 60) winterScore += 1;
    
    // Higher saturation preferred
    if (saturation > 0.12) winterScore += 4;
    else if (saturation > 0.10) winterScore += 2;
    else if (saturation > 0.08) winterScore += 1;
    
    // Red/pink component
    if (a > 4) winterScore += 3;
    else if (a > 2) winterScore += 2;
    else if (a > 0.5) winterScore += 1;
    
    // Penalty for too light or too muted
    if (l > 60) winterScore -= 2;
    if (saturation < 0.10) winterScore -= 2;
  }
  
  // Find the season with highest score
  const scores = [
    { season: 'spring' as Season, score: springScore },
    { season: 'summer' as Season, score: summerScore },
    { season: 'autumn' as Season, score: autumnScore },
    { season: 'winter' as Season, score: winterScore }
  ];
  
  scores.sort((a, b) => b.score - a.score);
  season = scores[0].season;
  
  // Generate detailed reason
  const topScore = scores[0].score;
  const secondScore = scores[1].score;
  const scoreDiff = topScore - secondScore;
  
  reason = `${season.toUpperCase()} (scores: Spring=${springScore}, Summer=${summerScore}, Autumn=${autumnScore}, Winter=${winterScore}, winner=${topScore}, L:${l.toFixed(1)}, a:${a.toFixed(1)}, b:${b.toFixed(1)}, sat:${saturation.toFixed(3)}, undertone:${undertone}, depth:${depth}, clarity:${clarity})`;
  
  // If scores are very close, mark as needing confirmation
  if (scoreDiff < 2) {
    reason += ` [Close: ${scores[1].season}=${secondScore}]`;
  }
  
  // Log all scores for debugging
  console.log('🎨 Season Scores:', {
    spring: springScore,
    summer: summerScore,
    autumn: autumnScore,
    winter: winterScore,
    winner: season,
    l, a, b, saturation, undertone, depth, clarity
  });

  // seasonConfidence: penalize if undertone is neutral (because season split depends on it)
  let seasonConfidence = base;
  if (undertone === 'neutral') seasonConfidence = clamp(seasonConfidence - 0.12, 0, 1);

  // penalize ambiguous clarity boundaries slightly
  if (clarityConfidence < 0.65) seasonConfidence = clamp(seasonConfidence - 0.05, 0, 1);

  // needsConfirmation rule
  const needsConfirmation =
    undertone === 'neutral' || seasonConfidence < 0.72 || warmLightingSeverity > 0.35;

  return {
    season,
    seasonConfidence: Math.round(clamp(seasonConfidence, 0, 0.95) * 100) / 100,
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

async function sampleSkinFromFace(faceImage: Buffer) {
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

  return { allSamples: all, skinSamples: skin };
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

    // Sample skin
    const { allSamples, skinSamples } = await sampleSkinFromFace(faceImage);
    
    console.log('🎨 [SKIN TONE API] Sampling complete:', {
      totalSamples: allSamples.length,
      skinSamples: skinSamples.length,
      skinRatio: allSamples.length > 0 ? skinSamples.length / allSamples.length : 0,
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
    
    // Only use skin samples if we have enough - don't fall back to all samples
    // This ensures we're only analyzing actual skin, not random pixels
    const useSamples = skinSamples.length >= minSkinSamples ? skinSamples : [];
    if (useSamples.length === 0) {
      console.error('🎨 [SKIN TONE API] ERROR: Not enough skin samples after validation');
      return res.status(400).json({ 
        error: 'FACE_NOT_DETECTED',
        message: 'No face detected in image. Please upload a clear face photo with good lighting.',
        skinRatio,
        totalSamples: allSamples.length,
        skinSamples: skinSamples.length,
        minRequired: minSkinSamples,
      });
    }
    console.log('🎨 [SKIN TONE API] Using samples:', useSamples.length);
    
    const skinRgb = trimmedMean(useSamples, 0.18);
    const hex = rgbToHex(skinRgb.r, skinRgb.g, skinRgb.b);
    
    console.log('🎨 [SKIN TONE API] Skin RGB:', skinRgb, 'HEX:', hex);

    const lab = rgbToLab(skinRgb.r, skinRgb.g, skinRgb.b);
    console.log('🎨 [SKIN TONE API] LAB values:', {
      l: Math.round(lab.l * 10) / 10,
      a: Math.round(lab.a * 10) / 10,
      b: Math.round(lab.b * 10) / 10,
    });
    
    const undertoneInfo = determineUndertoneFromLab(lab);
    const { undertone, confidence: undertoneConfidence } = undertoneInfo;
    console.log('🎨 [SKIN TONE API] Undertone:', undertone, 'Confidence:', undertoneConfidence);

    const { depth, confidence: depthConfidence } = determineDepthFromL(lab.l);
    console.log('🎨 [SKIN TONE API] Depth:', depth, 'Confidence:', depthConfidence);
    
    const { clarity, confidence: clarityConfidence, avgSat } = determineClarityFromSamples(useSamples);
    console.log('🎨 [SKIN TONE API] Clarity:', clarity, 'Confidence:', clarityConfidence, 'Avg Saturation:', avgSat);

    // Season: ALWAYS decide
    const seasonDecision = decideSeasonAlways(
      undertone,
      depth,
      clarity,
      undertoneConfidence,
      depthConfidence,
      clarityConfidence,
      lighting.severity,
      { chroma: undertoneInfo.chroma, warmScore: undertoneInfo.warmScore, coolScore: undertoneInfo.coolScore },
      lab,
      avgSat
    );

    // Debug logging - comprehensive season decision
    console.log('🎨 [SKIN TONE API] ========== SEASON DECISION ==========');
    console.log('🎨 [SKIN TONE API] Season Decision:', {
      undertone,
      depth,
      clarity,
      avgSat,
      undertoneConfidence,
      depthConfidence,
      clarityConfidence,
      warmScore: undertoneInfo.warmScore,
      coolScore: undertoneInfo.coolScore,
      season: seasonDecision.season,
      reason: seasonDecision.reason,
      seasonConfidence: seasonDecision.seasonConfidence,
      lab: { l: Math.round(lab.l * 10) / 10, a: Math.round(lab.a * 10) / 10, b: Math.round(lab.b * 10) / 10 },
    });

    // Overall confidence (not just season), penalize heavy warm lighting slightly
    const overallConfidence = clamp(
      (undertoneConfidence + depthConfidence + clarityConfidence) / 3 - lighting.severity * 0.08,
      0,
      0.95
    );

    const timeTaken = Date.now() - startTime;
    console.log('🎨 [SKIN TONE API] ========== ANALYSIS COMPLETE ==========');
    console.log('🎨 [SKIN TONE API] Final Result:', {
      season: seasonDecision.season,
      seasonConfidence: seasonDecision.seasonConfidence,
      undertone,
      depth,
      clarity,
      overallConfidence,
      hex,
      timeTaken: `${timeTaken}ms`,
    });
    console.log('🎨 [SKIN TONE API] ==========================================');

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
        },
        sampling: {
          totalSamples: allSamples.length,
          skinSamples: skinSamples.length,
          used: skinSamples.length >= 40 ? 'skinSamples' : 'fallbackAllSamples',
          avgSat: Math.round(avgSat * 1000) / 1000,
        },
        seasonReason: seasonDecision.reason,
        undertoneMeta: {
          chroma: Math.round(undertoneInfo.chroma * 100) / 100,
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
