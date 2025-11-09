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
  
  const response = await fetch(`${apiUrl}/api/product/from-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to import product from URL');
  }

  const data = await response.json();
  return normalizeProduct(data.item);
}

/**
 * Search web for products using natural language query
 */
export async function searchWebProducts(query: string): Promise<NormalizedProduct[]> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://mvpstyli-fresh.vercel.app';
  
  const response = await fetch(`${apiUrl}/api/search/web-products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search products');
  }

  const data = await response.json();
  
  // If API returns error message (e.g., API key not configured), return empty array
  if (data.error && data.items?.length === 0) {
    console.warn('Product search API not configured:', data.error);
    return [];
  }
  
  return (data.items || []).map((item: any) => normalizeProduct(item));
}

