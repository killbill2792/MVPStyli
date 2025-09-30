import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    
    // Upload to Supabase and get HTTPS URL
    const fileName = `garments/${productId || Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    
    const { error } = await supabase.storage
      .from('images')
      .upload(fileName, resized, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      // Fallback to original URL if upload fails
      return res.json({ cleanUrl: imageUrl });
    }
    
    const { data } = supabase.storage.from('images').getPublicUrl(fileName);
    return res.json({ cleanUrl: data.publicUrl });
    
  } catch (e: any) {
    console.error('Garment clean error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
};
