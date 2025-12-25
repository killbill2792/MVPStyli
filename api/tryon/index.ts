// api/tryon/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Log raw body for debugging
    console.log('🔵 Tryon API called - RAW BODY:', JSON.stringify(req.body));
    
    const { human_img, garm_img, category, garment_des, garment_id } = req.body || {};

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

    // Fetch garment dimensions from database if garment_id is provided
    let garmentDimensions = null;
    let enhancedGarmentDes = garment_des || "Garment item";
    
    if (garment_id) {
      try {
        const { data: garment, error: garmentError } = await supabase
          .from('garments')
          .select('*')
          .eq('id', garment_id)
          .single();

        if (!garmentError && garment) {
          garmentDimensions = garment;
          
          // Build enhanced garment description with dimensions
          const dims = [];
          if (garment.chest) dims.push(`Chest: ${garment.chest}cm`);
          if (garment.waist) dims.push(`Waist: ${garment.waist}cm`);
          if (garment.hip) dims.push(`Hip: ${garment.hip}cm`);
          if (garment.front_length) dims.push(`Front Length: ${garment.front_length}cm`);
          if (garment.back_length) dims.push(`Back Length: ${garment.back_length}cm`);
          if (garment.sleeve_length) dims.push(`Sleeve Length: ${garment.sleeve_length}cm`);
          if (garment.back_width) dims.push(`Back Width: ${garment.back_width}cm`);
          if (garment.arm_width) dims.push(`Arm Width: ${garment.arm_width}cm`);
          if (garment.shoulder_width) dims.push(`Shoulder Width: ${garment.shoulder_width}cm`);
          if (garment.front_rise) dims.push(`Front Rise: ${garment.front_rise}cm`);
          if (garment.back_rise) dims.push(`Back Rise: ${garment.back_rise}cm`);
          if (garment.inseam) dims.push(`Inseam: ${garment.inseam}cm`);
          if (garment.outseam) dims.push(`Outseam: ${garment.outseam}cm`);
          
          if (dims.length > 0) {
            enhancedGarmentDes = `${garment.name || "Garment"} - ${dims.join(', ')}`;
          } else {
            enhancedGarmentDes = garment.name || garment_des || "Garment item";
          }
          
          console.log('✅ Fetched garment dimensions:', {
            name: garment.name,
            category: garment.category,
            dimensions: dims.length
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch garment dimensions:', error);
        // Continue without dimensions - non-critical
      }
    }

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
        garment_des: enhancedGarmentDes
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

    // Return jobId, category, and garment dimensions if available
    return res.status(200).json({ 
      jobId: (json as any).id,
      categorySent: replicateCategory, // So client can verify
      garmentDimensions: garmentDimensions ? {
        chest: garmentDimensions.chest,
        waist: garmentDimensions.waist,
        hip: garmentDimensions.hip,
        front_length: garmentDimensions.front_length,
        back_length: garmentDimensions.back_length,
        sleeve_length: garmentDimensions.sleeve_length,
        back_width: garmentDimensions.back_width,
        arm_width: garmentDimensions.arm_width,
        shoulder_width: garmentDimensions.shoulder_width,
        front_rise: garmentDimensions.front_rise,
        back_rise: garmentDimensions.back_rise,
        inseam: garmentDimensions.inseam,
        outseam: garmentDimensions.outseam,
      } : null
    });
  } catch (e: any) {
    console.error('Tryon API error:', e);
    return res.status(500).json({ error: 'server_error', detail: e.message });
  }
}
