import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

const PodsScreen = ({ onBack, onCreatePod }) => {
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const durations = [30, 60, 90, 120];

  const handleImageUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadedImage(result.assets[0].uri);
    }
  };

  const handleLaunchPod = () => {
    setIsAnimating(true);
    // Trigger confetti animation
    setTimeout(() => {
      onCreatePod({
        mode: selectedMode,
        duration: selectedDuration,
        image: uploadedImage,
      });
      setIsAnimating(false);
    }, 2000);
  };

  const ModeCard = ({ mode, title, tagline, copy, tags, gradient, icon }) => (
    <Pressable
      onPress={() => setSelectedMode(mode)}
      style={[
        styles.modeCard,
        selectedMode === mode && styles.selectedCard,
      ]}
    >
      <LinearGradient
        colors={gradient}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardIcon}>{icon}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardTagline}>{tagline}</Text>
          <Text style={styles.cardCopy}>{copy}</Text>
          <View style={styles.tagsContainer}>
            {tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a2e']}
        style={styles.background}
      >
        {/* Floating Light Particles */}
        <View style={styles.particlesContainer}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.particle,
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
          <Text style={styles.headerTitle}>Start a Pod</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroSubtitle}>
              Get instant vibe checks from your circle or the world.
            </Text>
            <Text style={styles.heroSubtext}>
              Upload your look → Choose audience → Get feedback fast.
            </Text>

            {/* Upload Button */}
            <Pressable style={styles.uploadButton} onPress={handleImageUpload}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.uploadGradient}
              >
                <Text style={styles.uploadButtonText}>
                  {uploadedImage ? '📸 Look Uploaded!' : '📸 Upload Look'}
                </Text>
              </LinearGradient>
            </Pressable>

            {uploadedImage && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
              </View>
            )}
          </View>

          {/* Audience Modes */}
          <View style={styles.modesSection}>
            <Text style={styles.sectionTitle}>Choose Your Audience</Text>
            
            <ModeCard
              mode="friends"
              title="Friends Pod"
              tagline="Keep it real — invite your crew."
              copy="Private feedback from your friends, with comments and reactions."
              tags={["💬 Comments", "👥 Trusted", "⏳ Longer"]}
              gradient={['#10b981', '#059669']}
              icon="👥"
            />

            <ModeCard
              mode="style_twins"
              title="Style Twins"
              tagline="AI finds your fashion doubles."
              copy="Stylit matches you with users who share your aesthetic — get unbiased feedback."
              tags={["⚡ Instant", "🧠 Smart Match", "🔒 Anonymous"]}
              gradient={['#8b5cf6', '#7c3aed']}
              icon="🧠"
            />

            <ModeCard
              mode="global_mix"
              title="Global Mix"
              tagline="See how your style plays worldwide."
              copy="Cultural insights from a global audience. Pure, diverse, no filters."
              tags={["🌈 Open", "🕶️ Cultural", "✨ Fresh Perspective"]}
              gradient={['#f59e0b', '#d97706']}
              icon="🌍"
            />
          </View>

          {/* Duration Selector */}
          <View style={styles.durationSection}>
            <Text style={styles.sectionTitle}>How long should your pod run?</Text>
            <View style={styles.durationContainer}>
              {durations.map((duration) => (
                <Pressable
                  key={duration}
                  onPress={() => setSelectedDuration(duration)}
                  style={[
                    styles.durationButton,
                    selectedDuration === duration && styles.selectedDuration,
                  ]}
                >
                  <Text style={[
                    styles.durationText,
                    selectedDuration === duration && styles.selectedDurationText,
                  ]}>
                    {duration}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* CTA Button */}
          <Pressable
            style={styles.launchButton}
            onPress={handleLaunchPod}
            disabled={!selectedMode || !uploadedImage}
          >
            <LinearGradient
              colors={selectedMode && uploadedImage ? ['#ef4444', '#dc2626'] : ['#374151', '#1f2937']}
              style={styles.launchGradient}
            >
              <Text style={styles.launchButtonText}>
                {isAnimating ? '🎉 Pod Live!' : '🚀 Launch Pod'}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#6366f1',
    borderRadius: 1,
    opacity: 0.6,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 40,
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
    paddingTop: 80,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  heroSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  uploadButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  uploadGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  imagePreview: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  previewImage: {
    width: 120,
    height: 160,
    borderRadius: 14,
  },
  modesSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modeCard: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    height: 160,
    transform: [{ scale: 1 }],
  },
  selectedCard: {
    transform: [{ scale: 1.02 }],
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardGradient: {
    padding: 16,
    flex: 1,
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardTagline: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardCopy: {
    fontSize: 12,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  durationSection: {
    marginBottom: 40,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  durationButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedDuration: {
    backgroundColor: '#6366f1',
    borderColor: '#8b5cf6',
  },
  durationText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedDurationText: {
    color: '#fff',
  },
  launchButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
  },
  launchGradient: {
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  launchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
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

export default PodsScreen;
