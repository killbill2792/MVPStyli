/**
 * OCR Size Chart Parser (Overlay/Coordinates Based + Robust Scoring)
 * Uses OCR.space TextOverlay to reconstruct rows/columns from screenshots.
 *
 * Goals:
 * - Work across many real-world size chart screenshots (tables, mixed units, messy OCR order)
 * - Output inches only (convert cm -> inches)
 * - Handle OCR fraction artifacts like "303/4" meaning 30 3/4
 * - Avoid numeric pollution being mistaken as sizes
 *
 * Key robustness upgrades vs prior versions:
 * - Midpoint column boundaries (prevents cross-column contamination)
 * - Row de-noising (drops words that "bleed" from adjacent rows)
 * - Candidate scoring per cell (never blindly take the first range)
 * - Unit-aware merge: prefer inches row; else convert cm row
 * - Fallback parser if table header cannot be detected
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

type CellValue = {
  unit: UnitKey;        // unit detected for the row
  inches: number;       // final inches value
  rawMin: number;
  rawMax: number;
  sourceText: string;   // for debugging / traceability
  score: number;        // candidate score used to pick best
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

    let extractedText = '';
    let overlay: OcrSpaceTextOverlay | null = null;
    let ocrConfidence = 0;

    // ---------------- OCR Call ----------------
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

        // detect/convert using sharp
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
        } catch (e: any) {
          console.warn('📊 [OCR] Sharp failed, using fallback data uri:', e?.message);
          dataUriForOCR = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${rawBase64}`;
        }
      }

      if (dataUriForOCR) {
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

        const formData = new URLSearchParams();
        formData.append('apikey', ocrApiKey);
        formData.append('base64Image', dataUriForOCR);
        formData.append('language', 'eng');
        // critical: overlay for coordinates
        formData.append('isOverlayRequired', 'true');

        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        if (!ocrResponse.ok) {
          const errorText = await ocrResponse.text();
          console.warn('📊 [OCR] OCR.space HTTP error:', ocrResponse.status, errorText);
        } else {
          const ocrData = (await ocrResponse.json()) as OcrSpaceResponse;
          console.log('📊 [OCR] OCRExitCode:', ocrData.OCRExitCode);
          console.log('📊 [OCR] IsErroredOnProcessing:', ocrData.IsErroredOnProcessing);

          if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            const pr = ocrData.ParsedResults[0];
            extractedText = pr.ParsedText || '';
            overlay = pr.TextOverlay || null;
            ocrConfidence = overlay?.HasOverlay ? 80 : 60;
          } else if (ocrData.ErrorMessage) {
            console.warn('📊 [OCR] OCR.space error:', ocrData.ErrorMessage);
          }
        }
      } else if (imageUrl) {
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
    } catch (e: any) {
      console.warn('📊 [OCR] OCR call failed:', e?.message);
    }

    console.log('📊 [OCR] Extracted text length:', extractedText.length);
    console.log('📊 [OCR] Has overlay:', !!overlay?.HasOverlay);

    if (!overlay?.HasOverlay || !overlay?.Lines?.length) {
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

    // ---------------- Parse Overlay ----------------
    const parsed = parseFromOverlayRobust(overlay, ocrConfidence, extractedText);

    return res.status(200).json({
      success: true,
      parsed: parsed.success,
      confidence: parsed.confidence,
      data: parsed.data,
      rawText: extractedText,
      message: parsed.success
        ? 'Size chart parsed successfully'
        : 'Could not parse size chart automatically. Please enter measurements manually.',
      structure: parsed.structure,
    });
  } catch (error: any) {
    console.error('📊 [OCR] Handler error:', error?.message);
    return res.status(500).json({
      success: false,
      parsed: false,
      confidence: 0,
      error: error?.message,
      message: 'Failed to parse size chart. Please enter measurements manually.',
      structure: {
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
      },
    });
  }
}

/* =========================
   Robust overlay parsing
   ========================= */

