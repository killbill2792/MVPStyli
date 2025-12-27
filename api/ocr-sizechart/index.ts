/**
 * OCR Size Chart Parser (Free, No Heavy Dependencies)
 * Uses OCR.space free API (no API key required for basic usage)
 * Falls back to manual input structure if OCR fails
 *
 * Goals:
 * - Parse many real-world size chart screenshots
 * - Output inches only (convert cm -> inches)
 * - Handle OCR fraction artifacts like "303/4" meaning 30 3/4
 * - Avoid numeric pollution being mistaken as "sizes"
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

    // Prepare image source
    let imageSource: string;

    if (imageBase64) {
      // Remove data URL prefix if present (for logging)
      imageSource = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      console.log('📊 [OCR] Using base64 image (length:', imageSource.length, ')');
    } else if (imageUrl) {
      imageSource = imageUrl;
      console.log('📊 [OCR] Using image URL:', imageUrl);
    } else {
      return res.status(400).json({ error: 'Missing image data' });
    }

    console.log('📊 [OCR] Using OCR.space free API...');

    let extractedText = '';
    let ocrConfidence = 0;

    try {
      let rawBase64: string | null = null;
      let dataUriForOCR: string | null = null;
      let needsConversion = false;

      if (imageBase64) {
        // Keep two versions:
        // 1) rawBase64 for sharp (no prefix)
        // 2) dataUriForOCR for OCR.space (requires data:<mime>;base64,<content>)
        if (imageBase64.includes(',')) {
          const [prefix, data] = imageBase64.split(',');
          rawBase64 = data;
          console.log('📊 [OCR] Data URL prefix:', prefix.substring(0, 60));
        } else {
          rawBase64 = imageBase64;
        }

        console.log('📊 [OCR] Raw base64 length:', rawBase64.length);

        try {
          const imageBuffer = Buffer.from(rawBase64, 'base64');
          const metadata = await sharp(imageBuffer).metadata();
          const format = String(metadata.format || '').toLowerCase();

          console.log('📊 [OCR] Sharp detected format:', format);
          console.log('📊 [OCR] Image dimensions:', metadata.width, 'x', metadata.height);

          // Convert unsupported to jpeg
          if (format === 'heic' || format === 'heif' || format === 'heif-sequence') {
            needsConversion = true;
          } else if (format && format !== 'jpeg' && format !== 'jpg' && format !== 'png') {
            needsConversion = true;
          }

          if (needsConversion) {
            console.log('📊 [OCR] Converting image to JPEG for OCR...');
            const jpegBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 90, mozjpeg: true })
              .toBuffer();
            rawBase64 = jpegBuffer.toString('base64');
            console.log('📊 [OCR] Conversion complete. New base64 length:', rawBase64.length);
          }

          // OCR.space accepts base64Image only in full data URI format
          dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
          console.log('📊 [OCR] Data URI for OCR.space prepared (length:', dataUriForOCR.length, ')');
        } catch (sharpError: any) {
          console.error('📊 [OCR] Sharp processing error:', sharpError.message);

          // Fallback: if already data URI, use it; otherwise assume jpeg
          if (imageBase64.startsWith('data:')) {
            dataUriForOCR = imageBase64;
          } else {
            dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
          }
        }
      }

      if (dataUriForOCR) {
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

        console.log('📊 [OCR] Sending to OCR.space...');
        console.log('📊 [OCR] Data URI prefix:', dataUriForOCR.substring(0, 30));
        console.log('📊 [OCR] Data URI length:', dataUriForOCR.length);

        // OCR.space expects form-urlencoded
        const formData = new URLSearchParams();
        formData.append('apikey', ocrApiKey);
        formData.append('base64Image', dataUriForOCR);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');

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

          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults[0].ParsedText || '';
            ocrConfidence = ocrData.ParsedResults[0].TextOverlay?.HasOverlay ? 80 : 60;
            console.log('📊 [OCR] Text extracted successfully, length:', extractedText.length);
            console.log('📊 [OCR] Extracted text preview:', extractedText.substring(0, 250));
          } else if (ocrData.ErrorMessage) {
            console.warn('📊 [OCR] OCR.space error:', ocrData.ErrorMessage);
          }
        } else {
          const errorText = await ocrResponse.text();
          console.warn('📊 [OCR] OCR.space API error:', ocrResponse.status, errorText);
        }
      } else if (imageUrl) {
        const ocrResponse = await fetch(
          `https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(imageUrl)}&language=eng`
        );

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
 * Robust size chart parser from OCR text.
 * Outputs inches only.
 *
 * Strategy:
 * 1) Table Mode:
 *    - Detect a header line containing 2+ sizes (e.g. XXS XS S M L)
 *    - Detect measurement labels (chest/waist/hip/etc + unit)
 *    - Collect values across columns and map by index to header sizes
 *
 * 2) Block Mode:
 *    - Detect single size lines (e.g. "XS")
 *    - Then parse labeled lines that follow within that size block
 *
 * 3) Safety / Sanity:
 *    - Fraction OCR fixes (303/4 -> 30.75)
 *    - Reject numeric “sizes” pollution
 *    - Sanity check inches; if value looks like cm, convert
 */
