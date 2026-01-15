/**
 * Simple Gradient Component
 * Replaces expo-linear-gradient with a View-based gradient
 * Uses the first color as background for simplicity
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

export const LinearGradient = ({ 
  colors = ['#000000', '#000000'], 
  start = { x: 0, y: 0 }, 
  end = { x: 1, y: 0 },
  style,
  children,
  ...props 
}) => {
  // Use the first color as background (simple fallback)
  // For a real gradient, we'd need react-native-linear-gradient or SVG
  const backgroundColor = colors && colors.length > 0 ? colors[0] : '#000000';
  
  return (
    <View 
      style={[{ backgroundColor }, style]} 
      {...props}
    >
      {children}
    </View>
  );
};
