import { supabase } from './supabase';

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
    const { data, error } = await supabase
      .from('pods')
      .insert({
        ...podData,
        status: 'live',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating pod:', error);
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

// Get votes for a pod
export const getPodVotes = async (podId: string): Promise<PodVote[]> => {
  try {
    const { data, error } = await supabase
      .from('pod_votes')
      .select('*')
      .eq('pod_id', podId);

    if (error) throw error;
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
    
    console.log('Active pods fetched successfully:', data?.length || 0);
    return data || [];
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
    
    console.log('Past pods fetched successfully:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching user past pods:', error);
    return [];
  }
};

// Get user's pending invites
export const getUserInvites = async (userEmail: string): Promise<PodInvite[]> => {
  try {
    const { data, error } = await supabase
      .from('pod_invites')
      .select('*')
      .eq('to_user', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user invites:', error);
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

// Get pod with stats from the view
export const getPodWithStats = async (podId: string) => {
  try {
    const { data, error } = await supabase
      .from('pod_stats')
      .select('*')
      .eq('id', podId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching pod with stats:', error);
    return null;
  }
};

// Get all active pods with stats
export const getActivePodsWithStats = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('pod_stats')
      .select('*')
      .eq('status', 'live')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active pods with stats:', error);
    return [];
  }
};

// Send an invite
export const sendInvite = async (podId: string, fromUser: string, toUser: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('pod_invites')
      .insert({
        pod_id: podId,
        from_user: fromUser,
        to_user: toUser,
        status: 'pending',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending invite:', error);
    return false;
  }
};

// Get invites sent by user
export const getSentInvites = async (userId: string): Promise<PodInvite[]> => {
  try {
    const { data, error } = await supabase
      .from('pod_invites')
      .select('*')
      .eq('from_user', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching sent invites:', error);
    return [];
  }
};