function parseSizeChartText(text: string, ocrConfidence: number) {
  const lines = normalizeOcrLines(text);

  type MeasurementKey =
    | 'chest'
    | 'waist'
    | 'hips'
    | 'inseam'
    | 'rise'
    | 'length'
    | 'sleeve'
    | 'shoulder'
    | 'thigh';

  type UnitKey = 'in' | 'cm' | 'unknown';

  type Entry = {
    unit: UnitKey;
    // store average for now (min/max kept internally)
    valueInches: number;
    rawMin?: number;
    rawMax?: number;
    rawUnit?: UnitKey;
  };

  const store: Record<string, Partial<Record<MeasurementKey, Entry>>> = {};

  const knownSizes = new Set<string>();
  const knownMeasurements = new Set<string>();

  // --- Pass 1: Table-mode parsing (most common for internet charts) ---
  // Keep a rolling "current header sizes" when we detect header rows.
  let currentHeaderSizes: string[] | null = null;

  // When we see a measurement label row, we try to extract N values where N = headerSizes length.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect a header row with 2+ sizes (alpha sizes, sometimes numeric)
    const header = detectSizeHeader(line);
    if (header && header.length >= 2) {
      currentHeaderSizes = header;
      currentHeaderSizes.forEach(s => knownSizes.add(s));
      continue;
    }

    if (!currentHeaderSizes || currentHeaderSizes.length < 2) continue;

    // Detect measurement label + unit (like "Chest inch", "Waist cm", "Hip (in)")
    const labelInfo = detectMeasurementLabel(line);
    if (!labelInfo) continue;

    const { measure, unit } = labelInfo;
    knownMeasurements.add(measure);

    // Extract values from the SAME line after removing label text
    let values = extractAllRangesFromLine(stripLabelFromLine(line));

    // If not enough values, pull from following lines until we have enough
    let lookahead = i + 1;
    while (values.length < currentHeaderSizes.length && lookahead < lines.length) {
      const next = lines[lookahead];

      // Stop if we hit another label or header
      if (detectSizeHeader(next)?.length) break;
      if (detectMeasurementLabel(next)) break;

      // ignore "US", "EU", etc and plain sizing rows
      if (isSizeSystemRow(next)) {
        lookahead++;
        continue;
      }

      const more = extractAllRangesFromLine(next);
      if (more.length) values = values.concat(more);

      lookahead++;
      // If the next lines were part of this row, advance i so we don't reprocess them
      if (more.length) i = lookahead - 1;
      if (values.length >= currentHeaderSizes.length) break;
    }

    // If we still didn't get enough values, skip this row (OCR likely incomplete)
    if (values.length < Math.min(2, currentHeaderSizes.length)) continue;

    // Map first N values to header sizes by index
    const N = Math.min(values.length, currentHeaderSizes.length);

    for (let idx = 0; idx < N; idx++) {
      const size = currentHeaderSizes[idx];
      const range = values[idx];

      writeMeasurement(store, size, measure, unit, range.min, range.max);
    }
  }

  // --- Pass 2: Block-mode parsing (for charts that list each size separately) ---
  let currentSize: string | null = null;
  let currentLabel: { measure: MeasurementKey; unit: UnitKey } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect a single size token on its own line
    const singleSize = detectSingleSizeLine(line);
    if (singleSize) {
      currentSize = singleSize;
      knownSizes.add(currentSize);
      currentLabel = null;
      ensureSize(store, currentSize);
      continue;
    }

    if (!currentSize) continue;

    // Label line
    const labelInfo = detectMeasurementLabel(line);
    if (labelInfo) {
      currentLabel = labelInfo;
      knownMeasurements.add(currentLabel.measure);
      continue;
    }

    // Ignore size-system rows like "US", "EU", "4-6"
    if (isSizeSystemRow(line)) continue;

    // Value line (range or number)
    if (currentLabel) {
      const ranges = extractAllRangesFromLine(line);
      if (ranges.length >= 1) {
        // Use first range; some blocks only have one value per line
        const r = ranges[0];
        writeMeasurement(store, currentSize, currentLabel.measure, currentLabel.unit, r.min, r.max);
      }
    }
  }

  // --- Finalize output: inches only, prefer inch unit if both exist ---
  const dataOut: Array<{ size: string; measurements: Record<string, number> }> = [];

  const sizeList = Array.from(knownSizes);
  // keep common ordering if present
  const order = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  sizeList.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    // numeric sizes sort
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (isFinite(na) && isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });

  for (const size of sizeList) {
    const row = store[size];
    if (!row) continue;

    const out: Record<string, number> = {};

    for (const key of Object.keys(row) as MeasurementKey[]) {
      const entry = row[key];
      if (!entry) continue;

      // already inches
      const v = round2(entry.valueInches);
      if (!isFinite(v) || v <= 0) continue;

      out[key] = v;
    }

    if (Object.keys(out).length > 0) {
      dataOut.push({ size, measurements: out });
    }
  }

  // confidence heuristic: OCR confidence weighted by how much data we parsed
  const measurementCount = dataOut.reduce((sum, r) => sum + Object.keys(r.measurements).length, 0);
  let confidence = ocrConfidence;
  if (dataOut.length === 0) confidence = 0;
  else if (measurementCount < 3) confidence = Math.min(confidence, 40);

  return {
    success: dataOut.length > 0,
    data: dataOut.length > 0 ? dataOut : null,
    confidence,
    structure: {
      sizes: dataOut.map(d => d.size),
      measurements: Array.from(knownMeasurements),
    },
  };
}

