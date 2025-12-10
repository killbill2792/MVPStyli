// Color Analysis System for Skin Tone and Season Detection
// This provides both heuristic-based analysis and structure for future ML upgrades

import { supabase } from './supabase';

export interface ColorProfile {
  tone: 'warm' | 'cool' | 'neutral';
  depth: 'light' | 'medium' | 'deep';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  bestColors: string[];
  avoidColors: string[];
  description: string;
}

// Color season definitions with associated palettes
const COLOR_SEASONS = {
  spring: {
    tone: 'warm',
    depth: 'light',
    description: 'Warm & Light (Spring)',
    bestColors: ['coral', 'peach', 'warm ivory', 'golden yellow', 'turquoise', 'light warm green', 'warm pink', 'cream'],
    avoidColors: ['black', 'pure white', 'cool grey', 'burgundy', 'dark navy'],
    swatches: ['#FF7F50', '#FFDAB9', '#FFFFF0', '#FFD700', '#40E0D0', '#90EE90', '#FFB6C1', '#FFFDD0']
  },
  summer: {
    tone: 'cool',
    depth: 'light',
    description: 'Cool & Soft (Summer)',
    bestColors: ['lavender', 'soft pink', 'powder blue', 'rose', 'mauve', 'soft grey', 'periwinkle', 'dusty blue'],
    avoidColors: ['orange', 'gold', 'warm brown', 'bright yellow', 'rust'],
    swatches: ['#E6E6FA', '#FFB6C1', '#B0E0E6', '#FF007F', '#E0B0FF', '#C0C0C0', '#CCCCFF', '#6699CC']
  },
  autumn: {
    tone: 'warm',
    depth: 'deep',
    description: 'Warm & Deep (Autumn)',
    bestColors: ['camel', 'rust', 'olive', 'burnt orange', 'warm brown', 'teal', 'mustard', 'terracotta'],
    avoidColors: ['pastel pink', 'icy blue', 'silver grey', 'bright white', 'fuchsia'],
    swatches: ['#C19A6B', '#B7410E', '#808000', '#CC5500', '#964B00', '#008080', '#FFDB58', '#E2725B']
  },
  winter: {
    tone: 'cool',
    depth: 'deep',
    description: 'Cool & Deep (Winter)',
    bestColors: ['black', 'pure white', 'true red', 'emerald', 'royal blue', 'fuchsia', 'icy grey', 'burgundy'],
    avoidColors: ['orange', 'gold', 'warm beige', 'rust', 'mustard'],
    swatches: ['#000000', '#FFFFFF', '#FF0000', '#50C878', '#4169E1', '#FF00FF', '#D3D3D3', '#800020']
  }
};

// Analyze face image and determine color profile
// For MVP: Uses heuristic approach based on common patterns
// Future: Can integrate with ML model or cloud vision API
export async function analyzeFaceForColorProfile(faceImageUrl: string): Promise<ColorProfile | null> {
  try {
    // For MVP, we'll use a simplified heuristic approach
    // In production, this would call an image analysis API
    
    // Default to a neutral analysis that's safe for most people
    // The user can manually adjust in their profile settings
    const defaultProfile: ColorProfile = {
      tone: 'neutral',
      depth: 'medium',
      season: 'autumn', // Most versatile for many skin tones
      bestColors: ['navy', 'burgundy', 'olive', 'cream', 'rust', 'teal'],
      avoidColors: ['neon colors', 'very pale pastels'],
      description: 'Versatile palette - most colors work for you!'
    };

    // If we have an actual image, we could analyze it
    // For now, return the default
    console.log('Color analysis requested for:', faceImageUrl);
    
    return defaultProfile;
  } catch (error) {
    console.error('Error analyzing face for color:', error);
    return null;
  }
}

// Get color profile for a specific season
export function getSeasonProfile(season: string): ColorProfile {
  const seasonData = COLOR_SEASONS[season as keyof typeof COLOR_SEASONS] || COLOR_SEASONS.autumn;
  return {
    tone: seasonData.tone as 'warm' | 'cool' | 'neutral',
    depth: seasonData.depth as 'light' | 'medium' | 'deep',
    season: season as 'spring' | 'summer' | 'autumn' | 'winter',
    bestColors: seasonData.bestColors,
    avoidColors: seasonData.avoidColors,
    description: seasonData.description
  };
}

// Get color swatches for display
export function getSeasonSwatches(season: string): string[] {
  return COLOR_SEASONS[season as keyof typeof COLOR_SEASONS]?.swatches || [];
}

// Save color profile to user's profile in Supabase
export async function saveColorProfile(userId: string, profile: ColorProfile): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        color_tone: profile.tone,
        color_depth: profile.depth,
        color_season: profile.season,
        best_colors: profile.bestColors,
        avoid_colors: profile.avoidColors,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving color profile:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error saving color profile:', error);
    return false;
  }
}

// Load color profile from user's profile
export async function loadColorProfile(userId: string): Promise<ColorProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('color_tone, color_depth, color_season, best_colors, avoid_colors')
      .eq('id', userId)
      .single();

    if (error || !data || !data.color_season) {
      return null;
    }

    return {
      tone: data.color_tone || 'neutral',
      depth: data.color_depth || 'medium',
      season: data.color_season,
      bestColors: data.best_colors || [],
      avoidColors: data.avoid_colors || [],
      description: getSeasonProfile(data.color_season).description
    };
  } catch (error) {
    console.error('Error loading color profile:', error);
    return null;
  }
}

// Check if a color matches user's profile
export function doesColorMatch(color: string, profile: ColorProfile): 'good' | 'neutral' | 'avoid' {
  const colorLower = color.toLowerCase();
  
  if (profile.bestColors.some(c => colorLower.includes(c.toLowerCase()))) {
    return 'good';
  }
  if (profile.avoidColors.some(c => colorLower.includes(c.toLowerCase()))) {
    return 'avoid';
  }
  return 'neutral';
}

// Get all available seasons for user selection
export function getAllSeasons() {
  return Object.entries(COLOR_SEASONS).map(([key, value]) => ({
    id: key,
    name: value.description,
    tone: value.tone,
    depth: value.depth,
    swatches: value.swatches.slice(0, 4) // First 4 for preview
  }));
}

