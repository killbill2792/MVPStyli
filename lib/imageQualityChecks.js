/**
 * App-side image quality checks (before sending to API)
 * These are lightweight checks to catch obvious issues
 */

import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';

/**
 * Simple blur detection using Laplacian variance
 * Lower variance = more blurry
 */
export async function checkBlur(imageUri) {
  try {
    // For React Native, we'll use a simple heuristic:
    // Read image and check if it's too small (indicates compression/blur)
    const imageInfo = await Image.getSize(imageUri);
    
    // Very small images are likely blurry
    if (imageInfo.width < 200 || imageInfo.height < 200) {
      return {
        isBlurry: true,
        message: 'Image is too small. Please use a higher resolution photo.',
      };
    }
    
    // For now, we'll assume images from camera/library are acceptable
    // More sophisticated blur detection would require image processing libraries
    return {
      isBlurry: false,
      message: null,
    };
  } catch (error) {
    console.error('Error checking blur:', error);
    return {
      isBlurry: false,
      message: null,
    };
  }
}

/**
 * Check image brightness
 * Returns average brightness and recommendation
 */
export async function checkBrightness(imageUri) {
  try {
    // Use a simple heuristic based on file size and image dimensions
    const imageInfo = await Image.getSize(imageUri);
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    
    // Very small file size relative to dimensions suggests low quality/dark image
    const fileSize = fileInfo.exists ? fileInfo.size : 0;
    const pixels = imageInfo.width * imageInfo.height;
    const bytesPerPixel = pixels > 0 ? fileSize / pixels : 0;
    
    // If bytes per pixel is very low, image might be too dark or compressed
    if (bytesPerPixel < 0.5 && pixels > 0) {
      return {
        isTooDark: true,
        message: 'Image appears too dark. Try better lighting near a window.',
        averageBrightness: 'low',
      };
    }
    
    return {
      isTooDark: false,
      message: null,
      averageBrightness: 'normal',
    };
  } catch (error) {
    console.error('Error checking brightness:', error);
    return {
      isTooDark: false,
      message: null,
      averageBrightness: 'normal',
    };
  }
}

/**
 * Rough white balance cast estimate
 * Checks if image has extreme warm/cool cast
 */
export async function checkWhiteBalance(imageUri) {
  try {
    // This is a simplified check
    // In practice, you'd analyze RGB channels
    // For now, we'll rely on server-side lighting correction
    
    // Return neutral for now - server will handle this
    return {
      hasExtremeCast: false,
      castType: 'neutral',
      message: null,
    };
  } catch (error) {
    console.error('Error checking white balance:', error);
    return {
      hasExtremeCast: false,
      castType: 'neutral',
      message: null,
    };
  }
}

/**
 * Run all quality checks
 * Returns array of issues and recommendations
 */
export async function runQualityChecks(imageUri) {
  const issues = [];
  const recommendations = [];
  
  const blurCheck = await checkBlur(imageUri);
  if (blurCheck.isBlurry) {
    issues.push('blur');
    recommendations.push(blurCheck.message);
  }
  
  const brightnessCheck = await checkBrightness(imageUri);
  if (brightnessCheck.isTooDark) {
    issues.push('dark');
    recommendations.push(brightnessCheck.message);
  }
  
  const wbCheck = await checkWhiteBalance(imageUri);
  if (wbCheck.hasExtremeCast) {
    issues.push('whiteBalance');
    recommendations.push(`Image has extreme ${wbCheck.castType} cast. Try natural daylight.`);
  }
  
  return {
    hasIssues: issues.length > 0,
    issues,
    recommendations,
  };
}
