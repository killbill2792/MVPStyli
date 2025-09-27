import React from 'react';
import { View } from 'react-native';

export default function Glass({ children, style }: any) {
  return (
    <View style={[{
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderRadius: 16,
      padding: 12
    }, style]}>
      {children}
    </View>
  );
}
