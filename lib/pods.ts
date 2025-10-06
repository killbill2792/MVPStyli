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

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return !!process.env.EXPO_PUBLIC_SUPABASE_URL;
};

// Create a new pod
export const createPod = async (podData: Omit<Pod, 'id' | 'created_at' | 'status'>): Promise<Pod | null> => {
  if (!isSupabaseConfigured()) {
    // Fallback to local storage
    const localPod: Pod = {
      id: `local-${Date.now()}`,
      ...podData,
      status: 'live',
      created_at: new Date().toISOString(),
    };
    
    // Store in local storage
    const existingPods = JSON.parse(localStorage.getItem('localPods') || '[]');
    existingPods.push(localPod);
    localStorage.setItem('localPods', JSON.stringify(existingPods));
    
    return localPod;
  }

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
  if (!isSupabaseConfigured()) {
    const localPods = JSON.parse(localStorage.getItem('localPods') || '[]');
    return localPods.find((pod: Pod) => pod.id === podId) || null;
  }

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
  if (!isSupabaseConfigured()) {
    const localVotes = JSON.parse(localStorage.getItem('localVotes') || '[]');
    return localVotes.filter((vote: PodVote) => vote.pod_id === podId);
  }

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
  if (!isSupabaseConfigured()) {
    const localVote: PodVote = {
      id: `local-vote-${Date.now()}`,
      pod_id: podId,
      voter_id: voterId,
      choice,
      created_at: new Date().toISOString(),
    };
    
    const existingVotes = JSON.parse(localStorage.getItem('localVotes') || '[]');
    existingVotes.push(localVote);
    localStorage.setItem('localVotes', JSON.stringify(existingVotes));
    
    return true;
  }

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
  if (!isSupabaseConfigured()) {
    const localComments = JSON.parse(localStorage.getItem('localComments') || '[]');
    return localComments.filter((comment: PodComment) => comment.pod_id === podId);
  }

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
  if (!isSupabaseConfigured()) {
    const localComment: PodComment = {
      id: `local-comment-${Date.now()}`,
      pod_id: podId,
      author_id: authorId,
      body,
      created_at: new Date().toISOString(),
    };
    
    const existingComments = JSON.parse(localStorage.getItem('localComments') || '[]');
    existingComments.push(localComment);
    localStorage.setItem('localComments', JSON.stringify(existingComments));
    
    return true;
  }

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
  if (!isSupabaseConfigured()) {
    const localPods = JSON.parse(localStorage.getItem('localPods') || '[]');
    return localPods.filter((pod: Pod) => pod.owner_id === userId && pod.status === 'live');
  }

  try {
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('owner_id', userId)
      .eq('status', 'live')
      .order('ends_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user active pods:', error);
    return [];
  }
};

// Get user's past pods
export const getUserPastPods = async (userId: string): Promise<Pod[]> => {
  if (!isSupabaseConfigured()) {
    const localPods = JSON.parse(localStorage.getItem('localPods') || '[]');
    return localPods.filter((pod: Pod) => pod.owner_id === userId && pod.status === 'expired');
  }

  try {
    const { data, error } = await supabase
      .from('pods')
      .select('*')
      .eq('owner_id', userId)
      .eq('status', 'expired')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user past pods:', error);
    return [];
  }
};

// Get user's pending invites
export const getUserInvites = async (userEmail: string): Promise<PodInvite[]> => {
  if (!isSupabaseConfigured()) {
    const localInvites = JSON.parse(localStorage.getItem('localInvites') || '[]');
    return localInvites.filter((invite: PodInvite) => invite.to_user === userEmail && invite.status === 'pending');
  }

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
  if (!isSupabaseConfigured()) {
    const localInvites = JSON.parse(localStorage.getItem('localInvites') || '[]');
    const inviteIndex = localInvites.findIndex((invite: PodInvite) => invite.id === inviteId);
    if (inviteIndex !== -1) {
      localInvites[inviteIndex].status = 'accepted';
      localStorage.setItem('localInvites', JSON.stringify(localInvites));
    }
    return true;
  }

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
  if (!isSupabaseConfigured()) {
    const localInvites = JSON.parse(localStorage.getItem('localInvites') || '[]');
    const inviteIndex = localInvites.findIndex((invite: PodInvite) => invite.id === inviteId);
    if (inviteIndex !== -1) {
      localInvites[inviteIndex].status = 'declined';
      localStorage.setItem('localInvites', JSON.stringify(localInvites));
    }
    return true;
  }

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
  if (!isSupabaseConfigured()) {
    const localPods = JSON.parse(localStorage.getItem('localPods') || '[]');
    const podIndex = localPods.findIndex((pod: Pod) => pod.id === podId);
    if (podIndex !== -1) {
      localPods[podIndex].status = 'expired';
      localStorage.setItem('localPods', JSON.stringify(localPods));
    }
    return true;
  }

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
  if (!isSupabaseConfigured()) {
    // Fallback: poll every 2 seconds
    const interval = setInterval(async () => {
      const votes = await getPodVotes(podId);
      callback(votes);
    }, 2000);
    
    return () => clearInterval(interval);
  }

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
