/**
 * Measurement Utilities
 * Handles conversion between inches and cm, and formatting
 */

/**
 * Convert inches to cm
 */
export function inchesToCm(inches) {
  if (inches == null || isNaN(inches)) return null;
  return Number(inches) * 2.54;
}

/**
 * Convert cm to inches
 */
export function cmToInches(cm) {
  if (cm == null || isNaN(cm)) return null;
  return Number(cm) / 2.54;
}

/**
 * Convert a value to inches, handling both cm and inches input
 * @param {number|string} value - The measurement value
 * @param {string} inputUnit - 'in' or 'cm'
 * @returns {number|null} - Value in inches
 */
export function toInches(value, inputUnit) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) return null;
  
  if (inputUnit === 'cm') {
    return cmToInches(num);
  }
  // Already in inches
  return num;
}

/**
 * Format inches as a fraction string (e.g., "1 1/2" instead of "1.5")
 * @param {number} inches - Measurement in inches
 * @param {number} precision - Precision in eighths (8 = 1/8", 4 = 1/4", 2 = 1/2")
 * @returns {string} - Formatted string like "1 1/2 in" or "3/4 in"
 */
export function formatInchesAsFraction(inches, precision = 8) {
  if (inches == null || isNaN(inches)) return '';
  
  const whole = Math.floor(inches);
  const fraction = inches - whole;
  
  if (fraction === 0) {
    return `${whole} in`;
  }
  
  // Convert fraction to nearest precision
  const fractionParts = Math.round(fraction * precision);
  
  if (fractionParts === 0) {
    return `${whole} in`;
  }
  
  if (fractionParts === precision) {
    return `${whole + 1} in`;
  }
  
  // Simplify fraction
  let num = fractionParts;
  let den = precision;
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  
  if (whole === 0) {
    return `${num}/${den} in`;
  }
  
  return `${whole} ${num}/${den} in`;
}

/**
 * Format inches for display (with unit toggle support)
 * @param {number} inches - Measurement in inches
 * @param {string} displayUnit - 'in' or 'cm'
 * @param {boolean} useFraction - Whether to use fraction formatting for inches
 * @returns {string} - Formatted string
 */
export function formatMeasurement(inches, displayUnit = 'in', useFraction = true) {
  if (inches == null || isNaN(inches)) return '';
  
  if (displayUnit === 'cm') {
    const cm = inchesToCm(inches);
    return `${cm.toFixed(1)} cm`;
  }
  
  if (useFraction) {
    return formatInchesAsFraction(inches);
  }
  
  return `${inches.toFixed(2)} in`;
}

/**
 * Parse a measurement string (handles "1 1/2", "1.5", "3/4", etc.)
 * @param {string} str - Measurement string
 * @returns {number|null} - Value in inches, or null if invalid
 */
export function parseMeasurement(str) {
  if (!str || typeof str !== 'string') return null;
  
  const trimmed = str.trim();
  if (!trimmed) return null;
  
  // Handle fraction format: "1 1/2" or "3/4"
  const fractionMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/); // "1 1/2"
  if (fractionMatch) {
    const whole = Number(fractionMatch[1]);
    const num = Number(fractionMatch[2]);
    const den = Number(fractionMatch[3]);
    return whole + (num / den);
  }
  
  const simpleFractionMatch = trimmed.match(/^(\d+)\/(\d+)$/); // "3/4"
  if (simpleFractionMatch) {
    const num = Number(simpleFractionMatch[1]);
    const den = Number(simpleFractionMatch[2]);
    return num / den;
  }
  
  // Handle decimal
  const num = Number(trimmed);
  if (!isNaN(num)) return num;
  
  return null;
}

/**
 * Parse height string to total inches
 * Handles multiple formats:
 * - "5.4" -> 5 feet 4 inches = 64 inches
 * - "5'4" -> 5 feet 4 inches = 64 inches
 * - "5ft 4in" -> 5 feet 4 inches = 64 inches
 * - "64" -> 64 inches (if >= 36, assume already in inches)
 * - "170cm" -> convert from cm
 * 
 * @param {string|number} value - Height value
 * @returns {number|null} - Total height in inches, or null if invalid
 */
export function parseHeightToInches(value) {
  if (value == null || value === '') return null;
  
  // If already a number >= 36, assume it's already in inches
  if (typeof value === 'number') {
    if (value >= 36) return value; // Already in inches (e.g., 64 inches)
    // If < 36, might be feet.inches format (e.g., 5.4)
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 10); // 5.4 -> feet=5, inches=4
    if (inches >= 0 && inches <= 11) {
      return feet * 12 + inches; // 5*12 + 4 = 64
    }
    // Fallback: treat as decimal feet and convert
    return value * 12;
  }
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Handle cm format: "170cm" or "170 cm"
  const cmMatch = str.match(/([\d.]+)\s*cm/i);
  if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    if (!isNaN(cm)) return cmToInches(cm);
  }
  
  // Handle feet'inches" format: "5'4" or "5'4\""
  const feetInchesMatch = str.match(/(\d+)[\s']*(?:ft|feet|')[\s]*(\d+)[\s"]*(?:in|inches|")?/i);
  if (feetInchesMatch) {
    const feet = parseInt(feetInchesMatch[1]);
    const inches = parseInt(feetInchesMatch[2]);
    if (!isNaN(feet) && !isNaN(inches) && inches >= 0 && inches <= 11) {
      return feet * 12 + inches;
    }
  }
  
  // Handle decimal format: "5.4" -> 5 feet 4 inches
  const decimalMatch = str.match(/^(\d+)\.(\d+)$/);
  if (decimalMatch) {
    const feet = parseInt(decimalMatch[1]);
    const inches = parseInt(decimalMatch[2]);
    if (!isNaN(feet) && !isNaN(inches) && inches >= 0 && inches <= 11) {
      return feet * 12 + inches;
    }
  }
  
  // Handle plain number: if >= 36, assume inches; otherwise might be feet
  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (num >= 36) {
      return num; // Already in inches
    } else {
      // Might be feet.inches format (e.g., "5.4")
      const feet = Math.floor(num);
      const inches = Math.round((num - feet) * 10);
      if (inches >= 0 && inches <= 11) {
        return feet * 12 + inches;
      }
      // Fallback: treat as decimal feet
      return num * 12;
    }
  }
  
  return null;
}

