import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getColors, Typography, Spacing } from '../lib/designSystem';

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
  backgroundColor 
}: HeaderProps) {
  const colors = getColors();
  const bgColor = backgroundColor || colors.background;
  
  return (
    <SafeAreaView style={{ backgroundColor: bgColor }} edges={['top']}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: bgColor
      }}>
        {onBack ? (
          <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
            <Text style={{ color: colors.primary, fontSize: Typography.base }}>
              ← Back
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
        
        <Text style={{ color: colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold as any, flex: 1, textAlign: 'center' }}>
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

