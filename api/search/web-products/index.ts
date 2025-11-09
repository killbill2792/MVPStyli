// api/search/web-products.ts
// Natural language product search over the internet
// CONFIGURATION: Set PRODUCT_SEARCH_API_KEY environment variable in Vercel
// Options: SerpAPI (recommended), Google Custom Search, or other product search APIs

import { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

interface NormalizedProduct {
  id: string;
  kind: 'catalog' | 'imported' | 'web';
  title: string;
  brand?: string;
  price?: number;
  currency?: string;
  imageUrl: string;
  productUrl?: string;
  sourceLabel?: string;
  category?: string;
  rating?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, userId } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    console.log('Searching web for products:', query);
    
    // Get API key from environment
    // CONFIGURATION: Add PRODUCT_SEARCH_API_KEY to Vercel environment variables
    // For SerpAPI: Get key from https://serpapi.com/
    // For Google Custom Search: Get key from https://developers.google.com/custom-search
    const apiKey = process.env.PRODUCT_SEARCH_API_KEY;
    const searchProvider = process.env.PRODUCT_SEARCH_PROVIDER || 'serpapi'; // 'serpapi' or 'google'
    
    if (!apiKey) {
      console.warn('PRODUCT_SEARCH_API_KEY not set, using fallback search');
      // Fallback: return empty results with helpful error
      return res.status(200).json({ 
        items: [],
        error: 'Product search API key not configured. Please set PRODUCT_SEARCH_API_KEY in Vercel environment variables.',
        hint: 'Get a free API key from https://serpapi.com/ or use Google Custom Search API'
      });
    }

    let products: NormalizedProduct[] = [];
    
    if (searchProvider === 'serpapi') {
      products = await searchWithSerpAPI(query, apiKey);
    } else if (searchProvider === 'google') {
      products = await searchWithGoogleCustomSearch(query, apiKey);
    } else {
      return res.status(400).json({ error: 'Invalid search provider. Use "serpapi" or "google"' });
    }

    // Filter out products without required fields
    const validProducts = products.filter(p => p.imageUrl && p.title && p.productUrl);

    return res.status(200).json({ items: validProducts });
    
  } catch (error: any) {
    console.error('Error searching web products:', error);
    return res.status(500).json({ 
      error: 'Failed to search products', 
      details: error.message 
    });
  }
}

// Search using SerpAPI (recommended - has good product search)
async function searchWithSerpAPI(query: string, apiKey: string): Promise<NormalizedProduct[]> {
  try {
    // Use Google Shopping search via SerpAPI
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=20`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.shopping_results || data.shopping_results.length === 0) {
      return [];
    }
    
    return data.shopping_results.map((item: any, index: number) => {
      // Generate stable ID from URL
      const id = crypto.createHash('md5').update(item.link || item.product_link || '').digest('hex');
      
      // Extract price
      let price: number | undefined;
      let currency = 'USD';
      
      if (item.price) {
        const priceStr = String(item.price).replace(/[^0-9.]/g, '');
        price = parseFloat(priceStr);
      }
      
      // Extract source/store name
      let sourceLabel = 'Online Store';
      if (item.source) {
        sourceLabel = item.source;
      } else if (item.link) {
        try {
          const domain = new URL(item.link).hostname;
          sourceLabel = domain.replace('www.', '').split('.')[0];
          sourceLabel = sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1);
        } catch (e) {
          // Ignore
        }
      }
      
      // Detect category from title
      const category = detectCategoryFromText(item.title || '');
      
      return {
        id: `web-${id}`,
        kind: 'web' as const,
        title: item.title || 'Product',
        brand: item.source || undefined,
        price,
        currency,
        imageUrl: item.thumbnail || item.image || '',
        productUrl: item.link || item.product_link || '',
        sourceLabel,
        category,
        rating: item.rating ? parseFloat(String(item.rating)) : undefined
      };
    }).filter((p: NormalizedProduct) => p.imageUrl && p.title && p.productUrl);
    
  } catch (error) {
    console.error('Error with SerpAPI:', error);
    throw error;
  }
}

// Search using Google Custom Search API (alternative)
async function searchWithGoogleCustomSearch(query: string, apiKey: string): Promise<NormalizedProduct[]> {
  try {
    // CONFIGURATION: Also need CUSTOM_SEARCH_ENGINE_ID environment variable
    const searchEngineId = process.env.CUSTOM_SEARCH_ENGINE_ID;
    if (!searchEngineId) {
      throw new Error('CUSTOM_SEARCH_ENGINE_ID not set. Required for Google Custom Search.');
    }
    
    // Add "shopping" or "buy" to query to get product results
    const shoppingQuery = `${query} buy shopping`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(shoppingQuery)}&num=10`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Custom Search returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }
    
    return data.items.map((item: any, index: number) => {
      const id = crypto.createHash('md5').update(item.link || '').digest('hex');
      
      // Try to extract price from snippet
      let price: number | undefined;
      const priceMatch = item.snippet?.match(/\$(\d+(?:\.\d{2})?)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      }
      
      // Extract source from URL
      let sourceLabel = 'Online Store';
      try {
        const domain = new URL(item.link).hostname;
        sourceLabel = domain.replace('www.', '').split('.')[0];
        sourceLabel = sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1);
      } catch (e) {
        // Ignore
      }
      
      const category = detectCategoryFromText(item.title || item.snippet || '');
      
      return {
        id: `web-${id}`,
        kind: 'web' as const,
        title: item.title || 'Product',
        price,
        currency: 'USD',
        imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || '',
        productUrl: item.link || '',
        sourceLabel,
        category
      };
    }).filter((p: NormalizedProduct) => p.imageUrl && p.title && p.productUrl);
    
  } catch (error) {
    console.error('Error with Google Custom Search:', error);
    throw error;
  }
}

function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('dress') || lower.includes('skirt') || lower.includes('gown')) return 'dress';
  if (lower.includes('shirt') || lower.includes('blouse') || lower.includes('top') || 
      lower.includes('blazer') || lower.includes('jacket') || lower.includes('sweater') ||
      lower.includes('hoodie') || lower.includes('cardigan')) return 'upper';
  if (lower.includes('pants') || lower.includes('jeans') || lower.includes('trousers') || 
      lower.includes('shorts') || lower.includes('leggings')) return 'lower';
  if (lower.includes('shoes') || lower.includes('sneakers') || lower.includes('boots') ||
      lower.includes('heels') || lower.includes('sandals') || lower.includes('loafers')) return 'shoes';
  
  return 'upper'; // default
}

