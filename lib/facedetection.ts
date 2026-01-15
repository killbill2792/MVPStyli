/**
 * Face Detection Types
 * 
 * NOTE: Client-side face detection has been removed.
 * All face detection is now handled server-side via the /api/analyze-skin-tone endpoint.
 * 
 * This file is kept only for type definitions if needed elsewhere.
 */

export type FaceBox = { x: number; y: number; width: number; height: number };

/**
 * @deprecated Client-side face detection is no longer used.
 * Server-side detection is the primary method.
 * This function is kept for backward compatibility but always returns null.
 */
export async function detectFaceBoxFromUri(_originalUri: string): Promise<FaceBox | null> {
  // Client-side face detection removed - server handles detection
  return null;
}
