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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../App';
import { Colors, Typography, Spacing, BorderRadius, CardStyles, TextStyles, ThemeColors, getCurrentThemeName } from '../lib/designSystem';

const { width, height } = Dimensions.get('window');

const AccountScreen = ({ onBack, tryOnResults = [] }) => {
  const { state, setTheme } = useApp();
  const [username] = useState('Fashionista');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const currentTheme = state.theme || 'teal';

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

  const coreSections = [
    {
      id: 'tryons',
      title: 'My Try-Ons',
      icon: '◉',
      color: '#6366f1',
      count: tryOnResults.length,
    },
    {
      id: 'pods',
      title: 'Active Pods',
      icon: '◈',
      color: '#8b5cf6',
      count: 2,
    },
    {
      id: 'designs',
      title: 'StyleCraft Designs',
      icon: '✦',
      color: '#f59e0b',
      count: 1,
    },
    {
      id: 'favorites',
      title: 'Favorites',
      icon: '◈',
      color: '#ef4444',
      count: 12,
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
      icon: '◈',
      color: '#10b981',
      count: null,
    },
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

  const SectionCard = ({ section }) => (
    <Pressable style={{
      ...CardStyles.container,
      width: '48%',
      marginBottom: Spacing.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border
    }}>
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

  return (
    <View style={styles.fullScreenContainer}>
      {/* Animated Background */}
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a2e']}
        style={styles.background}
      >
        {/* Floating Dashboard Elements */}
        <View style={styles.dashboardElements}>
          {[...Array(12)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.dashboardElement,
                {
                  left: Math.random() * width,
                  top: Math.random() * height,
                  animationDelay: Math.random() * 3,
                },
              ]}
            />
          ))}
        </View>

        {/* Fixed Header - with SafeAreaView padding */}
        <View style={[styles.header, { paddingTop: 44 }]}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 80 }]}
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
                  <View style={{
                    ...CardStyles.container,
                    width: 200,
                    marginRight: Spacing.md,
                    padding: 0,
                    overflow: 'hidden'
                  }}>
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
                  </View>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
              {Object.keys(ThemeColors).map((themeName) => {
                const theme = ThemeColors[themeName];
                const isSelected = currentTheme === themeName;
                return (
                  <Pressable
                    key={themeName}
                    onPress={() => {
                      setTheme(themeName);
                    }}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: BorderRadius.lg,
                      backgroundColor: theme.primary,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? Colors.textWhite : Colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: theme.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isSelected ? 0.5 : 0.2,
                      shadowRadius: 8,
                      elevation: isSelected ? 8 : 4
                    }}
                  >
                    {isSelected && (
                      <Text style={{ color: Colors.textWhite, fontSize: 20, marginBottom: Spacing.xs }}>✓</Text>
                    )}
                    <Text style={{ 
                      color: Colors.textWhite, 
                      fontSize: Typography.xs, 
                      fontWeight: Typography.semibold,
                      textTransform: 'capitalize'
                    }}>
                      {themeName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  dashboardElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dashboardElement: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: '#6366f1',
    borderRadius: 1.5,
    opacity: 0.3,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
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
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
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
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AccountScreen;
