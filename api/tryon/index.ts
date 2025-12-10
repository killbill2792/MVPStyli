// api/tryon/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Log raw body for debugging
    console.log('🔵 Tryon API called - RAW BODY:', JSON.stringify(req.body));
    
    const { human_img, garm_img, category, garment_des } = req.body || {};

    console.log('📥 EXTRACTED VALUES:', {
      human_img: human_img ? 'present' : 'missing',
      garm_img: garm_img ? 'present' : 'missing', 
      category: category,
      category_type: typeof category
    });

    if (!human_img || !garm_img || !category) {
      return res.status(400).json({ 
        error: 'Missing human_img, garm_img or category',
        received: { human_img: !!human_img, garm_img: !!garm_img, category: category }
      });
    }
    
    if (typeof garm_img !== 'string' || (!garm_img.startsWith('http') && !garm_img.startsWith('data:'))) {
      return res.status(400).json({ error: 'garm_img_must_be_url_or_data_uri' });
    }

    // Valid Replicate categories for IDM-VTON
    const validCategories = ['upper_body', 'lower_body', 'dresses'];
    
    // Use the category as-is if valid, otherwise error out (don't silently default)
    if (!validCategories.includes(category)) {
      console.log('❌ Invalid category received:', category);
      return res.status(400).json({ 
        error: 'Invalid category',
        received: category,
        valid_options: validCategories
      });
    }
    
    const replicateCategory = category; // Use as-is, already validated
    console.log('✅ CATEGORY TO SEND TO REPLICATE:', replicateCategory);

    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
    const VERSION_ID = process.env.TRYON_MODEL_ID;

    if (!REPLICATE_TOKEN || !VERSION_ID) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        hasToken: !!REPLICATE_TOKEN,
        hasModelId: !!VERSION_ID
      });
    }

    // Build the request body
    const replicateRequestBody = {
      version: VERSION_ID,
      input: {
        human_img,
        garm_img,
        category: replicateCategory,
        garment_des: garment_des || "Garment item"
      }
    };
    
    console.log('📤 SENDING TO REPLICATE:', JSON.stringify(replicateRequestBody, null, 2));

    const start = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(replicateRequestBody)
    });

    const json = await start.json();
    console.log('📥 REPLICATE RESPONSE:', JSON.stringify(json));
    
    if (!start.ok) {
      console.error('Replicate start error', json);
      return res.status(500).json({ error: 'replicate_start_failed', detail: json });
    }

    // Return jobId AND the category that was sent (for client-side verification)
    return res.status(200).json({ 
      jobId: (json as any).id,
      categorySent: replicateCategory // So client can verify
    });
  } catch (e: any) {
    console.error('Tryon API error:', e);
    return res.status(500).json({ error: 'server_error', detail: e.message });
  }
}
