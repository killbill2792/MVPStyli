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

// NEW: Analyze face from local URI with face detection, then upload
export async function analyzeFaceForColorProfileFromLocalUri(
  localUri: string,
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null }> {
  try {
    console.log('🎨 [SKIN TONE CLIENT] ========== STARTING FACE ANALYSIS (LOCAL URI) ==========');
    console.log('🎨 [SKIN TONE CLIENT] Local URI:', localUri.substring(0, 100));
    
    // Import face detection
    const { detectFaceBoxFromUri } = require('./facedetection');
    // @ts-ignore
    const ImageManipulator = require('expo-image-manipulator');
    
    // 1) Normalize/rescale image for consistent results
    const resized = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 768 } }], // higher than detector, still fine
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    console.log('🎨 [SKIN TONE CLIENT] Image resized to:', resized.width, 'x', resized.height);
    
    // 2) Detect face on resized image (important: same image coords!)
    const faceBox = await detectFaceBoxFromUri(resized.uri);
    
    if (!faceBox) {
      console.warn('🎨 [SKIN TONE CLIENT] No face detected in image');
      // Still upload the image for storage, but return null profile
      const uploadedUrl = await uploadFn(resized.uri);
      return { profile: null, uploadedUrl };
    }
    
    console.log('🎨 [SKIN TONE CLIENT] Face detected:', faceBox);
    
    // 3) Upload the SAME resized image
    const uploadedUrl = await uploadFn(resized.uri);
    console.log('🎨 [SKIN TONE CLIENT] Image uploaded:', uploadedUrl.substring(0, 100));
    
    // 4) Call server analysis with real faceBox
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) {
      throw new Error('API_BASE not configured');
    }
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageUrl: uploadedUrl, 
        faceBox: faceBox // REAL face box, not heuristic
      }),
    });
    
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
      skinHex: analysis.hex,
      clarity: analysis.clarity,
    };
    
    return { profile, uploadedUrl };
  } catch (error: any) {
    console.error('🎨 [SKIN TONE CLIENT] Error in analyzeFaceForColorProfileFromLocalUri:', error);
    // Try to upload anyway for storage
    try {
      // @ts-ignore
      const ImageManipulator = require('expo-image-manipulator');
      const resized = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 768 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      const uploadedUrl = await uploadFn(resized.uri);
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
    
    // Step 1: Use heuristic face region (works for selfies and portraits)
    // For selfies: face is typically in center, upper 60% of image
    // The API will refine this based on actual image dimensions
    console.log('🎨 [SKIN TONE CLIENT] Using heuristic face region (works for selfies/portraits)');
    
    const faceBox = {
      x: -1, // Signal to API to use heuristic (center-upper region)
      y: -1,
      width: -1,
      height: -1,
    };
    
    // Step 2: Call server-side API to analyze skin tone
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) {
      throw new Error('API_BASE not configured');
    }
    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;
    
    console.log('🎨 [SKIN TONE CLIENT] Calling API:', apiUrl);
    console.log('🎨 [SKIN TONE CLIENT] Request payload:', {
      imageUrl: faceImageUrl.substring(0, 80) + '...',
      faceBox,
    });
    
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
      .single();

    if (error) {
      console.error('Error loading color profile:', error);
      return null;
    }
    
    // If no color_season but we have color_tone, still return a partial profile
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

