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
  Modal,
  Switch,
  Alert,
  Share,
  InteractionManager,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../lib/AppContext';
import { Colors, Typography, Spacing, BorderRadius, CardStyles, TextStyles } from '../lib/designSystem';
import { getUserActivePods, getUserPastPods, deletePod } from '../lib/pods';
import { uploadImageAsync } from '../lib/upload';
import { supabase } from '../lib/supabase';
import { getUserFriends } from '../lib/friends';
import { buildShareUrl } from '../lib/share';
import { getStyleProfile, refreshStyleProfile } from '../lib/styleEngine';
import { loadColorProfile, saveColorProfile, getAllSeasons, getSeasonSwatches, analyzeFaceForColorProfile } from '../lib/colorAnalysis';
import PhotoGuidelinesModal from '../components/PhotoGuidelinesModal';
import PhotoGuidelinesScreen from '../components/PhotoGuidelinesScreen';

// Safe Image Component to prevent crashes
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

// Helper to parse image URI from potential JSON string
const getValidImageUri = (imageField) => {
  if (!imageField) return null;
  if (typeof imageField !== 'string') return null;
  
  try {
    // Check if it looks like a JSON array
    if (imageField.trim().startsWith('[')) {
      const parsed = JSON.parse(imageField);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return { uri: parsed[0] };
      }
    }
  } catch (e) {
    // Not JSON, continue
  }
  
  // Return as is if it's a normal string
  return { uri: imageField };
};

const { width } = Dimensions.get('window');

