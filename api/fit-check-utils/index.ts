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

  // Return in format expected by frontend
  const response = {
    success: dominantColor.name !== 'unknown' && dominantColor.confidence > 0,
    color: dominantColor.color,
    colorName: dominantColor.name,
    colorHex: dominantColor.color,
    name: dominantColor.name, // Also include for compatibility
    confidence: dominantColor.confidence,
  };
  
  console.log('🎨 [COLOR DETECTION] Returning response:', response);
  return res.status(200).json(response);
}

/**
 * Handle size chart parsing
 */
async function handleParseSizeChart(req: VercelRequest, res: VercelResponse) {
  const { imageUrl, imageBase64 } = req.body;

  console.log('📊 [OCR PARSING] Starting size chart parsing');
  console.log('📊 [OCR PARSING] Has imageUrl:', !!imageUrl);
  console.log('📊 [OCR PARSING] Has imageBase64:', !!imageBase64);

  if (!imageUrl && !imageBase64) {
    console.error('📊 [OCR PARSING] Missing image data');
    return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
  }

  const visionApiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!visionApiKey) {
    console.warn('📊 [OCR PARSING] No API key found, returning manual input structure');
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

  try {
    // Prepare image data
    let imageContent: { content?: string; source?: { imageUri: string } } = {};
    
    if (imageBase64) {
      // Base64 image - remove data URL prefix if present
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      imageContent = { content: base64Data };
      console.log('📊 [OCR PARSING] Using base64 image (length:', base64Data.length, ')');
    } else if (imageUrl) {
      imageContent = { source: { imageUri: imageUrl } };
      console.log('📊 [OCR PARSING] Using image URL:', imageUrl);
    }

    // Use Google Vision API to extract text
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
    
    console.log('📊 [OCR PARSING] Calling Vision API...');
    const visionResponse = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: imageContent,
          features: [{ type: 'TEXT_DETECTION', maxResults: 10 }],
        }],
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('📊 [OCR PARSING] Vision API error:', visionResponse.status, errorText);
      throw new Error(`Vision API error: ${visionResponse.statusText}`);
    }

    const visionData = await visionResponse.json();
    console.log('📊 [OCR PARSING] Vision API response received');
    
    const extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';
    console.log('📊 [OCR PARSING] Extracted text length:', extractedText.length);
    console.log('📊 [OCR PARSING] Extracted text preview:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn('📊 [OCR PARSING] No text extracted from image');
      return res.status(200).json({
        success: false,
        parsed: false,
        message: 'Could not extract text from image. Please enter measurements manually.',
        rawText: '',
        structure: {
          sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
        },
      });
    }

    // Parse the extracted text to find size chart data
    console.log('📊 [OCR PARSING] Parsing size chart text...');
    const parsedData = parseSizeChartText(extractedText);
    console.log('📊 [OCR PARSING] Parse result:', {
      success: parsedData.success,
      sizesFound: parsedData.data?.length || 0,
      structure: parsedData.structure,
    });

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
  } catch (error: any) {
    console.error('📊 [OCR PARSING] Error:', error.message);
    return res.status(500).json({
      success: false,
      parsed: false,
      error: error.message,
      message: 'Failed to parse size chart. Please enter measurements manually.',
      structure: {
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
      },
    });
  }
}

/**
 * Extract dominant color from image using Google Vision API
 * Uses image properties detection to get dominant colors
 */
