/**
 * TensorFlow.js Platform Setup for Expo
 * NOTE: This is currently disabled as we're using expo-face-detector instead.
 * TensorFlow imports are commented out to prevent Fabric component registration issues.
 */

// CRITICAL: TensorFlow.js imports are disabled to prevent Fabric registration crashes
// The @tensorflow/tfjs-react-native package tries to register Fabric components
// even when newArchEnabled is false, causing NSInvalidArgumentException crashes.
// Since we're using expo-face-detector, TensorFlow is not needed.

// DISABLED IMPORTS (commented out to prevent module loading):
// import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-react-native';

// Initialize TensorFlow.js platform (DISABLED)
export async function setupTensorFlowPlatform() {
  // TensorFlow.js initialization is disabled
  // We're using expo-face-detector for face detection instead
  // This prevents Fabric component registration crashes
  console.log('⚠️ TensorFlow.js setup skipped - using expo-face-detector');
  return Promise.resolve();
}

