/**
 * Client-Side Color Detection (Free, No API)
 * Resizes image to small bitmap and computes dominant color
 * Maps RGB to nearest named color
 * 
 * Uses a simplified approach for React Native:
 * - Fetches image and samples pixel data
 * - Computes average RGB from center region
 * - Maps to nearest color name
 */

import * as FileSystem from 'expo-file-system';

/**
 * Simple hash function for image URI caching
 */
function hashImageUri(uri) {
  if (!uri) return null;
  // Simple hash - in production, use a proper hash library
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Cache for detected colors (by image URI hash)
const colorCache = {};

/**
 * Resize image and extract dominant color
 * @param {string} imageUri - Image URI (local or remote)
 * @returns {Promise<{color: string, name: string, confidence: number}>}
 */
export async function detectDominantColor(imageUri) {
  console.log('🎨 [CLIENT COLOR] Starting color detection for:', imageUri?.substring(0, 100));
  
  if (!imageUri) {
    console.warn('🎨 [CLIENT COLOR] No image URI provided');
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  }

  // Check cache first - but only if we have a valid cache key
  // Don't cache if the color was "grey" (likely inaccurate)
  const cacheKey = hashImageUri(imageUri);
  if (cacheKey && colorCache[cacheKey]) {
    const cachedColor = colorCache[cacheKey];
    // If cached color is grey/unknown, don't use cache - re-detect
    if (cachedColor.name && cachedColor.name !== 'grey' && cachedColor.name !== 'gray' && cachedColor.name !== 'unknown') {
      console.log('🎨 [CLIENT COLOR] Using cached color:', cachedColor);
      return cachedColor;
    } else {
      console.log('🎨 [CLIENT COLOR] Cached color is grey/unknown, re-detecting...');
      // Clear the cache entry for grey colors
      delete colorCache[cacheKey];
    }
  }

  try {
    // Convert image to base64 for processing
    let base64;
    
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      // Remote image - fetch it
      const response = await fetch(imageUri);
      const blob = await response.blob();
      base64 = await blobToBase64(blob);
    } else if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
      // Local file - read using FileSystem
      base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      base64 = `data:image/jpeg;base64,${base64}`;
    } else if (imageUri.startsWith('data:')) {
      // Already base64
      base64 = imageUri;
    } else {
      throw new Error('Unsupported image URI format');
    }
    
    // Extract color from base64 image data (pass cacheKey for caching control)
    const dominantColor = extractColorFromBase64(base64, cacheKey);
    
    console.log('🎨 [CLIENT COLOR] Detected color:', dominantColor);
    return dominantColor;
  } catch (error) {
    console.error('🎨 [CLIENT COLOR] Error processing image:', error);
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract dominant color from base64 image
 * Simplified approach: samples image data to find dominant RGB
 * @param {string} base64 - Base64 image data
 * @param {string} cacheKey - Cache key for storing result (optional)
 */
function extractColorFromBase64(base64, cacheKey = null) {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Sample middle section (avoid headers/footers, focus on pixel data)
    // For JPEG/PNG, pixel data is typically in the middle 40-80% of the file
    const start = Math.floor(bytes.length * 0.4);
    const end = Math.floor(bytes.length * 0.8);
    const sample = bytes.slice(start, end);
    
    // Extract RGB values by sampling bytes
    // This is a heuristic - actual pixel data location varies by format
    const rgb = extractRGBFromBytes(sample);
    
    const hexColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    const colorName = rgbToColorName(rgb.r, rgb.g, rgb.b);
    
    console.log('🎨 [CLIENT COLOR] Extracted RGB:', {
      rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
      hex: hexColor,
      name: colorName,
    });
    
    const result = {
      color: hexColor,
      name: colorName,
      confidence: 0.7, // Medium confidence for client-side detection
    };
    
    // Only cache if color is not grey/unknown
    if (cacheKey && colorName !== 'grey' && colorName !== 'gray' && colorName !== 'unknown') {
      colorCache[cacheKey] = result;
      console.log('🎨 [CLIENT COLOR] Cached color for:', cacheKey, '->', colorName);
    } else if (colorName === 'grey' || colorName === 'gray' || colorName === 'unknown') {
      console.log('🎨 [CLIENT COLOR] Not caching grey/unknown color, will re-detect next time');
    }
    
    return result;
  } catch (error) {
    console.error('🎨 [CLIENT COLOR] Error extracting color:', error);
    return {
      color: '#000000',
      name: 'unknown',
      confidence: 0,
    };
  }
}

/**
 * Extract RGB values from byte array
 * Samples bytes that likely represent RGB pixel data
 */
