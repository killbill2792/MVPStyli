/**
 * Skin Tone Analysis API (Improved Heuristic)
 * - Robust sampling inside faceBox (many samples, trimmed mean)
 * - Simple skin-pixel filter to avoid beard/eyes/lips
 * - Lighting bias detection (warm cast) and confidence penalty
 * - Season assignment is gated (avoid overconfident Spring/Winter)
 *
 * No paid APIs. Uses Sharp only.
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

// Convert RGB to Lab (D65) – same as your version (kept)
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
 * Very lightweight skin-pixel check.
 * Purpose: avoid sampling beard/eyes/lips/background.
 * Works reasonably for many skin tones, but still heuristic.
 */
function isLikelySkinPixel(r: number, g: number, b: number) {
  // reject very dark (hair) and very bright (white background)
  const v = (r + g + b) / (3 * 255);
  if (v < 0.08 || v > 0.95) return false;

  // Basic RGB skin range heuristic (broad)
  // - not too blue
  // - red slightly higher than blue
  // - green between
  const rg = r - g;
  const rb = r - b;
  if (rb < 5) return false;
  if (r < 40 || g < 20 || b < 10) return false;

  // Avoid grey-ish pixels (low saturation) because those are often walls/shadows
  const { s } = rgbToHsv(r, g, b);
  if (s < 0.08) return false;

  // avoid extreme red (lips)
  if (r > 200 && g < 90 && b < 90) return false;

  // tolerate many tones: just require plausible ordering
  // (this is intentionally permissive)
  if (r < g && rb > 15) return false;

  return true;
}

function determineUndertoneFromLab(lab: { l: number; a: number; b: number }): { undertone: Undertone; confidence: number } {
  const { a, b } = lab;
  const chroma = Math.sqrt(a * a + b * b);

  // Warm tends to +b (yellow) and +a (red)
  // Cool tends to -b (blue) or negative a/b direction
  // Neutral near 0
  const warmScore = (b / 25) + (a / 35);
  const coolScore = (-b / 25) + (-a / 50);

  let undertone: Undertone = 'neutral';
  let confidence = 0.55;

  if (warmScore > 0.35 && b > 2) {
    undertone = 'warm';
    confidence = clamp(0.62 + (Math.min(chroma, 35) / 35) * 0.25, 0.55, 0.92);
  } else if (coolScore > 0.35 && b < 2) {
    undertone = 'cool';
    confidence = clamp(0.62 + (Math.min(chroma, 35) / 35) * 0.25, 0.55, 0.92);
  } else {
    undertone = 'neutral';
    // more chroma => less neutral
    confidence = clamp(0.75 - (Math.min(chroma, 35) / 35) * 0.25, 0.5, 0.8);
  }

  return { undertone, confidence };
}

function determineDepthFromL(l: number): { depth: Depth; confidence: number } {
  // L* 0..100, higher means lighter
  // Adjusted thresholds slightly
  if (l >= 72) return { depth: 'light', confidence: clamp(0.75 + (l - 72) / 28 * 0.2, 0.65, 0.95) };
  if (l <= 38) return { depth: 'deep', confidence: clamp(0.75 + (38 - l) / 38 * 0.2, 0.65, 0.95) };

  // medium
  const distToEdge = Math.min(l - 38, 72 - l); // 0..?
  return { depth: 'medium', confidence: clamp(0.70 + (distToEdge / 20) * 0.15, 0.65, 0.9) };
}

function determineClarityFromSamples(samples: Array<{ r: number; g: number; b: number }>): { clarity: Clarity; confidence: number; avgSat: number } {
  if (samples.length === 0) return { clarity: 'muted', confidence: 0.5, avgSat: 0 };

  const sats = samples.map((s) => rgbToHsv(s.r, s.g, s.b).s);
  const avgSat = sats.reduce((a, c) => a + c, 0) / sats.length;

  let clarity: Clarity = 'muted';
  if (avgSat >= 0.22) clarity = 'vivid';
  else if (avgSat >= 0.14) clarity = 'clear';
  else clarity = 'muted';

  // confidence based on how far from boundaries
  const d1 = Math.min(Math.abs(avgSat - 0.14), Math.abs(avgSat - 0.22));
  const confidence = clamp(0.65 + d1 * 1.2, 0.55, 0.9);

  return { clarity, confidence, avgSat };
}

/**
 * Detect warm lighting cast using overall image average.
 * If R and G are significantly higher than B -> warm cast.
 */
