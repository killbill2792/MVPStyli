/**
 * Suggested Products API
 * Returns products classified into specific season + color group
 * Uses pre-computed classification stored in database
 * 
 * Query parameters:
 * - season: 'spring' | 'summer' | 'autumn' | 'winter' (parent season, required)
 * - microSeason: 'light_spring' | 'warm_spring' | etc. (optional, more specific)
 * - group: 'neutrals' | 'accents' | 'brights' | 'softs' (required)
 * - limit: number (default: 20)
 * - minDeltaE: number (optional, filter by max deltaE)
 * - includeSecondary: 'true' | 'false' (default: 'true', include products with matching secondary season)
 * 
 * Products are returned if:
 * - Primary season matches AND status is 'great' or 'good', OR
 * - Secondary season matches AND status is 'great' or 'good' (crossover products)
 * 
 * Products with status 'ambiguous' or 'unclassified' are excluded.
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
    const { season, microSeason, group, limit, minDeltaE, includeSecondary } = req.query;

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

    // Validate microSeason if provided
    const validMicroSeasons = [
      'light_spring', 'warm_spring', 'bright_spring',
      'soft_summer', 'cool_summer', 'light_summer',
      'deep_autumn', 'soft_autumn', 'warm_autumn',
      'bright_winter', 'cool_winter', 'deep_winter'
    ];
    if (microSeason && !validMicroSeasons.includes(microSeason as string)) {
      return res.status(400).json({ 
        error: 'Invalid microSeason',
        message: `microSeason must be one of: ${validMicroSeasons.join(', ')}`
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

    // Parse includeSecondary (default: true)
    const shouldIncludeSecondary = includeSecondary !== 'false';

    // Classification statuses to include: 'great' and 'good' (not 'ambiguous' or 'unclassified')
    const validStatuses = ['great', 'good'];

    // We need to run two queries if includeSecondary is true:
    // 1. Primary season matches
    // 2. Secondary season matches (crossover products)
    
    let allGarments: any[] = [];

    // Query 1: Primary season matches (matching group_tag required)
    let primaryQuery = supabase
      .from('garments')
      .select('*')
      .eq('group_tag', group)
      .in('classification_status', validStatuses)
      .eq('is_active', true);

    // Query by micro-season if provided (more accurate), otherwise by parent season
    if (microSeason) {
      primaryQuery = primaryQuery.eq('micro_season_tag', microSeason);
    } else {
      primaryQuery = primaryQuery.eq('season_tag', season);
    }

    // Apply minDeltaE filter if provided
    if (minDeltaENum !== null) {
      primaryQuery = primaryQuery.lte('min_delta_e', minDeltaENum);
    }

    const { data: primaryGarments, error: primaryError } = await primaryQuery;

    if (primaryError) {
      console.error('Error fetching primary products:', primaryError);
      return res.status(500).json({ 
        error: 'Database error',
        details: primaryError.message 
      });
    }

    // Add primary matches with a flag
    if (primaryGarments) {
      allGarments = primaryGarments.map(g => ({ ...g, matchType: 'primary' }));
    }

    // Query 2: Secondary season matches (crossover products)
    if (shouldIncludeSecondary) {
      let secondaryQuery = supabase
        .from('garments')
        .select('*')
        .eq('secondary_group_tag', group)
        .in('classification_status', validStatuses)
        .eq('is_active', true);

      // Query by secondary season
      if (microSeason) {
        secondaryQuery = secondaryQuery.eq('secondary_micro_season_tag', microSeason);
      } else {
        secondaryQuery = secondaryQuery.eq('secondary_season_tag', season);
      }

      // Apply minDeltaE filter using secondary_delta_e
      if (minDeltaENum !== null) {
        secondaryQuery = secondaryQuery.lte('secondary_delta_e', minDeltaENum);
      }

      const { data: secondaryGarments, error: secondaryError } = await secondaryQuery;

      if (secondaryError) {
        console.error('Error fetching secondary products:', secondaryError);
        // Don't fail the whole request, just skip secondary results
      } else if (secondaryGarments) {
        // Add secondary matches, but skip duplicates (already in primary)
        const primaryIds = new Set(allGarments.map(g => g.id));
        const newSecondary = secondaryGarments
          .filter(g => !primaryIds.has(g.id))
          .map(g => ({ ...g, matchType: 'secondary' }));
        allGarments = [...allGarments, ...newSecondary];
      }
    }

    // Sort all garments: 
    // 1. Primary matches first (they're better matches for this season)
    // 2. Then by classification_status ('great' before 'good')
    // 3. Then by min_delta_e (lower is better)
    allGarments.sort((a, b) => {
      // Primary matches first
      if (a.matchType === 'primary' && b.matchType !== 'primary') return -1;
      if (a.matchType !== 'primary' && b.matchType === 'primary') return 1;
      
      // 'great' status before 'good'
      if (a.classification_status === 'great' && b.classification_status !== 'great') return -1;
      if (a.classification_status !== 'great' && b.classification_status === 'great') return 1;
      
      // Lower deltaE is better (use appropriate deltaE based on match type)
      const aDeltaE = a.matchType === 'secondary' ? (a.secondary_delta_e || 999) : (a.min_delta_e || 999);
      const bDeltaE = b.matchType === 'secondary' ? (b.secondary_delta_e || 999) : (b.min_delta_e || 999);
      return aDeltaE - bDeltaE;
    });

    // Apply limit
    const limitedGarments = allGarments.slice(0, limitNum);

    // Return results
    return res.status(200).json({
      products: limitedGarments,
      count: limitedGarments.length,
      totalBeforeLimit: allGarments.length,
      season,
      group,
      limit: limitNum,
      includesSecondary: shouldIncludeSecondary,
    });

  } catch (error: any) {
    console.error('Error in suggested-products API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
