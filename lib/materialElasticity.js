/**
 * Material Elasticity Database
 * Determines if a material has stretch/elasticity
 * All materials are stored in lowercase for matching
 */

const MATERIAL_ELASTICITY = {
  // High stretch materials
  'spandex': true,
  'elastane': true,
  'lycra': true,
  'elastodiene': true,
  'elasterell-p': true,
  
  // Medium stretch materials
  'jersey': true, // Usually has some stretch
  'knit': true,
  'ribbed': true,
  'stretch cotton': true,
  'stretch denim': true,
  'stretch twill': true,
  'stretch poplin': true,
  'stretch satin': true,
  'stretch velvet': true,
  'stretch wool': true,
  'stretch linen': true,
  'stretch silk': true,
  
  // Low/no stretch materials
  'cotton': false,
  'polyester': false,
  'nylon': false,
  'silk': false,
  'wool': false,
  'cashmere': false,
  'linen': false,
  'denim': false,
  'canvas': false,
  'twill': false,
  'poplin': false,
  'satin': false,
  'velvet': false,
  'chiffon': false,
  'organza': false,
  'tulle': false,
  'leather': false,
  'suede': false,
  'faux leather': false,
  'pleather': false,
  'vinyl': false,
};

/**
 * Check if a material has stretch/elasticity
 * @param {string} material - Material name (e.g., "Cotton, Spandex")
 * @returns {boolean} True if material has stretch
 */
export function hasStretch(material) {
  if (!material || typeof material !== 'string') return false;
  
  const materialLower = material.toLowerCase();
  
  // Check for explicit stretch keywords first
  if (materialLower.includes('stretch')) return true;
  if (materialLower.includes('elastic')) return true;
  
  // Check material database
  for (const [mat, hasStretchValue] of Object.entries(MATERIAL_ELASTICITY)) {
    if (materialLower.includes(mat)) {
      return hasStretchValue;
    }
  }
  
  // Default: assume no stretch if not found
  return false;
}

/**
 * Get stretch level (none, low, medium, high)
 * @param {string} material - Material name
 * @returns {string} Stretch level
 */
export function getStretchLevel(material) {
  if (!material || typeof material !== 'string') return 'none';
  
  const materialLower = material.toLowerCase();
  
  // High stretch
  if (materialLower.includes('spandex') || 
      materialLower.includes('elastane') || 
      materialLower.includes('lycra')) {
    return 'high';
  }
  
  // Medium stretch
  if (materialLower.includes('stretch') || 
      materialLower.includes('jersey') || 
      materialLower.includes('knit') ||
      materialLower.includes('ribbed')) {
    return 'medium';
  }
  
  // Check database
  if (hasStretch(material)) {
    return 'medium';
  }
  
  return 'none';
}

module.exports = {
  hasStretch,
  getStretchLevel,
  MATERIAL_ELASTICITY,
};

