/**
 * Execute SQL migrations via Supabase REST API
 * This script attempts to run migrations programmatically
 * 
 * Run: node scripts/runMigrationsNow.js
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function executeSQL(sql, description) {
  console.log(`\n${description}...`);
  
  try {
    // Try using Supabase REST API with pg_rest extension
    // Note: This requires the pg_rest extension to be enabled
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      console.log(`✓ ${description} completed`);
      return true;
    }

    // If RPC doesn't exist, try direct SQL execution via Management API
    // This requires service role key
    if (SUPABASE_KEY.includes('service_role') || SUPABASE_KEY.length > 100) {
      const mgmtResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ sql })
      });

      if (mgmtResponse.ok) {
        console.log(`✓ ${description} completed`);
        return true;
      }
    }

    // If all else fails, print SQL for manual execution
    console.log(`⚠️  Could not execute automatically. Please run this SQL in Supabase Dashboard:`);
    console.log('\n' + '='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70) + '\n');
    return false;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.log(`\n⚠️  Please run this SQL manually in Supabase Dashboard:`);
    console.log('\n' + '='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70) + '\n');
    return false;
  }
}

async function setupFriends() {
  console.log('\nSetting up friendships...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', ['stylit@stylit.com', 'esther@stylit.com', 'john@stylit.com']);

    if (profilesError) {
      console.log('⚠️  Could not fetch profiles:', profilesError.message);
      return false;
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No profiles found');
      return false;
    }

    const stylit = profiles.find(p => p.email === 'stylit@stylit.com');
    const esther = profiles.find(p => p.email === 'esther@stylit.com');
    const john = profiles.find(p => p.email === 'john@stylit.com');

    if (!stylit) {
      console.log('⚠️  Stylit user not found');
      return false;
    }

    // Check if friends table exists
    const { error: tableCheck } = await supabase.from('friends').select('id').limit(1);
    if (tableCheck && (tableCheck.message?.includes('does not exist') || tableCheck.code === '42P01')) {
      console.log('⚠️  Friends table does not exist. Create it first using createFriendsTable.sql');
      return false;
    }

    // Check existing
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
      const { error: insertError } = await supabase.from('friends').insert(friendships);
      if (insertError) {
        console.error('❌ Error creating friendships:', insertError.message);
        return false;
      }
      console.log('✓ Friendships created!');
      console.log(`  - Stylit ↔ Esther: ${esther ? '✓' : '✗'}`);
      console.log(`  - Stylit ↔ John: ${john ? '✓' : '✗'}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');

  // Migration 1: Add product_url column
  const sql1 = `ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS product_url TEXT;`;
  await executeSQL(sql1, 'Adding product_url column to pods table');

  // Migration 2: Create friends table
  const sql2 = `
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

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
  await executeSQL(sql2, 'Creating friends table');

  // Migration 3: Setup friendships
  await setupFriends();

  console.log('\n✅ Migration process complete!');
  console.log('\nNote: If any SQL failed, please run the SQL scripts manually in Supabase Dashboard SQL Editor.');
}

main().catch(console.error);


