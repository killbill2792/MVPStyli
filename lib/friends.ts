/**
 * Friends management utilities
 */

import { supabase } from './supabase';

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  friend_name?: string;
  friend_email?: string;
  friend_avatar?: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

// Mock friends for demo when table doesn't exist
const DEMO_FRIENDS: Friend[] = [
  {
    id: 'demo-friend-1',
    user_id: 'demo',
    friend_id: 'esther-id',
    friend_name: 'Esther',
    friend_email: 'esther@stylit.com',
    friend_avatar: null,
    status: 'accepted',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-friend-2',
    user_id: 'demo',
    friend_id: 'john-id',
    friend_name: 'John',
    friend_email: 'john@stylit.com',
    friend_avatar: null,
    status: 'accepted',
    created_at: new Date().toISOString(),
  },
];

// Get user's friends
export async function getUserFriends(userId: string): Promise<Friend[]> {
  if (!userId) return [];
  
  try {
    // Query friends where THIS user is EITHER user_id OR friend_id (bidirectional)
    // This ensures we find friends regardless of who sent the request
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .or(`and(user_id.eq.${userId},status.eq.accepted),and(friend_id.eq.${userId},status.eq.accepted)`);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205') {
        console.log('Friends table does not exist');
        return [];
      }
      console.log('Friends query error:', error.code);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }

    // Get unique friend IDs (handle bidirectional: friend could be user_id or friend_id)
    const friendIds = [...new Set(data.map((f: any) => 
      f.user_id === userId ? f.friend_id : f.user_id
    ))];

    // Fetch friend profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', friendIds);

    // Create a map of known friend names (hardcoded for demo users)
    const knownUsers: Record<string, string> = {
      'esther@stylit.com': 'Esther',
      'john@stylit.com': 'John',
      'stylit@stylit.com': 'Stylit',
    };

    // Transform to normalized friend data - deduplicated
    // Handle bidirectional friendships: if user_id=userId, friend_id is the friend
    // If friend_id=userId, user_id is the friend
    const seenIds = new Set<string>();
    const friends: Friend[] = [];
    
    for (const f of data) {
      // Determine which ID is the friend
      const friendId = f.user_id === userId ? f.friend_id : f.user_id;
      
      if (seenIds.has(friendId)) continue;
      seenIds.add(friendId);
      
      const profile = profiles?.find((p: any) => p.id === friendId);
      const email = profile?.email || '';
      
      // Try to get name from: 1) profile.name, 2) known users, 3) email prefix
      let displayName = profile?.name;
      if (!displayName && email) {
        displayName = knownUsers[email.toLowerCase()] || email.split('@')[0];
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      }
      
      friends.push({
        id: f.id,
        user_id: userId, // Always set to current user for consistency
        friend_id: friendId,
        friend_name: displayName || 'Friend',
        friend_email: email,
        friend_avatar: profile?.avatar_url || null,
        status: f.status,
        created_at: f.created_at,
      });
    }

    console.log('Friends loaded:', friends.length, friends.map(f => f.friend_name));
    return friends;
  } catch (error) {
    console.error('Error fetching friends:', error);
    return [];
  }
}

// Check if mutual friend request exists (both users have sent requests to each other)
export async function checkMutualFriendRequest(userId: string, friendId: string): Promise<boolean> {
  try {
    // Check if user A sent request to user B
    const { data: request1 } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .single();

    // Check if user B sent request to user A
    const { data: request2 } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', friendId)
      .eq('friend_id', userId)
      .single();

    // Both requests exist = mutual
    return !!(request1 && request2);
  } catch (error) {
    return false;
  }
}

// Check if user has sent a friend request to another user
export async function hasSentFriendRequest(userId: string, friendId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

// Check if users are already friends (check either direction since both should be accepted in mutual system)
export async function areFriends(userId: string, friendId: string): Promise<boolean> {
  try {
    // Check if there's an accepted friendship in either direction
    const { data } = await supabase
      .from('friends')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId},status.eq.accepted),and(user_id.eq.${friendId},friend_id.eq.${userId},status.eq.accepted)`)
      .limit(1);

    return !!(data && data.length > 0);
  } catch (error) {
    // Fallback: try simpler query
    try {
      const { data: data1 } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .eq('status', 'accepted')
        .limit(1);
      
      if (data1 && data1.length > 0) return true;
      
      const { data: data2 } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'accepted')
        .limit(1);
      
      return !!(data2 && data2.length > 0);
    } catch (e) {
      return false;
    }
  }
}

// Send a friend request (mutual system - no notification)
export async function sendFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; isMutual: boolean }> {
  try {
    // Check if already friends
    if (await areFriends(userId, friendId)) {
      return { success: false, isMutual: false }; // Already friends
    }

    // Check if user already sent a request
    if (await hasSentFriendRequest(userId, friendId)) {
      return { success: false, isMutual: false }; // Already sent
    }

    // Insert friend request (status: 'pending' for mutual system)
    const { error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'pending', // Keep as pending until mutual
      });

    if (error) throw error;

    // Check if mutual request exists now
    const isMutual = await checkMutualFriendRequest(userId, friendId);

    if (isMutual) {
      // Both users have sent requests - create mutual friendship
      // Update both records to 'accepted'
      await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
      
      return { success: true, isMutual: true };
    }

    return { success: true, isMutual: false };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return { success: false, isMutual: false };
  }
}

// Add a friend (by user ID or email/phone) - DEPRECATED: Use sendFriendRequest for mutual system
export async function addFriend(userId: string, friendIdentifier: string, type: 'id' | 'email' | 'phone'): Promise<boolean> {
  try {
    let friendUserId: string | null = null;

    if (type === 'id') {
      friendUserId = friendIdentifier;
    } else {
      // Look up user by email or phone
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users.find(u => 
        (type === 'email' && u.email === friendIdentifier) ||
        (type === 'phone' && u.phone === friendIdentifier)
      );
      if (user) friendUserId = user.id;
    }

    if (!friendUserId) {
      throw new Error('Friend not found');
    }

    // Use mutual friend request system
    const result = await sendFriendRequest(userId, friendUserId);
    return result.success;
  } catch (error) {
    console.error('Error adding friend:', error);
    return false;
  }
}

// Remove/unfriend a friend (deletes friendship from both sides)
export async function unfriend(userId: string, friendId: string): Promise<boolean> {
  try {
    // Delete both directions of the friendship
    // 1. Delete where user_id = userId and friend_id = friendId
    const { error: error1 } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
    
    if (error1) {
      console.error('Error unfriending:', error1);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error unfriending:', error);
    return false;
  }
}

// Create notification for friend
export async function createNotification(userId: string, type: string, payload: any): Promise<boolean> {
  try {
    // If payload contains 'fromUser', enrich it with sender details if not present
    let enrichedPayload = { ...payload };
    
    // Only attempt to enrich if we have a sender ID and missing name
    if (enrichedPayload.fromUser && !enrichedPayload.fromUserName) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, avatar_url')
                .eq('id', enrichedPayload.fromUser)
                .single();
            
            if (profile) {
                enrichedPayload.fromUserName = profile.name;
                enrichedPayload.fromUserAvatar = profile.avatar_url;
            }
        } catch (e) {
            console.log('Could not fetch sender profile for notification');
        }
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        payload: enrichedPayload,
        read: false,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

