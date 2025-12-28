/**
 * Unified Color API
 * Handles both dominant color detection and exact pixel color picking
 * Mode: 'detect' for dominant color, 'pick' for exact pixel
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

// RGB to color name mapping (comprehensive list)
function rgbToColorName(r: number, g: number, b: number): string {
  const colors: Array<{ name: string; r: number; g: number; b: number; tolerance: number }> = [
    { name: 'black', r: 0, g: 0, b: 0, tolerance: 30 },
    { name: 'white', r: 255, g: 255, b: 255, tolerance: 30 },
    { name: 'grey', r: 128, g: 128, b: 128, tolerance: 40 },
    { name: 'gray', r: 128, g: 128, b: 128, tolerance: 40 },
    { name: 'red', r: 255, g: 0, b: 0, tolerance: 50 },
    { name: 'burgundy', r: 128, g: 0, b: 32, tolerance: 40 },
    { name: 'maroon', r: 128, g: 0, b: 0, tolerance: 40 },
    { name: 'crimson', r: 220, g: 20, b: 60, tolerance: 40 },
    { name: 'pink', r: 255, g: 192, b: 203, tolerance: 50 },
    { name: 'rose', r: 255, g: 0, b: 127, tolerance: 50 },
    { name: 'coral', r: 255, g: 127, b: 80, tolerance: 50 },
    { name: 'salmon', r: 250, g: 128, b: 114, tolerance: 50 },
    { name: 'orange', r: 255, g: 165, b: 0, tolerance: 50 },
    { name: 'peach', r: 255, g: 218, b: 185, tolerance: 50 },
    { name: 'yellow', r: 255, g: 255, b: 0, tolerance: 50 },
    { name: 'gold', r: 255, g: 215, b: 0, tolerance: 50 },
    { name: 'mustard', r: 255, g: 219, b: 88, tolerance: 50 },
    { name: 'green', r: 0, g: 128, b: 0, tolerance: 50 },
    { name: 'emerald', r: 80, g: 200, b: 120, tolerance: 50 },
    { name: 'olive', r: 128, g: 128, b: 0, tolerance: 50 },
    { name: 'mint', r: 152, g: 255, b: 152, tolerance: 50 },
    { name: 'teal', r: 0, g: 128, b: 128, tolerance: 50 },
    { name: 'turquoise', r: 64, g: 224, b: 208, tolerance: 50 },
    { name: 'cyan', r: 0, g: 255, b: 255, tolerance: 50 },
    { name: 'blue', r: 0, g: 0, b: 255, tolerance: 50 },
    { name: 'navy', r: 0, g: 0, b: 128, tolerance: 40 },
    { name: 'royal blue', r: 65, g: 105, b: 225, tolerance: 50 },
    { name: 'sky blue', r: 135, g: 206, b: 235, tolerance: 50 },
    { name: 'purple', r: 128, g: 0, b: 128, tolerance: 50 },
    { name: 'violet', r: 138, g: 43, b: 226, tolerance: 50 },
    { name: 'lavender', r: 230, g: 230, b: 250, tolerance: 50 },
    { name: 'plum', r: 221, g: 160, b: 221, tolerance: 50 },
    { name: 'indigo', r: 75, g: 0, b: 130, tolerance: 50 },
    { name: 'brown', r: 165, g: 42, b: 42, tolerance: 50 },
    { name: 'tan', r: 210, g: 180, b: 140, tolerance: 50 },
    { name: 'beige', r: 245, g: 245, b: 220, tolerance: 50 },
    { name: 'cream', r: 255, g: 253, b: 208, tolerance: 50 },
    { name: 'ivory', r: 255, g: 255, b: 240, tolerance: 50 },
    { name: 'khaki', r: 240, g: 230, b: 140, tolerance: 50 },
    { name: 'camel', r: 193, g: 154, b: 107, tolerance: 50 },
    { name: 'rust', r: 183, g: 65, b: 14, tolerance: 50 },
    { name: 'terracotta', r: 226, g: 114, b: 91, tolerance: 50 },
  ];

  let bestMatch = { name: 'unknown', distance: Infinity };

  for (const color of colors) {
    const distance = Math.sqrt(
      Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2)
    );
    if (distance < color.tolerance && distance < bestMatch.distance) {
      bestMatch = { name: color.name, distance };
    }
  }

  if (bestMatch.name === 'unknown') {
    // Fallback to hue-based naming
    const hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * (180 / Math.PI);
    if (hue < 0) hue += 360;
    
    if (hue < 15 || hue >= 345) return 'red';
    if (hue < 45) return 'orange';
    if (hue < 75) return 'yellow';
    if (hue < 165) return 'green';
    if (hue < 195) return 'cyan';
    if (hue < 255) return 'blue';
    if (hue < 285) return 'purple';
    if (hue < 315) return 'pink';
    return 'red';
  }

  return bestMatch.name;
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

    // MODE: PICK (exact pixel color)
    if (mode === 'pick') {
      if (!imageBase64 && !imageUrl) {
        return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
      }

      if (x === undefined || y === undefined) {
        return res.status(400).json({ error: 'Missing x or y coordinates' });
      }

      console.log('🎯 [COLOR API] Picking exact pixel color at:', { x, y, imageWidth, imageHeight });

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

      console.log('🎯 [COLOR API] Actual image size:', { actualWidth, actualHeight });
      console.log('🎯 [COLOR API] Pixel coordinates:', { pixelX, pixelY });

      const result = await sharp(imageBuffer)
        .extract({ left: pixelX, top: pixelY, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data, info } = result;
      const channels = info.channels || 3;
      
      const r = data[0];
      const g = channels >= 2 ? data[1] : data[0];
      const b = channels >= 3 ? data[2] : data[0];

      const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

      console.log('🎯 [COLOR API] Exact pixel color:', { r, g, b, hex: hexColor });

      return res.status(200).json({
        color: hexColor,
        rgb: { r, g, b },
        source: 'manual-pick-exact-pixel',
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

    const colorName = rgbToColorName(r, g, b);
    const confidence = 0.85;

    console.log('🎨 [COLOR API] Detected color:', {
      hex: hexColor,
      rgb: { r, g, b },
      name: colorName,
      confidence,
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

