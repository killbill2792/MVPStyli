/**
 * Suggested Products API
 * Returns products classified into specific season + color group
 * Uses pre-computed classification stored in database
 * 
 * Query parameters:
 * - season: 'spring' | 'summer' | 'autumn' | 'winter'
 * - group: 'neutrals' | 'accents' | 'brights' | 'softs'
 * - limit: number (default: 20)
 * - minDeltaE: number (optional, filter by max deltaE)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL or SUPABASE_ANON_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// CORS helper
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers first
  setCors(res);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const supabase = getSupabaseClient();
    const { season, group, limit, minDeltaE } = req.query;

    // Validate required parameters
    if (!season || !group) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both season and group query parameters are required.',
        example: '/api/suggested-products?season=spring&group=accents'
      });
    }

    // Validate season
    const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
    if (!validSeasons.includes(season as string)) {
      return res.status(400).json({ 
        error: 'Invalid season',
        message: `season must be one of: ${validSeasons.join(', ')}`
      });
    }

    // Validate group
    const validGroups = ['neutrals', 'accents', 'brights', 'softs'];
    if (!validGroups.includes(group as string)) {
      return res.status(400).json({ 
        error: 'Invalid group',
        message: `group must be one of: ${validGroups.join(', ')}`
      });
    }

    // Parse limit (default: 20)
    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'Invalid limit',
        message: 'limit must be a number between 1 and 100'
      });
    }

    // Parse minDeltaE (optional filter)
    const minDeltaENum = minDeltaE ? parseFloat(minDeltaE as string) : null;
    if (minDeltaE && (isNaN(minDeltaENum!) || minDeltaENum! < 0)) {
      return res.status(400).json({ 
        error: 'Invalid minDeltaE',
        message: 'minDeltaE must be a positive number'
      });
    }

    // Build query
    let query = supabase
      .from('garments')
      .select('*')
      .eq('season_tag', season)
      .eq('group_tag', group)
      .eq('classification_status', 'ok') // Only return successfully classified products
      .eq('is_active', true) // Only active garments
      .order('min_delta_e', { ascending: true }); // Best matches first (lower ΔE = better match)

    // Apply minDeltaE filter if provided
    if (minDeltaENum !== null) {
      query = query.lte('min_delta_e', minDeltaENum);
    }

    // Apply limit
    query = query.limit(limitNum);

    // Execute query
    const { data: garments, error } = await query;

    if (error) {
      console.error('Error fetching suggested products:', error);
      return res.status(500).json({ 
        error: 'Database error',
        details: error.message 
      });
    }

    // Return results
    return res.status(200).json({
      products: garments || [],
      count: garments?.length || 0,
      season,
      group,
      limit: limitNum,
    });

  } catch (error: any) {
    console.error('Error in suggested-products API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
