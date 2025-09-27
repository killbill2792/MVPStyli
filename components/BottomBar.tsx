import React from 'react';
import { View, Text, Pressable } from 'react-native';

export default function BottomBar({ route, go }: { route: string; go: (r: string) => void }) {
  const items: [string, string][] = [['shop', 'Shop'], ['feed', 'Feed'], ['tryon', 'Try-On'], ['rooms', 'Rooms']];
  
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
      <View style={{
        flexDirection: 'row',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: 10,
        paddingVertical: 8
      }}>
        {items.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => go(k)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 9999,
              backgroundColor: route === k ? '#fff' : 'transparent'
            }}
          >
            <Text style={{
              color: route === k ? '#000' : '#d4d4d8',
              fontWeight: route === k ? '700' : '500'
            }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
