/**
 * OCR Size Chart Parser (Free, No Heavy Dependencies)
 * Uses OCR.space free API (no API key required for basic usage)
 * Falls back to manual input structure if OCR fails
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
      let rawBase64: string | null = null;
      let dataUriForOCR: string | null = null;
      let needsConversion = false;
      
      if (imageBase64) {
        // Keep two versions:
        // 1. rawBase64 - for sharp processing (no prefix)
        // 2. dataUriForOCR - for OCR.space (with data:image/jpeg;base64, prefix)
        
        // Extract raw base64 (remove data URL prefix if present for sharp)
        if (imageBase64.includes(',')) {
          const [prefix, data] = imageBase64.split(',');
          rawBase64 = data;
          console.log('📊 [OCR] Data URL prefix:', prefix.substring(0, 50));
        } else {
          rawBase64 = imageBase64;
        }
        
        console.log('📊 [OCR] Raw base64 length:', rawBase64.length);
        
        // Use sharp to detect actual image format and convert if needed
        try {
          const imageBuffer = Buffer.from(rawBase64, 'base64');
          const metadata = await sharp(imageBuffer).metadata();
          const actualFormat = metadata.format;
          
          console.log('📊 [OCR] Sharp detected format:', actualFormat);
          console.log('📊 [OCR] Image dimensions:', metadata.width, 'x', metadata.height);
          
          // Convert HEIC/HEIF to JPEG (OCR.space doesn't support HEIC)
          const formatStr = String(actualFormat || '').toLowerCase();
          if (formatStr === 'heic' || formatStr === 'heif' || formatStr === 'heif-sequence') {
            console.log('📊 [OCR] HEIC/HEIF detected by sharp, converting to JPEG...');
            needsConversion = true;
          } else if (actualFormat && actualFormat !== 'jpeg' && actualFormat !== 'jpg' && actualFormat !== 'png') {
            // Convert any unsupported format to JPEG
            console.log(`📊 [OCR] Format ${actualFormat} may not be supported, converting to JPEG...`);
            needsConversion = true;
          }
          
          if (needsConversion) {
            const jpegBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 90, mozjpeg: true })
              .toBuffer();
            rawBase64 = jpegBuffer.toString('base64');
            console.log('📊 [OCR] Image converted to JPEG successfully (new length:', rawBase64.length, ')');
          }
          
          // Build data URI for OCR.space (always use image/jpeg after conversion or if already JPEG)
          dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
          console.log('📊 [OCR] Data URI for OCR.space prepared (length:', dataUriForOCR.length, ')');
        } catch (sharpError: any) {
          console.error('📊 [OCR] Sharp processing error:', sharpError.message);
          // If sharp fails, try to detect from magic bytes as fallback
          console.log('📊 [OCR] Falling back to magic bytes detection...');
          try {
            const sampleBase64 = rawBase64.substring(0, 32);
            const bytes = Buffer.from(sampleBase64, 'base64');
            
            // Check for HEIC/HEIF magic bytes
            if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
              if ((bytes[8] === 0x68 && bytes[9] === 0x65 && bytes[10] === 0x69 && bytes[11] === 0x63) ||
                  (bytes[8] === 0x6D && bytes[9] === 0x69 && bytes[10] === 0x66 && bytes[11] === 0x31)) {
                console.log('📊 [OCR] HEIC detected from magic bytes, attempting conversion...');
                const imageBuffer = Buffer.from(rawBase64, 'base64');
                try {
                  const jpegBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: 90, mozjpeg: true })
                    .toBuffer();
                  rawBase64 = jpegBuffer.toString('base64');
                  console.log('📊 [OCR] HEIC converted to JPEG via fallback method');
                } catch (convError: any) {
                  console.error('📊 [OCR] Fallback conversion failed:', convError.message);
                }
              }
            }
            
            // Build data URI for OCR.space (use image/jpeg as default)
            dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
          } catch (magicError: any) {
            console.warn('📊 [OCR] Magic bytes detection failed:', magicError.message);
            // Fallback: use original input if it was already a data URI, otherwise create one
            if (imageBase64.startsWith('data:')) {
              dataUriForOCR = imageBase64;
            } else {
              dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
            }
          }
        }
      }
      
      if (dataUriForOCR) {
        // OCR.space requires API key - use free demo key (limited requests)
        // For production, get free API key from https://ocr.space/ocrapi/freekey
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
        
        // After conversion, always use JPG for OCR.space
        const filetypeForOCR = 'JPG'; // Always JPG after any conversion
        
        console.log('📊 [OCR] Sending to OCR.space with filetype:', filetypeForOCR);
        console.log('📊 [OCR] Data URI length:', dataUriForOCR.length);
        console.log('📊 [OCR] Data URI prefix:', dataUriForOCR.substring(0, 30));
        
        // OCR.space expects form data, not JSON!
        // OCR.space wants base64Image as full data URI: data:image/jpeg;base64,...
        const formData = new URLSearchParams();
        formData.append('apikey', ocrApiKey);
        formData.append('base64Image', dataUriForOCR); // Full data URI with prefix!
        formData.append('filetype', filetypeForOCR);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('iscreatesearchablepdf', 'false');
        formData.append('issearchablepdfhidetextlayer', 'false');
        
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });
        
        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json();
          console.log('📊 [OCR] OCR.space response:', JSON.stringify(ocrData, null, 2));
          console.log('📊 [OCR] OCRExitCode:', ocrData.OCRExitCode);
          console.log('📊 [OCR] IsErroredOnProcessing:', ocrData.IsErroredOnProcessing);
          
          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults[0].ParsedText || '';
            ocrConfidence = ocrData.ParsedResults[0].TextOverlay?.HasOverlay ? 80 : 60;
            console.log('📊 [OCR] Text extracted successfully, length:', extractedText.length);
            console.log('📊 [OCR] Extracted text preview:', extractedText.substring(0, 200));
          } else if (ocrData.ErrorMessage) {
            console.warn('📊 [OCR] OCR.space error:', ocrData.ErrorMessage);
            console.warn('📊 [OCR] This might mean the image has no text, or OCR failed to process it');
            
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

    if (!extractedText || extractedText.trim().length === 0) {
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
      rawText: extractedText,
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
 * Improved parser that handles fractions, avoids numeric size pollution, and properly converts to inches
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

  // Normalize lines
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // IMPORTANT: do NOT treat plain numbers as sizes
  // Only allow real size tokens here.
  const SIZE_TOKENS = ['XXXS','XXS','XS','S','M','L','XL','XXL','XXXL'];
  const sizeRegex = new RegExp(`^(${SIZE_TOKENS.join('|')})$`, 'i');

  // measurement label detection
  const labelRegex = /\b(chest|bust|waist|hip|hips|low hip|inseam|rise|length|sleeve|shoulder)\b/i;
  const unitRegex = /\b(inch|in|cm)\b/i;

  type MeasurementKey = 'chest' | 'waist' | 'hips' | 'inseam' | 'rise' | 'length' | 'sleeve' | 'shoulder';
  type UnitKey = 'in' | 'cm';

  // We'll store per size, per measurement:
  // - prefer inches
  // - if only cm exists, convert later
  const store: Record<string, Partial<Record<MeasurementKey, { unit: UnitKey; min?: number; max?: number; value?: number }>>> = {};

  // Helper: normalize label -> measurement key
  function normalizeMeasurement(label: string): MeasurementKey | null {
    const s = label.toLowerCase();
    if (s.includes('chest') || s.includes('bust')) return 'chest';
    if (s.includes('waist')) return 'waist';
    if (s.includes('low hip') || s.includes('hip') || s.includes('hips')) return 'hips';
    if (s.includes('inseam')) return 'inseam';
    if (s.includes('rise')) return 'rise';
    if (s.includes('length')) return 'length';
    if (s.includes('sleeve')) return 'sleeve';
    if (s.includes('shoulder')) return 'shoulder';
    return null;
  }

  // Sequence fallback for when OCR drops labels inside a size block (common)
  // Order matches the chart pattern you showed.
  const fallbackSequence: Array<{ measure: MeasurementKey; unit: UnitKey }> = [
    { measure: 'chest', unit: 'in' },
    { measure: 'chest', unit: 'cm' },
    { measure: 'waist', unit: 'in' },
    { measure: 'waist', unit: 'cm' },
    { measure: 'hips', unit: 'in' },
    { measure: 'hips', unit: 'cm' },
  ];

  let currentSize: string | null = null;

  // When we're inside a size block:
  // - if we see explicit "Chest inch" etc, use that
  // - if we just see numbers, consume them in fallbackSequence order
  let currentLabelMeasure: MeasurementKey | null = null;
  let currentLabelUnit: UnitKey | null = null;
  let fallbackIndex = 0;

  function ensureSize(size: string) {
    if (!store[size]) store[size] = {};
  }

  function writeValue(size: string, measure: MeasurementKey, unit: UnitKey, min: number, max: number) {
    ensureSize(size);
    // Prefer inches if both exist: if we already have inches, don't overwrite with cm
    const existing = store[size][measure];
    if (existing && existing.unit === 'in' && unit === 'cm') return;
    store[size][measure] = { unit, min, max, value: (min + max) / 2 };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Detect size block header (xxs, xs, s...)
    if (sizeRegex.test(upper)) {
      currentSize = upper;
      ensureSize(currentSize);
      console.log('📊 [PARSE TEXT] Enter size block:', currentSize);
      // reset context for this size block
      currentLabelMeasure = null;
      currentLabelUnit = null;
      fallbackIndex = 0;
      continue;
    }

    // If we are not in a size block, skip (we only parse within sizes)
    if (!currentSize) continue;

    // Ignore US size row etc
    if (upper === 'US') continue;
    if (/^\d+(-\d+)?$/.test(line)) {
      // Lines like "2" or "4-6" are US sizes in your chart – ignore
      continue;
    }

    // If line contains a label like "Chest inch" / "Waist cm"
    const labelMatch = line.match(labelRegex);
    const unitMatch = line.match(unitRegex);
    if (labelMatch && unitMatch) {
      const measure = normalizeMeasurement(labelMatch[0]);
      const unitRaw = unitMatch[0].toLowerCase();
      const unit: UnitKey = unitRaw.startsWith('cm') ? 'cm' : 'in';
      if (measure) {
        currentLabelMeasure = measure;
        currentLabelUnit = unit;
        console.log(`📊 [PARSE TEXT] Label set for ${currentSize}: ${measure} (${unit})`);
      } else {
        currentLabelMeasure = null;
        currentLabelUnit = null;
      }
      continue;
    }

    // Otherwise, check if this line looks like a range/value (including OCR fractions like 303/4)
    const parsed = parseRangeLineToNumbers(line);
    if (!parsed) continue;
    const { min, max } = parsed;

    // Case A: we have explicit label context (best)
    if (currentLabelMeasure && currentLabelUnit) {
      writeValue(currentSize, currentLabelMeasure, currentLabelUnit, min, max);
      continue;
    }

    // Case B: fallback sequence (labels missing)
    if (fallbackIndex < fallbackSequence.length) {
      const { measure, unit } = fallbackSequence[fallbackIndex];
      writeValue(currentSize, measure, unit, min, max);
      fallbackIndex += 1;
      continue;
    }
  }

  // Convert everything to inches and simplify into output shape
  const sizesOut: string[] = [];
  const measurementsOut = new Set<string>();
  const dataOut: Array<{ size: string; measurements: Record<string, number> }> = [];

  for (const size of Object.keys(store)) {
    const m = store[size];
    const out: Record<string, number> = {};
    for (const key of Object.keys(m) as MeasurementKey[]) {
      const entry = m[key];
      if (!entry || entry.value == null) continue;
      let inchesVal = entry.value;
      if (entry.unit === 'cm') inchesVal = inchesVal / 2.54;
      // round to 2 decimals
      const rounded = Math.round(inchesVal * 100) / 100;
      out[key] = rounded;
      measurementsOut.add(key);
    }
    if (Object.keys(out).length > 0) {
      sizesOut.push(size);
      dataOut.push({ size, measurements: out });
    }
  }

  // Confidence: parsing confidence should not be "30" just because OCRConfidence is low.
  // Use OCRConfidence as base but penalize if we found too little.
  let parseConfidence = ocrConfidence;
  if (dataOut.length === 0) parseConfidence = 0;
  else if (dataOut.length === 1) parseConfidence = Math.min(parseConfidence, 40);

  console.log('📊 [PARSE TEXT] Parsed sizes:', sizesOut);
  console.log('📊 [PARSE TEXT] Parsed measurements:', Array.from(measurementsOut));
  console.log('📊 [PARSE TEXT] Final parsed data count:', dataOut.length);

  return {
    success: dataOut.length > 0,
    data: dataOut.length > 0 ? dataOut : null,
    confidence: parseConfidence,
    structure: {
      sizes: sizesOut.length ? sizesOut : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
      measurements: Array.from(measurementsOut).length
        ? Array.from(measurementsOut)
        : ['chest', 'waist', 'hips', 'inseam', 'rise', 'length', 'sleeve', 'shoulder'],
    },
  };
}

/**
 * Parse a line that might contain:
 * - "303/4-321/4" (means 30.75 - 32.25)
 * - "26-29"
 * - "90-97.5"
 * Returns min/max as floats (still in whatever unit the label implies).
 */
