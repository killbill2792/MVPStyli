import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  Clipboard,
  Modal,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '../lib/SimpleGradient';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { createPod, createPodInvites } from '../lib/pods';
import { getUserFriends, createNotification, addFriend } from '../lib/friends';
import { uploadImageAsync } from '../lib/upload';
import { buildShareUrl } from '../lib/share';
import { Colors, Spacing, BorderRadius, Typography } from '../lib/designSystem';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';
import { SafeImage, OptimizedImage } from '../lib/OptimizedImage';
import { Avatar } from '../components/Avatar';
import { SELECTABLE_TAGS, ALL_STYLE_TAGS, inferTagsFromProduct } from '../lib/styleTaxonomy';

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

// Helper to format duration for display
const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} minutes`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else {
    const days = Math.floor(minutes / 1440);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
};

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
  const [createdPodId, setCreatedPodId] = useState(null);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationValue, setCustomDurationValue] = useState('');
  const [customDurationUnit, setCustomDurationUnit] = useState('minutes'); // 'minutes', 'hours', 'days'
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  
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
  
  // Extract product metadata for Style Twins display using comprehensive taxonomy
  const getProductMetadata = () => {
    // Collect product data from all sources
    const productNames = [];
    const productDescriptions = [];
    let existingTags = product?.tags || product?.product_tags || [];
    let existingColors = product?.colors || product?.product_colors || (product?.color ? [product.color] : []);
    let existingCategory = product?.category || product?.product_category || null;
    
    // Add main product data if available
    if (product?.name || product?.productName || product?.title) {
      productNames.push(product?.name || product?.productName || product?.title);
    }
    if (product?.description) {
      productDescriptions.push(product.description);
    }
    
    // Add product data from all images (try-on history items)
    images.forEach(imageUrl => {
      const imageProduct = imageProductMap[imageUrl];
      if (imageProduct) {
        if (imageProduct.name || imageProduct.productName || imageProduct.title) {
          productNames.push(imageProduct.name || imageProduct.productName || imageProduct.title);
        }
        if (imageProduct.description) {
          productDescriptions.push(imageProduct.description);
        }
        // Merge existing tags/colors from product
        if (imageProduct.tags && imageProduct.tags.length > 0) {
          existingTags = [...existingTags, ...imageProduct.tags];
        }
        if (imageProduct.colors && imageProduct.colors.length > 0) {
          existingColors = [...existingColors, ...imageProduct.colors];
        }
        if (!existingCategory && imageProduct.category) {
          existingCategory = imageProduct.category;
        }
      }
    });
    
    // Use the comprehensive taxonomy for inference
    const inferred = inferTagsFromProduct({
      name: productNames.join(' '),
      title: productNames.join(' '),
      description: productDescriptions.join(' '),
      category: existingCategory,
      color: existingColors[0],
      tags: existingTags
    });
    
    // Merge inferred with existing, deduplicate
    const finalTags = [...new Set([...existingTags, ...inferred.tags])].filter(t => ALL_STYLE_TAGS.includes(t));
    const finalColors = [...new Set([...existingColors, ...inferred.colors])];
    const finalCategory = inferred.category || existingCategory;
    
    return { 
      tags: finalTags, 
      colors: finalColors, 
      category: finalCategory 
    };
  };
  
  // State for selected style tags (from taxonomy)
  const [selectedStyleTags, setSelectedStyleTags] = useState([]);
  const [showTagPickerModal, setShowTagPickerModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [hasAutofilledTags, setHasAutofilledTags] = useState(false);
  
  // Auto-prefill style tags from product metadata when twins mode is selected
  useEffect(() => {
    if (selectedMode === 'twins' && !hasAutofilledTags) {
      const metadata = getProductMetadata();
      if (metadata.tags.length > 0 && selectedStyleTags.length === 0) {
        setSelectedStyleTags(metadata.tags);
        setHasAutofilledTags(true);
      }
    }
  }, [selectedMode, hasAutofilledTags]);
  
  // Store product metadata for each image (keyed by image URL)
  // This allows us to track which product is associated with each image
  const [imageProductMap, setImageProductMap] = useState({}); // { imageUrl: { name, description, tags, colors, category, etc. } }
  
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [createdPodTitle, setCreatedPodTitle] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const handleAddImage = async () => {
    setShowImageSourceModal(true);
  };

  const handleAddFromDevice = async () => {
    try {
      setShowImageSourceModal(false);
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant photo library permission to add images.');
        return;
      }
      
      // Small delay to ensure modal closes before opening picker
      setTimeout(async () => {
        const res = await ImagePicker.launchImageLibraryAsync({ 
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          quality: 0.8, 
          allowsMultipleSelection: true 
        });
        if (!res.canceled && res.assets) {
          const newImages = res.assets.map(asset => asset.uri);
          setImages(prev => [...prev, ...newImages]);
          showBanner(`${newImages.length} image(s) added`, 'success');
        }
      }, 300);
    } catch (error) {
      console.error('Error adding images from device:', error);
      Alert.alert('Error', 'Failed to add images. Please try again.');
    }
  };

  const handleAddFromTryOnHistory = () => {
    setShowImageSourceModal(false);
    setShowTryOnHistory(true);
  };

  const handleSelectTryOn = (tryOn) => {
    console.log('🎯 handleSelectTryOn called with:', tryOn);
    // Try multiple possible URL fields
    const imageUrl = tryOn.resultUrl || tryOn.result_url || tryOn.image || tryOn.userImage;
    
    if (imageUrl && typeof imageUrl === 'string') {
      // Check if it's a valid URL format
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('file://')) {
        setImages(prev => {
          const newImages = [...prev, imageUrl];
          console.log('🎯 Updated images array:', newImages);
          return newImages;
        });
        
        // Store product data for THIS specific image
        // Each try-on has an original product attached with metadata
        if (tryOn.productName || tryOn.productImage || tryOn.productUrl) {
          // Create a product object from the try-on's attached product data
          const tryOnProduct = {
            name: tryOn.productName || '',
            productName: tryOn.productName || '',
            title: tryOn.productName || '',
            image: tryOn.productImage || tryOn.image,
            productImage: tryOn.productImage || tryOn.image,
            url: tryOn.productUrl,
            productUrl: tryOn.productUrl,
            link: tryOn.productUrl,
            // Note: If try-on history stored more product metadata (tags, colors, category, description),
            // we would include it here. For now, we'll extract from the product name.
          };
          
          // Store this product data mapped to this specific image URL
          setImageProductMap(prev => ({
            ...prev,
            [imageUrl]: tryOnProduct
          }));
          
          console.log('🎯 Stored product data for image:', imageUrl, 'Product:', tryOn.productName);
        }
        
        setShowTryOnHistory(false);
        showBanner('Image added from try-on history', 'success');
      } else {
        console.warn('🎯 Invalid URL format:', imageUrl);
        Alert.alert('Invalid Image', 'The selected try-on image URL is invalid.');
      }
    } else {
      console.warn('🎯 No valid image URL found in tryOn:', tryOn);
      Alert.alert('Error', 'No image URL found for this try-on.');
    }
  };

  const handleRemoveImage = (index) => {
    const imageUrlToRemove = images[index];
    setImages(prev => prev.filter((_, i) => i !== index));
    
    // Remove product metadata for this image
    if (imageUrlToRemove && imageProductMap[imageUrlToRemove]) {
      setImageProductMap(prev => {
        const newMap = { ...prev };
        delete newMap[imageUrlToRemove];
        return newMap;
      });
    }
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

  // Share via WhatsApp
  const handleShareWhatsApp = async () => {
    if (!podLink) return;
    const message = `Hey! Check out my fit and vote! 👗✨\n\n${createdPodTitle || 'What do you think?'}\n\n${podLink}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp Not Installed', 'WhatsApp is not installed on this device.');
      }
    } catch (error) {
      console.error('WhatsApp share error:', error);
    }
  };

  // Share via SMS/iMessage
  const handleShareSMS = async () => {
    if (!podLink) return;
    const message = `Hey! Check out my fit and vote! 👗✨\n\n${createdPodTitle || 'What do you think?'}\n\n${podLink}`;
    const smsUrl = `sms:&body=${encodeURIComponent(message)}`;
    
    try {
      await Linking.openURL(smsUrl);
    } catch (error) {
      console.error('SMS share error:', error);
      Clipboard.setString(podLink);
      Alert.alert('Link Copied', 'Could not open Messages. Link copied to clipboard!');
    }
  };

  // Share via Instagram (copy + open)
  const handleShareInstagram = async () => {
    if (!podLink) return;
    Clipboard.setString(podLink);
    
    Alert.alert(
      'Link Copied! 📋',
      'Open Instagram and paste this link in a DM to your friends.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Instagram', 
          onPress: async () => {
            const instagramUrl = 'instagram://';
            try {
              const canOpen = await Linking.canOpenURL(instagramUrl);
              if (canOpen) {
                await Linking.openURL(instagramUrl);
              } else {
                Linking.openURL('https://instagram.com');
              }
            } catch (e) {
              Linking.openURL('https://instagram.com');
            }
          }
        }
      ]
    );
  };

  // Share via TikTok
  const handleShareTikTok = async () => {
    if (!podLink) return;
    Clipboard.setString(podLink);
    
    Alert.alert(
      'Link Copied! 📋',
      'Open TikTok and paste this link in a message to your friends.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open TikTok', 
          onPress: async () => {
            const tiktokUrl = 'tiktok://';
            try {
              const canOpen = await Linking.canOpenURL(tiktokUrl);
              if (canOpen) {
                await Linking.openURL(tiktokUrl);
              } else {
                Linking.openURL('https://tiktok.com');
              }
            } catch (e) {
              Linking.openURL('https://tiktok.com');
            }
          }
        }
      ]
    );
  };

  // Native share sheet
  const handleNativeShare = async () => {
    if (!podLink) return;
    const message = `Hey! Check out my fit and vote! 👗✨\n\n${createdPodTitle || 'What do you think?'}\n\n${podLink}`;
    
    try {
      await Share.share({
        message: message,
        url: Platform.OS === 'ios' ? podLink : undefined,
        title: 'Vote on my fit!',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = async () => {
    if (!podLink) return;
    Clipboard.setString(podLink);
    setLinkCopied(true);
    showBanner('📋 Link copied!', 'success');
  };

  const handleStartPod = async () => {
    // Require a title - don't use placeholder text
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing Title', 'Please enter a title for your pod.');
      return;
    }
    const finalTitle = trimmedTitle;

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
      // Use the same improved extraction logic as getProductMetadata
      const metadata = getProductMetadata();
      
      // Combine extracted tags with selected style tags
      const allTags = [...new Set([...metadata.tags, ...selectedStyleTags])];
      
      let productTags = allTags.length > 0 ? allTags : null;
      let productColors = metadata.colors.length > 0 ? metadata.colors : null;
      let productCategory = metadata.category || null;
      
      // Fallback: if still no tags, try direct product extraction
      if (!productTags && product) {
        if (product.tags && Array.isArray(product.tags)) {
          productTags = product.tags;
        } else if (product.product_tags && Array.isArray(product.product_tags)) {
          productTags = product.product_tags;
        }
      }
      
      // Fallback: if still no colors, try direct product extraction
      if (!productColors && product) {
        if (product.colors && Array.isArray(product.colors)) {
          productColors = product.colors;
        } else if (product.color) {
          productColors = [product.color];
        } else if (product.product_colors && Array.isArray(product.product_colors)) {
          productColors = product.product_colors;
        }
      }
      
      // Fallback: if still no category, try direct product extraction
      if (!productCategory && product) {
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

        // Show success and share modal - don't navigate yet
        setCreatedPodTitle(finalTitle);
        setCreatedPodId(pod.id);
        setLinkCopied(false); // Reset link copied state for new pod
        setShowShareModal(true);
        showBanner('🎉 Pod is live!', 'success');
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
      {/* Floating Help Icon - At top level, outside SafeAreaView */}
      <Pressable 
        style={styles.helpFloatingButton}
        onPress={() => {
          console.log('🎯 Help button pressed!');
          setShowHelpModal(true);
        }}
      >
        <Text style={styles.helpFloatingButtonIcon}>?</Text>
      </Pressable>
      
      <SafeAreaView style={{ flex: 1, position: 'relative' }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Pod</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
        
        {/* Images Section */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            <Pressable onPress={handleAddImage} style={styles.addImageBtn}>
              <Text style={{ fontSize: 24, color: '#666' }}>+</Text>
            </Pressable>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageContainer}>
                <SafeImage 
                  source={getValidImageUri(img)} 
                  style={styles.previewImage} 
                  resizeMode="cover"
                  width={300}  // Preview image width
                  height={300} // Preview image height
                  quality={85}  // Good quality for previews
                />
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
                <Pressable 
                  style={styles.modalOption} 
                  onPress={() => {
                    console.log('🎯 Add from Try-On History pressed');
                    console.log('🎯 tryOnHistory:', tryOnHistory);
                    if (tryOnHistory && tryOnHistory.length > 0) {
                      handleAddFromTryOnHistory();
                    } else {
                      Alert.alert('No Try-Ons', 'You don\'t have any try-on results yet. Create a try-on first!');
                    }
                  }}
                >
                  <Text style={styles.modalOptionIcon}>✨</Text>
                  <Text style={styles.modalOptionText}>
                    {tryOnHistory && tryOnHistory.length > 0 
                      ? `Choose from Try-On History (${tryOnHistory.length})`
                      : 'No Try-Ons Available'}
                  </Text>
                </Pressable>
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
                    tryOnHistory.map((tryOn, idx) => (
                      <Pressable 
                        key={tryOn.id || `tryon-${idx}`} 
                        style={styles.tryOnHistoryItem}
                        onPress={() => {
                          console.log('🎯 Try-on item pressed:', tryOn);
                          handleSelectTryOn(tryOn);
                        }}
                      >
                        <View style={styles.tryOnHistoryImageContainer}>
                          <SafeImage 
                            source={getValidImageUri(tryOn.resultUrl)} 
                            style={styles.tryOnHistoryImage} 
                            resizeMode="cover"
                            width={150}  // Thumbnail width for try-on history
                            height={150} // Thumbnail height for try-on history
                            quality={85} // Good quality for thumbnails
                          />
                          {/* Product Thumbnail Overlay */}
                          {(tryOn.productImage || tryOn.image) && (
                            <View style={styles.tryOnHistoryProductThumb}>
                              <SafeImage 
                                source={getValidImageUri(tryOn.productImage || tryOn.image)} 
                                style={styles.tryOnHistoryProductThumbImg} 
                                resizeMode="cover"
                                width={40}  // Small thumbnail for product overlay
                                height={40} // Small thumbnail for product overlay
                                quality={85} // Good quality for small thumbnails
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

        {/* Style Twins Tags Display */}
        {selectedMode === 'twins' && (
          <View style={styles.section}>
            <View style={styles.styleTwinsInfoContainer}>
              <Text style={styles.styleTwinsHelpTitle}>📋 Style Tags</Text>
              <Text style={styles.styleTwinsHelpText}>
                These tags help your pod reach the right audience. People who are good at this style will see and provide feedback on your pod.
              </Text>
              {(() => {
                const metadata = getProductMetadata();
                const allTags = [...new Set([...metadata.tags, ...selectedStyleTags])];
                const hasColors = metadata.colors.length > 0;
                const hasCategory = metadata.category !== null;
                
                return (
                  <View style={styles.tagsContainer}>
                    {/* Selected Style Tags */}
                    <View style={styles.tagGroup}>
                      <Text style={styles.tagGroupLabel}>Style Tags:</Text>
                      {allTags.length > 0 ? (
                        <View style={styles.tagRow}>
                          {allTags.map((tag, idx) => (
                            <View key={idx} style={[styles.tagChip, { backgroundColor: Colors.primary + '30' }]}>
                              <Text style={[styles.tagChipText, { color: Colors.primary }]}>{tag}</Text>
                              <Pressable
                                onPress={() => setSelectedStyleTags(prev => prev.filter(t => t !== tag))}
                                style={styles.tagRemoveBtn}
                              >
                                <Text style={[styles.tagRemoveText, { color: Colors.primary }]}>×</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.noTagsHint}>
                          No tags yet. Select from categories below.
                        </Text>
                      )}
                    </View>
                    
                    {hasColors && (
                      <View style={styles.tagGroup}>
                        <Text style={styles.tagGroupLabel}>Colors:</Text>
                        <View style={styles.tagRow}>
                          {metadata.colors.map((color, idx) => (
                            <View key={idx} style={styles.tagChip}>
                              <Text style={styles.tagChipText}>{color}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {hasCategory && (
                      <View style={styles.tagGroup}>
                        <Text style={styles.tagGroupLabel}>Category:</Text>
                        <View style={styles.tagRow}>
                          <View style={styles.tagChip}>
                            <Text style={styles.tagChipText}>{metadata.category}</Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* Tag Categories from Taxonomy */}
                    {Object.entries(SELECTABLE_TAGS).map(([category, tags]) => (
                      <View key={category} style={styles.tagSuggestions}>
                        <Text style={styles.tagSuggestionsLabel}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}:
                        </Text>
                        <View style={styles.tagSuggestionsRow}>
                          {tags.slice(0, 12).map((sugTag) => {
                            const isSelected = allTags.includes(sugTag);
                            return (
                              <Pressable
                                key={sugTag}
                                style={[styles.tagSuggestionChip, isSelected && styles.tagSuggestionChipSelected]}
                                onPress={() => {
                                  if (!isSelected) {
                                    setSelectedStyleTags(prev => [...prev, sugTag]);
                                  } else {
                                    setSelectedStyleTags(prev => prev.filter(t => t !== sugTag));
                                  }
                                }}
                              >
                                <Text style={[styles.tagSuggestionText, isSelected && styles.tagSuggestionTextSelected]}>
                                  {isSelected ? '✓ ' : '+ '}{sugTag}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                    
                    {/* See More Tags Button - Visually distinct */}
                    <Pressable
                      style={{ 
                        marginTop: 16, 
                        alignSelf: 'flex-start',
                        backgroundColor: Colors.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onPress={() => setShowTagPickerModal(true)}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>See All Tags</Text>
                      <Text style={{ color: '#fff', fontSize: 16 }}>→</Text>
                    </Pressable>
                  </View>
                );
              })()}
            </View>
          </View>
        )}

        {/* Duration Selection */}
        {selectedMode && (
          <View style={styles.section}>
            <View style={styles.durationHeader}>
              <Text style={styles.label}>Duration</Text>
              {/* Show selected duration at top right */}
              {selectedDuration && !showCustomDuration && (
                <View style={styles.selectedDurationBadge}>
                  <Text style={styles.selectedDurationBadgeText}>
                    {formatDuration(selectedDuration)}
                  </Text>
                </View>
              )}
              {showCustomDuration && (
                <Pressable 
                  onPress={() => setShowCustomDuration(false)}
                  style={styles.customDurationToggle}
                >
                  <Text style={styles.customDurationToggleText}>Use Presets</Text>
                </Pressable>
              )}
            </View>
            
            {!showCustomDuration ? (
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
                {/* Custom button - same style as other duration pills */}
                <Pressable 
                  onPress={() => setShowCustomDuration(true)}
                  style={styles.durationPill}
                >
                  <Text style={styles.durationText}>Custom</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.customDurationContainer}>
                <TextInput
                  style={styles.customDurationInput}
                  value={customDurationValue}
                  onChangeText={setCustomDurationValue}
                  placeholder="Enter duration"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                />
                <View style={{ position: 'relative' }}>
                  <Pressable
                    style={styles.unitSelector}
                    onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                  >
                    <Text style={styles.unitSelectorText}>{customDurationUnit}</Text>
                    <Text style={styles.unitSelectorArrow}>▼</Text>
                  </Pressable>
                  
                  {/* Unit Dropdown */}
                  {showUnitDropdown && (
                    <View style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#1f2937',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#374151',
                      marginTop: 4,
                      zIndex: 100,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 8,
                    }}>
                      {['minutes', 'hours', 'days'].map((unit) => (
                        <Pressable
                          key={unit}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderBottomWidth: unit !== 'days' ? 1 : 0,
                            borderBottomColor: '#374151',
                            backgroundColor: customDurationUnit === unit ? Colors.primary + '30' : 'transparent',
                          }}
                          onPress={() => {
                            setCustomDurationUnit(unit);
                            setShowUnitDropdown(false);
                          }}
                        >
                          <Text style={{
                            color: customDurationUnit === unit ? Colors.primary : '#fff',
                            fontSize: 14,
                            fontWeight: customDurationUnit === unit ? '600' : '400',
                          }}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <Pressable
                  style={styles.applyDurationBtn}
                  onPress={() => {
                    const value = parseInt(customDurationValue);
                    if (isNaN(value) || value <= 0) {
                      Alert.alert('Invalid Duration', 'Please enter a valid number greater than 0.');
                      return;
                    }
                    let totalMinutes = value;
                    if (customDurationUnit === 'hours') {
                      totalMinutes = value * 60;
                    } else if (customDurationUnit === 'days') {
                      totalMinutes = value * 24 * 60;
                    }
                    setSelectedDuration(totalMinutes);
                    setShowCustomDuration(false);
                    setCustomDurationValue('');
                  }}
                >
                  <Text style={styles.applyDurationBtnText}>Apply</Text>
                </Pressable>
              </View>
            )}
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
                  No friends on the app yet? No worries!
                </Text>
                <Text style={[styles.emptyText, { marginTop: 8, color: Colors.primary, fontSize: 14, lineHeight: 20 }]}>
                  After creating your pod, you can share it via WhatsApp, iMessage, Instagram, or TikTok 💬
                </Text>
              </View>
            ) : (
              <>
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
                        <Avatar 
                          imageUri={friend.friend_avatar || null} 
                          name={friend.friend_name || 'Friend'} 
                          size={28}
                        />
                        <Text style={[styles.friendName, isSelected && styles.friendNameSelected]}>
                          {friend.friend_name || 'Friend'}
                        </Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                  );
                })}
                </View>
                {/* Help text - always show below friends list */}
                <View style={{ marginTop: 12, paddingHorizontal: 4 }}>
                  <Text style={[styles.emptyText, { color: Colors.primary, fontSize: 13, lineHeight: 18, textAlign: 'left' }]}>
                    After creating your pod, you can share it via WhatsApp, iMessage, Instagram, or TikTok 💬
                  </Text>
                </View>
              </>
            )}

            {selectedFriends.length === 0 && friends.length > 0 && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                <Text style={[styles.hintText, { color: Colors.primary, fontSize: 13, lineHeight: 18 }]}>
                  No friends on the app yet? Share via WhatsApp, iMessage, Instagram, or TikTok after creating your pod 💬
                </Text>
              </View>
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
      </KeyboardAvoidingView>
      
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
                  Share your pod with people who are good at the style you're wearing. Your pod will be shown to users whose style expertise matches your outfit's tags, colors, and category. This helps you get feedback from the right audience who understand your style choice.
                </Text>
                <Text style={[styles.helpSectionText, { marginTop: 8 }]}>
                  For example: If you post a Japanese streetwear outfit, it will be shown to people who are good at Japanese streetwear. If you post a minimalist casual look, it will reach people who are good at minimalist fashion.
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

      {/* Share Modal - After Pod Creation */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowShareModal(false);
          // Navigate after modal closes
          if (createdPodId) {
            onCreatePod && onCreatePod(createdPodId);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎉 Pod is Live!</Text>
              <Pressable onPress={() => {
                setShowShareModal(false);
                if (createdPodId) {
                  onCreatePod && onCreatePod(createdPodId);
                }
              }}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            
            <Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
              Share with friends to get their votes!
            </Text>
            
            {/* Share Buttons */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              {/* WhatsApp */}
              <Pressable 
                onPress={handleShareWhatsApp}
                style={{ alignItems: 'center', width: 70 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome5 name="whatsapp" size={28} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center' }}>WhatsApp</Text>
              </Pressable>
              
              {/* iMessage/SMS */}
              <Pressable 
                onPress={handleShareSMS}
                style={{ alignItems: 'center', width: 70 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="chatbubble" size={26} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center' }}>iMessage</Text>
              </Pressable>
              
              {/* Instagram - Matching real app icon gradient */}
              <Pressable 
                onPress={handleShareInstagram}
                style={{ alignItems: 'center', width: 70 }}
              >
                <LinearGradient
                  colors={['#405DE6', '#833AB4', '#C13584', '#E1306C', '#FD1D1D', '#F56040', '#F77737', '#FCAF45', '#FFDC80']}
                  start={{ x: 0.1, y: 0.9 }}
                  end={{ x: 0.9, y: 0.1 }}
                  style={{ width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                >
                  <FontAwesome5 name="instagram" size={30} color="#fff" />
                </LinearGradient>
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Instagram</Text>
              </Pressable>
              
              {/* TikTok */}
              <Pressable 
                onPress={handleShareTikTok}
                style={{ alignItems: 'center', width: 70 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff' }}>
                  <FontAwesome5 name="tiktok" size={24} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center' }}>TikTok</Text>
              </Pressable>
              
              {/* More */}
              <Pressable 
                onPress={handleNativeShare}
                style={{ alignItems: 'center', width: 70 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="share-outline" size={26} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center' }}>More</Text>
              </Pressable>
            </View>
            
            {/* Copy Link Button */}
            <Pressable 
              onPress={handleCopyLink}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: linkCopied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 10,
                marginBottom: 16
              }}
            >
              <Ionicons name={linkCopied ? "checkmark-circle" : "link"} size={20} color={linkCopied ? "#22c55e" : "#fff"} style={{ marginRight: 8 }} />
              <Text style={{ color: linkCopied ? '#22c55e' : '#fff', fontSize: 14 }}>{linkCopied ? 'Link Copied ✓' : 'Copy Link'}</Text>
            </Pressable>
            
            {/* Done Button */}
            <Pressable 
              onPress={() => {
                setShowShareModal(false);
                if (createdPodId) {
                  onCreatePod && onCreatePod(createdPodId);
                }
              }}
              style={{ 
                backgroundColor: Colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      {/* Tag Picker Modal */}
      <Modal visible={showTagPickerModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' }}>
              <Pressable onPress={() => setShowTagPickerModal(false)}>
                <Text style={{ color: '#9ca3af', fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Select Tags</Text>
              <Pressable onPress={() => setShowTagPickerModal(false)}>
                <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            
            {/* Search */}
            <View style={{ padding: 16 }}>
              <TextInput
                style={{ backgroundColor: '#1f2937', color: '#fff', padding: 12, borderRadius: 8 }}
                value={tagSearchQuery}
                onChangeText={setTagSearchQuery}
                placeholder="Search tags..."
                placeholderTextColor="#666"
              />
            </View>
            
            {/* Selected Tags */}
            {selectedStyleTags.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Selected ({selectedStyleTags.length})</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedStyleTags.map((tag, idx) => (
                    <Pressable
                      key={idx}
                      style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => setSelectedStyleTags(prev => prev.filter(t => t !== tag))}
                    >
                      <Text style={{ color: '#fff', fontSize: 13 }}>{tag}</Text>
                      <Text style={{ color: '#fff', fontSize: 16 }}>×</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {Object.entries(SELECTABLE_TAGS).map(([category, tags]) => {
                const filteredTags = tagSearchQuery 
                  ? tags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                  : tags;
                
                if (filteredTags.length === 0) return null;
                
                return (
                  <View key={category} style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {filteredTags.map((tag) => {
                        const isSelected = selectedStyleTags.includes(tag);
                        return (
                          <Pressable
                            key={tag}
                            style={{
                              backgroundColor: isSelected ? Colors.primary : '#1f2937',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: isSelected ? Colors.primary : '#444',
                            }}
                            onPress={() => {
                              if (isSelected) {
                                setSelectedStyleTags(prev => prev.filter(t => t !== tag));
                              } else {
                                setSelectedStyleTags(prev => [...prev, tag]);
                              }
                            }}
                          >
                            <Text style={{ color: isSelected ? '#fff' : '#ccc', fontSize: 13 }}>{tag}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </SafeAreaView>
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
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customDurationToggle: {
    padding: 4,
  },
  customDurationToggleText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedDurationBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedDurationBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  customDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customDurationInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    minWidth: 100,
    justifyContent: 'center',
    gap: 6,
  },
  unitSelectorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  unitSelectorArrow: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.7,
  },
  selectedDurationContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(99,102,241,0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    alignSelf: 'flex-start',
  },
  selectedDurationText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  applyDurationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  applyDurationBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 99999,
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
  contactList: {
    maxHeight: 400,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactPhone: {
    color: '#9ca3af',
    fontSize: 14,
  },
  contactArrow: {
    color: '#9ca3af',
    fontSize: 18,
    marginLeft: 8,
  },
  styleTwinsInfoContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  styleTwinsHelpTitle: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  styleTwinsHelpText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  tagsContainer: {
    marginTop: 8,
  },
  tagGroup: {
    marginBottom: 12,
  },
  tagGroupLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  tagChipText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  noTagsText: {
    color: '#9ca3af',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  manualTagInputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.2)',
  },
  manualTagInputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualTagInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  manualTagInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  addTagButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  addTagButtonDisabled: {
    opacity: 0.5,
  },
  addTagButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  tagRemoveBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  tagRemoveText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '700',
  },
  noTagsHint: {
    color: '#9ca3af',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  tagSuggestions: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.2)',
  },
  tagSuggestionsLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  tagSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagSuggestionChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  tagSuggestionChipSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
    borderColor: '#6366f1',
  },
  tagSuggestionText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  tagSuggestionTextSelected: {
    color: '#fff',
  },
});

export default PodsScreen;
