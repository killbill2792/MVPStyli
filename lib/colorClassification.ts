/**
 * Color Classification System
 * Uses Lab color space and ΔE (delta E) distance for perceptual color matching
 * Classifies garments into 4-season palette categories (neutrals/accents/brights/softs)
 * 
 * This system ensures high accuracy by:
 * 1. Using Lab color space (perceptually uniform)
 * 2. Calculating ΔE distance (CIE76)
 * 3. Applying strict gating (minDeltaE > 12 = unclassified)
 * 4. Detecting ambiguous matches (deltaE2 - deltaE1 < 2)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface PaletteColor {
  name: string;
  hex: string;
  lab: Lab;
}

export interface SeasonPalette {
  neutrals: PaletteColor[];
  accents: PaletteColor[];
  brights: PaletteColor[];
  softs: PaletteColor[];
}

export interface FullPalette {
  spring: SeasonPalette;
  summer: SeasonPalette;
  autumn: SeasonPalette;
  winter: SeasonPalette;
}

export interface ClassificationResult {
  seasonTag: 'spring' | 'summer' | 'autumn' | 'winter' | null;
  groupTag: 'neutrals' | 'accents' | 'brights' | 'softs' | null;
  dominantHex: string;
  lab: Lab;
  nearestPaletteColor: { name: string; hex: string } | null;
  minDeltaE: number | null;
  classificationStatus: 'ok' | 'unclassified' | 'ambiguous';
}

// ============================================================================
// COLOR SPACE CONVERSIONS
// ============================================================================

/**
 * Convert hex color to RGB
 * Handles both #RRGGBB and #RGB formats
 */
export function hexToRgb(hex: string): RGB | null {
  if (!hex || typeof hex !== 'string') return null;
  
  // Remove # if present
  let cleanHex = hex.replace('#', '').trim();
  
  // Handle 3-digit hex (e.g., #F00 -> #FF0000)
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  
  // Must be 6 digits now
  if (cleanHex.length !== 6) return null;
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  
  return { r, g, b };
}

/**
 * Convert RGB to XYZ (using sRGB color space)
 * RGB values must be in range 0-255
 */
export function rgbToXyz(rgb: RGB): XYZ {
  // Normalize RGB to 0-1 range
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;
  
  // Apply gamma correction (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  
  // Convert to XYZ using sRGB matrix
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;
  
  return { x, y, z };
}

/**
 * Convert XYZ to Lab (CIE Lab color space)
 * Uses D65 illuminant as white point reference
 */
export function xyzToLab(xyz: XYZ): Lab {
  // D65 white point (standard illuminant)
  const Xn = 95.047;
  const Yn = 100.000;
  const Zn = 108.883;
  
  // Normalize by white point
  let x = xyz.x / Xn;
  let y = xyz.y / Yn;
  let z = xyz.z / Zn;
  
  // Apply f function (for Lab conversion)
  const f = (t: number): number => {
    const delta = 6 / 29;
    if (t > delta * delta * delta) {
      return Math.pow(t, 1 / 3);
    }
    return t / (3 * delta * delta) + 4 / 29;
  };
  
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  
  // Calculate Lab values
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  
  return { L, a, b };
}

/**
 * Calculate ΔE (delta E) distance between two Lab colors
 * Uses CIE76 formula (Euclidean distance in Lab space)
 * 
 * ΔE interpretation:
 * - < 1: Not perceptible by human eyes
 * - 1-2: Perceptible through close observation
 * - 2-10: Perceptible at a glance
 * - 11-49: Colors are more similar than opposite
 * - > 50: Colors are exact opposite
 */
