import React, { useState } from 'react';
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

const { width, height } = Dimensions.get('window');

const AccountScreen = ({ onBack }) => {
  const [username] = useState('Fashionista');
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      icon: '👕',
      color: '#6366f1',
      count: 3,
    },
    {
      id: 'pods',
      title: 'Active Pods',
      icon: '💬',
      color: '#8b5cf6',
      count: 2,
    },
    {
      id: 'designs',
      title: 'StyleCraft Designs',
      icon: '⭐',
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
      id: 'settings',
      title: 'Settings',
      icon: '⚙️',
      color: '#6b7280',
      count: null,
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: '💬',
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
    <View style={styles.insightCard}>
      <LinearGradient
        colors={[insight.color + '20', insight.color + '10']}
        style={styles.insightGradient}
      >
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightDescription}>{insight.description}</Text>
        </View>
        <View style={[styles.insightAccent, { backgroundColor: insight.color }]} />
      </LinearGradient>
    </View>
  );

  const SectionCard = ({ section }) => (
    <Pressable style={styles.sectionCard}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
        style={styles.sectionGradient}
      >
        <View style={styles.sectionContent}>
          <Text style={styles.sectionIcon}>{section.icon}</Text>
          <View style={styles.sectionTextContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.count !== null && (
              <Text style={styles.sectionCount}>{section.count}</Text>
            )}
          </View>
          <View style={[styles.sectionAccent, { backgroundColor: section.color }]} />
        </View>
      </LinearGradient>
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

        {/* Fixed Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>My Stylit Hub</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#ec4899']}
                style={styles.avatarGradient}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{username[0]}</Text>
                </View>
              </LinearGradient>
            </View>
            
            <Text style={styles.greeting}>
              Hey, {username} 👋 — You're trending this week!
            </Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>👕 Try-Ons</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>2</Text>
                <Text style={styles.statLabel}>💬 Pods Running</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1</Text>
                <Text style={styles.statLabel}>⭐ StyleCraft Design</Text>
              </View>
            </View>
          </View>

          {/* AI Insights Section */}
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>📈 AI Insights</Text>
            <FlatList
              data={aiInsights}
              renderItem={({ item }) => <InsightCard insight={item} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.insightsList}
            />
          </View>

          {/* Core Sections Grid */}
          <View style={styles.sectionsSection}>
            <Text style={styles.sectionTitle}>My Stylit Hub</Text>
            <View style={styles.sectionsGrid}>
              {coreSections.map((section) => (
                <SectionCard key={section.id} section={section} />
              ))}
            </View>
          </View>

          {/* Sign Out Section */}
          <View style={styles.signOutSection}>
            <Pressable
              style={styles.signOutButton}
              onPress={handleSignOut}
              disabled={isSigningOut}
            >
              <LinearGradient
                colors={isSigningOut ? ['#10b981', '#059669'] : ['#374151', '#1f2937']}
                style={styles.signOutGradient}
              >
                <Text style={styles.signOutText}>
                  {isSigningOut ? 'See you soon 💫' : 'Sign out'}
                </Text>
              </LinearGradient>
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
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
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
    paddingTop: 100,
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
