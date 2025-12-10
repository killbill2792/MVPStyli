/**
 * Database migrations
 * Automatically checks and sets up database schema
 * Note: Some operations (ALTER TABLE, CREATE TABLE) require manual SQL execution
 */

import { supabase } from './supabase';

// Check if product_url column exists
async function checkProductUrlColumn(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pods')
      .select('product_url')
      .limit(1);

    if (error && error.message?.includes('column') && error.message?.includes('product_url')) {
      console.log('⚠️  product_url column missing. Run this SQL in Supabase Dashboard:');
      console.log('ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS product_url TEXT;');
      return false;
    }

    return true;
  } catch (error: any) {
    console.log('⚠️  Could not check product_url column');
    return false;
  }
}

// Check if friends table exists and create friendships
async function setupFriendsTable(): Promise<boolean> {
  try {
    // Check if friends table exists
    const { error: checkError } = await supabase
      .from('friends')
      .select('id')
      .limit(1);

    if (checkError && (checkError.message?.includes('does not exist') || checkError.code === '42P01')) {
      console.log('⚠️  Friends table does not exist. Run scripts/createFriendsTable.sql in Supabase Dashboard');
      return false;
    }

    // Table exists, now setup friends
    return await setupFriendships();
  } catch (error: any) {
    console.log('⚠️  Friends table check failed:', error.message);
    return false;
  }
}

// Setup friendships for Stylit user
async function setupFriendships(): Promise<boolean> {
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', ['stylit@stylit.com', 'esther@stylit.com', 'john@stylit.com']);

    if (profilesError) {
      console.log('⚠️  Could not fetch profiles:', profilesError.message);
      return false;
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No profiles found. Create users first.');
      return false;
    }

    const stylit = profiles.find(p => p.email === 'stylit@stylit.com');
    const esther = profiles.find(p => p.email === 'esther@stylit.com');
    const john = profiles.find(p => p.email === 'john@stylit.com');

    if (!stylit) {
      console.log('⚠️  Stylit user not found');
      return false;
    }

    // Check existing friendships
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`user_id.eq.${stylit.id},friend_id.eq.${stylit.id}`)
      .limit(10);

    if (existing && existing.length > 0) {
      console.log('✓ Friendships already exist');
      return true;
    }

    // Create friendships
    const friendships: any[] = [];
    if (esther) {
      friendships.push(
        { user_id: stylit.id, friend_id: esther.id, status: 'accepted' },
        { user_id: esther.id, friend_id: stylit.id, status: 'accepted' }
      );
    }
    if (john) {
      friendships.push(
        { user_id: stylit.id, friend_id: john.id, status: 'accepted' },
        { user_id: john.id, friend_id: stylit.id, status: 'accepted' }
      );
    }

    if (friendships.length > 0) {
      const { error: insertError } = await supabase
        .from('friends')
        .insert(friendships);

      if (insertError) {
        console.error('Error creating friendships:', insertError.message);
        return false;
      }

      console.log('✓ Friendships created successfully!');
      console.log(`  - Stylit ↔ Esther: ${esther ? '✓' : '✗ (not found)'}`);
      console.log(`  - Stylit ↔ John: ${john ? '✓' : '✗ (not found)'}`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('Error setting up friendships:', error.message);
    return false;
  }
}

// Run all migrations
export async function runMigrations(): Promise<void> {
  console.log('\n🔧 Running database migrations...\n');
  
  const productUrlOk = await checkProductUrlColumn();
  if (productUrlOk) {
    console.log('✓ product_url column exists\n');
  }

  const friendsOk = await setupFriendsTable();
  if (friendsOk) {
    console.log('✓ Friends table and data setup complete\n');
  }

  console.log('Migration check complete!\n');
}
