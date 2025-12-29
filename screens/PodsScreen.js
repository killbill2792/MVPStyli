import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  Clipboard,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { createPod, createPodInvites } from '../lib/pods';
import { getUserFriends, createNotification, addFriend } from '../lib/friends';
import { uploadImageAsync } from '../lib/upload';
import { buildShareUrl } from '../lib/share';
import { Colors, Spacing, BorderRadius, Typography } from '../lib/designSystem';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';

// Safe Image Component
const SafeImage = ({ source, style, resizeMode, ...props }) => {
  const [error, setError] = useState(false);
  
  if (error || !source || !source.uri || typeof source.uri !== 'string') {
    return (
      <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
         <Text style={{ fontSize: 10, color: '#666' }}>IMG</Text>
      </View>
    );
  }

  return (
    <Image 
      source={source} 
      style={style} 
      resizeMode={resizeMode} 
      onError={(e) => {
        console.log('Image load error:', e.nativeEvent.error, source.uri);
        setError(true);
      }}
      {...props} 
    />
  );
};

// Helper to parse image URI
const getValidImageUri = (imageField) => {
  if (!imageField) return null;
  if (typeof imageField !== 'string') return null;
  
  try {
    if (imageField.trim().startsWith('[')) {
      const parsed = JSON.parse(imageField);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return { uri: parsed[0] };
      }
    }
  } catch (e) {}
  
  return { uri: imageField };
};

const { width } = Dimensions.get('window');

