/**
 * Reusable Avatar Component
 * Displays a circular avatar with image or colored placeholder with first letter
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from '../lib/SimpleGradient';
import { SafeImage } from '../lib/OptimizedImage';

/**
 * Get a consistent color for a user based on their name
 * This ensures the same user always gets the same color
 */
function getColorForName(name) {
  if (!name || name.length === 0) return '#6366f1';
  
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#ef4444', // red
    '#14b8a6', // teal
  ];
  
  // Use first character to determine color
  const charCode = name.charCodeAt(0);
  return colors[charCode % colors.length];
}

/**
 * Avatar Component
 * @param {string} imageUri - Image URI to display (optional)
 * @param {string} name - User name for placeholder letter
 * @param {number} size - Avatar size in pixels (default: 40)
 * @param {object} style - Additional styles
 * @param {boolean} showGradient - Whether to show gradient border (default: false)
 */
export function Avatar({ 
  imageUri, 
  name = 'U', 
  size = 40, 
  style,
  showGradient = false 
}) {
  const firstLetter = name && name.length > 0 ? name[0].toUpperCase() : 'U';
  const backgroundColor = getColorForName(name);
  const borderRadius = size / 2;
  
  // Request image at 2x resolution for sharp display, min 48px for quality
  const imageSize = Math.max(48, size * 2);
  
  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius,
    },
    style,
  ];

  const innerStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: 'hidden',
  };

  const textStyle = {
    fontSize: size * 0.4,
    fontWeight: 'bold',
    color: '#fff',
  };

  // If gradient is requested, wrap in gradient
  if (showGradient) {
    return (
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        style={containerStyle}
      >
        <View style={innerStyle}>
          {imageUri && imageUri.trim() !== '' ? (
            <SafeImage 
              source={{ uri: imageUri }} 
              style={innerStyle} 
              resizeMode="cover"
              width={imageSize}  // Request 2x size for sharp display
              height={imageSize} // Request 2x size for sharp display
              quality={75}  // Lower quality for smaller file size, faster load
              onError={() => {
                // Image failed to load, will show placeholder
                console.log('Avatar image failed to load, showing placeholder');
              }}
            />
          ) : (
            <View style={[innerStyle, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={textStyle}>{firstLetter}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    );
  }

  // Regular avatar without gradient
  return (
    <View style={containerStyle}>
      {imageUri && imageUri.trim() !== '' ? (
        <SafeImage 
          source={{ uri: imageUri }} 
          style={innerStyle} 
          resizeMode="cover"
          width={imageSize}  // Request 2x size for sharp display
          height={imageSize} // Request 2x size for sharp display
          quality={75}  // Lower quality for smaller file size, faster load
          onError={() => {
            // Image failed to load, will show placeholder
            console.log('Avatar image failed to load, showing placeholder');
          }}
        />
      ) : (
        <View style={[innerStyle, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={textStyle}>{firstLetter}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
