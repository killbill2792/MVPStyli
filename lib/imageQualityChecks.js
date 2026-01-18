/**
 * App-side image quality checks (before sending to API)
 * Lightweight client checks.
 * IMPORTANT: Do NOT try to infer brightness from file size.
 * Brightness must be computed from pixels (server does that).
 */

import { Image } from "react-native";

export async function runQualityChecks(imageUri) {
  const issues = [];
  const recommendations = [];

  // Only check minimum resolution (helps avoid tiny/thumbnail images)
  const { width, height } = await new Promise((resolve, reject) => {
    Image.getSize(
      imageUri,
      (w, h) => resolve({ width: w, height: h }),
      (e) => reject(e)
    );
  });

  if (width < 350 || height < 350) {
    issues.push("lowResolution");
    recommendations.push("Use a higher resolution photo (not a thumbnail).");
  }

  return {
    hasIssues: issues.length > 0,
    issues,
    recommendations,
  };
}