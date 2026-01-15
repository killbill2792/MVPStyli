// Color Analysis System for Skin Tone and Season Detection
// This provides both heuristic-based analysis and structure for future ML upgrades

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

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

/**
 * Convert local image URI to base64
 */
async function uriToBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting URI to base64:', error);
    throw error;
  }
}

/**
 * NEW: Analyze face from cropped image (preferred method)
 * Sends pre-cropped face image directly to server (no face detection needed)
 */
export async function analyzeFaceForColorProfileFromCroppedImage(
  croppedImageUri: string,
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null; qualityMessages?: string[] }> {
  try {
    console.log('🎨 [SKIN TONE CLIENT] ========== STARTING FACE ANALYSIS (CROPPED IMAGE) ==========');
    console.log('🎨 [SKIN TONE CLIENT] Cropped image URI:', croppedImageUri.substring(0, 100));
    
    // Convert cropped image to base64
    const croppedFaceBase64 = await uriToBase64(croppedImageUri);
    console.log('🎨 [SKIN TONE CLIENT] Cropped image converted to base64, length:', croppedFaceBase64.length);
    
    // Call server analysis with cropped image
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) {
      throw new Error('API_BASE not configured');
    }
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    console.log('🎨 [SKIN TONE CLIENT] Calling API with cropped image:', apiUrl);
    
    const startTime = Date.now();
    console.log('🎨 [SKIN TONE CLIENT] API call started at:', new Date().toISOString());
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        croppedFaceBase64: croppedFaceBase64,
        // No imageUrl or faceBox - using pre-cropped image
      }),
    });
    
    console.log('🎨 [SKIN TONE CLIENT] API response received at:', new Date().toISOString());
    console.log('🎨 [SKIN TONE CLIENT] Response status:', response.status, response.statusText);
    
    const timeTaken = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 [SKIN TONE CLIENT] API error:', response.status, errorText);
      
      // If server says face not detected, return null
      if (errorText.includes('FACE_NOT_DETECTED') || response.status === 400) {
        return { profile: null, uploadedUrl: null };
      }
      throw new Error(`Skin tone analysis failed: ${response.status} - ${errorText}`);
    }
    
    const analysis = await response.json();
    
    // If server says face not detected / low confidence, treat as null
    if (analysis?.error === 'FACE_NOT_DETECTED' || !analysis.undertone) {
      console.warn('🎨 [SKIN TONE CLIENT] Server returned no face detected or invalid analysis');
      return { profile: null, uploadedUrl: null };
    }
    
    console.log('🎨 [SKIN TONE CLIENT] Analysis complete:', {
      undertone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      confidence: analysis.confidence,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      qualityMessages: analysis.qualityMessages,
      timeTaken: `${timeTaken}ms`,
    });
    
    // Upload the cropped image for storage
    let uploadedUrl: string | null = null;
    try {
      uploadedUrl = await uploadFn(croppedImageUri);
      console.log('🎨 [SKIN TONE CLIENT] Cropped image uploaded for storage');
    } catch (uploadError) {
      console.error('🎨 [SKIN TONE CLIENT] Failed to upload cropped image:', uploadError);
    }
    
    // Use seasonConfidence instead of overall confidence for season decision
    let season = analysis.season;
    if (!analysis.season || (analysis.seasonConfidence ?? 0) < 0.72) {
      console.log('🎨 [SKIN TONE CLIENT] Season confidence low, needs confirmation:', {
        season: analysis.season,
        seasonConfidence: analysis.seasonConfidence,
      });
    }
    
    // Get season data if season exists
    const seasonData = season ? COLOR_SEASONS[season as keyof typeof COLOR_SEASONS] : null;
    
    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: season,
      bestColors: seasonData?.bestColors || [],
      avoidColors: seasonData?.avoidColors || [],
      description: seasonData?.description || 'Color analysis complete',
      confidence: analysis.confidence || 0,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
    };
    
    return { profile, uploadedUrl, qualityMessages: analysis.qualityMessages };
  } catch (error: any) {
    console.error('🎨 [SKIN TONE CLIENT] Error in analyzeFaceForColorProfileFromCroppedImage:', error);
    return { profile: null, uploadedUrl: null };
  }
}

