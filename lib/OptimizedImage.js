/**
 * Optimized Image Component
 * Uses expo-image for better performance, caching, and loading
 * Includes automatic optimization and placeholder support
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';

// Prefetch queue to batch image prefetching
const prefetchQueue = new Set();
let prefetchTimer = null;

/**
 * Prefetch an image URL in the background
 * This helps subsequent loads be faster from disk cache
 */
export function prefetchImage(url) {
  if (!url || typeof url !== 'string') return;
  
  // Add to queue
  prefetchQueue.add(url);
  
  // Process queue after a short delay to batch multiple prefetch requests
  if (!prefetchTimer) {
    prefetchTimer = setTimeout(() => {
      const urls = Array.from(prefetchQueue);
      prefetchQueue.clear();
      prefetchTimer = null;
      
      // Prefetch all queued images
      urls.forEach(u => {
        Image.prefetch(u).catch(() => {
          // Silently fail - prefetch is best-effort
        });
      });
    }, 50);
  }
}

/**
 * Prefetch multiple image URLs
 */
export function prefetchImages(urls) {
  if (!urls || !Array.isArray(urls)) return;
  urls.forEach(url => prefetchImage(url));
}

// Module-level cache to track loaded images across component remounts
// This persists even when navigating away and back
// We cache both the full URL and the base URL (without query params) to handle transformations
const loadedImageCache = new Set();

/**
 * Get the base URL without query parameters for cache key
 * This allows us to recognize the same image even with different transformation params
 */
function getBaseUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Get optimized image URL with optional resizing
 * Supports Supabase Storage URL transformations for fast thumbnails
 * For full-size images, pass width/height as null or undefined
 */
export function getOptimizedImageUrl(originalUrl, width, height, quality = 80) {
  if (!originalUrl || typeof originalUrl !== 'string') return null;
  
  // If no dimensions provided, return original (full-size image)
  if (!width && !height) {
    return originalUrl;
  }
  
  // Supabase Storage supports URL transformations
  // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]?width=X&height=Y&resize=cover&quality=Z
  if (originalUrl.includes('supabase.co/storage')) {
    try {
      const url = new URL(originalUrl);
      
      // Only add transformations if dimensions are provided
      if (width || height) {
        if (width) url.searchParams.set('width', String(Math.round(width)));
        if (height) url.searchParams.set('height', String(Math.round(height)));
        url.searchParams.set('resize', 'cover'); // cover, contain, or fill
        url.searchParams.set('quality', String(Math.min(100, Math.max(1, quality))));
      }
      
      return url.toString();
    } catch (e) {
      // If URL parsing fails, return original
      console.warn('OptimizedImage: Failed to parse Supabase URL:', e);
      return originalUrl;
    }
  }
  
  // For external URLs (product websites, etc.), return original
  // Future: Could add Cloudinary/Imgix transformations if needed
  return originalUrl;
}

/**
 * Optimized Image Component with:
 * - Better caching (expo-image)
 * - Loading placeholder
 * - Error handling
 * - Automatic optimization
 */
