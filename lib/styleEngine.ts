import { supabase } from './supabase';
import productsData from '../data/products.json';

// Types
export type UserEventType = 
  | 'tryon_success' 
  | 'product_view' 
  | 'vote_yes' 
  | 'vote_maybe' 
  | 'vote_no' 
  | 'save_fit' 
  | 'pod_resolved'
  | 'search_query'
  | 'tryon_attempt';

export interface StyleProfile {
  tags: string[];
  colors: string[];
  categories: string[];
}

export interface StyleTwin {
  user_id: string;
  match_score: number;
  name: string;
  avatar_url: string;
  top_tags: string[];
}

// Helper to find product tags if missing
const getProductTags = (productId: string, productObj: any) => {
  // 1. Check if object already has tags
  if (productObj?.tags && productObj.tags.length > 0) return productObj.tags;
  
  // 2. Look up in local JSON
  const found = productsData.find(p => p.id === productId);
  if (found?.tags) return found.tags;

  // 3. Fallback heuristics based on category/name/query
  const tags = [];
  const lowerName = (productObj?.name || productObj?.query || '').toLowerCase();
  if (lowerName.includes('jacket') || lowerName.includes('coat')) tags.push('outerwear');
  if (lowerName.includes('dress')) tags.push('dress');
  if (lowerName.includes('sneaker')) tags.push('streetwear');
  if (lowerName.includes('formal') || lowerName.includes('wedding')) tags.push('formal');
  if (lowerName.includes('casual')) tags.push('casual');
  if (lowerName.includes('summer')) tags.push('summer');
  if (lowerName.includes('winter')) tags.push('winter');
  
  return tags;
};

const getProductColors = (productId: string, productObj: any) => {
  if (productObj?.colors && productObj.colors.length > 0) return productObj.colors;
  const found = productsData.find(p => p.id === productId);
  if (found?.colors) return found.colors;

  // Extract colors from name/query
  const lowerName = (productObj?.name || productObj?.query || '').toLowerCase();
  const commonColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'pink', 'purple', 'orange', 'grey', 'gray', 'brown', 'beige'];
  const extractedColors = commonColors.filter(c => lowerName.includes(c));
  return extractedColors;
};

const getProductCategory = (productId: string, productObj: any) => {
  if (productObj?.category) return productObj.category;
  const found = productsData.find(p => p.id === productId);
  if (found?.category) return found.category;

  // Extract category from name/query
  const lowerName = (productObj?.name || productObj?.query || '').toLowerCase();
  if (lowerName.includes('dress')) return 'dress';
  if (lowerName.includes('top') || lowerName.includes('shirt') || lowerName.includes('blouse')) return 'top';
  if (lowerName.includes('pant') || lowerName.includes('jean') || lowerName.includes('trouser')) return 'bottom';
  if (lowerName.includes('shoe') || lowerName.includes('boot') || lowerName.includes('sneaker')) return 'shoes';

  return 'other';
};

/**
 * Track a user action to build their style profile
 */
export const trackEvent = async (
  userId: string, 
  eventType: UserEventType, 
  product: any
) => {
  if (!userId) return;

  // Ensure we have basic metadata
  const productId = product?.id || 'unknown';
  const tags = getProductTags(productId, product);
  const colors = getProductColors(productId, product);
  const category = getProductCategory(productId, product);

  const payload = {
    tags,
    colors,
    category,
    query: product?.query // Store query if available
  };

  try {
    const { error } = await supabase.from('user_events').insert({
      user_id: userId,
      event_type: eventType,
      product_id: productId,
      payload
    });

    if (error) {
      console.error('Error tracking event:', error);
    } else {
      console.log(`tracked ${eventType} for ${productId}`);
    }
  } catch (e) {
    console.error('Exception tracking event:', e);
  }
};

/**
 * Force recalculation of style profile (call after session or key actions)
 */
export const refreshStyleProfile = async (userId: string) => {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase.rpc('recalculate_style_profile', {
      target_user_id: userId
    });
    
    if (error) throw error;
    return data as StyleProfile;
  } catch (e) {
    console.error('Error refreshing style profile:', e);
    return null;
  }
};

/**
 * Get cached style profile
 */
export const getStyleProfile = async (userId: string) => {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_style_profile')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (error) return null;
    
    return {
      tags: data.top_style_tags || [],
      colors: data.top_colors || [],
      categories: data.top_categories || []
    } as StyleProfile;
  } catch (e) {
    return null;
  }
};

/**
 * Get Style Twins (similar users)
 */
export const getStyleTwins = async (userId: string) => {
  if (!userId) return [];

  try {
    // First ensure profile is up to date? Maybe not every time.
    // await refreshStyleProfile(userId); 
    
    const { data, error } = await supabase.rpc('get_style_twins', {
      target_user_id: userId
    });

    if (error) throw error;
    return data as StyleTwin[];
  } catch (e) {
    console.error('Error fetching style twins:', e);
    return [];
  }
};