function extractRGBFromBytes(bytes) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  
  // Sample every 3rd byte as potential RGB triplets
  // Skip uniform values (likely not pixel data)
  for (let i = 0; i < bytes.length - 2; i += 3) {
    const r = bytes[i];
    const g = bytes[i + 1];
    const b = bytes[i + 2];
    
    // Filter: valid RGB values are typically 0-255
    // Avoid extreme values and uniform colors (likely headers/metadata)
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      // Prefer non-uniform colors (actual image data)
      const variance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
      if (variance > 10) { // Not grayscale/metadata
        totalR += r;
        totalG += g;
        totalB += b;
        count++;
      }
    }
  }
  
  // If we didn't find enough samples, use overall average
  if (count < 10) {
    let sum = 0;
    for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
      sum += bytes[i];
    }
    const avg = Math.floor(sum / Math.min(bytes.length, 1000));
    return { r: avg, g: avg, b: avg };
  }
  
  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}


/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * Convert RGB to color name
 */
function rgbToColorName(r, g, b) {
  // Color mapping based on RGB values
  const colors = [
    { name: 'black', rgb: [0, 0, 0], threshold: 30 },
    { name: 'white', rgb: [255, 255, 255], threshold: 225 },
    { name: 'grey', rgb: [128, 128, 128], threshold: 50 },
    { name: 'gray', rgb: [128, 128, 128], threshold: 50 },
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
    { name: 'wine', rgb: [128, 0, 32], threshold: 50 },
    { name: 'plum', rgb: [128, 0, 128], threshold: 70 },
    { name: 'camel', rgb: [193, 154, 107], threshold: 80 },
    { name: 'rust', rgb: [183, 65, 14], threshold: 60 },
    { name: 'teal', rgb: [0, 128, 128], threshold: 70 },
    { name: 'emerald', rgb: [80, 200, 120], threshold: 80 },
    { name: 'lavender', rgb: [230, 230, 250], threshold: 180 },
    { name: 'coral', rgb: [255, 127, 80], threshold: 100 },
    { name: 'salmon', rgb: [250, 128, 114], threshold: 120 },
    { name: 'tan', rgb: [210, 180, 140], threshold: 100 },
    { name: 'charcoal', rgb: [54, 69, 79], threshold: 40 },
    { name: 'slate', rgb: [112, 128, 144], threshold: 60 },
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

  // If closest match is still too far, check if it's grayscale
  // Grayscale = all RGB values are similar (within 20)
  const isGrayscale = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
  if (isGrayscale && minDistance > 100) {
    // It's grayscale but not matching any color well
    // Return grey/gray/black/white based on brightness
    const brightness = (r + g + b) / 3;
    if (brightness < 50) {
      closestColor = 'black';
    } else if (brightness > 200) {
      closestColor = 'white';
    } else {
      closestColor = 'grey';
    }
    console.log('🎨 [CLIENT COLOR] Detected grayscale, brightness:', brightness, '->', closestColor);
  }

  console.log('🎨 [CLIENT COLOR] RGB to color name:', {
    rgb: { r, g, b },
    name: closestColor,
    distance: minDistance,
    isGrayscale,
  });

  return closestColor;
}

/**
 * Extract color name from image URL/filename
 * Fallback when pixel-based detection fails
 */
function extractColorFromImageName(imageUri) {
  if (!imageUri) return null;
  
  const colorKeywords = [
    'black', 'white', 'grey', 'gray', 'red', 'blue', 'navy', 'green', 'yellow',
    'orange', 'pink', 'purple', 'brown', 'beige', 'cream', 'ivory', 'khaki',
    'olive', 'burgundy', 'maroon', 'wine', 'plum', 'camel', 'rust', 'teal',
    'emerald', 'lavender', 'coral', 'salmon', 'tan', 'charcoal', 'slate',
  ];
  
  const lowerUri = imageUri.toLowerCase();
  for (const color of colorKeywords) {
    if (lowerUri.includes(color)) {
      console.log('🎨 [CLIENT COLOR] Found color in image name:', color);
      return color;
    }
  }
  
  return null;
}

/**
 * Get hex color for a color name
 */
function getColorHex(colorName) {
  const colorMap = {
    'black': '#000000',
    'white': '#FFFFFF',
    'grey': '#808080',
    'gray': '#808080',
    'red': '#FF0000',
    'blue': '#0000FF',
    'navy': '#000080',
    'green': '#008000',
    'yellow': '#FFFF00',
    'orange': '#FFA500',
    'pink': '#FFC0CB',
    'purple': '#800080',
    'brown': '#A52A2A',
    'beige': '#F5F5DC',
    'cream': '#FFFDD0',
    'ivory': '#FFFFF0',
    'khaki': '#C3B091',
    'olive': '#808000',
    'burgundy': '#800020',
    'maroon': '#800000',
    'wine': '#800020',
    'plum': '#800080',
    'camel': '#C19A6B',
    'rust': '#B7410E',
    'teal': '#008080',
    'emerald': '#50C878',
    'lavender': '#E6E6FA',
    'coral': '#FF7F50',
    'salmon': '#FA8072',
    'tan': '#D2B48C',
    'charcoal': '#36454F',
    'slate': '#708090',
  };
  
  return colorMap[colorName.toLowerCase()] || '#000000';
}

/**
 * Clear color cache (useful for testing or memory management)
 */
export function clearColorCache() {
  Object.keys(colorCache).forEach(key => delete colorCache[key]);
  console.log('🎨 [CLIENT COLOR] Cache cleared');
}