export function deltaE(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  
  // CIE76 formula: Euclidean distance in Lab space
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Convert hex directly to Lab (convenience function)
 */
export function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

// ============================================================================
// PALETTE DEFINITION WITH PRECOMPUTED LAB VALUES
// ============================================================================

/**
 * 4-Season Color Palette
 * Each color has precomputed Lab values for fast matching
 */
const PALETTE_RAW = {
  spring: {
    neutrals: [
      { name: "Warm ivory", hex: "#F6EAD7" },
      { name: "Cream", hex: "#FFF1D6" },
      { name: "Light camel", hex: "#D8B58A" },
      { name: "Soft beige", hex: "#E6D2B5" },
      { name: "Golden sand", hex: "#D9B77C" },
    ],
    accents: [
      { name: "Coral", hex: "#FF6F61" },
      { name: "Peach", hex: "#FFB38A" },
      { name: "Warm rose", hex: "#E88A8A" },
      { name: "Apricot", hex: "#FF9F6B" },
      { name: "Melon", hex: "#FF8C69" },
    ],
    brights: [
      { name: "Cantaloupe", hex: "#FFA64D" },
      { name: "Warm yellow", hex: "#FFD84D" },
      { name: "Bright aqua", hex: "#2ECED0" },
      { name: "Light turquoise", hex: "#5ED6C1" },
      { name: "Sunny gold", hex: "#FFC83D" },
    ],
    softs: [
      { name: "Mint", hex: "#BFE6C7" },
      { name: "Soft peach", hex: "#FFD1B3" },
      { name: "Light warm pink", hex: "#F6B7B2" },
      { name: "Soft teal", hex: "#7FCFC3" },
      { name: "Buttercream", hex: "#FFF0B3" },
    ],
  },
  summer: {
    neutrals: [
      { name: "Cool ivory", hex: "#F2F0EB" },
      { name: "Soft gray", hex: "#C8C8D0" },
      { name: "Rose beige", hex: "#E3D5D2" },
      { name: "Misty taupe", hex: "#CDC4C1" },
      { name: "Silver frost", hex: "#DDE1E8" },
    ],
    accents: [
      { name: "Dusty rose", hex: "#D8A7A7" },
      { name: "Mauve", hex: "#C8A2C8" },
      { name: "Soft berry", hex: "#B58CA5" },
      { name: "Lavender", hex: "#C7B8E0" },
      { name: "Ballet pink", hex: "#F4C5C9" },
    ],
    brights: [
      { name: "Periwinkle", hex: "#8FA4E8" },
      { name: "Cool aqua", hex: "#8FD6D5" },
      { name: "Powder blue", hex: "#AFC8E7" },
      { name: "Soft fuchsia", hex: "#D66DA3" },
      { name: "Strawberry ice", hex: "#E87BAA" },
    ],
    softs: [
      { name: "Blue gray", hex: "#B7C4CF" },
      { name: "Misty blue", hex: "#C6D7E2" },
      { name: "Heather", hex: "#D8CBE2" },
      { name: "Soft lilac", hex: "#E7D6F5" },
      { name: "Cloud pink", hex: "#F7DDE3" },
    ],
  },
  autumn: {
    neutrals: [
      { name: "Warm beige", hex: "#E6D5B8" },
      { name: "Camel", hex: "#C1A16B" },
      { name: "Olive taupe", hex: "#B6A892" },
      { name: "Caramel", hex: "#B78B57" },
      { name: "Soft olive", hex: "#A89F80" },
    ],
    accents: [
      { name: "Terracotta", hex: "#C96541" },
      { name: "Rust", hex: "#B4441C" },
      { name: "Burnt sienna", hex: "#A85F3D" },
      { name: "Mustard", hex: "#D3A63C" },
      { name: "Warm olive", hex: "#8E8C53" },
    ],
    brights: [
      { name: "Pumpkin", hex: "#F18F01" },
      { name: "Marigold", hex: "#FFC145" },
      { name: "Moss green", hex: "#8FAE3E" },
      { name: "Teal", hex: "#1B998B" },
      { name: "Brick red", hex: "#A23E3D" },
    ],
    softs: [
      { name: "Sage", hex: "#C4C8A8" },
      { name: "Dusty olive", hex: "#A3A380" },
      { name: "Clay", hex: "#C9A28C" },
      { name: "Soft terracotta", hex: "#D1A38A" },
      { name: "Muted gold", hex: "#D6BA6A" },
    ],
  },
  winter: {
    neutrals: [
      { name: "Snow white", hex: "#FFFFFF" },
      { name: "Cool black", hex: "#0A0A0A" },
      { name: "Charcoal", hex: "#333333" },
      { name: "Silver gray", hex: "#BFC3C9" },
      { name: "Blue-gray", hex: "#8A97A8" },
    ],
    accents: [
      { name: "Fuchsia", hex: "#E3007E" },
      { name: "Berry", hex: "#B8004E" },
      { name: "Royal purple", hex: "#5A2D82" },
      { name: "Crimson", hex: "#D1002C" },
      { name: "Electric magenta", hex: "#FF1B8D" },
    ],
    brights: [
      { name: "True red", hex: "#FF0000" },
      { name: "Sapphire blue", hex: "#0F52BA" },
      { name: "Emerald", hex: "#009975" },
      { name: "Icy teal", hex: "#4BC6B9" },
      { name: "Lemon ice", hex: "#F2FF6E" },
    ],
    softs: [
      { name: "Icy lavender", hex: "#D6D4F7" },
      { name: "Ice pink", hex: "#F6D3E6" },
      { name: "Frost blue", hex: "#D8EAFE" },
      { name: "Soft wine", hex: "#C79CA6" },
      { name: "Cool plum", hex: "#836283" },
    ],
  },
};

/**
 * Precompute Lab values for all palette colors
 * This is done once at module load for performance
 */
function precomputePaletteLab(): FullPalette {
  const palette: FullPalette = {
    spring: { neutrals: [], accents: [], brights: [], softs: [] },
    summer: { neutrals: [], accents: [], brights: [], softs: [] },
    autumn: { neutrals: [], accents: [], brights: [], softs: [] },
    winter: { neutrals: [], accents: [], brights: [], softs: [] },
  };
  
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    for (const group of ['neutrals', 'accents', 'brights', 'softs'] as const) {
      palette[season][group] = PALETTE_RAW[season][group].map(color => {
        const lab = hexToLab(color.hex);
        if (!lab) {
          throw new Error(`Failed to compute Lab for ${color.name} (${color.hex})`);
        }
        return {
          name: color.name,
          hex: color.hex,
          lab,
        };
      });
    }
  }
  
  return palette;
}

