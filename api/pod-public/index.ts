/**
 * GET /api/pod-public
 * Public endpoint to get pod information for web voting
 * No authentication required
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS helper function
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://stylit.ai');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers first, before any returns
  setCors(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { podId } = req.query;

    if (!podId || typeof podId !== 'string') {
      return res.status(400).json({ error: 'podId is required' });
    }

    // Fetch pod (public read - no auth required)
    const { data: pod, error: podError } = await supabase
      .from('pods')
      .select('id, title, image_url, ends_at, status, audience, created_at')
      .eq('id', podId)
      .single();

    if (podError || !pod) {
      console.error('Error fetching pod:', podError);
      return res.status(404).json({ error: 'Pod not found' });
    }

    // Check if pod is still live
    const now = new Date();
    const endsAt = new Date(pod.ends_at);
    const isLive = pod.status === 'live' && endsAt > now;

    // Return public pod info
    return res.status(200).json({
      id: pod.id,
      title: pod.title,
      image_url: pod.image_url,
      ends_at: pod.ends_at,
      status: pod.status,
      audience: pod.audience,
      isLive,
      created_at: pod.created_at,
    });
  } catch (error: any) {
    console.error('Error in pod-public endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

