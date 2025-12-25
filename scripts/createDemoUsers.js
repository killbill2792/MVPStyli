/**
 * Script to create demo users and activate existing user
 * Run this in Node.js or add to your app initialization
 * 
 * Usage: node scripts/createDemoUsers.js
 * Or call setupDemoUsers() from your app
 */

import { supabase } from '../lib/supabase';

const DEMO_USERS = [
  {
    email: 'stylit@stylit.com',
    password: 'Stylit@123',
    gender: 'other',
    location: 'San Francisco, USA',
    name: 'Stylit User'
  },
  {
    email: 'esther@stylit.com',
    password: 'Stylit@123',
    gender: 'female',
    location: 'New York, USA',
    name: 'Esther'
  },
  {
    email: 'sheba@stylit.com',
    password: 'Stylit@123',
    gender: 'female',
    location: 'Los Angeles, USA',
    name: 'Sheba'
  },
  {
    email: 'amy@stylit.com',
    password: 'Stylit@123',
    gender: 'female',
    location: 'Chicago, USA',
    name: 'Amy'
  },
  {
    email: 'john@stylit.com',
    password: 'Stylit@123',
    gender: 'male',
    location: 'Tokyo, Japan',
    name: 'John'
  },
  {
    email: 'helloworld27@stylit.com',
    password: 'Stylit@123',
    gender: 'male',
    location: 'Paris, France',
    name: 'Hello World'
  }
];

const DEMO_PRODUCTS = [
  {
    name: 'Classic White Shirt',
    brand: 'Zara',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
    category: 'upper',
    url: 'https://www.zara.com/us/en/product/classic-white-shirt'
  },
  {
    name: 'Denim Jacket',
    brand: 'Levi\'s',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400',
    category: 'upper',
    url: 'https://www.levi.com/us/en/product/denim-jacket'
  },
  {
    name: 'Black Midi Dress',
    brand: 'H&M',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
    category: 'dress',
    url: 'https://www.hm.com/us/en/productpage/black-midi-dress'
  },
  {
    name: 'High-Waisted Jeans',
    brand: 'Topshop',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
    category: 'lower',
    url: 'https://www.topshop.com/product/high-waisted-jeans'
  },
  {
    name: 'Floral Summer Dress',
    brand: 'Forever 21',
    price: 19.99,
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400',
    category: 'dress',
    url: 'https://www.forever21.com/product/floral-summer-dress'
  }
];

export async function setupDemoUsers() {
  console.log('Starting demo user setup...');
  
  const results = [];
  
  for (const userData of DEMO_USERS) {
    try {
      console.log(`Creating/updating user: ${userData.email}`);
      
      // Sign up the user (or sign in if exists)
      let authResponse;
      try {
        authResponse = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
        });
      } catch (signUpError) {
        // User might already exist, try signing in
        console.log(`User ${userData.email} might already exist, trying sign in...`);
        authResponse = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: userData.password,
        });
      }
      
      if (authResponse.error && !authResponse.error.message.includes('already registered')) {
        console.error(`Error with ${userData.email}:`, authResponse.error);
        results.push({ email: userData.email, status: 'error', error: authResponse.error.message });
        continue;
      }
      
      const userId = authResponse.data?.user?.id || authResponse.user?.id;
      
      if (!userId) {
        console.error(`No user ID for ${userData.email}`);
        results.push({ email: userData.email, status: 'error', error: 'No user ID' });
        continue;
      }
      
      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          name: userData.name,
          gender: userData.gender,
          location: userData.location,
        }
      });
      
      // Activate user by updating email_confirmed_at (if using admin API)
      // Note: This requires admin privileges. For testing, you can manually confirm in Supabase dashboard
      // or use the admin API if available
      
      // Create user profile in a profiles table (if it exists)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userData.email,
          name: userData.name,
          gender: userData.gender,
          location: userData.location,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });
      
      if (profileError && !profileError.message.includes('does not exist')) {
        console.log(`Profile table might not exist, skipping: ${profileError.message}`);
      }
      
      // Create demo saved fits
      const savedFits = DEMO_PRODUCTS.slice(0, 3).map((product, idx) => ({
        user_id: userId,
        image: product.image,
        title: product.name,
        brand: product.brand,
        price: product.price,
        url: product.url,
        visibility: idx === 0 ? 'public' : 'private',
        created_at: new Date().toISOString(),
      }));
      
      // Insert saved fits (if table exists)
      const { error: fitsError } = await supabase
        .from('saved_fits')
        .upsert(savedFits, { onConflict: 'id' });
      
      if (fitsError && !fitsError.message.includes('does not exist')) {
        console.log(`Saved fits table might not exist: ${fitsError.message}`);
      }
      
      // Create demo boards
      const boards = [
        {
          user_id: userId,
          name: 'Summer Vibes',
          description: 'Perfect outfits for summer',
          visibility: 'public',
          cover_image: DEMO_PRODUCTS[4].image,
          created_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          name: 'Work Essentials',
          description: 'Professional wardrobe',
          visibility: 'private',
          cover_image: DEMO_PRODUCTS[0].image,
          created_at: new Date().toISOString(),
        }
      ];
      
      const { error: boardsError } = await supabase
        .from('boards')
        .upsert(boards, { onConflict: 'id' });
      
      if (boardsError && !boardsError.message.includes('does not exist')) {
        console.log(`Boards table might not exist: ${boardsError.message}`);
      }
      
      results.push({ email: userData.email, status: 'success', userId });
      console.log(`✓ Created user: ${userData.email} (${userId})`);
      
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error);
      results.push({ email: userData.email, status: 'error', error: error.message });
    }
  }
  
  console.log('\n=== Setup Results ===');
  results.forEach(r => {
    console.log(`${r.email}: ${r.status}${r.error ? ` - ${r.error}` : ''}`);
  });
  
  return results;
}

// For direct execution
if (require.main === module) {
  setupDemoUsers().then(() => {
    console.log('Demo user setup complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}





