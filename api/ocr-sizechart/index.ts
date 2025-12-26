/**
 * OCR Size Chart Parser (Free, No Heavy Dependencies)
 * Uses OCR.space free API (no API key required for basic usage)
 * Falls back to manual input structure if OCR fails
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
    const { imageBase64, imageUrl } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
    }

    console.log('📊 [OCR] Starting size chart parsing');
    console.log('📊 [OCR] Has imageBase64:', !!imageBase64);
    console.log('📊 [OCR] Has imageUrl:', !!imageUrl);

    // Prepare image for Tesseract
    let imageSource: string;
    
    if (imageBase64) {
      // Remove data URL prefix if present
      imageSource = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      console.log('📊 [OCR] Using base64 image (length:', imageSource.length, ')');
    } else if (imageUrl) {
      imageSource = imageUrl;
      console.log('📊 [OCR] Using image URL:', imageUrl);
    } else {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Use OCR.space free API (no API key required for basic usage)
    // Alternative: Use a lightweight OCR solution
    console.log('📊 [OCR] Using OCR.space free API...');
    
    let extractedText = '';
    let ocrConfidence = 0;
    
    try {
      // OCR.space free API (no key required, but limited requests)
      // Format: base64 image data
      const base64Data = imageBase64 
        ? (imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64)
        : null;
      
      if (base64Data) {
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Image: base64Data,
            language: 'eng',
            isOverlayRequired: false,
            iscreatesearchablepdf: false,
            issearchablepdfhidetextlayer: false,
          }),
        });
        
        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json();
          console.log('📊 [OCR] OCR.space response:', JSON.stringify(ocrData, null, 2));
          
          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults[0].ParsedText || '';
            ocrConfidence = ocrData.ParsedResults[0].TextOverlay?.HasOverlay ? 80 : 60;
            console.log('📊 [OCR] Text extracted successfully');
          } else if (ocrData.ErrorMessage) {
            console.warn('📊 [OCR] OCR.space error:', ocrData.ErrorMessage);
            // Fall through to manual input
          }
        } else {
          const errorText = await ocrResponse.text();
          console.warn('📊 [OCR] OCR.space API error:', ocrResponse.status, errorText);
          // Fall through to manual input
        }
      } else if (imageUrl) {
        // Try with image URL
        const ocrResponse = await fetch(`https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(imageUrl)}&language=eng`);
        
        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json();
          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults[0].ParsedText || '';
            ocrConfidence = 70;
          }
        }
      }
    } catch (ocrError: any) {
      console.error('📊 [OCR] OCR.space API failed:', ocrError.message);
      // Continue to return manual input structure
    }

    console.log('📊 [OCR] Text extraction complete');
    console.log('📊 [OCR] Confidence:', ocrConfidence);
    console.log('📊 [OCR] Extracted text length:', extractedText.length);
    console.log('📊 [OCR] Extracted text preview:', extractedText.substring(0, 300));

    if (!text || text.trim().length === 0) {
      console.warn('📊 [OCR] No text extracted from image');
      return res.status(200).json({
        success: false,
        parsed: false,
        confidence: 0,
        message: 'Could not extract text from image. Please enter measurements manually.',
        rawText: '',
        data: null,
        structure: {
          sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
        },
      });
    }

    // Parse the extracted text to find size chart data
    console.log('📊 [OCR] Parsing size chart text...');
    const parsedData = parseSizeChartText(extractedText, ocrConfidence);

    console.log('📊 [OCR] Parse result:', {
      success: parsedData.success,
      sizesFound: parsedData.data?.length || 0,
      confidence: parsedData.confidence,
      structure: parsedData.structure,
    });

    return res.status(200).json({
      success: true,
      parsed: parsedData.success,
      confidence: parsedData.confidence,
      data: parsedData.data,
      rawText: text,
      message: parsedData.success 
        ? 'Size chart parsed successfully' 
        : 'Could not parse size chart automatically. Please enter measurements manually.',
      structure: parsedData.structure,
    });
  } catch (error: any) {
    console.error('📊 [OCR] Error:', error.message);
    console.error('📊 [OCR] Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      parsed: false,
      confidence: 0,
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
 * Parse size chart text from OCR output
 * @param {string} text - Extracted text from OCR
 * @param {number} ocrConfidence - OCR confidence score (0-100)
 * @returns {Object} Parsed size chart data
 */