async function extractDominantColor(imageSource: string): Promise<{
  color: string;
  name: string;
  confidence: number;
}> {
  console.log('🎨 [COLOR DETECTION] Starting color extraction from:', imageSource?.substring(0, 50));
  
  const visionApiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!visionApiKey) {
    console.warn('🎨 [COLOR DETECTION] No API key found, cannot detect color');
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  }

  try {
    // Prepare image data
    let imageContent: { content?: string; source?: { imageUri: string } } = {};
    
    if (imageSource.startsWith('data:image') || imageSource.startsWith('base64')) {
      // Base64 image
      const base64Data = imageSource.includes(',') ? imageSource.split(',')[1] : imageSource;
      imageContent = { content: base64Data };
      console.log('🎨 [COLOR DETECTION] Using base64 image');
    } else if (imageSource.startsWith('http')) {
      // URL
      imageContent = { source: { imageUri: imageSource } };
      console.log('🎨 [COLOR DETECTION] Using image URL:', imageSource);
    } else {
      console.error('🎨 [COLOR DETECTION] Invalid image format');
      return {
        color: '#000000',
        name: 'unknown',
        confidence: 0,
      };
    }

    // Call Google Vision API for image properties (dominant colors)
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
    
    const visionResponse = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: imageContent,
          features: [
            { type: 'IMAGE_PROPERTIES', maxResults: 1 },
            { type: 'TEXT_DETECTION', maxResults: 1 }, // Also try to extract color from text
          ],
        }],
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('🎨 [COLOR DETECTION] Vision API error:', visionResponse.status, errorText);
      throw new Error(`Vision API error: ${visionResponse.statusText}`);
    }

    const visionData = await visionResponse.json();
    console.log('🎨 [COLOR DETECTION] Vision API response received');

    // Extract dominant colors from image properties
    const imageProperties = visionData.responses?.[0]?.imagePropertiesAnnotation?.dominantColors?.colors;
    
    if (imageProperties && imageProperties.length > 0) {
      // Get the most dominant color (first in array, sorted by score)
      const dominantColor = imageProperties[0].color;
      const r = Math.round(dominantColor.red || 0);
      const g = Math.round(dominantColor.green || 0);
      const b = Math.round(dominantColor.blue || 0);
      const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      // Map RGB to color name
      const colorName = rgbToColorName(r, g, b);
      const confidence = imageProperties[0].score || 0.5;
      
      console.log('🎨 [COLOR DETECTION] Detected color:', {
        hex: hexColor,
        rgb: { r, g, b },
        name: colorName,
        confidence,
      });
      
      return {
        color: hexColor,
        name: colorName,
        confidence: Math.min(confidence * 100, 100),
      };
    }

    // Fallback: Try to extract color from text (product description might mention color)
    const extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';
    if (extractedText) {
      const colorFromText = extractColorFromText(extractedText);
      if (colorFromText) {
        console.log('🎨 [COLOR DETECTION] Found color in text:', colorFromText);
        return {
          color: colorFromText.hex || '#000000',
          name: colorFromText.name,
          confidence: 0.7,
        };
      }
    }

    console.warn('🎨 [COLOR DETECTION] No color detected, returning unknown');
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  } catch (error: any) {
    console.error('🎨 [COLOR DETECTION] Error extracting color:', error.message);
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  }
}

/**
 * Convert RGB to color name
 */
