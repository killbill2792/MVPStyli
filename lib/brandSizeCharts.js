/**
 * Brand Size Charts Database
 * Pre-populated size charts for major brands
 * All measurements are in inches (circumference)
 */

const BRAND_SIZE_CHARTS = {
  'H&M': {
    upper_body: {
      'XS': { chest: 34, waist: 28, length: 24, sleeve: 30, shoulder: 16 },
      'S': { chest: 36, waist: 30, length: 25, sleeve: 31, shoulder: 16.5 },
      'M': { chest: 40, waist: 34, length: 26, sleeve: 32, shoulder: 17.5 },
      'L': { chest: 44, waist: 38, length: 27, sleeve: 33, shoulder: 18.5 },
      'XL': { chest: 48, waist: 42, length: 28, sleeve: 34, shoulder: 19.5 },
      'XXL': { chest: 52, waist: 46, length: 29, sleeve: 35, shoulder: 20.5 },
    },
    lower_body: {
      'XS': { waist: 28, hips: 36, inseam: 30, rise: 9 },
      'S': { waist: 30, hips: 38, inseam: 30, rise: 9.5 },
      'M': { waist: 34, hips: 42, inseam: 31, rise: 10 },
      'L': { waist: 38, hips: 46, inseam: 31, rise: 10.5 },
      'XL': { waist: 42, hips: 50, inseam: 32, rise: 11 },
      'XXL': { waist: 46, hips: 54, inseam: 32, rise: 11.5 },
    },
    dresses: {
      'XS': { chest: 34, waist: 28, hips: 36, length: 36 },
      'S': { chest: 36, waist: 30, hips: 38, length: 37 },
      'M': { chest: 40, waist: 34, hips: 42, length: 38 },
      'L': { chest: 44, waist: 38, hips: 46, length: 39 },
      'XL': { chest: 48, waist: 42, hips: 50, length: 40 },
      'XXL': { chest: 52, waist: 46, hips: 54, length: 41 },
    },
  },
  'Zara': {
    upper_body: {
      'XS': { chest: 33, waist: 27, length: 23, sleeve: 29, shoulder: 15.5 },
      'S': { chest: 35, waist: 29, length: 24, sleeve: 30, shoulder: 16 },
      'M': { chest: 39, waist: 33, length: 25, sleeve: 31, shoulder: 17 },
      'L': { chest: 43, waist: 37, length: 26, sleeve: 32, shoulder: 18 },
      'XL': { chest: 47, waist: 41, length: 27, sleeve: 33, shoulder: 19 },
    },
    lower_body: {
      'XS': { waist: 27, hips: 35, inseam: 30, rise: 8.5 },
      'S': { waist: 29, hips: 37, inseam: 30, rise: 9 },
      'M': { waist: 33, hips: 41, inseam: 31, rise: 9.5 },
      'L': { waist: 37, hips: 45, inseam: 31, rise: 10 },
      'XL': { waist: 41, hips: 49, inseam: 32, rise: 10.5 },
    },
    dresses: {
      'XS': { chest: 33, waist: 27, hips: 35, length: 35 },
      'S': { chest: 35, waist: 29, hips: 37, length: 36 },
      'M': { chest: 39, waist: 33, hips: 41, length: 37 },
      'L': { chest: 43, waist: 37, hips: 45, length: 38 },
      'XL': { chest: 47, waist: 41, hips: 49, length: 39 },
    },
  },
  'Nike': {
    upper_body: {
      'XS': { chest: 35, waist: 29, length: 25, sleeve: 31, shoulder: 16 },
      'S': { chest: 37, waist: 31, length: 26, sleeve: 32, shoulder: 16.5 },
      'M': { chest: 41, waist: 35, length: 27, sleeve: 33, shoulder: 17.5 },
      'L': { chest: 45, waist: 39, length: 28, sleeve: 34, shoulder: 18.5 },
      'XL': { chest: 49, waist: 43, length: 29, sleeve: 35, shoulder: 19.5 },
      'XXL': { chest: 53, waist: 47, length: 30, sleeve: 36, shoulder: 20.5 },
    },
    lower_body: {
      'XS': { waist: 29, hips: 37, inseam: 30, rise: 9 },
      'S': { waist: 31, hips: 39, inseam: 30, rise: 9.5 },
      'M': { waist: 35, hips: 43, inseam: 31, rise: 10 },
      'L': { waist: 39, hips: 47, inseam: 31, rise: 10.5 },
      'XL': { waist: 43, hips: 51, inseam: 32, rise: 11 },
      'XXL': { waist: 47, hips: 55, inseam: 32, rise: 11.5 },
    },
    dresses: {
      'XS': { chest: 35, waist: 29, hips: 37, length: 36 },
      'S': { chest: 37, waist: 31, hips: 39, length: 37 },
      'M': { chest: 41, waist: 35, hips: 43, length: 38 },
      'L': { chest: 45, waist: 39, hips: 47, length: 39 },
      'XL': { chest: 49, waist: 43, hips: 51, length: 40 },
      'XXL': { chest: 53, waist: 47, hips: 55, length: 41 },
    },
  },
  'Adidas': {
    upper_body: {
      'XS': { chest: 34, waist: 28, length: 24, sleeve: 30, shoulder: 15.5 },
      'S': { chest: 36, waist: 30, length: 25, sleeve: 31, shoulder: 16 },
      'M': { chest: 40, waist: 34, length: 26, sleeve: 32, shoulder: 17 },
      'L': { chest: 44, waist: 38, length: 27, sleeve: 33, shoulder: 18 },
      'XL': { chest: 48, waist: 42, length: 28, sleeve: 34, shoulder: 19 },
      'XXL': { chest: 52, waist: 46, length: 29, sleeve: 35, shoulder: 20 },
    },
    lower_body: {
      'XS': { waist: 28, hips: 36, inseam: 30, rise: 9 },
      'S': { waist: 30, hips: 38, inseam: 30, rise: 9.5 },
      'M': { waist: 34, hips: 42, inseam: 31, rise: 10 },
      'L': { waist: 38, hips: 46, inseam: 31, rise: 10.5 },
      'XL': { waist: 42, hips: 50, inseam: 32, rise: 11 },
      'XXL': { waist: 46, hips: 54, inseam: 32, rise: 11.5 },
    },
    dresses: {
      'XS': { chest: 34, waist: 28, hips: 36, length: 36 },
      'S': { chest: 36, waist: 30, hips: 38, length: 37 },
      'M': { chest: 40, waist: 34, hips: 42, length: 38 },
      'L': { chest: 44, waist: 38, hips: 46, length: 39 },
      'XL': { chest: 48, waist: 42, hips: 50, length: 40 },
      'XXL': { chest: 52, waist: 46, hips: 54, length: 41 },
    },
  },
  'Uniqlo': {
    upper_body: {
      'XS': { chest: 35, waist: 29, length: 24, sleeve: 30, shoulder: 16 },
      'S': { chest: 37, waist: 31, length: 25, sleeve: 31, shoulder: 16.5 },
      'M': { chest: 41, waist: 35, length: 26, sleeve: 32, shoulder: 17.5 },
      'L': { chest: 45, waist: 39, length: 27, sleeve: 33, shoulder: 18.5 },
      'XL': { chest: 49, waist: 43, length: 28, sleeve: 34, shoulder: 19.5 },
      'XXL': { chest: 53, waist: 47, length: 29, sleeve: 35, shoulder: 20.5 },
    },
    lower_body: {
      'XS': { waist: 29, hips: 37, inseam: 30, rise: 9 },
      'S': { waist: 31, hips: 39, inseam: 30, rise: 9.5 },
      'M': { waist: 35, hips: 43, inseam: 31, rise: 10 },
      'L': { waist: 39, hips: 47, inseam: 31, rise: 10.5 },
      'XL': { waist: 43, hips: 51, inseam: 32, rise: 11 },
      'XXL': { waist: 47, hips: 55, inseam: 32, rise: 11.5 },
    },
    dresses: {
      'XS': { chest: 35, waist: 29, hips: 37, length: 36 },
      'S': { chest: 37, waist: 31, hips: 39, length: 37 },
      'M': { chest: 41, waist: 35, hips: 43, length: 38 },
      'L': { chest: 45, waist: 39, hips: 47, length: 39 },
      'XL': { chest: 49, waist: 43, hips: 51, length: 40 },
      'XXL': { chest: 53, waist: 47, hips: 55, length: 41 },
    },
  },
  'Banana Republic': {
    upper_body: {
      'XS': { chest: 34, waist: 28, length: 24, sleeve: 30, shoulder: 15.5 },
      'S': { chest: 36, waist: 30, length: 25, sleeve: 31, shoulder: 16 },
      'M': { chest: 40, waist: 34, length: 26, sleeve: 32, shoulder: 17 },
      'L': { chest: 44, waist: 38, length: 27, sleeve: 33, shoulder: 18 },
      'XL': { chest: 48, waist: 42, length: 28, sleeve: 34, shoulder: 19 },
      'XXL': { chest: 52, waist: 46, length: 29, sleeve: 35, shoulder: 20 },
    },
    lower_body: {
      'XS': { waist: 28, hips: 36, inseam: 30, rise: 9 },
      'S': { waist: 30, hips: 38, inseam: 30, rise: 9.5 },
      'M': { waist: 34, hips: 42, inseam: 31, rise: 10 },
      'L': { waist: 38, hips: 46, inseam: 31, rise: 10.5 },
      'XL': { waist: 42, hips: 50, inseam: 32, rise: 11 },
      'XXL': { waist: 46, hips: 54, inseam: 32, rise: 11.5 },
    },
    dresses: {
      'XS': { chest: 34, waist: 28, hips: 36, length: 36 },
      'S': { chest: 36, waist: 30, hips: 38, length: 37 },
      'M': { chest: 40, waist: 34, hips: 42, length: 38 },
      'L': { chest: 44, waist: 38, hips: 46, length: 39 },
      'XL': { chest: 48, waist: 42, hips: 50, length: 40 },
      'XXL': { chest: 52, waist: 46, hips: 54, length: 41 },
    },
  },
};

