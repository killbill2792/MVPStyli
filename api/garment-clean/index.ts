import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting storage (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 10) { // 10 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  const { imageUrl, category, productId } = req.body || {};
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl' });
  }
  
  try {
    console.log(`[${Date.now()}] Garment clean request:`, { productId, category, imageUrl });
    
    // MVP heuristic cleaner: if URL contains packshot keywords, return original
    // Otherwise return original (in production, add person detection/segmentation)
    const isPackshot = /\b(pack|flat|front|product|white|background|isolated)\b/i.test(imageUrl);
    
    const result = {
      cleanUrl: imageUrl,
      method: isPackshot ? 'packshot' : 'original',
      productId,
      category
    };
    
    console.log(`[${Date.now()}] Garment clean result:`, result);
    
    return res.json(result);
  } catch (error) {
    console.error(`[${Date.now()}] Garment clean error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
