import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    
    const { imageUrl, productId, category } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' });
    
    console.log('Garment clean called with:', { imageUrl, productId, category });
    
    try {
      // Fetch and process the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const buf = await response.arrayBuffer();
      const buffer = Buffer.from(buf);
      
      const resized = await sharp(buffer)
        .resize({ width: 768, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      console.log('Image processed successfully');
      
      // For now, return the original URL since we don't have Supabase service role key
      // The client will handle uploading to Supabase if needed
      return res.json({ cleanUrl: imageUrl });
      
    } catch (imageError: any) {
      console.error('Image processing error:', imageError);
      // Fallback to original URL if image processing fails
      return res.json({ cleanUrl: imageUrl });
    }
    
  } catch (e: any) {
    console.error('Garment clean error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
};
