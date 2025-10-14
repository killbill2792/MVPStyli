import React from 'react';
import { View, Text, Pressable } from 'react-native';

export default function BottomBar({ route, go }: { route: string; go: (r: string) => void }) {
  const items: [string, string][] = [['shop', 'Shop'], ['feed', 'Explore'], ['tryon', 'Try-On'], ['podshome', 'Pods'], ['stylecraft', 'StyleCraft']];
  
  // Check if current route is a full-screen route that needs consistent nav bar
  const isFullScreenRoute = ['stylecraft', 'account', 'podshome', 'podlive', 'podrecap', 'inbox', 'createpod'].includes(route);
  
  return (
    <View style={{ 
      position: 'absolute', 
      left: 0, 
      right: 0, 
      bottom: 0, 
      alignItems: 'center',
      paddingBottom: 10, // Safe area bottom padding
      backgroundColor: isFullScreenRoute ? 'rgba(0,0,0,0.8)' : 'transparent',
      paddingTop: 8
    }}>
      <View style={{
        flexDirection: 'row',
        gap: 6, // Reduced from 8 to 6 (2 points less)
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: 3, // Reduced from 5 to 3 (2 points less)
        paddingVertical: 8
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
          }}>⚙️</Text>
        </Pressable>
      </View>
    </View>
  );
}
