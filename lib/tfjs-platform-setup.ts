/**
 * TensorFlow.js Platform Setup for Expo
 * Initializes TensorFlow.js for React Native/Expo
 */

// @ts-ignore
import * as tf from '@tensorflow/tfjs';
// @ts-ignore
import '@tensorflow/tfjs-react-native';

// Initialize TensorFlow.js platform
export async function setupTensorFlowPlatform() {
  // Wait for TensorFlow.js to be ready
  // Metro bundler will handle react-native-fs polyfill via alias
  await tf.ready();
  console.log('✅ TensorFlow.js platform initialized for Expo');
}