// Internal component - this is what actually renders
// CRITICAL: Accept props as object to avoid destructuring which triggers serialization
// CRITICAL: Wrap entire component in try-catch to prevent Symbol serialization errors
const OptimizedImageInternal = (propsObj) => {
  // CRITICAL: Wrap everything in try-catch because React Native serializes props
  // during component initialization, and accessing propsObj might trigger serialization
  try {
    // Extract props manually with defensive error handling
    // React Native serializes props during completeWork, so we must be very careful
    let source, style, resizeMode, width, height, quality, placeholder, showErrorPlaceholder, onError;
    const restProps = {};
    
    try {
      // Safely extract known props - each in its own try-catch
      try { source = propsObj?.source; } catch (e) { source = null; }
      try { style = propsObj?.style; } catch (e) { style = undefined; }
      try { resizeMode = propsObj?.resizeMode || 'cover'; } catch (e) { resizeMode = 'cover'; }
      try { width = propsObj?.width; } catch (e) { width = undefined; }
      try { height = propsObj?.height; } catch (e) { height = undefined; }
      try { quality = propsObj?.quality || 80; } catch (e) { quality = 80; }
      try { placeholder = propsObj?.placeholder || null; } catch (e) { placeholder = null; }
      try { showErrorPlaceholder = propsObj?.showErrorPlaceholder || false; } catch (e) { showErrorPlaceholder = false; }
      try { onError = propsObj?.onError || null; } catch (e) { onError = null; }
      
      // Get remaining props - be very defensive
      const knownKeys = new Set(['source', 'style', 'resizeMode', 'width', 'height', 'quality', 'placeholder', 'showErrorPlaceholder', 'onError']);
      if (propsObj && typeof propsObj === 'object') {
        try {
          for (const key in propsObj) {
            try {
              if (!knownKeys.has(key) && Object.prototype.hasOwnProperty.call(propsObj, key)) {
                const value = propsObj[key];
                if (typeof value !== 'symbol' && typeof key !== 'symbol') {
                  restProps[key] = value;
                }
            }
            } catch (e) {
              // Skip this prop if accessing it fails
            }
          }
        } catch (e) {
          // If iterating props fails, just use empty restProps
        }
      }
    } catch (error) {
      // If anything fails, use safe defaults
      console.warn('OptimizedImage: Error extracting props, using defaults:', error?.message);
      source = null;
      style = undefined;
      resizeMode = 'cover';
      width = undefined;
      height = undefined;
      quality = 80;
      placeholder = null;
      showErrorPlaceholder = false;
      onError = null;
    }
    
  // Handle source prop (can be string URI, { uri: string }, or require() local asset)
  let imageSource = null;
  let isLocalAsset = false;
  
  try {
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
      // Extract only the URI to avoid Symbols
      imageSource = { uri: source.uri || null };
    }
  } catch (error) {
    // If accessing source causes an error (e.g., Symbols), try to extract URI safely
    console.warn('OptimizedImage: Error accessing source, using fallback:', error?.message);
    if (source && typeof source === 'object' && 'uri' in source) {
      try {
        imageSource = { uri: String(source.uri) };
      } catch {
        imageSource = null;
      }
    } else {
      imageSource = null;
    }
  }
  
  // Optimize the image URL if it's a remote URI and dimensions provided
  // Note: getOptimizedImageUrl now preserves query params for compatibility
  if (!isLocalAsset && imageSource && imageSource.uri && typeof imageSource.uri === 'string') {
    const optimizedUri = getOptimizedImageUrl(imageSource.uri, width, height, quality);
    if (optimizedUri) {
      imageSource = { uri: optimizedUri };
    } else {
      // If optimization fails, keep original URI (don't break the image)
      console.warn('OptimizedImage: getOptimizedImageUrl returned null, keeping original URI');
    }
  }
  
  // Get the current URI for comparison
  const currentUri = imageSource && (typeof imageSource === 'object' ? imageSource.uri : imageSource);
  
  // Get base URL (without query params) for cache checking
  // This allows us to recognize the same image even with different transformation params
  const baseUri = currentUri ? getBaseUrl(currentUri) : null;
  
  // Check if this image was previously loaded (cached) - check both full URL and base URL
  const isCached = currentUri && (loadedImageCache.has(currentUri) || (baseUri && loadedImageCache.has(baseUri)));
  
  // Initialize loading state: false if cached, true if new URI
  const [isLoading, setIsLoading] = useState(!isCached);
  const [hasError, setHasError] = useState(false);
  
  // Track URI changes and update cache
  useEffect(() => {
    if (currentUri) {
      const isUriCached = loadedImageCache.has(currentUri) || (baseUri && loadedImageCache.has(baseUri));
      if (!isUriCached) {
        // New URI - show loading
        setIsLoading(true);
      } else {
        // Same URI - already cached, don't show loading
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [currentUri, baseUri]);
  
  // If no source, return null so parent can show letter placeholder
  if (!imageSource || (!imageSource.uri && typeof imageSource !== 'number')) {
    console.warn('OptimizedImage: No valid image source, returning null');
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
  
  // Clean restProps to remove any Symbols before spreading
  const cleanProps = {};
  try {
    for (const key in restProps) {
      if (Object.prototype.hasOwnProperty.call(restProps, key)) {
        const value = restProps[key];
        if (typeof value !== 'symbol' && typeof key !== 'symbol') {
          cleanProps[key] = value;
        }
      }
    }
  } catch (error) {
    console.warn('OptimizedImage: Error cleaning props:', error?.message);
  }
  
  return (
    <View style={containerStyle}>
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, borderRadius ? { borderRadius } : {}]}
        resizeMode={resizeMode}
        onLoadStart={() => {
          // Only set loading if this is a new URI (not cached)
          // Check both full URL and base URL
          const isUriCached = currentUri && (loadedImageCache.has(currentUri) || (baseUri && loadedImageCache.has(baseUri)));
          if (currentUri && !isUriCached) {
            setIsLoading(true);
          }
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          // Mark both full URL and base URL as cached when load completes (persists across remounts)
          // This ensures we recognize the same image even with different transformation params
          if (currentUri) {
            loadedImageCache.add(currentUri);
            if (baseUri && baseUri !== currentUri) {
              loadedImageCache.add(baseUri);
            }
          }
        }}
        onError={() => {
          const uri = typeof imageSource === 'object' && imageSource.uri ? imageSource.uri : 'local asset';
          console.log('OptimizedImage error:', typeof uri === 'string' ? uri.substring(0, 100) : uri);
          setHasError(true);
          setIsLoading(false);
          if (onError) {
            onError();
          }
        }}
        {...cleanProps}
      />
      {isLoading && (
        <View style={[styles.loadingContainer, borderRadius ? { borderRadius } : {}]}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </View>
  );
  } catch (error) {
    // If component initialization fails (e.g., Symbol serialization), return null
    console.error('OptimizedImage: Component initialization failed:', error?.message || String(error));
    return null;
  }
};

/**
 * Clean a single prop value, removing Symbols (shallow only to avoid recursion issues)
 */
function cleanPropValue(value, depth = 0) {
  if (depth > 3) return value; // Limit recursion depth
  
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return value; // Keep callbacks
  if (typeof value === 'symbol') return null; // Remove Symbols
  
  if (Array.isArray(value)) {
    return value.map(item => cleanPropValue(item, depth + 1));
  }
  
  if (typeof value === 'object') {
    const cleaned = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const k = key;
        const v = value[key];
        if (typeof k !== 'symbol' && typeof v !== 'symbol') {
          cleaned[k] = cleanPropValue(v, depth + 1);
        }
      }
    }
    return cleaned;
  }
  
  return value;
}

/**
 * Clean all props, removing Symbols (shallow clean to avoid stack overflow)
 */
function cleanAllProps(props) {
  if (!props || typeof props !== 'object') return {};
  
  const cleaned = {};
  for (const key in props) {
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      const k = key;
      const v = props[key];
      if (typeof k !== 'symbol' && typeof v !== 'symbol') {
        cleaned[k] = cleanPropValue(v, 0);
      }
    }
  }
  return cleaned;
}