function estimateWarmLightingBias(avg: { r: number; g: number; b: number }) {
  // normalized
  const rn = avg.r / 255, gn = avg.g / 255, bn = avg.b / 255;
  const warmIndex = (rn + gn) / 2 - bn; // positive => warm
  // 0.00..0.30 typical
  const isWarm = warmIndex > 0.08;
  const severity = clamp((warmIndex - 0.08) / 0.18, 0, 1); // 0..1
  return { isWarm, severity, warmIndex: Math.round(warmIndex * 1000) / 1000 };
}

function suggestSeasonGated(
  undertone: Undertone,
  depth: Depth,
  clarity: Clarity,
  undertoneConfidence: number,
  depthConfidence: number,
  clarityConfidence: number,
  warmLightingSeverity: number
): { season: Season | null; confidence: number; reason: string } {
  // Base confidence from components
  let base = (undertoneConfidence + depthConfidence + clarityConfidence) / 3;

  // Penalize warm lighting (because it fakes warm undertone + vividness)
  const lightingPenalty = warmLightingSeverity * 0.15;
  base = clamp(base - lightingPenalty, 0, 1);

  // If undertone is neutral or base confidence low => no season (ask user)
  if (undertone === 'neutral' || base < 0.65) {
    return { season: null, confidence: base, reason: 'Neutral undertone or low confidence' };
  }

  // Gated rules (stricter than before)
  // Spring: warm + light or light-medium + clear/vivid
  if (undertone === 'warm') {
    if ((depth === 'light') && (clarity === 'clear' || clarity === 'vivid') && base >= 0.72) {
      return { season: 'spring', confidence: base, reason: 'Warm + light + clear/vivid' };
    }
    // Autumn: warm + medium/deep OR muted/clear
    if ((depth === 'deep' || depth === 'medium') && (clarity === 'muted' || clarity === 'clear')) {
      return { season: 'autumn', confidence: base, reason: 'Warm + medium/deep and muted/clear' };
    }
    // If warm but ambiguous, return null instead of forcing Spring
    return { season: null, confidence: base, reason: 'Warm but ambiguous for Spring/Autumn' };
  }

  // Cool seasons
  if (undertone === 'cool') {
    // Summer: cool + light/medium + muted/clear
    if ((depth === 'light' || depth === 'medium') && (clarity === 'muted' || clarity === 'clear')) {
      return { season: 'summer', confidence: base, reason: 'Cool + light/medium and muted/clear' };
    }
    // Winter: cool + deep + vivid/clear and higher base
    if (depth === 'deep' && (clarity === 'vivid' || clarity === 'clear') && base >= 0.72) {
      return { season: 'winter', confidence: base, reason: 'Cool + deep + clear/vivid' };
    }
    return { season: null, confidence: base, reason: 'Cool but ambiguous for Summer/Winter' };
  }

  return { season: null, confidence: base, reason: 'Fallback' };
}

async function loadImageBuffer(imageUrl?: string, imageBase64?: string): Promise<Buffer> {
  if (imageBase64) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    return Buffer.from(base64Data, 'base64');
  }
  if (imageUrl) {
    const response = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkinToneAnalyzer/1.0)' } });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Fetched image is empty');
    return Buffer.from(arrayBuffer);
  }
  throw new Error('Missing image data');
}