// NEW: Analyze face from local URI using server-side face detection
// Server-side detection is the primary method - no client-side detection needed
// NOTE: This is the fallback method - prefer analyzeFaceForColorProfileFromCroppedImage
export async function analyzeFaceForColorProfileFromLocalUri(
  localUri: string,
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null }> {
  try {
    console.log('🎨 [SKIN TONE CLIENT] ========== STARTING FACE ANALYSIS (SERVER-SIDE) ==========');
    console.log('🎨 [SKIN TONE CLIENT] Local URI:', localUri.substring(0, 100));
    
    // 1) Upload the image first (server will detect face)
    console.log('🎨 [SKIN TONE CLIENT] Uploading image for server-side face detection...');
    const uploadedUrl = await uploadFn(localUri);
    console.log('🎨 [SKIN TONE CLIENT] Image uploaded:', uploadedUrl.substring(0, 100));
    
    // 2) Call server analysis - server will detect face and analyze
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) {
      throw new Error('API_BASE not configured');
    }
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    console.log('🎨 [SKIN TONE CLIENT] Calling API:', apiUrl);
    console.log('🎨 [SKIN TONE CLIENT] Request payload:', {
      imageUrl: uploadedUrl.substring(0, 100) + '...',
      hasImageUrl: !!uploadedUrl,
      imageUrlLength: uploadedUrl.length
    });
    
    const startTime = Date.now();
    console.log('🎨 [SKIN TONE CLIENT] API call started at:', new Date().toISOString());
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageUrl: uploadedUrl,
        // No faceBox - server will detect face automatically
      }),
    });
    
    console.log('🎨 [SKIN TONE CLIENT] API response received at:', new Date().toISOString());
    console.log('🎨 [SKIN TONE CLIENT] Response status:', response.status, response.statusText);
    
    const timeTaken = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 [SKIN TONE CLIENT] API error:', response.status, errorText);
      
      // If server says face not detected, return null
      if (errorText.includes('FACE_NOT_DETECTED') || response.status === 400) {
        return { profile: null, uploadedUrl };
      }
      throw new Error(`Skin tone analysis failed: ${response.status} - ${errorText}`);
    }
    
    const analysis = await response.json();
    
    // If server says face not detected / low confidence, treat as null
    if (analysis?.error === 'FACE_NOT_DETECTED' || !analysis.undertone) {
      console.warn('🎨 [SKIN TONE CLIENT] Server returned no face detected or invalid analysis');
      return { profile: null, uploadedUrl };
    }
    
    console.log('🎨 [SKIN TONE CLIENT] Analysis complete:', {
      undertone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      confidence: analysis.confidence,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      timeTaken: `${timeTaken}ms`,
    });
    
    // Use seasonConfidence instead of overall confidence for season decision
    // Only set season to null if seasonConfidence is too low
    let season = analysis.season;
    if (!analysis.season || (analysis.seasonConfidence ?? 0) < 0.72) {
      // Keep season but mark as needing confirmation
      // Do NOT set to null unless we want "unknown"
      console.log('🎨 [SKIN TONE CLIENT] Season confidence low, needs confirmation:', {
        season: analysis.season,
        seasonConfidence: analysis.seasonConfidence,
      });
    }
    
    // Get season data if season exists
    const seasonData = season ? COLOR_SEASONS[season as keyof typeof COLOR_SEASONS] : null;
    
    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: season,
      bestColors: seasonData?.bestColors || [],
      avoidColors: seasonData?.avoidColors || [],
      description: seasonData?.description || 'Color analysis complete',
      confidence: analysis.confidence || 0,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
    };
    
    return { profile, uploadedUrl };
  } catch (error: any) {
    console.error('🎨 [SKIN TONE CLIENT] Error in analyzeFaceForColorProfileFromLocalUri:', error);
    console.error('🎨 [SKIN TONE CLIENT] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // NO FALLBACK - only return what API gives us
    // Try to upload image for storage, but return null profile
    try {
      const uploadedUrl = await uploadFn(localUri);
      console.log('🎨 [SKIN TONE CLIENT] Image uploaded for storage, but no profile (API failed)');
      return { profile: null, uploadedUrl };
    } catch (uploadError) {
      console.error('🎨 [SKIN TONE CLIENT] Failed to upload image:', uploadError);
      return { profile: null, uploadedUrl: null };
    }
  }
}

