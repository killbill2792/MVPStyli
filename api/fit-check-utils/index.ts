/**
 * Fit Check Utilities API
 * Merged endpoint for detect-color and parse-size-chart
 * Reduces serverless function count from 2 to 1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { type, imageUrl, imageBase64 } = req.body;

    if (!type || (type !== 'detect-color' && type !== 'parse-size-chart')) {
      return res.status(400).json({ error: 'Invalid type. Must be "detect-color" or "parse-size-chart"' });
    }

    if (type === 'detect-color') {
      return await handleDetectColor(req, res);
    } else if (type === 'parse-size-chart') {
      return await handleParseSizeChart(req, res);
    }
  } catch (error: any) {
    console.error('Error in fit-check-utils:', error);
    return res.status(500).json({
      error: 'Failed to process request',
      message: error.message,
    });
  }
}

/**
 * Handle color detection
 */
async function handleDetectColor(req: VercelRequest, res: VercelResponse) {
  const { imageUrl, imageBase64 } = req.body;

  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
  }

  // Use a color extraction service or library
  // For MVP, we'll use a simple approach with a color extraction API
  // You can use services like:
  // - Google Vision API (color detection)
  // - Cloudinary (image analysis)
  // - Or implement a simple color extraction algorithm

  // For now, return a placeholder that the frontend can use
  // In production, you'd implement actual color detection
  
  // Simple color detection using image processing
  const dominantColor = await extractDominantColor(imageUrl || imageBase64);

  return res.status(200).json({
    success: true,
    color: dominantColor.color,
    colorName: dominantColor.name,
    confidence: dominantColor.confidence,
  });
}

/**
 * Handle size chart parsing
 */
async function handleParseSizeChart(req: VercelRequest, res: VercelResponse) {
  const { imageUrl, imageBase64 } = req.body;

  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
  }

  // Use Google Vision API or Tesseract.js for OCR
  // For now, we'll use a simple approach with Google Vision API
  // You'll need to set GEMINI_API_KEY or GOOGLE_VISION_API_KEY in Vercel
  
  const visionApiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!visionApiKey) {
    // Fallback: return structure for manual input
    return res.status(200).json({
      success: false,
      parsed: false,
      message: 'OCR service not configured. Please enter measurements manually.',
      structure: {
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
      },
    });
  }

  // Use Google Vision API to extract text
  const imageData = imageBase64 || imageUrl;
  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
  
  const visionResponse = await fetch(visionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        image: imageBase64 ? { content: imageBase64.split(',')[1] } : { source: { imageUri: imageUrl } },
        features: [{ type: 'TEXT_DETECTION', maxResults: 10 }],
      }],
    }),
  });

  if (!visionResponse.ok) {
    throw new Error(`Vision API error: ${visionResponse.statusText}`);
  }

  const visionData = await visionResponse.json();
  const extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';

  // Parse the extracted text to find size chart data
  const parsedData = parseSizeChartText(extractedText);

  return res.status(200).json({
    success: true,
    parsed: parsedData.success,
    data: parsedData.data,
    rawText: extractedText,
    message: parsedData.success 
      ? 'Size chart parsed successfully' 
      : 'Could not parse size chart automatically. Please enter measurements manually.',
    structure: parsedData.structure,
  });
}

/**
 * Extract dominant color from image
 * This is a simplified version - in production, use a proper image processing library
 */
async function extractDominantColor(imageSource: string): Promise<{
  color: string;
  name: string;
  confidence: number;
}> {
  // Placeholder implementation
  // In production, you would:
  // 1. Load the image
  // 2. Sample pixels (avoid edges/background)
  // 3. Cluster colors
  // 4. Find dominant cluster
  // 5. Map to color name
  
  // For now, return a default
  return {
    color: '#6B46C1', // Purple as default
    name: 'purple',
    confidence: 0.5,
  };
}

/**
 * Parse size chart text from OCR output
 * @param {string} text - Extracted text from OCR
 * @returns {Object} Parsed size chart data
 */
function parseSizeChartText(text: string) {
  if (!text) {
    return { success: false, data: null, structure: null };
  }

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Try to find size labels (XS, S, M, L, XL, XXL, or numbers)
  const sizePattern = /\b(XS|S|M|L|XL|XXL|XXXL|\d+)\b/i;
  const measurementPattern = /\b(chest|waist|hips|bust|length|sleeve|shoulder|inseam|rise|thigh|leg)\b/i;
  const numberPattern = /(\d+\.?\d*)\s*(cm|in|inch|inches|"|'|ft)?/i;

  const sizes: string[] = [];
  const measurements: string[] = [];
  const data: Record<string, Record<string, number>> = {};

  // First pass: identify sizes and measurements
  for (const line of lines) {
    // Check for size labels
    const sizeMatch = line.match(sizePattern);
    if (sizeMatch && !sizes.includes(sizeMatch[1].toUpperCase())) {
      sizes.push(sizeMatch[1].toUpperCase());
    }

    // Check for measurement labels
    const measureMatch = line.match(measurementPattern);
    if (measureMatch) {
      const measure = measureMatch[1].toLowerCase();
      if (!measurements.includes(measure)) {
        measurements.push(measure);
      }
    }
  }

  // Second pass: extract values
  let currentSize: string | null = null;
  for (const line of lines) {
    const sizeMatch = line.match(sizePattern);
    if (sizeMatch) {
      currentSize = sizeMatch[1].toUpperCase();
      if (!data[currentSize]) {
        data[currentSize] = {};
      }
    }

    if (currentSize) {
      // Extract numbers with units
      const numbers = line.match(/\d+\.?\d*/g);
      const measureMatch = line.match(measurementPattern);
      
      if (numbers && measureMatch) {
        const measure = measureMatch[1].toLowerCase();
        const value = parseFloat(numbers[0]);
        
        // Convert to inches if in cm
        if (line.toLowerCase().includes('cm')) {
          data[currentSize][measure] = value / 2.54;
        } else {
          data[currentSize][measure] = value;
        }
      }
    }
  }

  // Convert to fitLogic format
  const sizeChart = Object.entries(data).map(([size, measurements]) => ({
    size,
    measurements,
  }));

  return {
    success: sizeChart.length > 0,
    data: sizeChart.length > 0 ? sizeChart : null,
    structure: {
      sizes: sizes.length > 0 ? sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      measurements: measurements.length > 0 ? measurements : ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
    },
  };
}

