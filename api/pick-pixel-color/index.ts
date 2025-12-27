/**
 * Pixel Color Picker API (SEPARATE from auto-detect)
 * Extracts EXACT pixel color at specific coordinates
 * Does NOT use dominant color detection or any averaging logic
 * This is ONLY for manual color picking
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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
    const { imageBase64, imageUrl, x, y, imageWidth, imageHeight } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
    }

    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: 'Missing x or y coordinates' });
    }

    console.log('🎯 [PIXEL PICK] Picking exact pixel color at:', { x, y, imageWidth, imageHeight });

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

    if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
      // Calculate scale factor if image was resized for display
      const scaleX = actualWidth / imageWidth;
      const scaleY = actualHeight / imageHeight;
      pixelX = Math.floor(x * scaleX);
      pixelY = Math.floor(y * scaleY);
    }

    // Clamp coordinates to image bounds
    pixelX = Math.max(0, Math.min(pixelX, actualWidth - 1));
    pixelY = Math.max(0, Math.min(pixelY, actualHeight - 1));

    console.log('🎯 [PIXEL PICK] Actual image size:', { actualWidth, actualHeight });
    console.log('🎯 [PIXEL PICK] Pixel coordinates:', { pixelX, pixelY });

    // Extract EXACT pixel color at coordinates (NO averaging, NO region sampling)
    // This is the exact pixel the user tapped
    const result = await sharp(imageBuffer)
      .extract({ left: pixelX, top: pixelY, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = result;
    const channels = info.channels || 3;
    
    // Get the EXACT pixel RGB values (no averaging)
    const r = data[0];
    const g = channels >= 2 ? data[1] : data[0];
    const b = channels >= 3 ? data[2] : data[0];

    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    console.log('🎯 [PIXEL PICK] Exact pixel color:', { r, g, b, hex: hexColor });

    return res.status(200).json({
      color: hexColor,
      rgb: { r, g, b },
      source: 'manual-pick-exact-pixel',
    });
  } catch (error: any) {
    console.error('🎯 [PIXEL PICK] Error:', error.message);
    return res.status(500).json({
      error: error.message,
      color: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
    });
  }
}

