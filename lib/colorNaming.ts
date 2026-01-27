/**
 * Robust Offline HEX → Nearest Human Color Name System
 * Uses Lab color space and ΔE distance for accurate color matching
 * Fully offline, no paid APIs, optimized for performance
 */

import { NAMED_COLORS, NamedColor } from './colorNameDataset';

// Debug toggle
const DEBUG_COLOR_NAMING = true;

// Cache for hex → result lookups (LRU-style, max 100 entries)
const resultCache = new Map<string, { hex: string; name: string; deltaE: number }>();
const MAX_CACHE_SIZE = 100;

// Precomputed Lab values for all named colors (computed once at module init)
interface ColorWithLab extends NamedColor {
  lab: { L: number; a: number; b: number };
}

let precomputedColors: ColorWithLab[] = [];

/**
 * Convert RGB to Lab color space
 * Uses the standard RGB → XYZ → Lab conversion
 */
function rgbToLab(r: number, g: number, blue: number): { L: number; a: number; b: number } {
  // Normalize RGB to 0-1
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = blue / 255;

  // Apply gamma correction
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Convert to XYZ (using D65 illuminant)
  let x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) / 0.95047;
  let y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750) / 1.00000;
  let z = (rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041) / 1.08883;

  // Convert XYZ to Lab
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { L, a, b };
}

/**
 * Calculate ΔE (delta E) distance between two Lab colors
 * Uses CIEDE2000 formula - the industry standard for perceptual color difference
 */
function deltaE(lab1: { L: number; a: number; b: number }, lab2: { L: number; a: number; b: number }): number {
  // CIEDE2000 implementation
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;
  
  // Step 1: Calculate C'i and h'i
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));
  
  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);
  
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  
  const h1Prime = Math.atan2(b1, a1Prime) * (180 / Math.PI);
  const h2Prime = Math.atan2(b2, a2Prime) * (180 / Math.PI);
  
  const h1PrimeAdj = h1Prime < 0 ? h1Prime + 360 : h1Prime;
  const h2PrimeAdj = h2Prime < 0 ? h2Prime + 360 : h2Prime;
  
  // Step 2: Calculate ΔL', ΔC', ΔH'
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;
  
  let deltahPrime: number;
  if (C1Prime * C2Prime === 0) {
    deltahPrime = 0;
  } else if (Math.abs(h2PrimeAdj - h1PrimeAdj) <= 180) {
    deltahPrime = h2PrimeAdj - h1PrimeAdj;
  } else if (h2PrimeAdj - h1PrimeAdj > 180) {
    deltahPrime = h2PrimeAdj - h1PrimeAdj - 360;
  } else {
    deltahPrime = h2PrimeAdj - h1PrimeAdj + 360;
  }
  
  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((deltahPrime * Math.PI) / 360);
  
  // Step 3: Calculate CIEDE2000 Color-Difference
  const LPrimeAvg = (L1 + L2) / 2;
  const CPrimeAvg = (C1Prime + C2Prime) / 2;
  
  let hPrimeAvg: number;
  if (C1Prime * C2Prime === 0) {
    hPrimeAvg = h1PrimeAdj + h2PrimeAdj;
  } else if (Math.abs(h1PrimeAdj - h2PrimeAdj) <= 180) {
    hPrimeAvg = (h1PrimeAdj + h2PrimeAdj) / 2;
  } else if (h1PrimeAdj + h2PrimeAdj < 360) {
    hPrimeAvg = (h1PrimeAdj + h2PrimeAdj + 360) / 2;
  } else {
    hPrimeAvg = (h1PrimeAdj + h2PrimeAdj - 360) / 2;
  }
  
  const T = 1 
    - 0.17 * Math.cos((hPrimeAvg - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * hPrimeAvg) * Math.PI / 180)
    + 0.32 * Math.cos((3 * hPrimeAvg + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hPrimeAvg - 63) * Math.PI / 180);
  
  const deltaTheta = 30 * Math.exp(-Math.pow((hPrimeAvg - 275) / 25, 2));
  
  const RC = 2 * Math.sqrt(Math.pow(CPrimeAvg, 7) / (Math.pow(CPrimeAvg, 7) + Math.pow(25, 7)));
  
  const SL = 1 + (0.015 * Math.pow(LPrimeAvg - 50, 2)) / Math.sqrt(20 + Math.pow(LPrimeAvg - 50, 2));
  const SC = 1 + 0.045 * CPrimeAvg;
  const SH = 1 + 0.015 * CPrimeAvg * T;
  
  const RT = -Math.sin((2 * deltaTheta) * Math.PI / 180) * RC;
  
  // Weighting factors (kL, kC, kH) = 1 for reference conditions
  const kL = 1, kC = 1, kH = 1;
  
  const deltaE2000 = Math.sqrt(
    Math.pow(deltaLPrime / (kL * SL), 2) +
    Math.pow(deltaCPrime / (kC * SC), 2) +
    Math.pow(deltaHPrime / (kH * SH), 2) +
    RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );
  
  return deltaE2000;
}

