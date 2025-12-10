import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';
import { setupDemoDataForUser, getUserInfo } from '../lib/demoData';

const AuthScreen = () => {
  const { setRoute, setUser } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone) => {
    return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ''));
  };

  const handleSignUp = async () => {
    if (usePhone) {
      if (!phone || !validatePhone(phone)) {
        Alert.alert('Invalid Phone', 'Please enter a valid phone number');
        return;
      }
    } else {
      if (!email || !validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
    }

    if (!password || password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (usePhone) {
        const { data, error } = await supabase.auth.signUp({
          phone: phone,
          password: password,
        });
        if (error) throw error;
        Alert.alert('Success', 'Account created! Please verify your phone number.');
        setIsLogin(true);
      } else {
        const userInfo = getUserInfo(email);
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              name: userInfo.name,
              gender: userInfo.gender,
              location: userInfo.location,
            }
          }
        });
        if (error) throw error;
        
        // Setup demo data if user was created
        if (data.user && data.user.id) {
          setupDemoDataForUser(data.user.id, email).catch(err => {
            console.log('Demo data setup skipped:', err);
          });
        }
        
        Alert.alert('Success', 'Account created! You can sign in now (email verification bypassed for testing).');
        setIsLogin(true);
      }
    } catch (error) {
      Alert.alert('Sign Up Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (usePhone) {
      if (!phone || !validatePhone(phone)) {
        Alert.alert('Invalid Phone', 'Please enter a valid phone number');
        return;
      }
    } else {
      if (!email || !validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
    }

    if (!password) {
      Alert.alert('Missing Password', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      let authData;
      if (usePhone) {
        const { data, error } = await supabase.auth.signInWithPassword({
          phone: phone,
          password: password,
        });
        if (error) throw error;
        authData = data;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        authData = data;
      }
      
      // Wait for auth state change to complete before navigating
      // The onAuthStateChange listener in App.js will handle navigation
      // Just wait a moment for the state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // The auth state change handler will update user and route
      // No need to manually set route here
    } catch (error) {
      Alert.alert('Login Error', error.message || 'Failed to login');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (usePhone) {
      Alert.alert('Phone Reset', 'Password reset via phone is not available yet. Please contact support.');
      return;
    }

    if (!email || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'stylit://reset-password',
      });
      if (error) throw error;
      Alert.alert('Email Sent', 'Check your email for password reset instructions');
      setIsForgotPassword(false);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.logo}>Stylit</Text>
              <Text style={styles.subtitle}>Reset your password</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Pressable
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.linkButton}
                onPress={() => setIsForgotPassword(false)}
              >
                <Text style={styles.linkText}>Back to Login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.logo}>Stylit</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome back!' : 'Create your account'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Toggle between Email and Phone */}
            <View style={styles.toggleContainer}>
              <Pressable
                style={[styles.toggleButton, !usePhone && styles.toggleButtonActive]}
                onPress={() => setUsePhone(false)}
              >
                <Text style={[styles.toggleText, !usePhone && styles.toggleTextActive]}>
                  Email
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, usePhone && styles.toggleButtonActive]}
                onPress={() => setUsePhone(true)}
              >
                <Text style={[styles.toggleText, usePhone && styles.toggleTextActive]}>
                  Phone
                </Text>
              </Pressable>
            </View>

            {usePhone ? (
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={isLogin ? 'password' : 'password-new'}
            />

            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            )}

            {isLogin && (
              <Pressable
                style={styles.forgotButton}
                onPress={() => setIsForgotPassword(true)}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={isLogin ? handleLogin : handleSignUp}
              disabled={loading}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.gradientButton}
              >
                <Text style={styles.primaryButtonText}>
                  {loading
                    ? 'Loading...'
                    : isLogin
                    ? 'Login'
                    : 'Sign Up'}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setIsLogin(!isLogin);
                setEmail('');
                setPhone('');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              <Text style={styles.linkText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Login'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  form: {
    width: '100%',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  toggleText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#6366f1',
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default AuthScreen;

