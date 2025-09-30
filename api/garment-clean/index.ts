import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

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
      
      // Upload processed image to Supabase
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
      console.log('Uploaded to Supabase:', data.publicUrl);
      return res.json({ cleanUrl: data.publicUrl });
      
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
