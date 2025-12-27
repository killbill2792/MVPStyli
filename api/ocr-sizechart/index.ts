/**
 * OCR Size Chart Parser (Overlay/Coordinates Based)
 * Uses OCR.space TextOverlay to reconstruct rows/columns from screenshots.
 *
 * Goals:
 * - Work across many real-world size chart screenshots (tables, mixed units, messy OCR order)
 * - Output inches only (convert cm -> inches)
 * - Handle OCR fraction artifacts like "303/4" meaning 30 3/4
 * - Avoid numeric pollution being mistaken as sizes
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

type OcrSpaceWord = {
  WordText: string;
  Left: number;
  Top: number;
  Height: number;
  Width: number;
};

type OcrSpaceLine = {
  LineText: string;
  MinTop: number;
  MaxTop: number;
  Words: OcrSpaceWord[];
};

type OcrSpaceTextOverlay = {
  Lines: OcrSpaceLine[];
  HasOverlay: boolean;
};

type OcrSpaceParsedResult = {
  ParsedText?: string;
  TextOverlay?: OcrSpaceTextOverlay;
};

type OcrSpaceResponse = {
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string[] | string;
  ParsedResults?: OcrSpaceParsedResult[];
};

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

type Range = { min: number; max: number };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, imageUrl } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Missing imageBase64 or imageUrl' });
    }

    console.log('📊 [OCR] Starting size chart parsing');
    console.log('📊 [OCR] Has imageBase64:', !!imageBase64);
    console.log('📊 [OCR] Has imageUrl:', !!imageUrl);

    console.log('📊 [OCR] Using OCR.space API (overlay enabled)...');

    let extractedText = '';
    let overlay: OcrSpaceTextOverlay | null = null;
    let ocrConfidence = 0;

    try {
      let rawBase64: string | null = null;
      let dataUriForOCR: string | null = null;

      if (imageBase64) {
        if (imageBase64.includes(',')) {
          const [prefix, data] = imageBase64.split(',');
          rawBase64 = data;
          console.log('📊 [OCR] Data URL prefix:', prefix.substring(0, 60));
        } else {
          rawBase64 = imageBase64;
        }

        console.log('📊 [OCR] Raw base64 length:', rawBase64.length);

        // Detect/convert with sharp (keep it robust for HEIC etc.)
        try {
          const imageBuffer = Buffer.from(rawBase64, 'base64');
          const metadata = await sharp(imageBuffer).metadata();
          const format = String(metadata.format || '').toLowerCase();

          console.log('📊 [OCR] Sharp detected format:', format);
          console.log('📊 [OCR] Image dimensions:', metadata.width, 'x', metadata.height);

          const needsConversion =
            format === 'heic' ||
            format === 'heif' ||
            format === 'heif-sequence' ||
            (format && format !== 'jpeg' && format !== 'jpg' && format !== 'png');

          if (needsConversion) {
            console.log('📊 [OCR] Converting image to JPEG for OCR...');
            const jpegBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 90, mozjpeg: true })
              .toBuffer();
            rawBase64 = jpegBuffer.toString('base64');
            console.log('📊 [OCR] Conversion complete. New base64 length:', rawBase64.length);
          }

          dataUriForOCR = `data:image/jpeg;base64,${rawBase64}`;
        } catch (sharpError: any) {
          console.error('📊 [OCR] Sharp processing error:', sharpError.message);
          // Fallback
          dataUriForOCR = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${rawBase64}`;
        }
      }

      if (dataUriForOCR) {
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

        // OCR.space expects form-urlencoded.
        // IMPORTANT: isOverlayRequired=true to get coordinates.
        const formData = new URLSearchParams();
        formData.append('apikey', ocrApiKey);
        formData.append('base64Image', dataUriForOCR);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'true');

        console.log('📊 [OCR] Sending to OCR.space (overlay=true)...');
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        if (!ocrResponse.ok) {
          const errorText = await ocrResponse.text();
          console.warn('📊 [OCR] OCR.space API error:', ocrResponse.status, errorText);
        } else {
          const ocrData = (await ocrResponse.json()) as OcrSpaceResponse;
          console.log('📊 [OCR] OCRExitCode:', ocrData.OCRExitCode);
          console.log('📊 [OCR] IsErroredOnProcessing:', ocrData.IsErroredOnProcessing);

          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            const pr = ocrData.ParsedResults[0];
            extractedText = pr.ParsedText || '';
            overlay = pr.TextOverlay || null;
            ocrConfidence = overlay?.HasOverlay ? 80 : 60;

            console.log('📊 [OCR] Extracted text length:', extractedText.length);
            console.log('📊 [OCR] Has overlay:', !!overlay?.HasOverlay);
          } else if (ocrData.ErrorMessage) {
            console.warn('📊 [OCR] OCR.space error:', ocrData.ErrorMessage);
          }
        }
      } else if (imageUrl) {
        // URL mode (overlay support is weaker here; still attempt)
        const ocrResponse = await fetch(
          `https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(
            imageUrl
          )}&language=eng&isOverlayRequired=true`
        );

        if (ocrResponse.ok) {
          const ocrData = (await ocrResponse.json()) as OcrSpaceResponse;
          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            const pr = ocrData.ParsedResults[0];
            extractedText = pr.ParsedText || '';
            overlay = pr.TextOverlay || null;
            ocrConfidence = overlay?.HasOverlay ? 80 : 60;
          }
        }
      }
    } catch (ocrError: any) {
      console.error('📊 [OCR] OCR.space failed:', ocrError.message);
    }

    console.log('📊 [OCR] Text extraction complete');
    console.log('📊 [OCR] Confidence:', ocrConfidence);
    console.log('📊 [OCR] Extracted text preview:', extractedText.substring(0, 300));

    if (!overlay?.HasOverlay || !overlay?.Lines?.length) {
      console.warn('📊 [OCR] Missing overlay data (required for Option A). Falling back to text-only parser.');
      // If overlay isn't available, keep your fallback UX.
      return res.status(200).json({
        success: false,
        parsed: false,
        confidence: 0,
        message:
          'Could not extract layout/coordinates from image. Please retry with a clearer screenshot or enter measurements manually.',
        rawText: extractedText || '',
        data: null,
        structure: {
          sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
        },
      });
    }

    console.log('📊 [OCR] Parsing size chart from overlay coordinates...');
    const parsedData = parseSizeChartFromOverlay(overlay, ocrConfidence);

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
 * Option A: Parse from OCR overlay coordinates.
 * Reconstructs rows/columns, detects size header, then maps measurement rows to size columns.
 */
