import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  Alert,
  Share,
  InteractionManager,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Image,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../lib/SimpleGradient';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../lib/AppContext';
import { Colors, Typography, Spacing, BorderRadius, CardStyles, TextStyles } from '../lib/designSystem';
import { getUserActivePods, getUserPastPods, deletePod } from '../lib/pods';
import { uploadImageAsync } from '../lib/upload';
import { supabase } from '../lib/supabase';
import { getUserFriends } from '../lib/friends';
import { buildShareUrl } from '../lib/share';
import { getStyleProfile, refreshStyleProfile } from '../lib/styleEngine';
import { loadColorProfile, saveColorProfile, getAllSeasons, getSeasonSwatches, analyzeFaceForColorProfile, analyzeFaceForColorProfileFromLocalUri, analyzeFaceForColorProfileFromCroppedImage } from '../lib/colorAnalysis';
import { fetchGarmentsAsProducts } from '../lib/garmentUtils';

// Import micro-season palette system
let getMicroSeasonPalette = null;
let determineMicroSeason = null;
let MICRO_SEASON_PALETTE = null;
let getMicroSeasonsForParent = null;
try {
  const colorClassification = require('../lib/colorClassification');
  getMicroSeasonPalette = colorClassification.getMicroSeasonPalette || colorClassification.default?.getMicroSeasonPalette;
  determineMicroSeason = colorClassification.determineMicroSeason || colorClassification.default?.determineMicroSeason;
  MICRO_SEASON_PALETTE = colorClassification.MICRO_SEASON_PALETTE || colorClassification.default?.MICRO_SEASON_PALETTE;
  getMicroSeasonsForParent = colorClassification.getMicroSeasonsForParent || colorClassification.default?.getMicroSeasonsForParent;
} catch (error) {
  console.warn('Could not load micro-season palette system:', error.message);
}

// Legacy COLOR_SEASONS for fallback - Updated with exact colors provided
const COLOR_SEASONS = {
  spring: {
    neutrals: [
      { name: "Warm ivory", hex: "#F6EAD7" },
      { name: "Cream", hex: "#FFF1D6" },
      { name: "Light camel", hex: "#D8B58A" },
      { name: "Soft beige", hex: "#E6D2B5" },
      { name: "Golden sand", hex: "#D9B77C" },
    ],
    accents: [
      { name: "Coral", hex: "#FF6F61" },
      { name: "Peach", hex: "#FFB38A" },
      { name: "Warm rose", hex: "#E88A8A" },
      { name: "Apricot", hex: "#FF9F6B" },
      { name: "Melon", hex: "#FF8C69" },
    ],
    brights: [
      { name: "Cantaloupe", hex: "#FFA64D" },
      { name: "Warm yellow", hex: "#FFD84D" },
      { name: "Bright aqua", hex: "#2ECED0" },
      { name: "Light turquoise", hex: "#5ED6C1" },
      { name: "Sunny gold", hex: "#FFC83D" },
    ],
    softs: [
      { name: "Mint", hex: "#BFE6C7" },
      { name: "Soft peach", hex: "#FFD1B3" },
      { name: "Light warm pink", hex: "#F6B7B2" },
      { name: "Soft teal", hex: "#7FCFC3" },
      { name: "Buttercream", hex: "#FFF0B3" },
    ],
  },
  summer: {
    neutrals: [
      { name: "Cool ivory", hex: "#F2F0EB" },
      { name: "Soft gray", hex: "#C8C8D0" },
      { name: "Rose beige", hex: "#E3D5D2" },
      { name: "Misty taupe", hex: "#CDC4C1" },
      { name: "Silver frost", hex: "#DDE1E8" },
    ],
    accents: [
      { name: "Dusty rose", hex: "#D8A7A7" },
      { name: "Mauve", hex: "#C8A2C8" },
      { name: "Soft berry", hex: "#B58CA5" },
      { name: "Lavender", hex: "#C7B8E0" },
      { name: "Ballet pink", hex: "#F4C5C9" },
    ],
    brights: [
      { name: "Periwinkle", hex: "#8FA4E8" },
      { name: "Cool aqua", hex: "#8FD6D5" },
      { name: "Powder blue", hex: "#AFC8E7" },
      { name: "Soft fuchsia", hex: "#D66DA3" },
      { name: "Strawberry ice", hex: "#E87BAA" },
    ],
    softs: [
      { name: "Blue gray", hex: "#B7C4CF" },
      { name: "Misty blue", hex: "#C6D7E2" },
      { name: "Heather", hex: "#D8CBE2" },
      { name: "Soft lilac", hex: "#E7D6F5" },
      { name: "Cloud pink", hex: "#F7DDE3" },
    ],
  },
  autumn: {
    neutrals: [
      { name: "Warm beige", hex: "#E6D5B8" },
      { name: "Camel", hex: "#C1A16B" },
      { name: "Olive taupe", hex: "#B6A892" },
      { name: "Caramel", hex: "#B78B57" },
      { name: "Soft olive", hex: "#A89F80" },
    ],
    accents: [
      { name: "Terracotta", hex: "#C96541" },
      { name: "Rust", hex: "#B4441C" },
      { name: "Burnt sienna", hex: "#A85F3D" },
      { name: "Mustard", hex: "#D3A63C" },
      { name: "Warm olive", hex: "#8E8C53" },
    ],
    brights: [
      { name: "Pumpkin", hex: "#F18F01" },
      { name: "Marigold", hex: "#FFC145" },
      { name: "Moss green", hex: "#8FAE3E" },
      { name: "Teal", hex: "#1B998B" },
      { name: "Brick red", hex: "#A23E3D" },
    ],
    softs: [
      { name: "Sage", hex: "#C4C8A8" },
      { name: "Dusty olive", hex: "#A3A380" },
      { name: "Clay", hex: "#C9A28C" },
      { name: "Soft terracotta", hex: "#D1A38A" },
      { name: "Muted gold", hex: "#D6BA6A" },
    ],
  },
  winter: {
    neutrals: [
      { name: "Snow white", hex: "#FFFFFF" },
      { name: "Cool black", hex: "#0A0A0A" },
      { name: "Charcoal", hex: "#333333" },
      { name: "Silver gray", hex: "#BFC3C9" },
      { name: "Blue-gray", hex: "#8A97A8" },
    ],
    accents: [
      { name: "Fuchsia", hex: "#E3007E" },
      { name: "Berry", hex: "#B8004E" },
      { name: "Royal purple", hex: "#5A2D82" },
      { name: "Crimson", hex: "#D1002C" },
      { name: "Electric magenta", hex: "#FF1B8D" },
    ],
    brights: [
      { name: "True red", hex: "#FF0000" },
      { name: "Sapphire blue", hex: "#0F52BA" },
      { name: "Emerald", hex: "#009975" },
      { name: "Icy teal", hex: "#4BC6B9" },
      { name: "Lemon ice", hex: "#F2FF6E" },
    ],
    softs: [
      { name: "Icy lavender", hex: "#D6D4F7" },
      { name: "Ice pink", hex: "#F6D3E6" },
      { name: "Frost blue", hex: "#D8EAFE" },
      { name: "Soft wine", hex: "#C79CA6" },
      { name: "Cool plum", hex: "#836283" },
    ],
  },
};
import { runQualityChecks } from '../lib/imageQualityChecks';
import FaceCropScreen from '../components/FaceCropScreen';
import PhotoGuidelinesModal from '../components/PhotoGuidelinesModal';
import PhotoGuidelinesScreen from '../components/PhotoGuidelinesScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cmToInches, inchesToCm, parseMeasurementToInches, formatInchesAsFraction, parseHeightToInches } from '../lib/measurementUtils';
import { SafeImage, OptimizedImage } from '../lib/OptimizedImage';
import { Avatar } from '../components/Avatar';

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

// Reusable RowItem component for consistent UI
const RowItem = ({ icon, title, subtitle, onPress, showChevron = true, rightContent }) => (
  <Pressable 
    style={styles.rowItem}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.rowItemLeft}>
      {icon && <Text style={styles.rowItemIcon}>{icon}</Text>}
      <View style={styles.rowItemContent}>
        <Text style={styles.rowItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowItemSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {rightContent || (showChevron && <Text style={styles.rowItemChevron}>›</Text>)}
  </Pressable>
);

// Section Card wrapper
const SectionCard = ({ title, children, style }) => (
  <View style={[styles.sectionCard, style]}>
    {title && <Text style={styles.sectionCardTitle}>{title}</Text>}
    {children}
  </View>
);

