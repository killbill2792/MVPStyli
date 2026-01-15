import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '../lib/SimpleGradient';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius, CardStyles, TextStyles, ThemeColors, getCurrentThemeName, setTheme, setCustomColor, getCustomColor } from '../lib/designSystem';

const { width, height } = Dimensions.get('window');

const AccountScreen = ({ tryOnResults = [] }) => {
  const { state, setRoute, setProcessingResult } = useApp();
  const { user } = state;
  const [username] = useState('Fashionista');
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const currentTheme = getCurrentThemeName();
  
  // Settings modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Initialize custom color input if custom theme is active
  useEffect(() => {
    if (currentTheme === 'custom' && getCustomColor()) {
      setCustomColorInput(getCustomColor());
    }
  }, [currentTheme]);

  const aiInsights = [
    {
      id: '1',
      title: 'Your outfits get most ❤️ in summer tones',
      description: 'Coral and mint combinations are your signature',
      color: '#f59e0b',
    },
    {
      id: '2', 
      title: "You're 83% aligned with streetwear culture",
      description: 'Your style matches trending streetwear aesthetics',
      color: '#8b5cf6',
    },
    {
      id: '3',
      title: 'Your last try-on hit 42 votes in Style Twins',
      description: 'That denim jacket look was a total vibe',
      color: '#10b981',
    },
    {
      id: '4',
      title: 'You prefer minimalist accessories',
      description: 'Simple, elegant pieces get the most engagement',
      color: '#ef4444',
    },
  ];

  // Check if user is admin - only admin@stylit.ai should see admin section
  const isAdmin = user?.email === 'admin@stylit.ai';
  
  // Debug: Log user email and admin status
  useEffect(() => {
    console.log('🔐 AccountScreen - User email:', user?.email);
    console.log('🔐 AccountScreen - Is Admin:', isAdmin);
  }, [user?.email, isAdmin]);
  
  // Build core sections array - conditionally include admin section
  const coreSections = [
    {
      id: 'tryons',
      title: 'My Try-Ons',
      icon: '👕',
      color: '#6366f1',
      count: tryOnResults.length,
    },
    {
      id: 'pods',
      title: 'Active Pods',
      icon: '👥',
      color: '#8b5cf6',
      count: 2,
    },
    {
      id: 'designs',
      title: 'StyleCraft Designs',
      icon: '✂️',
      color: '#f59e0b',
      count: 1,
    },
    {
      id: 'favorites',
      title: 'Favorites',
      icon: '❤️',
      color: '#ef4444',
      count: 12,
    },
    {
      id: 'cart',
      title: 'My Cart',
      icon: '🛒',
      color: '#10b981',
      count: 3,
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: '⚙',
      color: '#6b7280',
      count: null,
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: '❓',
      color: '#10b981',
      count: null,
    },
    // Only add admin section if user is admin@stylit.ai
    ...(isAdmin ? [{
      id: 'admin',
      title: 'Admin: Garments',
      icon: '⚙️',
      color: '#8b5cf6',
      count: null,
    }] : []),
  ];

  const handleSignOut = () => {
    setIsSigningOut(true);
    setTimeout(() => {
      // Handle sign out logic
      setIsSigningOut(false);
    }, 2000);
  };

  const InsightCard = ({ insight }) => (
    <View style={{
      ...CardStyles.container,
      width: 280,
      marginRight: Spacing.md,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      borderLeftWidth: 4,
      borderLeftColor: insight.color
    }}>
      <Text style={{ ...TextStyles.body, fontWeight: Typography.semibold, marginBottom: Spacing.xs }}>
        {insight.title}
      </Text>
      <Text style={{ ...TextStyles.caption, color: Colors.textSecondary }}>
        {insight.description}
      </Text>
    </View>
  );

  const SectionCard = ({ section }) => {
    const handlePress = () => {
      if (section.id === 'tryons') {
        // Show try-on results
        setRoute('tryon');
      } else if (section.id === 'pods') {
        // Navigate to pods home
        setRoute('podshome');
      } else if (section.id === 'cart') {
        // Navigate to cart
        Alert.alert('My Cart', 'Cart feature coming soon! (3 items)');
      } else if (section.id === 'designs') {
        // Navigate to StyleCraft
        setRoute('stylecraft');
      } else if (section.id === 'favorites') {
        // Navigate to favorites
        Alert.alert('Favorites', 'Favorites feature coming soon!');
      } else if (section.id === 'settings') {
        // Navigate to settings modal
        setShowSettingsModal(true);
      } else if (section.id === 'help') {
        // Navigate to help
        Alert.alert('Help & Support', 'Help feature coming soon!');
      } else if (section.id === 'admin') {
        // Navigate to admin garments panel
        setRoute('admingarments');
      }
    };

    return (
      <Pressable 
        onPress={handlePress}
        style={{
          ...CardStyles.container,
          width: '48%',
          marginBottom: Spacing.md,
          padding: Spacing.md,
          borderWidth: 1,
          borderColor: Colors.border
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <Text style={{ fontSize: 24, marginRight: Spacing.sm }}>{section.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ ...TextStyles.body, fontSize: Typography.sm, fontWeight: Typography.semibold }}>
              {section.title}
            </Text>
            {section.count !== null && (
              <Text style={{ ...TextStyles.h3, color: Colors.primary, marginTop: Spacing.xs }}>
                {section.count}
              </Text>
            )}
          </View>
        </View>
        <View style={{ 
          height: 2, 
          backgroundColor: section.color, 
          borderRadius: BorderRadius.full,
          marginTop: Spacing.xs
        }} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.fullScreenContainer} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100, paddingTop: 60 }]}
        showsVerticalScrollIndicator={false}
      >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark, Colors.primary]}
                style={styles.avatarGradient}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{username[0]}</Text>
                </View>
              </LinearGradient>
            </View>
            
            <Text style={{ ...TextStyles.h2, textAlign: 'center', marginBottom: Spacing.md }}>
              Hey, {username} 👋
            </Text>
            <Text style={{ ...TextStyles.bodySecondary, textAlign: 'center', marginBottom: Spacing.lg }}>
              You're trending this week!
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ ...TextStyles.h2, color: Colors.primary }}>{tryOnResults.length}</Text>
                <Text style={{ ...TextStyles.caption }}>Try-Ons</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ ...TextStyles.h2, color: Colors.primary }}>2</Text>
                <Text style={{ ...TextStyles.caption }}>Pods</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ ...TextStyles.h2, color: Colors.primary }}>1</Text>
                <Text style={{ ...TextStyles.caption }}>Designs</Text>
              </View>
            </View>
          </View>

          {/* AI Insights Section */}
          <View style={{ marginBottom: Spacing['2xl'] }}>
            <Text style={{ ...TextStyles.h3, marginBottom: Spacing.md }}>AI Insights</Text>
            <FlatList
              data={aiInsights}
              renderItem={({ item }) => <InsightCard insight={item} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: Spacing.lg }}
            />
          </View>

          {/* Try-On Results Section */}
          {tryOnResults.length > 0 && (
            <View style={{ marginBottom: Spacing['2xl'] }}>
              <Text style={{ ...TextStyles.h3, marginBottom: Spacing.md }}>My Try-Ons</Text>
              <FlatList
                data={tryOnResults}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setProcessingResult(item.resultUrl);
                      setRoute('tryonresult');
                    }}
                    style={{
                    ...CardStyles.container,
                    width: 200,
                    marginRight: Spacing.md,
                    padding: 0,
                    overflow: 'hidden'
                    }}
                  >
                    <Image 
                      source={{ uri: item.resultUrl }} 
                      style={{ width: '100%', height: 250, backgroundColor: Colors.backgroundSecondary }}
                      resizeMode="cover"
                    />
                    <View style={{ padding: Spacing.md }}>
                      <Text style={{ ...TextStyles.body, fontWeight: Typography.semibold, marginBottom: Spacing.xs }}>
                        {item.productName}
                      </Text>
                      <Text style={{ ...TextStyles.caption, color: Colors.textSecondary }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </Pressable>
                )}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: Spacing.lg }}
              />
            </View>
          )}

          {/* Core Sections Grid */}
          <View style={{ marginBottom: Spacing['2xl'] }}>
            <Text style={{ ...TextStyles.h3, marginBottom: Spacing.md }}>My Stylit Hub</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {coreSections.map((section) => (
                <SectionCard key={section.id} section={section} />
              ))}
            </View>
          </View>

          {/* Theme Color Picker */}
          <View style={{ marginBottom: Spacing['2xl'], paddingHorizontal: Spacing.lg }}>
            <Text style={{ ...TextStyles.h3, marginBottom: Spacing.sm }}>App Theme</Text>
            <Text style={{ ...TextStyles.caption, marginBottom: Spacing.md, color: Colors.textSecondary }}>
              Choose your preferred accent color
            </Text>
            
            {/* Preset Colors - Horizontal Scroll */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.lg }}
              style={{ marginBottom: Spacing.md }}
            >
              {Object.keys(ThemeColors).map((themeName) => {
                const theme = ThemeColors[themeName];
                const isSelected = currentTheme === themeName && currentTheme !== 'custom';
                return (
                  <Pressable
                    key={themeName}
                    onPress={() => {
                      setTheme(themeName);
                      setShowCustomColorPicker(false);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: BorderRadius.md,
                      backgroundColor: theme.primary,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? Colors.textWhite : Colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: theme.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.5 : 0.2,
                      shadowRadius: 4,
                      elevation: isSelected ? 6 : 3
                    }}
                  >
                    {isSelected && (
                      <Text style={{ color: Colors.textWhite, fontSize: 14 }}>✓</Text>
                    )}
                  </Pressable>
                );
              })}
              
              {/* Custom Color Button */}
              <Pressable
                onPress={() => {
                  setShowCustomColorPicker(!showCustomColorPicker);
                  if (currentTheme === 'custom' && getCustomColor()) {
                    setCustomColorInput(getCustomColor());
                  }
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: BorderRadius.md,
                  backgroundColor: currentTheme === 'custom' && getCustomColor() ? getCustomColor() : Colors.backgroundSecondary,
                  borderWidth: currentTheme === 'custom' ? 3 : 1,
                  borderColor: currentTheme === 'custom' ? Colors.textWhite : Colors.border,
                  borderStyle: 'dashed',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {currentTheme === 'custom' && (
                  <Text style={{ color: Colors.textWhite, fontSize: 18 }}>✓</Text>
                )}
                {currentTheme !== 'custom' && (
                  <Text style={{ color: Colors.textSecondary, fontSize: 24 }}>+</Text>
                )}
              </Pressable>
            </ScrollView>
            
            {/* Custom Color Input */}
            {showCustomColorPicker && (
              <View style={{
                backgroundColor: Colors.backgroundSecondary,
                padding: Spacing.md,
                borderRadius: BorderRadius.lg,
                borderWidth: 1,
                borderColor: Colors.border,
                marginTop: Spacing.sm
              }}>
                <Text style={{ ...TextStyles.body, marginBottom: Spacing.sm, color: Colors.textPrimary }}>
                  Enter hex color (e.g., #14b8a6)
                </Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                  <View style={{ 
                    width: 50, 
                    height: 50, 
                    borderRadius: BorderRadius.md,
                    backgroundColor: customColorInput || '#000',
                    borderWidth: 1,
                    borderColor: Colors.border
                  }} />
                  <TextInput
                    value={customColorInput}
                    onChangeText={(text) => {
                      // Allow # and hex characters
                      const cleaned = text.replace(/[^#0-9A-Fa-f]/g, '').substring(0, 7);
                      setCustomColorInput(cleaned);
                    }}
                    placeholder="#14b8a6"
                    placeholderTextColor={Colors.textSecondary}
                    style={{
                      flex: 1,
                      backgroundColor: Colors.backgroundTertiary,
                      padding: Spacing.md,
                      borderRadius: BorderRadius.md,
                      color: Colors.textPrimary,
                      fontSize: Typography.base,
                      borderWidth: 1,
                      borderColor: Colors.border
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable
                    onPress={() => {
                      if (customColorInput && /^#[0-9A-Fa-f]{6}$/.test(customColorInput)) {
                        setCustomColor(customColorInput);
                        setShowCustomColorPicker(false);
                      }
                    }}
                    disabled={!customColorInput || !/^#[0-9A-Fa-f]{6}$/.test(customColorInput)}
                    style={{
                      backgroundColor: (customColorInput && /^#[0-9A-Fa-f]{6}$/.test(customColorInput)) ? Colors.primary : Colors.backgroundTertiary,
                      paddingHorizontal: Spacing.lg,
                      paddingVertical: Spacing.md,
                      borderRadius: BorderRadius.md,
                      opacity: (customColorInput && /^#[0-9A-Fa-f]{6}$/.test(customColorInput)) ? 1 : 0.5
                    }}
                  >
                    <Text style={{ 
                      color: Colors.textWhite, 
                      fontWeight: Typography.semibold,
                      fontSize: Typography.sm
                    }}>
                      Apply
                    </Text>
                  </Pressable>
                </View>
                {customColorInput && !/^#[0-9A-Fa-f]{6}$/.test(customColorInput) && (
                  <Text style={{ 
                    ...TextStyles.caption, 
                    color: Colors.error, 
                    marginTop: Spacing.xs 
                  }}>
                    Invalid hex color format
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Sign Out Section */}
          <View style={{ marginBottom: Spacing['2xl'] }}>
            <Pressable
              onPress={handleSignOut}
              disabled={isSigningOut}
              style={{
                backgroundColor: Colors.backgroundSecondary,
                padding: Spacing.lg,
                borderRadius: BorderRadius.lg,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: isSigningOut ? 0.5 : 1
              }}
            >
              <Text style={{ ...TextStyles.body, color: Colors.error, fontWeight: Typography.semibold }}>
                {isSigningOut ? 'See you soon 💫' : 'Sign out'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
        
        {/* Settings Modal */}
        <Modal
          visible={showSettingsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowSettingsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <Pressable onPress={() => setShowSettingsModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              
              <View style={{ padding: 20 }}>
                {/* Change Password Option */}
                <Pressable
                  onPress={() => {
                    setShowSettingsModal(false);
                    setShowChangePasswordModal(true);
                  }}
                  style={styles.settingsOption}
                >
                  <Text style={styles.settingsOptionIcon}>🔐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsOptionTitle}>Change Password</Text>
                    <Text style={styles.settingsOptionDesc}>Update your account password</Text>
                  </View>
                  <Text style={styles.settingsOptionArrow}>›</Text>
                </Pressable>
                
                {/* Account Email - Display Only */}
                <View style={[styles.settingsOption, { opacity: 0.7 }]}>
                  <Text style={styles.settingsOptionIcon}>📧</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsOptionTitle}>Email</Text>
                    <Text style={styles.settingsOptionDesc}>{user?.email || 'Not set'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Change Password Modal */}
        <Modal
          visible={showChangePasswordModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowChangePasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Pressable onPress={() => {
                  setShowChangePasswordModal(false);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              
              <View style={{ padding: 20 }}>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                  Enter your new password below. Password must be at least 6 characters.
                </Text>
                
                <TextInput
                  style={styles.passwordInput}
                  placeholder="New Password"
                  placeholderTextColor="#6b7280"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={[styles.passwordInput, { marginTop: 12 }]}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#6b7280"
                  secureTextEntry
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  autoCapitalize="none"
                />
                
                <Pressable
                  onPress={async () => {
                    if (newPassword.length < 6) {
                      Alert.alert('Error', 'Password must be at least 6 characters');
                      return;
                    }
                    if (newPassword !== confirmNewPassword) {
                      Alert.alert('Error', 'Passwords do not match');
                      return;
                    }
                    
                    setIsChangingPassword(true);
                    try {
                      const { error } = await supabase.auth.updateUser({
                        password: newPassword
                      });
                      
                      if (error) {
                        Alert.alert('Error', error.message);
                      } else {
                        Alert.alert('Success', 'Your password has been updated!');
                        setShowChangePasswordModal(false);
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }
                    } catch (err) {
                      Alert.alert('Error', 'Failed to update password. Please try again.');
                    } finally {
                      setIsChangingPassword(false);
                    }
                  }}
                  disabled={isChangingPassword || !newPassword || !confirmNewPassword}
                  style={[
                    styles.changePasswordBtn,
                    { opacity: (isChangingPassword || !newPassword || !confirmNewPassword) ? 0.5 : 1 }
                  ]}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.changePasswordBtnText}>Update Password</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
  },
  avatar: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  insightsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  insightsList: {
    paddingRight: 24,
  },
  insightCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  insightGradient: {
    padding: 20,
    position: 'relative',
  },
  insightContent: {
    zIndex: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
  },
  insightDescription: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  insightAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: '100%',
  },
  tryOnSection: {
    marginBottom: 32,
  },
  tryOnList: {
    paddingRight: 24,
  },
  tryOnCard: {
    width: 160,
    marginRight: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  tryOnImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  tryOnInfo: {
    padding: 12,
  },
  tryOnProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  tryOnDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  sectionsSection: {
    marginBottom: 32,
  },
  sectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionGradient: {
    padding: 20,
    position: 'relative',
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sectionTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  sectionAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  signOutSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  signOutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: 200,
  },
  signOutGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  backButtonPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    color: '#9ca3af',
    fontSize: 24,
    fontWeight: '300',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingsOptionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  settingsOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsOptionDesc: {
    color: '#9ca3af',
    fontSize: 13,
  },
  settingsOptionArrow: {
    color: '#6b7280',
    fontSize: 24,
    fontWeight: '300',
  },
  passwordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  changePasswordBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  changePasswordBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AccountScreen;