/* --------------------------- Helpers --------------------------- */

function normalizeOcrLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, ' '));
}

function ensureSize(store: Record<string, any>, size: string) {
  if (!store[size]) store[size] = {};
}

/**
 * Decide if a line is a "size-system row" (US/EU/UK) or numeric garment sizing row.
 * We should ignore these as measurements.
 */
function isSizeSystemRow(line: string): boolean {
  const u = line.trim().toUpperCase();
  if (u === 'US' || u === 'EU' || u === 'UK' || u === 'INT' || u === 'SIZE') return true;
  // Rows like "4-6" or "0" or "2" etc are often US sizing values — not measurements
  if (/^\d{1,3}(\s*-\s*\d{1,3})?$/.test(line.trim())) return true;
  return false;
}

/**
 * Detect common size tokens in a header line. We require 2+ sizes and NO measurement label.
 * Examples:
 *  - "XXS XS S M L"
 *  - "2XS XS S M L XL"
 *  - "24 26 28 30 32"
 */
function detectSizeHeader(line: string): string[] | null {
  // if line contains measurement words, it's not a header
  if (detectMeasurementLabel(line)) return null;

  const sizes = extractSizeTokensFromLine(line);

  // Header must have at least 2 sizes and should not be just a system label row
  if (sizes.length >= 2) return sizes;
  return null;
}

/**
 * Detect a single size line (block mode), like "XS" or "M" or "24".
 * We intentionally avoid treating random numbers as sizes unless they look like a size token.
 */
function detectSingleSizeLine(line: string): string | null {
  if (detectMeasurementLabel(line)) return null;
  if (isSizeSystemRow(line)) return null;

  const tokens = extractSizeTokensFromLine(line);
  if (tokens.length === 1 && tokens[0].toUpperCase() === line.trim().toUpperCase()) {
    return tokens[0];
  }
  return null;
}

