import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`
    Missing Supabase credentials!
    
    Please update your .env.local file with real Supabase credentials:
    
    1. Go to https://supabase.com
    2. Create a new project
    3. Go to Settings > API
    4. Copy your Project URL and anon public key
    5. Update .env.local:
    
    EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  `);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
