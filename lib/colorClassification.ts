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

export interface RawPaletteColor {
  name: string;
  hex: string;
}

export interface SeasonPalette {
  neutrals: PaletteColor[];
  accents: PaletteColor[];
  brights: PaletteColor[];
  softs: PaletteColor[];
}

export interface RawSeasonPalette {
  neutrals: RawPaletteColor[];
  accents: RawPaletteColor[];
  brights: RawPaletteColor[];
  softs: RawPaletteColor[];
}

export interface FullPalette {
  spring: SeasonPalette;
  summer: SeasonPalette;
  autumn: SeasonPalette;
  winter: SeasonPalette;
}

// Micro-season types
export type MicroSeason = 
  | 'light_spring' | 'warm_spring' | 'bright_spring'
  | 'soft_summer' | 'cool_summer' | 'light_summer'
  | 'deep_autumn' | 'soft_autumn' | 'warm_autumn'
  | 'bright_winter' | 'cool_winter' | 'deep_winter';

export type ParentSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface MicroSeasonPalette extends SeasonPalette {
  microSeason: MicroSeason;
  parentSeason: ParentSeason;
}

export interface FullMicroSeasonPalette {
  [key: string]: MicroSeasonPalette;
}

// Map micro-seasons to parent seasons
export const MICRO_TO_PARENT: Record<MicroSeason, ParentSeason> = {
  light_spring: 'spring',
  warm_spring: 'spring',
  bright_spring: 'spring',
  soft_summer: 'summer',
  cool_summer: 'summer',
  light_summer: 'summer',
  deep_autumn: 'autumn',
  soft_autumn: 'autumn',
  warm_autumn: 'autumn',
  bright_winter: 'winter',
  cool_winter: 'winter',
  deep_winter: 'winter',
};

// Human-readable micro-season names
export const MICRO_SEASON_NAMES: Record<MicroSeason, string> = {
  light_spring: 'Light Spring',
  warm_spring: 'Warm Spring',
  bright_spring: 'Bright Spring',
  soft_summer: 'Soft Summer',
  cool_summer: 'Cool Summer',
  light_summer: 'Light Summer',
  deep_autumn: 'Deep Autumn',
  soft_autumn: 'Soft Autumn',
  warm_autumn: 'Warm Autumn',
  bright_winter: 'Bright Winter',
  cool_winter: 'Cool Winter',
  deep_winter: 'Deep Winter',
};

export interface ClassificationResult {
  // Primary classification
  microSeasonTag: MicroSeason | null;
  seasonTag: ParentSeason | null; // Parent season (for backward compatibility)
  groupTag: 'neutrals' | 'accents' | 'brights' | 'softs' | null;
  dominantHex: string;
  lab: Lab;
  nearestPaletteColor: { name: string; hex: string } | null;
  minDeltaE: number | null;
  
  // Secondary classification (for crossover colors)
  secondaryMicroSeasonTag: MicroSeason | null;
  secondarySeasonTag: ParentSeason | null;
  secondaryGroupTag: 'neutrals' | 'accents' | 'brights' | 'softs' | null;
  secondaryDeltaE: number | null;
  
