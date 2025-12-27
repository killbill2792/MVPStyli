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
    const { imageBase64, imageUrl, pickPixel, x, y, imageWidth, imageHeight } = req.body;

    // If pickPixel is true, extract exact pixel color at coordinates
    if (pickPixel && (x !== undefined && y !== undefined)) {
      return await handlePixelColorPick(req, res, imageBase64, imageUrl, x, y, imageWidth, imageHeight);
    }

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
    // Strategy: Multi-pass approach - sample broadly, filter backgrounds, prefer product colors
    console.log('🎨 [COLOR API] Processing image with sharp...');
    
    // Get metadata first
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 100;
    const originalHeight = metadata.height || 100;
    
    // Resize to 200x200 for better sampling while maintaining performance
    const resized = await sharp(imageBuffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
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
    
    // Strategy: Multi-region sampling with intelligent filtering
    // 1. Sample from multiple regions (avoid edges which are often background)
    // 2. Filter out common background colors aggressively
    // 3. For solid color images, sample broadly across the center
    // 4. Prefer saturated colors with good contrast
    
    const colorCounts = new Map<string, { count: number; saturation: number; brightness: number }>();
    let totalSampled = 0;
    
    // Define sampling regions - focus on center areas, avoid edges
    // For product photos, the product is usually in the center
    const margin = Math.min(20, Math.floor(Math.min(width, height) * 0.1)); // 10% margin from edges
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Sample from a grid across the center region (avoiding edges)
    const sampleStep = 2; // Sample every 2nd pixel for performance
    for (let y = margin; y < height - margin; y += sampleStep) {
      for (let x = margin; x < width - margin; x += sampleStep) {
        const idx = (y * width + x) * channels;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        // Calculate color properties
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = (r + g + b) / 3;
        
        // Aggressive background filtering:
        // 1. Very bright (white/light backgrounds): brightness > 235
        // 2. Very dark (shadows/extreme dark): brightness < 25
        // 3. Low saturation light grays (common backgrounds): saturation < 0.15 and brightness > 180
        // 4. Near-white with low saturation: brightness > 220 and saturation < 0.2
        if (brightness > 235) continue; // Too bright (white background)
        if (brightness < 25) continue; // Too dark (shadow/black background)
        if (saturation < 0.15 && brightness > 180) continue; // Light gray backgrounds
        if (brightness > 220 && saturation < 0.2) continue; // Near-white backgrounds
        
        // For solid color images, we want to capture the dominant color
        // Quantize more aggressively for solid colors (round to nearest 15)
        const qr = Math.round(r / 15) * 15;
        const qg = Math.round(g / 15) * 15;
        const qb = Math.round(b / 15) * 15;
        const colorKey = `${qr},${qg},${qb}`;
        
        const existing = colorCounts.get(colorKey);
        if (existing) {
          existing.count += 1;
          existing.saturation = Math.max(existing.saturation, saturation);
          existing.brightness = (existing.brightness + brightness) / 2; // Average brightness
        } else {
          colorCounts.set(colorKey, { count: 1, saturation, brightness });
        }
        totalSampled++;
      }
    }
    
    // If we filtered out too much, relax filters and resample
    if (totalSampled < 100 && colorCounts.size < 3) {
      console.log('🎨 [COLOR API] Too few samples, relaxing filters...');
      // Relaxed sampling - only filter extreme cases
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
          
          // Only filter extreme cases now
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
    
    // Find best color using weighted scoring
    // Score = count * (1 + saturation_weight * saturation + contrast_bonus)
    // This favors: common colors, saturated colors, and colors with good contrast
    let bestColor = { r: 128, g: 128, b: 128 }; // Default fallback
    let bestScore = 0;
    
    for (const [colorKey, data] of colorCounts.entries()) {
      // Saturation bonus: higher saturation = more likely to be product color
      const saturationWeight = 1.2;
      // Contrast bonus: colors with medium brightness (not too light/dark) are more visible
      const contrastBonus = data.brightness > 50 && data.brightness < 200 ? 0.3 : 0;
      const score = data.count * (1 + saturationWeight * data.saturation + contrastBonus);
      
      if (score > bestScore) {
        bestScore = score;
        const [r, g, b] = colorKey.split(',').map(Number);
        bestColor = { r, g, b };
      }
    }
    
    const dominantColor = bestColor;
    
    const { r, g, b } = dominantColor;
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    const maxCount = colorCounts.get(`${dominantColor.r},${dominantColor.g},${dominantColor.b}`)?.count || 0;
    console.log('🎨 [COLOR API] Sampled', totalSampled, 'pixels, dominant color:', { r, g, b, hex: hexColor, count: maxCount, dominance: totalSampled > 0 ? (maxCount / totalSampled * 100).toFixed(1) + '%' : '0%' });

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
 * Convert RGB to color name using comprehensive color palette
 * Returns a descriptive color name that matches common fashion/apparel colors
 */
function rgbToColorName(r: number, g: number, b: number): string {
  // Comprehensive color palette with RGB values and distance thresholds
  // Organized by color families for better matching
  const colors: Array<{ name: string; rgb: [number, number, number]; threshold: number }> = [
    // Neutrals - Black, White, Grays
    { name: 'black', rgb: [0, 0, 0], threshold: 40 },
    { name: 'charcoal', rgb: [54, 69, 79], threshold: 50 },
    { name: 'dark grey', rgb: [64, 64, 64], threshold: 40 },
    { name: 'grey', rgb: [128, 128, 128], threshold: 60 },
    { name: 'gray', rgb: [128, 128, 128], threshold: 60 },
    { name: 'light grey', rgb: [192, 192, 192], threshold: 50 },
    { name: 'slate', rgb: [112, 128, 144], threshold: 60 },
    { name: 'silver', rgb: [192, 192, 192], threshold: 60 },
    { name: 'white', rgb: [255, 255, 255], threshold: 230 },
    { name: 'off-white', rgb: [250, 250, 250], threshold: 220 },
    { name: 'ivory', rgb: [255, 255, 240], threshold: 240 },
    { name: 'cream', rgb: [255, 253, 208], threshold: 220 },
    { name: 'beige', rgb: [245, 245, 220], threshold: 200 },
    { name: 'ecru', rgb: [205, 184, 144], threshold: 100 },
    
    // Browns and Tans
    { name: 'dark brown', rgb: [101, 67, 33], threshold: 50 },
    { name: 'brown', rgb: [165, 42, 42], threshold: 70 },
    { name: 'chocolate', rgb: [123, 63, 0], threshold: 60 },
    { name: 'coffee', rgb: [111, 78, 55], threshold: 60 },
    { name: 'camel', rgb: [193, 154, 107], threshold: 90 },
    { name: 'tan', rgb: [210, 180, 140], threshold: 100 },
    { name: 'taupe', rgb: [139, 133, 137], threshold: 80 },
    { name: 'mocha', rgb: [150, 113, 95], threshold: 70 },
    { name: 'caramel', rgb: [255, 213, 154], threshold: 100 },
    
    // Reds and Pinks
    { name: 'burgundy', rgb: [128, 0, 32], threshold: 60 },
    { name: 'maroon', rgb: [128, 0, 0], threshold: 60 },
    { name: 'wine', rgb: [114, 47, 55], threshold: 60 },
    { name: 'cherry', rgb: [222, 49, 99], threshold: 80 },
    { name: 'red', rgb: [255, 0, 0], threshold: 120 },
    { name: 'crimson', rgb: [220, 20, 60], threshold: 80 },
    { name: 'scarlet', rgb: [255, 36, 0], threshold: 100 },
    { name: 'rose', rgb: [255, 0, 127], threshold: 100 },
    { name: 'pink', rgb: [255, 192, 203], threshold: 150 },
    { name: 'hot pink', rgb: [255, 105, 180], threshold: 120 },
    { name: 'blush', rgb: [222, 93, 131], threshold: 100 },
    { name: 'salmon', rgb: [250, 128, 114], threshold: 120 },
    { name: 'coral', rgb: [255, 127, 80], threshold: 120 },
    { name: 'peach', rgb: [255, 218, 185], threshold: 140 },
    
    // Oranges and Yellows
    { name: 'rust', rgb: [183, 65, 14], threshold: 70 },
    { name: 'terracotta', rgb: [226, 114, 91], threshold: 90 },
    { name: 'orange', rgb: [255, 165, 0], threshold: 120 },
    { name: 'tangerine', rgb: [255, 204, 0], threshold: 120 },
    { name: 'amber', rgb: [255, 191, 0], threshold: 120 },
    { name: 'yellow', rgb: [255, 255, 0], threshold: 200 },
    { name: 'gold', rgb: [255, 215, 0], threshold: 150 },
    { name: 'mustard', rgb: [255, 219, 88], threshold: 140 },
    { name: 'lemon', rgb: [255, 250, 205], threshold: 180 },
    
    // Greens
    { name: 'forest green', rgb: [34, 139, 34], threshold: 70 },
    { name: 'dark green', rgb: [0, 100, 0], threshold: 60 },
    { name: 'green', rgb: [0, 255, 0], threshold: 120 },
    { name: 'emerald', rgb: [80, 200, 120], threshold: 90 },
    { name: 'mint', rgb: [152, 255, 152], threshold: 120 },
    { name: 'sage', rgb: [188, 184, 138], threshold: 100 },
    { name: 'olive', rgb: [128, 128, 0], threshold: 90 },
    { name: 'khaki', rgb: [195, 176, 145], threshold: 120 },
    { name: 'lime', rgb: [191, 255, 0], threshold: 150 },
    { name: 'teal', rgb: [0, 128, 128], threshold: 80 },
    { name: 'turquoise', rgb: [64, 224, 208], threshold: 100 },
    { name: 'aqua', rgb: [0, 255, 255], threshold: 120 },
    
    // Blues
    { name: 'navy', rgb: [0, 0, 128], threshold: 60 },
    { name: 'dark blue', rgb: [0, 0, 139], threshold: 60 },
    { name: 'blue', rgb: [0, 0, 255], threshold: 120 },
    { name: 'royal blue', rgb: [65, 105, 225], threshold: 100 },
    { name: 'cobalt', rgb: [0, 71, 171], threshold: 70 },
    { name: 'sky blue', rgb: [135, 206, 235], threshold: 120 },
    { name: 'baby blue', rgb: [137, 207, 240], threshold: 120 },
    { name: 'indigo', rgb: [75, 0, 130], threshold: 70 },
    { name: 'periwinkle', rgb: [204, 204, 255], threshold: 140 },
    
    // Purples and Violets
    { name: 'plum', rgb: [128, 0, 128], threshold: 80 },
    { name: 'purple', rgb: [128, 0, 128], threshold: 100 },
    { name: 'violet', rgb: [138, 43, 226], threshold: 90 },
    { name: 'lavender', rgb: [230, 230, 250], threshold: 180 },
    { name: 'lilac', rgb: [200, 162, 200], threshold: 140 },
    { name: 'mauve', rgb: [224, 176, 255], threshold: 150 },
    { name: 'amethyst', rgb: [153, 102, 204], threshold: 100 },
    
    // Special/Neon colors
    { name: 'neon pink', rgb: [255, 20, 147], threshold: 100 },
    { name: 'neon green', rgb: [57, 255, 20], threshold: 120 },
    { name: 'neon yellow', rgb: [255, 255, 0], threshold: 200 },
    { name: 'electric blue', rgb: [125, 249, 255], threshold: 120 },
  ];

  // Find closest color match using Euclidean distance
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

  // Fallback: If no close match, use hue-based classification
  if (closestColor === 'unknown') {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const brightness = (r + g + b) / 3;
    
    // Grayscale check
    if (delta < 30) {
      if (brightness < 60) return 'black';
      if (brightness > 240) return 'white';
      return 'grey';
    }
    
    // Hue-based classification
    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = ((g - b) / delta) % 6;
      } else if (max === g) {
        hue = (b - r) / delta + 2;
      } else {
        hue = (r - g) / delta + 4;
      }
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    
    // Classify by hue ranges
    if (hue >= 0 && hue < 30) return brightness > 200 ? 'peach' : 'red';
    if (hue >= 30 && hue < 60) return brightness > 200 ? 'peach' : 'orange';
    if (hue >= 60 && hue < 90) return brightness > 200 ? 'yellow' : 'mustard';
    if (hue >= 90 && hue < 150) return brightness > 200 ? 'lime' : 'green';
    if (hue >= 150 && hue < 210) return brightness > 200 ? 'mint' : 'teal';
    if (hue >= 210 && hue < 270) return brightness > 200 ? 'sky blue' : 'blue';
    if (hue >= 270 && hue < 330) return brightness > 200 ? 'lavender' : 'purple';
    if (hue >= 330 && hue < 360) return brightness > 200 ? 'pink' : 'burgundy';
    
    // Final fallback
    return brightness > 200 ? 'light grey' : 'dark grey';
  }

  return closestColor;
}

/**
 * Handle pixel color picking - extracts exact color at specific coordinates
 */
async function handlePixelColorPick(
  req: VercelRequest,
  res: VercelResponse,
  imageBase64: string | undefined,
  imageUrl: string | undefined,
  x: number,
  y: number,
  imageWidth: number | undefined,
  imageHeight: number | undefined
) {
  try {
    console.log('🎨 [COLOR PICKER] Picking pixel color at coordinates:', { x, y, imageWidth, imageHeight });

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

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const actualWidth = metadata.width || 1;
    const actualHeight = metadata.height || 1;

    // Convert tap coordinates (from displayed image) to actual image coordinates
    let pixelX = x;
    let pixelY = y;

    if (imageWidth && imageHeight) {
      // Calculate scale factor if image was resized for display
      const scaleX = actualWidth / imageWidth;
      const scaleY = actualHeight / imageHeight;
      pixelX = Math.floor(x * scaleX);
      pixelY = Math.floor(y * scaleY);
    }

    // Clamp coordinates to image bounds
    pixelX = Math.max(0, Math.min(pixelX, actualWidth - 1));
    pixelY = Math.max(0, Math.min(pixelY, actualHeight - 1));

    console.log('🎨 [COLOR PICKER] Actual image size:', { actualWidth, actualHeight });
    console.log('🎨 [COLOR PICKER] Pixel coordinates:', { pixelX, pixelY });

    // Extract raw pixel data at the exact coordinates
    // Extract a small region around the point (3x3) and average for better accuracy
    const extractSize = 3;
    const left = Math.max(0, pixelX - Math.floor(extractSize / 2));
    const top = Math.max(0, pixelY - Math.floor(extractSize / 2));
    const width = Math.min(extractSize, actualWidth - left);
    const height = Math.min(extractSize, actualHeight - top);

    const { data } = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = data.info.channels || 3;
    
    // Average the pixels in the small region
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      totalR += data[i];
      totalG += data[i + 1] || data[i];
      totalB += data[i + 2] || data[i];
      count++;
    }

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const colorName = rgbToColorName(r, g, b);

    console.log('🎨 [COLOR PICKER] Picked color:', { r, g, b, hex: hexColor, name: colorName });

    return res.status(200).json({
      color: hexColor,
      name: colorName,
      confidence: 1.0, // High confidence for manually picked pixel
      rgb: { r, g, b },
      source: 'manual-pick',
    });
  } catch (error: any) {
    console.error('🎨 [COLOR PICKER] Error:', error.message);
    return res.status(500).json({
      error: error.message,
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    });
  }
}

