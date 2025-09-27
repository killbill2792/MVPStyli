import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useUser } from '../lib/UserContext';
import { isDemo } from '../lib/supabase';

export default function AccountScreen({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useUser();

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Signed Out', 'You have been signed out.');
      onBack();
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      'Change Photo', 
      'This will reset your uploaded photo. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            // Reset photo logic would go here
            Alert.alert('Photo Reset', 'Your photo has been reset.');
          }
        }
      ]
    );
  };

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#000', 
      padding: 24,
      gap: 24 
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={onBack} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ 
          color: '#e4e4e7', 
          fontSize: 24, 
          fontWeight: '700' 
        }}>
          Account
        </Text>
      </View>

      <View style={{ 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        borderColor: 'rgba(255,255,255,0.08)', 
        borderWidth: 1, 
        borderRadius: 24, 
        padding: 20,
        gap: 16
      }}>
        <View>
          <Text style={{ 
            color: '#a1a1aa', 
            fontSize: 14, 
            marginBottom: 4 
          }}>
            Account Type
          </Text>
          <Text style={{ 
            color: '#e4e4e7', 
            fontSize: 16, 
            fontWeight: '600' 
          }}>
            {isDemo ? 'Demo User' : 'Production User'}
          </Text>
        </View>

        <View>
          <Text style={{ 
            color: '#a1a1aa', 
            fontSize: 14, 
            marginBottom: 4 
          }}>
            Email
          </Text>
          <Text style={{ 
            color: '#e4e4e7', 
            fontSize: 16 
          }}>
            {user?.email || 'No email provided'}
          </Text>
        </View>

        <View>
          <Text style={{ 
            color: '#a1a1aa', 
            fontSize: 14, 
            marginBottom: 4 
          }}>
            User ID
          </Text>
          <Text style={{ 
            color: '#e4e4e7', 
            fontSize: 14,
            fontFamily: 'monospace'
          }}>
            {user?.id || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable 
          onPress={handleChangePhoto}
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            padding: 16, 
            borderRadius: 16,
            alignItems: 'center'
          }}
        >
          <Text style={{ 
            color: '#e4e4e7', 
            fontSize: 16, 
            fontWeight: '600' 
          }}>
            📷 Change Photo
          </Text>
        </Pressable>

        <Pressable 
          onPress={handleSignOut}
          style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            padding: 16, 
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}
        >
          <Text style={{ 
            color: '#ef4444', 
            fontSize: 16, 
            fontWeight: '600' 
          }}>
            Sign Out
          </Text>
        </Pressable>
      </View>

      {isDemo && (
        <View style={{ 
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(245, 158, 11, 0.3)'
        }}>
          <Text style={{ 
            color: '#f59e0b', 
            fontSize: 12, 
            textAlign: 'center' 
          }}>
            🚧 Demo Mode - All data is temporary
          </Text>
        </View>
      )}
    </View>
  );
}
