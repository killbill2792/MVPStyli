/**
 * Optimized Image Component
 * Uses expo-image for better performance, caching, and loading
 * Includes automatic optimization and placeholder support
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';

/**
 * Get optimized image URL with optional resizing
 * For Supabase Storage, we can add transformations in the future
 */
export function getOptimizedImageUrl(originalUrl, width, height, quality = 80) {
  if (!originalUrl || typeof originalUrl !== 'string') return null;
  
  // Remove query params if present to avoid conflicts
  const cleanUrl = originalUrl.split('?')[0];
  
  // For now, return original URL
  // Future: Add CDN transformations or Supabase Storage transformations
  // Example: return `${cleanUrl}?width=${width}&height=${height}&quality=${quality}`;
  
  return cleanUrl;
}

/**
 * Optimized Image Component with:
 * - Better caching (expo-image)
 * - Loading placeholder
 * - Error handling
 * - Automatic optimization
 */
export const OptimizedImage = ({ 
  source, 
  style, 
  resizeMode = 'cover',
  width,
  height,
  quality = 80,
  placeholder = null,
  showErrorPlaceholder = false, // If false, return null on error so parent can show letter
  onError = null, // Callback when image fails to load
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Handle source prop (can be string URI, { uri: string }, or require() local asset)
  let imageSource = null;
  let isLocalAsset = false;
  
  if (typeof source === 'string') {
    imageSource = { uri: source };
  } else if (source && typeof source === 'number') {
    // Local asset from require() - expo-image handles this directly
    imageSource = source;
    isLocalAsset = true;
  } else if (source && source.uri) {
    imageSource = { uri: source.uri };
  } else if (source && typeof source === 'object' && source.uri) {
    imageSource = { uri: source.uri };
  } else if (source && typeof source === 'object') {
    // Could be { uri: ... } or other object format
    imageSource = source;
  }
  
  // Optimize the image URL if it's a remote URI and dimensions provided
  if (!isLocalAsset && imageSource && imageSource.uri && typeof imageSource.uri === 'string') {
    const optimizedUri = getOptimizedImageUrl(imageSource.uri, width, height, quality);
    if (optimizedUri) {
      imageSource = { uri: optimizedUri };
    }
  }
  
  // If no source, return null so parent can show letter placeholder
  if (!imageSource) {
    return null;
  }
  
  // Handle error - call onError callback if provided, otherwise return null
  if (hasError) {
    if (onError) {
      onError();
    }
    if (showErrorPlaceholder) {
      return (
        <View style={[style, styles.errorContainer]}>
          {placeholder || <Text style={styles.errorText}>IMG</Text>}
        </View>
      );
    }
    return null;
  }
  
  // Extract borderRadius from style to ensure image respects it
  const borderRadius = style?.borderRadius || (Array.isArray(style) ? style.find(s => s?.borderRadius)?.borderRadius : undefined);
  const containerStyle = [style, { overflow: 'hidden' }];
  
  return (
    <View style={containerStyle}>
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, borderRadius ? { borderRadius } : {}]}
        contentFit={resizeMode}
        transition={200}
        cachePolicy="memory-disk"
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          const uri = typeof imageSource === 'object' && imageSource.uri ? imageSource.uri : 'local asset';
          console.log('OptimizedImage error:', typeof uri === 'string' ? uri.substring(0, 100) : uri);
          setHasError(true);
          setIsLoading(false);
          if (onError) {
            onError();
          }
        }}
        placeholder={placeholder || styles.placeholder}
        {...props}
      />
      {isLoading && (
        <View style={[styles.loadingContainer, borderRadius ? { borderRadius } : {}]}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 10,
    color: '#666',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
  },
});

/**
 * Backward-compatible SafeImage component
 * Now uses OptimizedImage internally
 * Returns null on error so parent can show letter placeholder
 */
export const SafeImage = ({ source, style, resizeMode, ...props }) => {
  // Check if source is null/undefined - return null so parent shows letter
  if (!source || (typeof source === 'object' && !source.uri)) {
    return null;
  }
  
  return (
    <OptimizedImage
      source={source}
      style={style}
      resizeMode={resizeMode}
      showErrorPlaceholder={false} // Don't show "IMG", let parent show letter
      {...props}
    />
  );
};

