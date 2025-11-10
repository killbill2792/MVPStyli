import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from '../lib/designSystem';

export default function BottomBar({ route, go }: { route: string; go: (r: string) => void }) {
  const insets = useSafeAreaInsets();
  const colors = getColors();
  const items: [string, string][] = [['shop', 'Shop'], ['feed', 'Explore'], ['tryon', 'Try-On'], ['podshome', 'Pods'], ['stylecraft', 'StyleCraft']];
  
  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} edges={['bottom']}>
      <View style={{ 
        alignItems: 'center',
        paddingTop: 5, // Reduced by 3 points (was 8)
        paddingBottom: 2, // Reduced by 3 points
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border
      }}>
        <View style={{
          flexDirection: 'row',
          gap: 6,
          backgroundColor: 'rgba(128,128,128,0.15)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderRadius: 9999,
          paddingHorizontal: 3,
          paddingVertical: 5 // Reduced by 3 points (was 8)
        }}>
        {items.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => go(k)}
            style={{
              paddingHorizontal: 9, // Reduced from 11 to 9 (2 points less)
              paddingVertical: 8,
              borderRadius: 9999,
              backgroundColor: route === k ? '#fff' : 'transparent'
            }}
          >
            <Text style={{
              color: route === k ? '#000' : '#d4d4d8',
              fontWeight: route === k ? '700' : '500',
              fontSize: 14
            }}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => go('account')}
          style={{
            paddingHorizontal: 9, // Reduced from 11 to 9 (2 points less)
            paddingVertical: 8,
            borderRadius: 9999,
            backgroundColor: route === 'account' ? '#fff' : 'transparent'
          }}
        >
          <Text style={{
            color: route === 'account' ? '#000' : '#d4d4d8',
            fontWeight: route === 'account' ? '700' : '500',
            fontSize: 14
          }}>⚙</Text>
        </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