const PodsScreen = ({ onBack, onCreatePod, userId, userName, params }) => {
  const { setBannerMessage, setBannerType, state } = useApp();
  const { tryOnHistory } = state;
  
  // Helper to show banner notifications
  const showBanner = (message, type = 'success') => {
    if (setBannerMessage && setBannerType) {
      setBannerMessage(message);
      setBannerType(type);
      if (type !== 'processing') {
        setTimeout(() => {
          setBannerMessage(null);
          setBannerType(null);
        }, 3000);
      }
    }
  };
  const [title, setTitle] = useState('');
  
  // Suggestion placeholder logic
  const suggestions = [
    "Rooftop party fit",
    "Office interview outfit",
    "Garba night lehenga",
    "Date night look",
    "Beach vacation vibe"
  ];
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex(prev => (prev + 1) % suggestions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [podLink, setPodLink] = useState(null);
  
  // Support multiple images
  const [images, setImages] = useState(() => {
    if (params?.imageUrl) {
      // Validate URL format to prevent URI parsing errors
      const url = params.imageUrl;
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))) {
        return [url];
      } else if (typeof url === 'string' && url.length > 0) {
        // If it's a valid string but not a URL, try to use it anyway
        console.warn('Invalid image URL format:', url);
        return [url];
      }
    }
    return [];
  });
  const product = params?.product;
  
  useEffect(() => {
    if (params?.imageUrl) {
      const url = params.imageUrl;
      // Validate URL before adding
      if (typeof url === 'string' && url.length > 0) {
        if (!images.includes(url)) {
          setImages([url]);
        }
      }
    }
  }, [params?.imageUrl]);

  // Load friends when Friends mode is selected
  useEffect(() => {
    if (selectedMode === 'friends' && userId) {
      loadFriends();
    }
  }, [selectedMode, userId]);

  const loadFriends = async () => {
    try {
      console.log('Loading friends for user:', userId);
      const friendsList = await getUserFriends(userId);
      console.log('Friends loaded:', friendsList);
      setFriends(friendsList);
      // Select all friends by default
      setSelectedFriends(friendsList.map(f => f.friend_id));
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    }
  };

  const modes = [
    {
      id: 'friends',
      title: '👥 Friends',
      description: "Share with friends. Votes + comments.",
      defaultDuration: 30,
    },
    {
      id: 'twins',
      title: '🧬 Twins',
      description: "Similar vibe. Votes only.",
      defaultDuration: 5,
    },
    {
      id: 'global_mix',
      title: '🌍 Global',
      description: "Public crowd. Mixed inputs.",
      defaultDuration: 15,
    }
  ];

  const durations = [5, 10, 15, 30, 60];

  useEffect(() => {
    if (selectedMode) {
      const mode = modes.find(m => m.id === selectedMode);
      if (mode) setSelectedDuration(mode.defaultDuration);
    }
  }, [selectedMode]);

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
    if (modeId !== 'friends') {
      setSelectedFriends([]);
    }
  };

  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [showTryOnHistory, setShowTryOnHistory] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleAddImage = async () => {
    setShowImageSourceModal(true);
  };

  const handleAddFromDevice = async () => {
    setShowImageSourceModal(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true });
    if (!res.canceled && res.assets) {
      const newImages = res.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const handleAddFromTryOnHistory = () => {
    setShowImageSourceModal(false);
    setShowTryOnHistory(true);
  };

  const handleSelectTryOn = (tryOn) => {
    // Validate URL before adding
    if (tryOn.resultUrl && typeof tryOn.resultUrl === 'string') {
      // Check if it's a valid URL format
      if (tryOn.resultUrl.startsWith('http://') || tryOn.resultUrl.startsWith('https://') || tryOn.resultUrl.startsWith('file://')) {
        setImages(prev => [...prev, tryOn.resultUrl]);
        setShowTryOnHistory(false);
      } else {
        Alert.alert('Invalid Image', 'The selected try-on image URL is invalid.');
      }
    } else {
      Alert.alert('Error', 'No image URL found for this try-on.');
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFriends.length === friends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(friends.map(f => f.friend_id));
    }
  };

  const handleAddFromContacts = async () => {
    try {
      // Request contacts permission
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant contacts permission to add friends.');
      return;
    }

      // Pick a contact
      const contact = await Contacts.pickContactAsync();
      if (contact && contact.phones && contact.phones.length > 0) {
        const phoneNumber = contact.phones[0].number.replace(/\D/g, '');
        const shareLink = podLink || (userId ? buildShareUrl({ kind: 'pod', podId: 'temp', fromUserId: userId }) : 'https://stylit.ai/download');
        
        // Open SMS with share link
        const smsUrl = `sms:${phoneNumber}?body=Check out my fit! ${shareLink}`;
        try {
          await Linking.openURL(smsUrl);
        } catch (error) {
          console.error('Error opening SMS:', error);
          Clipboard.setString(shareLink);
          Alert.alert('Link Copied', 'Share link copied to clipboard! Send it to your friend.');
        }
      } else {
        Alert.alert('No Phone Number', 'This contact doesn\'t have a phone number.');
      }
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error picking contact:', error);
        Alert.alert('Error', 'Failed to open contacts. You can copy the link after creating the pod.');
      }
    }
  };

  const handleCopyLink = async () => {
    if (!podLink) return;
    Clipboard.setString(podLink);
    showBanner('📋 Link copied!', 'success');
  };

  const handleStartPod = async () => {
    const finalTitle = title.trim() || suggestions[suggestionIndex];

    if (!selectedMode) {
      Alert.alert('Missing Info', 'Please select a pod type.');
      return;
    }
    if (images.length === 0) {
      Alert.alert('Missing Info', 'Please add at least one outfit image.');
      return;
    }
    // Allow pod creation without friends - they can share link later
    if (!userId) {
      Alert.alert('Not Signed In', 'You must be signed in to create a pod.');
      return;
    }

    setIsCreating(true);

    try {
      // Upload any local images to Supabase Storage
      const uploadedImages = await Promise.all(images.map(async (img) => {
        if (img && typeof img === 'string' && img.startsWith('file://')) {
            try {
                return await uploadImageAsync(img);
            } catch (e) {
                console.error('Failed to upload pod image:', img, e);
                throw new Error('Failed to upload image. Please try again.');
            }
        }
        return img;
      }));

      const audience = selectedMode === 'twins' ? 'style_twins' : selectedMode;
      const mainImage = uploadedImages[0];

      // Store multiple images as JSON array if more than one
      const imageData = uploadedImages.length > 1 ? JSON.stringify(uploadedImages) : mainImage;

      // FIX: Extract product metadata (tags, colors, category) for style profile tracking
      let productTags = null;
      let productColors = null;
      let productCategory = null;
      
      if (product) {
        // Extract tags - check multiple sources
        if (product.tags && Array.isArray(product.tags)) {
          productTags = product.tags;
        } else if (product.product_tags && Array.isArray(product.product_tags)) {
          productTags = product.product_tags;
        }
        
        // Extract colors
        if (product.colors && Array.isArray(product.colors)) {
          productColors = product.colors;
        } else if (product.color) {
          productColors = [product.color];
        } else if (product.product_colors && Array.isArray(product.product_colors)) {
          productColors = product.product_colors;
        }
        
        // Extract category
        productCategory = product.category || product.product_category || null;
      }

      const podData = {
        owner_id: userId,
        image_url: imageData, // Can be single URL or JSON array
        audience: audience,
        duration_mins: selectedDuration,
        title: finalTitle,
        ends_at: new Date(Date.now() + selectedDuration * 60000).toISOString(),
        product_url: product?.url || product?.productUrl || product?.buyUrl || null,
        // FIX: Store product metadata for accurate style profile tracking
        product_tags: productTags,
        product_colors: productColors,
        product_category: productCategory,
      };

      const pod = await createPod(podData);
      
      if (pod && pod.id) {
        const shareUrl = buildShareUrl({ kind: 'pod', podId: pod.id, fromUserId: userId, audience: pod.audience });
        setPodLink(shareUrl);

        // Create invites and notifications for Friends pods
        if (selectedMode === 'friends' && selectedFriends.length > 0 && userId) {
          // Create pod invites with from_user
          await createPodInvites(pod.id, selectedFriends, userId);

          // Create notifications for each friend with personalized message
          const senderName = userName || 'A friend';
          for (const friendId of selectedFriends) {
            await createNotification(friendId, 'pod_invite', {
              pod_id: pod.id,
              pod_title: finalTitle,
              from_user: userId,
              from_name: senderName,
              message: `${senderName} wants your fashion advice! 👗`,
            });
          }
        }

        // Show success banner and navigate
        showBanner('🎉 Pod is live!', 'success');
          onCreatePod(pod.id);
      } else {
        showBanner('Failed to create pod', 'error');
      }
    } catch (error) {
      console.error('Error creating pod:', error);
      showBanner('Something went wrong', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Determine if Start Pod button should be visible
  const canStartPod = selectedMode && 
                      images.length > 0 && 
                      selectedDuration;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1, position: 'relative' }} edges={['top']}>
        <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Pod</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        {/* Images Section */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            <Pressable onPress={handleAddImage} style={styles.addImageBtn}>
              <Text style={{ fontSize: 24, color: '#666' }}>+</Text>
            </Pressable>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageContainer}>
                <SafeImage source={getValidImageUri(img)} style={styles.previewImage} resizeMode="cover" />
                {images.length > 1 && (
                  <View style={styles.imageNumberBadge}>
                    <Text style={styles.imageNumberText}>{idx + 1}</Text>
                  </View>
                )}
                <Pressable onPress={() => handleRemoveImage(idx)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          </View>

          {/* Image Source Modal */}
          <Modal visible={showImageSourceModal} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Image</Text>
                  <Pressable onPress={() => setShowImageSourceModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.modalOption} onPress={handleAddFromDevice}>
                  <Text style={styles.modalOptionIcon}>📷</Text>
                  <Text style={styles.modalOptionText}>Upload from Device</Text>
                </Pressable>
                {tryOnHistory && tryOnHistory.length > 0 && (
                  <Pressable style={styles.modalOption} onPress={handleAddFromTryOnHistory}>
                    <Text style={styles.modalOptionIcon}>✨</Text>
                    <Text style={styles.modalOptionText}>Choose from Try-On History</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Modal>

          {/* Try-On History Modal */}
          <Modal visible={showTryOnHistory} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select from Try-On History</Text>
                  <Pressable onPress={() => setShowTryOnHistory(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.tryOnHistoryList}>
                  {tryOnHistory && tryOnHistory.length > 0 ? (
                    tryOnHistory.map((tryOn) => (
                      <Pressable 
                        key={tryOn.id} 
                        style={styles.tryOnHistoryItem}
                        onPress={() => handleSelectTryOn(tryOn)}
                      >
                        <View style={styles.tryOnHistoryImageContainer}>
                          <SafeImage source={getValidImageUri(tryOn.resultUrl)} style={styles.tryOnHistoryImage} resizeMode="cover" />
                          {/* Product Thumbnail Overlay */}
                          {(tryOn.productImage || tryOn.image) && (
                            <View style={styles.tryOnHistoryProductThumb}>
                              <SafeImage 
                                source={getValidImageUri(tryOn.productImage || tryOn.image)} 
                                style={styles.tryOnHistoryProductThumbImg} 
                                resizeMode="cover"
                              />
                            </View>
                          )}
                        </View>
                        <Text style={styles.tryOnHistoryName} numberOfLines={1}>
                          {tryOn.productName || 'Try-On Result'}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No try-on history available</Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={suggestions[suggestionIndex]}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        {/* Pod Type Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Who's voting?</Text>
          <View style={styles.modesRow}>
              {modes.map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  if (selectedMode && !isSelected) return null;

  return (
                    <Pressable
                      key={mode.id}
                      onPress={() => isSelected ? setSelectedMode(null) : handleModeSelect(mode.id)}
                      style={[
                        styles.modeCard,
                        isSelected && styles.modeCardSelected,
                        selectedMode && styles.modeCardFull
                      ]}
                    >
                      <Text style={styles.modeIcon}>{mode.title.split(' ')[0]}</Text>
                      <View>
                          <Text style={[styles.modeTitle, isSelected && { color: Colors.primary }]}>{mode.title.split(' ').slice(1).join(' ')}</Text>
                          <Text style={styles.modeDesc}>{mode.description}</Text>
                      </View>
                      {isSelected && <Text style={styles.changeModeText}>Change</Text>}
            </Pressable>
                  );
              })}
          </View>
          </View>

        {/* Duration Selection */}
        {selectedMode && (
          <View style={styles.section}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <View style={styles.durationRow}>
              {durations.map((mins) => (
                <Pressable
                  key={mins}
                  onPress={() => setSelectedDuration(mins)}
                  style={[
                    styles.durationPill,
                    selectedDuration === mins && styles.durationPillSelected
                  ]}
                >
                  <Text style={[
                    styles.durationText,
                    selectedDuration === mins && styles.durationTextSelected
                  ]}>
                    {mins}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Friends Selection - Only for Friends mode */}
        {selectedMode === 'friends' && (
          <View style={styles.section}>
            <View style={styles.friendsHeader}>
              <Text style={styles.label}>Choose Friends</Text>
              {friends.length > 0 && (
                <Pressable onPress={toggleSelectAll} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllText}>
                    {selectedFriends.length === friends.length ? 'Deselect All' : 'Select All'}
              </Text>
          </Pressable>
              )}
            </View>

            {friends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Text style={styles.emptyText}>
                  No friends selected. Add a contact or copy link after pod is created.
                </Text>
                <Pressable onPress={handleAddFromContacts} style={styles.addFriendBtn}>
                  <Text style={styles.addFriendBtnText}>+ Add from Contacts</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {friends.map((friend) => {
                  const isSelected = selectedFriends.includes(friend.friend_id);
                  return (
                        <Pressable
                      key={friend.id}
                      onPress={() => toggleFriend(friend.friend_id)}
                      style={[
                        styles.friendChip,
                        isSelected && styles.friendChipSelected
                      ]}
                    >
                      <View style={styles.friendAvatar}>
                        {friend.friend_avatar ? (
                          <SafeImage source={getValidImageUri(friend.friend_avatar)} style={styles.avatarImage} resizeMode="cover" />
                        ) : (
                          <Text style={styles.avatarText}>
                            {friend.friend_name?.charAt(0)?.toUpperCase() || 'F'}
                          </Text>
                      )}
                    </View>
                      <Text style={[styles.friendName, isSelected && styles.friendNameSelected]}>
                        {friend.friend_name || 'Friend'}
                      </Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                  );
                })}
                
                {/* Add Friend Button */}
                <Pressable
                  onPress={handleAddFromContacts} 
                  style={[styles.friendChip, styles.addFriendChip]}
                >
                  <Text style={styles.addFriendIcon}>+</Text>
                  <Text style={styles.addFriendLabel}>Add from contacts</Text>
                </Pressable>
              </View>
            )}

            {selectedFriends.length === 0 && friends.length > 0 && (
              <Text style={styles.hintText}>
                No friends selected. You can add contacts or copy link after pod is created.
              </Text>
            )}
            </View>
        )}

        {/* Start Pod Button - Show below Friends section when duration is selected */}
        {selectedMode === 'friends' && selectedDuration && (
          <View style={styles.section}>
            <Pressable 
              onPress={handleStartPod} 
              disabled={isCreating}
              style={[styles.startButton, isCreating && styles.startButtonDisabled]}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startButtonText}>Start Pod →</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Start Pod Button - For non-friends modes, show after duration */}
        {selectedMode && selectedMode !== 'friends' && selectedDuration && (
          <View style={styles.section}>
            <Pressable 
              onPress={handleStartPod} 
              disabled={isCreating}
              style={[styles.startButton, isCreating && styles.startButtonDisabled]}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startButtonText}>Start Pod →</Text>
              )}
            </Pressable>
    </View>
        )}

      </ScrollView>
      
      {/* Floating Help Icon - Inside SafeAreaView but above everything */}
      <Pressable 
        style={styles.helpFloatingButton}
        onPress={() => {
          console.log('🎯 Help button pressed!');
          setShowHelpModal(true);
        }}
      >
        <Text style={styles.helpFloatingButtonIcon}>?</Text>
      </Pressable>
      
      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>What are Pods?</Text>
              <Pressable onPress={() => setShowHelpModal(false)}>
                <Text style={styles.helpModalClose}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView style={styles.helpModalScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.helpModalIntro}>
                Pods are a fun way to get fashion advice from your community! Share your outfit and get instant feedback.
              </Text>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>👥 Friends Pod</Text>
                <Text style={styles.helpSectionText}>
                  Share with your friends only. Perfect for getting honest feedback from people you trust. Only friends you've added can see and vote on your pod.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>👯 Style Twins Pod</Text>
                <Text style={styles.helpSectionText}>
                  Connect with users who have similar style preferences. Great for discovering new fashion ideas and getting advice from like-minded fashionistas.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>🌍 Global Pod</Text>
                <Text style={styles.helpSectionText}>
                  Share with everyone! Your pod will be visible to all Stylit users. Get diverse opinions and reach a wider audience. Perfect for showcasing your style to the world.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>⏱️ Duration</Text>
                <Text style={styles.helpSectionText}>
                  Choose how long your pod stays active (15, 30, 60, or 120 minutes). After the time expires, you'll see the final results and can no longer receive new votes.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>💬 Voting</Text>
                <Text style={styles.helpSectionText}>
                  Viewers can vote with 🔥 (Love it!), 🤔 (Maybe), or ❌ (Not for me). You'll see real-time results as votes come in!
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  imageContainer: {
    width: 100,
    height: 140,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addImageBtn: {
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modesRow: {
    gap: 12,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeCardFull: {
    width: '100%',
  },
  modeIcon: {
    fontSize: 32,
  },
  modeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  changeModeText: {
    color: Colors.primary,
    fontSize: 14,
    marginLeft: 'auto',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  durationPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  durationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  durationTextSelected: {
    color: '#000',
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllBtn: {
    padding: 4,
  },
  selectAllText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  friendChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  friendName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  friendNameSelected: {
    color: Colors.primary,
  },
  checkmark: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  addFriendChip: {
    borderStyle: 'dashed',
  },
  addFriendIcon: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  addFriendLabel: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyFriends: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  addFriendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  addFriendBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    color: '#fff',
    fontSize: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modalOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tryOnHistoryList: {
    maxHeight: 400,
  },
  tryOnHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  tryOnHistoryImageContainer: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  tryOnHistoryImage: {
    width: '100%',
    height: '100%',
  },
  tryOnHistoryProductThumb: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  tryOnHistoryProductThumbImg: {
    width: '100%',
    height: '100%',
  },
  tryOnHistoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  imageNumberBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  helpFloatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff0000', // Bright red for testing visibility
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  helpFloatingButtonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  helpModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  helpModalClose: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  helpModalScroll: {
    maxHeight: 500,
  },
  helpModalIntro: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
    paddingBottom: 10,
  },
  helpSection: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  helpSectionTitle: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  helpSectionText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PodsScreen;
