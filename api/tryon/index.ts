import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN!;
const MODEL_ID = process.env.TRYON_MODEL_ID!;

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const dailyLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, userId?: string): boolean {
  const now = Date.now();
  
  // Per-minute limit
  const limit = rateLimitMap.get(ip);
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
  } else if (limit.count >= 10) {
    return false;
  } else {
    limit.count++;
  }
  
  // Daily limit (3 for guests, 10 for signed-in users)
  const dailyLimit = dailyLimitMap.get(userId || ip);
  if (!dailyLimit || now > dailyLimit.resetTime) {
    dailyLimitMap.set(userId || ip, { count: 1, resetTime: now + 86400000 }); // 24 hours
  } else {
    const maxDaily = userId ? 10 : 3; // Signed-in users get more
    if (dailyLimit.count >= maxDaily) {
      return false;
    }
    dailyLimit.count++;
  }
  
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
  
  const { userUrl, garmentUrl, category } = req.body || {};
  
  if (!userUrl || !garmentUrl) {
    return res.status(400).json({ error: 'Missing userUrl or garmentUrl' });
  }
  
  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown';
  const userId = req.headers['x-user-id'] as string; // Optional user ID from auth
  if (!checkRateLimit(clientIP, userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  try {
    console.log(`[${Date.now()}] Try-on start request:`, { userUrl, garmentUrl, category });
    
    // Call Replicate API
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: MODEL_ID,
        input: {
          person_image: userUrl,
          cloth_image: garmentUrl,
          category: category || 'upper'
        }
      })
    });
    
    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error(`[${Date.now()}] Replicate API error:`, errorText);
      throw new Error(`Replicate API error: ${errorText}`);
    }
    
    const replicateResult = await replicateResponse.json();
    console.log(`[${Date.now()}] Try-on job created:`, replicateResult.id);
    
    return res.json({ jobId: replicateResult.id });
  } catch (error) {
    console.error(`[${Date.now()}] Try-on start error:`, error);
    return res.status(500).json({ error: 'Failed to start try-on' });
  }
}
