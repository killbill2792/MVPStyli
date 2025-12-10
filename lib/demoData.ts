/**
 * Demo data setup utility
 * Call setupDemoDataForUser(userId) after user is created
 */

import { supabase } from './supabase';

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
  },
  {
    name: 'Leather Jacket',
    brand: 'AllSaints',
    price: 299.99,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
    category: 'upper',
    url: 'https://www.allsaints.com/product/leather-jacket'
  }
];

export async function setupDemoDataForUser(userId: string, userEmail: string) {
  try {
    console.log(`Setting up demo data for user: ${userEmail}`);
    
    // Create/update profile
    const userInfo = getUserInfo(userEmail);
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        name: userInfo.name,
        gender: userInfo.gender,
        location: userInfo.location,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });
    
    if (profileError && !profileError.message.includes('does not exist')) {
      console.log('Profile error (might not exist):', profileError.message);
    }
    
    // Create saved fits (3 per user)
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
    
    const { error: fitsError } = await supabase
      .from('saved_fits')
      .upsert(savedFits, { onConflict: 'id' });
    
    if (fitsError && !fitsError.message.includes('does not exist')) {
      console.log('Saved fits error (might not exist):', fitsError.message);
    }
    
    // Create boards (2 per user)
    const boards = [
      {
        user_id: userId,
        name: 'Summer Vibes',
        description: 'Perfect outfits for summer days',
        visibility: 'public',
        cover_image: DEMO_PRODUCTS[4].image,
        created_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        name: 'Work Essentials',
        description: 'Professional wardrobe staples',
        visibility: 'private',
        cover_image: DEMO_PRODUCTS[0].image,
        created_at: new Date().toISOString(),
      }
    ];
    
    const { error: boardsError } = await supabase
      .from('boards')
      .upsert(boards, { onConflict: 'id' });
    
    if (boardsError && !boardsError.message.includes('does not exist')) {
      console.log('Boards error (might not exist):', boardsError.message);
    }
    
    // Create a demo pod for testing
    const demoPod = {
      owner_id: userId,
      image_url: DEMO_PRODUCTS[0].image,
      audience: 'global_mix',
      duration_mins: 15,
      title: 'What do you think of this look?',
      ends_at: new Date(Date.now() + 15 * 60000).toISOString(),
      product_url: DEMO_PRODUCTS[0].url,
    };
    
    const { data: podData, error: podError } = await supabase
      .from('pods')
      .insert(demoPod)
      .select()
      .single();
    
    if (podError && !podError.message.includes('does not exist')) {
      console.log('Pod creation error:', podError.message);
    } else if (podData) {
      console.log(`Created demo pod: ${podData.id}`);
    }
    
    console.log(`✓ Demo data setup complete for ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error setting up demo data:', error);
    return { success: false, error };
  }
}

export function getUserInfo(email: string) {
  const info: { [key: string]: { name: string; gender: string; location: string } } = {
    'stylit@stylit.com': { name: 'Stylit User', gender: 'other', location: 'San Francisco, USA' },
    'esther@stylit.com': { name: 'Esther', gender: 'female', location: 'New York, USA' },
    'sheba@stylit.com': { name: 'Sheba', gender: 'female', location: 'Los Angeles, USA' },
    'amy@stylit.com': { name: 'Amy', gender: 'female', location: 'Chicago, USA' },
    'john@stylit.com': { name: 'John', gender: 'male', location: 'Tokyo, Japan' },
    'helloworld27@stylit.com': { name: 'Hello World', gender: 'male', location: 'Paris, France' },
  };
  return info[email] || { name: 'User', gender: 'other', location: 'Unknown' };
}

