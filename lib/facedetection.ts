// faceDetection.ts - Using expo-face-detector instead of TensorFlow
import * as ImageManipulator from "expo-image-manipulator";

export type FaceBox = { x: number; y: number; width: number; height: number };

// Lazy load FaceDetector to handle cases where native module isn't available
let FaceDetector: any = null;
let faceDetectorLoaded = false;

async function loadFaceDetector() {
  if (faceDetectorLoaded) return FaceDetector;
  
  try {
    // @ts-ignore - expo-face-detector types may not be available
    const detector = require("expo-face-detector");
    FaceDetector = detector.FaceDetector;
    faceDetectorLoaded = true;
    console.log('📸 [FACE DETECTION] FaceDetector module loaded successfully');
    return FaceDetector;
  } catch (error) {
    console.warn('📸 [FACE DETECTION] Failed to load expo-face-detector:', error);
    console.warn('📸 [FACE DETECTION] Native module may not be available. Face detection will be disabled.');
    faceDetectorLoaded = true; // Mark as loaded to prevent repeated attempts
    return null;
  }
}

/**
 * For consistent detection, resize to a reasonable max size (keeps speed stable).
 * Returns newUri + scale factors so we can map box back to original.
 */
async function normalizeImage(uri: string) {
  console.log('📸 [FACE DETECTION] Normalizing image:', uri.substring(0, 100));
  // Resize to a max width of 512 for faster detection
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  console.log('📸 [FACE DETECTION] Image resized to:', resized.width, 'x', resized.height);
  return resized.uri;
}

/**
 * Detect face box from image URI using expo-face-detector
 * Returns face bounding box in image coordinates, or null if no face detected or module unavailable
 */
export async function detectFaceBoxFromUri(originalUri: string): Promise<FaceBox | null> {
  const startTime = Date.now();
  console.log('📸 [FACE DETECTION] ========== STARTING FACE DETECTION ==========');
  console.log('📸 [FACE DETECTION] Original URI:', originalUri.substring(0, 100));
  
  try {
    // Try to load FaceDetector module
    const Detector = await loadFaceDetector();
    
    if (!Detector) {
      console.warn('📸 [FACE DETECTION] FaceDetector module not available. Returning null.');
      console.warn('📸 [FACE DETECTION] To enable face detection, ensure expo-face-detector is properly configured in app.json and rebuild the app.');
      return null;
    }
    
    // Resize for stable & fast detection
    const resizedUri = await normalizeImage(originalUri);
    
    console.log('📸 [FACE DETECTION] Calling FaceDetector.detectFacesAsync...');
    
    // Use expo-face-detector to detect faces
    // Options: fast mode for speed, detect only 1 face
    const faces = await Detector.detectFacesAsync(resizedUri, {
      mode: Detector.Constants.Mode.fast, // fast mode for speed
      detectLandmarks: Detector.Constants.Landmarks.none, // we don't need landmarks
      runClassifications: Detector.Constants.Classifications.none, // we don't need classifications
      minDetectionInterval: 0,
      tracking: false,
    });
    
    const detectionTime = Date.now() - startTime;
    console.log('📸 [FACE DETECTION] Detection completed in:', detectionTime, 'ms');
    console.log('📸 [FACE DETECTION] Faces detected:', faces?.faces?.length || 0);
    
    if (!faces || !faces.faces || faces.faces.length === 0) {
      console.log('📸 [FACE DETECTION] No face detected in image');
      return null;
    }

    // Get the first face (we only need one)
    const face = faces.faces[0];
    console.log('📸 [FACE DETECTION] Face data:', {
      bounds: face.bounds,
      rollAngle: face.rollAngle,
      yawAngle: face.yawAngle,
    });

    // expo-face-detector returns bounds as { origin: { x, y }, size: { width, height } }
    const bounds = face.bounds;
    const faceBox: FaceBox = {
      x: Math.max(0, Math.floor(bounds.origin.x)),
      y: Math.max(0, Math.floor(bounds.origin.y)),
      width: Math.max(1, Math.floor(bounds.size.width)),
      height: Math.max(1, Math.floor(bounds.size.height)),
    };
    
    console.log('📸 [FACE DETECTION] Face box (resized image coordinates):', faceBox);
    console.log('📸 [FACE DETECTION] ========== FACE DETECTION COMPLETE ==========');
    
    return faceBox;
  } catch (error: any) {
    const errorTime = Date.now() - startTime;
    console.error('📸 [FACE DETECTION] Error during face detection:', error);
    console.error('📸 [FACE DETECTION] Error message:', error?.message || 'Unknown error');
    console.error('📸 [FACE DETECTION] Error time:', errorTime, 'ms');
    
    // Check if it's a native module error
    if (error?.message?.includes('Cannot find native module') || 
        error?.message?.includes('ExpoFaceDetector')) {
      console.warn('📸 [FACE DETECTION] Native module not found. Please add expo-face-detector plugin to app.json and rebuild.');
      console.warn('📸 [FACE DETECTION] Face detection will be disabled until native module is available.');
    }
    
    // Return null on error - caller will handle gracefully
    return null;
  }
}