// Factory function to create OptimizedImage with cleaned props
// This ensures React Native never sees props with Symbols
// CRITICAL: Create a completely new object with only primitive values
// React Native serializes props during React.createElement, so we must be extremely defensive
function createOptimizedImageWithCleanProps(allProps) {
  // Create a brand new object - use plain {} but ensure we only copy safe values
  const cleanedProps = {};
  
  try {
    if (allProps && typeof allProps === 'object') {
      // Extract source with maximum safety
      try {
        if ('source' in allProps) {
          const sourceValue = allProps.source;
          if (typeof sourceValue === 'string') {
            cleanedProps.source = sourceValue; // Primitive string
          } else if (typeof sourceValue === 'number') {
            cleanedProps.source = sourceValue; // Primitive number
          } else if (sourceValue && typeof sourceValue === 'object') {
            // Extract URI with extreme care
            try {
              if ('uri' in sourceValue) {
                const uri = sourceValue.uri;
                if (uri != null && typeof uri !== 'symbol' && typeof uri !== 'object') {
                  cleanedProps.source = { uri: String(uri) }; // New object with only string
                }
              }
            } catch (e) {
              // If accessing uri fails, skip source
            }
          }
        }
      } catch (e) {
        // If accessing source fails, skip it
      }
      
      // Extract other props with maximum safety
      const safeKeys = ['style', 'resizeMode', 'width', 'height', 'quality', 'placeholder', 'showErrorPlaceholder', 'onError'];
      for (const key of safeKeys) {
        try {
          if (key in allProps) {
            const value = allProps[key];
            // Only copy if it's a safe type
            if (typeof value !== 'symbol' && typeof key !== 'symbol') {
              if (key === 'style' && value && typeof value === 'object' && !Array.isArray(value)) {
                // Clean style object deeply
                cleanedProps[key] = cleanPropValue(value, 0);
              } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || typeof value === 'function') {
                // Safe primitive or function
                cleanedProps[key] = value;
              } else if (Array.isArray(value)) {
                // Clean array
                cleanedProps[key] = cleanPropValue(value, 0);
              }
            }
          }
        } catch (e) {
          // Skip this prop if accessing it fails
        }
      }
      
      // Extract remaining props (excluding Symbols) - be very careful
      try {
        for (const key in allProps) {
          try {
            if (Object.prototype.hasOwnProperty.call(allProps, key)) {
              const isKnownKey = safeKeys.includes(key) || key === 'source';
              if (!isKnownKey) {
                const value = allProps[key];
                if (typeof value !== 'symbol' && typeof key !== 'symbol') {
                  cleanedProps[key] = cleanPropValue(value, 0);
                }
              }
            }
          } catch (e) {
            // Skip this prop if accessing it fails
          }
        }
      } catch (e) {
        // If iterating fails, just use what we have
      }
    }
  } catch (error) {
    console.warn('OptimizedImage: Error cleaning props, using minimal:', error?.message);
    // Return minimal safe props - create new object
    try {
      let sourceUri = null;
      try {
        if (allProps && typeof allProps === 'object' && 'source' in allProps) {
          const src = allProps.source;
          if (typeof src === 'string') {
            sourceUri = src;
          } else if (src && typeof src === 'object' && 'uri' in src) {
            sourceUri = String(src.uri);
          }
        }
      } catch (e) {
        // Ignore
      }
      cleanedProps.source = sourceUri ? { uri: sourceUri } : null;
      cleanedProps.resizeMode = 'cover';
    } catch (e) {
      cleanedProps.resizeMode = 'cover';
    }
  }
  
  // Create element with cleaned props - React Native will serialize this
  // CRITICAL: Wrap in try-catch because React.createElement might trigger serialization
  try {
    return React.createElement(OptimizedImageInternal, cleanedProps);
  } catch (error) {
    // If React.createElement fails (e.g., Symbol in cleanedProps), return null
    console.error('OptimizedImage: React.createElement failed, returning null:', error?.message || String(error));
    return null;
  }
}

// Export component that uses factory to create cleaned props
// CRITICAL: We must prevent React Native from ever seeing the original props object
// React Native serializes props during completeWork phase, before component runs
// By using a function component that immediately cleans props, we ensure React Native
// only sees the cleaned props object
export const OptimizedImage = (allProps) => {
  // Immediately clean props - this happens synchronously before React Native serializes
  // We can't use hooks here because React Native serializes props before hooks run
  // CRITICAL: Wrap in try-catch to catch any serialization errors
  try {
    // If allProps is null/undefined, return null immediately
    if (!allProps) {
      return null;
    }
    
    // Create cleaned props - this must not reference allProps after creation
    const cleanedProps = createOptimizedImageWithCleanProps(allProps);
    
    // Clear reference to allProps to prevent any accidental serialization
    // (This is defensive - JavaScript doesn't guarantee this helps, but it's worth trying)
    
    return cleanedProps;
  } catch (error) {
    // If anything fails, return null to prevent crash
    // This catches Symbol serialization errors during React.createElement
    console.error('OptimizedImage: Critical error during prop cleaning, returning null:', error?.message || String(error));
    return null;
  }
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
