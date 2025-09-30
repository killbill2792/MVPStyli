import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    
    const { imageUrl, productId, category } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' });
    
    console.log('Garment clean called with:', { imageUrl, productId, category });
    
    // For now, just return the original URL
    // The client will handle uploading to Supabase if needed
    return res.json({ cleanUrl: imageUrl });
    
  } catch (e: any) {
    console.error('Garment clean error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
};
