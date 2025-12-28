/**
 * Skin Tone Analysis API (Improved)
 * File: api/analyze-skin-tone/index.ts   (or wherever your Vercel function lives)
 *
 * Goals:
 * - STOP always returning Autumn
 * - Require a real faceBox (NO heuristic guessing)
 * - Sample MANY pixels, filter non-skin, use trimmed-mean
 * - Return season = null when confidence is low or undertone is neutral
 *
 * Request body:
 * {
 *   imageUrl?: string,
 *   imageBase64?: string,
 *   faceBox: { x:number, y:number, width:number, height:number }   // REQUIRED
 * }
 *
 * Response:
 * {
 *   rgb, hex, lab,
 *   undertone, depth, clarity,
 *   season: "spring"|"summer"|"autumn"|"winter"|null,
 *   confidence: number (0..1),
 *   diagnostics: { skinPixelCount, totalSampled, skinPixelRatio, trimmedMeanRgb, lightingWarning, notes[] }
 * }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import sharp from "sharp";

type FaceBox = { x: number; y: number; width: number; height: number };
type Undertone = "warm" | "cool" | "neutral";
type Depth = "light" | "medium" | "deep";
type Clarity = "muted" | "clear" | "vivid";
type Season = "spring" | "summer" | "autumn" | "winter";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidFaceBox(faceBox: any): faceBox is FaceBox {
  return (
    faceBox &&
    typeof faceBox === "object" &&
    Number.isFinite(faceBox.x) &&
    Number.isFinite(faceBox.y) &&
    Number.isFinite(faceBox.width) &&
    Number.isFinite(faceBox.height) &&
    faceBox.x >= 0 &&
    faceBox.y >= 0 &&
    faceBox.width > 0 &&
    faceBox.height > 0
  );
}

// Basic RGB skin mask (cheap + surprisingly effective for MVP).
// This is *not perfect*, but it will remove lots of background/hair/white highlights.
function isSkinPixel(r: number, g: number, b: number) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);

  // reject extreme dark / extreme bright
  if (maxc < 45) return false;
  if (minc > 245) return false;

  // must have some color variation
  if (maxc - minc < 15) return false;

  // typical skin tends to have r >= g >= b with some tolerance
  // (but can vary widely; keep loose)
  if (r < g - 15) return false;
  if (g < b - 20) return false;

  // avoid strong greens/blues
  if (g > r + 35) return false;
  if (b > r + 35) return false;

  // avoid super-saturated reds (often lips or fabric)
  if (r > 240 && g < 80 && b < 80) return false;

  return true;
}

// Convert RGB to Lab (D65) (same approach you used, kept here)
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

// Better undertone logic:
// - Use a/b direction with a "neutral zone" when chroma is low
// - Return confidence based on chroma magnitude
function determineUndertone(lab: { l: number; a: number; b: number }): { undertone: Undertone; confidence: number } {
  const { a, b } = lab;
  const chroma = Math.sqrt(a * a + b * b); // how strong the tint is

  // very low chroma -> neutral (lighting / grayscale / washed out)
  if (chroma < 8) {
    return { undertone: "neutral", confidence: 0.55 };
  }

  // warm if b positive and stronger than negative direction; cool if b negative-ish or a negative-ish
  // We use soft thresholds and a "margin"
  const warmScore = b + 0.25 * a; // yellowness + some redness
  const coolScore = -b + 0.25 * -a; // blueness + some greenness

  let undertone: Undertone = "neutral";
  let conf = 0.6;

  const margin = 4; // prevents tiny shifts from flipping undertone
  if (warmScore > coolScore + margin) {
    undertone = "warm";
  } else if (coolScore > warmScore + margin) {
    undertone = "cool";
  } else {
    undertone = "neutral";
  }

  // Confidence: based on chroma and separation
  const sep = Math.abs(warmScore - coolScore);
  conf = clamp(0.55 + chroma / 35 + sep / 40, 0.55, 0.95);

  // If we ended up neutral, reduce confidence a bit
  if (undertone === "neutral") conf = clamp(conf - 0.15, 0.45, 0.85);

  return { undertone, confidence: conf };
}

function determineDepth(l: number): { depth: Depth; confidence: number } {
  // L* 0..100
  if (l > 72) {
    return { depth: "light", confidence: clamp(0.7 + (l - 72) / 28 * 0.25, 0.7, 0.95) };
  }
  if (l > 42) {
    // medium - most common, confidence depends distance from borders
    const dist = Math.min(l - 42, 72 - l);
    return { depth: "medium", confidence: clamp(0.68 + dist / 30 * 0.22, 0.68, 0.9) };
  }
  return { depth: "deep", confidence: clamp(0.7 + (42 - l) / 42 * 0.25, 0.7, 0.95) };
}

// Clarity from chroma (Lab a/b magnitude)
function determineClarity(lab: { l: number; a: number; b: number }): Clarity {
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  if (chroma < 10) return "muted";
  if (chroma < 20) return "clear";
  return "vivid";
}

// Season suggestion with a SAFE MVP rule set:
// - Only return a season if confidence is decent and undertone not neutral
// - Otherwise season = null
function suggestSeasonSafe(
  undertone: Undertone,
  depth: Depth,
  clarity: Clarity,
  overallConfidence: number
): { season: Season | null; confidence: number; note?: string } {
  // do NOT force a season when low confidence or neutral undertone
  if (undertone === "neutral") return { season: null, confidence: clamp(overallConfidence - 0.15, 0.0, 1.0), note: "Undertone neutral" };
  if (overallConfidence < 0.65) return { season: null, confidence: overallConfidence, note: "Low confidence" };

  // Improved season mapping based on color analysis principles:
  // SPRING: Warm + Light + Clear/Vivid (bright, clear, warm colors)
  // AUTUMN: Warm + Medium/Deep + Muted/Clear (earthy, rich, warm colors)
  // SUMMER: Cool + Light + Muted/Clear (soft, cool, light colors)
  // WINTER: Cool + Medium/Deep + Clear/Vivid (bold, cool, high contrast)
  let season: Season;
  let conf = clamp(0.7 + (overallConfidence - 0.65) * 0.8, 0.7, 0.92);

  if (undertone === "warm") {
    if (depth === "light") {
      // Light warm skin: Spring (clear/vivid) or Autumn (muted)
      if (clarity === "vivid" || clarity === "clear") {
        season = "spring";
      } else {
        // muted light warm -> could be spring or autumn, but muted leans autumn
        season = "autumn";
        conf = clamp(conf - 0.1, 0.6, 0.9); // Lower confidence for ambiguous case
      }
    } else if (depth === "medium") {
      // Medium warm skin: Autumn (muted/clear) or Spring (if very clear)
      if (clarity === "vivid") {
        season = "spring";
        conf = clamp(conf - 0.05, 0.65, 0.9); // Slightly lower confidence
      } else {
        season = "autumn";
      }
    } else {
      // Deep warm skin: Always Autumn
      season = "autumn";
    }
  } else {
    // cool undertone
    if (depth === "light") {
      // Light cool skin: Summer (muted/clear) or Winter (if very vivid)
      if (clarity === "vivid") {
        season = "winter";
        conf = clamp(conf - 0.05, 0.65, 0.9); // Slightly lower confidence
      } else {
        season = "summer";
      }
    } else if (depth === "medium") {
      // Medium cool skin: Summer (muted) or Winter (clear/vivid)
      if (clarity === "vivid" || clarity === "clear") {
        season = "winter";
      } else {
        season = "summer";
      }
    } else {
      // Deep cool skin: Always Winter
      season = "winter";
    }
  }

  return { season, confidence: conf };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageUrl, imageBase64, faceBox } = (req.body || {}) as {
      imageUrl?: string;
      imageBase64?: string;
      faceBox?: FaceBox;
    };

    console.log("🎨 [SKIN TONE API] Request received:", {
      hasImageUrl: !!imageUrl,
      hasImageBase64: !!imageBase64,
      faceBox: faceBox ? { x: faceBox.x, y: faceBox.y, width: faceBox.width, height: faceBox.height } : null,
    });

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: "Missing imageUrl or imageBase64" });
    }

    // IMPORTANT: no heuristic fallback. Require a valid faceBox.
    if (!isValidFaceBox(faceBox)) {
      console.log("🎨 [SKIN TONE API] Invalid faceBox:", faceBox);
      return res.status(400).json({ error: "FACE_NOT_DETECTED" });
    }

    // Load image
    let imageBuffer: Buffer;
    if (imageBase64) {
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      const response = await fetch(imageUrl!, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SkinToneAnalyzer/2.0)" },
      });
      if (!response.ok) return res.status(400).json({ error: `Failed to fetch image: ${response.status}` });
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer.byteLength) return res.status(400).json({ error: "Fetched image is empty" });
      imageBuffer = Buffer.from(arrayBuffer);
    }

    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata?.width || !metadata?.height) {
      return res.status(400).json({ error: "Invalid image (no metadata)" });
    }
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    // Clamp face box to image bounds
    const left = clamp(Math.floor(faceBox.x), 0, imageWidth - 1);
    const top = clamp(Math.floor(faceBox.y), 0, imageHeight - 1);
    const faceWidth = clamp(Math.floor(faceBox.width), 1, imageWidth - left);
    const faceHeight = clamp(Math.floor(faceBox.height), 1, imageHeight - top);

    // Crop face region
    const faceImage = await sharp(imageBuffer)
      .extract({ left, top, width: faceWidth, height: faceHeight })
      // normalize a bit to reduce crazy contrast (helps)
      .modulate({ brightness: 1, saturation: 1 })
      .toBuffer();

    // Downsample for faster scanning
    // 96x96 is small enough for serverless + good enough for robust sampling
    const downW = 96;
    const downH = 96;

    const faceRaw = await sharp(faceImage)
      .resize(downW, downH, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = faceRaw;
    const channels = info.channels || 3;

    // Sample strategy:
    // - Avoid hairline (top) and mouth/chin (bottom) by restricting Y band
    // - Avoid far left/right edges (ears/background) by restricting X band
    const xMin = Math.floor(downW * 0.18);
    const xMax = Math.floor(downW * 0.82);
    const yMin = Math.floor(downH * 0.18);
    const yMax = Math.floor(downH * 0.78);

    const candidates: Array<{ r: number; g: number; b: number; brightness: number }> = [];
    let totalSampled = 0;

    // Use a grid stride to limit work
    const stride = 2; // 2 => ~ (64*48) ~ 1500 checks; fine for Vercel
    for (let y = yMin; y < yMax; y += stride) {
      for (let x = xMin; x < xMax; x += stride) {
        const idx = (y * downW + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] ?? data[idx];
        const b = data[idx + 2] ?? data[idx];
        totalSampled++;

        if (isSkinPixel(r, g, b)) {
          candidates.push({ r, g, b, brightness: (r + g + b) / 3 });
        }
      }
    }

    const skinPixelCount = candidates.length;
    const skinPixelRatio = totalSampled > 0 ? skinPixelCount / totalSampled : 0;

    const notes: string[] = [];
    if (skinPixelRatio < 0.08) notes.push("Low skin pixel ratio — image may not contain a clear face or lighting is harsh.");
    if (skinPixelCount < 150) notes.push("Not enough skin pixels after filtering — confidence reduced.");

    if (skinPixelCount < 80) {
      // Not enough reliable samples
      return res.status(200).json({
        error: "LOW_CONFIDENCE",
        undertone: "neutral",
        depth: "medium",
        clarity: "muted",
        season: null,
        confidence: 0.35,
        diagnostics: {
          skinPixelCount,
          totalSampled,
          skinPixelRatio: Math.round(skinPixelRatio * 1000) / 1000,
          trimmedMeanRgb: null,
          lightingWarning: true,
          notes: [...notes, "Upload a clear selfie in daylight; avoid strong yellow indoor light."],
        },
      });
    }

    // Sort by brightness and trim extremes (remove shadows + highlights)
    candidates.sort((a, b) => a.brightness - b.brightness);
    const n = candidates.length;
    const trim = Math.floor(n * 0.1);
    const trimmed = candidates.slice(trim, Math.max(trim + 1, n - trim));

    // Compute trimmed mean RGB
    let sumR = 0,
      sumG = 0,
      sumB = 0;
    for (const p of trimmed) {
      sumR += p.r;
      sumG += p.g;
      sumB += p.b;
    }
    const meanR = Math.round(sumR / trimmed.length);
    const meanG = Math.round(sumG / trimmed.length);
    const meanB = Math.round(sumB / trimmed.length);

    const hex = rgbToHex(meanR, meanG, meanB);

    // Lighting warning (very rough):
    // If overall image is very warm (R much larger than B), undertone can skew warm.
    const warmth = meanR - meanB;
    const lightingWarning = warmth > 40;

    if (lightingWarning) {
      notes.push("Lighting looks warm (yellow/orange) — undertone may skew warm. Recommend daylight selfie.");
    }

    // Convert to Lab
    const lab = rgbToLab(meanR, meanG, meanB);
    const clarity = determineClarity(lab);

    const undertoneRes = determineUndertone(lab);
    const depthRes = determineDepth(lab.l);

    // Overall confidence:
    // - start from skin ratio and sample count reliability
    // - combine with undertone/depth confidence
    const ratioScore = clamp((skinPixelRatio - 0.06) / 0.25, 0, 1); // 0..1
    const countScore = clamp(Math.log10(skinPixelCount) / 3, 0, 1); // ~0..1
    const reliability = clamp(0.45 + 0.35 * ratioScore + 0.2 * countScore, 0.45, 0.9);

    // penalize warm lighting a bit (to avoid always warm -> autumn)
    const lightingPenalty = lightingWarning ? 0.08 : 0;

    const overallConfidence = clamp(
      (undertoneRes.confidence * 0.45 + depthRes.confidence * 0.25 + reliability * 0.3) - lightingPenalty,
      0,
      1
    );

    const seasonRes = suggestSeasonSafe(undertoneRes.undertone, depthRes.depth, clarity, overallConfidence);

    // Detailed logging for debugging
    console.log("🎨 [SKIN TONE API] Analysis results:", {
      rgb: { r: meanR, g: meanG, b: meanB },
      hex,
      lab: { l: lab.l.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) },
      undertone: undertoneRes.undertone,
      undertoneConfidence: undertoneRes.confidence.toFixed(3),
      depth: depthRes.depth,
      depthConfidence: depthRes.confidence.toFixed(3),
      clarity,
      overallConfidence: overallConfidence.toFixed(3),
      season: seasonRes.season,
      seasonConfidence: seasonRes.confidence.toFixed(3),
      seasonNote: seasonRes.note,
      skinPixelCount,
      skinPixelRatio: (skinPixelRatio * 100).toFixed(1) + "%",
      lightingWarning,
    });

    // If season is null, include a note
    if (seasonRes.season === null) {
      notes.push("Season not returned because confidence is low or undertone is neutral — ask user to confirm or upload a clearer selfie.");
    }

    return res.status(200).json({
      rgb: { r: meanR, g: meanG, b: meanB },
      hex,
      lab: {
        l: Math.round(lab.l * 10) / 10,
        a: Math.round(lab.a * 10) / 10,
        b: Math.round(lab.b * 10) / 10,
      },
      undertone: undertoneRes.undertone,
      depth: depthRes.depth,
      clarity,
      season: seasonRes.season,
      confidence: Math.round(overallConfidence * 100) / 100,
      diagnostics: {
        skinPixelCount,
        totalSampled,
        skinPixelRatio: Math.round(skinPixelRatio * 1000) / 1000,
        trimmedMeanRgb: { r: meanR, g: meanG, b: meanB },
        lightingWarning,
        notes,
      },
    });
  } catch (error: any) {
    console.error("🎨 [SKIN TONE] ERROR:", error?.message || error);
    return res.status(500).json({
      error: error?.message || "Unknown error occurred",
      undertone: "neutral",
      depth: "medium",
      clarity: "muted",
      season: null,
      confidence: 0,
    });
  }
}
