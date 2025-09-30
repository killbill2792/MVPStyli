// api/tryon/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log('Tryon API called with:', req.body);
    
    const { human_img, garm_img, category, garment_des } = req.body || {};

    if (!human_img || !garm_img || !category) {
      return res.status(400).json({ error: 'Missing human_img, garm_img or category' });
    }
    if (typeof garm_img !== 'string' || !garm_img.startsWith('http')) {
      return res.status(400).json({ error: 'garm_img_must_be_url' });
    }

    // Map category to Replicate's expected format
    const replicateCategory = category === 'upper' ? 'upper_body' : 
                             category === 'lower' ? 'lower_body' : 
                             category === 'dress' ? 'dresses' : 'upper_body';

    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
    const VERSION_ID = process.env.TRYON_MODEL_ID;

    if (!REPLICATE_TOKEN || !VERSION_ID) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        hasToken: !!REPLICATE_TOKEN,
        hasModelId: !!VERSION_ID
      });
    }

    console.log('Calling Replicate with:', {
      version: VERSION_ID,
      input: {
        human_img,
        garm_img,
        category: replicateCategory,
        garment_des: garment_des || "Garment item"
      }
    });

    const start = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: VERSION_ID,
        input: {
          human_img,
          garm_img,
          category: replicateCategory,
          garment_des: garment_des || "Garment item"
        }
      })
    });

    const json = await start.json();
    console.log('Replicate response:', json);
    
    if (!start.ok) {
      console.error('Replicate start error', json);
      return res.status(500).json({ error: 'replicate_start_failed', detail: json });
    }

    return res.status(200).json({ jobId: (json as any).id });
  } catch (e: any) {
    console.error('Tryon API error:', e);
    return res.status(500).json({ error: 'server_error', detail: e.message });
  }
}