function parseSizeChartFromOverlay(overlay: OcrSpaceTextOverlay, ocrConfidence: number) {
  // Flatten words
  const allWords: OcrSpaceWord[] = [];
  for (const line of overlay.Lines || []) {
    for (const w of line.Words || []) {
      const txt = (w.WordText || '').trim();
      if (!txt) continue;
      allWords.push({
        WordText: txt,
        Left: w.Left,
        Top: w.Top,
        Width: w.Width,
        Height: w.Height,
      });
    }
  }

  if (allWords.length === 0) {
    return { success: false, data: null, confidence: 0, structure: null };
  }

  // Cluster into rows by Y
  const rows = clusterWordsIntoRows(allWords);

  // Find header row: row that contains 2+ size tokens
  let headerRowIndex = -1;
  let headerSizes: string[] = [];
  let headerX: number[] = []; // x-centers for each size column

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.map(w => w.WordText).join(' ');
    const sizes = extractSizeTokensFromRow(rowText);

    if (sizes.length >= 2) {
      // Build x positions for each size token found in the row, in left-to-right order
      const sizeTokens = findSizeWordsInRow(row);
      if (sizeTokens.length >= 2) {
        headerRowIndex = i;
        headerSizes = sizeTokens.map(s => s.size);
        headerX = sizeTokens.map(s => s.cx);
        break;
      }
    }
  }

  if (headerRowIndex === -1 || headerSizes.length < 2) {
    // If we can't find a header, we can't reliably do table mapping.
    return { success: false, data: null, confidence: Math.min(ocrConfidence, 40), structure: null };
  }

  // Estimate column boundaries from headerX
  const colWindows = buildColumnWindows(headerX);

  const store: Record<string, Partial<Record<MeasurementKey, { valueInches: number }>>> = {};
  const knownMeasurements = new Set<string>();

  // Parse rows beneath header
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip if row looks like another header
    const rowText = row.map(w => w.WordText).join(' ');
    if (extractSizeTokensFromRow(rowText).length >= 2) continue;

    // Determine label region (left of first column window)
    const firstColLeft = colWindows[0].left;
    const labelWords = row.filter(w => (w.Left + w.Width / 2) < firstColLeft);
    const labelText = labelWords
      .sort((a, b) => a.Left - b.Left)
      .map(w => w.WordText)
      .join(' ')
      .trim();

    const labelInfo = detectMeasurementLabel(labelText);
    if (!labelInfo) {
      // Some charts may omit labels on some lines; skip (table reconstruction needs labels per row)
      continue;
    }

    const { measure, unit } = labelInfo;
    knownMeasurements.add(measure);

    // For each column window, collect words within that x-window, join, parse range(s)
    for (let c = 0; c < headerSizes.length; c++) {
      const size = headerSizes[c];
      const win = colWindows[c];

      const cellWords = row
        .filter(w => {
          const cx = w.Left + w.Width / 2;
          return cx >= win.left && cx <= win.right;
        })
        .sort((a, b) => a.Left - b.Left);

      if (cellWords.length === 0) continue;

      const cellText = cellWords.map(w => w.WordText).join(' ');
      const ranges = extractAllRangesFromText(cellText);

      if (ranges.length === 0) continue;

      // Commonly there’s one range per cell; use first
      const r = ranges[0];

      const inches = toInchesWithSanity(measure, unit, r.min, r.max);
      if (!isFinite(inches) || inches <= 0) continue;

      if (!store[size]) store[size] = {};
      // prefer not overwriting if already set (keep first good hit)
      if (store[size][measure as MeasurementKey]?.valueInches == null) {
        store[size][measure as MeasurementKey] = { valueInches: inches };
      }
    }
  }

  // Build output
  const order = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const sizeList = Array.from(new Set(headerSizes)).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (isFinite(na) && isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const dataOut: Array<{ size: string; measurements: Record<string, number> }> = [];

  for (const size of sizeList) {
    const row = store[size];
    if (!row) continue;
    const out: Record<string, number> = {};

    for (const k of Object.keys(row) as MeasurementKey[]) {
      const v = row[k]?.valueInches;
      if (v == null) continue;
      out[k] = round2(v);
    }

    if (Object.keys(out).length > 0) {
      dataOut.push({ size, measurements: out });
    }
  }

  const measurementCount = dataOut.reduce((sum, r) => sum + Object.keys(r.measurements).length, 0);
  let confidence = ocrConfidence;
  if (dataOut.length === 0) confidence = 0;
  else if (measurementCount < 3) confidence = Math.min(confidence, 50);

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

/* --------------------------- Overlay/Table Helpers --------------------------- */

function clusterWordsIntoRows(words: OcrSpaceWord[]) {
  // Sort by Top, then Left
  const sorted = [...words].sort((a, b) => (a.Top - b.Top) || (a.Left - b.Left));

  // Estimate typical height for tolerance
  const heights = sorted.map(w => w.Height).filter(h => isFinite(h) && h > 0);
  const medianH = median(heights) || 12;
  const tolY = Math.max(6, Math.round(medianH * 0.6));

  const rows: OcrSpaceWord[][] = [];
  let current: OcrSpaceWord[] = [];
  let currentY = sorted[0]?.Top ?? 0;

  for (const w of sorted) {
    if (current.length === 0) {
      current = [w];
      currentY = w.Top;
      continue;
    }

    if (Math.abs(w.Top - currentY) <= tolY) {
      current.push(w);
      // update running y mean lightly
      currentY = Math.round((currentY * 0.85) + (w.Top * 0.15));
    } else {
      // finish row
      rows.push(current.sort((a, b) => a.Left - b.Left));
      current = [w];
      currentY = w.Top;
    }
  }

  if (current.length) rows.push(current.sort((a, b) => a.Left - b.Left));

  // Merge rows that are extremely close (OCR sometimes splits)
  const merged: OcrSpaceWord[][] = [];
  for (const row of rows) {
    if (merged.length === 0) {
      merged.push(row);
      continue;
    }
    const prev = merged[merged.length - 1];
    const prevY = avg(prev.map(x => x.Top));
    const rowY = avg(row.map(x => x.Top));
    if (Math.abs(rowY - prevY) <= Math.max(4, Math.round(medianH * 0.35))) {
      merged[merged.length - 1] = [...prev, ...row].sort((a, b) => a.Left - b.Left);
    } else {
      merged.push(row);
    }
  }

  return merged;
}

function buildColumnWindows(headerX: number[]) {
  // Given x centers, build [left,right] windows per column based on gaps.
  const xs = [...headerX].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < xs.length; i++) gaps.push(xs[i] - xs[i - 1]);
  const avgGap = gaps.length ? avg(gaps) : 120;
  const half = Math.max(35, Math.round(avgGap * 0.45));

  return headerX.map(cx => ({ left: cx - half, right: cx + half }));
}