// Precomputed palette (computed once at module load)
export const PALETTE: FullPalette = precomputePaletteLab();

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

/**
 * Classify a garment color into season + category
 * 
 * Algorithm:
 * 1. Convert input hex → Lab
 * 2. Compare to ALL palette colors across all seasons
 * 3. Find best match (minimum ΔE)
 * 4. Apply gating:
 *    - If minDeltaE > 12 → unclassified
 *    - If (runnerUpDeltaE - bestDeltaE) < 2 → ambiguous
 * 5. Return classification result
 * 
 * @param hex - Input color hex code (e.g., "#FF6F61")
 * @returns ClassificationResult with season, group, and metadata
 */
export function classifyGarment(hex: string): ClassificationResult {
  // Convert input hex to Lab
  const inputLab = hexToLab(hex);
  if (!inputLab) {
    return {
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: { L: 0, a: 0, b: 0 },
      nearestPaletteColor: null,
      minDeltaE: null,
      classificationStatus: 'unclassified',
    };
  }
  
  // Track best matches across all seasons and groups
  let bestMatch: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    group: 'neutrals' | 'accents' | 'brights' | 'softs';
    color: PaletteColor;
    deltaE: number;
  } | null = null;
  
  let runnerUpMatch: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    group: 'neutrals' | 'accents' | 'brights' | 'softs';
    color: PaletteColor;
    deltaE: number;
  } | null = null;
  
  // Compare against all palette colors
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    for (const group of ['neutrals', 'accents', 'brights', 'softs'] as const) {
      for (const paletteColor of PALETTE[season][group]) {
        const dE = deltaE(inputLab, paletteColor.lab);
        
        // Update best match
        if (!bestMatch || dE < bestMatch.deltaE) {
          runnerUpMatch = bestMatch;
          bestMatch = {
            season,
            group,
            color: paletteColor,
            deltaE: dE,
          };
        } else if (!runnerUpMatch || dE < runnerUpMatch.deltaE) {
          // Update runner-up (must be from different season or group)
          if (bestMatch.season !== season || bestMatch.group !== group) {
            runnerUpMatch = {
              season,
              group,
              color: paletteColor,
              deltaE: dE,
            };
          }
        }
      }
    }
  }
  
  // Apply gating logic
  if (!bestMatch) {
    return {
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: inputLab,
      nearestPaletteColor: null,
      minDeltaE: null,
      classificationStatus: 'unclassified',
    };
  }
  
  // Gate 1: If minDeltaE > 12, color is too far from any palette color
  if (bestMatch.deltaE > 12) {
    return {
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: inputLab,
      nearestPaletteColor: {
        name: bestMatch.color.name,
        hex: bestMatch.color.hex,
      },
      minDeltaE: bestMatch.deltaE,
      classificationStatus: 'unclassified',
    };
  }
  
  // Gate 2: If runner-up is too close (< 2 ΔE difference), match is ambiguous
  if (runnerUpMatch && (runnerUpMatch.deltaE - bestMatch.deltaE) < 2) {
    return {
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: inputLab,
      nearestPaletteColor: {
        name: bestMatch.color.name,
        hex: bestMatch.color.hex,
      },
      minDeltaE: bestMatch.deltaE,
      classificationStatus: 'ambiguous',
    };
  }
  
  // Classification successful
  return {
    seasonTag: bestMatch.season,
    groupTag: bestMatch.group,
    dominantHex: hex,
    lab: inputLab,
    nearestPaletteColor: {
      name: bestMatch.color.name,
      hex: bestMatch.color.hex,
    },
    minDeltaE: bestMatch.deltaE,
    classificationStatus: 'ok',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  hexToRgb,
  rgbToXyz,
  xyzToLab,
  deltaE,
  hexToLab,
  classifyGarment,
  PALETTE,
};
