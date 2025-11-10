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
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { createPod } from '../lib/pods';

const { width, height } = Dimensions.get('window');

const PodsScreen = ({ onBack, onCreatePod, userId = 'demo-user' }) => {
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

  const handleLaunchPod = async () => {
    if (!uploadedImage) {
      Alert.alert('Upload Required', 'Please upload a look image first.');
      return;
    }

    if (!selectedMode) {
      Alert.alert('Mode Required', 'Please select an audience mode.');
      return;
    }

    // For friends mode, show invite screen first
    if (selectedMode === 'friends') {
      setShowFriendsInvite(true);
      return;
    }

    // For global and style_twins, auto-select random users
    await createPodWithAudience();
  };

  const createPodWithAudience = async (inviteList = []) => {
    setIsAnimating(true);

    try {
      // For global and style_twins, generate random user IDs
      let audienceList = inviteList;
      if (selectedMode === 'global_mix' || selectedMode === 'style_twins') {
        // Generate 5-10 random user IDs (simulated)
        const randomCount = Math.floor(Math.random() * 6) + 5;
        audienceList = Array.from({ length: randomCount }, (_, i) => `user_${Math.random().toString(36).substr(2, 9)}`);
      }

      // Create the pod
      const podData = {
        owner_id: userId,
        image_url: uploadedImage,
        audience: selectedMode,
        duration_mins: selectedDuration,
        title: 'My Look',
        ends_at: new Date(Date.now() + selectedDuration * 60000).toISOString(),
        invite_list: audienceList, // Add invite list
      };

      const pod = await createPod(podData);
      
      if (pod) {
        // Trigger confetti animation
        setTimeout(() => {
          onCreatePod(pod.id);
          setIsAnimating(false);
          setShowFriendsInvite(false);
        }, 2000);
      } else {
        Alert.alert('Error', 'Failed to create pod. Please try again.');
        setIsAnimating(false);
      }
    } catch (error) {
      console.error('Error creating pod:', error);
      Alert.alert('Error', 'Failed to create pod. Please try again.');
      setIsAnimating(false);
    }
  };

  const handleAddFriendInput = () => {
    setFriendInputs([...friendInputs, '']);
  };

  const handleRemoveFriendInput = (index) => {
    if (friendInputs.length > 1) {
      setFriendInputs(friendInputs.filter((_, i) => i !== index));
    }
  };

  const handleFriendInputChange = (index, value) => {
    const newInputs = [...friendInputs];
    newInputs[index] = value;
    setFriendInputs(newInputs);
  };

  const handleSendInvites = () => {
    const validInputs = friendInputs.filter(input => input.trim().length > 0);
    if (validInputs.length === 0) {
      Alert.alert('Invites Required', 'Please add at least one phone number or user ID.');
      return;
    }
    createPodWithAudience(validInputs);
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
    <View style={styles.fullScreenContainer}>
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: 100 }]}
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
              copy="Private, honest feedback from people you trust."
              tags={["💬 Comments", "👥 Trusted", "⏳ Longer Run"]}
              gradient={['#a7f3d0', '#6ee7b7']}
              icon="👯‍♀️"
            />

            <ModeCard
              mode="style_twins"
              title="Style Twins"
              tagline="AI finds your fashion doubles."
              copy="Stylit matches you with users who share your aesthetic — unbiased, fast feedback."
              tags={["⚡ Instant", "🧠 Smart Match", "🔒 Anonymous"]}
              gradient={['#c4b5fd', '#a78bfa']}
              icon="🎯"
            />

            <ModeCard
              mode="global_mix"
              title="Global Mix"
              tagline="See how your style plays worldwide."
              copy="Cultural insights from diverse audiences — pure, unfiltered perspective."
              tags={["🌈 Open", "🕶️ Cultural", "✨ Fresh View"]}
              gradient={['#fbbf24', '#f59e0b', '#c4b5fd']}
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

        {/* Friends Invite Modal */}
        {showFriendsInvite && (
          <View style={StyleSheet.absoluteFillObject}>
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.9)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20
            }}>
              <View style={{
                backgroundColor: '#1a1a1a',
                borderRadius: 20,
                padding: 24,
                width: '100%',
                maxWidth: 400,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
              }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                  Invite Friends
                </Text>
                <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>
                  Add phone numbers or user IDs to send invites
                </Text>

                <ScrollView style={{ maxHeight: 300, marginBottom: 20 }}>
                  {friendInputs.map((input, index) => (
                    <View key={index} style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                      <TextInput
                        value={input}
                        onChangeText={(value) => handleFriendInputChange(index, value)}
                        placeholder="Phone or User ID"
                        placeholderTextColor="#6b7280"
                        style={{
                          flex: 1,
                          backgroundColor: '#0a0a0a',
                          padding: 12,
                          borderRadius: 12,
                          color: '#fff',
                          fontSize: 14,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.1)'
                        }}
                      />
                      {friendInputs.length > 1 && (
                        <Pressable
                          onPress={() => handleRemoveFriendInput(index)}
                          style={{
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: '#ef4444',
                            borderRadius: 12
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 18 }}>−</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </ScrollView>

                <Pressable
                  onPress={handleAddFriendInput}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginBottom: 20
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>+ Add Another</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable
                    onPress={() => setShowFriendsInvite(false)}
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      padding: 14,
                      borderRadius: 12,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSendInvites}
                    style={{
                      flex: 1,
                      backgroundColor: '#ef4444',
                      padding: 14,
                      borderRadius: 12,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Send Invites</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
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
