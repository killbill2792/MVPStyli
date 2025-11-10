import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, TextStyles } from '../lib/designSystem';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  backgroundColor?: string;
}

export default function Header({ 
  title, 
  onBack, 
  rightAction,
  backgroundColor = Colors.background 
}: HeaderProps) {
  return (
    <SafeAreaView style={{ backgroundColor }} edges={['top']}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor
      }}>
        {onBack ? (
          <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
            <Text style={{ ...TextStyles.body, color: Colors.primary, fontSize: Typography.base }}>
              ← Back
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
        
        <Text style={{ ...TextStyles.h3, flex: 1, textAlign: 'center' }}>
          {title}
        </Text>
        
        {rightAction ? (
          <View style={{ width: 60, alignItems: 'flex-end' }}>
            {rightAction}
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

