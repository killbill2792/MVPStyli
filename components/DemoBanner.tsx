import React from 'react';
import { View, Text } from 'react-native';
import { isDemo } from '../lib/supabase';

export default function DemoBanner() {
  if (!isDemo) return null;
  
  return (
    <View style={{
      backgroundColor: '#f59e0b',
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignItems: 'center'
    }}>
      <Text style={{
        color: '#000',
        fontSize: 12,
        fontWeight: '600'
      }}>
        🚧 DEMO MODE - Using mock data and APIs
      </Text>
    </View>
  );
}
