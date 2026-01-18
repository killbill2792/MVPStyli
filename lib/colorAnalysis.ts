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
  rgb: { r: number; g: number; b: number };
  hex: string;
  lab: { L: number; a: number; b: number };
  undertone: "warm" | "cool" | "neutral";
  depth: "light" | "medium" | "deep";
  clarity: "muted" | "clear" | "vivid";
  season: "spring" | "summer" | "autumn" | "winter";
  confidence: number;
  seasonConfidence: number;
  needsConfirmation: boolean;
  seasonCandidates?: Array<{ season: string; score: number; reason?: string }>;
  qualityMessages?: string[];

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
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null; qualityMessages?: string[] }> {
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
      console.error('Skin tone API error', response.status, text);
      return { profile: null, uploadedUrl: null };
    }

    const analysis = await response.json();

    if (!analysis?.season || !analysis?.undertone) {
      return { profile: null, uploadedUrl: null };
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

      // Optional: store top-2 in your UI (recommended)
      seasonCandidates: analysis.seasonCandidates ?? undefined,
    };

    return { profile, uploadedUrl, qualityMessages: analysis.qualityMessages };
  } catch (e) {
    console.error('analyzeFaceForColorProfileFromCroppedImage failed', e);
    return { profile: null, uploadedUrl: null };
  }
}

export async function analyzeFaceForColorProfileFromLocalUri(
  localUri: string,
  uploadFn: (uri: string) => Promise<string>
): Promise<{ profile: ExtendedColorProfile | null; uploadedUrl: string | null; qualityMessages?: string[]; qualitySeverity?: "none" | "soft" | "hard" }> {
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
      console.error("Skin tone API error:", res.status, txt);
      return { profile: null, uploadedUrl };
    }

    const analysis = (await res.json()) as ApiResponse;

    if (!analysis?.undertone || !analysis?.season) {
      return { profile: null, uploadedUrl };
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
      skin_tone_confidence: extended.confidence ?? null,
      skin_hex: extended.skinHex ?? null,
    };

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);

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
    const { data, error } = await supabase
      .from("profiles")
      .select("color_tone, color_depth, color_season, best_colors, avoid_colors, skin_tone_confidence, skin_hex")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading color profile:", error);
      return null;
    }

    // If no data (new user without profile) or no color_season/color_tone, return null
    if (!data || (!data.color_season && !data.color_tone)) {
      return null;
    }

    const profile: any = {
      tone: data.color_tone || "neutral",
      depth: data.color_depth || "medium",
      season: data.color_season,
      bestColors: data.best_colors || [],
      avoidColors: data.avoid_colors || [],
      description: getSeasonProfile(data.color_season).description,
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
    };

    return profile;
  } catch (e) {
    console.error("analyzeFaceForColorProfile failed:", e);
    return null;
  }
}