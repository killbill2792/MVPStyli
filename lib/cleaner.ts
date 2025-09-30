// lib/cleaner.ts
import { uploadDataUrlToSupabase } from "./upload";

/**
 * getCleanGarmentUrl
 * Returns an HTTPS image URL for the garment.
 * - If your cleaner returns a data:URI, we upload to Supabase and return its public URL.
 * - If the cleaner fails, we fall back to the original product image URL.
 */
export async function getCleanGarmentUrl(productId: string, productImageUrl: string, category: "upper" | "lower" | "dress" | string) {
  try {
    // If you have a Vercel /api/garment-clean that sometimes returns base64:
    const resp = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/garment-clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, imageUrl: productImageUrl, category }),
    });

    if (!resp.ok) throw new Error("cleaner_http_error");
    const json = await resp.json(); // { url: <https|string data:...> }

    let url: string = json?.cleanUrl || "";
    if (!url) throw new Error("cleaner_empty");

    // The API now returns HTTPS URLs directly, no need to handle data URIs
    return url;
  } catch {
    // graceful fallback: use original product image URL
    return productImageUrl;
  }
}