// OLD: Analyze face image from URL (kept for backward compatibility, but uses heuristic)
export async function analyzeFaceForColorProfile(faceImageUrl: string): Promise<ExtendedColorProfile | null> {
  try {
    console.log('🎨 [SKIN TONE CLIENT] ========== STARTING FACE ANALYSIS ==========');
    console.log('🎨 [SKIN TONE CLIENT] Image URL:', faceImageUrl.substring(0, 100) + (faceImageUrl.length > 100 ? '...' : ''));
    
    // Server-side face detection is the primary method
    console.log('🎨 [SKIN TONE CLIENT] Using server-side face detection and analysis');
    
    // Call server-side API to detect face and analyze skin tone
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) {
      throw new Error('API_BASE not configured');
    }
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    console.log('🎨 [SKIN TONE CLIENT] Calling server-side API:', apiUrl);
    
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: faceImageUrl,
        // No faceBox - server will detect face automatically
      }),
    });
    
    const timeTaken = Date.now() - startTime;
    console.log('🎨 [SKIN TONE CLIENT] API response received:', {
      status: response.status,
      ok: response.ok,
      timeTaken: `${timeTaken}ms`,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 [SKIN TONE CLIENT] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        apiUrl,
      });
      throw new Error(`Skin tone analysis failed: ${response.status} - ${errorText}`);
    }
    
    const analysis = await response.json();
    console.log('🎨 [SKIN TONE CLIENT] ========== ANALYSIS RESULTS ==========');
    console.log('🎨 [SKIN TONE CLIENT] Raw API response:', JSON.stringify(analysis, null, 2));
    console.log('🎨 [SKIN TONE CLIENT] Parsed results:', {
      rgb: analysis.rgb,
      hex: analysis.hex,
      lab: analysis.lab,
      undertone: analysis.undertone,
      depth: analysis.depth,
      clarity: analysis.clarity,
      season: analysis.season,
      confidence: analysis.confidence,
      timeTaken: `${timeTaken}ms`,
    });
    console.log('🎨 [SKIN TONE CLIENT] ===========================================');
    
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
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
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
  seasonConfidence?: number;
  needsConfirmation?: boolean;
  skinHex?: string;
  clarity?: 'muted' | 'clear' | 'vivid';
}

// Save color profile to user's profile in Supabase
export async function saveColorProfile(userId: string, profile: ColorProfile | ExtendedColorProfile): Promise<boolean> {
  try {
    const extendedProfile = profile as ExtendedColorProfile;
    
    const updateData: any = {
      color_tone: profile.tone || null,
      color_depth: profile.depth || null,
      color_season: profile.season || null, // Can be null if low confidence
      best_colors: profile.bestColors || [],
      avoid_colors: profile.avoidColors || [],
      updated_at: new Date().toISOString(),
    };
    
    // Add optional fields if present (always set, even if null, to override previous values)
    updateData.skin_tone_confidence = extendedProfile.confidence !== undefined ? extendedProfile.confidence : null;
    updateData.skin_hex = extendedProfile.skinHex || null;
    
    console.log('🎨 [SKIN TONE] Saving color profile to Supabase:', {
      userId,
      updateData,
    });
    
    const { error, data } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('🎨 [SKIN TONE] Error saving color profile:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        updateData,
      });
      
      // If error is about missing columns, provide helpful message and retry without them
      if (error.code === 'PGRST204' && (error.message?.includes('skin_hex') || error.message?.includes('skin_tone_confidence'))) {
        console.error('🎨 [SKIN TONE] Missing database columns. Please run the SQL script: scripts/ADD_SKIN_TONE_COLUMNS_FIXED.sql in Supabase SQL Editor');
        // Retry without the optional fields
        const fallbackData = { ...updateData };
        delete fallbackData.skin_tone_confidence;
        delete fallbackData.skin_hex;
        const { error: retryError, data: retryData } = await supabase
          .from('profiles')
          .update(fallbackData)
          .eq('id', userId)
          .select();
        if (retryError) {
          console.error('🎨 [SKIN TONE] Retry also failed:', retryError);
          return false;
        }
        console.log('🎨 [SKIN TONE] Saved profile without skin tone fields. Please add columns and try again.');
        return true;
      }
      
      return false;
    }
    
    console.log('🎨 [SKIN TONE] Color profile saved successfully:', {
      tone: profile.tone,
      depth: profile.depth,
      season: profile.season,
      confidence: extendedProfile.confidence,
      skinHex: extendedProfile.skinHex,
      updated: data?.[0]?.updated_at,
    });
    
    return true;
  } catch (error) {
    console.error('Error saving color profile:', error);
    return false;
  }
}

// Load color profile from user's profile
export async function loadColorProfile(userId: string): Promise<ColorProfile | ExtendedColorProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('color_tone, color_depth, color_season, best_colors, avoid_colors, skin_tone_confidence, skin_hex')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle new users without profiles

    if (error) {
      console.error('Error loading color profile:', error);
      return null;
    }
    
    // If no data (new user without profile) or no color_season/color_tone, return null
    if (!data || (!data.color_season && !data.color_tone)) {
      return null;
    }

    const profile: any = {
      tone: data.color_tone || 'neutral',
      depth: data.color_depth || 'medium',
      season: data.color_season,
      bestColors: data.best_colors || [],
      avoidColors: data.avoid_colors || [],
      description: getSeasonProfile(data.color_season).description
    };

    // Add optional fields if present
    if (data.skin_tone_confidence !== null && data.skin_tone_confidence !== undefined) {
      profile.confidence = data.skin_tone_confidence;
    }
    if (data.skin_hex) {
      profile.skinHex = data.skin_hex;
    }

    return profile;
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

