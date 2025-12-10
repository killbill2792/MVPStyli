// Import product from URL - extracts product info from any product page
// CONFIGURATION: No API keys needed for basic scraping
// Fallback: Uses PRODUCT_SEARCH_API_KEY (SerpAPI/Google) if direct scraping is blocked

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
  images?: string[];
  productUrl?: string;
  sourceLabel?: string;
  category?: string;
  rating?: number;
  color?: string;
  material?: string;
  garment_des?: string;
  sizeChart?: { size: string; measurements: Record<string, string> }[];
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
    
    // 1. Try direct scraping first
    let productData = await scrapeProductFromUrl(url);
    
    // 2. If direct scraping failed or was blocked (empty or no image), try Search API fallback
    if (!productData || !productData.image || productData.image === '') {
      console.log('Direct scraping failed or blocked. Trying search API fallback...');
      const fallbackData = await scrapeViaSearchFallback(url);
      if (fallbackData) {
        console.log('Fallback scraping successful');
        productData = { ...(productData || {}), ...fallbackData };
      }
    }
    
    if (!productData) {
      return res.status(404).json({ error: 'Could not extract product information. The store might be blocking automated access.' });
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
      images: productData.images || [],
      productUrl: url,
      sourceLabel: productData.brand || extractBrandFromUrl(url),
      category: productData.category || detectCategoryFromUrl(url),
      rating: productData.rating || 4.0,
      color: productData.color,
      material: productData.material,
      garment_des: productData.description || productData.garment_des,
      sizeChart: productData.sizeChart || []
    };

    // Ensure we have at least imageUrl and title - with better fallbacks
    if (!normalized.imageUrl || normalized.imageUrl === '') {
      // Try to get a placeholder or default image
      normalized.imageUrl = 'https://via.placeholder.com/400x600/000000/FFFFFF?text=Product+Image';
    } else {
      // If image URL is relative, make it absolute
      if (!normalized.imageUrl.startsWith('http')) {
        try {
          const urlObj = new URL(url);
          normalized.imageUrl = normalized.imageUrl.startsWith('/') 
            ? `${urlObj.protocol}//${urlObj.host}${normalized.imageUrl}`
            : `${urlObj.protocol}//${urlObj.host}/${normalized.imageUrl}`;
        } catch (e) {
          // Keep original if URL parsing fails
        }
      }
    }
    
    if (!normalized.title || normalized.title === 'Imported Product' || normalized.title.length < 3) {
      // Try to extract from URL path
      const urlParts = url.split('/').filter(p => p && !p.includes('?') && !p.includes('#'));
      const lastPart = urlParts[urlParts.length - 1] || '';
      if (lastPart) {
        normalized.title = lastPart.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') || 'Imported Product';
      }
      if (!normalized.title || normalized.title === 'Imported Product') {
        normalized.title = (normalized.brand || extractBrandFromUrl(url) || 'Online') + ' Product';
      }
    }
    
    // Final check - if still missing critical fields, return error
    if (!normalized.imageUrl || !normalized.title || normalized.title.length < 3) {
      return res.status(404).json({ 
        error: 'Product missing required fields (image or title). Please try a different product page with clear product information.' 
      });
    }

    return res.status(200).json({ item: normalized });
    
  } catch (error: any) {
    console.error('Error importing product from URL:', error);
    return res.status(500).json({ error: 'Failed to import product', details: error.message });
  }
}

