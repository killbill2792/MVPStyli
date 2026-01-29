/**
 * Utility functions for fetching and converting garments to product format
 */

import { logger } from './logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

/**
 * Convert garment_sizes array to sizeChart format for Fit Check
 * @param {Array} sizes - Array of garment size objects from database
 * @returns {Array} - sizeChart array in format expected by fitLogic
 */
export function convertSizesToSizeChart(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return [];
  }

  return sizes.map(size => {
    const measurements = {};
    
    // Universal measurements (circumference in inches)
    // Database stores in inches, fitLogic expects inches
    // Support both new (circumference) and old (flat) field names for backward compatibility
    if (size.chest_circumference != null) {
      measurements.chest = Number(size.chest_circumference);
    } else if (size.chest_width != null) {
      // Convert old flat width (cm) to circumference (inches): flat * 2 / 2.54
      measurements.chest = (Number(size.chest_width) * 2) / 2.54;
    }
    
    if (size.waist_circumference != null) {
      measurements.waist = Number(size.waist_circumference);
    } else if (size.waist_width != null) {
      measurements.waist = (Number(size.waist_width) * 2) / 2.54;
    }
    
    if (size.hip_circumference != null) {
      measurements.hips = Number(size.hip_circumference);
    } else if (size.hip_width != null) {
      measurements.hips = (Number(size.hip_width) * 2) / 2.54;
    }
    
    if (size.garment_length_in != null) {
      measurements.length = Number(size.garment_length_in);
    } else if (size.garment_length != null) {
      // Convert old cm to inches
      measurements.length = Number(size.garment_length) / 2.54;
    }
    
    // Upper body measurements (lengths in inches)
    if (size.shoulder_width_in != null) {
      measurements.shoulder = Number(size.shoulder_width_in);
    } else if (size.shoulder_width != null) {
      measurements.shoulder = Number(size.shoulder_width) / 2.54;
    }
    
    if (size.sleeve_length_in != null) {
      measurements.sleeve = Number(size.sleeve_length_in);
    } else if (size.sleeve_length != null) {
      measurements.sleeve = Number(size.sleeve_length) / 2.54;
    }
    
    // Lower body measurements (circumference and lengths in inches)
    if (size.inseam_in != null) {
      measurements.inseam = Number(size.inseam_in);
    } else if (size.inseam != null) {
      measurements.inseam = Number(size.inseam) / 2.54;
    }
    
    if (size.rise_in != null) {
      measurements.rise = Number(size.rise_in);
    } else if (size.rise != null) {
      measurements.rise = Number(size.rise) / 2.54;
    }
    
    if (size.thigh_circumference != null) {
      measurements.thigh = Number(size.thigh_circumference);
    } else if (size.thigh_width != null) {
      measurements.thigh = (Number(size.thigh_width) * 2) / 2.54;
    }
    
    if (size.leg_opening_circumference != null) {
      measurements.leg_opening = Number(size.leg_opening_circumference);
    } else if (size.leg_opening != null) {
      measurements.leg_opening = (Number(size.leg_opening) * 2) / 2.54;
    }
    
    return {
      size: size.size_label || size.size,
      measurements: measurements
    };
  });
}

/**
 * Convert a garment from database format to product format for shop screen
 * @param {Object} garment - Garment object from database
 * @returns {Object} - Product object compatible with shop screen
 */
