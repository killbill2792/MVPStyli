/**
 * Polyfill for react-native-fs using expo-file-system
 * This allows TensorFlow.js to work in Expo managed workflow
 */

// @ts-ignore
import * as FileSystem from 'expo-file-system';

// Create a polyfill object that matches react-native-fs API
const RNFS = {
  DocumentDirectoryPath: FileSystem.documentDirectory || '',
  MainBundlePath: FileSystem.bundleDirectory || '',
  CachesDirectoryPath: FileSystem.cacheDirectory || '',
  
  readFile: async (filepath: string, encoding?: string): Promise<string> => {
    try {
      const result = await FileSystem.readAsStringAsync(filepath, {
        encoding: encoding === 'utf8' ? 'utf8' : 'base64',
      });
      return result;
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  },
  
  writeFile: async (filepath: string, contents: string, encoding?: string): Promise<void> => {
    try {
      await FileSystem.writeAsStringAsync(filepath, contents, {
        encoding: encoding === 'utf8' ? 'utf8' : 'base64',
      });
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  },
  
  exists: async (filepath: string): Promise<boolean> => {
    try {
      const info = await FileSystem.getInfoAsync(filepath);
      return info.exists;
    } catch {
      return false;
    }
  },
  
  mkdir: async (filepath: string, options?: { NSURLIsExcludedFromBackupKey?: boolean }): Promise<void> => {
    try {
      await FileSystem.makeDirectoryAsync(filepath, { intermediates: true });
    } catch (error: any) {
      // Ignore if already exists
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  },
  
  unlink: async (filepath: string): Promise<void> => {
    try {
      await FileSystem.deleteAsync(filepath, { idempotent: true });
    } catch (error: any) {
      // Ignore if doesn't exist
      if (!error.message.includes('not found')) {
        throw error;
      }
    }
  },
  
  stat: async (filepath: string): Promise<any> => {
    try {
      const info = await FileSystem.getInfoAsync(filepath);
      if (!info.exists) {
        throw new Error('File does not exist');
      }
      return {
        size: info.size || 0,
        isFile: () => !info.isDirectory,
        isDirectory: () => info.isDirectory || false,
      };
    } catch (error: any) {
      throw new Error(`Failed to stat file: ${error.message}`);
    }
  },
};

export default RNFS;

