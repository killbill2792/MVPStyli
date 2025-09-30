import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    
    const { imageUrl, productId, category } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' });
    
    // Fetch and process the image
    const buf = await fetch(imageUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b));
    const resized = await sharp(buf)
      .resize({ width: 768, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // For now, return the original URL since we don't have Supabase service role key
    // The client will handle uploading to Supabase if needed
    return res.json({ cleanUrl: imageUrl });
    
  } catch (e: any) {
    console.error('Garment clean error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
};