function rgbToColorName(r: number, g: number, b: number): string {
  // Color mapping based on RGB values
  const colors: Array<{ name: string; rgb: [number, number, number]; threshold: number }> = [
    { name: 'black', rgb: [0, 0, 0], threshold: 30 },
    { name: 'white', rgb: [255, 255, 255], threshold: 225 },
    { name: 'grey', rgb: [128, 128, 128], threshold: 50 },
    { name: 'red', rgb: [255, 0, 0], threshold: 100 },
    { name: 'blue', rgb: [0, 0, 255], threshold: 100 },
    { name: 'navy', rgb: [0, 0, 128], threshold: 50 },
    { name: 'green', rgb: [0, 255, 0], threshold: 100 },
    { name: 'yellow', rgb: [255, 255, 0], threshold: 200 },
    { name: 'orange', rgb: [255, 165, 0], threshold: 100 },
    { name: 'pink', rgb: [255, 192, 203], threshold: 150 },
    { name: 'purple', rgb: [128, 0, 128], threshold: 80 },
    { name: 'brown', rgb: [165, 42, 42], threshold: 60 },
    { name: 'beige', rgb: [245, 245, 220], threshold: 200 },
    { name: 'cream', rgb: [255, 253, 208], threshold: 220 },
    { name: 'ivory', rgb: [255, 255, 240], threshold: 240 },
    { name: 'khaki', rgb: [195, 176, 145], threshold: 120 },
    { name: 'olive', rgb: [128, 128, 0], threshold: 80 },
    { name: 'burgundy', rgb: [128, 0, 32], threshold: 50 },
    { name: 'maroon', rgb: [128, 0, 0], threshold: 50 },
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

  return closestColor;
}

/**
 * Extract color name from text
 */
function extractColorFromText(text: string): { name: string; hex?: string } | null {
  const colorKeywords = [
    'black', 'white', 'grey', 'gray', 'red', 'blue', 'navy', 'green', 'yellow',
    'orange', 'pink', 'purple', 'brown', 'beige', 'cream', 'ivory', 'khaki',
    'olive', 'burgundy', 'maroon', 'wine', 'plum', 'camel', 'rust', 'teal',
    'emerald', 'lavender', 'coral', 'salmon', 'tan', 'charcoal', 'slate',
  ];

  const lowerText = text.toLowerCase();
  for (const color of colorKeywords) {
    if (lowerText.includes(color)) {
      return { name: color };
    }
  }

  return null;
}

/**
 * Parse size chart text from OCR output
 * @param {string} text - Extracted text from OCR
 * @returns {Object} Parsed size chart data
 */
function parseSizeChartText(text: string) {
  console.log('📊 [PARSE TEXT] Starting text parsing, length:', text.length);
  
  if (!text || text.trim().length === 0) {
    console.warn('📊 [PARSE TEXT] Empty text provided');
    return { success: false, data: null, structure: null };
  }

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log('📊 [PARSE TEXT] Total lines:', lines.length);
  
  // Enhanced patterns for better matching
  const sizePattern = /\b(XS|S|M|L|XL|XXL|XXXL|XXS|\d{2,3})\b/i; // Include numeric sizes like 30, 32, 34
  const measurementPattern = /\b(chest|waist|hips|hip|bust|length|sleeve|shoulder|inseam|rise|thigh|leg|arm|pit|pit-to-pit)\b/i;
  const numberPattern = /(\d+\.?\d*)\s*(cm|in|inch|inches|"|'|ft|centimeter|centimetre)?/i;

  const sizes: string[] = [];
  const measurements: string[] = [];
  const data: Record<string, Record<string, number>> = {};

  // First pass: identify sizes and measurements
  console.log('📊 [PARSE TEXT] First pass: identifying sizes and measurements');
  for (const line of lines) {
    // Check for size labels
    const sizeMatch = line.match(sizePattern);
    if (sizeMatch) {
      const size = sizeMatch[1].toUpperCase();
      if (!sizes.includes(size)) {
        sizes.push(size);
        console.log('📊 [PARSE TEXT] Found size:', size);
      }
    }

    // Check for measurement labels
    const measureMatch = line.match(measurementPattern);
    if (measureMatch) {
      let measure = measureMatch[1].toLowerCase();
      // Normalize measurement names
      if (measure === 'hip') measure = 'hips';
      if (measure === 'pit' || measure === 'pit-to-pit') measure = 'chest';
      if (!measurements.includes(measure)) {
        measurements.push(measure);
        console.log('📊 [PARSE TEXT] Found measurement:', measure);
      }
    }
  }

  console.log('📊 [PARSE TEXT] Found sizes:', sizes);
  console.log('📊 [PARSE TEXT] Found measurements:', measurements);

  // Second pass: extract values - improved algorithm
  console.log('📊 [PARSE TEXT] Second pass: extracting values');
  let currentSize: string | null = null;
  let headerRow = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a header row (contains measurement names)
    const hasMeasurements = measurementPattern.test(line);
    const hasSizes = sizePattern.test(line);
    
    if (hasMeasurements && hasSizes) {
      // This might be a header row - parse it differently
      headerRow = true;
      console.log('📊 [PARSE TEXT] Detected header row:', line);
      
      // Extract all sizes from header
      const headerSizes = line.match(new RegExp(sizePattern.source, 'gi')) || [];
      const headerMeasures = line.match(new RegExp(measurementPattern.source, 'gi')) || [];
      
      // Find numbers in this line
      const numbers = line.match(/\d+\.?\d*/g) || [];
      
      if (headerSizes.length > 0 && numbers.length > 0) {
        // Map numbers to sizes
        headerSizes.forEach((size, idx) => {
          const sizeKey = size.toUpperCase();
          if (!data[sizeKey]) {
            data[sizeKey] = {};
          }
          // Try to map numbers to measurements based on position
          if (numbers[idx] !== undefined) {
            const value = parseFloat(numbers[idx]);
            const isCm = line.toLowerCase().includes('cm');
            const normalizedValue = isCm ? value / 2.54 : value;
            
            // Try to find which measurement this belongs to
            if (headerMeasures.length > 0) {
              const measureIdx = Math.floor(idx / (numbers.length / headerMeasures.length));
              if (headerMeasures[measureIdx]) {
                let measure = headerMeasures[measureIdx].toLowerCase();
                if (measure === 'hip') measure = 'hips';
                if (measure === 'pit' || measure === 'pit-to-pit') measure = 'chest';
                data[sizeKey][measure] = normalizedValue;
                console.log(`📊 [PARSE TEXT] Mapped ${sizeKey}.${measure} = ${normalizedValue}`);
              }
            }
          }
        });
      }
      continue;
    }
    
    // Regular row parsing
    const sizeMatch = line.match(sizePattern);
    if (sizeMatch) {
      currentSize = sizeMatch[1].toUpperCase();
      if (!data[currentSize]) {
        data[currentSize] = {};
      }
      console.log('📊 [PARSE TEXT] Processing size:', currentSize);
    }

    if (currentSize) {
      // Extract numbers with units
      const numbers = line.match(/\d+\.?\d*/g) || [];
      const measureMatch = line.match(measurementPattern);
      
      if (numbers.length > 0) {
        // Check if line has measurement label
        if (measureMatch) {
          let measure = measureMatch[1].toLowerCase();
          if (measure === 'hip') measure = 'hips';
          if (measure === 'pit' || measure === 'pit-to-pit') measure = 'chest';
          
          // Find the number closest to the measurement label
          const measureIndex = line.toLowerCase().indexOf(measure);
          let closestNumber = numbers[0];
          let closestDistance = Infinity;
          
          for (const num of numbers) {
            const numIndex = line.indexOf(num);
            const distance = Math.abs(numIndex - measureIndex);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestNumber = num;
            }
          }
          
          const value = parseFloat(closestNumber);
          const isCm = line.toLowerCase().includes('cm');
          const normalizedValue = isCm ? value / 2.54 : value;
          
          data[currentSize][measure] = normalizedValue;
          console.log(`📊 [PARSE TEXT] Mapped ${currentSize}.${measure} = ${normalizedValue} (from "${line}")`);
        } else if (numbers.length > 0 && measurements.length > 0) {
          // No measurement label, but we have numbers - try to infer from position
          // This is less reliable but better than nothing
          const numValues = numbers.map(n => {
            const val = parseFloat(n);
            const isCm = line.toLowerCase().includes('cm');
            return isCm ? val / 2.54 : val;
          });
          
          // Map to measurements in order (if we have same count)
          if (numValues.length === measurements.length) {
            measurements.forEach((measure, idx) => {
              data[currentSize][measure] = numValues[idx];
              console.log(`📊 [PARSE TEXT] Inferred ${currentSize}.${measure} = ${numValues[idx]}`);
            });
          }
        }
      }
    }
  }

  // Convert to fitLogic format
  const sizeChart = Object.entries(data)
    .filter(([size, measurements]) => Object.keys(measurements).length > 0)
    .map(([size, measurements]) => ({
      size,
      measurements,
    }));

  console.log('📊 [PARSE TEXT] Final parsed data:', {
    success: sizeChart.length > 0,
    sizeCount: sizeChart.length,
    sizes: sizeChart.map(s => s.size),
  });

  return {
    success: sizeChart.length > 0,
    data: sizeChart.length > 0 ? sizeChart : null,
    structure: {
      sizes: sizes.length > 0 ? sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      measurements: measurements.length > 0 ? measurements : ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
    },
  };
}

