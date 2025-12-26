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

