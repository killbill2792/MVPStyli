import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    status: 'ok', 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env: {
      hasReplicateToken: !!process.env.REPLICATE_API_TOKEN,
      hasModelId: !!process.env.TRYON_MODEL_ID,
      hasSupabaseUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing'
    }
  });
}
