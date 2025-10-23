// api/scrape-product/index.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Scraping product from URL:', url);
    
    // Extract domain to determine scraping strategy
    const domain = new URL(url).hostname.toLowerCase();
    
    let productData = null;
    
    if (domain.includes('zara.com')) {
      productData = await scrapeZaraProduct(url);
    } else if (domain.includes('hm.com') || domain.includes('h&m')) {
      productData = await scrapeHMProduct(url);
    } else if (domain.includes('uniqlo.com')) {
      productData = await scrapeUniqloProduct(url);
    } else if (domain.includes('asos.com')) {
      productData = await scrapeASOSProduct(url);
    } else if (domain.includes('cos.com')) {
      productData = await scrapeCOSProduct(url);
    } else {
      // Generic scraping for other stores
      productData = await scrapeGenericProduct(url);
    }
    
    if (productData) {
      return res.status(200).json(productData);
    } else {
      return res.status(404).json({ error: 'Product not found' });
    }
    
  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ error: 'Failed to scrape product' });
  }
}

// Scrape Zara product
async function scrapeZaraProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // Extract product name from title or meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace('| ZARA', '').trim() : 'Zara Product';
    
    // Extract price
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
    // Extract image
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    // Extract description
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'Zara',
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping Zara:', error);
    return null;
  }
}

// Scrape H&M product
async function scrapeHMProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace('| H&M', '').trim() : 'H&M Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
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
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping H&M:', error);
    return null;
  }
}

// Scrape Uniqlo product
async function scrapeUniqloProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace('| UNIQLO', '').trim() : 'Uniqlo Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'Uniqlo',
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping Uniqlo:', error);
    return null;
  }
}

// Scrape ASOS product
async function scrapeASOSProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace('| ASOS', '').trim() : 'ASOS Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'ASOS',
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping ASOS:', error);
    return null;
  }
}

// Scrape COS product
async function scrapeCOSProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace('| COS', '').trim() : 'COS Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'COS',
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping COS:', error);
    return null;
  }
}

// Generic product scraping
async function scrapeGenericProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].trim() : 'Online Product';
    
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : '';
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';
    
    return {
      name,
      price,
      image,
      description,
      brand: 'Online Store',
      category: detectCategoryFromUrl(url),
      buyUrl: url
    };
  } catch (error) {
    console.error('Error scraping generic product:', error);
    return null;
  }
}

// Detect category from URL
function detectCategoryFromUrl(url: string): string {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('dress') || urlLower.includes('skirt')) return 'dress';
  if (urlLower.includes('shirt') || urlLower.includes('blouse') || urlLower.includes('top') || urlLower.includes('blazer') || urlLower.includes('jacket') || urlLower.includes('sweater')) return 'upper';
  if (urlLower.includes('pants') || urlLower.includes('jeans') || urlLower.includes('trousers') || urlLower.includes('shorts')) return 'lower';
  if (urlLower.includes('shoes') || urlLower.includes('sneakers') || urlLower.includes('boots')) return 'shoes';
  
  return 'upper'; // default
}