const StyleVaultScreen = () => {
  const appContext = useApp();
  const { state, setRoute, setProcessingResult, setSavedFits, setUser, setBannerMessage, setBannerType, setCurrentProduct, setTwinUrl, setTryOnHistory } = appContext;
  const { user, tryOnHistory, twinUrl, savedFits } = state;

  // Guard: If no user, don't render anything (prevents crashes on sign out)
  if (!user) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }
  const insets = useSafeAreaInsets();
  
  // Check if user is admin - only admin@stylit.ai should see admin section
  const isAdmin = user?.email === 'admin@stylit.ai';
  
  // State
  const [username, setUsername] = useState(user?.name || 'Fashionista');
  const [profilePic, setProfilePic] = useState(user?.avatar_url || null);
  const [bodyImage, setBodyImage] = useState(user?.body_image_url || twinUrl || null);
  const [faceImage, setFaceImage] = useState(user?.face_image_url || null);
  
  // Update images when user object changes (e.g., after login)
  useEffect(() => {
    if (user?.body_image_url) {
      setBodyImage(user.body_image_url);
    } else if (twinUrl) {
      setBodyImage(twinUrl);
    }
    if (user?.face_image_url) {
      setFaceImage(user.face_image_url);
    }
  }, [user?.body_image_url, user?.face_image_url, twinUrl]);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysisError, setFaceAnalysisError] = useState(null);
  // Initialize colorProfile from user object (loaded on app startup) if available
  const [colorProfile, setColorProfile] = useState(user?.colorProfile || null);
  
  // Update colorProfile when user object changes (e.g., after login or app startup)
  useEffect(() => {
    if (user?.colorProfile?.season) {
      setColorProfile(user.colorProfile);
      // Immediately stop loading if we have the profile
      setIsLoadingProfile(false);
    }
  }, [user?.colorProfile]);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showFaceCrop, setShowFaceCrop] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
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
    gender: '', // Added gender
    topSize: '',
    bottomSize: '',
    chest: '',
    waist: '',
    hips: '',
    shoulder: '',
    sleeve: '', // Optional: arm_length
    inseam: '',
    thigh: '', // Optional
    fit_preference: '', // Required: snug, regular, relaxed, oversized
    notes: '',
    bodyShape: '' // Body shape (Hourglass, Pear, Apple, Rectangle, Inverted Triangle)
  });
  const [isBodyShapeManuallySet, setIsBodyShapeManuallySet] = useState(false); // Track if user manually set body shape
  const [showFitProfile, setShowFitProfile] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState('in'); // 'in' or 'cm' for input display (stored in inches)
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false);
  const [styleStatsUnlocked, setStyleStatsUnlocked] = useState(false);
  // For showing dropdown picker
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(null); // { type: 'tryon' | 'pod', id: string }
  const [styleProfile, setStyleProfile] = useState(null);
  // If colorProfile is already available from app startup, don't show loading state
  const [isLoadingProfile, setIsLoadingProfile] = useState(!user?.colorProfile); // Loading state for initial profile data
  const [fullScreenImage, setFullScreenImage] = useState(null); // Added for saved fits
  const [showBodyPhotoGuidelines, setShowBodyPhotoGuidelines] = useState(false);
  const [showFacePhotoGuidelines, setShowFacePhotoGuidelines] = useState(false);
  const [showBodyMeasurements, setShowBodyMeasurements] = useState(false); // Collapsible body measurements section
  const [showPhotoGuidelinesScreen, setShowPhotoGuidelinesScreen] = useState(false); // Support section guidelines
  const [showEditProfileModal, setShowEditProfileModal] = useState(false); // Separate Edit Profile modal
  const [friendSearchInput, setFriendSearchInput] = useState(''); // Search input for friends
  const [friendSearchResults, setFriendSearchResults] = useState([]); // Search results for friend search
  const [isSearchingFriends, setIsSearchingFriends] = useState(false); // Loading state for friend search
  const [sentRequests, setSentRequests] = useState([]); // Friend requests sent by user
  const [receivedRequests, setReceivedRequests] = useState([]); // Friend requests received by user
  const [localPendingRequests, setLocalPendingRequests] = useState(new Set()); // Track locally pending requests for immediate UI update
  const [isUploadingBodyPhoto, setIsUploadingBodyPhoto] = useState(false); // Loading state for body photo upload
  const [isDeletingAccount, setIsDeletingAccount] = useState(false); // Loading state for account deletion
  const [deleteConfirmText, setDeleteConfirmText] = useState(''); // Text input for delete confirmation
  
  // Quick Color Check feature states
  const [showQuickColorCheck, setShowQuickColorCheck] = useState(false);
  const [quickCheckImage, setQuickCheckImage] = useState(null);
  const [quickCheckColor, setQuickCheckColor] = useState(null);
  const [quickCheckResult, setQuickCheckResult] = useState(null);
  const [isQuickCheckAnalyzing, setIsQuickCheckAnalyzing] = useState(false);
  const [quickCheckLiveColor, setQuickCheckLiveColor] = useState(null); // Live picked color (hex, rgb, name)
  const [quickCheckTouchPosition, setQuickCheckTouchPosition] = useState(null); // Touch position for cursor
  const [isQuickCheckSampling, setIsQuickCheckSampling] = useState(false); // Loading while sampling color
  const quickCheckImageLayoutRef = useRef({ width: 0, height: 0 }); // Image layout dimensions
  const quickCheckImageNaturalSizeRef = useRef({ width: 0, height: 0 }); // Natural image dimensions
  
  // Multi-photo face analysis states
  const [showMultiPhotoModal, setShowMultiPhotoModal] = useState(false);
  const [additionalPhotos, setAdditionalPhotos] = useState([null, null]); // 2 additional photos (original URIs)
  const [additionalPhotosCropped, setAdditionalPhotosCropped] = useState([null, null]); // Cropped base64 images
  const [additionalPhotosCropInfo, setAdditionalPhotosCropInfo] = useState([null, null]); // Crop info for each photo
  const [showFaceCropForAdditional, setShowFaceCropForAdditional] = useState(false);
  const [additionalPhotoIndexToCrop, setAdditionalPhotoIndexToCrop] = useState(null); // 0 or 1
  const [pendingImageUri, setPendingImageUri] = useState(null); // Store imageUri for FaceCropScreen
  const [isAnalyzingMultiPhoto, setIsAnalyzingMultiPhoto] = useState(false);
  const [multiPhotoResults, setMultiPhotoResults] = useState(null);
  
  // Debug: Log state changes for FaceCropScreen
  useEffect(() => {
    console.log('📸 [DEBUG] FaceCropScreen state:', { 
      pendingImageUri: pendingImageUri ? 'SET' : 'null', 
      additionalPhotoIndexToCrop, 
      showFaceCropForAdditional,
      showMultiPhotoModal 
    });
  }, [pendingImageUri, additionalPhotoIndexToCrop, showFaceCropForAdditional, showMultiPhotoModal]);
  const [isColorDetailsExpanded, setIsColorDetailsExpanded] = useState(false); // Collapsible color profile details
  const [colorProducts, setColorProducts] = useState([]); // Products matching user's colors
  const [isLoadingColorProducts, setIsLoadingColorProducts] = useState(false); // Loading state for color products
  const [expandedBanner, setExpandedBanner] = useState(null); // 'undertone' | 'depth' | 'clarity' | null
  const [expandedCategoryProducts, setExpandedCategoryProducts] = useState(null); // 'neutrals' | 'accents' | 'brights' | 'softs' | null
  const [categoryProducts, setCategoryProducts] = useState({}); // { neutrals: [], accents: [], brights: [], softs: [] }
  const [isLoadingCategoryProducts, setIsLoadingCategoryProducts] = useState({}); // { neutrals: false, accents: false, ... }
  const [showSecondaryColors, setShowSecondaryColors] = useState({}); // { neutrals: false, accents: false, ... } - show all micro-season colors
  
  // Helper to toggle secondary colors with animation - collapses other categories
  const toggleSecondaryColors = (category) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowSecondaryColors(prev => {
      const isCurrentlyExpanded = prev[category];
      // Collapse all, then expand the clicked one (if it was collapsed)
      return {
        neutrals: false,
        accents: false,
        brights: false,
        softs: false,
        [category]: !isCurrentlyExpanded,
      };
    });
  };
  
  // Password change modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Helper function to convert hex to rgba with opacity
  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Helper function to mix multiple colors (1st, 3rd, 5th) into a single color
  const mixColors = (colors) => {
    if (!colors || colors.length === 0) return null;
    
    // Get 1st, 3rd, and 5th colors (indices 0, 2, 4)
    const color1 = colors[0];
    const color3 = colors.length > 2 ? colors[2] : colors[0];
    const color5 = colors.length > 4 ? colors[4] : colors[colors.length - 1];
    
    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    
    const rgb1 = hexToRgb(color1.hex);
    const rgb3 = hexToRgb(color3.hex);
    const rgb5 = hexToRgb(color5.hex);
    
    // Average the RGB values (equal weight for each color)
    const mixedR = Math.round((rgb1.r + rgb3.r + rgb5.r) / 3);
    const mixedG = Math.round((rgb1.g + rgb3.g + rgb5.g) / 3);
    const mixedB = Math.round((rgb1.b + rgb3.b + rgb5.b) / 3);
    
    return { r: mixedR, g: mixedG, b: mixedB };
  };

  // Helper function to get secondary colors from all micro-seasons of a parent season
  // Returns colors grouped by micro-season (array of arrays)
  // Excludes the user's primary micro-season colors
  const getSecondaryColorsGrouped = (parentSeason, userMicroSeason, category) => {
    if (!getMicroSeasonsForParent || !getMicroSeasonPalette || !parentSeason) {
      return [];
    }
    
    try {
      const allMicroSeasons = getMicroSeasonsForParent(parentSeason);
      const groupedColors = [];
      
      for (const microSeason of allMicroSeasons) {
        // Skip user's own micro-season (those are primary colors)
        if (microSeason === userMicroSeason) continue;
        
        const palette = getMicroSeasonPalette(microSeason);
        if (palette && palette[category]) {
          const colors = palette[category].map(c => ({
            name: c.name,
            hex: c.hex,
          }));
          if (colors.length > 0) {
            groupedColors.push(colors);
          }
        }
      }
      
      return groupedColors;
    } catch (error) {
      console.warn('Error getting secondary colors:', error);
      return [];
    }
  };

  // Helper function to get organized colors by category for each season
  // Uses micro-season palettes if available, falls back to parent season colors
  const getOrganizedColors = (season, depth = null, clarity = null) => {
    // Try to use micro-season palette system
    if (determineMicroSeason && getMicroSeasonPalette && season) {
      try {
        const microSeason = determineMicroSeason(season, depth, clarity);
        if (microSeason) {
          const microPalette = getMicroSeasonPalette(microSeason);
          if (microPalette) {
            // Convert palette colors to the format expected by the UI
            return {
              neutrals: microPalette.neutrals.map(c => ({ name: c.name, hex: c.hex })),
              accents: microPalette.accents.map(c => ({ name: c.name, hex: c.hex })),
              brights: microPalette.brights.map(c => ({ name: c.name, hex: c.hex })),
              softs: microPalette.softs.map(c => ({ name: c.name, hex: c.hex })),
            };
          }
        }
      } catch (error) {
        console.warn('Error getting micro-season palette, falling back to parent season:', error);
      }
    }
    
    // Fallback to parent season colors
    const seasonData = COLOR_SEASONS[season];
    if (!seasonData) return { neutrals: [], accents: [], brights: [], softs: [] };

    // Return the pre-organized colors
    return {
      neutrals: seasonData.neutrals || [],
      accents: seasonData.accents || [],
      brights: seasonData.brights || [],
      softs: seasonData.softs || [],
    };
  };

  // Helper function to get season-specific explanations
  const getColorExplanations = (season, tone, depth, clarity) => {
    const explanations = {
      undertone: '',
      depth: '',
      clarity: '',
    };

    // Undertone explanations
    if (tone === 'warm') {
      explanations.undertone = 'Your skin reads more golden than pink.';
    } else if (tone === 'cool') {
      explanations.undertone = 'Your skin reads more pink than golden.';
    } else {
      explanations.undertone = 'Your skin has a balanced mix of golden and pink tones.';
    }

    // Depth explanations
    if (depth === 'light') {
      explanations.depth = 'Light colors enhance your natural brightness.';
    } else if (depth === 'deep') {
      explanations.depth = 'Rich, deeper colors complement your natural contrast.';
    } else {
      explanations.depth = 'Mid-tone colors balance best on you.';
    }

    // Clarity explanations
    if (clarity === 'muted') {
      explanations.clarity = 'Softer colors look more natural than neon.';
    } else if (clarity === 'clear') {
      explanations.clarity = 'Clear, bright colors enhance your natural clarity.';
    } else {
      explanations.clarity = 'Vivid, intense colors make you shine.';
    }

    // Season-specific overrides
    if (season === 'spring') {
      if (tone === 'warm') explanations.undertone = 'Your warm, golden undertones glow in warm colors.';
      if (depth === 'light') explanations.depth = 'Light, fresh colors bring out your natural radiance.';
      if (clarity === 'clear') explanations.clarity = 'Clear, bright colors enhance your warm glow.';
    } else if (season === 'summer') {
      if (tone === 'cool') explanations.undertone = 'Your cool, pink undertones shine in soft cool tones.';
      if (depth === 'light') explanations.depth = 'Soft, light colors complement your gentle coloring.';
      if (clarity === 'muted') explanations.clarity = 'Muted, soft colors enhance your natural elegance.';
    } else if (season === 'autumn') {
      if (tone === 'warm') explanations.undertone = 'Your warm, golden undertones glow in earthy warm tones.';
      if (depth === 'deep') explanations.depth = 'Rich, deep colors complement your natural warmth.';
      if (clarity === 'muted') explanations.clarity = 'Muted, earthy colors enhance your natural warmth.';
    } else if (season === 'winter') {
      if (tone === 'cool') explanations.undertone = 'Your cool, pink undertones shine in crisp cool tones.';
      if (depth === 'deep') explanations.depth = 'Bold, deep colors complement your natural contrast.';
      if (clarity === 'vivid') explanations.clarity = 'Vivid, intense colors make you stand out.';
    }

    return explanations;
  };

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

  // Improved body shape prediction function - gender-aware and more accurate
  const predictBodyShape = (profile) => {
    const gender = (profile.gender || '').toLowerCase();
    const chest = parseFloat(profile.chest) || 0;
    const waist = parseFloat(profile.waist) || 0;
    const hips = parseFloat(profile.hips) || 0;
    const shoulder = parseFloat(profile.shoulder) || 0;
    
    // Need at least waist and hips for prediction
    if (!waist || !hips || waist <= 0 || hips <= 0) return null;
    
    // Use chest for men, but for women we should ideally use bust
    // Since we only have chest, we'll use it for both but adjust thresholds
    const bustOrChest = chest || 0;
    
    // Calculate ratios and differences
    const waistToHipRatio = waist / hips;
    const bustToHipRatio = bustOrChest / hips;
    const shoulderToHipRatio = shoulder / hips;
    const waistToBustRatio = waist / (bustOrChest || 1);
    
    // Absolute differences (in inches) - more reliable than ratios alone
    const waistHipDiff = hips - waist;
    const bustHipDiff = hips - bustOrChest;
    const bustWaistDiff = bustOrChest - waist;
    const shoulderHipDiff = (shoulder || 0) - hips;
    
    const isFemale = gender === 'female' || gender === 'f' || gender === 'woman' || gender === 'women';
    const isMale = gender === 'male' || gender === 'm' || gender === 'man' || gender === 'men';
    
    // ========== FEMALE BODY SHAPES ==========
    if (isFemale) {
      // Hourglass: Waist is 8-10 inches smaller than bust AND hips
      // Bust and hips are within 1 inch of each other
      // Waist is clearly defined (waist-to-hip ratio < 0.75)
      if (waistHipDiff >= 8 && Math.abs(bustOrChest - hips) <= 1.5 && waistToHipRatio < 0.75) {
        return 'Hourglass';
      }
      
      // Pear/Triangle: Hips are 2+ inches wider than bust
      // Waist is smaller than hips but not as defined as hourglass
      if (bustHipDiff >= 2 && waistHipDiff >= 5 && waistToHipRatio < 0.80) {
        return 'Pear';
      }
      
      // Apple/Oval: Waist is close to or larger than bust/hips
      // Waist is within 2 inches of bust or larger
      if (waistToHipRatio >= 0.85 && (waist >= bustOrChest * 0.95 || Math.abs(waist - bustOrChest) <= 2)) {
        return 'Apple';
      }
      
      // Inverted Triangle: Shoulders/bust are wider than hips
      // Shoulders or bust are 2+ inches wider than hips
      if ((shoulderHipDiff >= 2 || bustHipDiff <= -2) && shoulderToHipRatio > 1.05) {
        return 'Inverted Triangle';
      }
      
      // Rectangle: Waist is within 2-3 inches of bust and hips
      // Relatively straight proportions
      if (waistToHipRatio >= 0.75 && waistToHipRatio < 0.85 && 
          Math.abs(waist - bustOrChest) <= 3 && waistHipDiff < 8) {
        return 'Rectangle';
      }
      
      // Default classification based on ratios if absolute differences don't match
      if (waistToHipRatio < 0.75 && bustToHipRatio > 0.90 && bustToHipRatio < 1.10) {
        return 'Hourglass';
      }
      if (bustToHipRatio < 0.90 && waistToHipRatio < 0.80) {
        return 'Pear';
      }
      if (waistToHipRatio >= 0.85) {
        return 'Apple';
      }
      if (shoulderToHipRatio > 1.05 || bustToHipRatio > 1.10) {
        return 'Inverted Triangle';
      }
      
      // Final fallback
      return 'Rectangle';
    }
    
    // ========== MALE BODY SHAPES ==========
    if (isMale) {
      // For men, body shapes are typically:
      // - Rectangle: Straight proportions
      // - Triangle: Wider shoulders, narrower waist/hips (athletic)
      // - Oval: Larger waist relative to chest/shoulders
      // - Inverted Triangle: Very broad shoulders, narrow waist (V-shape)
      
      // Inverted Triangle (V-shape): Shoulders/chest much wider than waist/hips
      // Athletic build - shoulders 3+ inches wider than hips
      if (shoulderHipDiff >= 3 && waistToHipRatio < 0.90) {
        return 'Inverted Triangle';
      }
      
      // Rectangle: Relatively straight - waist within 2-4 inches of chest
      // Waist-to-hip ratio between 0.85-0.95
      if (waistToHipRatio >= 0.85 && waistToHipRatio <= 0.95 && 
          Math.abs(waist - bustOrChest) <= 4) {
        return 'Rectangle';
      }
      
      // Oval/Apple: Waist is close to or larger than chest
      // Waist-to-hip ratio > 0.95
      if (waistToHipRatio > 0.95 && waist >= bustOrChest * 0.95) {
        return 'Apple';
      }
      
      // Triangle: Hips wider than shoulders (less common in men)
      if (hips > bustOrChest && (shoulder || 0) < hips) {
        return 'Pear';
      }
      
      // Default for men
      return 'Rectangle';
    }
    
    // ========== GENDER NOT SPECIFIED - Use neutral logic ==========
    // Use more conservative thresholds that work for both
    
    // Hourglass (works for both, but more common in women)
    if (waistHipDiff >= 7 && Math.abs(bustOrChest - hips) <= 2 && waistToHipRatio < 0.75) {
      return 'Hourglass';
    }
    
    // Pear: Hips wider than bust/chest
    if (bustHipDiff >= 1.5 && waistToHipRatio < 0.80) {
      return 'Pear';
    }
    
    // Apple: Waist close to or larger than bust/chest
    if (waistToHipRatio >= 0.85 && waist >= bustOrChest * 0.95) {
      return 'Apple';
    }
    
    // Inverted Triangle: Shoulders/chest wider than hips
    if ((shoulderHipDiff >= 1.5 || bustHipDiff <= -1.5) && (shoulderToHipRatio > 1.05 || bustToHipRatio > 1.05)) {
      return 'Inverted Triangle';
    }
    
    // Rectangle: Default fallback
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
  }, [fitProfile.chest, fitProfile.waist, fitProfile.hips, fitProfile.shoulder, fitProfile.gender, isBodyShapeManuallySet]);

  // Load profile data on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  // Reload profile data when fit profile modal opens to ensure latest data is shown
  useEffect(() => {
    if (showFitProfile && user?.id) {
      loadProfileData();
    }
  }, [showFitProfile, user?.id]);

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
    const loadAllData = async () => {
      if (user?.id) {
        // Only show loading if we don't already have color profile from app startup
        if (!colorProfile) {
          setIsLoadingProfile(true);
        }
        try {
          // Load critical profile data first (parallel)
          await Promise.all([
            loadProfileData(),
            loadStyleProfile(),
            loadUserColorProfile(),
          ]);
        } catch (error) {
          console.error('Error loading profile data:', error);
        } finally {
          setIsLoadingProfile(false);
        }
        // Load non-critical data after
        loadTryOnHistory();
        loadSavedFits();
        loadFriends();
      } else {
        setIsLoadingProfile(false);
      }
    };
    loadAllData();
  }, [user?.id]);

  // Handler for body photo upload after guidelines
  const handleBodyPhotoUpload = async () => {
    // Close the guidelines modal first
    setShowBodyPhotoGuidelines(false);
    
    // Request permission - this shows Apple's system alert with 3 options
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo Access Required',
        'Stylit needs access to your photos to upload a body photo for size recommendations. Please allow access in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }
    
    // Now launch image picker after permission is granted
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8
    });
    
    if (!res.canceled && res.assets && res.assets[0]) {
      // Set loading state immediately and show local image
      setIsUploadingBodyPhoto(true);
      const localUri = res.assets[0].uri;
      setBodyImage(localUri); // Show local image immediately
      
      try {
        const uploadedUrl = await uploadImageAsync(localUri);
        if (user?.id) {
          const { error: updateError } = await supabase.from('profiles').update({ body_image_url: uploadedUrl }).eq('id', user.id);
          if (updateError) {
            // If profile doesn't exist, create it
            if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
              const { error: upsertError } = await supabase.from('profiles').upsert({
                id: user.id,
                body_image_url: uploadedUrl,
                email: user.email,
              });
              if (upsertError) {
                throw upsertError;
              }
            } else {
              throw updateError;
            }
          }
        }
        setBodyImage(uploadedUrl); // Update to remote URL
        if (setUser) setUser(prev => ({ ...prev, body_image_url: uploadedUrl }));
        if (setTwinUrl) setTwinUrl(uploadedUrl);
        showBanner('✓ Body photo saved!', 'success');
      } catch (error) {
        setBodyImage(null); // Clear on error
        showBanner('Failed to upload photo', 'error');
      } finally {
        setIsUploadingBodyPhoto(false);
      }
    }
  };

  // Handler for face photo upload after guidelines
  // Helper function to proceed with analysis after crop
  const proceedWithAnalysis = async (imageUri, cropInfo) => {
                try {
                  setIsAnalyzingFace(true);
      
      let profile, uploadedUrl, qualityMessages;
      
      // Analyze using image with crop coordinates (preferred method - server does cropping)
      if (cropInfo) {
        const result = await analyzeFaceForColorProfileFromCroppedImage(
          imageUri,
          cropInfo,
          uploadImageAsync
        );
        profile = result.profile;
        uploadedUrl = result.uploadedUrl;
        qualityMessages = result.qualityMessages;
      } else {
        // Fallback: use old method if no crop info
        const result = await analyzeFaceForColorProfileFromLocalUri(imageUri, uploadImageAsync);
        profile = result.profile;
        uploadedUrl = result.uploadedUrl;
        qualityMessages = undefined;
      }
                  
                  setIsAnalyzingFace(false);
                  
                  if (uploadedUrl && user?.id) {
                    const { error: faceUpdateError } = await supabase.from('profiles').update({ face_image_url: uploadedUrl }).eq('id', user.id);
                    if (faceUpdateError) {
                      // If profile doesn't exist, create it
                      if (faceUpdateError.code === 'PGRST116' || faceUpdateError.message?.includes('0 rows')) {
                        const { error: upsertError } = await supabase.from('profiles').upsert({
                          id: user.id,
                          face_image_url: uploadedUrl,
                          email: user.email,
                        });
                      }
                    }
                    setFaceImage(uploadedUrl);
                    if (setUser) setUser(prev => ({ ...prev, face_image_url: uploadedUrl }));
                  }
                  
                  if (profile && user?.id) {
                    await saveColorProfile(user.id, profile);
                    setColorProfile(profile);
                    // Update user object so FitCheck can access the color profile
                    if (setUser) setUser(prev => ({ ...prev, colorProfile: profile }));
        setFaceAnalysisError(null);
        
        const seasonConfidencePercent = profile.seasonConfidence ? Math.round(profile.seasonConfidence * 100) : 0;
        
        // Show quality messages if present
        if (qualityMessages && qualityMessages.length > 0) {
          Alert.alert(
            'Photo Quality Tips',
            qualityMessages.join('\n\n'),
            [{ text: 'OK' }]
          );
        }
                    
                    if (profile.season) {
                      showBanner(
            `✓ Detected: ${profile.tone} undertone • ${profile.depth} depth • Suggested: ${profile.season} (${seasonConfidencePercent}% confidence)`,
                        'success'
                      );
                  } else {
                      // Don't show confidence when no season is detected
                      showBanner(
                        `✓ Detected: ${profile.tone} undertone • ${profile.depth} depth. Try a daylight selfie for season suggestion.`,
                        'success'
                      );
                    }
                  } else {
                    setIsAnalyzingFace(false);
                    setFaceAnalysisError('No face detected. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible\n\nOr choose your season manually.');
                    Alert.alert(
                      'Face Detection',
                      'We couldn\'t detect a face in this photo. Please try:\n\n• A clear daylight selfie\n• Good lighting\n• Face clearly visible\n\nOr choose your season manually.',
                      [{ text: 'OK' }]
                    );
                    showBanner('✕ No face detected. Please upload a clear face photo.', 'error');
                  }
                } catch (error) {
      console.error('🎨 [FACE CROP] Error in analysis:', error);
                  setIsAnalyzingFace(false);
      setColorProfile(null);
                  setFaceAnalysisError(`Failed to process photo: ${error.message || 'Unknown error'}`);
                  Alert.alert('Error', `Failed to process photo: ${error.message || 'Unknown error'}`);
                }
  };

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
                allowsEditing: false, // We'll use our custom crop UI
                quality: 0.9,
                cameraType: ImagePicker.CameraType.front
              });
              if (!res.canceled && res.assets[0]) {
                // Show crop screen with oval guide
                setImageToCrop(res.assets[0].uri);
                setShowFaceCrop(true);
              }
            } else {
              Alert.alert('Camera Permission', 'Please allow camera access to take a selfie.');
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            // Request permission - shows Apple's system alert
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert(
                'Photo Access Required',
                'Stylit needs access to your photos to upload a face photo for skin tone analysis. Please allow access in Settings.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() }
                ]
              );
              return;
            }
            
            const res = await ImagePicker.launchImageLibraryAsync({ 
              mediaTypes: ['images'],
              allowsEditing: false, // We'll use our custom crop UI
              quality: 0.9
            });
            if (!res.canceled && res.assets[0]) {
              // Show crop screen with oval guide
              setImageToCrop(res.assets[0].uri);
              setShowFaceCrop(true);
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const loadUserColorProfile = async () => {
    if (!user?.id) return;
    // Only load from database if we're not currently analyzing
    // This prevents showing cached results during analysis
    if (isAnalyzingFace) {
      return;
    }
    const profile = await loadColorProfile(user.id);
    if (profile) {
      setColorProfile(profile);
      // Update user object so FitCheck can access the color profile
      if (setUser) setUser(prev => ({ ...prev, colorProfile: profile }));
    }
  };

  // Fetch products matching user's color profile
  const loadColorProducts = async () => {
    if (!colorProfile?.season) {
      setColorProducts([]);
      return;
    }

    setIsLoadingColorProducts(true);
    try {
      // Get all color names from the user's season palette
      const organized = getOrganizedColors(colorProfile.season);
      const allColorNames = [
        ...organized.neutrals,
        ...organized.accents,
        ...organized.brights,
        ...organized.softs,
      ].map(c => c.name.toLowerCase());

      if (allColorNames.length === 0) {
        setColorProducts([]);
        setIsLoadingColorProducts(false);
        return;
      }

      // Fetch all garments from API
      const allGarments = await fetchGarmentsAsProducts({});
      
      // Filter garments by color - check if product color matches any of the user's colors
      const filteredProducts = allGarments.filter(product => {
        if (!product || !product.color) return false;
        
        const productColor = String(product.color).toLowerCase().trim();
        if (!productColor) return false;
        
        // Check if any of the user's color names appear in the product color
        return allColorNames.some(colorName => {
          // Direct match
          if (productColor === colorName) return true;
          // Partial match (e.g., "warm ivory" matches "ivory")
          if (productColor.includes(colorName) || colorName.includes(productColor)) return true;
          // Check for common color variations
          const colorVariations = {
            'warm ivory': ['ivory', 'cream', 'beige'],
            'cool ivory': ['ivory', 'white'],
            'camel': ['tan', 'beige', 'brown'],
            'terracotta': ['orange', 'rust', 'brick'],
            'dusty rose': ['rose', 'pink', 'mauve'],
            'sage': ['green', 'olive', 'mint'],
            'charcoal': ['gray', 'grey', 'black'],
            'snow white': ['white', 'ivory'],
            'cool black': ['black'],
          };
          
          const variations = colorVariations[colorName] || [];
          return variations.some(v => productColor.includes(v));
        });
      }).slice(0, 12); // Limit to 12 products

      setColorProducts(filteredProducts);
    } catch (error) {
      console.error('Error loading color products:', error);
      setColorProducts([]);
    } finally {
      setIsLoadingColorProducts(false);
    }
  };

  // Load products when color profile changes
  useEffect(() => {
    if (colorProfile?.season && !isAnalyzingFace) {
      loadColorProducts();
    } else {
      setColorProducts([]);
    }
  }, [colorProfile?.season, isAnalyzingFace]);

  // Helper function to calculate color distance (simple RGB distance)
  const colorDistance = (hex1, hex2) => {
    if (!hex1 || !hex2) return Infinity;
    
    const normalizeHex = (hex) => {
      let h = hex.replace('#', '');
      if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
      }
      return h;
    };
    
    const h1 = normalizeHex(hex1);
    const h2 = normalizeHex(hex2);
    
    const r1 = parseInt(h1.substring(0, 2), 16);
    const g1 = parseInt(h1.substring(2, 4), 16);
    const b1 = parseInt(h1.substring(4, 6), 16);
    
    const r2 = parseInt(h2.substring(0, 2), 16);
    const g2 = parseInt(h2.substring(2, 4), 16);
    const b2 = parseInt(h2.substring(4, 6), 16);
    
    // Calculate Euclidean distance in RGB space
    return Math.sqrt(
      Math.pow(r1 - r2, 2) + 
      Math.pow(g1 - g2, 2) + 
      Math.pow(b1 - b2, 2)
    );
  };

  // Load products for a specific color category using backend classification
  const loadCategoryProducts = async (category) => {
    if (!colorProfile?.season || !category) return;

    setIsLoadingCategoryProducts(prev => ({ ...prev, [category]: true }));
    try {
      // Use the new suggested-products API endpoint
      // This endpoint uses pre-computed Lab + ΔE classification stored in database
      const apiUrl = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
      
      if (apiUrl) {
        try {
          const baseUrl = apiUrl.replace(/\/$/, '');
          
          // Always use parent season for suggested products to show all matching clothes
          // This gives users more variety within their season (e.g., all autumn clothes, not just soft autumn)
          const apiUrlWithParams = `${baseUrl}/api/suggested-products?season=${colorProfile.season}&group=${category}&limit=20`;
          
          
          const response = await fetch(apiUrlWithParams);

          if (response.ok) {
            const data = await response.json();
            // Convert garments to product format using existing utility
            const products = (data.products || []).map(garment => {
              // Use fetchGarmentsAsProducts conversion logic
              const images = [];
              if (garment.image_url) images.push(garment.image_url);
              if (Array.isArray(garment.additional_images)) {
                images.push(...garment.additional_images.filter(img => img));
              }

              return {
                id: garment.id,
                name: garment.name || 'Unnamed Product',
                brand: garment.brand || 'Unknown Brand',
                price: garment.price || 0,
                rating: 4.5,
                category: garment.category,
                color: garment.color || '',
                colorHex: garment.color_hex || garment.colorHex || null,
                material: garment.material || '',
                image: images[0] || garment.image_url || '',
                images: images.length > 0 ? images : [garment.image_url || ''],
                buyUrl: garment.product_link || '',
                url: garment.product_link || '',
                product_link: garment.product_link || '',
                description: garment.description || '',
                garment_des: garment.description || '',
                garment_id: garment.id,
                fit: garment.fit_type || 'regular',
                fitType: garment.fit_type || 'regular',
                fabric: garment.material || '',
                fabricStretch: garment.fabric_stretch || 'none',
                tags: Array.isArray(garment.tags) ? garment.tags : (garment.tags ? [garment.tags] : []),
                is_active: garment.is_active !== false,
                created_at: garment.created_at,
                source: 'admin_garment',
              };
            });

            setCategoryProducts(prev => ({ ...prev, [category]: products }));
            return;
          }
        } catch (apiError) {
          console.warn('API call failed, falling back to client-side filtering:', apiError);
        }
      }

      // Fallback to old method if API URL not configured or API call failed
      console.warn('Using fallback client-side filtering');
      const organized = getOrganizedColors(colorProfile.season);
      const categoryColors = organized[category] || [];
      const colorNames = categoryColors.map(c => c.name.toLowerCase());

      if (colorNames.length === 0) {
        setCategoryProducts(prev => ({ ...prev, [category]: [] }));
        setIsLoadingCategoryProducts(prev => ({ ...prev, [category]: false }));
        return;
      }

      const allGarments = await fetchGarmentsAsProducts({});
      
      // Comprehensive color variations mapping for all palette colors
          const colorVariations = {
        // Spring Neutrals
        'warm ivory': ['ivory', 'cream', 'beige', 'off-white', 'ecru'],
        'cream': ['ivory', 'beige', 'off-white', 'ecru', 'warm ivory'],
        'light camel': ['camel', 'tan', 'beige', 'khaki', 'caramel'],
        'soft beige': ['beige', 'tan', 'camel', 'khaki', 'sand'],
        'golden sand': ['sand', 'tan', 'beige', 'camel', 'khaki'],
        // Spring Accents
        'coral': ['coral', 'salmon', 'peach', 'apricot', 'orange'],
        'peach': ['peach', 'coral', 'apricot', 'salmon', 'orange'],
        'warm rose': ['rose', 'pink', 'salmon', 'coral', 'blush'],
        'apricot': ['apricot', 'peach', 'orange', 'coral', 'salmon'],
        'melon': ['melon', 'coral', 'peach', 'salmon', 'orange'],
        // Spring Brights
        'cantaloupe': ['cantaloupe', 'orange', 'peach', 'apricot'],
        'warm yellow': ['yellow', 'gold', 'mustard', 'amber'],
        'bright aqua': ['aqua', 'turquoise', 'cyan', 'teal'],
        'light turquoise': ['turquoise', 'aqua', 'cyan', 'teal'],
        'sunny gold': ['gold', 'yellow', 'amber', 'mustard'],
        // Spring Softs
        'mint': ['mint', 'green', 'sage', 'seafoam'],
        'soft peach': ['peach', 'coral', 'apricot', 'salmon'],
        'light warm pink': ['pink', 'rose', 'blush', 'salmon'],
        'soft teal': ['teal', 'turquoise', 'aqua', 'cyan'],
        'buttercream': ['buttercream', 'cream', 'yellow', 'ivory'],
        // Summer Neutrals
        'cool ivory': ['ivory', 'white', 'off-white', 'cream'],
        'soft gray': ['gray', 'grey', 'silver', 'charcoal'],
        'rose beige': ['beige', 'rose', 'tan', 'taupe'],
        'misty taupe': ['taupe', 'beige', 'gray', 'brown'],
        'silver frost': ['silver', 'gray', 'grey', 'white'],
        // Summer Accents
        'dusty rose': ['rose', 'pink', 'mauve', 'blush'],
        'mauve': ['mauve', 'purple', 'lavender', 'plum'],
        'soft berry': ['berry', 'purple', 'plum', 'burgundy'],
        'lavender': ['lavender', 'purple', 'mauve', 'lilac'],
        'ballet pink': ['pink', 'rose', 'blush', 'salmon'],
        // Summer Brights
        'periwinkle': ['periwinkle', 'blue', 'lavender', 'purple'],
        'cool aqua': ['aqua', 'turquoise', 'cyan', 'teal'],
        'powder blue': ['blue', 'sky blue', 'baby blue', 'azure'],
        'soft fuchsia': ['fuchsia', 'pink', 'magenta', 'purple'],
        'strawberry ice': ['pink', 'rose', 'strawberry', 'blush'],
        // Summer Softs
        'blue gray': ['blue gray', 'slate', 'gray', 'grey'],
        'misty blue': ['blue', 'sky blue', 'powder blue', 'azure'],
        'heather': ['heather', 'gray', 'grey', 'purple'],
        'soft lilac': ['lilac', 'lavender', 'purple', 'mauve'],
        'cloud pink': ['pink', 'rose', 'blush', 'salmon'],
        // Autumn Neutrals
        'warm beige': ['beige', 'tan', 'camel', 'khaki'],
        'camel': ['camel', 'tan', 'beige', 'khaki', 'caramel'],
        'taupe': ['taupe', 'beige', 'brown', 'gray'],
        'mocha': ['mocha', 'brown', 'coffee', 'tan'],
        'olive': ['olive', 'green', 'sage', 'khaki'],
        // Autumn Accents
        'terracotta': ['terracotta', 'orange', 'rust', 'brick'],
        'rust': ['rust', 'orange', 'brown', 'terracotta'],
        'burnt orange': ['orange', 'rust', 'terracotta', 'brick'],
        'cinnamon': ['cinnamon', 'brown', 'tan', 'rust'],
        'copper': ['copper', 'orange', 'rust', 'bronze'],
        // Autumn Brights
        'pumpkin': ['pumpkin', 'orange', 'rust', 'terracotta'],
        'golden yellow': ['yellow', 'gold', 'amber', 'mustard'],
        'forest green': ['green', 'forest', 'emerald', 'olive'],
        'burgundy': ['burgundy', 'wine', 'maroon', 'red'],
        'deep teal': ['teal', 'turquoise', 'green', 'blue'],
        // Autumn Softs
        'sage': ['sage', 'green', 'olive', 'mint'],
        'muted gold': ['gold', 'yellow', 'amber', 'mustard'],
        // Winter Neutrals
        'snow white': ['white', 'ivory', 'off-white', 'cream'],
        'cool black': ['black', 'charcoal', 'navy'],
        'charcoal': ['charcoal', 'gray', 'grey', 'black'],
        'silver gray': ['silver', 'gray', 'grey', 'white'],
        'blue-gray': ['blue gray', 'slate', 'gray', 'grey'],
        // Winter Accents
        'fuchsia': ['fuchsia', 'pink', 'magenta', 'purple'],
        'berry': ['berry', 'purple', 'plum', 'burgundy'],
        'royal purple': ['purple', 'royal', 'plum', 'violet'],
        'crimson': ['crimson', 'red', 'burgundy', 'wine'],
        'electric magenta': ['magenta', 'pink', 'fuchsia', 'purple'],
        // Winter Brights
        'true red': ['red', 'crimson', 'scarlet', 'cherry'],
        'sapphire blue': ['blue', 'navy', 'royal blue', 'cobalt'],
        'emerald': ['emerald', 'green', 'jade', 'forest'],
        'icy teal': ['teal', 'turquoise', 'aqua', 'cyan'],
        'lemon ice': ['yellow', 'lemon', 'gold', 'amber'],
        // Winter Softs
        'icy lavender': ['lavender', 'purple', 'mauve', 'lilac'],
        'ice pink': ['pink', 'rose', 'blush', 'salmon'],
        'frost blue': ['blue', 'sky blue', 'powder blue', 'azure'],
        'soft wine': ['wine', 'burgundy', 'maroon', 'red'],
        'cool plum': ['plum', 'purple', 'burgundy', 'wine'],
          };

      const filteredProducts = allGarments.filter(product => {
        if (!product) return false;
        
        // Method 1: Hex-based color matching (most accurate)
        if (product.colorHex) {
          const productHex = String(product.colorHex).toLowerCase().trim();
          const matchesHex = colorHexes.some(categoryHex => {
            const distance = colorDistance(productHex, categoryHex);
            // Accept colors within a distance threshold (adjustable)
            return distance < 80; // Threshold for color similarity
          });
          if (matchesHex) return true;
        }
        
        // Method 2: Name-based color matching (fallback)
        if (product.color) {
          const productColor = String(product.color).toLowerCase().trim();
          
          // Direct name match
          if (colorNames.some(colorName => productColor === colorName)) {
            return true;
          }
          
          // Partial name match
          if (colorNames.some(colorName => {
            if (productColor.includes(colorName) || colorName.includes(productColor)) {
              return true;
            }
            // Check color variations
          const variations = colorVariations[colorName] || [];
            return variations.some(v => productColor.includes(v) || v.includes(productColor));
          })) {
            return true;
          }
        }
        
        return false;
      });

      // Sort by relevance (products with hex match first, then name match)
      const sortedProducts = filteredProducts.sort((a, b) => {
        const aHasHex = a.colorHex ? 1 : 0;
        const bHasHex = b.colorHex ? 1 : 0;
        return bHasHex - aHasHex; // Hex matches first
      });

      setCategoryProducts(prev => ({ ...prev, [category]: sortedProducts.slice(0, 20) }));
    } catch (error) {
      console.error(`Error loading ${category} products:`, error);
      setCategoryProducts(prev => ({ ...prev, [category]: [] }));
    } finally {
      setIsLoadingCategoryProducts(prev => ({ ...prev, [category]: false }));
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
      
      // Get list of friend IDs (already accepted friends)
      const friendIds = new Set(friendsList.map(f => f.friend_id));
      
      // Load sent friend requests (only pending, exclude already accepted)
      const { data: sentData } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      if (sentData && sentData.length > 0) {
        // Filter out requests that are already in friends list
        const filteredSent = sentData.filter(req => !friendIds.has(req.friend_id));
        
        if (filteredSent.length > 0) {
          // Batch check reverse friendships for all sent requests
          const friendIdsToCheck = filteredSent.map(req => req.friend_id);
          const { data: reverseFriendships } = await supabase
            .from('friends')
            .select('user_id, friend_id')
            .in('user_id', friendIdsToCheck)
            .eq('friend_id', user.id)
            .eq('status', 'accepted');
          
          // Create a set of friend IDs that have accepted
          const acceptedFriendIds = new Set(
            reverseFriendships?.map(rf => rf.user_id) || []
          );
          
          // Separate into pending and accepted
          const pendingSent = [];
          const updates = [];
          
          for (const req of filteredSent) {
            if (acceptedFriendIds.has(req.friend_id)) {
              // This request has been accepted, mark for update
              updates.push(req.id);
            } else {
              // Still pending
              pendingSent.push(req);
            }
          }
          
          // Batch update all accepted requests
          if (updates.length > 0) {
            await supabase
              .from('friends')
              .update({ status: 'accepted' })
              .in('id', updates);
          }
          
          if (pendingSent.length > 0) {
            const friendIdsToFetch = pendingSent.map(req => req.friend_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name, email, avatar_url')
              .in('id', friendIdsToFetch);
            
            const sent = pendingSent.map(req => {
              const profile = profiles?.find(p => p.id === req.friend_id);
              return {
                id: req.id,
                friend_id: req.friend_id,
                friend_name: profile?.name || profile?.email?.split('@')[0] || 'User',
                friend_email: profile?.email,
                friend_avatar: profile?.avatar_url,
                status: req.status,
                created_at: req.created_at
              };
            });
            setSentRequests(sent);
            // Sync local pending requests with server state
            setLocalPendingRequests(new Set(sent.map(req => req.friend_id)));
          } else {
            setSentRequests([]);
            // Clear local pending requests if none are pending
            setLocalPendingRequests(new Set());
          }
        } else {
          setSentRequests([]);
          setLocalPendingRequests(new Set());
        }
      } else {
        setSentRequests([]);
        setLocalPendingRequests(new Set());
      }
      
      // Load received friend requests (only pending, exclude already accepted)
      const { data: receivedData } = await supabase
        .from('friends')
        .select('*')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      
      if (receivedData && receivedData.length > 0) {
        // Filter out requests where we're already friends
        const pendingReceived = receivedData.filter(req => !friendIds.has(req.user_id));
        
        if (pendingReceived.length > 0) {
          const userIdsToFetch = pendingReceived.map(req => req.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url')
            .in('id', userIdsToFetch);
          
          const received = pendingReceived.map(req => {
            const profile = profiles?.find(p => p.id === req.user_id);
            return {
              id: req.id,
              user_id: req.user_id,
              friend_name: profile?.name || profile?.email?.split('@')[0] || 'User',
              friend_email: profile?.email,
              friend_avatar: profile?.avatar_url,
              status: req.status,
              created_at: req.created_at
            };
          });
          setReceivedRequests(received);
        } else {
          setReceivedRequests([]);
        }
      } else {
        setReceivedRequests([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
      setSentRequests([]);
      setReceivedRequests([]);
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
        return;
      }

      if (data && data.length > 0) {
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
      }
    } catch (error) {
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
        return;
      }
      
      // Only update if we got data back
      if (data && data.length > 0 && setSavedFits) {
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
      }
    } catch (error) {
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
                    
                    // Optimistic update
                    setActivePods(prev => prev.filter(p => p.id !== item.id));
                    setPastPods(prev => prev.filter(p => p.id !== item.id));
                    
                    try {
                        // Use the deletePod function from lib/pods.ts
                        const success = await deletePod(item.id);
                        
                        if (success) {
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
        
        // Helper to convert inches to display unit
        // Returns raw numeric string (not formatted) so it can be edited properly
        const convertForDisplay = (inchesValue, fallbackOldValue, isHeight = false) => {
          let inches = null;
          
          // First, try to get inches from new field
          if (inchesValue != null && inchesValue !== '') {
            const num = Number(inchesValue);
            if (!isNaN(num) && num > 0) {
              inches = num;
            }
          }
          
          // Fallback to old field if new field doesn't exist
          if (inches == null && fallbackOldValue != null && fallbackOldValue !== '') {
            const oldValue = Number(fallbackOldValue);
            if (!isNaN(oldValue) && oldValue > 0) {
              // For height fallback, try to parse it
              if (isHeight) {
                const parsed = parseHeightToInches(oldValue);
                if (parsed != null) {
                  inches = parsed;
                } else {
                  // Old values were likely in cm, convert to inches
                  inches = oldValue / 2.54;
                }
              } else {
                // Old values were in cm, convert to inches
                inches = oldValue / 2.54;
              }
            }
          }
          
          if (inches == null || inches <= 0) {
            return '';
          }
          
          // Special handling for height: convert to feet.inches format for display
          if (isHeight) {
            const feet = Math.floor(inches / 12);
            const remainingInches = Math.round(inches % 12);
            return `${feet}.${remainingInches}`; // e.g., "5.4" for 5'4"
          }
          
          // Convert to display unit (cm or inches) - return as string without excessive decimals
          if (measurementUnit === 'cm') {
            const cm = inches * 2.54;
            // Remove trailing zeros but keep at least one decimal place if needed
            return cm % 1 === 0 ? cm.toString() : parseFloat(cm.toFixed(1)).toString();
          } else {
            // Return inches - remove trailing zeros but keep precision
            return inches % 1 === 0 ? inches.toString() : parseFloat(inches.toFixed(2)).toString();
          }
        };
        
        // Set measurement unit based on what's in the database (default to inches)
        // If old cm fields exist, user might prefer cm, but we'll default to inches
        const hasOldFields = data.chest || data.waist || data.hips;
        if (hasOldFields && !data.chest_in) {
          // Old data exists, might want to show in cm initially
          // But we'll default to inches for consistency
        }
        
        setFitProfile({
          height: convertForDisplay(data.height_in, data.height, true),
          gender: data.gender || '',
          topSize: data.top_size || '',
          bottomSize: data.bottom_size || '',
          chest: convertForDisplay(data.chest_in, data.chest_circ_in, data.chest),
          waist: convertForDisplay(data.waist_in, data.waist_circ_in, data.waist),
          hips: convertForDisplay(data.hips_in, data.hip_circ_in, data.hips),
          shoulder: convertForDisplay(data.shoulder_in, data.shoulder_width_in, data.shoulder),
          sleeve: convertForDisplay(data.sleeve_in, data.sleeve_length_in, data.sleeve),
          inseam: convertForDisplay(data.inseam_in, data.inseam),
          thigh: convertForDisplay(data.thigh_in, data.thigh_circ_in, data.thigh),
          fit_preference: data.fit_preference || '',
          notes: data.notes || '',
          bodyShape: data.body_shape || ''
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
  
  // Check if we should open Edit Fit Profile modal (from AskAISheet)
  useEffect(() => {
    const checkOpenFitProfile = async () => {
      const shouldOpen = await AsyncStorage.getItem('openFitProfile');
      if (shouldOpen === 'true') {
        setShowFitProfile(true);
        await AsyncStorage.removeItem('openFitProfile');
      }
    };
    checkOpenFitProfile();
  }, []);

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
      
      // Combine past pods and deduplicate by ID, then sort by created_at (most recent first)
      const allPastPods = [...expiredFromActive, ...(past || [])];
      const uniquePastPods = Array.from(
        new Map(allPastPods.map(pod => [pod.id, pod])).values()
      );
      uniquePastPods.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setActivePods(trulyActive);
      setPastPods(uniquePastPods);
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
      <SafeImage 
        source={imageSource} 
        style={styles.fitImage} 
        resizeMode="cover"
        width={160}  // Thumbnail width for saved fits
        height={200} // Thumbnail height for saved fits
        quality={85} // Good quality for saved fits
      />
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
      <SafeImage 
        source={imageSource} 
        style={styles.boardImage} 
        resizeMode="cover"
        width={200}  // Thumbnail width for boards
        height={240} // Thumbnail height for boards
        quality={85} // Good quality for boards
      />
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
        <SafeImage 
          source={imageSource} 
          style={styles.podImage} 
          resizeMode="cover"
          width={200}  // Thumbnail width for pods
          height={200} // Thumbnail height for pods
          quality={85} // Good quality for pods
        />
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
        {/* SECTION 1: IDENTITY */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }} />
            <Pressable 
              onPress={() => setShowEditProfileModal(true)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>

          <Pressable 
            style={styles.avatarContainer}
            onPress={() => setShowEditProfileModal(true)}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6', '#ec4899']}
              style={styles.avatarGradient}
            >
              <View style={styles.avatar}>
                {profilePic && typeof profilePic === 'string' ? (
                  <SafeImage 
                    source={{ uri: profilePic }} 
                    style={styles.avatarImage} 
                    resizeMode="cover"
                    onError={() => setProfilePic(null)}
                  />
                ) : null}
                {(!profilePic || typeof profilePic !== 'string') && (
                  <Text style={styles.avatarText}>{username ? username[0].toUpperCase() : 'U'}</Text>
                )}
              </View>
            </LinearGradient>
          </Pressable>
          
          <Text style={styles.greeting}>Hey, {username} 👋</Text>
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
          
          {/* AI-generated style summary */}
          {isLoadingProfile ? (
            <View style={{ marginTop: 8, height: 14, width: 200, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 4 }} />
          ) : getStyleSummary() ? (
            <Text style={[styles.subtitle, { fontSize: 11, marginTop: 8, color: '#9ca3af', fontStyle: 'italic' }]}>
              {getStyleSummary()}
            </Text>
          ) : null}
        </View>

        {/* SECTION 2: YOUR STYLE DNA */}
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

          {/* Your Colors - Redesigned to match image */}
          <View style={styles.colorSectionNew}>
            {/* Show content immediately if we have colorProfile, regardless of loading state */}
            {/* Loading state - only show if truly loading with no data */}
            {!colorProfile && isLoadingProfile && !faceImage && !isAnalyzingFace ? (
              <View style={styles.colorAnalyzingState}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.colorAnalyzingText}>Loading your colors...</Text>
              </View>
            ) : !colorProfile && !faceImage && !isAnalyzingFace && !faceAnalysisError ? (
                <View style={styles.colorEmptyStateContainer}>
                  <Text style={styles.colorEmptyTitle}>🎨 Your Colors</Text>
                  <Text style={styles.colorEmptyText}>
                    Upload a face photo to analyze your skin tone and discover your best colors.
                  </Text>
                  <Pressable 
                    style={styles.colorEmptyUploadBtn}
                    onPress={() => setShowFacePhotoGuidelines(true)}
                  >
                    <Text style={styles.colorEmptyUploadBtnText}>📸 Upload Face Photo</Text>
                  </Pressable>
                </View>
              ) : !colorProfile && !isAnalyzingFace && !faceAnalysisError ? (
                <Text style={styles.colorEmptyText}>
                  Add a face photo to discover your color season, undertone, and best colors to wear.
                </Text>
              ) : isAnalyzingFace ? (
                <View style={styles.colorAnalyzingState}>
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={styles.colorAnalyzingText}>Analyzing your face photo...</Text>
                </View>
              ) : faceAnalysisError ? (
                <Text style={styles.colorErrorText}>{faceAnalysisError}</Text>
              ) : colorProfile && colorProfile.season ? (
                <>
                  {/* Top Title: Your Colors + Quick Check Button */}
                  <View style={styles.colorTopSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.colorMainTitle}>🎨 Your Colors</Text>
                      <Pressable
                        style={styles.quickColorCheckBtn}
                        onPress={() => setShowQuickColorCheck(true)}
                      >
                        <Text style={styles.quickColorCheckBtnText}>📷 Quick Check</Text>
                      </Pressable>
                    </View>
                    
                    {/* Analysed Season Row: Skin Tone Info (left) + Face Photo (right) */}
                    <View style={styles.colorSeasonInfoRow}>
                      {/* Skin Tone Info - Left */}
                      <View style={styles.colorSeasonInfoRight}>
                        <Text style={styles.colorSeasonInfoText}>
                          Analysed Skin tone = {colorProfile.season.charAt(0).toUpperCase() + colorProfile.season.slice(1)}
                        </Text>
                        {colorProfile.seasonConfidence && (
                          <Text style={styles.colorSeasonInfoConfidence}>
                            Confidence = {Math.round(colorProfile.seasonConfidence * 100)}%
                          </Text>
                        )}
                      </View>
                      
                      {/* Face Photo - Right (styled like body photo) */}
                      <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
                        <Pressable onPress={() => setShowFacePhotoGuidelines(true)} disabled={isAnalyzingFace}>
                          {isAnalyzingFace ? (
                            <View style={[styles.faceThumbnailNew, styles.faceThumbnailLoading]}>
                              <ActivityIndicator size="small" color="#6366f1" />
                            </View>
                          ) : faceImage ? (
                            <View style={{ position: 'relative' }}>
                              <View style={styles.faceThumbnailNew}>
                                <OptimizedImage 
                                  source={{ uri: faceImage }} 
                                  style={styles.faceThumbnailImage}
                                  onError={() => setFaceImage(null)}
                                />
                              </View>
                              {/* Edit Icon */}
                              <Pressable
                                style={styles.photoEditIcon}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setShowFacePhotoGuidelines(true);
                                }}
                              >
                                <Text style={styles.photoEditIconText}>✏️</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <View style={[styles.faceThumbnailNew, styles.faceThumbnailPlaceholder]}>
                              <Text style={styles.faceThumbnailIcon}>📸</Text>
                            </View>
                          )}
                        </Pressable>
                        <Text style={[styles.facePhotoLabel, { marginTop: 4 }]}>Your Face Photo</Text>
                      </View>
                    </View>
                    {colorProfile.needsConfirmation ? (
                      <View>
                        <Text style={styles.colorNoteText}>
                          <Text style={styles.colorNoteTextRed}>This is a suggested season. </Text>
                          <Text>Want more accurate results?</Text>
                        </Text>
                        <Pressable
                          style={styles.improveAccuracyBtn}
                          onPress={() => setShowMultiPhotoModal(true)}
                        >
                          <Text style={styles.improveAccuracyBtnText}>📸 Add 2 More Photos for Better Accuracy</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.colorNoteText}>
                          <Text>Want even more accurate results? </Text>
                          <Text 
                            style={styles.colorNoteTextBtn}
                            onPress={() => setShowMultiPhotoModal(true)}
                          >
                            Add more photos
                          </Text>
                          <Text> or </Text>
                          <Text 
                            style={styles.colorNoteTextBtn}
                            onPress={() => setShowSeasonPicker(true)}
                          >
                            edit manually
                          </Text>
                          <Text>.</Text>
                        </Text>
                      </View>
                    )}
                </View>
                
                  {/* Clickable Trait Chips: Undertone, Depth, Clarity - Horizontal Scroll */}
                  <View style={styles.traitsRowWrapTight}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.traitsRowContent}
                    >
                      <Pressable 
                        style={[styles.traitChip, expandedBanner === 'undertone' && styles.traitChipActive]}
                        onPress={() => setExpandedBanner(expandedBanner === 'undertone' ? null : 'undertone')}
                      >
                        <Text style={styles.traitChipText} numberOfLines={1} ellipsizeMode="tail">
                          Undertone: {colorProfile.tone ? colorProfile.tone.charAt(0).toUpperCase() + colorProfile.tone.slice(1) : '—'}
                    </Text>
                        <Text style={styles.traitChipArrow}>
                          {expandedBanner === 'undertone' ? '▲' : '▼'}
                    </Text>
                      </Pressable>
                      <Pressable 
                        style={[styles.traitChip, expandedBanner === 'depth' && styles.traitChipActive]}
                        onPress={() => setExpandedBanner(expandedBanner === 'depth' ? null : 'depth')}
                      >
                        <Text style={styles.traitChipText} numberOfLines={1} ellipsizeMode="tail">
                          Depth: {colorProfile.depth ? colorProfile.depth.charAt(0).toUpperCase() + colorProfile.depth.slice(1) : '—'}
                    </Text>
                        <Text style={styles.traitChipArrow}>
                          {expandedBanner === 'depth' ? '▲' : '▼'}
                        </Text>
                      </Pressable>
                      <Pressable 
                        style={[styles.traitChip, expandedBanner === 'clarity' && styles.traitChipActive]}
                        onPress={() => setExpandedBanner(expandedBanner === 'clarity' ? null : 'clarity')}
                      >
                        <Text style={styles.traitChipText} numberOfLines={1} ellipsizeMode="tail">
                          Clarity: {(colorProfile.clarity || 'muted').charAt(0).toUpperCase() + (colorProfile.clarity || 'muted').slice(1)}
                        </Text>
                        <Text style={styles.traitChipArrow}>
                          {expandedBanner === 'clarity' ? '▲' : '▼'}
                        </Text>
                      </Pressable>
                    </ScrollView>
                      </View>

                  {/* What this means - shown when banner is clicked */}
                  {expandedBanner && (() => {
                    const { getUndertoneExplanation, getDepthExplanation, getClarityExplanation } = require('../lib/colorTraitExplanations');
                    
                    let explanation = null;
                    if (expandedBanner === 'undertone') {
                      explanation = getUndertoneExplanation(colorProfile.tone || 'warm', colorProfile.tone === 'neutral' ? 'warm' : null);
                    } else if (expandedBanner === 'depth') {
                      explanation = getDepthExplanation(colorProfile.depth || 'medium');
                    } else if (expandedBanner === 'clarity') {
                      explanation = getClarityExplanation(colorProfile.clarity || 'muted');
                    }
                    
                    if (!explanation) return null;
                    
                    return (
                      <View style={styles.colorExplanationCard}>
                        <Text style={styles.colorExplanationTextNew}>
                          {explanation.definition}
                        </Text>
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.colorExplanationBullet}>• {explanation.bullet1}</Text>
                          <Text style={styles.colorExplanationBullet}>• {explanation.bullet2}</Text>
                          <Text style={styles.colorExplanationBullet}>• {explanation.bullet3}</Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Spring's Colors for you */}
                  <Text style={styles.colorSeasonTitle}>
                    {colorProfile.season.charAt(0).toUpperCase() + colorProfile.season.slice(1)}'s Colors for you
                  </Text>

                  {/* Color Category Cards */}
                  {(() => {
                    const organized = getOrganizedColors(colorProfile.season, colorProfile.depth, colorProfile.clarity);
                    const userMicroSeason = colorProfile.microSeason || (determineMicroSeason ? determineMicroSeason(colorProfile.season, colorProfile.depth, colorProfile.clarity) : null);
                    return (
                      <>
                        {organized.neutrals.length > 0 && (() => {
                          // Use a subtle dark background for better swatch visibility
                          const bgColor = 'rgba(30, 30, 35, 0.85)';
                          const secondaryNeutralsGrouped = getSecondaryColorsGrouped(colorProfile.season, userMicroSeason, 'neutrals');
                          return (
                            <View style={[styles.colorCategoryCard, { backgroundColor: bgColor }]}>
                              {/* Category heading with See Secondary Colors button */}
                              <View style={styles.colorCategoryHeader}>
                                <Text style={styles.colorCategoryNameNeutrals}>Neutrals</Text>
                                <Pressable onPress={() => toggleSecondaryColors('neutrals')}>
                                  <Text style={styles.secondaryColorsBtn}>
                                    {showSecondaryColors.neutrals ? 'Hide Secondary' : 'Show Secondary Colors'}
                                  </Text>
                                </Pressable>
                              </View>
                              {/* Primary colors - horizontal scroll */}
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.swatchScrollContent}
                              >
                                {organized.neutrals.map((color, idx) => (
                                  <View key={`primary-${idx}`} style={styles.swatchItem}>
                                    <View style={[styles.swatchDot, { backgroundColor: color.hex }]} />
                                    <Text style={styles.swatchName} numberOfLines={2}>
                                      {color.name}
                                    </Text>
                                  </View>
                                ))}
                              </ScrollView>
                              {/* Secondary colors - shown in rows when expanded */}
                              {showSecondaryColors.neutrals && secondaryNeutralsGrouped.length > 0 && (
                                <View style={styles.secondaryColorsContainer}>
                                  {secondaryNeutralsGrouped.map((microSeasonColors, groupIdx) => (
                                    <ScrollView 
                                      key={`group-${groupIdx}`}
                                      horizontal 
                                      showsHorizontalScrollIndicator={false} 
                                      contentContainerStyle={styles.swatchScrollContentSecondary}
                                    >
                                      {microSeasonColors.map((color, idx) => (
                                        <View key={`secondary-${groupIdx}-${idx}`} style={styles.swatchItem}>
                                          <View style={[styles.swatchDot, styles.swatchDotSecondary, { backgroundColor: color.hex }]} />
                                          <Text style={[styles.swatchName, styles.swatchNameSecondary]} numberOfLines={2}>
                                            {color.name}
                                          </Text>
                                        </View>
                                      ))}
                                    </ScrollView>
                                  ))}
                                </View>
                              )}
                              {/* Divider line above Suggested Products */}
                              <View style={styles.productsDivider} />
                              {/* Suggested Products Button - like + Create button */}
                              <Pressable 
                                onPress={() => {
                                  if (expandedCategoryProducts === 'neutrals') {
                                    setExpandedCategoryProducts(null);
                                  } else {
                                    setExpandedCategoryProducts('neutrals');
                                    if (!categoryProducts.neutrals || categoryProducts.neutrals.length === 0) {
                                      loadCategoryProducts('neutrals');
                                    }
                                  }
                                }}
                              >
                                <Text style={styles.productsBtnTextSimple}>
                                  {expandedCategoryProducts === 'neutrals' ? 'Hide products' : 'Suggested products'}
                        </Text>
                              </Pressable>
                              {/* Products Grid - shown when button is clicked */}
                              {expandedCategoryProducts === 'neutrals' && (
                                <View style={styles.productsArea}>
                                  {isLoadingCategoryProducts.neutrals ? (
                                    <ActivityIndicator size="small" color="#6366f1" />
                                  ) : categoryProducts.neutrals && categoryProducts.neutrals.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                      {categoryProducts.neutrals.map((product, idx) => (
                                        <Pressable
                                          key={product.id || idx}
                                          style={styles.colorProductCardSmall}
                                          onPress={() => {
                                            setCurrentProduct(product);
                                            setRoute('product');
                                          }}
                                        >
                                          {(product.image || product.imageUrl || product.image_url) ? (
                                            <OptimizedImage
                                              source={{ uri: product.image || product.imageUrl || product.image_url }}
                                              style={styles.colorProductImageSmall}
                                              resizeMode="cover"
                                            />
                                          ) : (
                                            <View style={[styles.colorProductImageSmall, styles.colorProductPlaceholderSmall]}>
                                              <Text>🛍️</Text>
                                            </View>
                                          )}
                                        </Pressable>
                                      ))}
                                    </ScrollView>
                                  ) : (
                                    <View style={styles.colorProductsEmptySmall}>
                                      <Text style={styles.colorProductsEmptyTextSmall}>No products available for this color category</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}

                        {/* Accents */}
                        {organized.accents.length > 0 && (() => {
                          // Use a subtle dark background for better swatch visibility
                          const bgColor = 'rgba(30, 30, 35, 0.85)';
                          const secondaryAccentsGrouped = getSecondaryColorsGrouped(colorProfile.season, userMicroSeason, 'accents');
                          return (
                            <View style={[styles.colorCategoryCard, { backgroundColor: bgColor }]}>
                              <View style={styles.colorCategoryHeader}>
                                <Text style={styles.colorCategoryName}>Accents</Text>
                                <Pressable onPress={() => toggleSecondaryColors('accents')}>
                                  <Text style={styles.secondaryColorsBtn}>
                                    {showSecondaryColors.accents ? 'Hide Secondary' : 'Show Secondary Colors'}
                                  </Text>
                                </Pressable>
                              </View>
                              {/* Primary colors - horizontal scroll */}
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.swatchScrollContent}
                              >
                                {organized.accents.map((color, idx) => (
                                  <View key={`primary-${idx}`} style={styles.swatchItem}>
                                    <View style={[styles.swatchDot, { backgroundColor: color.hex }]} />
                                    <Text style={styles.swatchName} numberOfLines={2}>
                                      {color.name}
                                    </Text>
                                  </View>
                                ))}
                              </ScrollView>
                              {/* Secondary colors - shown in rows when expanded */}
                              {showSecondaryColors.accents && secondaryAccentsGrouped.length > 0 && (
                                <View style={styles.secondaryColorsContainer}>
                                  {secondaryAccentsGrouped.map((microSeasonColors, groupIdx) => (
                                    <ScrollView 
                                      key={`group-${groupIdx}`}
                                      horizontal 
                                      showsHorizontalScrollIndicator={false} 
                                      contentContainerStyle={styles.swatchScrollContentSecondary}
                                    >
                                      {microSeasonColors.map((color, idx) => (
                                        <View key={`secondary-${groupIdx}-${idx}`} style={styles.swatchItem}>
                                          <View style={[styles.swatchDot, styles.swatchDotSecondary, { backgroundColor: color.hex }]} />
                                          <Text style={[styles.swatchName, styles.swatchNameSecondary]} numberOfLines={2}>
                                            {color.name}
                                          </Text>
                                        </View>
                                      ))}
                                    </ScrollView>
                                  ))}
                                </View>
                              )}
                              <View style={styles.productsDivider} />
                              <Pressable 
                                onPress={() => {
                                  if (expandedCategoryProducts === 'accents') {
                                    setExpandedCategoryProducts(null);
                                  } else {
                                    setExpandedCategoryProducts('accents');
                                    if (!categoryProducts.accents || categoryProducts.accents.length === 0) {
                                      loadCategoryProducts('accents');
                                    }
                                  }
                                }}
                              >
                                <Text style={styles.productsBtnTextSimple}>
                                  {expandedCategoryProducts === 'accents' ? 'Hide products' : 'Suggested products'}
                          </Text>
                              </Pressable>
                              {expandedCategoryProducts === 'accents' && (
                                <View style={styles.productsArea}>
                                  {isLoadingCategoryProducts.accents ? (
                                    <ActivityIndicator size="small" color="#6366f1" />
                                  ) : categoryProducts.accents && categoryProducts.accents.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                      {categoryProducts.accents.map((product, idx) => (
                                        <Pressable
                                          key={product.id || idx}
                                          style={styles.colorProductCardSmall}
                                          onPress={() => {
                                            setCurrentProduct(product);
                                            setRoute('product');
                                          }}
                                        >
                                          {(product.image || product.imageUrl || product.image_url) ? (
                                            <OptimizedImage
                                              source={{ uri: product.image || product.imageUrl || product.image_url }}
                                              style={styles.colorProductImageSmall}
                                              resizeMode="cover"
                                            />
                                          ) : (
                                            <View style={[styles.colorProductImageSmall, styles.colorProductPlaceholderSmall]}>
                                              <Text>🛍️</Text>
                        </View>
                      )}
                                        </Pressable>
                                      ))}
                                    </ScrollView>
                                  ) : (
                                    <View style={styles.colorProductsEmptySmall}>
                                      <Text style={styles.colorProductsEmptyTextSmall}>No products available for this color category</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}

                        {/* Brights */}
                        {organized.brights.length > 0 && (() => {
                          // Use a subtle dark background for better swatch visibility
                          const bgColor = 'rgba(30, 30, 35, 0.85)';
                          const secondaryBrightsGrouped = getSecondaryColorsGrouped(colorProfile.season, userMicroSeason, 'brights');
                          return (
                            <View style={[styles.colorCategoryCard, { backgroundColor: bgColor }]}>
                              <View style={styles.colorCategoryHeader}>
                                <Text style={styles.colorCategoryName}>Brights</Text>
                                <Pressable onPress={() => toggleSecondaryColors('brights')}>
                                  <Text style={styles.secondaryColorsBtn}>
                                    {showSecondaryColors.brights ? 'Hide Secondary' : 'Show Secondary Colors'}
                                  </Text>
                                </Pressable>
                              </View>
                              {/* Primary colors - horizontal scroll */}
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.swatchScrollContent}
                              >
                                {organized.brights.map((color, idx) => (
                                  <View key={`primary-${idx}`} style={styles.swatchItem}>
                                    <View style={[styles.swatchDot, { backgroundColor: color.hex }]} />
                                    <Text style={styles.swatchName} numberOfLines={2}>
                                      {color.name}
                                    </Text>
                                  </View>
                                ))}
                              </ScrollView>
                              {/* Secondary colors - shown in rows when expanded */}
                              {showSecondaryColors.brights && secondaryBrightsGrouped.length > 0 && (
                                <View style={styles.secondaryColorsContainer}>
                                  {secondaryBrightsGrouped.map((microSeasonColors, groupIdx) => (
                                    <ScrollView 
                                      key={`group-${groupIdx}`}
                                      horizontal 
                                      showsHorizontalScrollIndicator={false} 
                                      contentContainerStyle={styles.swatchScrollContentSecondary}
                                    >
                                      {microSeasonColors.map((color, idx) => (
                                        <View key={`secondary-${groupIdx}-${idx}`} style={styles.swatchItem}>
                                          <View style={[styles.swatchDot, styles.swatchDotSecondary, { backgroundColor: color.hex }]} />
                                          <Text style={[styles.swatchName, styles.swatchNameSecondary]} numberOfLines={2}>
                                            {color.name}
                                          </Text>
                                        </View>
                                      ))}
                                    </ScrollView>
                                  ))}
                                </View>
                              )}
                              <View style={styles.productsDivider} />
                              <Pressable 
                                onPress={() => {
                                  if (expandedCategoryProducts === 'brights') {
                                    setExpandedCategoryProducts(null);
                                  } else {
                                    setExpandedCategoryProducts('brights');
                                    if (!categoryProducts.brights || categoryProducts.brights.length === 0) {
                                      loadCategoryProducts('brights');
                                    }
                                  }
                                }}
                              >
                                <Text style={styles.productsBtnTextSimple}>
                                  {expandedCategoryProducts === 'brights' ? 'Hide products' : 'Suggested products'}
                                </Text>
                              </Pressable>
                              {expandedCategoryProducts === 'brights' && (
                                <View style={styles.productsArea}>
                                  {isLoadingCategoryProducts.brights ? (
                                    <ActivityIndicator size="small" color="#6366f1" />
                                  ) : categoryProducts.brights && categoryProducts.brights.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                      {categoryProducts.brights.map((product, idx) => (
                                        <Pressable
                                          key={product.id || idx}
                                          style={styles.colorProductCardSmall}
                                          onPress={() => {
                                            setCurrentProduct(product);
                                            setRoute('product');
                                          }}
                                        >
                                          {(product.image || product.imageUrl || product.image_url) ? (
                                            <OptimizedImage
                                              source={{ uri: product.image || product.imageUrl || product.image_url }}
                                              style={styles.colorProductImageSmall}
                                              resizeMode="cover"
                                            />
                                          ) : (
                                            <View style={[styles.colorProductImageSmall, styles.colorProductPlaceholderSmall]}>
                                              <Text>🛍️</Text>
                                            </View>
                                          )}
                                        </Pressable>
                                      ))}
                                    </ScrollView>
                                  ) : (
                                    <View style={styles.colorProductsEmptySmall}>
                                      <Text style={styles.colorProductsEmptyTextSmall}>No products available for this color category</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}

                        {/* Softs */}
                        {organized.softs.length > 0 && (() => {
                          // Use a subtle dark background for better swatch visibility
                          const bgColor = 'rgba(30, 30, 35, 0.85)';
                          const secondarySoftsGrouped = getSecondaryColorsGrouped(colorProfile.season, userMicroSeason, 'softs');
                          return (
                            <View style={[styles.colorCategoryCard, { marginBottom: 0, backgroundColor: bgColor }]}>
                              <View style={styles.colorCategoryHeader}>
                                <Text style={styles.colorCategoryName}>Softs</Text>
                                <Pressable onPress={() => toggleSecondaryColors('softs')}>
                                  <Text style={styles.secondaryColorsBtn}>
                                    {showSecondaryColors.softs ? 'Hide Secondary' : 'Show Secondary Colors'}
                                  </Text>
                                </Pressable>
                              </View>
                              {/* Primary colors - horizontal scroll */}
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.swatchScrollContent}
                              >
                                {organized.softs.map((color, idx) => (
                                  <View key={`primary-${idx}`} style={styles.swatchItem}>
                                    <View style={[styles.swatchDot, { backgroundColor: color.hex }]} />
                                    <Text style={styles.swatchName} numberOfLines={2}>
                                      {color.name}
                                    </Text>
                                  </View>
                                ))}
                              </ScrollView>
                              {/* Secondary colors - shown in rows when expanded */}
                              {showSecondaryColors.softs && secondarySoftsGrouped.length > 0 && (
                                <View style={styles.secondaryColorsContainer}>
                                  {secondarySoftsGrouped.map((microSeasonColors, groupIdx) => (
                                    <ScrollView 
                                      key={`group-${groupIdx}`}
                                      horizontal 
                                      showsHorizontalScrollIndicator={false} 
                                      contentContainerStyle={styles.swatchScrollContentSecondary}
                                    >
                                      {microSeasonColors.map((color, idx) => (
                                        <View key={`secondary-${groupIdx}-${idx}`} style={styles.swatchItem}>
                                          <View style={[styles.swatchDot, styles.swatchDotSecondary, { backgroundColor: color.hex }]} />
                                          <Text style={[styles.swatchName, styles.swatchNameSecondary]} numberOfLines={2}>
                                            {color.name}
                                          </Text>
                                        </View>
                                      ))}
                                    </ScrollView>
                                  ))}
                                </View>
                              )}
                              <View style={styles.productsDivider} />
                <Pressable 
                                onPress={() => {
                                  if (expandedCategoryProducts === 'softs') {
                                    setExpandedCategoryProducts(null);
                                  } else {
                                    setExpandedCategoryProducts('softs');
                                    if (!categoryProducts.softs || categoryProducts.softs.length === 0) {
                                      loadCategoryProducts('softs');
                                    }
                                  }
                                }}
                              >
                                <Text style={styles.productsBtnTextSimple}>
                                  {expandedCategoryProducts === 'softs' ? 'Hide products' : 'Suggested products'}
                                </Text>
                </Pressable>
                              {expandedCategoryProducts === 'softs' && (
                                <View style={styles.productsArea}>
                                  {isLoadingCategoryProducts.softs ? (
                                    <ActivityIndicator size="small" color="#6366f1" />
                                  ) : categoryProducts.softs && categoryProducts.softs.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                      {categoryProducts.softs.map((product, idx) => (
                                        <Pressable
                                          key={product.id || idx}
                                          style={styles.colorProductCardSmall}
                                          onPress={() => {
                                            setCurrentProduct(product);
                                            setRoute('product');
                                          }}
                                        >
                                          {(product.image || product.imageUrl || product.image_url) ? (
                                            <OptimizedImage
                                              source={{ uri: product.image || product.imageUrl || product.image_url }}
                                              style={styles.colorProductImageSmall}
                                              resizeMode="cover"
                                            />
                                          ) : (
                                            <View style={[styles.colorProductImageSmall, styles.colorProductPlaceholderSmall]}>
                                              <Text>🛍️</Text>
                                            </View>
                                          )}
                                        </Pressable>
                                      ))}
                                    </ScrollView>
                                  ) : (
                                    <View style={styles.colorProductsEmptySmall}>
                                      <Text style={styles.colorProductsEmptyTextSmall}>No products available for this color category</Text>
              </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </>
                    );
                  })()}
                </>
              ) : null}
            </View>
          </View>

        {/* SECTION 3: FIT PROFILE (Summary Card) */}
        <View style={styles.fitProfileSummaryCard}>
            {/* Profile Name with Photos */}
            <View style={styles.fitProfileHeaderRow}>
              <Text style={styles.fitProfileName}>Fit Profile</Text>
              <View style={styles.fitProfilePhotos}>
                {/* Body Photo Thumbnail - Moved to right, increased size */}
                <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
                <Pressable onPress={() => setShowBodyPhotoGuidelines(true)}>
                  {bodyImage ? (
                    <View style={{ position: 'relative' }}>
                      <View style={styles.fitProfilePhotoThumbnail}>
                        <OptimizedImage 
                          source={{ uri: bodyImage }} 
                          style={styles.fitProfilePhotoImage}
                          onError={() => setBodyImage(null)}
                        />
                        {isUploadingBodyPhoto && (
                          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#6366f1" />
                          </View>
                        )}
                      </View>
                      {/* Edit Icon */}
                      <Pressable
                        style={styles.photoEditIcon}
                        onPress={(e) => {
                          e.stopPropagation();
                          setShowBodyPhotoGuidelines(true);
                        }}
                      >
                        <Text style={styles.photoEditIconText}>✏️</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {!bodyImage && (
                    <View style={[styles.fitProfilePhotoThumbnail, styles.fitProfilePhotoPlaceholder]}>
                      <Text style={styles.fitProfilePhotoPlaceholderText}>📸</Text>
                    </View>
                  )}
                </Pressable>
                  <Text style={[styles.fitProfilePhotoLabel, { marginTop: 4 }]}>Your Body Photo</Text>
                    </View>
                
              </View>
            </View>
            <View style={styles.fitProfileSummaryRow}>
              <Text style={styles.fitProfileSummaryLabel}>Gender:</Text>
              <Text style={styles.fitProfileSummaryValue}>{fitProfile.gender || 'Not set'}</Text>
            </View>
            <View style={styles.fitProfileSummaryRow}>
              <Text style={styles.fitProfileSummaryLabel}>Body Shape:</Text>
              <Text style={styles.fitProfileSummaryValue}>{fitProfile.bodyShape || 'Not set'}</Text>
            </View>
            <View style={styles.fitProfileSummaryRow}>
              <Text style={styles.fitProfileSummaryLabel}>Height:</Text>
              <Text style={styles.fitProfileSummaryValue}>{fitProfile.height || 'Not set'}</Text>
            </View>
            <View style={styles.fitProfileSummaryRow}>
              <Text style={styles.fitProfileSummaryLabel}>Fit Preference:</Text>
              <Text style={styles.fitProfileSummaryValue}>{fitProfile.fit_preference ? fitProfile.fit_preference.charAt(0).toUpperCase() + fitProfile.fit_preference.slice(1) : 'Not set'}</Text>
            </View>
            <View style={styles.fitProfileSummaryRow}>
              <Text style={styles.fitProfileSummaryLabel}>Sizes:</Text>
              <Text style={styles.fitProfileSummaryValue}>
                {[fitProfile.topSize, fitProfile.bottomSize].filter(Boolean).join(' / ') || 'Not set'}
              </Text>
            </View>
            <Pressable 
              style={styles.fitProfileEditBtn}
              onPress={() => setShowFitProfile(true)}
            >
              <Text style={styles.fitProfileEditBtnText}>Edit Fit Profile</Text>
            </Pressable>
          </View>

        {/* SECTION 4: YOUR WORKSPACE */}
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
                    <SafeImage 
                      source={{ uri: item.resultUrl }} 
                      style={styles.tryOnImage} 
                      resizeMode="cover"
                      width={200}  // Thumbnail width for try-on cards
                      height={280} // Thumbnail height for try-on cards
                      quality={85} // Good quality for try-on thumbnails
                    />
                    
                    <View style={styles.tryOnOverlay}>
                      {/* Privacy Toggle */}
                      <Pressable 
                        style={styles.privacyBadge}
                        onPress={(e) => {
                          e.stopPropagation();
                          // Ensure we use the correct state setter for visibility picker
                          // This needs to be outside the list to avoid z-index issues if possible, 
                          // but for now let's just make sure it sets the state.
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
                            width={60}  // Small thumbnail for product overlay
                            height={60} // Small thumbnail for product overlay
                            quality={85} // Good quality for small thumbnails
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
          <View style={[styles.section, { marginBottom: 20 }]}>
            <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
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

        {/* SECTION 5: SOCIAL */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, color: '#6366f1' }]}>Social</Text>
          
          {/* Friends */}
          <SectionCard>
            <View style={styles.friendsHeader}>
              <Text style={styles.sectionTitle}>Friends</Text>
              <Pressable 
                style={styles.friendInviteBtnSmall}
                onPress={async () => {
                  if (!user?.id) return;
                  const shareUrl = buildShareUrl({ kind: 'install', fromUserId: user.id });
                  await Share.share({ 
                    message: `Join me on Stylit! Let's rate each other's outfits. Download: ${shareUrl}` 
                  });
                }}
              >
                <Text style={styles.friendInviteBtnText}>+ Invite</Text>
              </Pressable>
            </View>
            
            {/* Search by User */}
            <View style={styles.friendSearchContainer}>
              <TextInput
                style={styles.friendSearchInput}
                placeholder="Search by User email id"
                placeholderTextColor="#666"
                value={friendSearchInput}
                onChangeText={async (text) => {
                  setFriendSearchInput(text);
                  if (text && text.length > 2) {
                    setIsSearchingFriends(true);
                    try {
                      const { data: profiles, error } = await supabase
                        .from('profiles')
                        .select('id, name, email, avatar_url')
                        .or(`email.ilike.%${text}%,name.ilike.%${text}%`)
                        .limit(10);
                      
                      if (!error && profiles) {
                        setFriendSearchResults(profiles.filter(p => p.id !== user?.id));
                      } else {
                        setFriendSearchResults([]);
                      }
                    } catch (error) {
                      console.error('Error searching friends:', error);
                      setFriendSearchResults([]);
                    } finally {
                      setIsSearchingFriends(false);
                    }
                  } else {
                    setFriendSearchResults([]);
                  }
                }}
                autoCapitalize="none"
              />
            </View>

            {/* Search Results */}
            {friendSearchResults.length > 0 && (
              <View style={styles.friendSearchResults}>
                {friendSearchResults.map((profile) => {
                  const isAlreadyFriend = friends.some(f => f.friend_id === profile.id);
                  const sentRequest = sentRequests.find(r => r.friend_id === profile.id);
                  const requestStatus = sentRequest?.status || (isAlreadyFriend ? 'accepted' : null);
                  
                  const isLocallyPending = localPendingRequests.has(profile.id);
                  const effectiveRequestStatus = isLocallyPending ? 'pending' : requestStatus;
                  
                  return (
                    <View key={profile.id} style={styles.friendSearchResultItem}>
                      <Pressable
                        onPress={() => {
                          if (profile.id && setRoute) {
                            setRoute('userprofile', { userId: profile.id });
                          }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      >
                        {profile.avatar_url ? (
                          <SafeImage source={{ uri: profile.avatar_url }} style={styles.friendSearchAvatar} />
                        ) : (
                          <View style={[styles.friendSearchAvatar, styles.friendItemAvatarPlaceholder]}>
                            <Text style={styles.friendItemAvatarText}>
                              {profile.name?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || 'U'}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.friendItemName}>{profile.name || 'User'}</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.friendAddBtn,
                          effectiveRequestStatus === 'pending' && styles.friendAddBtnPending,
                          effectiveRequestStatus === 'accepted' && styles.friendAddBtnAccepted
                        ]}
                        onPress={async () => {
                          if (isAlreadyFriend || effectiveRequestStatus === 'accepted') return;
                          
                          if (user?.id && profile.id) {
                            // Immediately update local state to show pending
                            setLocalPendingRequests(prev => new Set(prev).add(profile.id));
                            
                            try {
                              const { sendFriendRequest } = await import('../lib/friends');
                              const result = await sendFriendRequest(user.id, profile.id);
                              if (result.success) {
                                showBanner(result.isMutual ? '✓ Friend added!' : '✓ Friend request sent!', 'success');
                                // Reload friends to get updated request status
                                await loadFriends();
                                // Keep local pending state since request was successful
                              } else {
                                // Remove from local pending if request failed
                                setLocalPendingRequests(prev => {
                                  const next = new Set(prev);
                                  next.delete(profile.id);
                                  return next;
                                });
                                Alert.alert('Error', 'Could not add friend. They may already be your friend or you already sent a request.');
                              }
                            } catch (error) {
                              // Remove from local pending if request failed
                              setLocalPendingRequests(prev => {
                                const next = new Set(prev);
                                next.delete(profile.id);
                                return next;
                              });
                              console.error('Error adding friend:', error);
                              Alert.alert('Error', 'Failed to add friend. Please try again.');
                            }
                          }
                        }}
                        disabled={effectiveRequestStatus === 'pending' || isAlreadyFriend}
                      >
                        <Text style={[
                          styles.friendAddBtnText,
                          effectiveRequestStatus === 'pending' && styles.friendAddBtnTextPending,
                          effectiveRequestStatus === 'accepted' && styles.friendAddBtnTextAccepted
                        ]}>
                          {effectiveRequestStatus === 'pending' ? 'Pending' : effectiveRequestStatus === 'accepted' ? 'Added' : 'Add'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Friends List */}
            {friends.length > 0 && (
              <View style={styles.friendsList}>
                <Text style={styles.friendsSectionTitle}>Friends ({friends.length})</Text>
                {friends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    style={styles.friendItem}
                    onPress={() => {
                      if (friend.friend_id && setRoute) {
                        setRoute('userprofile', { userId: friend.friend_id });
                      }
                    }}
                  >
                    <Avatar 
                      imageUri={friend.friend_avatar || null} 
                      name={friend.friend_name || 'Friend'} 
                      size={40}
                    />
                    <Text style={[styles.friendItemName, { marginLeft: 12 }]}>{friend.friend_name || 'Friend'}</Text>
                    <Text style={styles.friendItemArrow}>→</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <View style={styles.friendsList}>
                <Text style={styles.friendsSectionTitle}>Sent ({sentRequests.length})</Text>
                {sentRequests.map((request) => (
                  <View key={request.id} style={styles.friendItem}>
                    {request.friend_avatar ? (
                      <SafeImage source={{ uri: request.friend_avatar }} style={styles.friendItemAvatar} />
                    ) : (
                      <View style={[styles.friendItemAvatar, styles.friendItemAvatarPlaceholder]}>
                        <Text style={styles.friendItemAvatarText}>
                          {request.friend_name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.friendItemName}>{request.friend_name || 'User'}</Text>
                    <Text style={[styles.friendItemName, { fontSize: 12, color: '#fbbf24', marginLeft: 'auto', marginRight: 8 }]}>Pending</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Received Requests */}
            {receivedRequests.length > 0 && (
              <View style={styles.friendsList}>
                <Text style={styles.friendsSectionTitle}>Received ({receivedRequests.length})</Text>
                {receivedRequests.map((request) => (
                  <View key={request.id} style={styles.friendItem}>
                    {request.friend_avatar ? (
                      <SafeImage source={{ uri: request.friend_avatar }} style={styles.friendItemAvatar} />
                    ) : (
                      <View style={[styles.friendItemAvatar, styles.friendItemAvatarPlaceholder]}>
                        <Text style={styles.friendItemAvatarText}>
                          {request.friend_name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.friendItemName}>{request.friend_name || 'User'}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        style={[styles.friendAddBtn, { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6 }]}
                        onPress={async () => {
                          if (user?.id && request.user_id) {
                            try {
                              // Accept the received request by updating status to accepted
                              await supabase
                                .from('friends')
                                .update({ status: 'accepted' })
                                .eq('id', request.id);
                              
                              // Check if reverse friendship exists (user sent request to this person)
                              const { data: existingReverse } = await supabase
                                .from('friends')
                                .select('id, status')
                                .eq('user_id', user.id)
                                .eq('friend_id', request.user_id)
                                .maybeSingle();
                              
                              if (existingReverse) {
                                // Update existing reverse request to accepted
                                await supabase
                                  .from('friends')
                                  .update({ status: 'accepted' })
                                  .eq('id', existingReverse.id);
                              } else {
                                // Create reverse friendship
                                await supabase
                                  .from('friends')
                                  .insert({
                                    user_id: user.id,
                                    friend_id: request.user_id,
                                    status: 'accepted'
                                  });
                              }
                              
                              // Immediately update local state
                              setReceivedRequests(prev => prev.filter(r => r.id !== request.id));
                              setLocalPendingRequests(prev => {
                                const next = new Set(prev);
                                next.delete(request.user_id);
                                return next;
                              });
                              
                              showBanner('✓ Friend request accepted!', 'success');
                              // Reload to refresh all lists (this will add to friends)
                              await loadFriends();
                            } catch (error) {
                              console.error('Error accepting request:', error);
                              Alert.alert('Error', 'Failed to accept friend request.');
                            }
                          }
                        }}
                      >
                        <Text style={[styles.friendAddBtnText, { color: '#fff' }]}>Accept</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.friendAddBtn, { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6 }]}
                        onPress={async () => {
                          if (user?.id && request.id) {
                            try {
                              // Delete the request (reject)
                              await supabase
                                .from('friends')
                                .delete()
                                .eq('id', request.id);
                              
                              // Immediately update local state
                              setReceivedRequests(prev => prev.filter(r => r.id !== request.id));
                              
                              showBanner('Friend request rejected', 'success');
                              // Reload to refresh all lists
                              await loadFriends();
                            } catch (error) {
                              console.error('Error rejecting request:', error);
                              Alert.alert('Error', 'Failed to reject friend request.');
                            }
                          }
                        }}
                      >
                        <Text style={[styles.friendAddBtnText, { color: '#fff' }]}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {friends.length === 0 && sentRequests.length === 0 && receivedRequests.length === 0 && friendSearchResults.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.emptySubtext}>Search for users above or share invite link</Text>
              </View>
            )}
          </SectionCard>
        </View>


      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.supportSectionTitle}>Support</Text>
        
        <View style={styles.supportCard}>
          <Pressable
            style={styles.supportItem}
            onPress={async () => {
              const email = 'raj@stylit.ai';
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

      {/* Admin Section - Only visible to admin@stylit.ai */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, color: '#8b5cf6' }]}>Admin</Text>
          <SectionCard>
            <Pressable
              style={styles.supportItem}
              onPress={() => setRoute('admingarments')}
            >
              <Text style={styles.supportItemText}>⚙️ Admin: Garments</Text>
              <Text style={styles.supportItemArrow}>→</Text>
            </Pressable>
          </SectionCard>
        </View>
      )}

      {/* Account Actions */}
      <View style={styles.section}>
        {/* Change Password */}
        <RowItem
          icon="🔐"
          title="Change Password"
          subtitle="Update your account password"
          onPress={() => setShowChangePasswordModal(true)}
        />
        
        {/* Account Email - Display Only */}
        <RowItem
          icon="📧"
          title="Email"
          subtitle={user?.email || 'Not set'}
          onPress={null}
          showChevron={false}
        />
        
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
        
        {/* Delete Account Section - Required by App Store */}
        <View style={styles.deleteAccountSection}>
          <Text style={styles.deleteAccountWarning}>
            ⚠️ Danger Zone
          </Text>
          <Text style={styles.deleteAccountDescription}>
            Permanently delete your account and all data including profile, measurements, color analysis, saved outfits, and friends list.
          </Text>
          <Text style={styles.deleteAccountInstruction}>
            Type "delete" to enable account deletion:
          </Text>
          <TextInput
            style={styles.deleteConfirmInput}
            placeholder='Type "delete" to confirm'
            placeholderTextColor="rgba(255,68,68,0.4)"
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={[
            styles.deleteAccountButton,
            deleteConfirmText.toLowerCase() !== 'delete' && styles.deleteAccountButtonDisabled
          ]}
          disabled={isDeletingAccount || deleteConfirmText.toLowerCase() !== 'delete'}
          onPress={() => {
            Alert.alert(
              'Final Confirmation',
              'This action is IRREVERSIBLE. Are you absolutely sure you want to delete your account?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => setDeleteConfirmText('') },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
                      const response = await fetch(`${API_BASE}/api/delete-account`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user?.id,
                          confirmEmail: user?.email,
                        }),
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok && result.success) {
                        // Sign out and navigate to auth
                        await supabase.auth.signOut();
                        if (setUser) setUser(null);
                        if (setSavedFits) setSavedFits([]);
                        if (setRoute) setRoute('auth');
                        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
                      } else {
                        throw new Error(result.error || 'Failed to delete account');
                      }
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
                    } finally {
                      setIsDeletingAccount(false);
                      setDeleteConfirmText('');
                    }
                  }
                }
              ]
            );
          }}
        >
          {isDeletingAccount ? (
            <ActivityIndicator color="#ff4444" size="small" />
          ) : (
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          )}
        </Pressable>
      </View>

    </ScrollView>

    {/* Multi-Photo Face Analysis Modal */}
    <Modal visible={showMultiPhotoModal} transparent={true} animationType="slide">
      <View style={styles.quickCheckModalContainer}>
        <View style={styles.quickCheckModalContent}>
          {/* Header */}
          <View style={styles.quickCheckHeader}>
            <Text style={styles.quickCheckTitle}>📸 Improve Accuracy</Text>
            <Pressable 
              onPress={() => {
                setShowMultiPhotoModal(false);
                setAdditionalPhotos([null, null]);
                setAdditionalPhotosCropped([null, null]);
                setAdditionalPhotosCropInfo([null, null]);
                setMultiPhotoResults(null);
              }}
              style={styles.quickCheckCloseBtn}
            >
              <Text style={styles.quickCheckCloseBtnText}>✕</Text>
            </Pressable>
          </View>
          
          <Text style={styles.quickCheckSubtitle}>
            Upload 2 more photos in different lighting conditions for more accurate skin tone analysis. We'll analyze all 3 photos and give you a combined result.
          </Text>
          
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Current Photo */}
            <View style={styles.quickCheckStep}>
              <Text style={styles.quickCheckStepTitle}>✓ Photo 1 (Already uploaded)</Text>
              <View style={styles.multiPhotoRow}>
                {faceImage && (
                  <View style={styles.multiPhotoItem}>
                    <Image source={{ uri: faceImage }} style={styles.multiPhotoThumb} />
                    <Text style={styles.multiPhotoLabel}>Original</Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Additional Photos - Using Same Face Container UI */}
            <View style={styles.quickCheckStep}>
              <Text style={styles.quickCheckStepTitle}>Add 2 More Photos</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 16 }}>
                Use different lighting: natural daylight, indoor light, etc.
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                {[0, 1].map((index) => (
                  <View key={index} style={{ alignItems: 'center' }}>
                    <Pressable
                      onPress={() => {
                        if (additionalPhotos[index]) {
                          // Allow re-upload
                          Alert.alert(
                            'Change Photo',
                            'Do you want to change this photo?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Change',
                                onPress: () => {
                                  const newPhotos = [...additionalPhotos];
                                  newPhotos[index] = null;
                                  setAdditionalPhotos(newPhotos);
                                  const newCropped = [...additionalPhotosCropped];
                                  newCropped[index] = null;
                                  setAdditionalPhotosCropped(newCropped);
                                  const newCropInfo = [...additionalPhotosCropInfo];
                                  newCropInfo[index] = null;
                                  setAdditionalPhotosCropInfo(newCropInfo);
                                }
                              }
                            ]
                          );
                        } else {
                          // Upload new photo - will show FaceCropScreen after selection
                          Alert.alert(
                            'Add Photo',
                            'Choose how to add photo',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: '📸 Camera',
                                onPress: async () => {
                                  const permission = await ImagePicker.requestCameraPermissionsAsync();
                                  if (permission.granted) {
                                    const result = await ImagePicker.launchCameraAsync({
                                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                      quality: 0.8,
                                      allowsEditing: false, // We'll use FaceCropScreen instead
                                    });
                                    if (!result.canceled && result.assets?.[0]?.uri) {
                                      const selectedImageUri = result.assets[0].uri;
                                      console.log('📸 [DEBUG] Camera photo selected:', selectedImageUri);
                                      // Store the image in state
                                      const newPhotos = [...additionalPhotos];
                                      newPhotos[index] = selectedImageUri;
                                      setAdditionalPhotos(newPhotos);
                                      // Set pending image and index
                                      setPendingImageUri(selectedImageUri);
                                      setAdditionalPhotoIndexToCrop(index);
                                      // Close multi-photo modal THEN show FaceCropScreen with delay
                                      setShowMultiPhotoModal(false);
                                      setTimeout(() => {
                                        console.log('📸 [DEBUG] Now showing FaceCropScreen');
                                        setShowFaceCropForAdditional(true);
                                      }, 350); // Wait for modal animation to complete
                                    }
                                  } else {
                                    Alert.alert('Permission Needed', 'Please allow camera access.');
                                  }
                                }
                              },
                              {
                                text: '🖼️ Gallery',
                                onPress: async () => {
                                  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                  if (permission.granted) {
                                    const result = await ImagePicker.launchImageLibraryAsync({
                                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                      quality: 0.8,
                                      allowsEditing: false, // We'll use FaceCropScreen instead
                                    });
                                    if (!result.canceled && result.assets?.[0]?.uri) {
                                      const selectedImageUri = result.assets[0].uri;
                                      console.log('📸 [DEBUG] Gallery photo selected:', selectedImageUri);
                                      // Store the image in state
                                      const newPhotos = [...additionalPhotos];
                                      newPhotos[index] = selectedImageUri;
                                      setAdditionalPhotos(newPhotos);
                                      // Set pending image and index
                                      setPendingImageUri(selectedImageUri);
                                      setAdditionalPhotoIndexToCrop(index);
                                      // Close multi-photo modal THEN show FaceCropScreen with delay
                                      setShowMultiPhotoModal(false);
                                      setTimeout(() => {
                                        console.log('📸 [DEBUG] Now showing FaceCropScreen');
                                        setShowFaceCropForAdditional(true);
                                      }, 350); // Wait for modal animation to complete
                                    }
                                  } else {
                                    Alert.alert('Permission Needed', 'Please allow photo library access.');
                                  }
                                }
                              }
                            ]
                          );
                        }
                      }}
                    >
                      {additionalPhotos[index] ? (
                        <View style={{ position: 'relative' }}>
                          <View style={styles.faceThumbnailNew}>
                            <Image 
                              source={{ uri: additionalPhotos[index] }} 
                              style={styles.faceThumbnailImage}
                            />
                          </View>
                          {/* Edit Icon */}
                          <Pressable
                            style={styles.photoEditIcon}
                            onPress={(e) => {
                              e.stopPropagation();
                              Alert.alert(
                                'Change Photo',
                                'Do you want to change this photo?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Change',
                                    onPress: () => {
                                      const newPhotos = [...additionalPhotos];
                                      newPhotos[index] = null;
                                      setAdditionalPhotos(newPhotos);
                                      const newCropped = [...additionalPhotosCropped];
                                      newCropped[index] = null;
                                      setAdditionalPhotosCropped(newCropped);
                                      const newCropInfo = [...additionalPhotosCropInfo];
                                      newCropInfo[index] = null;
                                      setAdditionalPhotosCropInfo(newCropInfo);
                                    }
                                  }
                                ]
                              );
                            }}
                          >
                            <Text style={styles.photoEditIconText}>✏️</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={[styles.faceThumbnailNew, styles.faceThumbnailPlaceholder]}>
                          <Text style={styles.faceThumbnailIcon}>📸</Text>
                        </View>
                      )}
                    </Pressable>
                    <Text style={[styles.facePhotoLabel, { marginTop: 4 }]}>
                      {index === 0 ? 'Photo 2' : 'Photo 3'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* Analyze Button */}
            <View style={styles.quickCheckStep}>
              <Pressable
                style={[
                  styles.multiPhotoAnalyzeBtn,
                  (!additionalPhotos[0] || !additionalPhotos[1]) && { opacity: 0.5 }
                ]}
                disabled={!additionalPhotosCropped[0] || !additionalPhotosCropped[1] || isAnalyzingMultiPhoto}
                onPress={async () => {
                  if (!additionalPhotosCropped[0] || !additionalPhotosCropped[1]) {
                    Alert.alert('Photos Required', 'Please crop both additional photos using the face container.');
                    return;
                  }
                  
                  setIsAnalyzingMultiPhoto(true);
                  try {
                    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
                    const results = [];
                    
                    // Analyze each photo
                    // Photo 0 = original faceImage, Photos 1-2 = additionalPhotos
                    for (let i = 0; i < allPhotos.length; i++) {
                      try {
                        let requestBody: any = {};
                        
                        if (i === 0) {
                          // Original face photo - use existing method (may have cropInfo from original upload)
                          const photoUri = faceImage;
                          let imageUrl = photoUri;
                          
                          // If it's a local file URI, upload it first
                          if (photoUri && (photoUri.startsWith('file://') || photoUri.startsWith('content://') || photoUri.startsWith('ph://'))) {
                            try {
                              imageUrl = await uploadImageAsync(photoUri);
                            } catch (uploadError) {
                              console.error(`Error uploading photo ${i + 1}:`, uploadError);
                              continue;
                            }
                          }
                          
                          requestBody = { imageUrl: imageUrl };
                        } else {
                          // Additional photos - use cropped base64 if available
                          const additionalIndex = i - 1;
                          const croppedBase64 = additionalPhotosCropped[additionalIndex];
                          
                          if (croppedBase64) {
                            // Use pre-cropped face image (best method - no extract_area errors)
                            requestBody = { croppedFaceBase64: croppedBase64 };
                          } else {
                            // Fallback: upload full image and let API detect face
                            const photoUri = additionalPhotos[additionalIndex];
                            if (!photoUri) continue;
                            
                            let imageUrl = photoUri;
                            if (photoUri.startsWith('file://') || photoUri.startsWith('content://') || photoUri.startsWith('ph://')) {
                              try {
                                imageUrl = await uploadImageAsync(photoUri);
                              } catch (uploadError) {
                                console.error(`Error uploading photo ${i + 1}:`, uploadError);
                                continue;
                              }
                            }
                            
                            requestBody = { imageUrl: imageUrl };
                          }
                        }
                        
                        // Analyze the image
                        const response = await fetch(`${API_BASE}/api/analyze-skin-tone`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(requestBody),
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          if (data.error) {
                            console.error(`Analysis error for photo ${i + 1}:`, data.error);
                            continue;
                          }
                          results.push({
                            season: data.season,
                            seasonConfidence: data.seasonConfidence || 0,
                            undertone: data.undertone,
                            depth: data.depth,
                            clarity: data.clarity,
                          });
                        } else {
                          const errorText = await response.text();
                          console.error(`Analysis failed for photo ${i + 1}:`, errorText);
                        }
                      } catch (e) {
                        console.error(`Error analyzing photo ${i + 1}:`, e);
                        // Continue with next photo instead of failing completely
                      }
                    }
                    
                    if (results.length >= 2) {
                      // ============================================================================
                      // 3-PHOTO ANALYSIS LOGIC:
                      // ============================================================================
                      // 1. Each photo is analyzed independently to get its season prediction
                      // 2. We count votes: How many photos predicted each season?
                      // 3. Majority wins: The season with the most votes becomes the final result
                      // 4. Confidence boost: If all 3 photos agree (100% agreement), confidence is boosted
                      //    - Average the confidence scores of photos that voted for the winning season
                      //    - Add a bonus based on agreement ratio (more agreement = higher confidence)
                      //    - Example: 3 photos all say "spring" → 100% agreement → +0.1 confidence boost
                      //    - Example: 2 photos say "spring", 1 says "summer" → 67% agreement → +0.067 boost
                      // 5. Final confidence is capped at 95% to leave room for uncertainty
                      // ============================================================================
                      
                      // Vote on season (majority wins)
                      const seasonCounts = {};
                      results.forEach(r => {
                        seasonCounts[r.season] = (seasonCounts[r.season] || 0) + 1;
                      });
                      
                      const winnerSeason = Object.entries(seasonCounts)
                        .sort((a, b) => b[1] - a[1])[0][0];
                      
                      // Average confidence for winning season
                      const winnerResults = results.filter(r => r.season === winnerSeason);
                      const avgConfidence = winnerResults.reduce((sum, r) => sum + r.seasonConfidence, 0) / winnerResults.length;
                      
                      // Boost confidence based on agreement
                      // More photos agreeing = higher confidence (up to +0.1 boost)
                      const agreementRatio = winnerResults.length / results.length;
                      const boostedConfidence = Math.min(0.95, avgConfidence + (agreementRatio * 0.1));
                      
                      setMultiPhotoResults({
                        season: winnerSeason,
                        confidence: boostedConfidence,
                        agreement: agreementRatio,
                        photoCount: results.length,
                      });
                      
                      // Update the main color profile
                      const updatedProfile = {
                        ...colorProfile,
                        season: winnerSeason,
                        seasonConfidence: boostedConfidence,
                        needsConfirmation: boostedConfidence < 0.72,
                      };
                      
                      // Save to user profile
                      if (user?.id) {
                        await supabase
                          .from('profiles')
                          .update({ color_profile: updatedProfile })
                          .eq('id', user.id);
                        
                        setColorProfile(updatedProfile);
                        if (setUser) {
                          setUser({ ...user, colorProfile: updatedProfile });
                        }
                      }
                      
                      showBanner(`Analysis complete! Season: ${winnerSeason} (${Math.round(boostedConfidence * 100)}% confidence)`, 'success');
                    } else {
                      Alert.alert('Analysis Failed', 'Could not analyze enough photos. Please try again.');
                    }
                  } catch (error) {
                    console.error('Multi-photo analysis error:', error);
                    Alert.alert('Error', 'Failed to analyze photos. Please try again.');
                  } finally {
                    setIsAnalyzingMultiPhoto(false);
                  }
                }}
              >
                {isAnalyzingMultiPhoto ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.multiPhotoAnalyzeBtnText}>  Analyzing 3 Photos...</Text>
                  </View>
                ) : (
                  <Text style={styles.multiPhotoAnalyzeBtnText}>✨ Analyze All 3 Photos</Text>
                )}
              </Pressable>
            </View>
            
            {/* Results */}
            {multiPhotoResults && (
              <View style={styles.quickCheckStep}>
                <View style={styles.quickCheckResultContainer}>
                  <Text style={styles.quickCheckVerdictText}>
                    🎉 {multiPhotoResults.season.charAt(0).toUpperCase() + multiPhotoResults.season.slice(1)}
                  </Text>
                  <Text style={styles.quickCheckConfidenceText}>
                    {Math.round(multiPhotoResults.confidence * 100)}% confidence
                  </Text>
                  <Text style={styles.quickCheckExplanationText}>
                    {Math.round(multiPhotoResults.agreement * 100)}% of photos agreed on this season.
                    {multiPhotoResults.agreement === 1 ? ' All photos matched!' : ''}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Quick Color Check Modal - Like FitCheck color picker */}
    <Modal visible={showQuickColorCheck} transparent={true} animationType="slide">
      <View style={styles.quickCheckModalContainer}>
        <View style={styles.quickCheckModalContent}>
          {/* Header */}
          <View style={styles.quickCheckHeader}>
            <Text style={styles.quickCheckTitle}>📷 Quick Color Check</Text>
            <Pressable 
              onPress={() => {
                setShowQuickColorCheck(false);
                setQuickCheckImage(null);
                setQuickCheckColor(null);
                setQuickCheckResult(null);
                setQuickCheckLiveColor(null);
                setQuickCheckTouchPosition(null);
              }}
              style={styles.quickCheckCloseBtn}
            >
              <Text style={styles.quickCheckCloseBtnText}>✕</Text>
            </Pressable>
          </View>
          
          <Text style={styles.quickCheckSubtitle}>
            {!quickCheckImage 
              ? 'Shopping offline? Snap a photo of any garment to check if its colors suit your skin tone.'
              : 'Tap on the garment to pick a color, then confirm to analyze.'}
          </Text>
          
          {/* Step 1: Upload Image */}
          {!quickCheckImage ? (
            <View style={styles.quickCheckStep}>
              <Text style={styles.quickCheckStepTitle}>Take or Upload Photo</Text>
              <View style={styles.quickCheckImageButtons}>
                <Pressable
                  style={styles.quickCheckUploadBtn}
                  onPress={async () => {
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (permission.granted) {
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets?.[0]?.uri) {
                        setQuickCheckImage(result.assets[0].uri);
                        setQuickCheckColor(null);
                        setQuickCheckResult(null);
                        setQuickCheckLiveColor(null);
                        // Get natural image size
                        Image.getSize(result.assets[0].uri, (w, h) => {
                          quickCheckImageNaturalSizeRef.current = { width: w, height: h };
                        });
                      }
                    } else {
                      Alert.alert(
                        'Camera Access Required',
                        'Stylit needs camera access to photograph garments and check if their colors suit your skin tone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.quickCheckUploadBtnText}>📸 Take Photo</Text>
                </Pressable>
                <Pressable
                  style={styles.quickCheckUploadBtn}
                  onPress={async () => {
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (permission.granted) {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets?.[0]?.uri) {
                        setQuickCheckImage(result.assets[0].uri);
                        setQuickCheckColor(null);
                        setQuickCheckResult(null);
                        setQuickCheckLiveColor(null);
                        // Get natural image size
                        Image.getSize(result.assets[0].uri, (w, h) => {
                          quickCheckImageNaturalSizeRef.current = { width: w, height: h };
                        });
                      }
                    } else {
                      Alert.alert(
                        'Photo Access Required',
                        'Stylit needs access to your photos to upload garment images and check if their colors suit your skin tone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.quickCheckUploadBtnText}>🖼️ From Gallery</Text>
                </Pressable>
              </View>
            </View>
          ) : !quickCheckResult ? (
            /* Step 2: Color Picker Mode - Like FitCheck */
            <View style={{ flex: 1 }}>
              {/* Image Container - Full Screen Like FitCheck */}
              <View 
                style={styles.quickCheckImageContainer}
                onLayout={(e) => {
                  quickCheckImageLayoutRef.current = {
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height,
                    x: e.nativeEvent.layout.x,
                    y: e.nativeEvent.layout.y,
                  };
                }}
              >
                <View style={{ flex: 1, position: 'relative' }}>
                  {/* Image - behind the touch layer */}
                  <Image
                    source={{ uri: quickCheckImage }}
                    style={styles.quickCheckImage}
                    resizeMode="contain"
                    onLoad={(event) => {
                      const { width, height } = event.nativeEvent.source;
                      quickCheckImageNaturalSizeRef.current = { width, height };
                    }}
                  />
                  
                  {/* Touch handler - Pressable for reliable touch detection */}
                  <Pressable
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'transparent',
                    }}
                    onPress={async (event) => {
                      const { locationX, locationY } = event.nativeEvent;
                      setQuickCheckTouchPosition({ x: locationX, y: locationY });
                      setIsQuickCheckSampling(true);
                      
                      try {
                        // Get natural image dimensions
                        let naturalWidth = quickCheckImageNaturalSizeRef.current.width;
                        let naturalHeight = quickCheckImageNaturalSizeRef.current.height;
                        
                        if (!naturalWidth || !naturalHeight) {
                          const imageInfo = await new Promise((resolve, reject) => {
                            Image.getSize(quickCheckImage, (w, h) => resolve({ width: w, height: h }), reject);
                          });
                          naturalWidth = imageInfo.width;
                          naturalHeight = imageInfo.height;
                          quickCheckImageNaturalSizeRef.current = { width: naturalWidth, height: naturalHeight };
                        }
                        
                        // Calculate tap position in image coordinates
                        // Get the actual displayed image dimensions (may be smaller than container due to contain mode)
                        const containerWidth = quickCheckImageLayoutRef.current.width || width;
                        const containerHeight = quickCheckImageLayoutRef.current.height || (height * 0.6);
                        
                        // Calculate actual image display size (accounting for contain resize mode)
                        const imageAspect = naturalWidth / naturalHeight;
                        const containerAspect = containerWidth / containerHeight;
                        
                        let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
                        
                        if (imageAspect > containerAspect) {
                          // Image is wider - fit to width
                          displayWidth = containerWidth;
                          displayHeight = containerWidth / imageAspect;
                          offsetY = (containerHeight - displayHeight) / 2;
                        } else {
                          // Image is taller - fit to height
                          displayHeight = containerHeight;
                          displayWidth = containerHeight * imageAspect;
                          offsetX = (containerWidth - displayWidth) / 2;
                        }
                        
                        // Adjust locationX/locationY by offset
                        const adjustedX = locationX - offsetX;
                        const adjustedY = locationY - offsetY;
                        
                        // Calculate scale
                        const scaleX = naturalWidth / displayWidth;
                        const scaleY = naturalHeight / displayHeight;
                        
                        const imageX = Math.round(Math.max(0, Math.min(adjustedX, displayWidth)) * scaleX);
                        const imageY = Math.round(Math.max(0, Math.min(adjustedY, displayHeight)) * scaleY);
                      
                      // Call color API
                      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
                      
                      // Convert image to base64
                      const response = await fetch(quickCheckImage);
                      const blob = await response.blob();
                      const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                      });
                      
                      const colorResponse = await fetch(`${API_BASE}/api/color`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          mode: 'pick',
                          imageBase64: base64,
                          x: imageX,
                          y: imageY,
                          imageWidth: naturalWidth,
                          imageHeight: naturalHeight,
                        }),
                      });
                      
                      if (colorResponse.ok) {
                        const colorData = await colorResponse.json();
                        // Use color naming system to get color name
                        const { getNearestColorName } = require('../lib/colorNaming');
                        const nearestColor = getNearestColorName(colorData.color);
                        setQuickCheckLiveColor({
                          hex: colorData.color,
                          rgb: colorData.rgb,
                          name: nearestColor.name,
                        });
                      }
                    } catch (error) {
                      console.error('Quick check color pick error:', error);
                      } finally {
                        setIsQuickCheckSampling(false);
                      }
                    }}
                  />
                  
                  {/* Touch cursor */}
                  {quickCheckTouchPosition && (
                    <View
                      style={[
                        styles.quickCheckCursor,
                        {
                          position: 'absolute',
                          left: quickCheckTouchPosition.x - 15,
                          top: quickCheckTouchPosition.y - 15,
                          zIndex: 1000,
                        }
                      ]}
                      pointerEvents="none"
                    >
                      <View style={styles.quickCheckCursorOuter} />
                      <View style={styles.quickCheckCursorInner} />
                    </View>
                  )}
                  
                  {/* Magnifier showing picked color */}
                  {quickCheckTouchPosition && (
                    <View
                      style={[
                        styles.quickCheckMagnifier,
                        {
                          position: 'absolute',
                          left: Math.max(10, Math.min(quickCheckTouchPosition.x - 60, width - 130)),
                          top: Math.max(10, quickCheckTouchPosition.y - 140),
                          zIndex: 1001,
                        }
                      ]}
                      pointerEvents="none"
                    >
                      {isQuickCheckSampling ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : quickCheckLiveColor ? (
                        <>
                          <View style={[styles.quickCheckMagnifierSwatch, { backgroundColor: quickCheckLiveColor.hex }]} />
                          <Text style={styles.quickCheckMagnifierHex}>{quickCheckLiveColor.hex.toUpperCase()}</Text>
                          <Text style={styles.quickCheckMagnifierName}>{quickCheckLiveColor.name}</Text>
                        </>
                      ) : (
                        <Text style={styles.quickCheckMagnifierHex}>Tap to pick</Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
              
              {/* Bottom Section - Color Preview and Confirm (Like FitCheck) */}
              <View style={styles.quickCheckBottomSection}>
                {/* Change Image Button */}
                <Pressable
                  style={styles.quickCheckChangeImageBtn}
                  onPress={() => {
                    setQuickCheckImage(null);
                    setQuickCheckColor(null);
                    setQuickCheckResult(null);
                    setQuickCheckLiveColor(null);
                    setQuickCheckTouchPosition(null);
                  }}
                >
                  <Text style={styles.quickCheckChangeImageText}>Change Image</Text>
                </Pressable>
                
                {/* Live Color Preview with Confirm Button */}
                {quickCheckLiveColor ? (
                  <View style={styles.quickCheckColorPreviewContainer}>
                    <View style={styles.quickCheckColorPreviewRow}>
                      <View style={[styles.quickCheckPreviewSwatch, { backgroundColor: quickCheckLiveColor.hex }]} />
                      <View style={styles.quickCheckPreviewInfo}>
                        <Text style={styles.quickCheckPreviewName} numberOfLines={1}>{quickCheckLiveColor.name}</Text>
                        <Text style={styles.quickCheckPreviewHex}>{quickCheckLiveColor.hex.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.quickCheckConfirmBtn}
                      onPress={async () => {
                        // Confirm color and run analysis
                        setQuickCheckColor(quickCheckLiveColor);
                        setIsQuickCheckAnalyzing(true);
                        
                        try {
                          if (colorProfile?.season && colorProfile?.depth && colorProfile?.clarity) {
                            const { computeColorScore } = require('../lib/colorScoring');
                            const score = computeColorScore(
                              quickCheckLiveColor.hex,
                              colorProfile.season,
                              colorProfile.depth,
                              colorProfile.clarity,
                              colorProfile.microSeason || null,
                              colorProfile.undertone || null,
                              true // nearFace = true for color check
                            );
                            console.log('Quick check score:', score);
                            setQuickCheckResult({
                              verdict: score.rating || 'unknown',
                              confidence: score.minDistance ? (1 - Math.min(score.minDistance / 50, 1)) : null,
                              summary: score.reason || score.explanation?.summary || '',
                              bullets: score.explanation?.bullets || [],
                              deltaE: score.minDistance || score.deltaE,
                            });
                          } else {
                            setQuickCheckResult({
                              verdict: 'unknown',
                              summary: 'Please complete your face analysis first to check color compatibility.',
                              bullets: [],
                            });
                          }
                        } catch (error) {
                          console.error('Quick check analysis error:', error);
                          setQuickCheckResult({
                            verdict: 'unknown',
                            summary: 'Failed to analyze color. Please try again.',
                            bullets: [],
                          });
                        } finally {
                          setIsQuickCheckAnalyzing(false);
                        }
                      }}
                    >
                      <Text style={styles.quickCheckConfirmBtnText}>
                        {isQuickCheckAnalyzing ? 'Analyzing...' : '✓ Analyze This Color'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.quickCheckInstructions}>
                    <Text style={styles.quickCheckInstructionsText}>
                      Tap anywhere on the garment to pick a color
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Step 3: Result Screen */
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.quickCheckResultScreen}>
                {/* Color Swatch */}
                <View style={styles.quickCheckResultColorRow}>
                  <View style={[styles.quickCheckResultSwatch, { backgroundColor: quickCheckColor.hex }]} />
                  <View>
                    <Text style={styles.quickCheckResultColorName}>{quickCheckColor.name}</Text>
                    <Text style={styles.quickCheckResultColorHex}>{quickCheckColor.hex?.toUpperCase()}</Text>
                  </View>
                </View>
                
                {/* Verdict Badge - Like FitCheck */}
                <View style={[
                  styles.quickCheckVerdictBadge,
                  (quickCheckResult.verdict === 'great' || quickCheckResult.verdict === 'good') && styles.quickCheckVerdictGood,
                  (quickCheckResult.verdict === 'ok' || quickCheckResult.verdict === 'neutral') && styles.quickCheckVerdictNeutral,
                  quickCheckResult.verdict === 'risky' && styles.quickCheckVerdictWarning,
                  (quickCheckResult.verdict === 'avoid' || quickCheckResult.verdict === 'clash') && styles.quickCheckVerdictWarning,
                  quickCheckResult.verdict === 'unknown' && styles.quickCheckVerdictNeutral,
                ]}>
                  <Text style={styles.quickCheckVerdictText}>
                    {quickCheckResult.verdict === 'great' ? '✅ Great' : 
                     quickCheckResult.verdict === 'good' ? '✅ Good' :
                     quickCheckResult.verdict === 'ok' ? '⚡ OK' :
                     quickCheckResult.verdict === 'neutral' ? '⚡ Neutral' :
                     quickCheckResult.verdict === 'risky' ? '⚠️ Risky' :
                     quickCheckResult.verdict === 'avoid' ? '⚠️ Not Recommended' :
                     quickCheckResult.verdict === 'clash' ? '⚠️ Color Clash' :
                     '❓ Unknown'}
                  </Text>
                </View>
                
                {/* Summary */}
                {quickCheckResult.summary && (
                  <Text style={styles.quickCheckSummaryText}>
                    {quickCheckResult.summary}
                  </Text>
                )}
                
                {/* Bullets - Like FitCheck */}
                {quickCheckResult.bullets && quickCheckResult.bullets.length > 0 && (
                  <View style={styles.quickCheckAdviceSection}>
                    {quickCheckResult.bullets.map((bullet, idx) => {
                      // Handle both old format (string) and new format (object with text/isMicronote)
                      const bulletText = typeof bullet === 'string' ? bullet : bullet.text;
                      const isMicronote = typeof bullet === 'object' && bullet.isMicronote;
                      return (
                        <Text key={idx} style={isMicronote ? styles.quickCheckMicroNote : styles.quickCheckAdviceItem}>
                          {isMicronote ? '💡 ' : '• '}{bulletText}
                        </Text>
                      );
                    })}
                  </View>
                )}
                
                {/* Try Another Color Button */}
                <Pressable
                  style={styles.quickCheckTryAnotherBtn}
                  onPress={() => {
                    setQuickCheckResult(null);
                    setQuickCheckColor(null);
                    setQuickCheckLiveColor(null);
                    setQuickCheckTouchPosition(null);
                  }}
                >
                  <Text style={styles.quickCheckTryAnotherBtnText}>🎨 Try Another Color</Text>
                </Pressable>
                
                {/* New Image Button */}
                <Pressable
                  style={styles.quickCheckNewImageBtn}
                  onPress={() => {
                    setQuickCheckImage(null);
                    setQuickCheckResult(null);
                    setQuickCheckColor(null);
                    setQuickCheckLiveColor(null);
                    setQuickCheckTouchPosition(null);
                  }}
                >
                  <Text style={styles.quickCheckNewImageBtnText}>📷 New Image</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fit Profile</Text>
            <Pressable onPress={() => setShowFitProfile(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
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
            
            <Text style={styles.modalSubtitle}>Body Measurements (Required)</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bust / Chest Circumference ({measurementUnit.toUpperCase()}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "34" : "86"}`}
                placeholderTextColor="#666"
                value={fitProfile.chest}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, chest: text }))}
                keyboardType="decimal-pad"
              />
            </View>

              <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Waist Circumference ({measurementUnit.toUpperCase()}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "28" : "71"}`}
                placeholderTextColor="#666"
                value={fitProfile.waist}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, waist: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hip Circumference ({measurementUnit.toUpperCase()}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "36" : "91"}`}
                placeholderTextColor="#666"
                value={fitProfile.hips}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, hips: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shoulder Width ({measurementUnit.toUpperCase()}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "16" : "40"}`}
                placeholderTextColor="#666"
                value={fitProfile.shoulder}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, shoulder: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Inseam ({measurementUnit.toUpperCase()}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "30" : "76"}`}
                placeholderTextColor="#666"
                value={fitProfile.inseam}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, inseam: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fit Preference *</Text>
              <View style={styles.radioGroup}>
                {['snug', 'regular', 'relaxed', 'oversized'].map((fit) => (
                  <Pressable
                    key={fit}
                    style={[
                      styles.radioButton,
                      fitProfile.fit_preference === fit && styles.radioButtonActive,
                    ]}
                    onPress={() => setFitProfile(prev => ({ ...prev, fit_preference: fit }))}
                  >
                    <Text
                      style={[
                        styles.radioButtonText,
                        fitProfile.fit_preference === fit && styles.radioButtonTextActive,
                      ]}
                    >
                      {fit.charAt(0).toUpperCase() + fit.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.modalSubtitle}>Optional Measurements</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Arm Length / Sleeve ({measurementUnit.toUpperCase()}) (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "24" : "60"}`}
                placeholderTextColor="#666"
                value={fitProfile.sleeve}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, sleeve: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thigh Circumference ({measurementUnit.toUpperCase()}) (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder={`e.g., ${measurementUnit === 'in' ? "22" : "56"}`}
                placeholderTextColor="#666"
                value={fitProfile.thigh}
                onChangeText={(text) => setFitProfile(prev => ({ ...prev, thigh: text }))}
                keyboardType="decimal-pad"
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
                    
                    // Helper to convert input value to inches (stored in DB)
                    const convertToInches = (value, isHeight = false) => {
                      if (!value || value === '') return null;
                      
                      // Special handling for height: parse feet.inches format
                      if (isHeight) {
                        const parsed = parseHeightToInches(value);
                        if (parsed != null) return parsed;
                        // Fallback to regular conversion
                      }
                      
                      const num = Number(value);
                      if (isNaN(num)) return null;
                      // If input is in cm, convert to inches; if in inches, use as-is
                      return measurementUnit === 'cm' ? num / 2.54 : num;
                    };
                    
                    // Build update object - try new _in columns first, fallback to old TEXT columns
                    const heightInches = convertToInches(fitProfile.height, true);
                    const chestInches = convertToInches(fitProfile.chest);
                    const waistInches = convertToInches(fitProfile.waist);
                    const hipsInches = convertToInches(fitProfile.hips);
                    const shoulderInches = convertToInches(fitProfile.shoulder);
                    const sleeveInches = convertToInches(fitProfile.sleeve);
                    const inseamInches = convertToInches(fitProfile.inseam);
                    const thighInches = convertToInches(fitProfile.thigh);
                    
                    // Base update data (always works)
                    const baseData = {
                      id: user.id,
                      gender: fitProfile.gender,
                      body_shape: fitProfile.bodyShape || finalBodyShape,
                      top_size: fitProfile.topSize,
                      bottom_size: fitProfile.bottomSize,
                      fit_preference: fitProfile.fit_preference,
                      notes: fitProfile.notes,
                      updated_at: new Date().toISOString(),
                    };
                    
                    // Try to save to new _in columns first
                    let updateData = {
                      ...baseData,
                      height_in: heightInches,
                      chest_in: chestInches,
                      waist_in: waistInches,
                      hips_in: hipsInches,
                      shoulder_in: shoulderInches,
                      sleeve_in: sleeveInches,
                      inseam_in: inseamInches,
                      thigh_in: thighInches,
                    };
                    
                    // Use old TEXT columns directly (these always exist in the schema)
                    // This avoids PGRST204 errors for new _in columns that may not exist
                    const fallbackData = {
                      ...baseData,
                      height: heightInches != null ? String(heightInches) : null,
                      chest: chestInches != null ? String(chestInches) : null,
                      waist: waistInches != null ? String(waistInches) : null,
                      hips: hipsInches != null ? String(hipsInches) : null,
                      shoulder: shoulderInches != null ? String(shoulderInches) : null,
                      sleeve: sleeveInches != null ? String(sleeveInches) : null,
                      inseam: inseamInches != null ? String(inseamInches) : null,
                      thigh: thighInches != null ? String(thighInches) : null,
                    };
                    
                    
                    let saveError = null;
                    try {
                      // Use upsert with onConflict to handle both new and existing users
                      const { error } = await supabase
                        .from('profiles')
                        .upsert(fallbackData, { onConflict: 'id' });
                      saveError = error;
                      
                      if (error) {
                        console.error('💾 Upsert error:', error);
                      }
                    } catch (err) {
                      console.error('💾 Save threw exception:', err);
                      saveError = err;
                    }
                    
                    if (saveError) {
                      console.error('Error saving profile:', saveError);
                      showBanner('Failed to save profile', 'error');
                    } else {
                      // Reload profile data to ensure UI is in sync
                      await loadProfileData();
                      showBanner('✓ Fit profile saved!', 'success');
                    }
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
      </KeyboardAvoidingView>
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
                  // Update user object so FitCheck can access the color profile
                  if (setUser) setUser(prev => ({ ...prev, colorProfile: profile }));
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

      {/* Face Crop Screen for Additional Photos */}
      <FaceCropScreen
        visible={showFaceCropForAdditional && additionalPhotoIndexToCrop !== null}
        imageUri={pendingImageUri || (additionalPhotoIndexToCrop !== null ? additionalPhotos[additionalPhotoIndexToCrop] : null)}
        onCropComplete={async (cropData) => {
          setShowFaceCropForAdditional(false);
          const index = additionalPhotoIndexToCrop;
          setAdditionalPhotoIndexToCrop(null);
          setPendingImageUri(null); // Clear pending image after cropping
          
          if (index === null) return;
          
          try {
            // Handle both old format (string URI) and new format (object with imageUri + cropInfo)
            const imageUri = typeof cropData === 'string' ? cropData : cropData.imageUri;
            const cropInfo = typeof cropData === 'object' ? cropData.cropInfo : null;
            
            // Convert cropped image to base64 for API
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const base64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result;
                // Remove data:image/jpeg;base64, prefix if present
                const base64Data = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64Data);
              };
              reader.readAsDataURL(blob);
            });
            
            // Store cropped base64 and crop info
            const newCropped = [...additionalPhotosCropped];
            newCropped[index] = base64;
            setAdditionalPhotosCropped(newCropped);
            
            const newCropInfo = [...additionalPhotosCropInfo];
            newCropInfo[index] = cropInfo;
            setAdditionalPhotosCropInfo(newCropInfo);
            
            // Re-open multi-photo modal after cropping
            setTimeout(() => {
              setShowMultiPhotoModal(true);
            }, 100);
          } catch (error) {
            console.error('Error processing cropped photo:', error);
            Alert.alert('Error', 'Failed to process photo. Please try again.');
            // Re-open multi-photo modal even on error
            setTimeout(() => {
              setShowMultiPhotoModal(true);
            }, 100);
          }
        }}
        onCancel={() => {
          setShowFaceCropForAdditional(false);
          setAdditionalPhotoIndexToCrop(null);
          setPendingImageUri(null); // Clear pending image on cancel
          // Re-open multi-photo modal if cancelled
          setTimeout(() => {
            setShowMultiPhotoModal(true);
          }, 100);
        }}
      />

      {/* Face Crop Screen with Oval Guide */}
      <FaceCropScreen
        visible={showFaceCrop}
        imageUri={imageToCrop}
        onCropComplete={async (cropData) => {
          setShowFaceCrop(false);
          setImageToCrop(null);
          
          try {
            // Clear old photo, error state, and color profile
            setFaceImage(null);
            setFaceAnalysisError(null);
            setColorProfile(null);
            
            // Handle both old format (string URI) and new format (object with imageUri + cropInfo)
            const imageUri = typeof cropData === 'string' ? cropData : cropData.imageUri;
            const cropInfo = typeof cropData === 'object' ? cropData.cropInfo : null;
            
            // Run app-side quality checks
            const qualityChecks = await runQualityChecks(imageUri);
            if (qualityChecks.hasIssues) {
              
              // Show warning but allow user to proceed
              Alert.alert(
                'Photo Quality Warning',
                qualityChecks.recommendations.join('\n\n') + '\n\nYou can still proceed, but results may be less accurate.',
                [
                  { text: 'Retake', style: 'cancel', onPress: () => {
                    setImageToCrop(imageUri);
                    setShowFaceCrop(true);
                  }},
                  { text: 'Continue', onPress: () => proceedWithAnalysis(imageUri, cropInfo) },
                ]
              );
              return;
            }
            
            // Proceed with analysis
            await proceedWithAnalysis(imageUri, cropInfo);
          } catch (error) {
            console.error('🎨 [FACE CROP] Error:', error);
            setIsAnalyzingFace(false);
            setFaceAnalysisError(`Failed to process photo: ${error.message || 'Unknown error'}`);
            Alert.alert('Error', `Failed to process photo: ${error.message || 'Unknown error'}`);
          }
        }}
        onCancel={() => {
          setShowFaceCrop(false);
          setImageToCrop(null);
        }}
      />

      {/* Edit Profile Modal (Name + Avatar only) */}
      <Modal visible={showEditProfileModal} transparent={true} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Pressable onPress={() => setShowEditProfileModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              
              <ScrollView 
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Profile Picture</Text>
                <Pressable 
                  style={styles.avatarContainer}
                  onPress={async () => {
                    // Request permission first - Apple compliance
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!permission.granted) {
                      Alert.alert(
                        'Photo Access Required',
                        'Stylit needs access to your photos to update your profile picture.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                      );
                      return;
                    }
                    
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
                >
                  <Avatar 
                    imageUri={profilePic} 
                    name={username || 'User'} 
                    size={120}
                    showGradient={true}
                  />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="#666"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              <Pressable 
                style={styles.saveBtn}
                onPress={async () => {
                  try {
                    if (user?.id) {
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
                      }
                      
                      if (setUser) {
                        setUser(prev => ({
                          ...prev,
                          name: username,
                          avatar_url: profilePic
                        }));
                      }
                      
                      showBanner('✓ Profile updated!', 'success');
                    }
                    setShowEditProfileModal(false);
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    showBanner('Failed to save profile', 'error');
                  }
                }}
              >
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
      
      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowChangePasswordModal(false);
          setNewPassword('');
          setConfirmNewPassword('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalContainer}>
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
              
              <ScrollView 
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20 }}
              >
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
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  deleteAccountSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.15)',
  },
  deleteAccountWarning: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteAccountDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  deleteAccountInstruction: {
    color: 'rgba(255, 68, 68, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteConfirmInput: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#ff4444',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
    fontSize: 14,
  },
  deleteAccountButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  deleteAccountButtonDisabled: {
    opacity: 0.4,
  },
  deleteAccountText: {
    color: '#ff4444',
    fontWeight: '600',
    fontSize: 14,
  },
  // Quick Color Check Button
  quickColorCheckBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  quickColorCheckBtnText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  // Quick Color Check Modal
  quickCheckModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  quickCheckModalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '70%',
    maxHeight: '90%',
    paddingBottom: 40,
  },
  quickCheckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  quickCheckTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  quickCheckCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCheckCloseBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  quickCheckSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 20,
  },
  quickCheckStep: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickCheckStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  quickCheckImageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCheckUploadBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  quickCheckUploadBtnText: {
    color: '#a5b4fc',
    fontSize: 15,
    fontWeight: '600',
  },
  quickCheckImageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  quickCheckImage: {
    width: '100%',
    flex: 1,
    minHeight: 400,
    backgroundColor: '#000',
  },
  quickCheckBottomSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  quickCheckImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCheckOverlayText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  quickCheckChangeImageBtn: {
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  quickCheckChangeImageText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  quickCheckResultContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  quickCheckColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickCheckColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickCheckColorHex: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  quickCheckVerdictContainer: {
    alignItems: 'center',
  },
  quickCheckVerdictText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  quickCheckConfidenceText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  quickCheckExplanationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Quick Check Color Picker UI
  quickCheckCursor: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCheckCursorOuter: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
  },
  quickCheckCursorInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  quickCheckMagnifier: {
    position: 'absolute',
    width: 100,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    zIndex: 100,
  },
  quickCheckMagnifierSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  quickCheckMagnifierHex: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  quickCheckMagnifierName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
  quickCheckColorPreviewContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  quickCheckColorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickCheckColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 24,
    marginTop: 12,
    gap: 12,
  },
  quickCheckPreviewSwatch: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
  },
  quickCheckPreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  quickCheckPreviewName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickCheckPreviewHex: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  quickCheckConfirmBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickCheckConfirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  quickCheckInstructions: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickCheckInstructionsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  // Quick Check Result Screen
  quickCheckResultScreen: {
    padding: 24,
    alignItems: 'center',
  },
  quickCheckResultColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  quickCheckResultSwatch: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#fff',
  },
  quickCheckResultColorName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  quickCheckResultColorHex: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 2,
  },
  quickCheckVerdictBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  quickCheckVerdictGood: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  quickCheckVerdictNeutral: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  quickCheckVerdictWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  quickCheckVerdictText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickCheckSummaryText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  quickCheckAdviceSection: {
    marginBottom: 12,
  },
  quickCheckAdviceItem: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  quickCheckMicroNote: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    fontStyle: 'italic',
  },
  quickCheckTryAnotherBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  quickCheckTryAnotherBtnText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '600',
  },
  quickCheckNewImageBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  quickCheckNewImageBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  // Improve Accuracy Button
  improveAccuracyBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignSelf: 'flex-start',
  },
  improveAccuracyBtnText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  // Multi-Photo Styles
  multiPhotoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  multiPhotoItem: {
    alignItems: 'center',
  },
  multiPhotoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  multiPhotoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 6,
  },
  multiPhotoCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPhotoUploadBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPhotoAnalyzeBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  multiPhotoAnalyzeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  photoEditIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoEditIconText: {
    color: '#fff',
    fontSize: 12,
    transform: [{ scaleX: -1 }], // Mirror the pencil icon horizontally
  },
  // Color Profile Styles - New Design
  colorSectionNew: {
    marginBottom: 0,
  },
  colorTopSection: {
    marginBottom: 20,
  },
  colorMainTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  faceThumbnailNew: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#6366f1',
    overflow: 'hidden',
  },
  faceThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  facePhotoLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  colorSeasonInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  colorSeasonInfoRight: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  colorSeasonInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  colorSeasonInfoConfidence: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  colorNoteTextNew: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  colorNoteText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
  },
  colorNoteTextRed: {
    color: '#ef4444',
    fontSize: 12,
    lineHeight: 18,
  },
  colorNoteTextBtn: {
    color: '#6366f1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  // Trait chips row - horizontal scroll
  traitsRowWrap: {
    marginTop: 10,
    marginBottom: 12,
  },
  traitsRowWrapTight: {
    marginTop: 4,
    marginBottom: 12,
  },
  traitsRowContent: {
    gap: 10,
    paddingHorizontal: 0,
  },
  traitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignSelf: 'flex-start',
  },
  traitChipActive: {
    backgroundColor: 'rgba(99,102,241,0.16)',
    borderColor: 'rgba(99,102,241,0.35)',
  },
  traitChipText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  traitChipArrow: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
  },
  colorExplanationCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorExplanationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  colorExplanationTextNew: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 22,
  },
  colorExplanationBullet: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  colorSeasonTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  colorCategoryCard: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  colorCategoryContent: {
    paddingTop: 0,
  },
  colorCategoryName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  colorCategoryNameNeutrals: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  // Swatches - inline, no scroll, reduced gap
  swatchRowInline: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 2, // Reduced from 8 to minimize space before divider
  },
  swatchScrollContent: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 16,
  },
  colorCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryColorsBtn: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
  },
  swatchDotSecondary: {
    opacity: 0.85,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  swatchNameSecondary: {
    color: '#9ca3af',
  },
  swatchRow: {
    gap: 12,
    paddingVertical: 6,
    paddingRight: 8,
  },
  swatchItem: {
    alignItems: 'center',
    width: 64, // Fixed width to fit 5 per screen with spacing
    marginRight: 8,
  },
  swatchDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 6,
    // Add subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  swatchName: {
    color: '#D1D5DB',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
    height: 24, // Fixed height for 2 lines
  },
  secondaryColorsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  swatchScrollContentSecondary: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 16,
  },
  colorModelImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  colorModelImage: {
    width: '100%',
    height: '100%',
  },
  colorModelPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  colorModelPlaceholderText: {
    fontSize: 48,
    opacity: 0.5,
  },
  productsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 2, // Reduced from 6
    marginBottom: 4,
  },
  productsBtnTextSimple: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  productsArea: {
    marginTop: 10,
  },
  colorProductCardSmall: {
    width: 100,
    height: 120,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  colorProductImageSmall: {
    width: '100%',
    height: '100%',
  },
  colorProductPlaceholderSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  colorProductsEmptySmall: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  colorProductsEmptyTextSmall: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  // Color Profile Styles - Clean, spacious layout (keeping for backward compatibility)
  colorSectionClean: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  colorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorTitleClean: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  faceThumbnailClean: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  faceThumbnailLoading: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceThumbnailPlaceholder: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceThumbnailIcon: {
    fontSize: 24,
  },
  colorEmptyText: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
  },
  colorEmptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  colorEmptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  colorEmptyUploadBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  colorEmptyUploadBtnText: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: '600',
  },
  colorAnalyzingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  colorAnalyzingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  colorErrorText: {
    color: '#ef4444',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  colorSummaryClean: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorSummaryText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },
  colorSummaryLabel: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  colorConfidenceText: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 4,
  },
  colorsHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 4,
  },
  colorCategoryLabelClean: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  colorSwatchRowClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'nowrap',
  },
  colorSwatchItemClean: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    maxWidth: '20%',
  },
  colorSwatchClean: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 6,
  },
  colorSwatchNameClean: {
    color: '#d1d5db',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'capitalize',
    lineHeight: 12,
    paddingHorizontal: 2,
  },
  colorDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorDetailsToggleText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  colorDetailsToggleArrow: {
    color: '#9ca3af',
    fontSize: 12,
  },
  colorNoteText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  colorDetailsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorDetailsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  colorExplanationItem: {
    marginBottom: 20,
  },
  colorExplanationLabelClean: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  colorExplanationValueClean: {
    color: '#a5b4fc',
    fontWeight: '700',
  },
  colorExplanationTextClean: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  colorEditSeasonBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  colorEditSeasonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  colorSwatchRowWithNames: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    flexWrap: 'nowrap',
  },
  colorSwatchWithName: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    maxWidth: '20%',
  },
  colorSwatchLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  colorSwatchName: {
    color: '#d1d5db',
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'capitalize',
    lineHeight: 11,
    paddingHorizontal: 2,
  },
  tapForDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tapForDetailsText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  tapForDetailsArrow: {
    color: '#9ca3af',
    fontSize: 11,
  },
  colorDetailCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  colorDetailCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  colorExplanationRow: {
    marginBottom: 16,
  },
  colorExplanationLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  colorExplanationValue: {
    color: '#a5b4fc',
    fontWeight: '700',
  },
  colorExplanationText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 22,
  },
  colorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  colorChip: {
    alignItems: 'center',
    minWidth: 60,
  },
  colorChipSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 6,
  },
  colorChipText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  colorProductsScroll: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  colorProductCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    // Glass effect with subtle gradient overlay
    overflow: 'hidden',
  },
  colorProductImage: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  colorProductPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  colorProductPlaceholderIcon: {
    fontSize: 32,
    opacity: 0.5,
  },
  colorProductInfo: {
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  colorProductName: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  colorProductPrice: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '700',
  },
  colorProductsLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorProductsLoadingText: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 8,
  },
  colorProductsEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorProductsEmptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.6,
  },
  colorProductsEmptyText: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    color: '#f3f4f6',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 22,
  },
  changeSeasonBtn: {
    alignSelf: 'flex-start',
  },
  changeSeasonText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  colorProfileFaceThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  colorProfileFacePlaceholder: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorProfileFacePlaceholderText: {
    fontSize: 18,
  },
  colorProfileFaceLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
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
  supportSectionTitle: {
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
  // Fit Profile Summary Card styles
  fitProfileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fitProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  fitProfilePhotos: {
    flexDirection: 'row',
    gap: 8,
  },
  fitProfilePhotoThumbnail: {
    width: 48, // Increased by 20% (40 * 1.2 = 48)
    height: 48, // Increased by 20% (40 * 1.2 = 48)
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#6366f1',
    overflow: 'hidden',
  },
  fitProfilePhotoImage: {
    width: '100%',
    height: '100%',
  },
  fitProfilePhotoPlaceholder: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fitProfilePhotoPlaceholderText: {
    fontSize: 18,
  },
  fitProfilePhotoLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  fitProfileSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  fitProfileSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fitProfileSummaryLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  fitProfileSummaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fitProfileEditBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  fitProfileEditBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // RowItem styles
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  rowItemContent: {
    flex: 1,
  },
  rowItemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowItemSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
  },
  rowItemChevron: {
    color: '#9ca3af',
    fontSize: 20,
    fontWeight: '300',
  },
  // SectionCard styles
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  // Friend invite styles
  friendInviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  friendInviteBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  friendInviteBtnSmall: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  friendInviteBtnText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  friendSearchContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  friendSearchInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  friendsSectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  friendAddBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  friendAddBtnPending: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  friendAddBtnAccepted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  friendAddBtnText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  friendAddBtnTextPending: {
    color: '#fbbf24',
  },
  friendAddBtnTextAccepted: {
    color: '#10b981',
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendsList: {
    marginTop: 8,
  },
  friendSearchResults: {
    marginTop: 16,
  },
  friendSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  friendSearchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  radioButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  radioButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  radioButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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

export default StyleVaultScreen;