function extractSizeTokensFromLine(line: string): string[] {
  const raw = line.trim();

  // Common alpha sizes + variants
  // NOTE: Do NOT include generic 2-3 digit numbers broadly. Only allow numeric sizes when they look like apparel sizes:
  // - 2 digits (24, 26, 28, 30, 32, 34...)
  // - or 1-2 digits with optional range like "4-6" (but those are usually US system; we ignore them elsewhere)
  const sizePatterns = [
    /\b(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)\b/gi,
    /\b(2XS|3XS|4XS|5XS|2XL|3XL|4XL|5XL)\b/gi,
    // Numeric sizes: 2 digits most common (jeans waist, etc.)
    /\b(\d{2})\b/g,
  ];

  const found: string[] = [];
  for (const re of sizePatterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(raw)) !== null) {
      const token = String(m[1] ?? m[0]).toUpperCase();
      // filter out obvious non-size numbers like 64, 82, 90 if line is clearly measurement-ish.
      // We keep numeric sizes only if line looks like a header (multiple numeric tokens).
      found.push(token);
    }
  }

  // Deduplicate while preserving order
  const dedup: string[] = [];
  for (const s of found) {
    if (!dedup.includes(s)) dedup.push(s);
  }

  // If it's numeric-only header, keep it only if there are 3+ numeric tokens (typical waist-size headers)
  const numericOnly = dedup.length > 0 && dedup.every(s => /^\d{2}$/.test(s));
  if (numericOnly) {
    if (dedup.length >= 3) return dedup;
    return [];
  }

  // Mixed alpha sizes are ok even if small count
  return dedup;
}

/**
 * Measurement label detection.
 * Supports many common market labels.
 */