const StyleVaultScreen = () => {
  const appContext = useApp();
  const { state, setRoute, setProcessingResult, setSavedFits, setUser, setBannerMessage, setBannerType, setCurrentProduct, setTwinUrl, setTryOnHistory } = appContext;
  const { user, tryOnHistory, twinUrl, savedFits } = state;

  // Guard: If no user, don't render anything (prevents crashes on sign out)
  if (!user) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }
  const insets = useSafeAreaInsets();
  
  // State
  const [username, setUsername] = useState(user?.name || 'Fashionista');
  const [profilePic, setProfilePic] = useState(user?.avatar_url || null);
  const [bodyImage, setBodyImage] = useState(user?.body_image_url || twinUrl || null);
  const [faceImage, setFaceImage] = useState(user?.face_image_url || null);
  const [colorProfile, setColorProfile] = useState(null);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const localSavedFits = savedFits || [];
  const [boards, setBoards] = useState([]);
  const [activePods, setActivePods] = useState([]);
  const [pastPods, setPastPods] = useState([]);
  const [tryOnVisibilities, setTryOnVisibilities] = useState({}); // { tryOnId: 'private' | 'friends' | 'public' }
  const [podVisibilities, setPodVisibilities] = useState({}); // { podId: 'private' | 'friends' | 'public' }
  const [friends, setFriends] = useState([]);
  const [showFriends, setShowFriends] = useState(false);
  // Default visibility for new items
  const [tryOnVisibility, setTryOnVisibility] = useState('private');
  const [podsVisibility, setPodsVisibility] = useState('private');
  const [fitProfile, setFitProfile] = useState({
    height: '',
    weight: '',
    gender: '', // Added gender
    topSize: '',
    bottomSize: '',
    shoeSize: '',
    chest: '',
    underbust: '',
    waist: '',
    hips: '',
    shoulder: '',
    sleeve: '',
    inseam: '',
    thigh: '',
    neck: '',
    braSize: '',
    notes: '',
    bodyShape: '' // Body shape (Hourglass, Pear, Apple, Rectangle, Inverted Triangle)
  });
  const [isBodyShapeManuallySet, setIsBodyShapeManuallySet] = useState(false); // Track if user manually set body shape
  const [showFitProfile, setShowFitProfile] = useState(false);
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false);
  const [styleStatsUnlocked, setStyleStatsUnlocked] = useState(false);
  // For showing dropdown picker
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(null); // { type: 'tryon' | 'pod', id: string }
  const [styleProfile, setStyleProfile] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null); // Added for saved fits
  const [showBodyPhotoGuidelines, setShowBodyPhotoGuidelines] = useState(false);
  const [showFacePhotoGuidelines, setShowFacePhotoGuidelines] = useState(false);
  const [showBodyMeasurements, setShowBodyMeasurements] = useState(false); // Collapsible body measurements section
  const [showPhotoGuidelinesScreen, setShowPhotoGuidelinesScreen] = useState(false); // Support section guidelines

  // Generate style summary for Identity section
  const getStyleSummary = () => {
    const parts = [];
    
    // Color season (e.g., "Warm autumn")
    if (colorProfile?.description) {
      parts.push(colorProfile.description);
    }
    
    // Top categories (e.g., "Dress & upper-wear focused")
    if (styleProfile?.categories && styleProfile.categories.length > 0) {
      const categoryNames = styleProfile.categories.slice(0, 2).map(c => {
        // Convert category to readable format
        if (c === 'dress' || c === 'dresses') return 'Dress';
        if (c === 'upper' || c === 'upper_body') return 'Upper-wear';
        if (c === 'lower' || c === 'lower_body') return 'Lower-wear';
        return c.charAt(0).toUpperCase() + c.slice(1);
      });
      if (categoryNames.length > 0) {
        parts.push(categoryNames.join(' & ') + ' focused');
      }
    }
    
    // Top tags (e.g., "Clean silhouettes")
    if (styleProfile?.tags && styleProfile.tags.length > 0) {
      const tag = styleProfile.tags[0];
      const readableTag = tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      parts.push(readableTag);
    }
    
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  // Body shape prediction function
  const predictBodyShape = (profile) => {
    const chest = parseFloat(profile.chest) || 0;
    const waist = parseFloat(profile.waist) || 0;
    const hips = parseFloat(profile.hips) || 0;
    const shoulder = parseFloat(profile.shoulder) || 0;
    
    // Need at least waist and hips for prediction
    if (!waist || !hips) return null;
    
    const waistToHipRatio = waist / hips;
    const chestToHipRatio = chest / hips;
    const shoulderToHipRatio = shoulder / hips;
    
    // Hourglass: waist is significantly smaller than both chest and hips
    if (waistToHipRatio < 0.75 && chestToHipRatio > 0.9 && chestToHipRatio < 1.1) {
      return 'Hourglass';
    }
    
    // Pear: hips are larger than chest and shoulders
    if (hips > chest && (shoulderToHipRatio < 0.9 || !shoulder)) {
      return 'Pear';
    }
    
    // Apple: waist is close to or larger than chest/hips
    if (waistToHipRatio > 0.85 && waist >= chest * 0.95) {
      return 'Apple';
    }
    
    // Inverted Triangle: shoulders/chest are larger than hips
    if (shoulderToHipRatio > 1.1 || (chest > hips && chestToHipRatio > 1.1)) {
      return 'Inverted Triangle';
    }
    
    // Rectangle: relatively straight proportions
    if (waistToHipRatio > 0.75 && waistToHipRatio < 0.85) {
      return 'Rectangle';
    }
    
    // Default to Rectangle if we can't determine
    return 'Rectangle';
  };

  // Auto-predict body shape when measurements change (only if not manually set)
  useEffect(() => {
    if (!isBodyShapeManuallySet && fitProfile.waist && fitProfile.hips) {
      const predicted = predictBodyShape(fitProfile);
      if (predicted && predicted !== fitProfile.bodyShape) {
        setFitProfile(prev => ({ ...prev, bodyShape: predicted }));
      }
    }
  }, [fitProfile.chest, fitProfile.waist, fitProfile.hips, fitProfile.shoulder, isBodyShapeManuallySet]);

  // Helper function to show banner notifications
  const showBanner = (message, type = 'success') => {
    if (setBannerMessage && setBannerType) {
      setBannerMessage(message);
      setBannerType(type);
      setTimeout(() => {
        setBannerMessage(null);
        setBannerType(null);
      }, 3000);
    }
  };
  
  // Set visibility for try-on (with Supabase save)
  const setTryOnItemVisibility = async (tryOnId, newVisibility) => {
    setTryOnVisibilities(prev => ({ ...prev, [tryOnId]: newVisibility }));
    setShowPrivacyPicker(null);
    
    // Save to Supabase
    try {
      await supabase
        .from('try_on_history')
        .update({ visibility: newVisibility })
        .eq('id', tryOnId);
    } catch (error) {
      console.log('Error saving try-on visibility:', error);
    }
  };
  
  // Set visibility for pod (with Supabase save)
  const setPodItemVisibility = async (podId, newVisibility) => {
    setPodVisibilities(prev => ({ ...prev, [podId]: newVisibility }));
    setShowPrivacyPicker(null);
    
    // Save to Supabase
    try {
      await supabase
        .from('pods')
        .update({ visibility: newVisibility })
        .eq('id', podId);
    } catch (error) {
      console.log('Error saving pod visibility:', error);
    }
  };
  
  const getVisibilityIcon = (visibility) => {
    if (visibility === 'public') return '🌐';
    if (visibility === 'friends') return '👥';
    return '🔒';
  };
  
  const getVisibilityLabel = (visibility) => {
    if (visibility === 'public') return 'Public';
    if (visibility === 'friends') return 'Friends';
    return 'Only me';
  };
  
  // Privacy dropdown component
  const PrivacyDropdown = ({ itemId, itemType, currentVisibility }) => {
    const options = [
      { value: 'private', label: 'Only me', icon: '🔒' },
      { value: 'friends', label: 'Friends', icon: '👥' },
      { value: 'public', label: 'Public', icon: '🌐' },
    ];
    
    return (
      <View style={styles.privacyDropdown}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.privacyDropdownItem,
              currentVisibility === opt.value && styles.privacyDropdownItemActive
            ]}
            onPress={() => {
              if (itemType === 'tryon') {
                setTryOnItemVisibility(itemId, opt.value);
              } else {
                setPodItemVisibility(itemId, opt.value);
              }
            }}
          >
            <Text style={styles.privacyDropdownIcon}>{opt.icon}</Text>
            <Text style={[
              styles.privacyDropdownText,
              currentVisibility === opt.value && styles.privacyDropdownTextActive
            ]}>{opt.label}</Text>
            {currentVisibility === opt.value && (
              <Text style={styles.privacyDropdownCheck}>✓</Text>
            )}
          </Pressable>
        ))}
      </View>
    );
  };
  
  // Load all user data from Supabase on mount
  useEffect(() => {
    if (user?.id) {
      loadProfileData();
      loadTryOnHistory();
      loadSavedFits();
      loadFriends();
      loadStyleProfile();
      loadUserColorProfile();
    }
  }, [user?.id]);

  // Handler for body photo upload after guidelines
  const handleBodyPhotoUpload = async () => {
    console.log('📸 handleBodyPhotoUpload START');
    // Don't close modal yet - open ImagePicker first
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8
    });
    console.log('📸 ImagePicker returned:', res.canceled ? 'CANCELLED' : 'SELECTED');
    // Now close the modal
    setShowBodyPhotoGuidelines(false);
    
    if (!res.canceled && res.assets && res.assets[0]) {
      try {
        console.log('📸 Uploading image...');
        const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
        console.log('📸 Uploaded URL:', uploadedUrl);
        if (user?.id) {
           await supabase.from('profiles').update({ body_image_url: uploadedUrl }).eq('id', user.id);
        }
        setBodyImage(uploadedUrl);
        if (setUser) setUser(prev => ({ ...prev, body_image_url: uploadedUrl }));
        if (setTwinUrl) setTwinUrl(uploadedUrl);
        showBanner('✓ Body photo saved!', 'success');
      } catch (error) {
        console.error('❌ Error saving body photo:', error);
        showBanner('Failed to upload photo', 'error');
      }
    } else {
      console.log('📸 No image selected or cancelled');
    }
  };

  // Handler for face photo upload after guidelines
  const handleFacePhotoSource = () => {
    setShowFacePhotoGuidelines(false);
    Alert.alert(
      'Add Face Photo',
      'How would you like to add your photo?',
      [
        {
          text: 'Take Selfie',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (permission.granted) {
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                cameraType: ImagePicker.CameraType.front
              });
              if (!res.canceled && res.assets[0]) {
                try {
                  const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
                  if (user?.id) {
                    await supabase.from('profiles').update({ face_image_url: uploadedUrl }).eq('id', user.id);
                  }
                  setFaceImage(uploadedUrl);
                  if (setUser) setUser(prev => ({ ...prev, face_image_url: uploadedUrl }));
                  // Analyze for color profile
                  const profile = await analyzeFaceForColorProfile(uploadedUrl);
                  if (profile && user?.id) {
                    await saveColorProfile(user.id, profile);
                    setColorProfile(profile);
                    showBanner('✓ Face photo saved & colors analyzed!', 'success');
                  } else {
                    showBanner('✓ Face photo saved!', 'success');
                  }
                } catch (error) {
                  console.error('Error saving face photo:', error);
                  Alert.alert('Error', 'Failed to save photo');
                }
              }
            } else {
              Alert.alert('Camera Permission', 'Please allow camera access to take a selfie.');
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const res = await ImagePicker.launchImageLibraryAsync({ 
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8
            });
            if (!res.canceled && res.assets[0]) {
              try {
                const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
                if (user?.id) {
                  await supabase.from('profiles').update({ face_image_url: uploadedUrl }).eq('id', user.id);
                }
                setFaceImage(uploadedUrl);
                if (setUser) setUser(prev => ({ ...prev, face_image_url: uploadedUrl }));
                // Analyze for color profile
                const profile = await analyzeFaceForColorProfile(uploadedUrl);
                if (profile && user?.id) {
                  await saveColorProfile(user.id, profile);
                  setColorProfile(profile);
                  showBanner('✓ Face photo saved & colors analyzed!', 'success');
                } else {
                  showBanner('✓ Face photo saved!', 'success');
                }
              } catch (error) {
                console.error('Error saving face photo:', error);
                Alert.alert('Error', 'Failed to save photo');
              }
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const loadUserColorProfile = async () => {
    if (!user?.id) return;
    const profile = await loadColorProfile(user.id);
    if (profile) {
      setColorProfile(profile);
    }
  };

  const loadStyleProfile = async () => {
    if (!user?.id) return;
    // 1. Try to calculate latest profile first
    await refreshStyleProfile(user.id);
    
    // 2. Then fetch it
    const profile = await getStyleProfile(user.id);
    if (profile) {
        setStyleProfile(profile);
        // Unlock stats if we have a profile with tags
        if (profile.tags && profile.tags.length > 0) {
            setStyleStatsUnlocked(true);
        }
    }
  };

  const loadFriends = async () => {
    if (!user?.id) return;
    try {
      const friendsList = await getUserFriends(user.id);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    }
  };

  const loadTryOnHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('try_on_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.log('Error fetching try-on history:', error.message);
        return;
      }

      if (data && data.length > 0) {
        console.log('Loaded', data.length, 'try-ons from Supabase');
        // Filter valid items
        const validData = data.filter(item => 
            (item.result_url || item.resultUrl) && typeof (item.result_url || item.resultUrl) === 'string'
        );
        
        // Update global try-on history
        if (setTryOnHistory) {
          setTryOnHistory(validData.map(item => ({
            id: item.id,
            resultUrl: item.result_url || item.resultUrl, // Preserve URL
            productName: item.product_name || item.productName,
            productImage: item.product_image || item.productImage, // Preserve image URL
            productUrl: item.product_url || item.productUrl,
            image: item.product_image || item.image, // Also store in image field
            createdAt: item.created_at || item.createdAt
          })));
        }
        // Update visibility states
        const visibilities = {};
        validData.forEach(item => {
          visibilities[item.id] = item.visibility || 'private';
        });
        setTryOnVisibilities(visibilities);
      } else {
        console.log('No try-on history found in Supabase');
      }
    } catch (error) {
      console.log('Error loading try-on history:', error);
    }
  };

  const loadSavedFits = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_fits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        // Table might not exist - don't overwrite local data
        console.log('Error fetching saved fits (table may not exist):', error.message);
        return;
      }
      
      // Only update if we got data back
      if (data && data.length > 0 && setSavedFits) {
        console.log('Loaded', data.length, 'saved fits from Supabase');
        // Filter valid items
        const validData = data.filter(item => 
            (item.image_url || item.image) && typeof (item.image_url || item.image) === 'string'
        );
        
        setSavedFits(validData.map(item => ({
          id: item.id,
          image: item.image_url || item.image, // Preserve image URL
          title: item.title,
          price: item.price,
          product_url: item.product_url,
          product_data: item.product_data, // Include full product data
          visibility: item.visibility || 'private',
          createdAt: item.created_at || item.createdAt
        })));
      } else {
        console.log('No saved fits found in Supabase');
      }
    } catch (error) {
      console.log('Error loading saved fits:', error);
    }
  };

  const handleDeleteTryOn = (item) => {
    Alert.alert(
      "Delete Try-On",
      "Are you sure you want to delete this try-on?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            const prevHistory = tryOnHistory;
            if(setTryOnHistory) setTryOnHistory(current => current.filter(t => t.id !== item.id));
            
            const { error } = await supabase.from('try_on_history').delete().eq('id', item.id);
            if (error) {
               console.error('Delete error:', error);
               if(setTryOnHistory) setTryOnHistory(prevHistory);
               showBanner('Failed to delete', 'error');
            } else {
               showBanner('Deleted', 'success');
            }
          }
        }
      ]
    );
  };

  const handleDeleteSavedFit = (item) => {
    Alert.alert(
      "Unsave Outfit",
      "Are you sure you want to remove this from saved fits?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
             const prevFits = savedFits;
             if(setSavedFits) setSavedFits(current => current.filter(f => f.id !== item.id));

             const { error } = await supabase.from('saved_fits').delete().eq('id', item.id);
             if (error) {
                 if(setSavedFits) setSavedFits(prevFits);
                 showBanner('Failed to remove', 'error');
             } else {
                 showBanner('Removed', 'success');
             }
          }
        }
      ]
    );
  };

  const handleDeletePod = (item) => {
    Alert.alert(
        "Delete Pod",
        "Are you sure you want to delete this pod? This cannot be undone.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    console.log('🗑️ Deleting pod from StyleVault:', item.id);
                    
                    // Optimistic update
                    setActivePods(prev => prev.filter(p => p.id !== item.id));
                    setPastPods(prev => prev.filter(p => p.id !== item.id));
                    
                    try {
                        // Use the deletePod function from lib/pods.ts
                        const success = await deletePod(item.id);
                        
                        if (success) {
                            console.log('✅ Pod deleted successfully');
                            showBanner('Pod deleted', 'success');
                        } else {
                            console.error('❌ Delete returned false');
                            showBanner('Failed to delete pod', 'error');
                        }
                        
                        // Force refresh to sync with database
                        setTimeout(() => loadPods(), 500);
                    } catch (err) {
                        console.error('❌ Error deleting pod:', err);
                        showBanner('Failed to delete pod', 'error');
                        loadPods(); // Reload on error
                    }
                }
            }
        ]
    );
  };

  const loadProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data && !error) {
        const loadedName = data.name || 'Fashionista';
        const loadedAvatar = data.avatar_url || null;
        const loadedBodyImage = data.body_image_url || null;
        const loadedFaceImage = data.face_image_url || null;
        
        setUsername(loadedName);
        setProfilePic(loadedAvatar);
        setBodyImage(loadedBodyImage);
        setFaceImage(loadedFaceImage);
        
        setFitProfile({
          height: data.height || '',
          weight: data.weight || '',
          gender: data.gender || '', // Load gender
          topSize: data.top_size || '',
          bottomSize: data.bottom_size || '',
          shoeSize: data.shoe_size || '',
          chest: data.chest || '',
          underbust: data.underbust || '',
          waist: data.waist || '',
          hips: data.hips || '',
          shoulder: data.shoulder || '',
          sleeve: data.sleeve || '',
          inseam: data.inseam || '',
          thigh: data.thigh || '',
          neck: data.neck || '',
          braSize: data.bra_size || '',
          notes: data.notes || '',
          bodyShape: data.body_shape || '' // Load body_shape
        });
        
        // If body_shape exists in DB, mark it as manually set (user may have set it before)
        if (data.body_shape) {
          setIsBodyShapeManuallySet(true);
        }
        
        // Update global user state so it persists
        if (setUser) {
          setUser(prev => ({ 
            ...prev, 
            name: loadedName, 
            avatar_url: loadedAvatar, 
            body_image_url: loadedBodyImage,
            face_image_url: loadedFaceImage
          }));
        }
        
        // Sync twinUrl if it's empty
        if (loadedBodyImage && !twinUrl && setTwinUrl) {
            setTwinUrl(loadedBodyImage);
        }
      }
    } catch (error) {
      console.log('Error loading profile:', error);
    }
  };
  
  // Check if style stats should be unlocked
  useEffect(() => {
    const hasBodyPhoto = !!twinUrl;
    const hasSizes = fitProfile.height && fitProfile.topSize;
    const hasData = tryOnHistory.length > 0 || savedFits.length > 0;
    const hasTags = styleProfile?.tags?.length > 0;
    
    // Unlock if we have explicit style tags OR enough data to generate them
    // We relax the photo/size requirement for just seeing style stats
    if (hasTags || hasData) {
        setStyleStatsUnlocked(true);
    } else {
        setStyleStatsUnlocked(false);
    }
  }, [twinUrl, fitProfile, tryOnHistory, savedFits, styleProfile]);

  // Load pods
  useEffect(() => {
    if (user?.id) {
      loadPods();
    }
  }, [user?.id]);

  const loadPods = async () => {
    if (!user?.id) return;
    try {
      const [active, past] = await Promise.all([
        getUserActivePods(user.id),
        getUserPastPods(user.id)
      ]);
      
      // Filter active pods to only show actually live ones (not expired)
      const now = new Date().getTime();
      const trulyActive = (active || []).filter(p => 
        p.status === 'live' && new Date(p.ends_at).getTime() > now
      );
      const expiredFromActive = (active || []).filter(p => 
        p.status !== 'live' || new Date(p.ends_at).getTime() <= now
      );
      
      setActivePods(trulyActive);
      setPastPods([...expiredFromActive, ...(past || [])]);
    } catch (error) {
      console.error('Error loading pods:', error);
    }
  };

  const toggleFitVisibility = (fitId) => {
    setSavedFits(prev => prev.map(fit => 
      fit.id === fitId ? { ...fit, visibility: fit.visibility === 'public' ? 'private' : 'public' } : fit
    ));
  };

  const SavedFitCard = ({ fit }) => {
    const imageSource = fit.image && typeof fit.image === 'string' ? { uri: fit.image } : null;
    
    // Handle navigation to product detail
    const handlePress = () => {
      // If product_data exists, navigate to product detail
      if (fit.product_data || fit.product_url) {
        const productData = fit.product_data || {
          name: fit.title,
          image: fit.image,
          imageUrl: fit.image,
          images: fit.image ? [fit.image] : [],
          url: fit.product_url,
          buyUrl: fit.product_url,
          productUrl: fit.product_url,
          price: fit.price,
          brand: fit.product_data?.brand,
          category: fit.product_data?.category,
          color: fit.product_data?.color,
          fabric: fit.product_data?.fabric,
          description: fit.product_data?.description
        };
        
        if (setCurrentProduct) {
          setCurrentProduct(productData);
        }
        setRoute('product');
      } else {
        // Otherwise, show full screen image
        setFullScreenImage(fit.image);
      }
    };
    
    return (
    <Pressable 
        style={styles.fitCard}
        onPress={handlePress}
        onLongPress={() => handleDeleteSavedFit(fit)}
    >
      <SafeImage source={imageSource} style={styles.fitImage} resizeMode="cover" />
      <View style={styles.fitInfo}>
        <Text style={styles.fitTitle} numberOfLines={1}>{fit.title}</Text>
        {fit.price && <Text style={styles.fitPrice}>${fit.price}</Text>}
        <View style={styles.fitActions}>
          <Pressable 
            style={[styles.visibilityBtn, fit.visibility === 'public' && styles.visibilityBtnActive]}
            onPress={(e) => {
                e.stopPropagation();
                toggleFitVisibility(fit.id);
            }}
          >
            <Text style={styles.visibilityText}>{fit.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  )};

  const BoardCard = ({ board }) => {
    const imageSource = board.coverImage && typeof board.coverImage === 'string' ? { uri: board.coverImage } : { uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400' };
    return (
    <Pressable style={styles.boardCard}>
      <SafeImage source={imageSource} style={styles.boardImage} resizeMode="cover" />
      <View style={styles.boardOverlay}>
        <Text style={styles.boardTitle}>{board.name}</Text>
        <Text style={styles.boardCount}>{board.fitCount} fits</Text>
        <View style={styles.boardVisibility}>
          <Text style={styles.boardVisibilityText}>{board.visibility === 'public' ? '🌐' : '🔒'}</Text>
        </View>
      </View>
    </Pressable>
  )};

  const PodCard = ({ pod }) => {
    const isActuallyLive = pod.status === 'live' && new Date(pod.ends_at) > new Date();
    const visibility = podVisibilities[pod.id] || pod.visibility || 'private';
    const imageSource = getValidImageUri(pod.image_url);
    
    return (
      <Pressable 
        style={styles.podCard}
        onLongPress={() => handleDeletePod(pod)}
        onPress={() => {
          if (isActuallyLive) {
            setRoute('podlive', { id: pod.id });
          } else {
            setRoute('podrecap', { id: pod.id });
          }
        }}
      >
        <SafeImage source={imageSource} style={styles.podImage} resizeMode="cover" />
        <View style={styles.podInfo}>
          <Text style={styles.podTitle} numberOfLines={1}>{pod.title}</Text>
          <Text style={styles.podMode}>{pod.audience === 'friends' ? '👥 Friends' : pod.audience === 'style_twins' ? '🧬 Twins' : '🌍 Global'}</Text>
          <Text style={[styles.podStatus, !isActuallyLive && { color: '#ef4444' }]}>
            {isActuallyLive ? '🟢 Live' : '🔴 Ended'}
          </Text>
          {/* Privacy toggle - only for ended pods */}
          {!isActuallyLive && (
            <View>
              <Pressable 
                style={styles.podPrivacyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowPrivacyPicker({ type: 'pod', id: pod.id });
                }}
              >
                <Text style={styles.podPrivacyText}>
                  {getVisibilityIcon(visibility)} {getVisibilityLabel(visibility)} ▼
                </Text>
              </Pressable>
              {/* Privacy Dropdown */}
              {showPrivacyPicker?.type === 'pod' && showPrivacyPicker?.id === pod.id && (
                <PrivacyDropdown 
                  itemId={pod.id} 
                  itemType="pod" 
                  currentVisibility={visibility} 
                />
              )}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }} />
            <Pressable 
              onPress={() => setIsEditingProfile(!isEditingProfile)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>

          <Pressable 
            style={styles.avatarContainer}
            onPress={async () => {
              if (!isEditingProfile) return;
              const res = await ImagePicker.launchImageLibraryAsync({ 
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8
              });
              if (!res.canceled && res.assets[0]) {
                try {
                  const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
                  setProfilePic(uploadedUrl);
                } catch (error) {
                  Alert.alert('Error', 'Failed to upload profile picture');
                }
              }
            }}
            disabled={!isEditingProfile}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6', '#ec4899']}
              style={styles.avatarGradient}
            >
              <View style={styles.avatar}>
                {profilePic && typeof profilePic === 'string' ? (
                  <SafeImage source={{ uri: profilePic }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>{username ? username[0].toUpperCase() : 'U'}</Text>
                )}
              </View>
            </LinearGradient>
            {isEditingProfile && (
              <View style={styles.editPhotoBadge}>
                <Text style={styles.editPhotoText}>📷</Text>
              </View>
            )}
          </Pressable>
          
          {isEditingProfile ? (
            <TextInput
              style={styles.nameInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Your name"
              placeholderTextColor="#666"
              autoFocus
            />
          ) : (
            <Text style={styles.greeting}>Hey, {username} 👋</Text>
          )}
          <Text style={styles.subtitle}>You're trending this week!</Text>
          {user?.email && (
            <Text style={[styles.subtitle, { fontSize: 12, marginTop: 4 }]}>{user.email}</Text>
          )}
          {user?.phone && !user?.email && (
            <Text style={[styles.subtitle, { fontSize: 12, marginTop: 4 }]}>{user.phone}</Text>
          )}
          {!user?.email && !user?.phone && (
            <Pressable 
              onPress={() => setRoute('auth')}
              style={{ marginTop: 8 }}
            >
              <Text style={[styles.subtitle, { fontSize: 12, color: '#6366f1', textDecorationLine: 'underline' }]}>
                Sign in to sync your data
              </Text>
            </Pressable>
          )}
          
          {isEditingProfile && (
            <Pressable 
              onPress={async () => {
                try {
                  setIsEditingProfile(false);
                  
                  if (user?.id) {
                    // Save to Supabase
                    const { error } = await supabase
                      .from('profiles')
                      .upsert({
                        id: user.id,
                        name: username,
                        avatar_url: profilePic,
                        email: user.email,
                        updated_at: new Date().toISOString()
                      });
                      
                    if (error) {
                      console.log('Profile save error:', error);
                      // Still update local state even if remote fails
                    }
                    
                    // Update local user state so it persists in the session
                    if (setUser) {
                      setUser(prev => ({
                        ...prev,
                        name: username,
                        avatar_url: profilePic
                      }));
                    }
                    
                    showBanner('✓ Profile updated!', 'success');
                  }
                } catch (error) {
                  console.error('Error updating profile:', error);
                  showBanner('Profile saved locally', 'success');
                }
              }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </Pressable>
          )}

        </View>

        {/* ============================================
            SECTION 2: YOUR STYLE DNA
            ============================================ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, color: '#6366f1' }]}>Your Style DNA</Text>
          
          {/* Style Stats */}
          <View style={[styles.section, { marginBottom: 20 }]}>
            {!styleStatsUnlocked ? (
              <View style={styles.lockedStatsCard}>
                <Text style={styles.lockedTitle}>Unlock Style Stats</Text>
                <Text style={styles.lockedText}>
                  Interact with products (vote, save, try-on) to build your taste profile.
                </Text>
                <View style={styles.unlockButtons}>
                  <Pressable 
                    style={styles.unlockBtn}
                    onPress={() => setRoute('shop')}
                  >
                    <Text style={styles.unlockBtnText}>🛍️ Go Shopping</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🏷️</Text>
                  <View style={styles.statContent}>
                    <Text style={styles.statTitle}>Top Vibes</Text>
                    <Text style={styles.statValue}>
                      {styleProfile?.tags?.slice(0, 3).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') || 'No tags yet'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🎨</Text>
                  <View style={styles.statContent}>
                    <Text style={styles.statTitle}>Core Colors</Text>
                    <Text style={styles.statValue}>
                      {styleProfile?.colors?.slice(0, 3).join(', ') || 'No colors yet'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🧥</Text>
                  <View style={styles.statContent}>
                    <Text style={styles.statTitle}>Top Categories</Text>
                    <Text style={styles.statValue}>
                      {styleProfile?.categories?.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') || 'No categories yet'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Your Colors */}
          {colorProfile && (
            <View style={[styles.section, { marginBottom: 20 }]}>
              <View style={styles.colorProfileSection}>
                <Text style={styles.colorProfileTitle}>🎨 Your Colors</Text>
                <View style={styles.colorSeasonBadge}>
                  <Text style={styles.colorSeasonText}>{colorProfile.description}</Text>
                </View>
                <View style={styles.colorSwatchRow}>
                  {getSeasonSwatches(colorProfile.season).slice(0, 6).map((color, idx) => (
                    <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                  ))}
                </View>
                <Text style={styles.colorBestLabel}>Colors that love you:</Text>
                <Text style={styles.colorBestList}>{colorProfile.bestColors.slice(0, 4).join(', ')}</Text>
                <Pressable 
                  style={styles.changeSeasonBtn}
                  onPress={() => setShowSeasonPicker(true)}
                >
                  <Text style={styles.changeSeasonText}>Change Season →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Fit Profile / Body Measurements */}
          <View style={styles.section}>
            <Pressable 
              style={styles.sectionHeader}
              onPress={() => setShowBodyMeasurements(!showBodyMeasurements)}
            >
              <Text style={styles.sectionTitle}>Fit Profile</Text>
              <Text style={styles.addButton}>{showBodyMeasurements ? '▼' : '▶'}</Text>
            </Pressable>
            {showBodyMeasurements && (
              <View style={styles.fitProfileCard}>
                {/* Body Photo Section */}
                <View style={styles.photoSection}>
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoLabel}>📸 Body Photo</Text>
                    <Text style={styles.photoHint}>Full body, front view, good lighting. Used for AI try-on.</Text>
                  </View>
                  <View style={styles.photoActions}>
                    <Pressable 
                      style={styles.photoThumb}
                      onPress={() => {
                        setShowBodyPhotoGuidelines(true);
                      }}
                    >
                      {bodyImage ? (
                         <SafeImage source={{ uri: bodyImage }} style={styles.photoThumbImg} resizeMode="cover" />
                      ) : (
                         <View style={styles.photoPlaceholder}>
                             <Text style={{ fontSize: 20, color: '#666' }}>+</Text>
                         </View>
                      )}
                    </Pressable>
                    {bodyImage && (
                      <Pressable 
                        style={styles.removePhotoBtn}
                        onPress={async () => {
                          setBodyImage(null);
                          if (setTwinUrl) setTwinUrl(null);
                          if (user?.id) {
                            await supabase.from('profiles').update({ body_image_url: null }).eq('id', user.id);
                          }
                          showBanner('Photo removed', 'success');
                        }}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Face Photo Section */}
                <View style={styles.photoSection}>
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoLabel}>🎨 Face Photo</Text>
                    <Text style={styles.photoHint}>Clear face, natural light. Used to determine your best colors.</Text>
                  </View>
                  <View style={styles.photoActions}>
                    <Pressable 
                      style={styles.photoThumb}
                      onPress={() => {
                        setShowFacePhotoGuidelines(true);
                      }}
                    >
                      {faceImage ? (
                         <SafeImage source={{ uri: faceImage }} style={styles.photoThumbImg} resizeMode="cover" />
                      ) : (
                         <View style={styles.photoPlaceholder}>
                             <Text style={{ fontSize: 20, color: '#666' }}>+</Text>
                         </View>
                      )}
                    </Pressable>
                    {faceImage && (
                      <Pressable 
                        style={styles.removePhotoBtn}
                        onPress={async () => {
                          setFaceImage(null);
                          if (user?.id) {
                            await supabase.from('profiles').update({ face_image_url: null }).eq('id', user.id);
                          }
                          showBanner('Photo removed', 'success');
                        }}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Body Measurements */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Gender:</Text>
                  <Text style={styles.profileValue}>{fitProfile.gender || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Body Shape:</Text>
                  <Text style={styles.profileValue}>{fitProfile.bodyShape || 'Not set'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Height:</Text>
                  <Text style={styles.profileValue}>{fitProfile.height || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Weight:</Text>
                  <Text style={styles.profileValue}>{fitProfile.weight || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Bust/Chest:</Text>
                  <Text style={styles.profileValue}>{fitProfile.chest || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Waist:</Text>
                  <Text style={styles.profileValue}>{fitProfile.waist || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Hips:</Text>
                  <Text style={styles.profileValue}>{fitProfile.hips || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Top Size:</Text>
                  <Text style={styles.profileValue}>{fitProfile.topSize || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Bottom Size:</Text>
                  <Text style={styles.profileValue}>{fitProfile.bottomSize || 'Not set'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Shoe Size:</Text>
                  <Text style={styles.profileValue}>{fitProfile.shoeSize || 'Not set'}</Text>
                </View>
                <Pressable 
                  style={[styles.saveBtn, { marginTop: 12 }]}
                  onPress={() => setShowFitProfile(true)}
                >
                  <Text style={styles.saveBtnText}>Edit Measurements</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ============================================
            SECTION 3: YOUR WORKSPACE
            ============================================ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, color: '#6366f1' }]}>Your Workspace</Text>
          
          {/* Saved Fits */}
          <View style={[styles.section, { marginBottom: 20 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved Fits</Text>
            </View>
            {localSavedFits.length > 0 ? (
              <FlatList
                data={localSavedFits}
                renderItem={({ item }) => <SavedFitCard fit={item} />}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No saved fits yet</Text>
                <Text style={styles.emptySubtext}>Save products you love to build your style vault</Text>
              </View>
            )}
          </View>

          {/* Try-On History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mood Boards</Text>
            <Pressable onPress={() => Alert.alert('Create Board', 'Mood board creation coming soon!')}>
              <Text style={styles.addButton}>+ Create</Text>
            </Pressable>
          </View>
          {boards.length > 0 ? (
            <FlatList
              data={boards}
              renderItem={({ item }) => <BoardCard board={item} />}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No mood boards yet</Text>
              <Text style={styles.emptySubtext}>Create mood boards to organize your style inspiration</Text>
            </View>
          )}
        </View>

          <View style={[styles.section, { marginBottom: 20 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Try-On History</Text>
            </View>
          {tryOnHistory.length > 0 ? (
            <FlatList
              data={tryOnHistory}
              renderItem={({ item }) => {
                const visibility = tryOnVisibilities[item.id] || 'private';
                return (
                  <Pressable
                    style={styles.tryOnCard}
                    onPress={() => {
                      if (setProcessingResult) {
                        setProcessingResult(item.resultUrl);
                      }
                      const productData = {
                        name: item.productName,
                        image: item.productImage || item.image,
                        url: item.productUrl,
                        link: item.productUrl
                      };
                      if (setCurrentProduct) {
                        setCurrentProduct(productData);
                      }
                      // Pass product data explicitly via route params to ensure thumbnail shows
                      setRoute('tryonresult', { product: productData });
                    }}
                    onLongPress={() => handleDeleteTryOn(item)}
                  >
                    <SafeImage source={{ uri: item.resultUrl }} style={styles.tryOnImage} resizeMode="cover" />
                    
                    <View style={styles.tryOnOverlay}>
                      {/* Privacy Toggle */}
                      <Pressable 
                        style={styles.privacyBadge}
                        onPress={(e) => {
                          e.stopPropagation();
                          // Ensure we use the correct state setter for visibility picker
                          // This needs to be outside the list to avoid z-index issues if possible, 
                          // but for now let's just make sure it sets the state.
                          console.log('Opening privacy picker for tryon:', item.id);
                          setShowPrivacyPicker({ type: 'tryon', id: item.id });
                        }}
                      >
                        <Text style={styles.privacyBadgeText}>
                          {getVisibilityIcon(visibility)} {getVisibilityLabel(visibility)} ▼
                        </Text>
                      </Pressable>
                      
                      {/* Privacy Dropdown */}
                      {showPrivacyPicker?.type === 'tryon' && showPrivacyPicker?.id === item.id && (
                        <PrivacyDropdown 
                          itemId={item.id} 
                          itemType="tryon" 
                          currentVisibility={visibility} 
                        />
                      )}
                      
                      {/* Product Thumbnail - Always show if available */}
                      {(item.productImage || item.image) && (
                        <Pressable
                          style={styles.tryOnProductThumb}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (setCurrentProduct) {
                              setCurrentProduct({
                                name: item.productName,
                                image: item.productImage || item.image,
                                url: item.productUrl,
                                link: item.productUrl
                              });
                              setRoute('product', { product: {
                                name: item.productName,
                                image: item.productImage || item.image,
                                url: item.productUrl,
                                link: item.productUrl
                              }});
                            }
                          }}
                        >
                          <SafeImage 
                            source={{ uri: item.productImage || item.image }} 
                            style={styles.tryOnProductThumbImg} 
                            resizeMode="cover" 
                          />
                          <View style={styles.tryOnProductThumbBadge}>
                            <Text style={styles.tryOnProductThumbText}>Original</Text>
                          </View>
                        </Pressable>
                      )}
                      
                      <Text style={styles.tryOnProductName}>{item.productName}</Text>
                      
                      <View style={styles.tryOnActions}>
                        <Pressable 
                          style={styles.tryOnActionBtn}
                          onPress={async () => {
                            // Check if already saved
                            const isAlreadySaved = savedFits && savedFits.some(fit => fit.image === item.resultUrl);
                            if (isAlreadySaved) {
                              showBanner('✓ Already saved!', 'success');
                              return;
                            }
                            
                            if (user?.id) {
                              // Check Supabase for duplicates
                              const { data: existing } = await supabase
                                .from('saved_fits')
                                .select('id')
                                .eq('user_id', user.id)
                                .eq('image_url', item.resultUrl)
                                .limit(1);
                              
                              if (existing && existing.length > 0) {
                                showBanner('✓ Already saved!', 'success');
                                return;
                              }
                              
                              // Save to Supabase
                              const { data, error } = await supabase
                                .from('saved_fits')
                                .insert({
                                  user_id: user.id,
                                  image_url: item.resultUrl,
                                  title: item.productName || 'Try-On Result',
                                  product_url: item.productUrl || null,
                                  visibility: visibility || 'private'
                                })
                                .select()
                                .single();
                              
                              if (error) {
                                console.error('Error saving:', error);
                                showBanner('Failed to save', 'error');
                                return;
                              }
                              
                              if (setSavedFits && data) {
                                setSavedFits((prev) => [{
                                  id: data.id,
                                  image: data.image_url,
                                  title: data.title,
                                  price: data.price,
                                  visibility: data.visibility,
                                  createdAt: data.created_at
                                }, ...(prev || [])]);
                                showBanner('✓ Outfit saved!', 'success');
                              }
                            } else if (setSavedFits) {
                              const newFit = {
                                id: Date.now().toString(),
                                image: item.resultUrl,
                                title: item.productName || 'Try-On Result',
                                price: null,
                                visibility: visibility,
                                createdAt: new Date().toISOString()
                              };
                              setSavedFits((prev) => [newFit, ...(prev || [])]);
                              showBanner('✓ Outfit saved!', 'success');
                            } else {
                              showBanner('Unable to save outfit', 'error');
                            }
                          }}
                        >
                          <Text style={styles.tryOnActionText}>💾 Save</Text>
                        </Pressable>
                        <Pressable 
                          style={styles.tryOnActionBtn}
                          onPress={() => setRoute('createpod', { imageUrl: item.resultUrl })}
                        >
                          <Text style={styles.tryOnActionText}>💬 Ask Pod</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No try-ons yet</Text>
              <Text style={styles.emptySubtext}>Try on outfits to see them here</Text>
            </View>
          )}
          </View>

          {/* My Pods */}
          <View style={[styles.section, { marginBottom: 20 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Pods</Text>
            </View>
          {activePods.length > 0 && (
            <View style={styles.podsSubsection}>
              <Text style={styles.subsectionTitle}>Live</Text>
              <FlatList
                data={activePods}
                renderItem={({ item }) => <PodCard pod={item} />}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
              />
            </View>
          )}
          {pastPods.length > 0 && (
            <View style={styles.podsSubsection}>
              <Text style={styles.subsectionTitle}>Past</Text>
              <FlatList
                data={pastPods}
                renderItem={({ item }) => <PodCard pod={item} />}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
              />
            </View>
          )}
          {activePods.length === 0 && pastPods.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No pods yet</Text>
              <Text style={styles.emptySubtext}>Create pods to get style feedback</Text>
            </View>
          )}
          </View>

          {/* Mood Boards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mood Boards</Text>
              <Pressable onPress={() => Alert.alert('Create Board', 'Mood board creation coming soon!')}>
                <Text style={styles.addButton}>+ Create</Text>
              </Pressable>
            </View>
            {boards.length > 0 ? (
              <FlatList
                data={boards}
                renderItem={({ item }) => <BoardCard board={item} />}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No mood boards yet</Text>
                <Text style={styles.emptySubtext}>Create mood boards to organize your style inspiration</Text>
              </View>
            )}
          </View>
        </View>

        {/* ============================================
            SECTION 4: SOCIAL (lightweight)
            ============================================ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, color: '#6366f1' }]}>Social</Text>
          
          {/* Friends */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Friends</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={async () => {
                  if (!user?.id) return;
                  const shareUrl = buildShareUrl({ kind: 'install', fromUserId: user.id });
                  await Share.share({ 
                    message: `Join me on Stylit! Let's rate each other's outfits. Download: ${shareUrl}` 
                  });
                }}>
                  <Text style={styles.addButton}>+ Invite</Text>
                </Pressable>
                <Pressable onPress={() => setShowFriends(!showFriends)}>
                  <Text style={styles.addButton}>{showFriends ? 'Hide' : 'Show'} ({friends.length})</Text>
                </Pressable>
              </View>
            </View>
            {showFriends && (
              <View style={styles.friendsContainer}>
                {friends.length > 0 ? (
                  friends.map((friend) => (
                    <Pressable
                      key={friend.id}
                      style={styles.friendItem}
                      onPress={() => {
                        if (friend.friend_id && setRoute) {
                          setRoute('userprofile', { userId: friend.friend_id });
                        }
                      }}
                    >
                      {friend.friend_avatar ? (
                        <SafeImage source={{ uri: friend.friend_avatar }} style={styles.friendItemAvatar} />
                      ) : (
                        <View style={[styles.friendItemAvatar, styles.friendItemAvatarPlaceholder]}>
                          <Text style={styles.friendItemAvatarText}>
                            {friend.friend_name?.charAt(0)?.toUpperCase() || 'F'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.friendItemName}>{friend.friend_name || 'Friend'}</Text>
                      <Text style={styles.friendItemArrow}>→</Text>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No friends yet</Text>
                    <Text style={styles.emptySubtext}>Add friends to share pods with them</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>


      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Support</Text>
        
        <View style={styles.supportCard}>
          <Pressable
            style={styles.supportItem}
            onPress={async () => {
              const email = 'support@stylit.ai';
              const url = `mailto:${email}`;
              try {
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Email not available', `Please contact us at ${email}`);
                }
              } catch (error) {
                Alert.alert('Error', `Please contact us at ${email}`);
              }
            }}
          >
            <Text style={styles.supportItemText}>Contact Support</Text>
            <Text style={styles.supportItemArrow}>→</Text>
          </Pressable>
          
          <View style={styles.supportDivider} />
          
          <Pressable
            style={styles.supportItem}
            onPress={() => setShowPhotoGuidelinesScreen(true)}
          >
            <Text style={styles.supportItemText}>Photo Upload Guidelines</Text>
            <Text style={styles.supportItemArrow}>→</Text>
          </Pressable>
          
          <View style={styles.supportDivider} />
          
          <Pressable
            style={styles.supportItem}
            onPress={async () => {
              const url = 'https://stylit.ai/privacy.html';
              try {
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Unable to open', 'Please visit: ' + url);
                }
              } catch (error) {
                Alert.alert('Error', 'Please visit: ' + url);
              }
            }}
          >
            <Text style={styles.supportItemText}>Privacy Policy</Text>
            <Text style={styles.supportItemArrow}>→</Text>
          </Pressable>
          
          <View style={styles.supportDivider} />
          
          <Pressable
            style={styles.supportItem}
            onPress={async () => {
              const url = 'https://stylit.ai/terms.html';
              try {
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Unable to open', 'Please visit: ' + url);
                }
              } catch (error) {
                Alert.alert('Error', 'Please visit: ' + url);
              }
            }}
          >
            <Text style={styles.supportItemText}>Terms of Service</Text>
            <Text style={styles.supportItemArrow}>→</Text>
          </Pressable>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Pressable
          style={styles.signOutButton}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Sign out from Supabase
                      await supabase.auth.signOut();
                      // Explicitly clear state and navigate
                      if (setUser) setUser(null);
                      if (setSavedFits) setSavedFits([]);
                      if (setRoute) setRoute('auth'); // Force navigation immediately
                      
                      showBanner('Signed out', 'success');
                    } catch (error) {
                      console.log('Sign out error:', error);
                      // Still clear local state and navigate
                      if (setUser) setUser(null);
                      if (setRoute) setRoute('auth');
                    }
                  }
                }
              ]
            );
          }}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

    </ScrollView>

    {/* Visibility Settings Modal */}
    <Modal visible={showVisibilitySettings} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Privacy Settings</Text>
            <Pressable onPress={() => setShowVisibilitySettings(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <View style={styles.visibilitySection}>
              <Text style={styles.visibilitySectionTitle}>Try-On History</Text>
              <Text style={styles.visibilitySectionDesc}>Who can see your try-on history?</Text>
              {['public', 'friends', 'private'].map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.visibilityOption,
                    tryOnVisibility === option && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setTryOnVisibility(option)}
                >
                  <Text style={styles.visibilityOptionEmoji}>
                    {option === 'public' ? '🌐' : option === 'friends' ? '👥' : '🔒'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visibilityOptionTitle}>
                      {option === 'public' ? 'Everyone' : option === 'friends' ? 'Friends Only' : 'Only Me'}
                    </Text>
                    <Text style={styles.visibilityOptionDesc}>
                      {option === 'public' ? 'Visible in Explore and Style Twins' : 
                       option === 'friends' ? 'Only people you share with' : 
                       'Private to you only'}
                    </Text>
                  </View>
                  {tryOnVisibility === option && (
                    <Text style={styles.visibilityCheck}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            <View style={[styles.visibilitySection, { marginTop: 24 }]}>
              <Text style={styles.visibilitySectionTitle}>Pods</Text>
              <Text style={styles.visibilitySectionDesc}>Who can see your pods?</Text>
              {['public', 'friends', 'private'].map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.visibilityOption,
                    podsVisibility === option && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setPodsVisibility(option)}
                >
                  <Text style={styles.visibilityOptionEmoji}>
                    {option === 'public' ? '🌐' : option === 'friends' ? '👥' : '🔒'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visibilityOptionTitle}>
                      {option === 'public' ? 'Everyone' : option === 'friends' ? 'Friends Only' : 'Only Me'}
                    </Text>
                    <Text style={styles.visibilityOptionDesc}>
                      {option === 'public' ? 'Visible in Explore and Style Twins' : 
                       option === 'friends' ? 'Only people you share with' : 
                       'Private to you only'}
                    </Text>
                  </View>
                  {podsVisibility === option && (
                    <Text style={styles.visibilityCheck}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            <Pressable 
              style={styles.saveBtn}
              onPress={() => {
                setShowVisibilitySettings(false);
                // Save visibility settings logic here
              }}
            >
              <Text style={styles.saveBtnText}>Save Settings</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Fit Profile Modal */}
    <Modal visible={showFitProfile} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fit Profile</Text>
            <Pressable onPress={() => setShowFitProfile(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.modalSubtitle}>Basic Info</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender Identity</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genderScroll}>
                {['Female', 'Male', 'Non-binary', 'Prefer not to say'].map((g) => (
                  <Pressable 
                    key={g} 
                    style={[styles.genderBtn, fitProfile.gender === g && styles.genderBtnActive]}
                    onPress={() => setFitProfile(prev => ({ ...prev, gender: g }))}
                  >
                    <Text style={[styles.genderText, fitProfile.gender === g && styles.genderTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Body Shape</Text>
              <Text style={[styles.inputLabel, { fontSize: 12, color: '#9ca3af', marginBottom: 8 }]}>
                {fitProfile.bodyShape 
                  ? (isBodyShapeManuallySet ? `Selected: ${fitProfile.bodyShape}` : `Auto-suggested: ${fitProfile.bodyShape}`)
                  : 'Will be auto-detected from measurements'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genderScroll}>
                {['Hourglass', 'Pear', 'Apple', 'Rectangle', 'Inverted Triangle'].map((shape) => (
                  <Pressable 
                    key={shape} 
                    style={[styles.genderBtn, fitProfile.bodyShape === shape && styles.genderBtnActive]}
                    onPress={() => {
                      setFitProfile(prev => ({ ...prev, bodyShape: shape }));
                      setIsBodyShapeManuallySet(true); // Mark as manually set
                    }}
                  >
                    <Text style={[styles.genderText, fitProfile.bodyShape === shape && styles.genderTextActive]}>{shape}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Height</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 5'8 or 173cm"
                placeholderTextColor="#666"
                value={fitProfile.height}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, height: text }))}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 140lbs or 65kg"
                placeholderTextColor="#666"
                value={fitProfile.weight}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, weight: text }))}
              />
            </View>

            <Text style={styles.modalSubtitle}>Body Measurements</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bust / Chest</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 34, 86cm"
                placeholderTextColor="#666"
                value={fitProfile.chest}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, chest: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Underbust (Ribcage)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 30, 76cm"
                placeholderTextColor="#666"
                value={fitProfile.underbust}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, underbust: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Waist (Natural)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 28, 71cm"
                placeholderTextColor="#666"
                value={fitProfile.waist}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, waist: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hips (Fullest part)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 36, 91cm"
                placeholderTextColor="#666"
                value={fitProfile.hips}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, hips: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shoulder Width</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 16, 40cm"
                placeholderTextColor="#666"
                value={fitProfile.shoulder}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, shoulder: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Arm Length / Sleeve</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 24, 60cm"
                placeholderTextColor="#666"
                value={fitProfile.sleeve}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, sleeve: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Inseam (Inner leg)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 30, 76cm"
                placeholderTextColor="#666"
                value={fitProfile.inseam}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, inseam: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thigh</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 22, 56cm"
                placeholderTextColor="#666"
                value={fitProfile.thigh}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, thigh: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Neck</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 15, 38cm"
                placeholderTextColor="#666"
                value={fitProfile.neck}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, neck: text }))}
              />
            </View>

            <Text style={styles.modalSubtitle}>Standard Sizes</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Typical Top Size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., M, L, 10"
                placeholderTextColor="#666"
                value={fitProfile.topSize}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, topSize: text }))}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Typical Bottom Size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 30, M, 10"
                placeholderTextColor="#666"
                value={fitProfile.bottomSize}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, bottomSize: text }))}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shoe Size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 9, 42"
                placeholderTextColor="#666"
                value={fitProfile.shoeSize}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, shoeSize: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bra Size (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 34B"
                placeholderTextColor="#666"
                value={fitProfile.braSize}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, braSize: text }))}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., broad shoulders, petite"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={fitProfile.notes}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, notes: text }))}
              />
            </View>
            
            <Pressable 
              style={styles.saveBtn}
              onPress={async () => {
                try {
                  if (user?.id) {
                    // Auto-predict body shape ONLY if not manually set and measurements are available
                    let finalBodyShape = fitProfile.bodyShape;
                    if (!finalBodyShape && !isBodyShapeManuallySet) {
                      const predicted = predictBodyShape(fitProfile);
                      if (predicted) {
                        finalBodyShape = predicted;
                        setFitProfile(prev => ({ ...prev, bodyShape: predicted }));
                      }
                    }
                    
                    await supabase.from('profiles').upsert({
                      id: user.id,
                      gender: fitProfile.gender,
                      body_shape: fitProfile.bodyShape || finalBodyShape,
                      height: fitProfile.height,
                      weight: fitProfile.weight,
                      top_size: fitProfile.topSize,
                      bottom_size: fitProfile.bottomSize,
                      shoe_size: fitProfile.shoeSize,
                      chest: fitProfile.chest,
                      underbust: fitProfile.underbust,
                      waist: fitProfile.waist,
                      hips: fitProfile.hips,
                      shoulder: fitProfile.shoulder,
                      sleeve: fitProfile.sleeve,
                      inseam: fitProfile.inseam,
                      thigh: fitProfile.thigh,
                      neck: fitProfile.neck,
                      bra_size: fitProfile.braSize,
                      notes: fitProfile.notes,
                      updated_at: new Date().toISOString()
                    });
                    showBanner('✓ Fit profile saved!', 'success');
                  }
                  setShowFitProfile(false);
                } catch (error) {
                  console.error('Error saving profile:', error);
                  showBanner('Failed to save profile', 'error');
                }
              }}
            >
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Season Picker Modal */}
    <Modal visible={showSeasonPicker} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Color Season</Text>
            <Pressable onPress={() => setShowSeasonPicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.seasonDescription}>
              Your color season is based on your skin tone and natural coloring. Select the one that best matches you:
            </Text>
            
            {getAllSeasons().map((season) => (
              <Pressable
                key={season.id}
                style={[
                  styles.seasonOption,
                  colorProfile?.season === season.id && styles.seasonOptionSelected
                ]}
                onPress={async () => {
                  const { getSeasonProfile } = await import('../lib/colorAnalysis');
                  const profile = getSeasonProfile(season.id);
                  setColorProfile(profile);
                  if (user?.id) {
                    await saveColorProfile(user.id, profile);
                  }
                  setShowSeasonPicker(false);
                  showBanner(`✓ Color season set to ${season.name}!`, 'success');
                }}
              >
                <View style={styles.seasonHeader}>
                  <Text style={styles.seasonName}>{season.name}</Text>
                  <Text style={styles.seasonTone}>{season.tone} • {season.depth}</Text>
                </View>
                <View style={styles.seasonSwatches}>
                  {season.swatches.map((color, idx) => (
                    <View key={idx} style={[styles.seasonSwatch, { backgroundColor: color }]} />
                  ))}
                </View>
                {colorProfile?.season === season.id && (
                  <View style={styles.seasonCheck}>
                    <Text style={styles.seasonCheckText}>✓</Text>
                  </View>
                )}
              </Pressable>
            ))}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
      {/* Body Photo Guidelines Modal */}
      <PhotoGuidelinesModal
        visible={showBodyPhotoGuidelines}
        type="body"
        onClose={() => setShowBodyPhotoGuidelines(false)}
        onContinue={handleBodyPhotoUpload}
      />

      {/* Face Photo Guidelines Modal */}
      <PhotoGuidelinesModal
        visible={showFacePhotoGuidelines}
        type="face"
        onClose={() => setShowFacePhotoGuidelines(false)}
        onContinue={handleFacePhotoSource}
      />

      {/* Photo Guidelines Screen (from Support section) */}
      <PhotoGuidelinesScreen
        visible={showPhotoGuidelinesScreen}
        onClose={() => setShowPhotoGuidelinesScreen(false)}
      />

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade">
        <View style={styles.fullScreenModalContainer}>
          <Pressable 
            style={styles.fullScreenModalBackdrop}
            onPress={() => setFullScreenImage(null)}
          />
          <View style={styles.fullScreenModalContent}>
            <SafeImage source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />
            <Pressable 
              style={styles.fullScreenModalCloseBtn}
              onPress={() => setFullScreenImage(null)}
            >
              <Text style={styles.fullScreenModalCloseText}>✕</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: 16,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6366f1',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  editPhotoText: {
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
  },
  settingsButton: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  visibilitySection: {
    marginBottom: 24,
  },
  visibilitySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  visibilitySectionDesc: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  visibilityOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  visibilityOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  visibilityOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  visibilityOptionDesc: {
    fontSize: 12,
    color: '#9ca3af',
  },
  visibilityCheck: {
    fontSize: 20,
    color: '#6366f1',
    fontWeight: '700',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  counters: {
    flexDirection: 'row',
    gap: 32,
  },
  counterItem: {
    alignItems: 'center',
  },
  counterNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  counterLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  fitCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fitImage: {
    width: '100%',
    height: 200,
  },
  fitInfo: {
    padding: 12,
  },
  fitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  fitPrice: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
  },
  fitActions: {
    flexDirection: 'row',
  },
  visibilityBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  visibilityBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  visibilityText: {
    fontSize: 11,
    color: '#fff',
  },
  boardCard: {
    width: 200,
    height: 240,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  boardImage: {
    width: '100%',
    height: '100%',
  },
  boardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  boardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  boardCount: {
    fontSize: 12,
    color: '#d1d5db',
  },
  boardVisibility: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  boardVisibilityText: {
    fontSize: 16,
  },
  tryOnCard: {
    width: 200,
    height: 280,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  tryOnImage: {
    width: '100%',
    height: '100%',
  },
  tryOnOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 12,
    paddingTop: 40, // Space for privacy badge at top
  },
  tryOnProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  tryOnProductThumb: {
    position: 'absolute',
    top: 40,
    right: 8,
    width: 50,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  tryOnProductThumbImg: {
    width: '100%',
    height: '100%',
  },
  tryOnProductThumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  tryOnProductThumbText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '600',
  },
  tryOnActions: {
    flexDirection: 'row',
    gap: 6,
  },
  tryOnActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  tryOnActionText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  privacyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  privacyBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  podPrivacyBtn: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  podPrivacyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  privacyDropdown: {
    position: 'absolute',
    bottom: 30, // Position ABOVE the badge instead of below
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    minWidth: 150,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 20,
  },
  privacyDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  privacyDropdownItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  privacyDropdownIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  privacyDropdownText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  privacyDropdownTextActive: {
    fontWeight: '600',
    color: '#6366f1',
  },
  privacyDropdownCheck: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  podsSubsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  podCard: {
    width: 180,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  podImage: {
    width: '100%',
    height: 120,
  },
  podInfo: {
    padding: 12,
  },
  podTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  podMode: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  podStatus: {
    fontSize: 11,
    color: '#10b981',
  },
  lockedStatsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  unlockButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  unlockBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  unlockBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    color: '#9ca3af',
  },
  fitProfileCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  profileLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  profileValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  fullScreenModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenModalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  fullScreenModalCloseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    fontSize: 24,
    color: '#fff',
  },
  modalScroll: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  genderScroll: {
    marginTop: 8,
  },
  genderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  genderBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderColor: '#6366f1',
  },
  genderText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  signOutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 16,
  },
  friendsContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendItemAvatarPlaceholder: {
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendItemAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  friendItemName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  friendItemArrow: {
    color: '#9ca3af',
    fontSize: 18,
  },
  // Photo Section Styles
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  photoInfo: {
    flex: 1,
  },
  photoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  photoHint: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoThumb: {
    width: 60,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  removePhotoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  // Color Profile Styles
  colorProfileSection: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  colorProfileTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  colorSeasonBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  colorSeasonText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
  },
  colorSwatchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorBestLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  colorBestList: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  changeSeasonBtn: {
    alignSelf: 'flex-start',
  },
  changeSeasonText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  colorProfileEmpty: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  colorProfileEmptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  selectSeasonBtn: {
    paddingVertical: 8,
  },
  selectSeasonText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  // Season Picker Styles
  seasonDescription: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  seasonOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  seasonOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  seasonHeader: {
    marginBottom: 12,
  },
  seasonName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  seasonTone: {
    color: '#9ca3af',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  seasonSwatches: {
    flexDirection: 'row',
    gap: 8,
  },
  seasonSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  seasonCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonCheckText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  // Support Section Styles
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  supportCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  supportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  supportItemText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  supportItemArrow: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '600',
  },
  supportDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
});

export default StyleVaultScreen;
