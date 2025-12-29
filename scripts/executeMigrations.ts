/**
 * Execute database migrations via Supabase client
 * This script attempts to run migrations programmatically
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function executeMigrations() {
  console.log('Executing database migrations...\n');

  // 1. Add product_url column (requires SQL execution - can't do via JS client)
  console.log('1. Product URL column:');
  console.log('   Run in Supabase SQL Editor:');
  console.log('   ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS product_url TEXT;\n');

  // 2. Create friends table
  console.log('2. Friends table:');
  try {
    // Check if friends table exists
    const { error: checkError } = await supabase.from('friends').select('id').limit(1);
    
    if (checkError && (checkError.message?.includes('does not exist') || checkError.code === '42P01')) {
      console.log('   ⚠️  Friends table does not exist');
      console.log('   Run scripts/createFriendsTable.sql in Supabase SQL Editor\n');
    } else {
      console.log('   ✓ Friends table exists\n');
    }
  } catch (error: any) {
    console.log('   ⚠️  Error checking friends table:', error.message);
    console.log('   Run scripts/createFriendsTable.sql in Supabase SQL Editor\n');
  }

  // 3. Setup friends for Stylit
  console.log('3. Setting up friends:');
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', ['stylit@stylit.com', 'esther@stylit.com', 'john@stylit.com']);

    if (profilesError) {
      console.log('   ⚠️  Profiles table error:', profilesError.message);
      return;
    }

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

    // Check existing friendships
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`user_id.eq.${stylit.id},friend_id.eq.${stylit.id}`)
      .limit(10);

    if (existing && existing.length > 0) {
      console.log('   ✓ Friendships already exist');
      return;
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
        if (insertError.message?.includes('does not exist') || insertError.code === '42P01') {
          console.log('   ⚠️  Friends table does not exist. Create it first.');
        } else {
          console.error('   Error:', insertError.message);
        }
      } else {
        console.log('   ✓ Friendships created successfully!');
        console.log(`     - Stylit ↔ Esther: ${esther ? '✓' : '✗'}`);
        console.log(`     - Stylit ↔ John: ${john ? '✓' : '✗'}`);
      }
    }
  } catch (error: any) {
    console.error('   Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  executeMigrations().then(() => {
    console.log('\n✓ Migration execution complete!');
  }).catch(console.error);
}