/**
 * Get available brands
 */
export function getAvailableBrands() {
  return Object.keys(BRAND_SIZE_CHARTS);
}

/**
 * Get size chart for a brand and category
 * @param {string} brand - Brand name
 * @param {string} category - 'upper_body', 'lower_body', or 'dresses'
 * @returns {Object|null} Size chart object or null if not found
 */
export function getBrandSizeChart(brand, category) {
  const normalizedBrand = brand?.trim();
  const normalizedCategory = category === 'upper' || category === 'upper_body' ? 'upper_body' :
                            category === 'lower' || category === 'lower_body' ? 'lower_body' :
                            category === 'dress' || category === 'dresses' ? 'dresses' : null;
  
  if (!normalizedBrand || !normalizedCategory) return null;
  
  const chart = BRAND_SIZE_CHARTS[normalizedBrand];
  if (!chart) return null;
  
  return chart[normalizedCategory] || null;
}

/**
 * Convert brand size chart to fitLogic format
 * @param {Object} brandChart - Brand size chart object
 * @returns {Array} Array of {size, measurements} objects
 */
export function convertBrandChartToFitLogic(brandChart) {
  if (!brandChart) return [];
  
  return Object.entries(brandChart).map(([size, measurements]) => ({
    size,
    measurements,
  }));
}

module.exports = {
  getAvailableBrands,
  getBrandSizeChart,
  convertBrandChartToFitLogic,
  BRAND_SIZE_CHARTS,
};

