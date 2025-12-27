/**
 * Server-Side Color Detection API
 * Uses sharp to extract dominant colors from images
 * Works with HEIC, JPEG, PNG, and other formats
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    const { imageBase64, imageUrl } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
    }

    console.log('🎨 [COLOR API] Starting color detection');
    console.log('🎨 [COLOR API] Has imageBase64:', !!imageBase64);
    console.log('🎨 [COLOR API] Has imageUrl:', !!imageUrl);

    let imageBuffer: Buffer;

    if (imageBase64) {
      // Extract base64 data
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      imageBuffer = Buffer.from(base64Data, 'base64');
      console.log('🎨 [COLOR API] Using base64 image (length:', imageBuffer.length, ')');
    } else if (imageUrl) {
      // Fetch image from URL
      console.log('🎨 [COLOR API] Fetching image from URL:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      console.log('🎨 [COLOR API] Fetched image (length:', imageBuffer.length, ')');
    } else {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Use sharp to extract dominant color by sampling actual pixels
    // Strategy: Resize to small size, extract raw pixel data, find most common color in center
    console.log('🎨 [COLOR API] Processing image with sharp...');
    
    // Resize to 100x100 for faster processing while maintaining color accuracy
    const resized = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = resized.data;
    const channels = resized.info.channels; // Usually 3 (RGB) or 4 (RGBA)
    const width = resized.info.width;
    const height = resized.info.height;
    
    if (channels < 3) {
      console.warn('🎨 [COLOR API] Insufficient color channels');
      return res.status(200).json({
        color: '#000000',
        name: 'unknown',
        confidence: 0,
      });
    }
    
    // Sample pixels from center region (avoid edges which might be background/watermarks)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.min(30, Math.floor(Math.min(width, height) / 2));
    
    // Collect colors from center region with quantization
    const colorCounts = new Map<string, number>();
    let sampleCount = 0;
    
    for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y++) {
      for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          
          // Quantize colors to reduce noise (round to nearest 15 for better grouping)
          const qr = Math.round(r / 15) * 15;
          const qg = Math.round(g / 15) * 15;
          const qb = Math.round(b / 15) * 15;
          const colorKey = `${qr},${qg},${qb}`;
          
          colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
          sampleCount++;
        }
      }
    }
    
    // Find most common color (dominant color)
    let maxCount = 0;
    let dominantColor = { r: 128, g: 128, b: 128 }; // Default to grey
    
    for (const [colorKey, count] of colorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = colorKey.split(',').map(Number);
        dominantColor = { r, g, b };
      }
    }
    
    const { r, g, b } = dominantColor;
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    console.log('🎨 [COLOR API] Sampled', sampleCount, 'pixels, dominant color:', { r, g, b, hex: hexColor, dominance: (maxCount / sampleCount * 100).toFixed(1) + '%' });

    // Map RGB to color name
    const colorName = rgbToColorName(r, g, b);
    const confidence = 0.85; // High confidence with sharp

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
    console.error('🎨 [COLOR API] Error stack:', error.stack);
    return res.status(500).json({
      error: error.message,
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    });
  }
}

/**
 * Convert RGB to color name
 */
function rgbToColorName(r: number, g: number, b: number): string {
  const colors: Array<{ name: string; rgb: [number, number, number]; threshold: number }> = [
    { name: 'black', rgb: [0, 0, 0], threshold: 30 },
    { name: 'white', rgb: [255, 255, 255], threshold: 225 },
    { name: 'grey', rgb: [128, 128, 128], threshold: 50 },
    { name: 'gray', rgb: [128, 128, 128], threshold: 50 },
    { name: 'red', rgb: [255, 0, 0], threshold: 100 },
    { name: 'blue', rgb: [0, 0, 255], threshold: 100 },
    { name: 'navy', rgb: [0, 0, 128], threshold: 50 },
    { name: 'green', rgb: [0, 255, 0], threshold: 100 },
    { name: 'yellow', rgb: [255, 255, 0], threshold: 200 },
    { name: 'orange', rgb: [255, 165, 0], threshold: 100 },
    { name: 'pink', rgb: [255, 192, 203], threshold: 150 },
    { name: 'purple', rgb: [128, 0, 128], threshold: 80 },
    { name: 'violet', rgb: [138, 43, 226], threshold: 80 },
    { name: 'lavender', rgb: [230, 230, 250], threshold: 180 },
    { name: 'brown', rgb: [165, 42, 42], threshold: 60 },
    { name: 'beige', rgb: [245, 245, 220], threshold: 200 },
    { name: 'cream', rgb: [255, 253, 208], threshold: 220 },
    { name: 'ivory', rgb: [255, 255, 240], threshold: 240 },
    { name: 'khaki', rgb: [195, 176, 145], threshold: 120 },
    { name: 'olive', rgb: [128, 128, 0], threshold: 80 },
    { name: 'burgundy', rgb: [128, 0, 32], threshold: 50 },
    { name: 'maroon', rgb: [128, 0, 0], threshold: 50 },
    { name: 'wine', rgb: [128, 0, 32], threshold: 50 },
    { name: 'plum', rgb: [128, 0, 128], threshold: 70 },
    { name: 'camel', rgb: [193, 154, 107], threshold: 80 },
    { name: 'rust', rgb: [183, 65, 14], threshold: 60 },
    { name: 'teal', rgb: [0, 128, 128], threshold: 70 },
    { name: 'emerald', rgb: [80, 200, 120], threshold: 80 },
    { name: 'coral', rgb: [255, 127, 80], threshold: 100 },
    { name: 'salmon', rgb: [250, 128, 114], threshold: 120 },
    { name: 'tan', rgb: [210, 180, 140], threshold: 100 },
    { name: 'charcoal', rgb: [54, 69, 79], threshold: 40 },
    { name: 'slate', rgb: [112, 128, 144], threshold: 60 },
  ];

  // Find closest color match
  let minDistance = Infinity;
  let closestColor = 'unknown';

  for (const color of colors) {
    const distance = Math.sqrt(
      Math.pow(r - color.rgb[0], 2) +
      Math.pow(g - color.rgb[1], 2) +
      Math.pow(b - color.rgb[2], 2)
    );
    
    if (distance < minDistance && distance < color.threshold) {
      minDistance = distance;
      closestColor = color.name;
    }
  }

  // If closest match is still too far, check if it's grayscale
  const isGrayscale = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
  if (isGrayscale && minDistance > 100) {
    const brightness = (r + g + b) / 3;
    if (brightness < 50) {
      closestColor = 'black';
    } else if (brightness > 200) {
      closestColor = 'white';
    } else {
      closestColor = 'grey';
    }
  }

  return closestColor;
}

