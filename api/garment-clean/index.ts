import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import sharp from 'sharp';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' });

  try {
    const buf = await fetch(imageUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b));
    const resized = await sharp(buf).resize({ width: 768, withoutEnlargement: true })
                      .jpeg({ quality: 85 }).toBuffer();
    // MVP: return data URL; later upload to Supabase and return HTTPS
    const dataUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;
    res.json({ cleanUrl: dataUrl });
  } catch (error) {
    console.error('Garment clean error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
};
