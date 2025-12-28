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

// Analyze face image and determine color profile using real skin tone detection
export async function analyzeFaceForColorProfile(faceImageUrl: string): Promise<ExtendedColorProfile | null> {
  try {
    console.log('🎨 [SKIN TONE] Starting face analysis for:', faceImageUrl.substring(0, 100));
    
    // Step 1: Try to detect face using expo-face-detector (client-side)
    let faceBox = null;
    let faceDetectionMethod = 'none';
    
    try {
      // Try to use expo-face-detector
      const FaceDetector = require('expo-face-detector').FaceDetector;
      const detector = new FaceDetector.FaceDetectorOptions({
        mode: FaceDetector.FaceDetectorMode.fast,
        detectLandmarks: false,
        runClassifications: false,
      });
      
      // Note: expo-face-detector works with Image component, not direct file paths
      // For now, we'll use a fallback heuristic approach
      // In production, you'd use the FaceDetector component in the UI
      throw new Error('Using fallback - face detector requires UI component');
    } catch (faceDetectError: any) {
      console.log('🎨 [SKIN TONE] Face detector not available, using fallback heuristic');
      
      // Fallback: For selfies and face photos, assume face is in center-upper region
      // This works well for most selfies and portrait photos
      // We'll fetch image dimensions from the server or use a reasonable estimate
      // For square selfies: face is typically in center, upper 60% of image
      // We'll let the API estimate based on image dimensions
      
      // For now, send a heuristic face box that the API can refine
      // The API will use image dimensions to create a proper face region
      faceBox = {
        x: -1, // Signal to API to use heuristic
        y: -1,
        width: -1,
        height: -1,
      };
      faceDetectionMethod = 'heuristic';
    }
    
    // Step 2: Call server-side API to analyze skin tone
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://mvp-styli.vercel.app';
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: faceImageUrl,
        faceBox: faceBox, // May be heuristic (-1 values) if face detection failed
      }),
    });
    
    const timeTaken = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 [SKIN TONE] API error:', response.status, errorText);
      throw new Error(`Skin tone analysis failed: ${response.status}`);
    }
    
    const analysis = await response.json();
    console.log('🎨 [SKIN TONE] Analysis complete:', {
      ...analysis,
      timeTaken: `${timeTaken}ms`,
    });
    
    // Step 3: Map to ColorProfile format
    const seasonData = COLOR_SEASONS[analysis.season as keyof typeof COLOR_SEASONS] || COLOR_SEASONS.autumn;
    
    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      bestColors: seasonData.bestColors,
      avoidColors: seasonData.avoidColors,
      description: seasonData.description,
      confidence: analysis.confidence,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
    };
    
    return profile;
  } catch (error: any) {
    console.error('🎨 [SKIN TONE] Error analyzing face for color:', error);
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

// Extended ColorProfile with analysis metadata
export interface ExtendedColorProfile extends ColorProfile {
  confidence?: number;
  skinHex?: string;
  clarity?: 'muted' | 'clear' | 'vivid';
}

// Save color profile to user's profile in Supabase
export async function saveColorProfile(userId: string, profile: ColorProfile | ExtendedColorProfile): Promise<boolean> {
  try {
    const extendedProfile = profile as ExtendedColorProfile;
    
    const updateData: any = {
      color_tone: profile.tone,
      color_depth: profile.depth,
      color_season: profile.season,
      best_colors: profile.bestColors,
      avoid_colors: profile.avoidColors,
      updated_at: new Date().toISOString(),
    };
    
    // Add optional fields if present
    if (extendedProfile.confidence !== undefined) {
      updateData.skin_tone_confidence = extendedProfile.confidence;
    }
    if (extendedProfile.skinHex) {
      updateData.skin_hex = extendedProfile.skinHex;
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('Error saving color profile:', error);
      return false;
    }
    
    console.log('🎨 [SKIN TONE] Color profile saved:', {
      tone: profile.tone,
      depth: profile.depth,
      season: profile.season,
      confidence: extendedProfile.confidence,
      skinHex: extendedProfile.skinHex,
    });
    
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

    if (error) {
      console.error('Error loading color profile:', error);
      return null;
    }
    
    // If no color_season but we have color_tone, still return a partial profile
    if (!data || (!data.color_season && !data.color_tone)) {
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