export function convertGarmentToProduct(garment) {
  if (!garment) return null;

  // Convert category: 'upper' -> 'upper', 'lower' -> 'lower', 'dresses' -> 'dress'
  let category = garment.category;
  if (category === 'dresses') category = 'dress';
  
  // Build images array
  const images = [];
  if (garment.image_url) images.push(garment.image_url);
  if (Array.isArray(garment.additional_images)) {
    images.push(...garment.additional_images.filter(img => img));
  }

  // Convert sizes to sizeChart format (array for fitLogic, object for display)
  const sizeChartArray = convertSizesToSizeChart(garment.sizes || []);
  
  // Convert array format to object format for ProductScreen display
  // Array: [{size: 'S', measurements: {...}}, ...]
  // Object: {S: {chest: 38, waist: 32}, M: {...}}
  const sizeChartObject = {};
  sizeChartArray.forEach(item => {
    if (item.size && item.measurements) {
      sizeChartObject[item.size] = item.measurements;
    }
  });

  // Build product object
  const product = {
    id: garment.id,
    name: garment.name || 'Unnamed Product',
    brand: garment.brand || 'Unknown Brand',
    price: garment.price || 0,
    rating: 4.5, // Default rating
    category: category,
    color: garment.color || '',
    colorHex: garment.color_hex || garment.colorHex || null,
    material: garment.material || '',
    image: images[0] || garment.image_url || '',
    images: images.length > 0 ? images : [garment.image_url || ''],
    buyUrl: garment.product_link || '',
    url: garment.product_link || '',
    product_link: garment.product_link || '',
    description: garment.description || '',
    garment_des: garment.description || '',
    
    // Garment-specific fields for Fit Check
    garment_id: garment.id,
    fit: garment.fit_type || 'regular',
    fitType: garment.fit_type || 'regular',
    fabric: garment.material || '',
    fabricStretch: garment.fabric_stretch || 'none',
    
    // Size chart for Fit Check (array format for fitLogic)
    sizeChart: sizeChartArray,
    
    // Size chart for ProductScreen display (object format)
    sizeChartDisplay: sizeChartObject,
    
    // Tags
    tags: Array.isArray(garment.tags) ? garment.tags : (garment.tags ? [garment.tags] : []),
    
    // Metadata
    is_active: garment.is_active !== false,
    created_at: garment.created_at,
    
    // Gender for filtering
    gender: garment.gender || 'unisex',
    
    // Source identifier
    source: 'admin_garment',
  };

  return product;
}

/**
 * Fetch all active garments from API and convert to product format
 * @param {Object} options - Options for fetching
 * @param {string} options.category - Filter by category (optional)
 * @param {string} options.gender - Filter by gender (optional)
 * @returns {Promise<Array>} - Array of product objects
 */
export async function fetchGarmentsAsProducts(options = {}) {
  try {
    const { category, gender } = options;
    let url = `${API_BASE}/api/garments?active_only=true`;
    
    if (category) url += `&category=${category}`;
    if (gender) url += `&gender=${gender}`;

    logger.log('🛍️ Fetching garments from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      logger.error('Error fetching garments:', response.status, response.statusText);
      return [];
    }

    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        logger.error('Failed to parse garments response:', e);
        return [];
      }
    }

    // Extract garments array
    const garments = data.garments || data || [];
    
    if (!Array.isArray(garments)) {
      logger.error('Garments response is not an array:', garments);
      return [];
    }

    // Convert each garment to product format
    const products = garments
      .filter(garment => garment.is_active !== false) // Only active garments
      .map(garment => convertGarmentToProduct(garment))
      .filter(product => product !== null); // Remove any null conversions

    logger.log(`🛍️ Fetched ${products.length} garments as products`);
    return products;
  } catch (error) {
    logger.error('Error in fetchGarmentsAsProducts:', error);
    return [];
  }
}

/**
 * Fetch a single garment by ID and convert to product format
 * @param {string} garmentId - Garment ID
 * @returns {Promise<Object|null>} - Product object or null
 */
export async function fetchGarmentAsProduct(garmentId) {
  try {
    const url = `${API_BASE}/api/garments?id=${garmentId}`;
    console.log('🛍️ Fetching garment:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching garment:', response.status);
      return null;
    }

    const data = await response.json();
    const garment = data.garment || data;
    
    if (!garment) {
      return null;
    }

    return convertGarmentToProduct(garment);
  } catch (error) {
    console.error('Error in fetchGarmentAsProduct:', error);
    return null;
  }
}