function parseSizeChartText(text: string, ocrConfidence: number) {
  console.log('📊 [PARSE TEXT] Starting text parsing, length:', text.length);
  console.log('📊 [PARSE TEXT] OCR confidence:', ocrConfidence);
  
  if (!text || text.trim().length === 0) {
    console.warn('📊 [PARSE TEXT] Empty text provided');
    return { success: false, data: null, structure: null, confidence: 0 };
  }

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log('📊 [PARSE TEXT] Total lines:', lines.length);
  
  // Enhanced patterns for better matching
  const sizePattern = /\b(XS|S|M|L|XL|XXL|XXXL|XXS|\d{2,3})\b/i; // Include numeric sizes like 30, 32, 34
  const measurementPattern = /\b(chest|waist|hips|hip|bust|length|sleeve|shoulder|inseam|rise|thigh|leg|arm|pit|pit-to-pit|garment length|top length|dress length)\b/i;
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
      if (measure.includes('length')) {
        if (measure.includes('garment') || measure.includes('top')) measure = 'topLength';
        else if (measure.includes('dress')) measure = 'dressLength';
        else measure = 'length';
      }
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
  
  // Detect unit system (cm vs inches)
  let unitSystem: 'cm' | 'in' | 'unknown' = 'unknown';
  const cmIndicators = text.match(/\b(\d{2,3})\s*cm\b/gi);
  const inIndicators = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:in|inch|")\b/gi);
  
  if (cmIndicators && cmIndicators.length > inIndicators?.length) {
    unitSystem = 'cm';
    console.log('📊 [PARSE TEXT] Detected unit system: CM');
  } else if (inIndicators && inIndicators.length > 0) {
    unitSystem = 'in';
    console.log('📊 [PARSE TEXT] Detected unit system: INCHES');
  } else {
    // Heuristic: if values are 60-120 range, likely cm; if 20-60, likely inches
    const allNumbers = text.match(/\b(\d{2,3})\b/g) || [];
    const avgValue = allNumbers.reduce((sum, n) => sum + parseInt(n), 0) / allNumbers.length;
    if (avgValue > 60) {
      unitSystem = 'cm';
      console.log('📊 [PARSE TEXT] Inferred unit system: CM (avg value:', avgValue, ')');
    } else {
      unitSystem = 'in';
      console.log('📊 [PARSE TEXT] Inferred unit system: INCHES (avg value:', avgValue, ')');
    }
  }
  
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
            let value = parseFloat(numbers[idx]);
            
            // Convert to inches if needed
            if (unitSystem === 'cm') {
              // Circumference measurements: chest, waist, hips (convert cm to inches)
              // Length measurements: length, sleeve, shoulder, inseam, rise (convert cm to inches)
              value = value / 2.54;
              console.log(`📊 [PARSE TEXT] Converted ${numbers[idx]}cm to ${value.toFixed(2)}in`);
            }
            
            // Try to find which measurement this belongs to
            if (headerMeasures.length > 0) {
              const measureIdx = Math.floor(idx / (numbers.length / headerMeasures.length));
              if (headerMeasures[measureIdx]) {
                let measure = headerMeasures[measureIdx].toLowerCase();
                if (measure === 'hip') measure = 'hips';
                if (measure === 'pit' || measure === 'pit-to-pit') measure = 'chest';
                if (measure.includes('length')) {
                  if (measure.includes('garment') || measure.includes('top')) measure = 'topLength';
                  else if (measure.includes('dress')) measure = 'dressLength';
                  else measure = 'length';
                }
                data[sizeKey][measure] = Math.round(value * 100) / 100; // Round to 2 decimals
                console.log(`📊 [PARSE TEXT] Mapped ${sizeKey}.${measure} = ${data[sizeKey][measure]}in`);
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
          if (measure.includes('length')) {
            if (measure.includes('garment') || measure.includes('top')) measure = 'topLength';
            else if (measure.includes('dress')) measure = 'dressLength';
            else measure = 'length';
          }
          
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
          
          let value = parseFloat(closestNumber);
          
          // Convert to inches if needed
          const isCm = line.toLowerCase().includes('cm') || unitSystem === 'cm';
          if (isCm) {
            value = value / 2.54;
            console.log(`📊 [PARSE TEXT] Converted ${closestNumber}cm to ${value.toFixed(2)}in`);
          }
          
          // Store as circumference for chest/waist/hips, length for others
          data[currentSize][measure] = Math.round(value * 100) / 100; // Round to 2 decimals
          console.log(`📊 [PARSE TEXT] Mapped ${currentSize}.${measure} = ${data[currentSize][measure]}in (from "${line}")`);
        } else if (numbers.length > 0 && measurements.length > 0) {
          // No measurement label, but we have numbers - try to infer from position
          // This is less reliable but better than nothing
          const numValues = numbers.map(n => {
            const val = parseFloat(n);
            const isCm = line.toLowerCase().includes('cm') || unitSystem === 'cm';
            return isCm ? val / 2.54 : val;
          });
          
          // Map to measurements in order (if we have same count)
          if (numValues.length === measurements.length) {
            measurements.forEach((measure, idx) => {
              data[currentSize][measure] = Math.round(numValues[idx] * 100) / 100;
              console.log(`📊 [PARSE TEXT] Inferred ${currentSize}.${measure} = ${data[currentSize][measure]}in`);
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

  // Calculate overall confidence
  // Base confidence on OCR confidence, but reduce if parsing found few sizes
  let parseConfidence = ocrConfidence;
  if (sizeChart.length === 0) {
    parseConfidence = 0;
  } else if (sizeChart.length < 2) {
    parseConfidence = ocrConfidence * 0.5; // Low confidence if only 1 size found
  } else if (sizeChart.length < 3) {
    parseConfidence = ocrConfidence * 0.7; // Medium confidence if 2 sizes
  }

  console.log('📊 [PARSE TEXT] Final parsed data:', {
    success: sizeChart.length > 0,
    sizeCount: sizeChart.length,
    sizes: sizeChart.map(s => s.size),
    confidence: parseConfidence,
  });

  return {
    success: sizeChart.length > 0,
    data: sizeChart.length > 0 ? sizeChart : null,
    confidence: parseConfidence,
    structure: {
      sizes: sizes.length > 0 ? sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      measurements: measurements.length > 0 ? measurements : ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
    },
  };
}

