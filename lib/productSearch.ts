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
  productUrl?: string;
  buyUrl?: string; // For backward compatibility
  sourceLabel?: string;
  category?: string;
  rating?: number;
  color?: string;
  material?: string;
  garment_des?: string;
}

/**
 * Normalize a product from any source to our standard shape
 */
export function normalizeProduct(product: any): NormalizedProduct {
  return {
    id: product.id || `product-${Date.now()}`,
    kind: product.kind || 'catalog',
    title: product.title || product.name || 'Product',
    name: product.title || product.name || 'Product', // Backward compat
    brand: product.brand,
    price: product.price,
    currency: product.currency || 'USD',
    imageUrl: product.imageUrl || product.image || '',
    image: product.imageUrl || product.image || '', // Backward compat
    productUrl: product.productUrl || product.buyUrl,
    buyUrl: product.productUrl || product.buyUrl, // Backward compat
    sourceLabel: product.sourceLabel || product.brand,
    category: product.category || 'upper',
    rating: product.rating || 4.0,
    color: product.color,
    material: product.material,
    garment_des: product.garment_des || product.description
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
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://mvpstyli-fresh.vercel.app';
  
  try {
    const response = await fetch(`${apiUrl}/api/product/from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response from API:', text.substring(0, 200));
      // Check for common Vercel errors
      if (text.includes('DEPLOYMENT_NOT_FOUND') || text.includes('Function not found')) {
        throw new Error('API endpoint not deployed yet. Please wait for Vercel deployment to complete.');
      }
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error. Response text:', text.substring(0, 200));
      throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(data.error || `Failed to import product: ${response.status}`);
    }

    if (!data.item) {
      throw new Error('No product data returned from API');
    }

    return normalizeProduct(data.item);
  } catch (error: any) {
    console.error('Error importing product from URL:', error);
    if (error.message) {
      throw error;
    }
    throw new Error('Failed to import product from URL. Please check the URL and try again.');
  }
}

/**
 * Search web for products using natural language query
 */
export async function searchWebProducts(query: string): Promise<NormalizedProduct[]> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://mvpstyli-fresh.vercel.app';
  
  try {
    const response = await fetch(`${apiUrl}/api/search/web-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response from API:', text.substring(0, 200));
      // Check for common Vercel errors
      if (text.includes('DEPLOYMENT_NOT_FOUND') || text.includes('Function not found')) {
        throw new Error('API endpoint not deployed yet. Please wait for Vercel deployment to complete.');
      }
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
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
      if (data.error && data.error.includes('API key')) {
        console.warn('Product search API not configured:', data.error);
        return [];
      }
      throw new Error(data.error || `Failed to search products: ${response.status}`);
    }
  
    // If API returns error message (e.g., API key not configured), return empty array
    if (data.error && (!data.items || data.items.length === 0)) {
      console.warn('Product search API not configured:', data.error);
      return [];
    }
  
    return (data.items || []).map((item: any) => normalizeProduct(item));
  } catch (error: any) {
    console.error('Error searching web products:', error);
    if (error.message) {
      throw error;
    }
    throw new Error('Failed to search products. Please try again.');
  }
}

