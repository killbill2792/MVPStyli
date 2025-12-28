/**
 * TensorFlow.js Platform Setup for Expo
 * Configures TensorFlow.js to work with Expo file system instead of react-native-fs
 */

// @ts-ignore
import * as tf from '@tensorflow/tfjs';
// @ts-ignore
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
// @ts-ignore
import '@tensorflow/tfjs-react-native';
// @ts-ignore
import { Platform } from 'react-native';
// @ts-ignore
import * as FileSystem from 'expo-file-system';

// Polyfill react-native-fs for TensorFlow.js
// This allows TensorFlow.js to work in Expo managed workflow
if (typeof global.require === 'undefined') {
  // @ts-ignore
  global.require = (module: string) => {
    if (module === 'react-native-fs') {
      // Return a polyfill that uses expo-file-system
      return {
        DocumentDirectoryPath: FileSystem.documentDirectory || '',
        MainBundlePath: FileSystem.bundleDirectory || '',
        readFile: async (filepath: string, encoding?: string) => {
          try {
            const result = await FileSystem.readAsStringAsync(filepath, {
              encoding: encoding === 'utf8' ? 'utf8' : 'base64',
            });
            return result;
          } catch (error) {
            throw error;
          }
        },
        writeFile: async (filepath: string, contents: string, encoding?: string) => {
          try {
            await FileSystem.writeAsStringAsync(filepath, contents, {
              encoding: encoding === 'utf8' ? 'utf8' : 'base64',
            });
          } catch (error) {
            throw error;
          }
        },
        exists: async (filepath: string) => {
          try {
            const info = await FileSystem.getInfoAsync(filepath);
            return info.exists;
          } catch {
            return false;
          }
        },
        mkdir: async (filepath: string) => {
          try {
            await FileSystem.makeDirectoryAsync(filepath, { intermediates: true });
          } catch (error) {
            // Ignore if already exists
          }
        },
        unlink: async (filepath: string) => {
          try {
            await FileSystem.deleteAsync(filepath, { idempotent: true });
          } catch (error) {
            // Ignore if doesn't exist
          }
        },
      };
    }
    throw new Error(`Cannot find module: ${module}`);
  };
}

// Initialize TensorFlow.js platform
export async function setupTensorFlowPlatform() {
  // Wait for TensorFlow.js to be ready
  await tf.ready();
  
  // Set platform to React Native
  // @ts-ignore
  if (Platform.OS !== 'web') {
    // @ts-ignore
    tf.setPlatform('react-native', {
      // @ts-ignore
      fetch: require('@tensorflow/tfjs-react-native').fetch,
      // @ts-ignore
      fileSystem: require('@tensorflow/tfjs-react-native').bundleResourceIO,
    });
  }
  
  console.log('✅ TensorFlow.js platform initialized for Expo');
}

