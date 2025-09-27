import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useUser } from '../lib/UserContext';
import { isDemo } from '../lib/supabase';

export default function SignInScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const { setUser } = useUser();

  const handleSignIn = async () => {
    try {
      if (isDemo) {
        // Demo mode - just set user and continue
        setUser({ id: 'demo-user', email: email || null });
        onDone();
      } else {
        // Production mode - use Supabase auth
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        
        setUser(data.user);
        onDone();
      }
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Sign In Failed', 'Please try again.');
    }
  };

  const handleMagicLink = async () => {
    try {
      if (isDemo) {
        Alert.alert('Demo Mode', 'Magic link would be sent in production!');
        setUser({ id: 'demo-user', email: email || null });
        onDone();
      } else {
        const { error } = await supabase.auth.signInWithOtp({ 
          email, 
          options: { emailRedirectTo: 'mvpstyli://auth' }
        });
        if (error) throw error;
        
        Alert.alert('Magic Link Sent', 'Check your email for the magic link!');
        onDone();
      }
    } catch (error) {
      console.error('Magic link error:', error);
      Alert.alert('Magic Link Failed', 'Please try again.');
    }
  };

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#000', 
      justifyContent: 'center', 
      padding: 24,
      gap: 24 
    }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ 
          color: '#e4e4e7', 
          fontSize: 32, 
          fontWeight: '700',
          marginBottom: 8
        }}>
          MVPStyli
        </Text>
        <Text style={{ 
          color: '#a1a1aa', 
          fontSize: 16,
          textAlign: 'center'
        }}>
          AI-powered fashion try-on
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        <Pressable 
          onPress={handleSignIn}
          style={{ 
            backgroundColor: '#fff', 
            padding: 16, 
            borderRadius: 16, 
            alignItems: 'center' 
          }}
        >
          <Text style={{ 
            color: '#000', 
            fontSize: 16, 
            fontWeight: '600' 
          }}>
            Continue as Guest
          </Text>
        </Pressable>

        <View style={{ 
          backgroundColor: 'rgba(255,255,255,0.06)', 
          padding: 16, 
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)'
        }}>
          <Text style={{ 
            color: '#e4e4e7', 
            fontSize: 14, 
            fontWeight: '600',
            marginBottom: 12
          }}>
            Or sign in with email
          </Text>
          
          <TextInput 
            value={email} 
            onChangeText={setEmail} 
            placeholder="email@domain.com" 
            placeholderTextColor="#9ca3af" 
            style={{ 
              color: '#e4e4e7',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)'
            }} 
          />
          
          <Pressable 
            onPress={handleMagicLink} 
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              padding: 12, 
              borderRadius: 12, 
              alignItems: 'center'
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Send Magic Link
            </Text>
          </Pressable>
        </View>
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
            🚧 Demo Mode - Using mock authentication
          </Text>
        </View>
      )}
    </View>
  );
}
