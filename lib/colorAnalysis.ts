// utils/colorAnalysis.ts
import { supabase } from "./supabase";

export interface ColorProfile {
  tone: "warm" | "cool" | "neutral";
  depth: "light" | "medium" | "deep";
  season: "spring" | "summer" | "autumn" | "winter";
  bestColors: string[];
  avoidColors: string[];
  description: string;
}

export interface ExtendedColorProfile extends ColorProfile {
  confidence?: number;
  microSeason?: string | null; // Internal use only (e.g., 'soft_autumn', 'bright_winter');
  seasonConfidence?: number;
  needsConfirmation?: boolean;
  skinHex?: string;
  clarity?: "muted" | "clear" | "vivid";
  seasonCandidates?: Array<{ season: string; score: number; reason?: string }>;
}

const COLOR_SEASONS = {
  spring: {
    tone: "warm",
    depth: "light",
    description: "Warm & Light (Spring)",
    bestColors: ["coral", "peach", "warm ivory", "golden yellow", "turquoise", "light warm green", "warm pink", "cream"],
    avoidColors: ["black", "pure white", "cool grey", "burgundy", "dark navy"],
    swatches: ["#FF7F50", "#FFDAB9", "#FFFFF0", "#FFD700", "#40E0D0", "#90EE90", "#FFB6C1", "#FFFDD0"],
  },
  summer: {
    tone: "cool",
    depth: "light",
    description: "Cool & Soft (Summer)",
    bestColors: ["lavender", "soft pink", "powder blue", "rose", "mauve", "soft grey", "periwinkle", "dusty blue"],
    avoidColors: ["orange", "gold", "warm brown", "bright yellow", "rust"],
    swatches: ["#E6E6FA", "#FFB6C1", "#B0E0E6", "#FF007F", "#E0B0FF", "#C0C0C0", "#CCCCFF", "#6699CC"],
  },
  autumn: {
    tone: "warm",
    depth: "deep",
    description: "Warm & Deep (Autumn)",
    bestColors: ["camel", "rust", "olive", "burnt orange", "warm brown", "teal", "mustard", "terracotta"],
    avoidColors: ["pastel pink", "icy blue", "silver grey", "bright white", "fuchsia"],
    swatches: ["#C19A6B", "#B7410E", "#808000", "#CC5500", "#964B00", "#008080", "#FFDB58", "#E2725B"],
  },
  winter: {
    tone: "cool",
    depth: "deep",
    description: "Cool & Deep (Winter)",
    bestColors: ["black", "pure white", "true red", "emerald", "royal blue", "fuchsia", "icy grey", "burgundy"],
    avoidColors: ["orange", "gold", "warm beige", "rust", "mustard"],
    swatches: ["#000000", "#FFFFFF", "#FF0000", "#50C878", "#4169E1", "#FF00FF", "#D3D3D3", "#800020"],
  },
} as const;

type CropInfo = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
};

type ApiResponse = {
  rgb?: { r: number; g: number; b: number };
  hex?: string;
  lab?: { L: number; a: number; b: number };
  undertone?: "warm" | "cool" | "neutral";
  depth?: "light" | "medium" | "deep";
  clarity?: "muted" | "clear" | "vivid";
  season?: "spring" | "summer" | "autumn" | "winter";
  confidence?: number;
  seasonConfidence?: number;
  needsConfirmation?: boolean;
  seasonCandidates?: Array<{ season: string; score: number; reason?: string }>;
  qualityMessages?: string[];
  microSeason?: string | null;
  error?: string;
  message?: string;

  quality?: {
    issues: string[];
    severity: "none" | "soft" | "hard";
    messages: string[];
  };
};

function getApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new Error("API base missing: set EXPO_PUBLIC_API_BASE");
  return base;
}

