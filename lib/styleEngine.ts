import { supabase } from './supabase';
import productsData from '../data/products.json';
import { inferTagsFromProduct, normalizeTag, ALL_STYLE_TAGS } from './styleTaxonomy';

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

/**
 * Extract standardized tags, colors, and category from product
 * Uses the comprehensive taxonomy for accurate matching
 */
const getProductMetadata = (productId: string, productObj: any) => {
  // First check local JSON for existing products
  const found = productsData.find((p: any) => p.id === productId);
  
  // Merge found data with product object
  const mergedProduct = {
    ...productObj,
    tags: found?.tags || productObj?.tags,
    colors: found?.colors || productObj?.colors,
    category: found?.category || productObj?.category,
  };
  
  // Use taxonomy inference for comprehensive tag extraction
  const inferred = inferTagsFromProduct({
    name: mergedProduct.name || mergedProduct.title,
    title: mergedProduct.title || mergedProduct.name,
    description: mergedProduct.description || mergedProduct.garment_des,
    category: mergedProduct.category,
    color: mergedProduct.color || (mergedProduct.colors && mergedProduct.colors[0]),
    material: mergedProduct.material,
    query: mergedProduct.query,
    tags: mergedProduct.tags
  });
  
  return {
    tags: inferred.tags.length > 0 ? inferred.tags : (mergedProduct.tags || []),
    colors: inferred.colors.length > 0 ? inferred.colors : (mergedProduct.colors || []),
    category: inferred.category || mergedProduct.category || 'other'
  };
};

/**
 * Track a user action to build their style profile
 * Uses comprehensive taxonomy for accurate tag extraction
 */
export const trackEvent = async (
  userId: string, 
  eventType: UserEventType, 
  product: any
) => {
  if (!userId) return;

  // Ensure we have basic metadata using new taxonomy
  const productId = product?.id || 'unknown';
  const metadata = getProductMetadata(productId, product);

  const payload = {
    tags: metadata.tags,
    colors: metadata.colors,
    category: metadata.category,
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
      console.log(`tracked ${eventType} for ${productId} with tags:`, metadata.tags);
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