function parseRangeLineToNumbers(line: string): { min: number; max: number } | null {
  const cleaned = line
    .toLowerCase()
    .replace(/–/g, '-') // normalize en-dash
    .replace(/[^\d./\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  // Try range first: something-something
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const a = parseWeirdOcrNumber(parts[0]);
      const b = parseWeirdOcrNumber(parts[1]);
      if (a != null && b != null) {
        return { min: Math.min(a, b), max: Math.max(a, b) };
      }
    }
  }

  // Single value
  const single = parseWeirdOcrNumber(cleaned);
  if (single != null) return { min: single, max: single };

  return null;
}

/**
 * OCR turns:
 * - 30¾ into "303/4"
 * - 24½ into "241/2"
 * - 35½ into "351/2"
 * We detect patterns like:
 * - "303/4" -> 30 + 3/4
 * - "241/2" -> 24 + 1/2
 * Also handles normal decimals like "97.5"
 */
function parseWeirdOcrNumber(s: string): number | null {
  const t = s.trim();
  // plain decimal/int
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);

  // Pattern: "303/4" (two+ digits then a/b) => treat as mixed number
  // last 1-2 digits before slash are the numerator; digits before that are the whole part
  const m = t.match(/^(\d+)(\d)\/(\d+)$/);
  if (m) {
    const wholeAndNum = m[1]; // e.g. "30" from "303/4"? actually m[1] captures all digits before last digit used as numerator
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    // whole part is all digits except the last numerator digit
    const whole = parseInt(wholeAndNum, 10);
    if (!isFinite(whole) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return whole + num / den;
  }

  // Sometimes OCR might include spaces: "30 3/4"
  const m2 = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m2) {
    const whole = parseInt(m2[1], 10);
    const num = parseInt(m2[2], 10);
    const den = parseInt(m2[3], 10);
    if (!isFinite(whole) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return whole + num / den;
  }

  return null;
}

