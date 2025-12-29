/**
 * Unified Color API
 * Handles both dominant color detection and exact pixel color picking
 * Mode: 'detect' for dominant color, 'pick' for circular area sampling with trimmed mean
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { getNearestColorName } from '../../lib/colorNaming';

/**
 * Trimmed mean: Remove outliers and average the rest
 * This is a robust statistical method that filters out extreme values
 */
function trimmedMean(samples: Array<{ r: number; g: number; b: number }>, trimRatio: number = 0.15): { r: number; g: number; b: number } {
  if (samples.length === 0) {
    return { r: 128, g: 128, b: 128 };
  }

  if (samples.length === 1) {
    return samples[0];
  }

  // Calculate distances from center (median) for each channel
  const rValues = samples.map(s => s.r).sort((a, b) => a - b);
  const gValues = samples.map(s => s.g).sort((a, b) => a - b);
  const bValues = samples.map(s => s.b).sort((a, b) => a - b);

  const trimCount = Math.floor(samples.length * trimRatio);
  const startIdx = trimCount;
  const endIdx = samples.length - trimCount;

  if (endIdx <= startIdx) {
    // If trimming removes all samples, use median
    const mid = Math.floor(samples.length / 2);
    return {
      r: rValues[mid],
      g: gValues[mid],
      b: bValues[mid],
    };
  }

  // Calculate mean of trimmed values
  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = startIdx; i < endIdx; i++) {
    sumR += rValues[i];
    sumG += gValues[i];
    sumB += bValues[i];
  }

  const count = endIdx - startIdx;
  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
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
    const { mode, imageBase64, imageUrl, x, y, imageWidth, imageHeight } = req.body;

    if (!mode || (mode !== 'detect' && mode !== 'pick')) {
      return res.status(400).json({ error: 'Missing or invalid mode. Must be "detect" or "pick"' });
    }

    // MODE: PICK (circular area sampling with trimmed mean)
    if (mode === 'pick') {
      if (!imageBase64 && !imageUrl) {
        return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
      }

      if (x === undefined || y === undefined) {
        return res.status(400).json({ error: 'Missing x or y coordinates' });
      }

      console.log('🎯 [COLOR API] Picking color from circular area at:', { x, y, imageWidth, imageHeight });

      let imageBuffer: Buffer;

      if (imageBase64) {
        const base64Data = imageBase64.includes(',') 
          ? imageBase64.split(',')[1] 
          : imageBase64;
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageUrl) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const metadata = await sharp(imageBuffer).metadata();
      const actualWidth = metadata.width || 1;
      const actualHeight = metadata.height || 1;

      let pixelX = x;
      let pixelY = y;

      if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
        const scaleX = actualWidth / imageWidth;
        const scaleY = actualHeight / imageHeight;
        pixelX = Math.floor(x * scaleX);
        pixelY = Math.floor(y * scaleY);
      }

      pixelX = Math.max(0, Math.min(pixelX, actualWidth - 1));
      pixelY = Math.max(0, Math.min(pixelY, actualHeight - 1));

      // 16px radius circle sampling
      const SAMPLE_RADIUS = 16;
      const radiusSquared = SAMPLE_RADIUS * SAMPLE_RADIUS;

      // Calculate bounding box for extraction (square that contains the circle)
      const extractLeft = Math.max(0, pixelX - SAMPLE_RADIUS);
      const extractTop = Math.max(0, pixelY - SAMPLE_RADIUS);
      const extractRight = Math.min(actualWidth - 1, pixelX + SAMPLE_RADIUS);
      const extractBottom = Math.min(actualHeight - 1, pixelY + SAMPLE_RADIUS);
      
      const extractWidth = extractRight - extractLeft + 1;
      const extractHeight = extractBottom - extractTop + 1;

      console.log('🎯 [COLOR API] Sampling circular area:', {
        center: { x: pixelX, y: pixelY },
        radius: SAMPLE_RADIUS,
        bounds: { left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight },
      });

      // Extract the bounding box region
      const result = await sharp(imageBuffer)
        .extract({ 
          left: extractLeft, 
          top: extractTop, 
          width: extractWidth, 
          height: extractHeight 
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data, info } = result;
      const channels = info.channels || 3;
      
      // Collect all pixels within the circular area
      const samples: Array<{ r: number; g: number; b: number }> = [];
      const centerX = pixelX - extractLeft;
      const centerY = pixelY - extractTop;
      
      for (let y = 0; y < extractHeight; y++) {
        for (let x = 0; x < extractWidth; x++) {
          // Calculate distance from center
          const dx = x - centerX;
          const dy = y - centerY;
          const distanceSquared = dx * dx + dy * dy;
          
          // Only sample pixels within the circle
          if (distanceSquared <= radiusSquared) {
            const idx = (y * extractWidth + x) * channels;
            const r = data[idx];
            const g = channels >= 2 ? data[idx + 1] : data[idx];
            const b = channels >= 3 ? data[idx + 2] : data[idx];
            
            samples.push({ r, g, b });
          }
        }
      }

      if (samples.length === 0) {
        // Fallback to single pixel if circle is empty (edge case)
        const idx = (centerY * extractWidth + centerX) * channels;
        const r = data[idx];
        const g = channels >= 2 ? data[idx + 1] : data[idx];
        const b = channels >= 3 ? data[idx + 2] : data[idx];
        
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        const colorName = getNearestColorName(hexColor);

        return res.status(200).json({
          color: hexColor,
          rgb: { r, g, b },
          name: colorName.name,
          source: 'manual-pick-fallback',
          pixelsSampled: 1,
        });
      }

      // Apply trimmed mean (remove 15% outliers from each end, average the rest)
      const trimmedResult = trimmedMean(samples, 0.15);
      const { r: avgR, g: avgG, b: avgB } = trimmedResult;

      const hexColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
      
      // Use unified color naming system (Lab-based ΔE matching)
      const colorName = getNearestColorName(hexColor);

      console.log('🎯 [COLOR API] Sampled color (trimmed mean):', {
        rgb: { r: avgR, g: avgG, b: avgB },
        hex: hexColor,
        name: colorName.name,
        pixelsSampled: samples.length,
        radius: SAMPLE_RADIUS,
        method: 'circular-trimmed-mean',
      });

      return res.status(200).json({
        color: hexColor,
        rgb: { r: avgR, g: avgG, b: avgB },
        name: colorName.name,
        source: 'manual-pick-circular-trimmed-mean',
        pixelsSampled: samples.length,
        radius: SAMPLE_RADIUS,
      });
    }

    // MODE: DETECT (dominant color)
    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
    }

    console.log('🎨 [COLOR API] Detecting dominant color...');

    let imageBuffer: Buffer;

    if (imageBase64) {
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Resize for better sampling (200x200 is good balance)
    const resized = await sharp(imageBuffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = resized;
    const width = info.width || 200;
    const height = info.height || 200;
    const channels = info.channels || 3;

    // Strategy: Multi-region sampling with intelligent filtering
    const colorCounts = new Map<string, { count: number; saturation: number; brightness: number }>();
    let totalSampled = 0;

    const margin = Math.min(20, Math.floor(Math.min(width, height) * 0.1));
    const sampleStep = 2;

    for (let y = margin; y < height - margin; y += sampleStep) {
      for (let x = margin; x < width - margin; x += sampleStep) {
        const idx = (y * width + x) * channels;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = (r + g + b) / 3;

        if (brightness > 235) continue;
        if (brightness < 25) continue;
        if (saturation < 0.15 && brightness > 180) continue;
        if (brightness > 220 && saturation < 0.2) continue;

        const qr = Math.round(r / 15) * 15;
        const qg = Math.round(g / 15) * 15;
        const qb = Math.round(b / 15) * 15;
        const colorKey = `${qr},${qg},${qb}`;

        const existing = colorCounts.get(colorKey);
        if (existing) {
          existing.count += 1;
          existing.saturation = Math.max(existing.saturation, saturation);
          existing.brightness = (existing.brightness + brightness) / 2;
        } else {
          colorCounts.set(colorKey, { count: 1, saturation, brightness });
        }
        totalSampled++;
      }
    }

    if (totalSampled < 100 && colorCounts.size < 3) {
      console.log('🎨 [COLOR API] Too few samples, relaxing filters...');
      for (let y = margin; y < height - margin; y += sampleStep) {
        for (let x = margin; x < width - margin; x += sampleStep) {
          const idx = (y * width + x) * channels;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = (r + g + b) / 3;

          if (brightness > 250 || brightness < 15) continue;

          const qr = Math.round(r / 15) * 15;
          const qg = Math.round(g / 15) * 15;
          const qb = Math.round(b / 15) * 15;
          const colorKey = `${qr},${qg},${qb}`;

          const existing = colorCounts.get(colorKey);
          if (existing) {
            existing.count += 1;
            existing.saturation = Math.max(existing.saturation, saturation);
          } else {
            colorCounts.set(colorKey, { count: 1, saturation, brightness });
          }
          totalSampled++;
        }
      }
    }

    let bestColor = { r: 128, g: 128, b: 128 };
    let bestScore = 0;

    for (const [colorKey, data] of colorCounts.entries()) {
      const saturationWeight = 1.2;
      const contrastBonus = data.brightness > 50 && data.brightness < 200 ? 0.3 : 0;
      const score = data.count * (1 + saturationWeight * data.saturation + contrastBonus);

      if (score > bestScore) {
        bestScore = score;
        const [r, g, b] = colorKey.split(',').map(Number);
        bestColor = { r, g, b };
      }
    }

    const { r, g, b } = bestColor;
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    const maxCount = colorCounts.get(`${bestColor.r},${bestColor.g},${bestColor.b}`)?.count || 0;
    console.log('🎨 [COLOR API] Sampled', totalSampled, 'pixels, dominant color:', { r, g, b, hex: hexColor, count: maxCount });

    // Use unified color naming system (Lab-based ΔE matching with full NTC dataset)
    const colorNameResult = getNearestColorName(hexColor);
    const colorName = colorNameResult.name;
    const confidence = 0.85;

    console.log('🎨 [COLOR API] Detected color:', {
      hex: hexColor,
      rgb: { r, g, b },
      name: colorName,
      confidence,
      namingMethod: 'Lab-ΔE-NTC',
    });

    return res.status(200).json({
      color: hexColor,
      name: colorName,
      confidence,
    });
  } catch (error: any) {
    console.error('🎨 [COLOR API] Error:', error.message);
    return res.status(500).json({
      error: error.message,
      color: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
    });
  }
}

