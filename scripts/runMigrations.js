/**
 * Run database migrations
 * This script adds the product_url column and creates the friends table
 * 
 * Usage: node scripts/runMigrations.js
 * 
 * Note: This requires Supabase service role key for admin operations
 * For security, you may need to run these SQL scripts directly in Supabase Dashboard
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client (requires service role key for schema changes)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSQL(sql: string, description: string) {
  try {
    console.log(`\n${description}...`);
    // Supabase JS client doesn't support raw SQL execution
    // We need to use RPC or execute via REST API
    // For now, we'll use the REST API directly
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      // Try alternative: Use Supabase Management API if available
      console.log(`Note: Direct SQL execution not available. Please run this SQL in Supabase Dashboard SQL Editor:`);
      console.log('\n' + '='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60) + '\n');
      return false;
    }

    const result = await response.json();
    console.log(`✓ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`Error running ${description}:`, error.message);
    console.log(`\nPlease run this SQL manually in Supabase Dashboard SQL Editor:`);
    console.log('\n' + '='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60) + '\n');
    return false;
  }
}

async function addProductUrlColumn() {
  const sql = `
    -- Add product_url column to pods table
    ALTER TABLE public.pods 
    ADD COLUMN IF NOT EXISTS product_url TEXT;
  `;
  return runSQL(sql, 'Adding product_url column to pods table');
}

async function createFriendsTable() {
  const sql = `
    -- Create friends table for bidirectional friendships
    CREATE TABLE IF NOT EXISTS public.friends (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
    CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

    -- Enable RLS
    ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

    -- Create policies
    DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
    CREATE POLICY "Users can view their own friendships" ON public.friends
        FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

    DROP POLICY IF EXISTS "Users can create friendships" ON public.friends;
    CREATE POLICY "Users can create friendships" ON public.friends
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friends;
    CREATE POLICY "Users can update their own friendships" ON public.friends
        FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
  `;
  return runSQL(sql, 'Creating friends table');
}

async function setupFriendsForStylit() {
  try {
    console.log('\nSetting up friends for Stylit user...');
    
    // Get user IDs from profiles
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('email', ['stylit@stylit.com', 'esther@stylit.com', 'john@stylit.com']);

    if (error) {
      console.log('Could not fetch profiles:', error.message);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found. Please ensure users are created first.');
      return;
    }

    const stylit = profiles.find(p => p.email === 'stylit@stylit.com');
    const esther = profiles.find(p => p.email === 'esther@stylit.com');
    const john = profiles.find(p => p.email === 'john@stylit.com');

    if (!stylit) {
      console.log('Stylit user not found');
      return;
    }

    // Create friendships
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
      // Check existing
      const { data: existing } = await supabaseAdmin
        .from('friends')
        .select('id')
        .in('user_id', [stylit.id, esther?.id, john?.id].filter(Boolean));

      if (existing && existing.length > 0) {
        console.log('Friendships already exist');
        return;
      }

      const { error: insertError } = await supabaseAdmin
        .from('friends')
        .insert(friendships);

      if (insertError) {
        console.error('Error creating friendships:', insertError);
      } else {
        console.log('✓ Friendships created successfully!');
        console.log(`  - Stylit ↔ Esther: ${esther ? 'Created' : 'Esther not found'}`);
        console.log(`  - Stylit ↔ John: ${john ? 'Created' : 'John not found'}`);
      }
    }
  } catch (error) {
    console.error('Error setting up friends:', error);
  }
}

async function main() {
  console.log('Starting database migrations...\n');

  // Run migrations
  await addProductUrlColumn();
  await createFriendsTable();
  
  // Setup friends
  await setupFriendsForStylit();

  console.log('\n✓ Migrations complete!');
  console.log('\nNote: If any SQL failed, please run the SQL scripts manually in Supabase Dashboard SQL Editor.');
}

main().catch(console.error);






