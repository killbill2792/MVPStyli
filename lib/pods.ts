import { supabase } from './supabase';
import { trackEvent, getStyleTwins } from './styleEngine';

export interface Pod {
  id: string;
  owner_id: string;
  image_url: string;
  audience: 'friends' | 'style_twins' | 'global_mix';
  duration_mins: number;
  status: 'live' | 'expired';
  created_at: string;
  ends_at: string;
  title: string;
  summary?: string;
  product_url?: string;
}

export interface PodVote {
  id: string;
  pod_id: string;
  voter_id?: string;
  choice: 'yes' | 'maybe' | 'no';
  created_at: string;
}

export interface PodComment {
  id: string;
  pod_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface PodInvite {
  id: string;
  pod_id: string;
  from_user: string;
  to_user: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  payload: any;
  read: boolean;
  created_at: string;
}

// Create a new pod
export const createPod = async (podData: Omit<Pod, 'id' | 'created_at' | 'status'>): Promise<Pod | null> => {
  try {
    console.log('Creating pod with data:', podData);
    
    // Validate required fields
    if (!podData.owner_id || !podData.image_url || !podData.audience || !podData.title) {
      console.error('Missing required pod data:', podData);
      throw new Error('Missing required fields for pod creation');
    }
    
    const { data, error } = await supabase
      .from('pods')
      .insert({
        ...podData,
        status: 'live',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating pod:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log('Pod created successfully:', data);
    return data;
  } catch (error: any) {
    console.error('Error creating pod:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    return null;
  }
};

// Get pod by ID
export const getPod = async (podId: string): Promise<Pod | null> => {
  try {
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('id', podId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching pod:', error);
    return null;
  }
};

// Get votes for a pod with voter profile info
export const getPodVotes = async (podId: string): Promise<PodVote[]> => {
  try {
    // Simple query without foreign key join
    const { data, error } = await supabase
      .from('pod_votes')
      .select('*')
      .eq('pod_id', podId);

    if (error) {
      console.log('Pod votes error:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching pod votes:', error);
    return [];
  }
};

// Submit a vote
export const submitVote = async (podId: string, choice: 'yes' | 'maybe' | 'no', voterId?: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pod_votes')
      .insert({
        pod_id: podId,
        voter_id: voterId,
        choice,
      });

    if (error) throw error;

    // Track event for style profile
    if (voterId) {
      // We need to fetch the pod to get product info
      const { data: pod } = await supabase.from('pods').select('product_url, image_url').eq('id', podId).single();
      
      // Determine event type
      const eventType = choice === 'yes' ? 'vote_yes' : choice === 'maybe' ? 'vote_maybe' : 'vote_no';
      
      // Track it (fire and forget)
      trackEvent(voterId, eventType, {
        id: podId, // Use pod ID as proxy if product ID unknown, or we need product ID on pod
        url: pod?.product_url,
        image: pod?.image_url,
        // Tags/Colors/Category should ideally be on the Pod or fetched from product. 
        // For now trackEvent helper tries to infer from what it has.
      });
    }

    return true;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return false;
  }
};

// Get comments for a pod (friends only)
export const getPodComments = async (podId: string): Promise<PodComment[]> => {
  try {
    const { data, error } = await supabase
      .from('pod_comments')
      .select('*')
      .eq('pod_id', podId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pod comments:', error);
    return [];
  }
};

// Add a comment
export const addComment = async (podId: string, authorId: string, body: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pod_comments')
      .insert({
        pod_id: podId,
        author_id: authorId,
        body,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error adding comment:', error);
    return false;
  }
};

// Get user's active pods
export const getUserActivePods = async (userId: string): Promise<Pod[]> => {
  try {
    console.log('Fetching active pods for user:', userId);
    
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('owner_id', userId)
      .eq('status', 'live')
      .order('ends_at', { ascending: true });

    if (error) {
      console.error('Supabase error fetching active pods:', error);
      throw error;
    }
    
    // Filter out pods with invalid or missing image URLs
    const validPods = (data || []).filter(pod => {
      const hasValidImage = pod.image_url && 
                           typeof pod.image_url === 'string' && 
                           pod.image_url.startsWith('http');
      if (!hasValidImage) {
        console.log('⚠️ Filtering out pod with invalid image:', pod.id, pod.image_url);
      }
      return hasValidImage;
    });
    
    console.log('Active pods fetched successfully:', validPods.length, 'valid out of', data?.length || 0);
    return validPods;
  } catch (error) {
    console.error('Error fetching user active pods:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

// Get user's past pods
export const getUserPastPods = async (userId: string): Promise<Pod[]> => {
  try {
    console.log('Fetching past pods for user:', userId);
    
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('owner_id', userId)
      .eq('status', 'expired')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching past pods:', error);
      throw error;
    }
    
    // Filter out pods with invalid or missing image URLs
    const validPods = (data || []).filter(pod => {
      const hasValidImage = pod.image_url && 
                           typeof pod.image_url === 'string' && 
                           pod.image_url.startsWith('http');
      if (!hasValidImage) {
        console.log('⚠️ Filtering out pod with invalid image:', pod.id, pod.image_url);
      }
      return hasValidImage;
    });
    
    console.log('Past pods fetched successfully:', validPods.length, 'valid out of', data?.length || 0);
    return validPods;
  } catch (error) {
    console.error('Error fetching user past pods:', error);
    return [];
  }
};

// Get user's pending invites (by user ID)
export const getUserInvites = async (userId: string): Promise<PodInvite[]> => {
  if (!userId || userId.length < 30) return [];
  
  try {
    const { data, error } = await supabase
      .from('pod_invites')
      .select('*')
      .eq('to_user', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return [];
      if (error.code === '22P02') return [];
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching user invites:', error);
    return [];
  }
};

// Get pods for invites (with full pod details)
export const getInvitedPods = async (userId: string): Promise<Pod[]> => {
  if (!userId || userId.length < 30) return [];
  
  try {
    // First get invite pod IDs
    const { data: invites, error: inviteError } = await supabase
      .from('pod_invites')
      .select('pod_id')
      .eq('to_user', userId);

    if (inviteError || !invites || invites.length === 0) return [];

    // Then fetch the actual pods
    const podIds = invites.map(i => i.pod_id);
    const { data: pods, error: podsError } = await supabase
      .from('pods')
      .select('*')
      .in('id', podIds)
      .order('created_at', { ascending: false });

    if (podsError) throw podsError;
    
    // Filter out pods with invalid or missing image URLs
    const validPods = (pods || []).filter(pod => {
      return pod.image_url && 
             typeof pod.image_url === 'string' && 
             pod.image_url.startsWith('http');
    });
    
    return validPods;
  } catch (error) {
    console.error('Error fetching invited pods:', error);
    return [];
  }
};

// Accept an invite
export const acceptInvite = async (inviteId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pod_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error accepting invite:', error);
    return false;
  }
};

// Decline an invite
export const declineInvite = async (inviteId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pod_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error declining invite:', error);
    return false;
  }
};

// Expire a pod
export const expirePod = async (podId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pods')
      .update({ status: 'expired' })
      .eq('id', podId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error expiring pod:', error);
    return false;
  }
};

// Delete a pod completely (cascade delete related records)
export const deletePod = async (podId: string): Promise<boolean> => {
  if (!podId) {
    console.error('deletePod: No podId provided');
    return false;
  }
  
  try {
    console.log('🗑️ Starting pod deletion:', podId);
    
    // Delete related records first (even though CASCADE should handle this)
    // This ensures clean deletion even if CASCADE isn't set up
    try {
      const { error: votesError } = await supabase
        .from('pod_votes')
        .delete()
        .eq('pod_id', podId);
      console.log('Votes delete result:', votesError ? votesError.message : 'success');
    } catch (e) {
      console.log('Votes delete skipped');
    }
    
    try {
      const { error: commentsError } = await supabase
        .from('pod_comments')
        .delete()
        .eq('pod_id', podId);
      console.log('Comments delete result:', commentsError ? commentsError.message : 'success');
    } catch (e) {
      console.log('Comments delete skipped');
    }
    
    try {
      const { error: invitesError } = await supabase
        .from('pod_invites')
        .delete()
        .eq('pod_id', podId);
      console.log('Invites delete result:', invitesError ? invitesError.message : 'success');
    } catch (e) {
      console.log('Invites delete skipped');
    }
    
    // Now delete the pod itself (hard delete)
    console.log('🗑️ Deleting pod record...');
    const { error } = await supabase
      .from('pods')
      .delete()
      .eq('id', podId);
    
    if (error) {
      console.error('❌ Error deleting pod:', error.message, error.code, error.details);
      // Check if it's an RLS error
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('⚠️ RLS policy issue. Run FIX_POD_DELETION.sql in Supabase.');
      }
      throw error;
    }
    
    // Verify deletion by trying to fetch the pod
    const { data: verifyData } = await supabase
      .from('pods')
      .select('id')
      .eq('id', podId)
      .single();
    
    if (verifyData) {
      console.error('❌ Pod still exists after deletion! This is likely an RLS issue.');
      return false;
    }
    
    console.log('✅ Pod deleted and verified:', podId);
    return true;
  } catch (error: any) {
    console.error('❌ Error in deletePod:', error?.message || error);
    return false;
  }
};

// Subscribe to pod votes (realtime)
export const subscribeToPodVotes = (podId: string, callback: (votes: PodVote[]) => void) => {
  const subscription = supabase
    .channel(`pod_votes_${podId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'pod_votes', filter: `pod_id=eq.${podId}` },
      async () => {
        const votes = await getPodVotes(podId);
        callback(votes);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
};

// Create pod invites for friends
export const createPodInvites = async (podId: string, friendIds: string[], fromUserId: string): Promise<boolean> => {
  if (!podId || !fromUserId || friendIds.length === 0) {
    console.log('Skipping pod invites - missing required data');
    return true;
  }
  
  // Filter out invalid UUIDs (demo friend IDs like 'esther-id' are not valid)
  const validFriendIds = friendIds.filter(id => {
    // UUID format check - must be 36 chars with dashes
    return id && id.length >= 30 && !id.includes('demo') && !id.endsWith('-id');
  });
  
  if (validFriendIds.length === 0) {
    console.log('No valid friend IDs to invite (demo friends skipped)');
    return true;
  }
  
  try {
    const invites = validFriendIds.map(friendId => ({
      pod_id: podId,
      to_user: friendId,
      from_user: fromUserId,
      status: 'pending' as const,
    }));

    const { error } = await supabase
      .from('pod_invites')
      .insert(invites);

    if (error) {
      // If table doesn't exist, that's ok
      if (error.code === '42P01') {
        console.log('pod_invites table does not exist');
        return true;
      }
      console.error('Pod invite insert error:', error);
      return false;
    }
    console.log('Pod invites created for', validFriendIds.length, 'friends');
    return true;
  } catch (error) {
    console.error('Error creating pod invites:', error);
    return false;
  }
};

// Calculate confidence percentage
export const calculateConfidence = (votes: PodVote[]): number => {
  if (votes.length === 0) return 0;
  
  const yesVotes = votes.filter(v => v.choice === 'yes').length;
  const maybeVotes = votes.filter(v => v.choice === 'maybe').length;
  const totalVotes = votes.length;
  
  return Math.round(((yesVotes + (maybeVotes * 0.5)) / totalVotes) * 100);
};

// Get vote counts
export const getVoteCounts = (votes: PodVote[]) => {
  return {
    yes: votes.filter(v => v.choice === 'yes').length,
    maybe: votes.filter(v => v.choice === 'maybe').length,
    no: votes.filter(v => v.choice === 'no').length,
    total: votes.length,
  };
};

// Get public live pods (twins & global)
export const getPublicLivePods = async (): Promise<Pod[]> => {
  try {
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('status', 'live')
      .in('audience', ['style_twins', 'global_mix'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    
    // Filter out pods with invalid or missing image URLs
    const validPods = (data || []).filter(pod => {
      return pod.image_url && 
             typeof pod.image_url === 'string' && 
             pod.image_url.startsWith('http');
    });
    
    return validPods;
  } catch (error) {
    console.error('Error fetching public live pods:', error);
    return [];
  }
};

// ==================== EXPLORE FEED FUNCTIONS ====================

// Helper to enrich pods with owner info
const enrichPodsWithOwner = async (pods: Pod[]): Promise<Pod[]> => {
  if (!pods || pods.length === 0) return [];
  
  try {
    const ownerIds = [...new Set(pods.map(p => p.owner_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', ownerIds);
    
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    
    return pods.map(pod => ({
      ...pod,
      owner_name: profileMap.get(pod.owner_id)?.name || 
                  profileMap.get(pod.owner_id)?.email?.split('@')[0] || 
                  'Someone',
      owner_avatar: profileMap.get(pod.owner_id)?.avatar_url || null,
    }));
  } catch (error) {
    console.log('Error enriching pods:', error);
    return pods;
  }
};

// Get pods for Friends tab - ONLY pods I'm invited to (NOT my own - I manage those in PodsHome)
export const getFriendsTabPods = async (userId: string): Promise<Pod[]> => {
  if (!userId) return [];
  
  try {
    // Get pods I'm invited to (NOT my own - I don't vote on my own pods in Explore)
    const { data: invites } = await supabase
      .from('pod_invites')
      .select('pod_id')
      .eq('to_user', userId);

    let invitedPods: Pod[] = [];
    if (invites && invites.length > 0) {
      const podIds = invites.map(i => i.pod_id);
      const { data: pods } = await supabase
        .from('pods')
        .select('*')
        .in('id', podIds)
        .neq('owner_id', userId) // Don't show my own pods
        .order('created_at', { ascending: false });
      invitedPods = pods || [];
    }

    return enrichPodsWithOwner(invitedPods);
  } catch (error) {
    console.error('Error fetching friends tab pods:', error);
    return [];
  }
};

// Get pods for Style Twins tab
export const getTwinsTabPods = async (userId: string): Promise<Pod[]> => {
  try {
    // 1. Get similar users (Style Twins)
    const twins = await getStyleTwins(userId);
    const twinIds = twins.map(t => t.user_id);

    // 2. If no twins found (new user), fall back to standard "style_twins" audience query
    if (twinIds.length === 0) {
       const { data, error } = await supabase
        .from('pods')
        .select('*')
        .eq('audience', 'style_twins')
        .eq('status', 'live')
        .neq('owner_id', userId || '')
        .order('created_at', { ascending: false })
        .limit(20);
       if (error) throw error;
       return enrichPodsWithOwner(data || []);
    }

    // 3. Fetch public pods from these twins
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .in('owner_id', twinIds) // Pods from my twins
      .eq('status', 'live')
      // Show their public pods (style_twins or global)
      .in('audience', ['style_twins', 'global_mix']) 
      .neq('owner_id', userId || '')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return enrichPodsWithOwner(data || []);
  } catch (error) {
    console.error('Error fetching twins tab pods:', error);
    return [];
  }
};

// Get pods for Global Mix tab
export const getGlobalTabPods = async (userId: string): Promise<Pod[]> => {
  try {
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('audience', 'global_mix')
      .eq('status', 'live')
      .neq('owner_id', userId || '')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return enrichPodsWithOwner(data || []);
  } catch (error) {
    console.error('Error fetching global tab pods:', error);
    return [];
  }
};

// Check if user has voted on a pod
export const hasUserVoted = async (podId: string, voterId: string): Promise<boolean> => {
  if (!podId || !voterId) return false;
  
  try {
    const { data, error } = await supabase
      .from('pod_votes')
      .select('id')
      .eq('pod_id', podId)
      .eq('voter_id', voterId)
      .limit(1);

    if (error) return false;
    return (data?.length || 0) > 0;
  } catch (error) {
    return false;
  }
};

// Get pods user hasn't voted on yet (for a specific tab)
export const getUnvotedPods = async (pods: Pod[], userId: string): Promise<Pod[]> => {
  if (!userId || pods.length === 0) return pods;
  
  try {
    const podIds = pods.map(p => p.id);
    
    // Get all votes by this user for these pods
    const { data: votes } = await supabase
      .from('pod_votes')
      .select('pod_id')
      .eq('voter_id', userId)
      .in('pod_id', podIds);

    const votedPodIds = new Set((votes || []).map(v => v.pod_id));
    
    // Filter out pods that user has voted on
    return pods.filter(p => !votedPodIds.has(p.id));
  } catch (error) {
    console.error('Error filtering voted pods:', error);
    return pods;
  }
};

// ==================== NOTIFICATION FUNCTIONS ====================

// Get user's notifications
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === '42P01') return []; // Table doesn't exist
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
};

// Mark notification as read
export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification read:', error);
    return false;
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return false;
  }
};

// Get pod with owner profile info
export const getPodWithOwner = async (podId: string): Promise<Pod & { owner_name?: string; owner_avatar?: string } | null> => {
  try {
    const { data: pod, error } = await supabase
      .from('pods')
      .select('*')
      .eq('id', podId)
      .single();

    if (error || !pod) return null;

    // Fetch owner profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', pod.owner_id)
      .single();

    return {
      ...pod,
      owner_name: profile?.name || 'Someone',
      owner_avatar: profile?.avatar_url,
    };
  } catch (error) {
    console.error('Error fetching pod with owner:', error);
    return null;
  }
};