export async function analyzeFaceForColorProfileFromCroppedImage(
  imageUri: string,
  cropInfo: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number },
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null; qualityMessages?: string[]; error?: string }> {
  try {
    const uploadedUrl = await uploadFn(imageUri);

    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
    if (!API_BASE) throw new Error('API_BASE not configured');

    const apiUrl = `${API_BASE}/api/analyze-skin-tone`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: uploadedUrl, cropInfo }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = 'Failed to analyze photo';
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          // Map API error codes to user-friendly messages
          switch (errorData.error) {
            case 'LOW_QUALITY_SAMPLES':
              errorMessage = 'Photo quality too low. Please try:\n\n• Daylight near a window\n• Avoid shadows\n• No filters\n• Clear face visibility';
              break;
            case 'INVALID_CROP_BOX':
            case 'FACE_NOT_DETECTED':
              errorMessage = 'No face detected. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible';
              break;
            default:
              errorMessage = errorData.message || errorData.error || 'Failed to analyze photo';
          }
        }
      } catch (e) {
        // If parsing fails, use the raw text or default message
        errorMessage = text || 'Failed to analyze photo';
      }
      return { profile: null, uploadedUrl: null, error: errorMessage };
    }

    const analysis = await response.json();

    // Check if API returned an error even with 200 status
    if (analysis.error) {
      let errorMessage = 'Failed to analyze photo';
      switch (analysis.error) {
        case 'LOW_QUALITY_SAMPLES':
          errorMessage = 'Photo quality too low. Please try:\n\n• Daylight near a window\n• Avoid shadows\n• No filters\n• Clear face visibility';
          break;
        case 'INVALID_CROP_BOX':
        case 'FACE_NOT_DETECTED':
          errorMessage = 'No face detected. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible';
          break;
        default:
          errorMessage = analysis.message || analysis.error || 'Failed to analyze photo';
      }
      return { profile: null, uploadedUrl: null, error: errorMessage };
    }

    if (!analysis?.season || !analysis?.undertone) {
      return { profile: null, uploadedUrl: null, error: 'Could not determine color season. Please try a different photo.' };
    }

    const seasonData = COLOR_SEASONS[analysis.season as keyof typeof COLOR_SEASONS] ?? null;

    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      bestColors: seasonData?.bestColors ? [...seasonData.bestColors] : [],
      avoidColors: seasonData?.avoidColors ? [...seasonData.avoidColors] : [],
      description: seasonData?.description ?? 'Color analysis complete',
      confidence: analysis.confidence ?? 0,
      seasonConfidence: analysis.seasonConfidence ?? 0,
      needsConfirmation: !!analysis.needsConfirmation,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
      microSeason: analysis.microSeason || null, // Internal use only, not displayed to user

      // Optional: store top-2 in your UI (recommended)
      seasonCandidates: analysis.seasonCandidates ?? undefined,
    };

    return { profile, uploadedUrl, qualityMessages: analysis.qualityMessages };
  } catch (e) {
    console.error('analyzeFaceForColorProfileFromCroppedImage failed', e);
    return { profile: null, uploadedUrl: null, error: `Analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
}

export async function analyzeFaceForColorProfileFromLocalUri(
  localUri: string,
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null; qualityMessages?: string[]; qualitySeverity?: "none" | "soft" | "hard"; error?: string }> {
  try {
    const uploadedUrl = await uploadFn(localUri);

    const apiUrl = `${getApiBase()}/api/analyze-skin-tone`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: uploadedUrl }),
    });

    if (!res.ok) {
      const txt = await res.text();
      let errorMessage = 'Failed to analyze photo';
      try {
        const errorData = JSON.parse(txt);
        if (errorData.error) {
          switch (errorData.error) {
            case 'LOW_QUALITY_SAMPLES':
              errorMessage = 'Photo quality too low. Please try:\n\n• Daylight near a window\n• Avoid shadows\n• No filters\n• Clear face visibility';
              break;
            case 'INVALID_CROP_BOX':
            case 'FACE_NOT_DETECTED':
              errorMessage = 'No face detected. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible';
              break;
            default:
              errorMessage = errorData.message || errorData.error || 'Failed to analyze photo';
          }
        }
      } catch (e) {
        errorMessage = txt || 'Failed to analyze photo';
      }
      return { profile: null, uploadedUrl, error: errorMessage };
    }

    const analysis = (await res.json()) as ApiResponse;

    // Check if API returned an error even with 200 status
    if (analysis.error) {
      let errorMessage = 'Failed to analyze photo';
      switch (analysis.error) {
        case 'LOW_QUALITY_SAMPLES':
          errorMessage = 'Photo quality too low. Please try:\n\n• Daylight near a window\n• Avoid shadows\n• No filters\n• Clear face visibility';
          break;
        case 'INVALID_CROP_BOX':
        case 'FACE_NOT_DETECTED':
          errorMessage = 'No face detected. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible';
          break;
        default:
          errorMessage = analysis.message || analysis.error || 'Failed to analyze photo';
      }
      return { profile: null, uploadedUrl, error: errorMessage };
    }

    if (!analysis?.undertone || !analysis?.season) {
      return { profile: null, uploadedUrl, error: 'Could not determine color season. Please try a different photo.' };
    }

    const seasonData = COLOR_SEASONS[analysis.season];

    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      bestColors: [...seasonData.bestColors],
      avoidColors: [...seasonData.avoidColors],
      description: seasonData.description,
      confidence: analysis.confidence,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
      microSeason: analysis.microSeason || null, // Internal use only
    };

    return {
      profile,
      uploadedUrl,
      qualityMessages: analysis.quality?.messages ?? [],
      qualitySeverity: analysis.quality?.severity ?? "none",
    };
  } catch (e) {
    console.error("analyzeFaceForColorProfileFromLocalUri failed:", e);
    return { profile: null, uploadedUrl: null };
  }
}

// Save/load unchanged (keep your existing save/load if you want)
export async function saveColorProfile(userId: string, profile: ColorProfile | ExtendedColorProfile): Promise<boolean> {
  try {
    const extended = profile as ExtendedColorProfile;

    const updateData: any = {
      color_tone: profile.tone || null,
      color_depth: profile.depth || null,
      color_season: profile.season || null,
      best_colors: profile.bestColors || [],
      avoid_colors: profile.avoidColors || [],
      updated_at: new Date().toISOString(),
      // Save seasonConfidence to skin_tone_confidence column (preferred) or use confidence as fallback
      skin_tone_confidence: extended.seasonConfidence ?? extended.confidence ?? null,
      skin_hex: extended.skinHex ?? null,
      // Save clarity and microSeason (added columns)
      color_clarity: extended.clarity ?? null,
      micro_season: extended.microSeason ?? null,
    };
    
    // Update the database with all fields including seasonConfidence in skin_tone_confidence
    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);

    // Also save full profile including seasonConfidence to color_profile JSON field if column exists (for redundancy)
    if (extended.seasonConfidence !== undefined && extended.seasonConfidence !== null) {
      try {
        // Try to update color_profile JSON field with full profile (may not exist in all databases)
        const fullProfile = {
          ...extended,
          seasonConfidence: extended.seasonConfidence,
        };
        await supabase
          .from("profiles")
          .update({ 
            color_profile: fullProfile
          })
          .eq("id", userId);
      } catch (e) {
        // Column doesn't exist, that's okay - we already saved to skin_tone_confidence
      }
    }

    if (error) {
      console.error("saveColorProfile error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("saveColorProfile exception:", e);
    return false;
  }
}
// ✅ UI helper: return all seasons for browsing / manual selection
export function getAllSeasons() {
  return [
    {
      id: "spring",
      name: "Warm & Light (Spring)",
      tone: "warm",
      depth: "light",
      swatches: ["#FF7F50", "#FFDAB9", "#FFD700", "#40E0D0"],
    },
    {
      id: "summer",
      name: "Cool & Soft (Summer)",
      tone: "cool",
      depth: "light",
      swatches: ["#E6E6FA", "#B0E0E6", "#CCCCFF", "#C0C0C0"],
    },
    {
      id: "autumn",
      name: "Warm & Deep (Autumn)",
      tone: "warm",
      depth: "deep",
      swatches: ["#C19A6B", "#B7410E", "#808000", "#CC5500"],
    },
    {
      id: "winter",
      name: "Cool & Deep (Winter)",
      tone: "cool",
      depth: "deep",
      swatches: ["#000000", "#FFFFFF", "#4169E1", "#800020"],
    },
  ];
}

// Get color profile for a specific season
export function getSeasonProfile(season: string): ColorProfile {
  const seasonData = COLOR_SEASONS[season as keyof typeof COLOR_SEASONS] || COLOR_SEASONS.autumn;
  return {
    tone: seasonData.tone as "warm" | "cool" | "neutral",
    depth: seasonData.depth as "light" | "medium" | "deep",
    season: season as "spring" | "summer" | "autumn" | "winter",
    bestColors: [...seasonData.bestColors],
    avoidColors: [...seasonData.avoidColors],
    description: seasonData.description,
  };
}

// Get color swatches for display
export function getSeasonSwatches(season: string): string[] {
  const swatches = COLOR_SEASONS[season as keyof typeof COLOR_SEASONS]?.swatches;
  return swatches ? [...swatches] : [];
}

// Load color profile from user's profile
export async function loadColorProfile(userId: string): Promise<ColorProfile | ExtendedColorProfile | null> {
  try {
    // Try to select color_profile, but handle if column doesn't exist
    let selectFields = "color_tone, color_depth, color_season, best_colors, avoid_colors, skin_tone_confidence, skin_hex, color_clarity, micro_season";
    
    const { data, error } = await supabase
      .from("profiles")
      .select(selectFields)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading color profile:", error);
      return null;
    }

    // If no data (new user without profile) or no color_season/color_tone, return null
    if (!data || (!(data as any).color_season && !(data as any).color_tone)) {
      return null;
    }

    const profile: any = {
      tone: (data as any).color_tone || "neutral",
      depth: (data as any).color_depth || "medium",
      season: (data as any).color_season,
      bestColors: (data as any).best_colors || [],
      avoidColors: (data as any).avoid_colors || [],
      description: getSeasonProfile((data as any).color_season).description,
      // Load confidence from skin_tone_confidence column
      confidence: (data as any).skin_tone_confidence || null,
      seasonConfidence: (data as any).skin_tone_confidence || null,
    };
    if ((data as any).skin_hex) {
      profile.skinHex = (data as any).skin_hex;
    }
    // Load clarity and microSeason (new columns)
    if ((data as any).color_clarity) {
      profile.clarity = (data as any).color_clarity;
    }
    if ((data as any).micro_season) {
      profile.microSeason = (data as any).micro_season;
    }
    // Try to load seasonConfidence from color_profile JSON field if available
    // This is a separate query to avoid errors if column doesn't exist
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("color_profile, skin_tone_confidence")
        .eq("id", userId)
        .maybeSingle();
      
      if (profileData?.color_profile && typeof profileData.color_profile === 'object' && profileData.color_profile.seasonConfidence !== undefined) {
        profile.seasonConfidence = profileData.color_profile.seasonConfidence;
      } else if (profileData?.skin_tone_confidence !== undefined && profileData?.skin_tone_confidence !== null) {
        // Fallback to skin_tone_confidence column
        profile.seasonConfidence = profileData.skin_tone_confidence;
      }
    } catch (e) {
      // Column doesn't exist, that's okay
    }


    return profile;
  } catch (error) {
    console.error("Error loading color profile:", error);
    return null;
  }
}

// Backward compatibility: analyzeFaceForColorProfile (uses analyzeFaceForColorProfileFromLocalUri)
export async function analyzeFaceForColorProfile(
  faceImageUrl: string,
  uploadFn?: (uri: string) => Promise<string>
): Promise<ExtendedColorProfile | null> {
  try {
    // If uploadFn is provided, treat as local URI
    if (uploadFn) {
      const result = await analyzeFaceForColorProfileFromLocalUri(faceImageUrl, uploadFn);
      return result.profile;
    }

    // Otherwise, treat as already uploaded URL and call API directly
    const apiUrl = `${getApiBase()}/api/analyze-skin-tone`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: faceImageUrl }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Skin tone API error:", res.status, txt);
      return null;
    }

    const analysis = (await res.json()) as ApiResponse;

    if (!analysis?.undertone || !analysis?.season) {
      return null;
    }

    const seasonData = COLOR_SEASONS[analysis.season];

    const profile: ExtendedColorProfile = {
      tone: analysis.undertone,
      depth: analysis.depth,
      season: analysis.season,
      bestColors: [...seasonData.bestColors],
      avoidColors: [...seasonData.avoidColors],
      description: seasonData.description,
      confidence: analysis.confidence,
      seasonConfidence: analysis.seasonConfidence,
      needsConfirmation: analysis.needsConfirmation,
      skinHex: analysis.hex,
      clarity: analysis.clarity,
      microSeason: analysis.microSeason || null, // Internal use only
    };

    return profile;
  } catch (e) {
    console.error("analyzeFaceForColorProfile failed:", e);
    return null;
  }
}