function parseFromOverlayRobust(overlay: OcrSpaceTextOverlay, ocrConfidence: number, extractedText: string) {
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

  if (!allWords.length) {
    return { success: false, data: null, confidence: 0, structure: null };
  }

  // Cluster into rows
  const rows = clusterWordsIntoRows(allWords);

  // Detect best header row by scoring top candidates
  const header = detectBestHeader(rows);
  if (!header) {
    // Fallback: if table header not found, attempt text-only block parse
    const fallback = fallbackTextParse(extractedText, ocrConfidence);
    return fallback;
  }

  const { headerRowIndex, headerSizes, colBounds } = header;

  // Store best values per size+measure in two layers: inch-preferred vs cm
  // We'll keep best by score and then prefer inches.
  const store: Record<string, Partial<Record<MeasurementKey, { bestIn?: CellValue; bestCm?: CellValue; bestUnknown?: CellValue }>>> =
    {};

  const knownMeasurements = new Set<string>();

  // Parse rows below header
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = deNoiseRow(rows[i]); // reduce bleed

    if (!row.length) continue;

    // skip other header-like rows
    const rowText = row.map(w => w.WordText).join(' ');
    if (extractSizeTokensFromText(rowText).length >= 2) continue;

    // Label area is left of first size column boundary
    const labelWords = row.filter(w => centerX(w) < colBounds[0].left);
    const labelText = labelWords
      .sort((a, b) => a.Left - b.Left)
      .map(w => w.WordText)
      .join(' ')
      .trim();

    const labelInfo = detectMeasurementLabel(labelText);
    if (!labelInfo) continue;

    const { measure, unit } = labelInfo;
    knownMeasurements.add(measure);

    for (let c = 0; c < headerSizes.length; c++) {
      const size = headerSizes[c];
      const bounds = colBounds[c];

      // cell words inside this column bounds
      const cellWords = row
        .filter(w => {
          const cx = centerX(w);
          return cx >= bounds.left && cx <= bounds.right;
        })
        .sort((a, b) => a.Left - b.Left);

      if (!cellWords.length) continue;

      const cellText = cellWords.map(w => w.WordText).join(' ').trim();
      const candidates = extractCandidatesFromCell(cellText);

      if (!candidates.length) continue;

      // pick best candidate by score (unit-aware + sanity-aware)
      const best = pickBestCandidate(measure, unit, candidates, cellText);
      if (!best) continue;

      if (!store[size]) store[size] = {};
      if (!store[size][measure]) store[size][measure] = {};

      const slot = store[size][measure]!;
      if (best.unit === 'in') slot.bestIn = keepBetter(slot.bestIn, best);
      else if (best.unit === 'cm') slot.bestCm = keepBetter(slot.bestCm, best);
      else slot.bestUnknown = keepBetter(slot.bestUnknown, best);
    }
  }

  // Finalize: prefer inches, else cm->in, else unknown->in
  const out: Array<{ size: string; measurements: Record<string, number> }> = [];
  const sizeOrder = sortSizes(headerSizes);

  for (const size of sizeOrder) {
    const row = store[size];
    if (!row) continue;
    const measurements: Record<string, number> = {};

    for (const m of Object.keys(row) as MeasurementKey[]) {
      const slots = row[m];
      if (!slots) continue;

      const chosen = slots.bestIn || slots.bestCm || slots.bestUnknown;
      if (!chosen) continue;

      // chosen.inches is already inches (cm candidates were converted during scoring)
      if (isFinite(chosen.inches) && chosen.inches > 0) {
        measurements[m] = round2(chosen.inches);
      }
    }

    if (Object.keys(measurements).length) {
      out.push({ size, measurements });
    }
  }

  const measurementCount = out.reduce((s, r) => s + Object.keys(r.measurements).length, 0);
  let confidence = ocrConfidence;
  if (!out.length) confidence = 0;
  else if (measurementCount < 3) confidence = Math.min(confidence, 55);

  return {
    success: out.length > 0,
    data: out.length ? out : null,
    confidence,
    structure: {
      sizes: out.map(r => r.size),
      measurements: Array.from(knownMeasurements),
    },
  };
}

/* =========================
   Header detection (robust)
   ========================= */