/**
 * Convert hex string to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  
  // Handle 6-digit hex
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  
  return null;
}

/**
 * Normalize hex string (ensure # prefix and uppercase)
 */
function normalizeHex(hex: string): string {
  if (!hex) return '';
  const clean = hex.replace('#', '').toUpperCase();
  return clean.length === 6 ? `#${clean}` : hex;
}

/**
 * Initialize precomputed Lab values for all named colors
 * Called once at module load
 */
function initializePrecomputedColors(): void {
  if (precomputedColors.length > 0) return; // Already initialized
  
  const startTime = Date.now();
  
  precomputedColors = NAMED_COLORS.map(color => {
    const rgb = hexToRgb(color.hex);
    if (!rgb) {
      console.warn(`[COLOR NAMING] Invalid hex in dataset: ${color.hex}`);
      return null;
    }
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    return { ...color, lab };
  }).filter((c): c is ColorWithLab => c !== null);
  
  const initTime = Date.now() - startTime;
  
  if (DEBUG_COLOR_NAMING) {
    console.log(`[COLOR NAMING] Initialized ${precomputedColors.length} colors with Lab values in ${initTime}ms`);
  }
}

/**
 * Get nearest color name from hex using Lab color space and ΔE distance
 * 
 * @param hex - Hex color string (with or without #)
 * @returns Object with hex (normalized) and name of nearest match
 */
export function getNearestColorName(hex: string): { hex: string; name: string } {
  const startTime = Date.now();
  
  // Normalize input hex
  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) {
    if (DEBUG_COLOR_NAMING) {
      console.warn(`[COLOR NAMING] Invalid hex input: ${hex}`);
    }
    return { hex: hex || '#000000', name: 'Unknown' };
  }
  
  // Check cache first
  const cached = resultCache.get(normalizedHex);
  if (cached) {
    if (DEBUG_COLOR_NAMING) {
      console.log(`[COLOR NAMING] Cache hit for ${normalizedHex}: ${cached.name} (ΔE: ${cached.deltaE.toFixed(2)})`);
    }
    return { hex: cached.hex, name: cached.name };
  }
  
  // Initialize precomputed colors if not done
  if (precomputedColors.length === 0) {
    initializePrecomputedColors();
  }
  
  // Convert input hex to Lab
  const inputRgb = hexToRgb(normalizedHex);
  if (!inputRgb) {
    if (DEBUG_COLOR_NAMING) {
      console.warn(`[COLOR NAMING] Failed to parse hex: ${normalizedHex}`);
    }
    return { hex: normalizedHex, name: 'Unknown' };
  }
  
  const inputLab = rgbToLab(inputRgb.r, inputRgb.g, inputRgb.b);
  
  // Find nearest color by ΔE distance
  let nearestColor: ColorWithLab | null = null;
  let minDeltaE = Infinity;
  
  for (const color of precomputedColors) {
    const dE = deltaE(inputLab, color.lab);
    if (dE < minDeltaE) {
      minDeltaE = dE;
      nearestColor = color;
    }
  }
  
  if (!nearestColor) {
    if (DEBUG_COLOR_NAMING) {
      console.warn(`[COLOR NAMING] No nearest color found for ${normalizedHex}`);
    }
    return { hex: normalizedHex, name: 'Unknown' };
  }
  
  const result = {
    hex: normalizedHex,
    name: nearestColor.name,
  };
  
  // Cache result (with LRU eviction)
  if (resultCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (simple FIFO)
    const firstKey = resultCache.keys().next().value;
    resultCache.delete(firstKey);
  }
  resultCache.set(normalizedHex, { ...result, deltaE: minDeltaE });
  
  const computationTime = Date.now() - startTime;
  
  if (DEBUG_COLOR_NAMING) {
    console.log(`[COLOR NAMING] Input: ${normalizedHex}`);
    console.log(`[COLOR NAMING] Nearest: ${nearestColor.name} (${nearestColor.hex})`);
    console.log(`[COLOR NAMING] ΔE distance: ${minDeltaE.toFixed(2)}`);
    console.log(`[COLOR NAMING] Dataset size: ${precomputedColors.length}`);
    console.log(`[COLOR NAMING] Cache size: ${resultCache.size}`);
    console.log(`[COLOR NAMING] Computation time: ${computationTime}ms`);
    console.log(`[COLOR NAMING] Result cached: true`);
  }
  
  return result;
}

/**
 * Clear the result cache (useful for testing or memory management)
 */
export function clearColorNameCache(): void {
  resultCache.clear();
  if (DEBUG_COLOR_NAMING) {
    console.log('[COLOR NAMING] Cache cleared');
  }
}

// Initialize on module load
initializePrecomputedColors();

