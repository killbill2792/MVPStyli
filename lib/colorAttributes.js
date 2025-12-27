/**
 * Color Attributes System
 * Computes color attributes from hex for accurate color analysis
 * Replaces string-based color matching with attribute-based logic
 */

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
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
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: h * 360, // 0-360
    s: s, // 0-1
    l: l // 0-1
  };
}

/**
 * Compute color attributes from hex
 * Returns: { hex, hue, lightness, saturation, temperature, clarity }
 */
export function colorAttributesFromHex(hex) {
  if (!hex) return null;
  
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const { r, g, b } = rgb;
  const hsl = rgbToHsl(r, g, b);
  const { h: hue, s: saturation, l: lightness } = hsl;
  
  // Determine temperature (warm/cool/neutral)
  let temperature = 'neutral';
  
  // Warm hues: red (0-60), yellow (60-90), orange (15-45)
  // Also includes warm purples/plums (270-330) when saturation is high
  if (hue >= 0 && hue < 90) {
    temperature = 'warm';
  } else if (hue >= 90 && hue < 180) {
    // Green range - can be warm (olive/sage) or cool (emerald/mint)
    // If saturation is low, it's more neutral/warm (olive)
    // If saturation is high, it's more cool (emerald)
    if (saturation < 0.4) {
      temperature = 'warm'; // olive, sage
    } else {
      temperature = 'cool'; // emerald, mint
    }
  } else if (hue >= 180 && hue < 270) {
    // Blue/cyan range - cool
    temperature = 'cool';
  } else if (hue >= 270 && hue < 360) {
    // Purple/magenta range
    // Warm purples (burgundy, plum) vs cool purples (lavender, periwinkle)
    if (hue >= 270 && hue < 300 && saturation > 0.5) {
      temperature = 'warm'; // burgundy, plum, wine
    } else {
      temperature = 'cool'; // lavender, periwinkle, violet
    }
  }
  
  // If saturation is very low, it's neutral regardless of hue
  if (saturation < 0.15) {
    temperature = 'neutral';
  }
  
  // Determine clarity (muted/clear/vivid)
  let clarity = 'muted';
  
  if (saturation < 0.3) {
    clarity = 'muted'; // Low saturation = muted
  } else if (saturation >= 0.3 && saturation < 0.7) {
    clarity = 'clear'; // Medium saturation = clear
  } else {
    clarity = 'vivid'; // High saturation = vivid
  }
  
  // Special case: very light or very dark colors are often considered muted
  if (lightness < 0.15 || lightness > 0.85) {
    if (saturation < 0.5) {
      clarity = 'muted';
    }
  }
  
  return {
    hex,
    hue, // 0-360
    lightness, // 0-1
    saturation, // 0-1 (chroma)
    temperature, // 'warm' | 'cool' | 'neutral'
    clarity, // 'muted' | 'clear' | 'vivid'
  };
}

/**
 * Get a human-readable color name from hex (for UI display only)
 * This is NOT used for logic, only for showing users a friendly name
 */
export function colorNameFromHex(hex) {
  const attrs = colorAttributesFromHex(hex);
  if (!attrs) return 'unknown';
  
  const { hue, lightness, saturation, temperature } = attrs;
  
  // Very dark (black)
  if (lightness < 0.15 && saturation < 0.2) return 'black';
  
  // Very light (white/cream)
  if (lightness > 0.9 && saturation < 0.2) return 'white';
  
  // Grey scale
  if (saturation < 0.15) {
    if (lightness < 0.3) return 'charcoal';
    if (lightness < 0.5) return 'grey';
    if (lightness < 0.7) return 'light grey';
    return 'silver';
  }
  
  // Color names based on hue and attributes
  if (hue >= 0 && hue < 15) {
    if (lightness < 0.3) return 'burgundy';
    if (lightness < 0.5) return 'red';
    return 'coral';
  }
  
  if (hue >= 15 && hue < 45) {
    if (lightness < 0.4) return 'rust';
    if (lightness < 0.6) return 'orange';
    return 'peach';
  }
  
  if (hue >= 45 && hue < 60) {
    if (lightness < 0.5) return 'olive';
    return 'yellow';
  }
  
  if (hue >= 60 && hue < 150) {
    if (temperature === 'warm') {
      if (lightness < 0.4) return 'sage';
      return 'olive';
    }
    if (lightness < 0.4) return 'forest green';
    if (lightness < 0.6) return 'emerald';
    return 'mint';
  }
  
  if (hue >= 150 && hue < 210) {
    if (lightness < 0.4) return 'teal';
    if (lightness < 0.6) return 'turquoise';
    return 'aqua';
  }
  
  if (hue >= 210 && hue < 270) {
    if (lightness < 0.3) return 'navy';
    if (lightness < 0.5) return 'blue';
    if (lightness < 0.7) return 'sky blue';
    return 'baby blue';
  }
  
  if (hue >= 270 && hue < 300) {
    if (temperature === 'warm') {
      if (lightness < 0.4) return 'plum';
      return 'burgundy';
    }
    if (lightness < 0.5) return 'purple';
    return 'lavender';
  }
  
  if (hue >= 300 && hue < 360) {
    if (lightness < 0.5) return 'magenta';
    if (lightness < 0.7) return 'pink';
    return 'blush';
  }
  
  // Fallback based on temperature
  if (temperature === 'warm') {
    if (lightness < 0.4) return 'brown';
    if (lightness < 0.6) return 'camel';
    return 'beige';
  }
  
  if (temperature === 'cool') {
    if (lightness < 0.4) return 'slate';
    if (lightness < 0.6) return 'blue-grey';
    return 'ice';
  }
  
  return 'unknown';
}

