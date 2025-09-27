import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  
  const anon = async () => {
    await supabase.auth.signInAnonymously();
    onDone();
  };
  
  const magic = async () => {
    await supabase.auth.signInWithOtp({ 
      email, 
      options: { emailRedirectTo: 'mvpstyli://auth' }
    });
    onDone(); // continue; verification can happen in background later
  };
  
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '700' }}>Sign in</Text>
      <Pressable 
        onPress={anon} 
        style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center' }}
      >
        <Text>Continue as Guest</Text>
      </Pressable>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12 }}>
        <TextInput 
          value={email} 
          onChangeText={setEmail} 
          placeholder="email@domain.com" 
          placeholderTextColor="#9ca3af" 
          style={{ color: '#e4e4e7' }} 
        />
        <Pressable 
          onPress={magic} 
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 10, marginTop: 8 }}
        >
          <Text style={{ color: '#fff' }}>Send Magic Link</Text>
        </Pressable>
      </View>
    </View>
  );
}