function detectBestHeader(rows: OcrSpaceWord[][]): null | {
  headerRowIndex: number;
  headerSizes: string[];
  colBounds: { left: number; right: number }[];
} {
  // Search first N rows for header candidates (size headers usually near top)
  const N = Math.min(rows.length, 30);

  let bestScore = -Infinity;
  let best: { idx: number; sizes: { size: string; cx: number }[] } | null = null;

  for (let i = 0; i < N; i++) {
    const row = deNoiseRow(rows[i]);
    if (!row.length) continue;

    const sizeWords = findSizeWordsInRow(row);
    if (sizeWords.length < 2) continue;

    // Score candidate: more sizes + evenly spaced + not polluted by measurement words
    const text = row.map(w => w.WordText).join(' ').toLowerCase();
    if (looksLikeMeasurementRow(text)) continue;

    const xs = sizeWords.map(s => s.cx).sort((a, b) => a - b);
    const gaps = [];
    for (let k = 1; k < xs.length; k++) gaps.push(xs[k] - xs[k - 1]);
    const gapAvg = gaps.length ? avg(gaps) : 0;
    const gapStd = gaps.length ? stddev(gaps) : 0;

    const score =
      sizeWords.length * 10 +
      Math.min(20, gapAvg / 10) -
      Math.min(20, gapStd / 10);

    if (score > bestScore) {
      bestScore = score;
      best = { idx: i, sizes: sizeWords };
    }
  }

  if (!best) return null;

  // Create midpoint column boundaries (critical fix)
  const headerSizes = best.sizes.map(s => s.size);
  const headerX = best.sizes.map(s => s.cx);

  const colBounds = buildMidpointColumnBounds(headerX);

  return {
    headerRowIndex: best.idx,
    headerSizes,
    colBounds,
  };
}

function looksLikeMeasurementRow(lowerText: string) {
  return /\b(chest|bust|waist|hip|hips|inseam|rise|length|sleeve|shoulder|thigh|cm|inch|inches)\b/.test(
    lowerText
  );
}

function buildMidpointColumnBounds(headerX: number[]) {
  // Use midpoints between adjacent header centers.
  // This prevents column overlap that caused cross-column contamination.
  const xs = headerX.map(x => x);
  const n = xs.length;

  // If headerX is not strictly sorted due to OCR, sort but keep original mapping
  // We actually want bounds by visual order; headerX corresponds to headerSizes order from findSizeWordsInRow
  // which is already left-to-right, so treat it as sorted.

  const bounds: { left: number; right: number }[] = [];

  for (let i = 0; i < n; i++) {
    const leftMid = i === 0 ? xs[i] - (xs[i + 1] ? (xs[i + 1] - xs[i]) * 0.6 : 80) : (xs[i - 1] + xs[i]) / 2;
    const rightMid =
      i === n - 1 ? xs[i] + (xs[i - 1] ? (xs[i] - xs[i - 1]) * 0.6 : 80) : (xs[i] + xs[i + 1]) / 2;

    // Small padding inward to reduce bleed
    const pad = 6;
    bounds.push({ left: leftMid + pad, right: rightMid - pad });
  }

  // Ensure monotonic
  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i].left < bounds[i - 1].left) bounds[i].left = bounds[i - 1].left + 1;
    if (bounds[i].right < bounds[i].left) bounds[i].right = bounds[i].left + 5;
  }

  return bounds;
}

/* =========================
   Candidate extraction + scoring
   ========================= */

function extractCandidatesFromCell(cellText: string): Range[] {
  // Extract ALL ranges from a cell; cells often contain both inch and cm ranges or stacked lines.
  return extractAllRangesFromText(cellText);
}