  // Classification status:
  // - 'great': Strong match (ΔE gap > 4 from runner-up)
  // - 'good': Decent match (ΔE gap 2-4 from runner-up)
  // - 'ambiguous': Too close to call (ΔE gap < 2) - still shows primary/secondary
  // - 'unclassified': Too far from any palette color (ΔE > 12)
  classificationStatus: 'great' | 'good' | 'ambiguous' | 'unclassified';
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
 * Uses CIEDE2000 formula - the industry standard for perceptual color difference
 * 
 * CIEDE2000 is more accurate than CIE76 because it:
 * - Weighs lightness, chroma, and hue differently
 * - Accounts for human perception of saturated colors
 * - Handles near-neutral colors correctly
 * 
 * ΔE2000 interpretation:
 * - < 1: Not perceptible by human eyes
 * - 1-2: Perceptible through close observation
 * - 2-3.5: Perceptible at a glance (threshold for fashion)
 * - 3.5-5: Noticeable color difference
 * - > 5: Clearly different colors
 */
export function deltaE(lab1: Lab, lab2: Lab): number {
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
 * 12 Micro-Season Color Palettes
 * Each micro-season has its own palette with precomputed Lab values
 */
const MICRO_SEASON_PALETTE_RAW: Record<MicroSeason, RawSeasonPalette> = {
  // SPRING MICRO-SEASONS
  light_spring: {
    neutrals: [
      { name: "Cream", hex: "#F6E5C8" },
      { name: "Light Sand", hex: "#E9D7BA" },
      { name: "Pale Gold", hex: "#EED8AC" },
      { name: "Soft Beige", hex: "#E7D2B5" },
      { name: "Warm Ivory", hex: "#F8E7D2" },
    ],
    accents: [
      { name: "Light Apricot", hex: "#F6B98C" },
      { name: "Peach Sherbet", hex: "#F8C4A1" },
      { name: "Warm Watermelon", hex: "#F78578" },
      { name: "Soft Melon", hex: "#F4A67E" },
      { name: "Warm Pink (light)", hex: "#F6A5A1" },
    ],
    brights: [
      { name: "Warm Sky Blue", hex: "#8DD9FF" },
      { name: "Lemon Yellow", hex: "#FFE668" },
      { name: "Warm Mint", hex: "#B9F2D0" },
      { name: "Bright Coral Light", hex: "#FF8B6B" },
      { name: "Leaf Bud Green", hex: "#85D46A" },
    ],
    softs: [
      { name: "Soft Honey", hex: "#E9C892" },
      { name: "Warm Rose Petal", hex: "#EABFB3" },
      { name: "Pastel Coral (warm)", hex: "#F6B8A6" },
      { name: "Soft Aqua", hex: "#BFE8E2" },
      { name: "Faded Apricot (warm)", hex: "#F3CBB0" },
    ],
  },
  warm_spring: {
    neutrals: [
      { name: "Warm Almond", hex: "#E5C7A3" },
      { name: "Golden Beige", hex: "#D8B999" },
      { name: "Camel", hex: "#C69C6D" },
      { name: "Warm Sandstone", hex: "#D4B086" },
      { name: "Cream", hex: "#F6E5C8" },
    ],
    accents: [
      { name: "True Coral", hex: "#FF6F4E" },
      { name: "Apricot", hex: "#F5A26F" },
      { name: "Warm Tomato", hex: "#E2553F" },
      { name: "Golden Yellow", hex: "#F9CC4B" },
      { name: "Warm Teal", hex: "#26B7B2" },
    ],
    brights: [
      { name: "Bright Warm Pink", hex: "#FF7F7E" },
      { name: "Bright Turquoise", hex: "#1CDAD1" },
      { name: "Warm Lime Green", hex: "#97E04D" },
      { name: "Sunlit Yellow", hex: "#FFD23C" },
      { name: "Aqua Blue", hex: "#4ECDF5" },
    ],
    softs: [
      { name: "Soft Coral", hex: "#F4A490" },
      { name: "Soft Peach", hex: "#F4B899" },
      { name: "Warm Rose Soft", hex: "#EAA89B" },
      { name: "Soft Gold", hex: "#E9C27D" },
      { name: "Warm Sky Soft", hex: "#A5D3F2" },
    ],
  },
  bright_spring: {
    neutrals: [
      { name: "Warm Light Pebble", hex: "#E5D4C5" },
      { name: "Clear Camel", hex: "#C7A27A" },
      { name: "Golden Biscotti", hex: "#D0B48E" },
      { name: "Warm Oat", hex: "#E9D9C3" },
      { name: "Warm Cream", hex: "#F8E8D5" },
    ],
    accents: [
      { name: "Bright Coral", hex: "#FF6F4E" },
      { name: "Bright Warm Pink", hex: "#FF7A81" },
      { name: "Hot Warm Watermelon", hex: "#FF6F6A" },
      { name: "Warm Apricot Bold", hex: "#F4974E" },
      { name: "Bright Citrus", hex: "#FFC233" },
    ],
    brights: [
      { name: "Warm Aqua", hex: "#1CDAD1" },
      { name: "Tropical Turquoise", hex: "#07E7E0" },
      { name: "Leaf Lime Bright", hex: "#89F055" },
      { name: "Warm Electric Blue", hex: "#38B9FF" },
      { name: "Vivid Yellow", hex: "#FFDE36" },
    ],
    softs: [
      { name: "Soft Clear Coral", hex: "#F9A18D" },
      { name: "Fresh Peach", hex: "#F7BA97" },
      { name: "Soft Warm Lime", hex: "#C4EB7B" },
      { name: "Clear Sky Pastel", hex: "#AEE9FF" },
      { name: "Soft Citrus", hex: "#FFE29A" },
    ],
  },
  // SUMMER MICRO-SEASONS
  soft_summer: {
    neutrals: [
      { name: "Mushroom Grey", hex: "#B8AEA6" },
      { name: "Cool Stone", hex: "#C8C0BA" },
      { name: "Rose Grey", hex: "#C9B2B8" },
      { name: "Shadow Mauve", hex: "#BBAAB8" },
      { name: "Dusty Slate", hex: "#8997A1" },
    ],
    accents: [
      { name: "Muted Rose", hex: "#C69CA7" },
      { name: "Dusty Raspberry", hex: "#B47E8E" },
      { name: "Greyed Lavender", hex: "#B5A2C8" },
      { name: "Stormy Blue", hex: "#7890A8" },
      { name: "Muted Teal", hex: "#6C9CA3" },
    ],
    brights: [
      { name: "Blueberry Pink", hex: "#CB6A8C" },
      { name: "Soft Fuchsia", hex: "#CF7FB1" },
      { name: "Blue Orchid", hex: "#9DA3E4" },
      { name: "Lavender Mist", hex: "#CBB6E6" },
      { name: "Muted Aqua Bright", hex: "#86BFC0" },
    ],
    softs: [
      { name: "Heather Mauve", hex: "#C2A4B8" },
      { name: "Fog Blue", hex: "#9BB3C5" },
      { name: "Smoky Rose", hex: "#C09AA4" },
      { name: "Thistle", hex: "#CFBFCE" },
      { name: "Dusty Fern", hex: "#A2B7AA" },
    ],
  },
  cool_summer: {
    neutrals: [
      { name: "Blue Grey", hex: "#A7B5C9" },
      { name: "Ash Grey", hex: "#C6C7CD" },
      { name: "Soft Charcoal", hex: "#8A9097" },
      { name: "Rose Taupe", hex: "#BFA8A6" },
      { name: "Mauve Grey", hex: "#CDBCC7" },
    ],
    accents: [
      { name: "Cool Rose", hex: "#D28BA5" },
      { name: "Summer Berry", hex: "#B87391" },
      { name: "Lavender Smoke", hex: "#C6BADB" },
      { name: "Cool Periwinkle", hex: "#8596D5" },
      { name: "Dusty Aqua", hex: "#8DAEAE" },
    ],
    brights: [
      { name: "Cool Raspberry", hex: "#C95A7B" },
      { name: "Grape Bloom", hex: "#A462C4" },
      { name: "Clear Blue", hex: "#6DA9E9" },
      { name: "Lilac Ice", hex: "#C7B3F8" },
      { name: "Bright Orchid", hex: "#C56ECF" },
    ],
    softs: [
      { name: "Soft Plum", hex: "#A78B9F" },
      { name: "Soft Lilac", hex: "#C9BAD1" },
      { name: "Slate Blue", hex: "#8CA1BB" },
      { name: "Sea Mist", hex: "#ACC7C1" },
      { name: "Dusty Blue", hex: "#9EB1C6" },
    ],
  },
  light_summer: {
    neutrals: [
      { name: "Soft Pearl Grey", hex: "#DFDDE2" },
      { name: "Cool Oat", hex: "#E5DDD3" },
      { name: "Powder Pearl", hex: "#E8E1E7" },
      { name: "Blue Pearl", hex: "#DCE4EC" },
      { name: "Cloud Beige", hex: "#E8DED3" },
    ],
    accents: [
      { name: "Powder Pink", hex: "#E6C2CD" },
      { name: "Light Rose", hex: "#E3AFC2" },
      { name: "Lilac Mist", hex: "#DAD1EB" },
      { name: "Sky Violet", hex: "#C9CFF4" },
      { name: "Soft Iris", hex: "#C5C9EA" },
    ],
    brights: [
      { name: "Fresh Cool Pink", hex: "#EFA3C6" },
      { name: "Bright Lavender", hex: "#D4B6FF" },
      { name: "Clear Summer Blue", hex: "#98C4F7" },
      { name: "Summer Aqua", hex: "#A1E0EB" },
      { name: "Light Raspberry", hex: "#E5749D" },
    ],
    softs: [
      { name: "Soft Cloud Rose", hex: "#E6CDD8" },
      { name: "Hushed Mauve", hex: "#D9BFD2" },
      { name: "Pastel Periwinkle", hex: "#CED7F2" },
      { name: "Aqua Smoke", hex: "#CAE2DD" },
      { name: "Dusty Fern", hex: "#C0D4C6" },
    ],
  },
  // AUTUMN MICRO-SEASONS
  deep_autumn: {
    neutrals: [
      { name: "Espresso", hex: "#4B2E2A" },
      { name: "Deep Olive Brown", hex: "#574C35" },
      { name: "Bronze Brown", hex: "#6F4E37" },
      { name: "Coffee", hex: "#5C4033" },
      { name: "Dark Honey", hex: "#8B6C42" },
      { name: "Warm Charcoal", hex: "#4A403A" },
    ],
    accents: [
      { name: "Deep Teal", hex: "#0F4C48" },
      { name: "Pine Green", hex: "#1F4531" },
      { name: "Warm Burgundy", hex: "#6D2C3E" },
      { name: "Oxblood", hex: "#4A2128" },
      { name: "Copper Brown", hex: "#9C4F2B" },
      { name: "Red Earth", hex: "#A23520" },
    ],
    brights: [
      { name: "Deep Orange", hex: "#CF4A1F" },
      { name: "Flame", hex: "#D54A2A" },
      { name: "Bronze Gold", hex: "#CE8C2C" },
      { name: "Petrol Blue", hex: "#004F59" },
      { name: "Marigold Deep", hex: "#D97904" },
      { name: "Brick Red", hex: "#8F2E24" },
    ],
    softs: [
      { name: "Deep Clay", hex: "#985B45" },
      { name: "Dusty Rust", hex: "#A25C3E" },
      { name: "Warm Raisin", hex: "#6A3F3B" },
      { name: "Deep Tan", hex: "#8B6B50" },
      { name: "Moss", hex: "#6A6542" },
      { name: "Burnished Olive", hex: "#7D6C3C" },
    ],
  },
  soft_autumn: {
    neutrals: [
      { name: "Warm Taupe", hex: "#A28A7A" },
      { name: "Soft Olive", hex: "#8B8A6F" },
      { name: "Desert Sand", hex: "#C9B6A2" },
      { name: "Mushroom", hex: "#B7A89A" },
      { name: "Clay", hex: "#A67E6F" },
      { name: "Fawn", hex: "#D1B39A" },
    ],
    accents: [
      { name: "Soft Rust", hex: "#C6714F" },
      { name: "Muted Pumpkin", hex: "#D88A54" },
      { name: "Antique Moss", hex: "#9C8C45" },
      { name: "Deep Sage", hex: "#7C7B52" },
      { name: "Soft Teal", hex: "#62867D" },
      { name: "Muted Bronze", hex: "#896743" },
    ],
    brights: [
      { name: "Soft Salmon", hex: "#E28F73" },
      { name: "Warm Clay Rose", hex: "#CE7E6B" },
      { name: "Muted Apricot", hex: "#E7A47D" },
      { name: "Soft Burnt Sienna", hex: "#BB674A" },
      { name: "Gentle Teal", hex: "#4F6E65" },
      { name: "Weathered Copper", hex: "#A56F44" },
    ],
    softs: [
      { name: "Dusty Peach", hex: "#D8AA92" },
      { name: "Muted Coral", hex: "#D78F7A" },
      { name: "Muted Terracotta", hex: "#C5896B" },
      { name: "Dusty Rosewood", hex: "#A8746A" },
      { name: "Dusty Sage", hex: "#A9A577" },
      { name: "Muted Gold", hex: "#B59851" },
    ],
  },
  warm_autumn: {
    neutrals: [
      { name: "Camel", hex: "#C19A6B" },
      { name: "Warm Khaki", hex: "#B89B72" },
      { name: "Golden Beige", hex: "#D9BB8C" },
      { name: "Saddle Brown", hex: "#8B5A32" },
      { name: "Mahogany", hex: "#7A3F20" },
      { name: "Warm Stone", hex: "#A9987A" },
    ],
    accents: [
      { name: "Burnt Orange", hex: "#CC5500" },
      { name: "Rust", hex: "#B7410E" },
      { name: "Paprika", hex: "#C24C1B" },
      { name: "Avocado", hex: "#7B8C42" },
      { name: "Teal", hex: "#317873" },
      { name: "Warm Gold", hex: "#D4A017" },
    ],
    brights: [
      { name: "Bright Copper", hex: "#C97450" },
      { name: "Warm Poppy", hex: "#E85C41" },
      { name: "Golden Amber", hex: "#D9922E" },
      { name: "Pumpkin", hex: "#ED7422" },
      { name: "Peacock Teal", hex: "#0F6B63" },
      { name: "Henna", hex: "#A13E1F" },
    ],
    softs: [
      { name: "Muted Brick", hex: "#B05F3C" },
      { name: "Honey Brown", hex: "#BB7C41" },
      { name: "Warm Clay", hex: "#B8734E" },
      { name: "Soft Mustard", hex: "#C2A247" },
      { name: "Muted Olive", hex: "#8E8748" },
      { name: "Burnt Saffron", hex: "#D29C52" },
    ],
  },
  // WINTER MICRO-SEASONS
  bright_winter: {
    neutrals: [
      { name: "Sharp White", hex: "#FFFFFF" },
      { name: "Steel Grey", hex: "#BCC3CC" },
      { name: "Ink Black", hex: "#0B0D0F" },
      { name: "Granite Grey", hex: "#5A6470" },
      { name: "Ice Pewter", hex: "#D8DEE6" },
    ],
    accents: [
      { name: "Pure Red", hex: "#E6002E" },
      { name: "Hot Pink", hex: "#FF0E8C" },
      { name: "Bright Cyan", hex: "#02C9FF" },
      { name: "Royal Purple", hex: "#8020FF" },
      { name: "Vivid Indigo", hex: "#2933FF" },
    ],
    brights: [
      { name: "Neon Magenta", hex: "#FB00C9" },
      { name: "Electric Purple", hex: "#A500FF" },
      { name: "Ice Lemon", hex: "#F6F66E" },
      { name: "Laser Blue", hex: "#00A4FE" },
      { name: "Vivid Turquoise", hex: "#14E4DA" },
    ],
    softs: [
      { name: "Soft Cool Pink", hex: "#EFB1D9" },
      { name: "Icy Mauve", hex: "#CDB4E6" },
      { name: "Soft Blue Ice", hex: "#BFD6F4" },
      { name: "Frost Mint", hex: "#D4F4EE" },
      { name: "Light Berry Mist", hex: "#E8C7D9" },
    ],
  },
  cool_winter: {
    neutrals: [
      { name: "True White", hex: "#FFFFFF" },
      { name: "Concord Grey", hex: "#B9BCC2" },
      { name: "Jet Black", hex: "#0A0A0A" },
      { name: "Slate Black", hex: "#181C25" },
      { name: "Silver Grey", hex: "#CED3D9" },
    ],
    accents: [
      { name: "Blue-Red", hex: "#C40033" },
      { name: "Fuchsia", hex: "#D1008F" },
      { name: "Royal Blue", hex: "#2141A9" },
      { name: "Blue Violet", hex: "#6E40C9" },
      { name: "Berry Red", hex: "#B11255" },
    ],
    brights: [
      { name: "Bright Magenta", hex: "#E000BA" },
      { name: "Electric Blue", hex: "#0097F5" },
      { name: "Icy Pink", hex: "#F3D1E6" },
      { name: "Daffodil Ice", hex: "#F8F885" },
      { name: "Arctic Teal", hex: "#41D6D1" },
    ],
    softs: [
      { name: "Icy Lilac", hex: "#D9D1F4" },
      { name: "Frost Blue", hex: "#C3D3EA" },
      { name: "Cool Rose Ice", hex: "#E7C6D8" },
      { name: "Pale Berry", hex: "#DABEC9" },
      { name: "Muted Azure", hex: "#A9C0D9" },
    ],
  },
  deep_winter: {
    neutrals: [
      { name: "Black Brown", hex: "#281F24" },
      { name: "Deep Charcoal", hex: "#2F333A" },
      { name: "Blue Black", hex: "#101820" },
      { name: "Stone Grey", hex: "#A7A9AC" },
      { name: "Ink Navy", hex: "#142033" },
    ],
    accents: [
      { name: "Deep Magenta", hex: "#B70072" },
      { name: "Blood Red", hex: "#9C002B" },
      { name: "Midnight Blue", hex: "#14247E" },
      { name: "Deep Purple", hex: "#4B0082" },
      { name: "Emerald Jewel", hex: "#0C6B5E" },
    ],
    brights: [
      { name: "Bright Raspberry", hex: "#E10086" },
      { name: "Vivid Aubergine", hex: "#8414A3" },
      { name: "Crystal Blue", hex: "#0D9AF0" },
      { name: "Lemon Ice", hex: "#F6F47B" },
      { name: "Bright Teal", hex: "#00B7B3" },
    ],
    softs: [
      { name: "Plum Smoke", hex: "#BDA1BE" },
      { name: "Frosted Wine", hex: "#C8A0B0" },
      { name: "Grape Mist", hex: "#B8A3D1" },
      { name: "Slate Blue Soft", hex: "#7C8AA8" },
      { name: "Wintermint Soft", hex: "#CAE6E3" },
    ],
  },
};

/**
 * Precompute Lab values for all micro-season palette colors
 * This is done once at module load for performance
 */
function precomputeMicroSeasonPaletteLab(): FullMicroSeasonPalette {
  const palette: FullMicroSeasonPalette = {};
  
  for (const microSeason of Object.keys(MICRO_SEASON_PALETTE_RAW) as MicroSeason[]) {
    const parentSeason = MICRO_TO_PARENT[microSeason];
    const rawPalette = MICRO_SEASON_PALETTE_RAW[microSeason];
    
    palette[microSeason] = {
      microSeason,
      parentSeason,
      neutrals: rawPalette.neutrals.map(color => {
        const lab = hexToLab(color.hex);
        if (!lab) {
          throw new Error(`Failed to compute Lab for ${color.name} (${color.hex})`);
        }
        return { name: color.name, hex: color.hex, lab };
      }),
      accents: rawPalette.accents.map(color => {
        const lab = hexToLab(color.hex);
        if (!lab) {
          throw new Error(`Failed to compute Lab for ${color.name} (${color.hex})`);
        }
        return { name: color.name, hex: color.hex, lab };
      }),
      brights: rawPalette.brights.map(color => {
        const lab = hexToLab(color.hex);
        if (!lab) {
          throw new Error(`Failed to compute Lab for ${color.name} (${color.hex})`);
        }
        return { name: color.name, hex: color.hex, lab };
      }),
      softs: rawPalette.softs.map(color => {
        const lab = hexToLab(color.hex);
        if (!lab) {
          throw new Error(`Failed to compute Lab for ${color.name} (${color.hex})`);
        }
        return { name: color.name, hex: color.hex, lab };
      }),
    };
  }
  
  return palette;
}

// Precomputed micro-season palette (computed once at module load)
export const MICRO_SEASON_PALETTE: FullMicroSeasonPalette = precomputeMicroSeasonPaletteLab();

// Legacy PALETTE for backward compatibility (aggregates by parent season)
function createLegacyPalette(): FullPalette {
  const palette: FullPalette = {
    spring: { neutrals: [], accents: [], brights: [], softs: [] },
    summer: { neutrals: [], accents: [], brights: [], softs: [] },
    autumn: { neutrals: [], accents: [], brights: [], softs: [] },
    winter: { neutrals: [], accents: [], brights: [], softs: [] },
  };
  
  // Aggregate all micro-seasons into parent seasons
  for (const microSeason of Object.keys(MICRO_SEASON_PALETTE) as MicroSeason[]) {
    const parentSeason = MICRO_TO_PARENT[microSeason];
    const microPalette = MICRO_SEASON_PALETTE[microSeason];
    
    // Combine all colors from micro-seasons (may have duplicates, but that's okay)
    palette[parentSeason].neutrals.push(...microPalette.neutrals);
    palette[parentSeason].accents.push(...microPalette.accents);
    palette[parentSeason].brights.push(...microPalette.brights);
    palette[parentSeason].softs.push(...microPalette.softs);
  }
  
  return palette;
}

export const PALETTE: FullPalette = createLegacyPalette();

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

/**
 * Classify a garment color into micro-season + category
 * 
 * Algorithm:
 * 1. Convert input hex → Lab
 * 2. Compare to ALL palette colors across all micro-seasons
 * 3. Find best match (minimum ΔE)
 * 4. Apply gating:
 *    - If minDeltaE > 12 → unclassified
 *    - If (runnerUpDeltaE - bestDeltaE) < 2 → ambiguous
 * 5. Return classification result with micro-season and parent season
 * 
 * @param hex - Input color hex code (e.g., "#FF6F61")
 * @returns ClassificationResult with microSeason, parent season, group, and metadata
 */
export function classifyGarment(hex: string): ClassificationResult {
  // Convert input hex to Lab
  const inputLab = hexToLab(hex);
  if (!inputLab) {
    return {
      microSeasonTag: null,
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: { L: 0, a: 0, b: 0 },
      nearestPaletteColor: null,
      minDeltaE: null,
      classificationStatus: 'unclassified',
    };
  }
  
  // Track best matches across all micro-seasons and groups
  let bestMatch: {
    microSeason: MicroSeason;
    group: 'neutrals' | 'accents' | 'brights' | 'softs';
    color: PaletteColor;
    deltaE: number;
  } | null = null;
  
  let runnerUpMatch: {
    microSeason: MicroSeason;
    group: 'neutrals' | 'accents' | 'brights' | 'softs';
    color: PaletteColor;
    deltaE: number;
  } | null = null;
  
  // Compare against all micro-season palette colors
  for (const microSeason of Object.keys(MICRO_SEASON_PALETTE) as MicroSeason[]) {
    const palette = MICRO_SEASON_PALETTE[microSeason];
    for (const group of ['neutrals', 'accents', 'brights', 'softs'] as const) {
      for (const paletteColor of palette[group]) {
        const dE = deltaE(inputLab, paletteColor.lab);
        
        // Update best match
        if (!bestMatch || dE < bestMatch.deltaE) {
          runnerUpMatch = bestMatch;
          bestMatch = {
            microSeason,
            group,
            color: paletteColor,
            deltaE: dE,
          };
        } else if (!runnerUpMatch || dE < runnerUpMatch.deltaE) {
          // Update runner-up (must be from different micro-season or group)
          if (bestMatch.microSeason !== microSeason || bestMatch.group !== group) {
            runnerUpMatch = {
              microSeason,
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
      microSeasonTag: null,
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: inputLab,
      nearestPaletteColor: null,
      minDeltaE: null,
      secondaryMicroSeasonTag: null,
      secondarySeasonTag: null,
      secondaryGroupTag: null,
      secondaryDeltaE: null,
      classificationStatus: 'unclassified',
    };
  }
  
  // Gate 1: If minDeltaE > 12, color is too far from any palette color
  if (bestMatch.deltaE > 12) {
    return {
      microSeasonTag: null,
      seasonTag: null,
      groupTag: null,
      dominantHex: hex,
      lab: inputLab,
      nearestPaletteColor: {
        name: bestMatch.color.name,
        hex: bestMatch.color.hex,
      },
      minDeltaE: bestMatch.deltaE,
      secondaryMicroSeasonTag: null,
      secondarySeasonTag: null,
      secondaryGroupTag: null,
      secondaryDeltaE: null,
      classificationStatus: 'unclassified',
    };
  }
  
  // Calculate primary season info
  const primaryParentSeason = MICRO_TO_PARENT[bestMatch.microSeason];
  
  // Calculate secondary season info (if runner-up exists and is within 10 ΔE)
  // Only include secondary if it's from a DIFFERENT parent season
  let secondaryMicroSeasonTag: MicroSeason | null = null;
  let secondarySeasonTag: ParentSeason | null = null;
  let secondaryGroupTag: 'neutrals' | 'accents' | 'brights' | 'softs' | null = null;
  let secondaryDeltaE: number | null = null;
  
  if (runnerUpMatch && runnerUpMatch.deltaE <= 10) {
    const runnerUpParentSeason = MICRO_TO_PARENT[runnerUpMatch.microSeason];
    // Only add secondary if it's a different parent season (crossover)
    if (runnerUpParentSeason !== primaryParentSeason) {
      secondaryMicroSeasonTag = runnerUpMatch.microSeason;
      secondarySeasonTag = runnerUpParentSeason;
      secondaryGroupTag = runnerUpMatch.group;
      secondaryDeltaE = runnerUpMatch.deltaE;
    }
  }
  
  // Determine classification status based on ΔE gap
  let classificationStatus: 'great' | 'good' | 'ambiguous';
  const deltaEGap = runnerUpMatch ? (runnerUpMatch.deltaE - bestMatch.deltaE) : Infinity;
  
  if (deltaEGap < 2) {
    // Very close to runner-up - ambiguous but still usable
    classificationStatus = 'ambiguous';
  } else if (deltaEGap < 4) {
    // Decent gap - good match
    classificationStatus = 'good';
  } else {
    // Strong gap - great match
    classificationStatus = 'great';
  }
  
  return {
    microSeasonTag: bestMatch.microSeason,
    seasonTag: primaryParentSeason,
    groupTag: bestMatch.group,
    dominantHex: hex,
    lab: inputLab,
    nearestPaletteColor: {
      name: bestMatch.color.name,
      hex: bestMatch.color.hex,
    },
    minDeltaE: bestMatch.deltaE,
    secondaryMicroSeasonTag,
    secondarySeasonTag,
    secondaryGroupTag,
    secondaryDeltaE,
    classificationStatus,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine micro-season from user's parent season, depth, and clarity
 * This is used internally to match products to the correct micro-season palette
 * 
 * @param parentSeason - Parent season (spring, summer, autumn, winter)
 * @param depth - Depth (light, medium, deep)
 * @param clarity - Clarity (muted, clear, vivid)
 * @returns MicroSeason or null if cannot determine
 */
export function determineMicroSeason(
  parentSeason: ParentSeason,
  depth?: 'light' | 'medium' | 'deep' | null,
  clarity?: 'muted' | 'clear' | 'vivid' | 'medium' | null,
  undertone?: 'warm' | 'cool' | 'neutral' | null
): MicroSeason | null {
  if (!parentSeason) return null;
  
  // Default mappings based on parent season
  const defaultMicroSeasons: Record<ParentSeason, MicroSeason> = {
    spring: 'warm_spring',
    summer: 'cool_summer',
    autumn: 'warm_autumn',
    winter: 'cool_winter',
  };
  
  // If no depth/clarity, use default
  if (!depth && !clarity) {
    return defaultMicroSeasons[parentSeason];
  }
  
  // Normalize clarity: treat 'vivid' as 'clear' for micro-season determination
  const normalizedClarity = clarity === 'vivid' ? 'clear' : clarity;
  
  // SPRING micro-season determination
  if (parentSeason === 'spring') {
    // Light Spring: light depth
    if (depth === 'light') return 'light_spring';
    // Bright Spring: clear clarity
    if (normalizedClarity === 'clear') return 'bright_spring';
    // Warm Spring: default for spring
    return 'warm_spring';
  }
  
  // SUMMER micro-season determination
  if (parentSeason === 'summer') {
    // Light Summer: light depth
    if (depth === 'light') return 'light_summer';
    // Soft Summer: muted clarity
    if (normalizedClarity === 'muted') return 'soft_summer';
    // Cool Summer: default for summer
    return 'cool_summer';
  }
  
  // AUTUMN micro-season determination
  if (parentSeason === 'autumn') {
    // Soft Autumn: muted clarity (checked first per spec)
    if (normalizedClarity === 'muted') return 'soft_autumn';
    // Deep Autumn: deep depth
    if (depth === 'deep') return 'deep_autumn';
    // Warm Autumn: warm undertone AND medium clarity, or default
    if (undertone === 'warm' && normalizedClarity === 'medium') return 'warm_autumn';
    return 'warm_autumn';
  }
  
  // WINTER micro-season determination
  if (parentSeason === 'winter') {
    // Bright Winter: clear clarity (checked first per spec)
    if (normalizedClarity === 'clear') return 'bright_winter';
    // Deep Winter: cool undertone AND deep depth
    if (undertone === 'cool' && depth === 'deep') return 'deep_winter';
    // Cool Winter: default for winter
    return 'cool_winter';
  }
  
  return defaultMicroSeasons[parentSeason];
}

/**
 * Get micro-season palette by micro-season name
 */
export function getMicroSeasonPalette(microSeason: MicroSeason): MicroSeasonPalette | null {
  return MICRO_SEASON_PALETTE[microSeason] || null;
}

/**
 * Get all micro-seasons for a parent season
 */
export function getMicroSeasonsForParent(parentSeason: ParentSeason): MicroSeason[] {
  return (Object.keys(MICRO_TO_PARENT) as MicroSeason[]).filter(
    micro => MICRO_TO_PARENT[micro] === parentSeason
  );
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
  MICRO_SEASON_PALETTE,
  determineMicroSeason,
  getMicroSeasonPalette,
  getMicroSeasonsForParent,
  MICRO_TO_PARENT,
  MICRO_SEASON_NAMES,
};
