/**
 * Direct migration script using Supabase client
 * This will attempt to run migrations via the Supabase client
 * 
 * Note: Schema changes typically require service role key or manual execution
 * This script will try to execute via RPC if available, otherwise print SQL
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running database migrations...\n');

  // Migration 1: Add product_url column
  try {
    console.log('1. Adding product_url column...');
    // Try to add column via a simple insert/update that would trigger schema check
    // Actually, we can't add columns via JS client - need to use SQL Editor
    console.log('   ⚠️  Column addition requires SQL execution');
    console.log('   Please run: ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS product_url TEXT;');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Migration 2: Create friends table
  try {
    console.log('\n2. Creating friends table...');
    // Check if table exists by trying to query it
    const { error: checkError } = await supabase.from('friends').select('id').limit(1);
    
    if (checkError && checkError.message?.includes('does not exist')) {
      console.log('   ⚠️  Friends table does not exist');
      console.log('   Please run the SQL from scripts/createFriendsTable.sql in Supabase Dashboard');
    } else {
      console.log('   ✓ Friends table exists');
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Migration 3: Setup friends
  try {
    console.log('\n3. Setting up friends...');
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', ['stylit@stylit.com', 'esther@stylit.com', 'john@stylit.com']);

    if (!profiles || profiles.length === 0) {
      console.log('   ⚠️  No profiles found. Create users first.');
      return;
    }

    const stylit = profiles.find(p => p.email === 'stylit@stylit.com');
    const esther = profiles.find(p => p.email === 'esther@stylit.com');
    const john = profiles.find(p => p.email === 'john@stylit.com');

    if (!stylit) {
      console.log('   ⚠️  Stylit user not found');
      return;
    }

    const friendships = [];
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
      const { error } = await supabase.from('friends').insert(friendships);
      if (error) {
        if (error.message?.includes('does not exist')) {
          console.log('   ⚠️  Friends table does not exist. Create it first.');
        } else {
          console.error('   Error:', error.message);
        }
      } else {
        console.log('   ✓ Friendships created!');
      }
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n✓ Migration check complete!');
  console.log('\nIf any migrations failed, please run the SQL scripts manually in Supabase Dashboard.');
}

runMigration();