function computeHeuristicFaceBox(imageWidth: number, imageHeight: number): FaceBox {
  const estimatedFaceWidth = Math.floor(imageWidth * 0.45);
  const estimatedFaceHeight = Math.floor(imageHeight * 0.50);
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
 * Sample many pixels from safe skin zones inside the face crop.
 * Returns:
 * - skinSamples (filtered)
 * - allSamples (for debugging)
 */
async function sampleSkinFromFace(faceImage: Buffer) {
  // Downscale to speed sampling
  // raw pixel access: fast enough on Vercel
  const { data, info } = await sharp(faceImage)
    .resize(160, 160, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width || 160;
  const H = info.height || 160;
  const C = info.channels || 3;

  // Define "safe" zones:
  // - avoid top hairline: y 0..18%
  // - avoid eyes: y 25..55% but narrow band in center
  // - avoid mouth/beard: y 70..100%
  // We'll sample mostly cheeks + mid-forehead area.
  const zones = [
    // left cheek
    { x0: 0.10, x1: 0.38, y0: 0.45, y1: 0.70 },
    // right cheek
    { x0: 0.62, x1: 0.90, y0: 0.45, y1: 0.70 },
    // mid-forehead
    { x0: 0.35, x1: 0.65, y0: 0.18, y1: 0.35 },
  ];

  const all: Array<{ r: number; g: number; b: number }> = [];
  const skin: Array<{ r: number; g: number; b: number }> = [];

  // sample grid
  const steps = 14; // 14x14 per zone ≈ 196 points per zone
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

  // Sort by brightness
  const sorted = [...samples].sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
  const trim = Math.floor(sorted.length * trimRatio);
  const kept = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));

  let sr = 0, sg = 0, sb = 0;
  for (const s of kept) {
    sr += s.r; sg += s.g; sb += s.b;
  }
  const n = kept.length || 1;
  return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageUrl, imageBase64, faceBox } = req.body as { imageUrl?: string; imageBase64?: string; faceBox?: FaceBox };

    if (!imageUrl && !imageBase64) return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });

    const imageBuffer = await loadImageBuffer(imageUrl, imageBase64);
    const meta = await sharp(imageBuffer).metadata();
    if (!meta.width || !meta.height) throw new Error('Invalid image metadata');
    const imageWidth = meta.width;
    const imageHeight = meta.height;

    // Compute overall image average for lighting bias
    const overallRaw = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    {
      // no-op, just to keep TS happy for destructuring below
    }

    const { data: odata, info: oinfo } = overallRaw;
    const oC = oinfo.channels || 3;
    let or = 0, og = 0, ob = 0, ocnt = 0;
    for (let i = 0; i < odata.length; i += oC) {
      or += odata[i];
      og += odata[i + 1] ?? odata[i];
      ob += odata[i + 2] ?? odata[i];
      ocnt++;
    }
    const overallAvg = { r: Math.round(or / ocnt), g: Math.round(og / ocnt), b: Math.round(ob / ocnt) };
    const lighting = estimateWarmLightingBias(overallAvg);

    // Determine faceBox: use provided if valid, else heuristic
    let actualFaceBox: FaceBox | null = null;
    if (faceBox && typeof faceBox === 'object') {
      const valid =
        Number.isFinite(faceBox.x) &&
        Number.isFinite(faceBox.y) &&
        Number.isFinite(faceBox.width) &&
        Number.isFinite(faceBox.height) &&
        faceBox.width > 0 &&
        faceBox.height > 0 &&
        faceBox.x >= 0 &&
        faceBox.y >= 0;
      actualFaceBox = valid ? faceBox : null;
    }

    if (!actualFaceBox) {
      actualFaceBox = computeHeuristicFaceBox(imageWidth, imageHeight);
    }

    const crop = clampFaceBoxToBounds(actualFaceBox, imageWidth, imageHeight);

    const faceImage = await sharp(imageBuffer).extract(crop).toBuffer();

    // Sample skin
    const { allSamples, skinSamples } = await sampleSkinFromFace(faceImage);

    // If skin samples are too few, fall back to allSamples trimmed mean
    const useSamples = skinSamples.length >= 40 ? skinSamples : allSamples;
    const skinRgb = trimmedMean(useSamples, 0.18);
    const hex = rgbToHex(skinRgb.r, skinRgb.g, skinRgb.b);

    const lab = rgbToLab(skinRgb.r, skinRgb.g, skinRgb.b);
    const { undertone, confidence: undertoneConfidence } = determineUndertoneFromLab(lab);
    const { depth, confidence: depthConfidence } = determineDepthFromL(lab.l);

    const { clarity, confidence: clarityConfidence, avgSat } = determineClarityFromSamples(useSamples);

    // Season gated + confidence includes lighting penalty
    const seasonResult = suggestSeasonGated(
      undertone,
      depth,
      clarity,
      undertoneConfidence,
      depthConfidence,
      clarityConfidence,
      lighting.severity
    );

    const confidence = clamp(seasonResult.confidence, 0, 0.95);

    return res.status(200).json({
      rgb: skinRgb,
      hex,
      lab: { l: Math.round(lab.l * 10) / 10, a: Math.round(lab.a * 10) / 10, b: Math.round(lab.b * 10) / 10 },
      undertone,
      depth,
      clarity,
      season: seasonResult.season,
      confidence: Math.round(confidence * 100) / 100,
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
        seasonReason: seasonResult.reason,
        faceBoxUsed: crop,
        faceBoxSource: faceBox && actualFaceBox === faceBox ? 'provided' : 'heuristic',
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      undertone: 'neutral',
      depth: 'medium',
      season: null,
      confidence: 0,
    });
  }
}
