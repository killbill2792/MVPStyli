/**
 * POST /api/pod-guest-vote
 * Endpoint for guest voting from web
 * No authentication required, but enforces one vote per guest_id per pod
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { podId, choice, guest_id, guest_name, guest_comment, from_user_id, aud } = req.body;

    // Validate required fields
    if (!podId || !choice || !guest_id) {
      return res.status(400).json({ error: 'podId, choice, and guest_id are required' });
    }

    // Validate choice
    if (!['yes', 'maybe', 'no'].includes(choice)) {
      return res.status(400).json({ error: 'choice must be yes, maybe, or no' });
    }

    // Validate audience-specific rules
    if (aud === 'friends') {
      // Friends pods require guest_name
      if (!guest_name || typeof guest_name !== 'string' || guest_name.trim().length === 0) {
        return res.status(400).json({ error: 'guest_name is required for friends pods' });
      }
    }

    // Check if pod exists and is still live
    const { data: pod, error: podError } = await supabase
      .from('pods')
      .select('id, status, ends_at, audience')
      .eq('id', podId)
      .single();

    if (podError || !pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    // Check if pod is still live
    const now = new Date();
    const endsAt = new Date(pod.ends_at);
    const isLive = pod.status === 'live' && endsAt > now;

    if (!isLive) {
      return res.status(400).json({ error: 'Pod has ended' });
    }

    // Check if this guest has already voted (idempotent - return success if already voted)
    const { data: existingVote } = await supabase
      .from('pod_votes')
      .select('id')
      .eq('pod_id', podId)
      .eq('guest_id', guest_id)
      .limit(1)
      .single();

    if (existingVote) {
      // Already voted - return success (idempotent)
      return res.status(200).json({ 
        success: true, 
        message: 'Vote already recorded',
        voteId: existingVote.id 
      });
    }

    // Prepare vote data
    const voteData: any = {
      pod_id: podId,
      choice,
      guest_id,
      vote_source: 'web',
    };

    // Add guest_name if provided (required for friends, optional for others)
    if (guest_name && typeof guest_name === 'string' && guest_name.trim().length > 0) {
      voteData.guest_name = guest_name.trim();
    }

    // Add guest_comment if provided (only for friends pods, but we'll store if provided)
    if (guest_comment && typeof guest_comment === 'string' && guest_comment.trim().length > 0) {
      voteData.guest_comment = guest_comment.trim();
    }

    // Add from_user_id if provided (who shared the link)
    if (from_user_id && typeof from_user_id === 'string') {
      voteData.from_user_id = from_user_id;
    }

    // Insert vote
    const { data: newVote, error: insertError } = await supabase
      .from('pod_votes')
      .insert(voteData)
      .select()
      .single();

    if (insertError) {
      // Check if it's a unique constraint violation (duplicate vote)
      if (insertError.code === '23505' || insertError.message?.includes('unique')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Vote already recorded' 
        });
      }
      console.error('Error inserting guest vote:', insertError);
      return res.status(500).json({ error: 'Failed to record vote', details: insertError.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Vote recorded successfully',
      voteId: newVote.id 
    });
  } catch (error: any) {
    console.error('Error in pod-guest-vote endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