function detectMeasurementLabel(line: string):
  | { measure: any; unit: 'in' | 'cm' | 'unknown' }
  | null {
  const lower = line.toLowerCase();

  // Must contain a measurement keyword
  const measure = normalizeMeasurement(lower);
  if (!measure) return null;

  // Unit detection
  // - "in", "inch", '"'
  // - "cm", "centimeter"
  // Some charts omit unit; we mark unknown.
  let unit: 'in' | 'cm' | 'unknown' = 'unknown';
  if (/\b(cm|centimeter|centimetre)\b/.test(lower)) unit = 'cm';
  else if (/\b(in|inch|inches)\b/.test(lower) || /["”]/.test(line)) unit = 'in';

  return { measure, unit };
}

function normalizeMeasurement(lowerLine: string):
  | 'chest'
  | 'waist'
  | 'hips'
  | 'inseam'
  | 'rise'
  | 'length'
  | 'sleeve'
  | 'shoulder'
  | 'thigh'
  | null {
  // common terms and synonyms
  if (/\b(chest|bust|pit to pit|pit-to-pit)\b/.test(lowerLine)) return 'chest';
  if (/\bwaist\b/.test(lowerLine)) return 'waist';
  if (/\b(low hip|hip|hips|seat)\b/.test(lowerLine)) return 'hips';
  if (/\binseam\b/.test(lowerLine)) return 'inseam';
  if (/\brise\b/.test(lowerLine)) return 'rise';
  if (/\b(sleeve)\b/.test(lowerLine)) return 'sleeve';
  if (/\bshoulder\b/.test(lowerLine)) return 'shoulder';
  if (/\bthigh\b/.test(lowerLine)) return 'thigh';
  if (/\b(length|garment length|dress length|top length)\b/.test(lowerLine)) return 'length';
  return null;
}

/**
 * Remove label words from a line so "Chest inch 30-32 32-34" becomes "30-32 32-34"
 */
function stripLabelFromLine(line: string): string {
  return line
    .replace(/chest|bust|waist|hip|hips|low hip|inseam|rise|length|sleeve|shoulder|thigh/gi, ' ')
    .replace(/cm|centimeter|centimetre|inch|inches|\bin\b/gi, ' ')
    .replace(/["”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Range = { min: number; max: number };

/**
 * Extract ALL numeric ranges from a line.
 * Supports:
 *  - "303/4-321/4"
 *  - "25-26"
 *  - "90-97.5"
 *  - single values "64"
 */
function extractAllRangesFromLine(line: string): Range[] {
  const cleaned = line
    .toLowerCase()
    .replace(/–/g, '-') // normalize en-dash
    .replace(/[^\d./\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by spaces but keep tokens that look numeric-ish
  const tokens = cleaned.split(' ').filter(Boolean);

  const ranges: Range[] = [];

  for (const t of tokens) {
    // token could be "303/4-321/4" or "25-26" or "64"
    if (t.includes('-')) {
      const parts = t.split('-').map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const a = parseWeirdOcrNumber(parts[0]);
        const b = parseWeirdOcrNumber(parts[1]);
        if (a != null && b != null) {
          ranges.push({ min: Math.min(a, b), max: Math.max(a, b) });
          continue;
        }
      }
    }

    const single = parseWeirdOcrNumber(t);
    if (single != null) {
      ranges.push({ min: single, max: single });
    }
  }

  return ranges;
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

  // Sometimes OCR outputs mixed number with space: "30 3/4"
  const spaced = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (spaced) {
    const whole = parseInt(spaced[1], 10);
    const num = parseInt(spaced[2], 10);
    const den = parseInt(spaced[3], 10);
    if (!isFinite(whole) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return whole + num / den;
  }

  // OCR artifact: "303/4" means 30 + 3/4 (last digit before slash is numerator)
  const m = t.match(/^(\d+)(\d)\/(\d+)$/);
  if (m) {
    const wholePart = parseInt(m[1], 10);
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (!isFinite(wholePart) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return wholePart + num / den;
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Write measurement for a size.
 * - converts to inches (always)
 * - prefers inches over cm if both exist
 * - sanity-checks values to avoid cm accidentally stored as inches
 */
function writeMeasurement(
  store: Record<string, any>,
  size: string,
  measure: any,
  unit: 'in' | 'cm' | 'unknown',
  rawMin: number,
  rawMax: number
) {
  ensureSize(store, size);

  const avgRaw = (rawMin + rawMax) / 2;

  // Convert to inches if needed
  let inches = avgRaw;
  let effectiveUnit: 'in' | 'cm' | 'unknown' = unit;

  // If unit unknown, we infer by magnitude heuristics
  if (unit === 'unknown') {
    // Values like 70-120 are very often cm for body measurements
    if (avgRaw > 65) {
      effectiveUnit = 'cm';
    } else {
      effectiveUnit = 'in';
    }
  }

  if (effectiveUnit === 'cm') inches = avgRaw / 2.54;

  // Sanity checks: if "inches" is still absurd, it probably came from cm mis-detected
  // These are conservative to avoid throwing away real values (e.g., coat length can be large)
  const sanity = sanityRangeInches(measure);
  if (sanity) {
    const { minOk, maxOk } = sanity;

    if (inches > maxOk && avgRaw > 60) {
      // likely cm mistakenly treated as inches, convert
      const converted = avgRaw / 2.54;
      if (converted >= minOk && converted <= maxOk) inches = converted;
    }
  }

  inches = round2(inches);

  if (!isFinite(inches) || inches <= 0) return;

  // Prefer inches unit if already present
  const existing = store[size][measure] as { rawUnit?: string; valueInches?: number } | undefined;

  // If existing was from inches and new one came from cm, keep existing
  if (existing && existing.rawUnit === 'in' && effectiveUnit === 'cm') return;

  store[size][measure] = {
    rawUnit: effectiveUnit,
    rawMin,
    rawMax,
    valueInches: inches,
  };
}

function sanityRangeInches(measure: string): { minOk: number; maxOk: number } | null {
  // Very conservative bounds for adult apparel/body charts
  switch (measure) {
    case 'chest':
      return { minOk: 20, maxOk: 70 };
    case 'waist':
      return { minOk: 18, maxOk: 70 };
    case 'hips':
      return { minOk: 20, maxOk: 80 };
    case 'inseam':
      return { minOk: 15, maxOk: 40 };
    case 'rise':
      return { minOk: 5, maxOk: 25 };
    case 'sleeve':
      return { minOk: 10, maxOk: 40 };
    case 'shoulder':
      return { minOk: 8, maxOk: 30 };
    case 'length':
      return { minOk: 10, maxOk: 80 };
    case 'thigh':
      return { minOk: 10, maxOk: 40 };
    default:
      return null;
  }
}
