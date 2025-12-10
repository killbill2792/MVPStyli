// lib/productSearch.ts
// Helper functions for product search and normalization

export interface NormalizedProduct {
  id: string;
  kind: 'catalog' | 'imported' | 'web';
  title: string;
  name?: string; // For backward compatibility
  brand?: string;
  price?: number;
  currency?: string;
  imageUrl: string;
  image?: string; // For backward compatibility
  images?: string[]; // Array of all product images
  productUrl?: string;
  buyUrl?: string; // For backward compatibility
  sourceLabel?: string;
  category?: string;
  rating?: number;
  color?: string;
  material?: string;
  garment_des?: string;
  sizeChart?: { size: string; measurements: Record<string, string> }[];
}

/**
 * Normalize a product from any source to our standard shape
 */
export function normalizeProduct(product: any): NormalizedProduct {
  // Build images array - include main image and any additional images
  const mainImage = product.imageUrl || product.image || '';
  let images: string[] = [];
  
  if (product.images && Array.isArray(product.images)) {
    images = product.images.filter((img: any) => img && typeof img === 'string');
  }
  
  // Make sure main image is first
  if (mainImage && !images.includes(mainImage)) {
    images.unshift(mainImage);
  }
  
  return {
    id: product.id || `product-${Date.now()}`,
    kind: product.kind || 'catalog',
    title: product.title || product.name || 'Product',
    name: product.title || product.name || 'Product', // Backward compat
    brand: product.brand,
    price: product.price,
    currency: product.currency || 'USD',
    imageUrl: mainImage,
    image: mainImage, // Backward compat
    images: images,
    productUrl: product.productUrl || product.buyUrl,
    buyUrl: product.productUrl || product.buyUrl, // Backward compat
    sourceLabel: product.sourceLabel || product.brand,
    category: product.category || 'upper',
    rating: product.rating || 4.0,
    color: product.color,
    material: product.material,
    garment_des: product.garment_des || product.description,
    sizeChart: product.sizeChart || []
  };
}

/**
 * Check if a query looks like a URL
 */
export function isUrl(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const trimmed = query.trim();
  return trimmed.startsWith('http://') || 
         trimmed.startsWith('https://') || 
         trimmed.includes('.com') || 
         trimmed.includes('.net') || 
         trimmed.includes('.org');
}

/**
 * Import product from URL
 */
export async function importProductFromUrl(url: string): Promise<NormalizedProduct> {
  // Try to get API URL from environment, fallback to default
  // In Expo, environment variables need EXPO_PUBLIC_ prefix
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
                 process.env.API_URL || 
                 'https://mvp-styli.vercel.app';
  
  // Ensure no trailing slash
  const baseUrl = apiUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/productfromurl`;
  
  console.log('API URL:', baseUrl);
  console.log('Calling:', endpoint);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response from API:', text.substring(0, 500));
      // Check for common Vercel errors
      if (text.includes('DEPLOYMENT_NOT_FOUND') || text.includes('Function not found') || text.includes('404')) {
        throw new Error('API endpoint not found. Please ensure the API is deployed on Vercel. Check: https://mvp-styli.vercel.app/api/productfromurl');
      }
      if (text.includes('502') || text.includes('503') || text.includes('504')) {
        throw new Error('API server is temporarily unavailable. Please try again in a moment.');
      }
      if (response.status === 404) {
        throw new Error('API endpoint not found. Please verify the deployment on Vercel.');
      }
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}`);
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error. Response text:', text.substring(0, 200));
      throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      const errorMsg = typeof data.error === 'string' 
        ? data.error 
        : (data.error?.message || data.details || `Failed to import product: ${response.status}`);
      throw new Error(errorMsg);
    }

    if (!data.item) {
      throw new Error('No product data returned from API');
    }

    return normalizeProduct(data.item);
  } catch (error: any) {
    console.error('Error importing product from URL:', error);
    // Ensure we always throw a proper Error with a string message
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Handle case where error might be an object
    const errorMessage = error?.message || error?.error || (typeof error === 'string' ? error : 'Failed to import product from URL. Please check the URL and try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Search web for products using natural language query
 */
export async function searchWebProducts(query: string): Promise<NormalizedProduct[]> {
  // Try to get API URL from environment, fallback to default
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
                 process.env.API_URL || 
                 'https://mvp-styli.vercel.app';
  
  // Ensure no trailing slash
  const baseUrl = apiUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/searchwebproducts`;
  
  console.log('API URL:', baseUrl);
  console.log('Calling:', endpoint);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response from API:', text.substring(0, 500));
      // Check for common Vercel errors
      if (text.includes('DEPLOYMENT_NOT_FOUND') || text.includes('Function not found') || text.includes('404')) {
        throw new Error('API endpoint not found. Please ensure the API is deployed on Vercel. Check: https://mvp-styli.vercel.app/api/searchwebproducts');
      }
      if (text.includes('502') || text.includes('503') || text.includes('504')) {
        throw new Error('API server is temporarily unavailable. Please try again in a moment.');
      }
      if (response.status === 404) {
        throw new Error('API endpoint not found. Please verify the deployment on Vercel.');
      }
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}`);
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error. Response text:', text.substring(0, 200));
      throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      // If API key not configured, return empty array with warning
      const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || data.details || `Failed to search products: ${response.status}`);
      if (errorMsg && typeof errorMsg === 'string' && errorMsg.includes('API key')) {
        console.warn('Product search API not configured:', errorMsg);
        return [];
      }
      throw new Error(errorMsg);
    }
  
    // If API returns error message (e.g., API key not configured), return empty array
    // Check if we have an error message even with 200 status
    if (data.error && (!data.items || data.items.length === 0)) {
      const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || data.details || 'Unknown error');
      if (errorMsg && typeof errorMsg === 'string' && errorMsg.includes('API key')) {
        console.warn('Product search API not configured:', errorMsg);
        return [];
      }
    }
    
    // If no items and no error, might be empty result
    if (!data.items || data.items.length === 0) {
      console.log('No products found for query');
      return [];
    }
  
    // Limit to 10 results
    return (data.items || []).slice(0, 10).map((item: any) => normalizeProduct(item));
  } catch (error: any) {
    console.error('Error searching web products:', error);
    // Ensure we always throw a proper Error with a string message
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Handle case where error might be an object
    const errorMessage = error?.message || error?.error || (typeof error === 'string' ? error : 'Failed to search products. Please try again.');
    throw new Error(errorMessage);
  }
}

