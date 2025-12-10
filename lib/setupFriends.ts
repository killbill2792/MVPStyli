/**
 * Setup initial friends for demo users
 * This creates bidirectional friendships between users
 */

import { supabase } from './supabase';

// User emails to IDs mapping (will be fetched from auth)
const USER_EMAILS = {
  stylit: 'stylit@stylit.com',
  esther: 'esther@stylit.com',
  john: 'john@stylit.com',
};

// Create bidirectional friendship
async function createFriendship(userId1: string, userId2: string): Promise<boolean> {
  try {
    // Check if friends table exists by trying a simple query
    const { error: tableCheck } = await supabase
      .from('friends')
      .select('id')
      .limit(1);

    if (tableCheck && (tableCheck.message?.includes('does not exist') || tableCheck.code === '42P01')) {
      console.log('Friends table does not exist. Please run createFriendsTable.sql');
      return false;
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('Friendship already exists');
      return true;
    }

    // Create bidirectional friendships
    const { error: error1 } = await supabase
      .from('friends')
      .insert({
        user_id: userId1,
        friend_id: userId2,
        status: 'accepted',
      });

    if (error1) {
      if (error1.message?.includes('does not exist') || error1.code === '42P01') {
        console.log('Friends table does not exist. Please run createFriendsTable.sql');
        return false;
      }
      throw error1;
    }

    const { error: error2 } = await supabase
      .from('friends')
      .insert({
        user_id: userId2,
        friend_id: userId1,
        status: 'accepted',
      });

    if (error2) throw error2;

    console.log(`Friendship created: ${userId1} <-> ${userId2}`);
    return true;
  } catch (error: any) {
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      console.log('Friends table does not exist. Please run createFriendsTable.sql');
      return false;
    }
    console.error('Error creating friendship:', error);
    return false;
  }
}

// Setup friends for Stylit user
export async function setupStylitFriends(stylitUserId?: string): Promise<void> {
  try {
    let stylitId: string | null = stylitUserId || null;
    let estherId: string | null = null;
    let johnId: string | null = null;

    // If stylitUserId provided, use it; otherwise fetch from profiles
    if (!stylitId) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', [USER_EMAILS.stylit, USER_EMAILS.esther, USER_EMAILS.john]);

      if (profiles && profiles.length > 0) {
        stylitId = profiles.find(p => p.email === USER_EMAILS.stylit)?.id || null;
        estherId = profiles.find(p => p.email === USER_EMAILS.esther)?.id || null;
        johnId = profiles.find(p => p.email === USER_EMAILS.john)?.id || null;
      }
    } else {
      // If we have stylitId, fetch esther and john
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', [USER_EMAILS.esther, USER_EMAILS.john]);

      if (profiles && profiles.length > 0) {
        estherId = profiles.find(p => p.email === USER_EMAILS.esther)?.id || null;
        johnId = profiles.find(p => p.email === USER_EMAILS.john)?.id || null;
      }
    }

    if (!stylitId) {
      console.log('Stylit user not found. Friends setup skipped.');
      return;
    }

    console.log('Setting up friends for Stylit:', { stylitId, estherId, johnId });

    // Create friendships if users exist
    if (estherId) {
      await createFriendship(stylitId, estherId);
    }
    if (johnId) {
      await createFriendship(stylitId, johnId);
    }

    console.log('Stylit friends setup complete!', { stylitId, estherId, johnId });
  } catch (error: any) {
    // If friends table doesn't exist, that's okay - just log it
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      console.log('Friends table does not exist yet. Please run createFriendsTable.sql');
    } else {
      console.error('Error setting up Stylit friends:', error);
    }
  }
}

// Alternative: Direct setup using known user IDs (if you have them)
export async function setupFriendsDirectly(
  stylitUserId: string,
  estherUserId: string,
  johnUserId: string
): Promise<void> {
  await createFriendship(stylitUserId, estherUserId);
  await createFriendship(stylitUserId, johnUserId);
  console.log('Direct friends setup complete!');
}
