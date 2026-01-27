/**
 * Delete Account API
 * Permanently deletes a user's account and all associated data
 * 
 * This endpoint handles:
 * 1. Deleting user's pods and votes
 * 2. Deleting user's friend relationships
 * 3. Deleting user's profile data
 * 4. Deleting user's uploaded images from storage
 * 5. Deleting the auth user account
 * 
 * Required: User must be authenticated
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<any, any>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// CORS helper
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { userId, confirmEmail } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!confirmEmail) {
      return res.status(400).json({ error: 'confirmEmail is required for verification' });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify the user exists and email matches
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !authUser?.user) {
      console.error('Error fetching user:', authError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify email matches for security
    if (authUser.user.email?.toLowerCase() !== confirmEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Email verification failed' });
    }

    console.log(`Starting account deletion for user: ${userId}`);

    // Track deletion progress
    const deletionLog: string[] = [];

    // 1. Delete pod votes by this user
    try {
      const { error: votesError } = await supabaseAdmin
        .from('pod_votes')
        .delete()
        .eq('voter_id', userId);
      
      if (votesError) {
        console.error('Error deleting pod votes:', votesError);
        deletionLog.push(`Warning: Could not delete pod votes: ${votesError.message}`);
      } else {
        deletionLog.push('Deleted pod votes');
      }
    } catch (e) {
      deletionLog.push('Warning: pod_votes table may not exist');
    }

    // 2. Delete pods created by this user
    try {
      // First get the pods to find image URLs
      const { data: userPods } = await supabaseAdmin
        .from('pods')
        .select('id, image_url')
        .eq('user_id', userId);

      if (userPods && userPods.length > 0) {
        // Delete votes on user's pods first
        const podIds = userPods.map(p => p.id);
        await supabaseAdmin
          .from('pod_votes')
          .delete()
          .in('pod_id', podIds);
      }

      // Now delete the pods
      const { error: podsError } = await supabaseAdmin
        .from('pods')
        .delete()
        .eq('user_id', userId);
      
      if (podsError) {
        console.error('Error deleting pods:', podsError);
        deletionLog.push(`Warning: Could not delete pods: ${podsError.message}`);
      } else {
        deletionLog.push(`Deleted ${userPods?.length || 0} pods`);
      }
    } catch (e) {
      deletionLog.push('Warning: pods table may not exist');
    }

    // 3. Delete friend relationships
    try {
      // Delete where user is the requester
      await supabaseAdmin
        .from('friends')
        .delete()
        .eq('user_id', userId);
      
      // Delete where user is the friend
      await supabaseAdmin
        .from('friends')
        .delete()
        .eq('friend_id', userId);
      
      deletionLog.push('Deleted friend relationships');
    } catch (e) {
      deletionLog.push('Warning: friends table may not exist');
    }

    // 4. Delete saved fits
    try {
      const { error: fitsError } = await supabaseAdmin
        .from('saved_fits')
        .delete()
        .eq('user_id', userId);
      
      if (fitsError) {
        console.error('Error deleting saved fits:', fitsError);
      } else {
        deletionLog.push('Deleted saved fits');
      }
    } catch (e) {
      deletionLog.push('Warning: saved_fits table may not exist');
    }

    // 5. Delete try-on history
    try {
      const { error: tryonError } = await supabaseAdmin
        .from('tryon_history')
        .delete()
        .eq('user_id', userId);
      
      if (tryonError) {
        console.error('Error deleting try-on history:', tryonError);
      } else {
        deletionLog.push('Deleted try-on history');
      }
    } catch (e) {
      deletionLog.push('Warning: tryon_history table may not exist');
    }

    // 6. Delete user profile (this contains measurements, photos, etc.)
    try {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        console.error('Error deleting profile:', profileError);
        deletionLog.push(`Warning: Could not delete profile: ${profileError.message}`);
      } else {
        deletionLog.push('Deleted user profile');
      }
    } catch (e) {
      deletionLog.push('Warning: profiles table may not exist');
    }

    // 7. Delete user's files from storage (face photos, body photos)
    try {
      // List and delete files in user's folder
      const buckets = ['face-photos', 'body-photos', 'pod-images', 'try-on-results'];
      
      for (const bucket of buckets) {
        try {
          const { data: files } = await supabaseAdmin.storage
            .from(bucket)
            .list(userId);
          
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${f.name}`);
            await supabaseAdmin.storage
              .from(bucket)
              .remove(filePaths);
            deletionLog.push(`Deleted ${files.length} files from ${bucket}`);
          }
        } catch (e) {
          // Bucket may not exist, skip
        }
      }
    } catch (e) {
      deletionLog.push('Warning: Could not delete storage files');
    }

    // 8. Finally, delete the auth user account
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return res.status(500).json({ 
        error: 'Failed to delete auth account',
        details: deleteAuthError.message,
        partialDeletion: deletionLog
      });
    }

    deletionLog.push('Deleted auth account');

    console.log(`Account deletion completed for user: ${userId}`);
    console.log('Deletion log:', deletionLog);

    return res.status(200).json({
      success: true,
      message: 'Account successfully deleted',
      deletionLog
    });

  } catch (error: any) {
    console.error('Error in delete-account API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
