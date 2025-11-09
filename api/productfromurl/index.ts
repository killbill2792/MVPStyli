// api/product/from-url.ts
// Import product from URL - extracts product info from any product page
// CONFIGURATION: No API keys needed for basic scraping

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
  color?: string;
  material?: string;
  garment_des?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, userId } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Validate URL
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    console.log('Importing product from URL:', url);
    
    const productData = await scrapeProductFromUrl(url);
    
    if (!productData) {
      return res.status(404).json({ error: 'Could not extract product information from URL' });
    }

    // Normalize to our product shape
    const normalized: NormalizedProduct = {
      id: productData.id || `imported-${crypto.createHash('md5').update(url).digest('hex')}`,
      kind: 'imported',
      title: productData.name || productData.title || 'Imported Product',
      brand: productData.brand,
      price: productData.price,
      currency: productData.currency || 'USD',
      imageUrl: productData.image || productData.imageUrl || '',
      productUrl: url,
      sourceLabel: productData.brand || extractBrandFromUrl(url),
      category: productData.category || detectCategoryFromUrl(url),
      rating: productData.rating || 4.0,
      color: productData.color,
      material: productData.material,
      garment_des: productData.description || productData.garment_des
    };

    // Ensure we have at least imageUrl and title
    if (!normalized.imageUrl || !normalized.title) {
      return res.status(404).json({ error: 'Product missing required fields (image or title)' });
    }

    return res.status(200).json({ item: normalized });
    
  } catch (error: any) {
    console.error('Error importing product from URL:', error);
    return res.status(500).json({ error: 'Failed to import product', details: error.message });
  }
}

async function scrapeProductFromUrl(url: string): Promise<any> {
  const domain = new URL(url).hostname.toLowerCase();
  
  // Try specific scrapers first
  if (domain.includes('zara.com')) {
    return await scrapeZaraProduct(url);
  } else if (domain.includes('hm.com') || domain.includes('h&m')) {
    return await scrapeHMProduct(url);
  } else if (domain.includes('uniqlo.com')) {
    return await scrapeUniqloProduct(url);
  } else if (domain.includes('asos.com')) {
    return await scrapeASOSProduct(url);
  } else if (domain.includes('cos.com')) {
    return await scrapeCOSProduct(url);
  } else if (domain.includes('amazon.com') || domain.includes('amazon.')) {
    return await scrapeAmazonProduct(url);
  } else if (domain.includes('macy.com') || domain.includes('macys.com')) {
    return await scrapeMacyProduct(url);
  } else if (domain.includes('gapfactory.com') || domain.includes('bananarepublicfactory.com') || domain.includes('gap.com')) {
    return await scrapeGapProduct(url);
  } else {
    // Generic scraping for any other store
    return await scrapeGenericProduct(url);
  }
}

async function scrapeZaraProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*ZARA.*/i, '').trim() : 'Zara Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/) || html.match(/price["\s:]+(\d+(?:\.\d{2})?)/i);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i) || 
                       html.match(/<meta name="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    // Try to extract JSON-LD product data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    let jsonData = null;
    if (jsonLdMatch) {
      try {
        jsonData = JSON.parse(jsonLdMatch[1]);
        if (Array.isArray(jsonData)) {
          jsonData = jsonData.find((item: any) => item['@type'] === 'Product');
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    return {
      name: jsonData?.name || name,
      price: jsonData?.offers?.price || price,
      currency: jsonData?.offers?.priceCurrency || 'USD',
      image: jsonData?.image?.[0] || image,
      description: jsonData?.description || description,
      brand: 'Zara',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping Zara:', error);
    return null;
  }
}

async function scrapeHMProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*H&M.*/i, '').trim() : 'H&M Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/) || html.match(/price["\s:]+(\d+(?:\.\d{2})?)/i);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'H&M',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping H&M:', error);
    return null;
  }
}

async function scrapeUniqloProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*UNIQLO.*/i, '').trim() : 'Uniqlo Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    return {
      name,
      price,
      image,
      brand: 'Uniqlo',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping Uniqlo:', error);
    return null;
  }
}

async function scrapeASOSProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*ASOS.*/i, '').trim() : 'ASOS Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    return {
      name,
      price,
      image,
      brand: 'ASOS',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping ASOS:', error);
    return null;
  }
}

async function scrapeCOSProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*COS.*/i, '').trim() : 'COS Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    return {
      name,
      price,
      image,
      brand: 'COS',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping COS:', error);
    return null;
  }
}

async function scrapeAmazonProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // Extract from JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let productData = null;
    
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          if (data['@type'] === 'Product' || (Array.isArray(data) && data.find((item: any) => item['@type'] === 'Product'))) {
            productData = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Product') : data;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = productData?.name || (titleMatch ? titleMatch[1].replace(/\s*\|\s*Amazon.*/i, '').trim() : 'Amazon Product');
    
    const price = productData?.offers?.price || undefined;
    const image = productData?.image?.[0] || html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || '';
    
    return {
      name,
      price,
      image,
      brand: extractBrandFromUrl(url),
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping Amazon:', error);
    return null;
  }
}

async function scrapeMacyProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/\s*\|\s*Macy.*/i, '').trim() : 'Macy\'s Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    return {
      name,
      price,
      image,
      brand: 'Macy\'s',
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping Macy\'s:', error);
    return null;
  }
}

