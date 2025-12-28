/**
 * Skin Tone Analysis API
 * Analyzes face image to determine undertone, depth, and season suggestion
 * Uses Sharp for server-side image processing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

// Convert RGB to Lab color space (simplified approximation)
function rgbToLab(r: number, g: number, b: number) {
  // Normalize RGB to 0-1
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // Convert to linear RGB
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Convert to XYZ (D65 illuminant)
  let x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) / 0.95047;
  let y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750) / 1.00000;
  let z = (rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041) / 1.08883;

  // Convert to Lab
  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

  const l = (116 * y) - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return { l, a, b };
}

// Determine undertone from Lab values
function determineUndertone(lab: { l: number; a: number; b: number }): { undertone: 'warm' | 'cool' | 'neutral'; confidence: number } {
  // Warm undertones: positive b (yellow), positive a (red)
  // Cool undertones: negative b (blue), negative a (green)
  // Neutral: balanced
  
  const { a, b } = lab;
  
  // Calculate distance from neutral
  const distance = Math.sqrt(a * a + b * b);
  
  // Warm: b > 0 and a > 0 (yellow-red direction)
  // Cool: b < 0 or (a < 0 and b < 0) (blue-green direction)
  
  if (b > 5 && a > 0) {
    // Clearly warm
    const confidence = Math.min(0.95, 0.7 + (distance / 50));
    return { undertone: 'warm', confidence };
  } else if (b < -5 || (a < 0 && b < 0)) {
    // Clearly cool
    const confidence = Math.min(0.95, 0.7 + (Math.abs(distance) / 50));
    return { undertone: 'cool', confidence };
  } else {
    // Neutral zone
    const confidence = Math.max(0.5, 0.8 - (distance / 30));
    return { undertone: 'neutral', confidence };
  }
}

// Determine depth from lightness
function determineDepth(l: number): { depth: 'light' | 'medium' | 'deep'; confidence: number } {
  // L* ranges from 0 (black) to 100 (white)
  // Light: L > 70
  // Medium: 40 < L <= 70
  // Deep: L <= 40
  
  if (l > 70) {
    return { depth: 'light', confidence: Math.min(0.95, 0.7 + ((l - 70) / 30) * 0.25) };
  } else if (l > 40) {
    // Medium - confidence based on distance from boundaries
    const distFromLight = l - 40;
    const distFromDeep = 70 - l;
    const confidence = 0.7 + (Math.min(distFromLight, distFromDeep) / 30) * 0.2;
    return { depth: 'medium', confidence: Math.min(0.9, confidence) };
  } else {
    return { depth: 'deep', confidence: Math.min(0.95, 0.7 + ((40 - l) / 40) * 0.25) };
  }
}

// Suggest season based on undertone, depth, and clarity
function suggestSeason(
  undertone: 'warm' | 'cool' | 'neutral',
  depth: 'light' | 'medium' | 'deep',
  clarity: 'muted' | 'clear' | 'vivid'
): { season: 'spring' | 'summer' | 'autumn' | 'winter'; confidence: number } {
  // Rule table:
  // Warm + light + clear => Spring
  // Warm + medium/deep + muted => Autumn
  // Cool + light + muted => Summer
  // Cool + deep + clear/high contrast => Winter
  
  let season: 'spring' | 'summer' | 'autumn' | 'winter';
  let confidence = 0.7;
  
  if (undertone === 'warm') {
    if (depth === 'light' && (clarity === 'clear' || clarity === 'vivid')) {
      season = 'spring';
      confidence = 0.8;
    } else if ((depth === 'medium' || depth === 'deep') && clarity === 'muted') {
      season = 'autumn';
      confidence = 0.8;
    } else {
      // Fallback for warm
      season = depth === 'light' ? 'spring' : 'autumn';
      confidence = 0.65;
    }
  } else if (undertone === 'cool') {
    if (depth === 'light' && clarity === 'muted') {
      season = 'summer';
      confidence = 0.8;
    } else if (depth === 'deep' && (clarity === 'clear' || clarity === 'vivid')) {
      season = 'winter';
      confidence = 0.8;
    } else {
      // Fallback for cool
      season = depth === 'light' ? 'summer' : 'winter';
      confidence = 0.65;
    }
  } else {
    // Neutral - use depth as primary indicator
    if (depth === 'light') {
      season = 'summer'; // Default to summer for light neutrals
      confidence = 0.6;
    } else if (depth === 'deep') {
      season = 'winter'; // Default to winter for deep neutrals
      confidence = 0.6;
    } else {
      season = 'autumn'; // Default to autumn for medium neutrals
      confidence = 0.55;
    }
  }
  
  return { season, confidence };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, imageBase64, faceBox } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
    }

    // Validate faceBox
    if (!faceBox || typeof faceBox !== 'object') {
      console.error('🎨 [SKIN TONE] Invalid faceBox:', faceBox);
      return res.status(400).json({ error: 'Missing or invalid faceBox' });
    }

    console.log('🎨 [SKIN TONE] ========== STARTING ANALYSIS ==========');
    console.log('🎨 [SKIN TONE] Request received:', {
      hasImageUrl: !!imageUrl,
      hasImageBase64: !!imageBase64,
      imageUrl: imageUrl ? imageUrl.substring(0, 100) + '...' : 'N/A',
      faceBox: faceBox,
      faceBoxIsHeuristic: faceBox && (faceBox.x < 0 || faceBox.y < 0 || faceBox.width < 0 || faceBox.height < 0),
    });

    // Load image FIRST to get dimensions
    let imageBuffer: Buffer;
    if (imageBase64) {
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      imageBuffer = Buffer.from(base64Data, 'base64');
      console.log('🎨 [SKIN TONE] Loaded image from base64, length:', base64Data.length);
    } else if (imageUrl) {
      console.log('🎨 [SKIN TONE] Fetching image from URL:', imageUrl.substring(0, 100));
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      console.log('🎨 [SKIN TONE] Fetched image, size:', arrayBuffer.byteLength, 'bytes');
    } else {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width || 1;
    const imageHeight = metadata.height || 1;

    console.log('🎨 [SKIN TONE] Image metadata:', {
      width: imageWidth,
      height: imageHeight,
      format: metadata.format,
      channels: metadata.channels,
    });

    // NOW calculate heuristic face box using actual image dimensions
    let actualFaceBox = faceBox;
    if (!faceBox || faceBox.x < 0 || faceBox.y < 0 || faceBox.width < 0 || faceBox.height < 0) {
      // Use heuristic: for selfies/portraits, face is typically in center-upper 60%
      // Assume face takes up roughly 40-50% of image width, centered horizontally
      // And is in upper 60% of image height
      const estimatedFaceWidth = Math.floor(imageWidth * 0.45);
      const estimatedFaceHeight = Math.floor(imageHeight * 0.50);
      const estimatedX = Math.floor((imageWidth - estimatedFaceWidth) / 2);
      const estimatedY = Math.floor(imageHeight * 0.15); // Upper 15% to start
      
      actualFaceBox = {
        x: estimatedX,
        y: estimatedY,
        width: estimatedFaceWidth,
        height: estimatedFaceHeight,
      };
      
      console.log('🎨 [SKIN TONE] Calculated heuristic face box:', {
        ...actualFaceBox,
        imageWidth,
        imageHeight,
        faceWidthPercent: ((estimatedFaceWidth / imageWidth) * 100).toFixed(1) + '%',
        faceHeightPercent: ((estimatedFaceHeight / imageHeight) * 100).toFixed(1) + '%',
      });
    } else {
      console.log('🎨 [SKIN TONE] Using provided face box:', actualFaceBox);
    }
    
    if (!actualFaceBox || actualFaceBox.x < 0 || actualFaceBox.y < 0 || actualFaceBox.width <= 0 || actualFaceBox.height <= 0) {
      console.error('🎨 [SKIN TONE] Invalid face box:', actualFaceBox);
      return res.status(400).json({ error: 'Invalid faceBox. Could not determine face region.' });
    }

    // Extract face region
    const { x, y, width, height } = actualFaceBox;
    
    // Clamp face box to image bounds
    const left = Math.max(0, Math.min(x, imageWidth - 1));
    const top = Math.max(0, Math.min(y, imageHeight - 1));
    const faceWidth = Math.min(width, imageWidth - left);
    const faceHeight = Math.min(height, imageHeight - top);

    // Crop face region
    const faceImage = await sharp(imageBuffer)
      .extract({ left, top, width: faceWidth, height: faceHeight })
      .toBuffer();

    const faceMetadata = await sharp(faceImage).metadata();
    const faceW = faceMetadata.width || faceWidth;
    const faceH = faceMetadata.height || faceHeight;

    console.log('🎨 [SKIN TONE] Face region extracted:', { faceW, faceH });

    // Sample skin patches: cheek areas and forehead (avoid eyes, lips, hairline)
    // Cheek zones: lower 1/3 of face, outer 1/4 on each side
    // Forehead: upper 1/4, center 1/2 horizontally
    
    const samples: Array<{ r: number; g: number; b: number }> = [];
    
    // Cheek left: lower 1/3, left 1/4
    const cheekLeftX = Math.floor(faceW * 0.1);
    const cheekLeftY = Math.floor(faceH * 0.6);
    const cheekLeftSize = Math.min(30, Math.floor(faceW * 0.15));
    
    // Cheek right: lower 1/3, right 1/4
    const cheekRightX = Math.floor(faceW * 0.75);
    const cheekRightY = Math.floor(faceH * 0.6);
    const cheekRightSize = Math.min(30, Math.floor(faceW * 0.15));
    
    // Forehead: upper 1/4, center
    const foreheadX = Math.floor(faceW * 0.35);
    const foreheadY = Math.floor(faceH * 0.15);
    const foreheadSize = Math.min(30, Math.floor(faceW * 0.2));

    // Sample patches
    const patches = [
      { x: cheekLeftX, y: cheekLeftY, size: cheekLeftSize },
      { x: cheekRightX, y: cheekRightY, size: cheekRightSize },
      { x: foreheadX, y: foreheadY, size: foreheadSize },
    ];

    for (const patch of patches) {
      if (patch.x + patch.size <= faceW && patch.y + patch.size <= faceH) {
        const patchImage = await sharp(faceImage)
          .extract({ 
            left: patch.x, 
            top: patch.y, 
            width: patch.size, 
            height: patch.size 
          })
          .resize(10, 10) // Downsample for averaging
          .raw()
          .toBuffer({ resolveWithObject: true });

        const { data, info } = patchImage;
        const channels = info.channels || 3;
        let totalR = 0, totalG = 0, totalB = 0, count = 0;

        for (let i = 0; i < data.length; i += channels) {
          totalR += data[i];
          totalG += data[i + 1] || data[i];
          totalB += data[i + 2] || data[i];
          count++;
        }

        if (count > 0) {
          samples.push({
            r: Math.round(totalR / count),
            g: Math.round(totalG / count),
            b: Math.round(totalB / count),
          });
        }
      }
    }

    console.log('🎨 [SKIN TONE] Skin samples collected:', {
      sampleCount: samples.length,
      samples: samples.map(s => ({ 
        r: s.r, 
        g: s.g, 
        b: s.b, 
        hex: `#${s.r.toString(16).padStart(2, '0')}${s.g.toString(16).padStart(2, '0')}${s.b.toString(16).padStart(2, '0')}`,
        brightness: ((s.r + s.g + s.b) / 3).toFixed(1),
      })),
    });

    if (samples.length === 0) {
      console.error('🎨 [SKIN TONE] No skin samples collected!');
      return res.status(400).json({ error: 'Could not sample skin patches' });
    }

    // Calculate median/trimmed mean RGB (use median for robustness)
    samples.sort((a, b) => {
      const brightnessA = (a.r + a.g + a.b) / 3;
      const brightnessB = (b.r + b.g + b.b) / 3;
      return brightnessA - brightnessB;
    });

    const medianIdx = Math.floor(samples.length / 2);
    const skinRgb = samples[medianIdx];
    
    console.log('🎨 [SKIN TONE] Selected skin RGB (median):', {
      r: skinRgb.r,
      g: skinRgb.g,
      b: skinRgb.b,
      hex: `#${skinRgb.r.toString(16).padStart(2, '0')}${skinRgb.g.toString(16).padStart(2, '0')}${skinRgb.b.toString(16).padStart(2, '0')}`,
      brightness: ((skinRgb.r + skinRgb.g + skinRgb.b) / 3).toFixed(1),
    });

    // Convert to Lab
    const lab = rgbToLab(skinRgb.r, skinRgb.g, skinRgb.b);

    // Determine attributes
    const { undertone, confidence: undertoneConfidence } = determineUndertone(lab);
    const { depth, confidence: depthConfidence } = determineDepth(lab.l);
    
    // Estimate clarity from saturation (chroma)
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let clarity: 'muted' | 'clear' | 'vivid';
    if (chroma < 10) {
      clarity = 'muted';
    } else if (chroma < 20) {
      clarity = 'clear';
    } else {
      clarity = 'vivid';
    }

    // Suggest season
    const { season, confidence: seasonConfidence } = suggestSeason(undertone, depth, clarity);

    // Overall confidence (average of undertone, depth, and season)
    const overallConfidence = (undertoneConfidence + depthConfidence + seasonConfidence) / 3;

    const hexColor = `#${skinRgb.r.toString(16).padStart(2, '0')}${skinRgb.g.toString(16).padStart(2, '0')}${skinRgb.b.toString(16).padStart(2, '0')}`;

    console.log('🎨 [SKIN TONE] ========== ANALYSIS COMPLETE ==========');
    console.log('🎨 [SKIN TONE] Results:', {
      rgb: skinRgb,
      hex: hexColor,
      lab: { 
        l: Math.round(lab.l * 10) / 10, 
        a: Math.round(lab.a * 10) / 10, 
        b: Math.round(lab.b * 10) / 10 
      },
      undertone: `${undertone} (confidence: ${(undertoneConfidence * 100).toFixed(0)}%)`,
      depth: `${depth} (confidence: ${(depthConfidence * 100).toFixed(0)}%)`,
      clarity,
      season: `${season} (confidence: ${(seasonConfidence * 100).toFixed(0)}%)`,
      overallConfidence: `${(overallConfidence * 100).toFixed(0)}%`,
    });
    console.log('🎨 [SKIN TONE] ========================================');

    return res.status(200).json({
      rgb: skinRgb,
      hex: hexColor,
      lab: { l: Math.round(lab.l * 10) / 10, a: Math.round(lab.a * 10) / 10, b: Math.round(lab.b * 10) / 10 },
      undertone,
      depth,
      clarity,
      season,
      confidence: Math.round(overallConfidence * 100) / 100,
    });
  } catch (error: any) {
    console.error('🎨 [SKIN TONE] ========== ERROR ==========');
    console.error('🎨 [SKIN TONE] Error message:', error.message);
    console.error('🎨 [SKIN TONE] Error stack:', error.stack);
    console.error('🎨 [SKIN TONE] Error name:', error.name);
    if (error.cause) {
      console.error('🎨 [SKIN TONE] Error cause:', error.cause);
    }
    console.error('🎨 [SKIN TONE] ==========================');
    
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      errorType: error.name || 'Error',
      undertone: 'neutral',
      depth: 'medium',
      season: 'autumn',
      confidence: 0,
    });
  }
}