// Fallback: Use SerpAPI to search for the URL and get structured data
async function scrapeViaSearchFallback(productUrl: string) {
  try {
    const apiKey = process.env.PRODUCT_SEARCH_API_KEY;
    if (!apiKey) {
      console.log('No PRODUCT_SEARCH_API_KEY available for fallback');
      return null;
    }

    // We search for the specific URL to get the Google Shopping snippet or rich snippet
    const query = encodeURIComponent(productUrl);
    const url = `https://serpapi.com/search.json?engine=google&q=${query}&api_key=${apiKey}&num=1`;
    
    console.log('Calling SerpAPI fallback for URL');
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Check organic results for rich snippets
    const result = data.organic_results?.[0];
    if (result) {
      let price = undefined;
      let currency = 'USD';
      
      // Extract price from rich snippet
      if (result.rich_snippet?.top?.detected_extensions?.price) {
        price = result.rich_snippet.top.detected_extensions.price;
      } else if (result.snippet) {
        const priceMatch = result.snippet.match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) price = parseFloat(priceMatch[1]);
      }

      // Extract image - SerpAPI organic results sometimes have thumbnail
      const image = result.thumbnail || undefined;

      return {
        name: result.title,
        title: result.title,
        price,
        currency,
        image,
        description: result.snippet,
        brand: extractBrandFromUrl(productUrl),
        category: detectCategoryFromUrl(productUrl, result.title)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in search fallback:', error);
    return null;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
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
    
    // Extract ALL product images
    const allImages: string[] = [];
    
    // 1. Get images from JSON-LD (most reliable)
    if (productData?.image) {
      if (Array.isArray(productData.image)) {
        allImages.push(...productData.image.filter((img: any) => typeof img === 'string'));
      } else if (typeof productData.image === 'string') {
        allImages.push(productData.image);
      }
    }
    
    // 2. Get og:image
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    if (ogImageMatch?.[1]) {
      allImages.push(ogImageMatch[1]);
    }
    
    // 3. Extract from gallery/carousel patterns
    const galleryPatterns = [
      /<img[^>]*class="[^"]*(?:gallery|carousel|product|thumbnail|slide)[^"]*"[^>]*src=["']([^"']+)["']/gi,
      /<img[^>]*data-(?:src|lazy|original)=["']([^"']+)["'][^>]*class="[^"]*product[^"]*"/gi,
      /<img[^>]*srcset=["']([^\s"']+)/gi,
      /data-zoom-image=["']([^"']+)["']/gi,
      /data-large-image=["']([^"']+)["']/gi,
      /data-image=["']([^"']+)["']/gi
    ];
    
    for (const pattern of galleryPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1] && !match[1].includes('data:image') && !match[1].includes('placeholder')) {
          allImages.push(match[1]);
        }
      }
    }
    
    // 4. Look for image arrays in JavaScript
    const jsImageArrayMatch = html.match(/(?:images|gallery|photos)\s*[=:]\s*\[([^\]]+)\]/i);
    if (jsImageArrayMatch) {
      const imgUrls = jsImageArrayMatch[1].match(/["']([^"']+(?:\.jpg|\.jpeg|\.png|\.webp)[^"']*)["']/gi);
      if (imgUrls) {
        imgUrls.forEach(url => {
          allImages.push(url.replace(/["']/g, ''));
        });
      }
    }
    
    // Helper to normalize image URL
    const normalizeImageUrl = (imgUrl: string): string => {
      if (!imgUrl || imgUrl.startsWith('data:')) return '';
      if (imgUrl.startsWith('http')) return imgUrl;
      if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
      try {
        const urlObj = new URL(url);
        return imgUrl.startsWith('/') 
          ? `${urlObj.protocol}//${urlObj.host}${imgUrl}`
          : `${urlObj.protocol}//${urlObj.host}/${imgUrl}`;
      } catch (e) {
        return imgUrl;
      }
    };
    
    // Normalize and deduplicate images
    const uniqueImages = [...new Set(
      allImages
        .map(normalizeImageUrl)
        .filter(img => img && img.length > 10 && !img.includes('logo') && !img.includes('icon'))
    )];
    
    const finalImage = uniqueImages[0] || '';
    
    // Ensure we have at least a name (use URL as fallback)
    const finalName = name || (extractBrandFromUrl(url) ? extractBrandFromUrl(url) + ' Product' : 'Online Product');
    
    // If we don't have image or title, try harder to extract them
    let finalTitle = finalName;
    
    // If no images found, try to extract from all img tags
    if (uniqueImages.length === 0) {
      const imgMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
      if (imgMatches && imgMatches.length > 0) {
        for (const imgTag of imgMatches.slice(0, 10)) {
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
          if (srcMatch && srcMatch[1]) {
            const imgUrl = normalizeImageUrl(srcMatch[1]);
            // Prefer larger images (likely product images)
            if (imgUrl && (imgUrl.includes('product') || imgUrl.includes('item') || imgUrl.match(/\d{3,}/))) {
              uniqueImages.push(imgUrl);
            }
          }
        }
      }
    }
    
    // If still no title, use a more descriptive fallback
    if (!finalTitle || finalTitle === 'Online Product' || finalTitle.length < 3) {
      const pathParts = url.split('/').filter(p => p && !p.includes('?') && !p.includes('#'));
      const lastPart = pathParts[pathParts.length - 1] || '';
      if (lastPart) {
        finalTitle = lastPart.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') || 'Imported Product';
      } else {
        finalTitle = extractBrandFromUrl(url) ? `${extractBrandFromUrl(url)} Product` : 'Imported Product';
      }
    }
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = productData?.description || descMatch?.[1] || '';
    
    // Try to extract size chart
    let sizeChart: { size: string; measurements: Record<string, string> }[] = [];
    const sizeChartMatch = html.match(/(?:size\s*chart|measurements)[^<]*<table[^>]*>([\s\S]*?)<\/table>/i);
    if (sizeChartMatch) {
      // Basic extraction - can be enhanced
      const rows = sizeChartMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      if (rows && rows.length > 1) {
        const headerRow = rows[0].match(/<t[hd][^>]*>([^<]*)<\/t[hd]>/gi);
        const headers = headerRow?.map(h => h.replace(/<\/?t[hd][^>]*>/gi, '').trim()) || [];
        
        for (let i = 1; i < Math.min(rows.length, 8); i++) {
          const cells = rows[i].match(/<t[hd][^>]*>([^<]*)<\/t[hd]>/gi);
          if (cells && cells.length > 0) {
            const size = cells[0].replace(/<\/?t[hd][^>]*>/gi, '').trim();
            const measurements: Record<string, string> = {};
            for (let j = 1; j < cells.length && j < headers.length; j++) {
              measurements[headers[j]] = cells[j].replace(/<\/?t[hd][^>]*>/gi, '').trim();
            }
            if (size) {
              sizeChart.push({ size, measurements });
            }
          }
        }
      }
    }
    
    return {
      name: finalTitle,
      title: finalTitle,
      price,
      currency,
      image: uniqueImages[0] || '',
      images: uniqueImages.slice(0, 10), // Limit to 10 images
      description,
      brand: extractBrandFromUrl(url),
      category: detectCategoryFromUrl(url, finalTitle),
      sizeChart
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