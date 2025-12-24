/**
 * Invite claiming logic
 * Handles friend connections and pod access after user signs up via invite link
 */

import { supabase } from './supabase';
import { sendFriendRequest, areFriends } from './friends';
import { createPodInvites } from './pods';

/**
 * Claim an invite after user logs in
 * Creates friend connection and optionally grants pod access
 * Idempotent: won't create duplicates if already friends/invited
 */
export async function claimInvite(invite, currentUserId) {
  if (!invite || !currentUserId || !invite.fromUserId) {
    return { success: false, message: 'Invalid invite data' };
  }

  // Don't create self-friendship
  if (invite.fromUserId === currentUserId) {
    return { success: false, message: 'Cannot invite yourself' };
  }

  try {
    // Step 1: Create friend connection (idempotent)
    const alreadyFriends = await areFriends(currentUserId, invite.fromUserId);
    
    if (!alreadyFriends) {
      // Send friend request - this will auto-accept if mutual
      const result = await sendFriendRequest(currentUserId, invite.fromUserId);
      
      if (!result.success) {
        console.log('Failed to create friend connection:', result);
        // Continue anyway - pod access might still work
      } else {
        console.log('Friend connection created:', result.isMutual ? 'mutual' : 'pending');
      }
    } else {
      console.log('Users already friends, skipping friend connection');
    }

    // Step 2: If it's a pod invite, grant access to the pod
    if (invite.type === 'pod' && invite.podId) {
      try {
        // Check if pod exists
        const { data: pod, error: podError } = await supabase
          .from('pods')
          .select('id, owner_id, audience')
          .eq('id', invite.podId)
          .single();

        if (podError || !pod) {
          console.log('Pod not found or error:', podError);
          // Still return success for friend connection
          return { success: true, message: 'Friend connection created, but pod not found' };
        }

        // Create pod invite if it doesn't exist
        // This uses the existing createPodInvites function which is idempotent
        const podInviteResult = await createPodInvites(invite.podId, [currentUserId], invite.fromUserId);
        
        if (podInviteResult) {
          console.log('Pod access granted via invite');
        } else {
          console.log('Failed to create pod invite, but friend connection succeeded');
        }
      } catch (podError) {
        console.error('Error granting pod access:', podError);
        // Friend connection still succeeded, so return success
      }
    }

    return { success: true, message: invite.type === 'pod' ? 'Friend connection and pod access granted' : 'Friend connection created' };
  } catch (error) {
    console.error('Error claiming invite:', error);
    return { success: false, message: 'Failed to claim invite' };
  }
}

