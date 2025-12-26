/**
 * Utility functions for fetching and converting garments to product format
 */

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
    
    // Universal measurements (flat widths in cm)
    if (size.chest_width != null) measurements.chest = size.chest_width;
    if (size.waist_width != null) measurements.waist = size.waist_width;
    if (size.hip_width != null) measurements.hips = size.hip_width;
    if (size.garment_length != null) measurements.length = size.garment_length;
    
    // Upper body measurements
    if (size.shoulder_width != null) measurements.shoulder = size.shoulder_width;
    if (size.sleeve_length != null) measurements.sleeve = size.sleeve_length;
    
    // Lower body measurements
    if (size.inseam != null) measurements.inseam = size.inseam;
    if (size.rise != null) measurements.rise = size.rise;
    if (size.thigh_width != null) measurements.thigh = size.thigh_width;
    if (size.leg_opening != null) measurements.leg_opening = size.leg_opening;
    
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

  // Convert sizes to sizeChart format
  const sizeChart = convertSizesToSizeChart(garment.sizes || []);

  // Build product object
  const product = {
    id: garment.id,
    name: garment.name || 'Unnamed Product',
    brand: garment.brand || 'Unknown Brand',
    price: garment.price || 0,
    rating: 4.5, // Default rating
    category: category,
    color: garment.color || '',
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
    
    // Size chart for Fit Check
    sizeChart: sizeChart,
    
    // Tags
    tags: Array.isArray(garment.tags) ? garment.tags : (garment.tags ? [garment.tags] : []),
    
    // Metadata
    is_active: garment.is_active !== false,
    created_at: garment.created_at,
    
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

    console.log('🛍️ Fetching garments from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching garments:', response.status, response.statusText);
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
        console.error('Failed to parse garments response:', e);
        return [];
      }
    }

    // Extract garments array
    const garments = data.garments || data || [];
    
    if (!Array.isArray(garments)) {
      console.error('Garments response is not an array:', garments);
      return [];
    }

    // Convert each garment to product format
    const products = garments
      .filter(garment => garment.is_active !== false) // Only active garments
      .map(garment => convertGarmentToProduct(garment))
      .filter(product => product !== null); // Remove any null conversions

    console.log(`🛍️ Fetched ${products.length} garments as products`);
    return products;
  } catch (error) {
    console.error('Error in fetchGarmentsAsProducts:', error);
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