function findSizeWordsInRow(row: OcrSpaceWord[]) {
  // Extract size tokens with their x-centers in left-to-right order.
  const candidates: { size: string; cx: number; left: number }[] = [];
  for (const w of row) {
    const token = normalizeSizeToken(w.WordText);
    if (!token) continue;
    candidates.push({
      size: token,
      cx: w.Left + w.Width / 2,
      left: w.Left,
    });
  }

  // Dedup by size while preserving left-to-right; also remove obvious noise
  const out: { size: string; cx: number }[] = [];
  const seen = new Set<string>();
  candidates.sort((a, b) => a.left - b.left);
  for (const c of candidates) {
    if (seen.has(c.size)) continue;
    seen.add(c.size);
    out.push({ size: c.size, cx: c.cx });
  }
  return out;
}

/* --------------------------- Label + Numeric Parsing --------------------------- */

function detectMeasurementLabel(text: string): { measure: MeasurementKey; unit: UnitKey } | null {
  const lower = (text || '').toLowerCase();

  const measure = normalizeMeasurement(lower);
  if (!measure) return null;

  let unit: UnitKey = 'unknown';
  if (/\b(cm|centimeter|centimetre)\b/.test(lower)) unit = 'cm';
  else if (/\b(in|inch|inches)\b/.test(lower) || /["”]/.test(text)) unit = 'in';

  return { measure, unit };
}

function normalizeMeasurement(lowerLine: string): MeasurementKey | null {
  if (/\b(chest|bust|pit to pit|pit-to-pit)\b/.test(lowerLine)) return 'chest';
  if (/\bwaist\b/.test(lowerLine)) return 'waist';
  if (/\b(low hip|hip|hips|seat)\b/.test(lowerLine)) return 'hips';
  if (/\binseam\b/.test(lowerLine)) return 'inseam';
  if (/\brise\b/.test(lowerLine)) return 'rise';
  if (/\bsleeve\b/.test(lowerLine)) return 'sleeve';
  if (/\bshoulder\b/.test(lowerLine)) return 'shoulder';
  if (/\bthigh\b/.test(lowerLine)) return 'thigh';
  if (/\b(length|garment length|dress length|top length)\b/.test(lowerLine)) return 'length';
  return null;
}

function extractAllRangesFromText(text: string): Range[] {
  // Normalize
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/–/g, '-')
    .replace(/[^\d./\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // token scanning, supports "303/4-321/4" and "30 3/4 - 32 1/4"
  const tokens = cleaned.split(' ').filter(Boolean);

  const ranges: Range[] = [];

  // Try to parse explicit ranges that might be split
  // We'll first join tokens back and extract using a light regex for "-".
  // Fallback to token-by-token parsing.
  const joined = cleaned;

  // Patterns like "303/4-321/4" or "25-26" or "90-97.5"
  const rangeRegex = /(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\d\/\d+)\s*-\s*(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\d\/\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = rangeRegex.exec(joined)) !== null) {
    const a = parseWeirdOcrNumber(m[1]);
    const b = parseWeirdOcrNumber(m[2]);
    if (a != null && b != null) ranges.push({ min: Math.min(a, b), max: Math.max(a, b) });
  }

  if (ranges.length) return ranges;

  // Single values
  for (const t of tokens) {
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
    if (single != null) ranges.push({ min: single, max: single });
  }

  return ranges;
}

/**
 * OCR turns:
 * - 30¾ into "303/4"
 * - 24½ into "241/2"
 * - 35½ into "351/2"
 */
function parseWeirdOcrNumber(s: string): number | null {
  const t = (s || '').trim();

  // plain decimal/int
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);

  // "30 3/4"
  const spaced = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (spaced) {
    const whole = parseInt(spaced[1], 10);
    const num = parseInt(spaced[2], 10);
    const den = parseInt(spaced[3], 10);
    if (!isFinite(whole) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return whole + num / den;
  }

  // "303/4" => 30 + 3/4 (last digit before slash is numerator)
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

/* --------------------------- Size Token Parsing --------------------------- */

function extractSizeTokensFromRow(text: string): string[] {
  const tokens = (text || '').split(/\s+/).map(t => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const s = normalizeSizeToken(t);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function normalizeSizeToken(tokenRaw: string): string | null {
  const t = (tokenRaw || '').trim().toUpperCase();
  if (!t) return null;

  // Normalize 2XS etc
  const normalized = t
    .replace(/^2XS$/, 'XXS')
    .replace(/^3XS$/, 'XXXS')
    .replace(/^2XL$/, 'XXL')
    .replace(/^3XL$/, 'XXXL');

  // Alpha sizes
  if (/^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)$/.test(normalized)) return normalized;

  // Numeric sizes: allow 2-digit typical apparel sizes (24, 26, 28, 30...)
  if (/^\d{2}$/.test(normalized)) return normalized;

  return null;
}

/* --------------------------- Inches Conversion + Sanity --------------------------- */

function toInchesWithSanity(measure: MeasurementKey, unit: UnitKey, rawMin: number, rawMax: number): number {
  const avgRaw = (rawMin + rawMax) / 2;

  let effectiveUnit: UnitKey = unit;
  if (effectiveUnit === 'unknown') {
    // heuristic: 70-120 range usually cm for body measurements
    effectiveUnit = avgRaw > 65 ? 'cm' : 'in';
  }

  let inches = effectiveUnit === 'cm' ? avgRaw / 2.54 : avgRaw;

  // sanity check; if absurd, try conversion
  const sanity = sanityRangeInches(measure);
  if (sanity) {
    const { minOk, maxOk } = sanity;
    if (inches > maxOk && avgRaw > 60) {
      const converted = avgRaw / 2.54;
      if (converted >= minOk && converted <= maxOk) inches = converted;
    }
  }

  return round2(inches);
}

function sanityRangeInches(measure: MeasurementKey): { minOk: number; maxOk: number } | null {
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

/* --------------------------- Math Helpers --------------------------- */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