async function scrapeGenericProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let productData = null;
    
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          if (data['@type'] === 'Product' || (Array.isArray(data) && data.find((item: any) => item['@type'] === 'Product'))) {
            productData = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Product') : data;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = productData?.name || (titleMatch ? titleMatch[1].trim() : 'Online Product');
    
    const price = productData?.offers?.price || undefined;
    const currency = productData?.offers?.priceCurrency || 'USD';
    
    const image = productData?.image?.[0] || 
                  html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ||
                  html.match(/<meta name="og:image" content="([^"]+)"/i)?.[1] || '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = productData?.description || descMatch?.[1] || '';
    
    return {
      name,
      price,
      currency,
      image,
      description,
      brand: extractBrandFromUrl(url),
      category: detectCategoryFromUrl(url, name)
    };
  } catch (error) {
    console.error('Error scraping generic product:', error);
    return null;
  }
}

function detectCategoryFromUrl(url: string, productName: string = ''): string {
  const combined = `${url.toLowerCase()} ${productName.toLowerCase()}`;
  
  if (combined.includes('dress') || combined.includes('skirt') || combined.includes('gown')) return 'dress';
  if (combined.includes('shirt') || combined.includes('blouse') || combined.includes('top') || 
      combined.includes('blazer') || combined.includes('jacket') || combined.includes('sweater') ||
      combined.includes('hoodie') || combined.includes('cardigan') || combined.includes('vest')) return 'upper';
  if (combined.includes('pants') || combined.includes('jeans') || combined.includes('trousers') || 
      combined.includes('shorts') || combined.includes('leggings')) return 'lower';
  if (combined.includes('shoes') || combined.includes('sneakers') || combined.includes('boots') ||
      combined.includes('heels') || combined.includes('sandals')) return 'shoes';
  
  return 'upper'; // default
}

async function scrapeGapProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    const html = await response.text();
    
    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let productData = null;
    
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          if (data['@type'] === 'Product' || (Array.isArray(data) && data.find((item: any) => item['@type'] === 'Product'))) {
            productData = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Product') : data;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = productData?.name || (titleMatch ? titleMatch[1].replace(/\s*\|\s*(Gap|Banana Republic|Old Navy).*/i, '').trim() : 'Product');
    
    // Try multiple price patterns
    let price: number | undefined;
    const pricePatterns = [
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*\$?\s*(\d+(?:\.\d{2})?)/i,
      /"price"\s*:\s*"?\$?(\d+(?:\.\d{2})?)/i,
      /\$(\d+(?:\.\d{2})?)/,
      /price["\s:]+(\d+(?:\.\d{2})?)/
    ];
    
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        price = parseFloat(match[1]);
        break;
      }
    }
    
    // Use productData price if available
    if (!price && productData?.offers?.price) {
      price = typeof productData.offers.price === 'number' ? productData.offers.price : parseFloat(String(productData.offers.price));
    }
    
    // Try multiple image patterns
    let image = '';
    if (productData?.image) {
      image = Array.isArray(productData.image) ? productData.image[0] : productData.image;
    }
    
    if (!image) {
      const imagePatterns = [
        /<meta property="og:image" content="([^"]+)"/i,
        /<meta name="og:image" content="([^"]+)"/i,
        /<img[^>]*class="[^"]*product[^"]*image[^"]*"[^>]*src="([^"]+)"/i,
        /<img[^>]*data-src="([^"]+)"/i
      ];
      
      for (const pattern of imagePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          image = match[1];
          // Make sure it's a full URL
          if (image.startsWith('//')) {
            image = 'https:' + image;
          } else if (image.startsWith('/')) {
            const urlObj = new URL(url);
            image = urlObj.origin + image;
          }
          break;
        }
      }
    }
    
    // Detect brand from URL
    let brand = 'Gap';
    if (url.includes('bananarepublic')) {
      brand = 'Banana Republic';
    } else if (url.includes('oldnavy')) {
      brand = 'Old Navy';
    } else if (url.includes('athleta')) {
      brand = 'Athleta';
    }
    
    return {
      name,
      price,
      image,
      brand,
      category: detectCategoryFromUrl(url, name),
      description: productData?.description || ''
    };
  } catch (error) {
    console.error('Error scraping Gap product:', error);
    return null;
  }
}

function extractBrandFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    const parts = domain.split('.');
    const mainDomain = parts[parts.length - 2] || parts[0];
    
    // Clean up common patterns
    let brand = mainDomain
      .replace(/^www\./, '')
      .replace(/^shop\./, '')
      .replace(/^store\./, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Handle special cases
    if (domain.includes('amazon')) return 'Amazon';
    if (domain.includes('zara')) return 'Zara';
    if (domain.includes('hm') || domain.includes('h&m')) return 'H&M';
    if (domain.includes('uniqlo')) return 'Uniqlo';
    if (domain.includes('asos')) return 'ASOS';
    if (domain.includes('macy')) return 'Macy\'s';
    if (domain.includes('nordstrom')) return 'Nordstrom';
    if (domain.includes('ssense')) return 'SSENSE';
    if (domain.includes('gapfactory') || domain.includes('gap.com')) return 'Gap';
    if (domain.includes('bananarepublic')) return 'Banana Republic';
    if (domain.includes('oldnavy')) return 'Old Navy';
    
    return brand || 'Online Store';
  } catch (error) {
    return 'Online Store';
  }
}

// Deployment check Sun Nov  9 01:23:08 EST 2025