function pickBestCandidate(
  measure: MeasurementKey,
  unit: UnitKey,
  ranges: Range[],
  cellText: string
): CellValue | null {
  let best: CellValue | null = null;

  for (const r of ranges) {
    const avgRaw = (r.min + r.max) / 2;

    // Determine effective unit
    let effUnit: UnitKey = unit;
    if (effUnit === 'unknown') {
      // Use hints in cell text first
      const lower = cellText.toLowerCase();
      if (/\bcm\b|\bcentimeter\b|\bcentimetre\b/.test(lower)) effUnit = 'cm';
      else if (/\binch\b|\binches\b|\bin\b|["”]/.test(lower)) effUnit = 'in';
      else effUnit = avgRaw > 65 ? 'cm' : 'in';
    }

    // Convert
    let inches = effUnit === 'cm' ? avgRaw / 2.54 : avgRaw;

    // Score
    const score = scoreMeasurementCandidate(measure, inches, effUnit);

    if (score <= -999) continue; // reject

    const cand: CellValue = {
      unit: effUnit,
      inches: round2(inches),
      rawMin: r.min,
      rawMax: r.max,
      sourceText: cellText,
      score,
    };

    best = keepBetter(best, cand);
  }

  return best;
}

function scoreMeasurementCandidate(measure: MeasurementKey, inches: number, unit: UnitKey): number {
  // Hard reject non-sense
  if (!isFinite(inches) || inches <= 0) return -9999;

  // sanity bounds per measurement
  const sanity = sanityRangeInches(measure);
  if (sanity) {
    const { minOk, maxOk } = sanity;

    // If wildly out-of-range, reject
    if (inches < minOk * 0.5 || inches > maxOk * 1.7) return -9999;

    // Prefer values inside range strongly
    const inside = inches >= minOk && inches <= maxOk;
    let score = inside ? 50 : 10;

    // Prefer inches-labeled candidates over cm-labeled if both exist
    if (unit === 'in') score += 10;
    else if (unit === 'cm') score += 2;

    // Soft preference toward “typical” zones to break ties
    const typical = typicalInches(measure);
    if (typical) {
      const dist = Math.abs(inches - typical);
      score += Math.max(0, 20 - dist); // closer is better
    }

    // Penalize edge extremes
    const edgeDist = Math.min(Math.abs(inches - minOk), Math.abs(inches - maxOk));
    score += Math.min(5, edgeDist / 2);

    return score;
  }

  // If no sanity, still prefer inches and moderate magnitudes
  let score = 20;
  if (unit === 'in') score += 5;
  if (inches > 300) return -9999;
  return score;
}

function typicalInches(measure: MeasurementKey): number | null {
  switch (measure) {
    case 'waist':
      return 30;
    case 'chest':
      return 36;
    case 'hips':
      return 38;
    case 'inseam':
      return 30;
    case 'sleeve':
      return 24;
    case 'shoulder':
      return 15;
    case 'rise':
      return 10;
    case 'length':
      return 30;
    case 'thigh':
      return 22;
    default:
      return null;
  }
}

function keepBetter(a: CellValue | null | undefined, b: CellValue): CellValue {
  if (!a) return b;
  if (b.score > a.score) return b;
  return a;
}

/* =========================
   Fallback (text-only) for cases where header isn't detected
   ========================= */

function fallbackTextParse(text: string, ocrConfidence: number) {
  // Simple but safe fallback: parse blocks by size tokens + labeled measurements.
  // This is not perfect for all charts, but prevents returning insane values.
  const lines = normalizeOcrLines(text);

  const store: Record<string, Partial<Record<MeasurementKey, CellValue>>> = {};
  const knownMeasurements = new Set<string>();

  let currentSize: string | null = null;
  let currentLabel: { measure: MeasurementKey; unit: UnitKey } | null = null;

  for (const line of lines) {
    const size = detectSingleSizeLine(line);
    if (size) {
      currentSize = size;
      currentLabel = null;
      if (!store[currentSize]) store[currentSize] = {};
      continue;
    }

    if (!currentSize) continue;

    const label = detectMeasurementLabel(line);
    if (label) {
      currentLabel = label;
      knownMeasurements.add(label.measure);
      continue;
    }

    if (!currentLabel) continue;

    const ranges = extractAllRangesFromText(line);
    if (!ranges.length) continue;

    const best = pickBestCandidate(currentLabel.measure, currentLabel.unit, ranges, line);
    if (!best) continue;

    // prefer inches, else keep best
    const existing = store[currentSize][currentLabel.measure];
    store[currentSize][currentLabel.measure] = keepBetter(existing, best);
  }

  const sizes = sortSizes(Object.keys(store));
  const data = sizes
    .map(size => {
      const row = store[size];
      const measurements: Record<string, number> = {};
      for (const k of Object.keys(row) as MeasurementKey[]) {
        const v = row[k];
        if (v?.inches != null && isFinite(v.inches) && v.inches > 0) {
          measurements[k] = round2(v.inches);
        }
      }
      return Object.keys(measurements).length ? { size, measurements } : null;
    })
    .filter(Boolean) as Array<{ size: string; measurements: Record<string, number> }>;

  let confidence = Math.min(ocrConfidence, 55);
  if (!data.length) confidence = 0;

  return {
    success: data.length > 0,
    data: data.length ? data : null,
    confidence,
    structure: {
      sizes: data.map(d => d.size),
      measurements: Array.from(knownMeasurements),
    },
  };
}

/* =========================
   Overlay/Table helpers
   ========================= */

function centerX(w: OcrSpaceWord) {
  return w.Left + w.Width / 2;
}

function deNoiseRow(row: OcrSpaceWord[]) {
  // Drop words whose Top is far from the row’s median Top (prevents bleed from adjacent rows)
  if (!row.length) return row;
  const tops = row.map(w => w.Top);
  const med = median(tops);
  const heights = row.map(w => w.Height).filter(h => isFinite(h) && h > 0);
  const medH = median(heights) || 12;

  const tol = Math.max(6, Math.round(medH * 0.7));
  return row.filter(w => Math.abs(w.Top - med) <= tol);
}

function clusterWordsIntoRows(words: OcrSpaceWord[]) {
  const sorted = [...words].sort((a, b) => (a.Top - b.Top) || (a.Left - b.Left));
  const heights = sorted.map(w => w.Height).filter(h => isFinite(h) && h > 0);
  const medianH = median(heights) || 12;
  const tolY = Math.max(6, Math.round(medianH * 0.6));

  const rows: OcrSpaceWord[][] = [];
  let current: OcrSpaceWord[] = [];
  let currentY = sorted[0]?.Top ?? 0;

  for (const w of sorted) {
    if (!current.length) {
      current = [w];
      currentY = w.Top;
      continue;
    }
    if (Math.abs(w.Top - currentY) <= tolY) {
      current.push(w);
      currentY = Math.round(currentY * 0.85 + w.Top * 0.15);
    } else {
      rows.push(current.sort((a, b) => a.Left - b.Left));
      current = [w];
      currentY = w.Top;
    }
  }
  if (current.length) rows.push(current.sort((a, b) => a.Left - b.Left));

  // Merge extremely close rows (OCR sometimes splits)
  const merged: OcrSpaceWord[][] = [];
  for (const r of rows) {
    if (!merged.length) {
      merged.push(r);
      continue;
    }
    const prev = merged[merged.length - 1];
    const prevY = avg(prev.map(x => x.Top));
    const rowY = avg(r.map(x => x.Top));
    if (Math.abs(rowY - prevY) <= Math.max(4, Math.round(medianH * 0.35))) {
      merged[merged.length - 1] = [...prev, ...r].sort((a, b) => a.Left - b.Left);
    } else {
      merged.push(r);
    }
  }
  return merged;
}

/* =========================
   Measurement label + parsing
   ========================= */

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

/* =========================
   Numeric extraction (fractions, ranges)
   ========================= */

function extractAllRangesFromText(text: string): Range[] {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/–/g, '-')
    .replace(/[^\d./\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const ranges: Range[] = [];

  // joined-range regex
  const rangeRegex =
    /(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\d\/\d+)\s*-\s*(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\d\/\d+)/g;

  let m: RegExpExecArray | null;
  while ((m = rangeRegex.exec(cleaned)) !== null) {
    const a = parseWeirdOcrNumber(m[1]);
    const b = parseWeirdOcrNumber(m[2]);
    if (a != null && b != null) ranges.push({ min: Math.min(a, b), max: Math.max(a, b) });
  }

  if (ranges.length) return ranges;

  // token scan fallback
  const tokens = cleaned.split(' ').filter(Boolean);
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

function parseWeirdOcrNumber(s: string): number | null {
  const t = (s || '').trim();

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

  // "303/4" => 30 + 3/4
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

/* =========================
   Size detection
   ========================= */

function findSizeWordsInRow(row: OcrSpaceWord[]) {
  const candidates: { size: string; cx: number; left: number }[] = [];
  for (const w of row) {
    const token = normalizeSizeToken(w.WordText);
    if (!token) continue;
    candidates.push({ size: token, cx: centerX(w), left: w.Left });
  }
  candidates.sort((a, b) => a.left - b.left);

  const out: { size: string; cx: number }[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.size)) continue;
    seen.add(c.size);
    out.push({ size: c.size, cx: c.cx });
  }
  return out;
}

function extractSizeTokensFromText(text: string): string[] {
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

  const normalized = t
    .replace(/^2XS$/, 'XXS')
    .replace(/^3XS$/, 'XXXS')
    .replace(/^2XL$/, 'XXL')
    .replace(/^3XL$/, 'XXXL');

  if (/^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)$/.test(normalized)) return normalized;
  if (/^\d{2}$/.test(normalized)) return normalized;

  return null;
}

function detectSingleSizeLine(line: string): string | null {
  const trimmed = (line || '').trim();
  if (!trimmed) return null;
  const tokens = extractSizeTokensFromText(trimmed);
  if (tokens.length === 1 && tokens[0] === trimmed.toUpperCase()) return tokens[0];
  return null;
}

function sortSizes(sizes: string[]) {
  const order = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
  return [...new Set(sizes)].sort((a, b) => {
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
}

/* =========================
   Text normalization helpers
   ========================= */

function normalizeOcrLines(text: string): string[] {
  return (text || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, ' '));
}

/* =========================
   Sanity bounds and math
   ========================= */

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

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = avg(nums);
  const v = avg(nums.map(x => (x - m) ** 2));
  return Math.sqrt(v);
}
