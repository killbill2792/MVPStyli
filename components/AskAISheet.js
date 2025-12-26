import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../lib/AppContext';
import { loadColorProfile } from '../lib/colorAnalysis';
import { supabase } from '../lib/supabase';
import { recommendSizeAndFit, toInches } from '../lib/fitLogic';
import { evaluateSuitability } from '../lib/styleSuitability';
import { analyzeFabricComfort } from '../lib/fabricComfort';
import { cmToInches, parseHeightToInches } from '../lib/measurementUtils';
import { getAvailableBrands, getBrandSizeChart, convertBrandChartToFitLogic } from '../lib/brandSizeCharts';
import { hasStretch, getStretchLevel } from '../lib/materialElasticity';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;

const AskAISheet = ({ visible, onClose, product: initialProduct, selectedSize = null }) => {
  const { state, setRoute } = useApp();
  const { user } = state;
  
  // Use local state for product so we can update it with user inputs
  const [product, setProduct] = useState(initialProduct);
  
  // Update product when initialProduct changes
  useEffect(() => {
    setProduct(initialProduct);
  }, [initialProduct]);

  // Auto-detect color is now handled in the main visible useEffect below

  // Auto-detect color from product image
  const autoDetectColor = async () => {
    if (!product?.image) return;
    
    // Don't re-detect if already detecting
    if (isDetectingColor) return;
    
    setIsDetectingColor(true);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://mvpstyli-fresh.vercel.app';
      console.log('🎨 Auto-detecting color from:', product.image);
      const response = await fetch(`${API_BASE}/api/fit-check-utils`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'detect-color', imageUrl: product.image }),
      });
      
      const data = await response.json();
      console.log('🎨 Color detection response:', data);
      if (data.success && data.colorName) {
        setDetectedColor(data.colorName);
        setUserEnteredColor(data.colorName);
        // Update product color immediately
        const updatedProduct = {
          ...product,
          color: data.colorName,
        };
        setProduct(updatedProduct);
        console.log('🎨 Color detected and updated:', data.colorName);
        // Reload insights with new color after a short delay
        setTimeout(() => {
          loadInsights(true);
        }, 500);
      } else {
        console.log('🎨 Color detection failed or no color found');
      }
    } catch (error) {
      console.error('Error auto-detecting color:', error);
      // Silent fail - user can manually enter color
    } finally {
      setIsDetectingColor(false);
    }
  };
  
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(true);
  // Removed unused state: fitAdvice, sizeAdvice, styleAdvice (replaced by fitSizeData)
  const [colorSuitability, setColorSuitability] = useState(null);
  const [bodyShapeSuitability, setBodyShapeSuitability] = useState(null);
  const [fabricComfort, setFabricComfort] = useState(null);
  const [fitSizeData, setFitSizeData] = useState(null); // Combined fit & size data
  const [howToWearData, setHowToWearData] = useState(null); // Occasions and styling tips
  const [isCached, setIsCached] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false); // Client-side throttling
  const [useGemini, setUseGemini] = useState(false); // Only use Gemini when button clicked
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiAdvice, setGeminiAdvice] = useState(null); // Gemini-generated advice
  const requestInProgress = useRef(false); // Prevent multiple simultaneous requests
  
  // New state for missing data inputs
  const [showGarmentInputModal, setShowGarmentInputModal] = useState(false);
  const [showColorInputModal, setShowColorInputModal] = useState(false);
  const [showMaterialInputModal, setShowMaterialInputModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [detectedColor, setDetectedColor] = useState(null);
  const [userEnteredColor, setUserEnteredColor] = useState(null);
  const [userEnteredMaterial, setUserEnteredMaterial] = useState(null);
  const [parsedSizeChart, setParsedSizeChart] = useState(null);
  const [isDetectingColor, setIsDetectingColor] = useState(false);
  const [isParsingSizeChart, setIsParsingSizeChart] = useState(false);
  const [manualSizeChartInput, setManualSizeChartInput] = useState({});

  // Pan responder for drag-to-dismiss - ONLY on the header area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if dragging down
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      openSheet();
      // Auto-detect color immediately when Fit Check opens
      if (product?.image) {
        // Start color detection (non-blocking)
        autoDetectColor();
      }
      // Load insights (will use detected color if available, or reload when color is detected)
      loadInsights();
    } else {
      // Reset position when hidden
      translateY.setValue(SHEET_HEIGHT);
    }
  }, [visible]);

  const openSheet = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClose) onClose();
    });
  };

  const loadInsights = async (forceRefresh = false) => {
    // Client-side throttling: prevent multiple simultaneous requests
    if (requestInProgress.current && !forceRefresh) {
      console.log('⏳ Request already in progress, please wait...');
      return;
    }
    
    requestInProgress.current = true;
    setLoading(true);
    setIsRequesting(true);
    setIsCached(false);
    
    try {
      // Load user's profile directly from Supabase to get latest measurements
      let userProfileData = null;
      let colorProfile = null;
      
      if (user?.id) {
        // Fetch profile from Supabase
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (!error && profileData) {
          userProfileData = profileData;
          console.log('Loaded user profile for AI:', userProfileData);
        }
        
        // Load color profile
        colorProfile = await loadColorProfile(user.id);
      }

      // Build user profile for API (for fit/style)
      const userProfile = {
        height: userProfileData?.height || '',
        weight: userProfileData?.weight || '',
        topSize: userProfileData?.top_size || '',
        bottomSize: userProfileData?.bottom_size || '',
        chest: userProfileData?.chest || '',
        waist: userProfileData?.waist || '',
        hips: userProfileData?.hips || '',
        bodyShape: userProfileData?.body_shape || '',
        gender: userProfileData?.gender || '',
        skinTone: colorProfile?.tone || userProfileData?.color_tone || '',
        colorSeason: colorProfile?.season || userProfileData?.color_season || '',
      };
      
      // Build user profile for fitLogic (size recommendations) - needs In suffix (inches)
      // Database stores in inches, but may have old cm values - convert if needed
      // Accept both old (chest, waist, etc.) and new (chest_in, waist_in, etc.) field names
      // Helper to convert value to inches (handles both cm and inches)
      const toInchesValue = (valueIn, valueCm) => {
        // Prefer new _in fields (already in inches)
        if (valueIn != null && valueIn !== '') {
          const num = Number(valueIn);
          return isNaN(num) ? null : num;
        }
        // Fallback to old cm fields (convert to inches)
        if (valueCm != null && valueCm !== '') {
          const num = Number(valueCm);
          return isNaN(num) ? null : cmToInches(num);
        }
        return null;
      };
      
      // Helper to safely get numeric value from database (handles both string and number)
      // fitLogic's toInches() accepts numbers directly (returns as-is if finite)
      // So we should pass numbers, not strings
      const getNumericValue = (value) => {
        if (value == null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const num = parseFloat(String(value));
        return isNaN(num) ? null : num;
      };
      
      const userProfileForFitLogic = {
        // Height needs special parsing for "5.4" = 5'4" = 64 inches
        heightIn: (userProfileData?.height_in != null) 
          ? parseHeightToInches(userProfileData.height_in) 
          : (userProfileData?.height != null ? parseHeightToInches(userProfileData.height) : null),
        weightKg: getNumericValue(userProfileData?.weight_kg) ?? getNumericValue(userProfileData?.weight),
        // Check new circumference fields first (these are in inches already)
        chestIn: getNumericValue(userProfileData?.chest_circ_in) ?? getNumericValue(userProfileData?.chest_in) ?? getNumericValue(userProfileData?.chest),
        bustIn: getNumericValue(userProfileData?.bust_circ_in) ?? getNumericValue(userProfileData?.bust_in) ?? getNumericValue(userProfileData?.chest_circ_in) ?? getNumericValue(userProfileData?.chest_in) ?? getNumericValue(userProfileData?.chest),
        waistIn: getNumericValue(userProfileData?.waist_circ_in) ?? getNumericValue(userProfileData?.waist_in) ?? getNumericValue(userProfileData?.waist),
        hipsIn: getNumericValue(userProfileData?.hip_circ_in) ?? getNumericValue(userProfileData?.hips_in) ?? getNumericValue(userProfileData?.hips),
        shoulderIn: getNumericValue(userProfileData?.shoulder_width_in) ?? getNumericValue(userProfileData?.shoulder_in) ?? getNumericValue(userProfileData?.shoulder),
        inseamIn: getNumericValue(userProfileData?.inseam_in) ?? getNumericValue(userProfileData?.inseam),
        gender: userProfileData?.gender || null,
      };
      
      console.log('📏 Body measurements check:', {
        heightIn: userProfileForFitLogic.heightIn,
        chestIn: userProfileForFitLogic.chestIn,
        waistIn: userProfileForFitLogic.waistIn,
        hipsIn: userProfileForFitLogic.hipsIn,
        shoulderIn: userProfileForFitLogic.shoulderIn,
        inseamIn: userProfileForFitLogic.inseamIn,
        rawData: {
          height_in: userProfileData?.height_in,
          chest_circ_in: userProfileData?.chest_circ_in,
          chest_in: userProfileData?.chest_in,
          chest: userProfileData?.chest,
          waist_circ_in: userProfileData?.waist_circ_in,
          waist_in: userProfileData?.waist_in,
          waist: userProfileData?.waist,
          hip_circ_in: userProfileData?.hip_circ_in,
          hips_in: userProfileData?.hips_in,
          hips: userProfileData?.hips,
          shoulder_width_in: userProfileData?.shoulder_width_in,
          shoulder_in: userProfileData?.shoulder_in,
          shoulder: userProfileData?.shoulder,
          inseam_in: userProfileData?.inseam_in,
          inseam: userProfileData?.inseam,
        },
        allProfileKeys: Object.keys(userProfileData || {})
      });
      
      console.log('User profile for AI advice:', userProfile);
      console.log('User profile for fitLogic:', userProfileForFitLogic);

      // Build product info with URL for caching
      const productInfo = {
        name: product?.name || 'Item',
        category: product?.category || inferCategory(product?.name),
        color: product?.color || inferColor(product?.name),
        fabric: product?.fabric,
        fit: product?.fit,
        length: product?.length,
        price: product?.price,
        brand: product?.brand,
        url: product?.url || product?.link || product?.product_link || product?.name, // For cache key
      };

      // Build product for fitLogic - needs category mapping and sizeChart
      const category = product?.category || inferCategory(product?.name);
      const fitLogicCategory = category === 'dress' || category === 'dresses' ? 'dresses' :
                               category === 'lower' || category === 'pants' || category === 'jeans' ? 'lower_body' :
                               'upper_body';
      
      // Convert sizeChart to fitLogic format if available
      let sizeChart = [];
      if (product?.sizeChart) {
        if (Array.isArray(product.sizeChart)) {
          sizeChart = product.sizeChart;
        } else if (typeof product.sizeChart === 'object') {
          // Convert object format to array format
          sizeChart = Object.entries(product.sizeChart).map(([size, measurements]) => ({
            size,
            measurements: typeof measurements === 'object' ? measurements : {}
          }));
        }
      }
      
      // Normalize fabric stretch: single source of truth
      // Check material keywords first, then fabricStretch field
      let normalizedFabricStretch = false;
      const materialStr = (product?.fabric || product?.material || '').toLowerCase();
      const hasStretchKeywords = materialStr.includes('stretch') || 
                                  materialStr.includes('elastic') || 
                                  materialStr.includes('spandex') || 
                                  materialStr.includes('elastane') ||
                                  materialStr.includes('lycra');
      
      if (product?.fabricStretch) {
        // Direct fabric_stretch field from garment (none, low, medium, high)
        normalizedFabricStretch = product.fabricStretch !== 'none' && product.fabricStretch !== 'low';
      } else {
        // Fallback to keyword detection
        normalizedFabricStretch = hasStretchKeywords;
      }
      
      console.log('🧵 Fabric stretch normalization:', {
        material: materialStr,
        fabricStretch: product?.fabricStretch,
        hasStretchKeywords,
        normalizedFabricStretch,
      });
      
      const productForFitLogic = {
        category: fitLogicCategory,
        name: product?.name || 'Item',
        fitType: product?.fit || product?.fitType || product?.fit_type || null,
        fabricStretch: normalizedFabricStretch, // Use normalized value
        sizeChart: sizeChart,
      };
      
      // Use fitLogic for size recommendations (NO-AI)
      console.log('📏 Using fitLogic for size recommendations');
      console.log('📏 Input to fitLogic - userProfileForFitLogic:', JSON.stringify(userProfileForFitLogic, null, 2));
      console.log('📏 Input to fitLogic - productForFitLogic:', JSON.stringify(productForFitLogic, null, 2));
      const sizeRecommendation = recommendSizeAndFit(userProfileForFitLogic, productForFitLogic, {});
      console.log('📏 Size recommendation result:', JSON.stringify(sizeRecommendation, null, 2));
      console.log('📏 Missing measurements:', sizeRecommendation.missing);
      
      // Convert fitLogic result to UI format
      const missingBody = sizeRecommendation.missing?.filter(m => 
        m.includes('In') || m.includes('height') || m.includes('waist') || m.includes('chest') || m.includes('hips') || m.includes('shoulder') || m.includes('inseam')
      ) || [];
      const missingGarment = sizeRecommendation.missing?.filter(m => 
        m.includes('sizeChart') || m.includes('size chart')
      ) || [];
          
      // Size advice is now part of fitSizeData, so we don't need separate setSizeAdvice calls
          
      // Use styleSuitability for color and body shape (NO-AI)
      console.log('🎨 Using styleSuitability for color and body shape');
      console.log('🎨 Color profile loaded:', colorProfile);
      console.log('🎨 User profile data color fields:', {
        color_tone: userProfileData?.color_tone,
        color_season: userProfileData?.color_season,
        color_depth: userProfileData?.color_depth,
      });
      
      // Extract undertone from color_tone or colorProfile
      // Handle cases like "warm deep" - extract just "warm"
      let undertone = colorProfile?.tone || userProfileData?.color_tone || null;
      if (undertone && typeof undertone === 'string') {
        const toneStr = undertone.toLowerCase();
        if (toneStr.includes('warm')) undertone = 'warm';
        else if (toneStr.includes('cool')) undertone = 'cool';
        else if (toneStr.includes('neutral')) undertone = 'neutral';
      }
      
      // Extract season from color_season or colorProfile
      // Handle cases like "autumn" or "deep autumn" - extract just "autumn"
      let season = colorProfile?.season || userProfileData?.color_season || null;
      if (season && typeof season === 'string') {
        const seasonStr = season.toLowerCase();
        if (seasonStr.includes('spring')) season = 'spring';
        else if (seasonStr.includes('summer')) season = 'summer';
        else if (seasonStr.includes('autumn') || seasonStr.includes('fall')) season = 'autumn';
        else if (seasonStr.includes('winter')) season = 'winter';
      }
      
      const userProfileForSuitability = {
        undertone: undertone,
        season: season,
        bodyShape: userProfileData?.body_shape || null,
        bestColors: colorProfile?.bestColors || userProfileData?.best_colors || [],
        avoidColors: colorProfile?.avoidColors || userProfileData?.avoid_colors || [],
      };
      
      console.log('🎨 Final suitability profile:', userProfileForSuitability);
      
      // Get color - check multiple possible fields
      // IMPORTANT: Check product.color first (this is what ProductScreen passes)
      const productColorRaw = product?.color || product?.color_raw || product?.primaryColor || null;
      const productColor = (productColorRaw && String(productColorRaw).trim() !== '' && String(productColorRaw).trim() !== 'null' && String(productColorRaw).trim() !== 'undefined')
        ? String(productColorRaw).trim()
        : (inferColor(product?.name) || null);
      
      console.log('🎨 Product color check:', {
        productColor: productColor,
        productColorRaw: product?.color,
        productColor_raw: product?.color_raw,
        productPrimaryColor: product?.primaryColor,
        productName: product?.name,
        inferred: inferColor(product?.name),
        fullProduct: product,
        productKeys: Object.keys(product || {}),
      });
      
      const productForSuitability = {
        primaryColor: productColor,
        category: fitLogicCategory, // Use same category mapping
        fitType: product?.fit || product?.fitType || null,
      };
      
      console.log('🎨 Input to styleSuitability - productForSuitability:', JSON.stringify(productForSuitability, null, 2));
      console.log('🎨 Input to styleSuitability - userProfileForSuitability:', JSON.stringify(userProfileForSuitability, null, 2));
      
      const suitability = evaluateSuitability(userProfileForSuitability, productForSuitability);
      console.log('🎨 Suitability result:', JSON.stringify(suitability, null, 2));
      
      setColorSuitability(suitability.color);
      setBodyShapeSuitability(suitability.body);
      
      // Use fabricComfort for fabric analysis (NO-AI)
      console.log('🧵 Using fabricComfort for fabric analysis');
      const fabricAnalysis = analyzeFabricComfort({
        material: product?.material || product?.fabric || null,
        fabric: product?.fabric || null,
      });
      console.log('🧵 Fabric analysis result:', fabricAnalysis);
      setFabricComfort(fabricAnalysis);
      
      // Build FIT & SIZE combined data with proper status labels
      let fitSizeStatus = 'High Risk';
      if (sizeRecommendation.status === 'OK') {
        if (sizeRecommendation.risk === 'low') {
          fitSizeStatus = 'Perfect Fit';
        } else if (sizeRecommendation.risk === 'medium') {
          fitSizeStatus = 'Good Fit';
        } else {
          fitSizeStatus = 'Good with Tweaks';
        }
        // Check insights for "runs small" or "runs large" indicators
        const insightsText = sizeRecommendation.insights?.join(' ') || '';
        if (insightsText.toLowerCase().includes('runs small') || insightsText.toLowerCase().includes('too small') || insightsText.toLowerCase().includes('smaller than')) {
          fitSizeStatus = 'Runs Small';
        } else if (insightsText.toLowerCase().includes('runs large') || insightsText.toLowerCase().includes('too large') || insightsText.toLowerCase().includes('larger than')) {
          fitSizeStatus = 'Runs Large';
        }
      } else {
        fitSizeStatus = 'High Risk';
      }
      
      // Build measurement deltas from sizeRecommendation insights (2-5 bullets)
      // Extract insights that contain measurement information
      const measurementDeltas = sizeRecommendation.insights?.filter(insight => {
        const lower = insight.toLowerCase();
        return lower.includes('cm') || lower.includes('in') || lower.includes('≈') || 
               lower.includes('chest') || lower.includes('waist') || lower.includes('hip') ||
               lower.includes('shoulder') || lower.includes('inseam') || lower.includes('length') ||
               lower.includes('ease') || lower.includes('room') || lower.includes('tight');
      }).slice(0, 5) || []; // Max 5 bullets
      
      // Build stylist translation (human-readable summary sentence)
      // Use the last insight that's not a measurement delta, or create a summary
      const nonMeasurementInsights = sizeRecommendation.insights?.filter(insight => {
        const lower = insight.toLowerCase();
        return !(lower.includes('cm') || lower.includes('in') || lower.includes('≈'));
      }) || [];
      
      const stylistTranslation = nonMeasurementInsights.length > 0
        ? nonMeasurementInsights[nonMeasurementInsights.length - 1]
        : sizeRecommendation.insights?.length > 0
        ? sizeRecommendation.insights[sizeRecommendation.insights.length - 1]
        : 'Fit analysis based on your measurements and garment dimensions.';
      
      // Reuse missingBody and missingGarment from above (already declared at line 231-236)
      setFitSizeData({
        status: fitSizeStatus,
        recommendedSize: sizeRecommendation.status === 'OK' ? sizeRecommendation.recommendedSize : null,
        backupSize: sizeRecommendation.backupSize,
        risk: sizeRecommendation.risk,
        confidence: sizeRecommendation.confidence,
        measurementDeltas: measurementDeltas.slice(0, 5), // Max 5 bullets
        stylistTranslation,
        hasEnoughData: sizeRecommendation.status === 'OK',
        missingData: sizeRecommendation.status !== 'OK' ? sizeRecommendation.insights : [],
        missingBody: missingBody.length > 0,
        missingGarment: missingGarment.length > 0,
      });
      
      // Build HOW TO WEAR data (use basic rule-based for now, Gemini can enhance)
      const occasions = product?.category === 'dress' || product?.category === 'dresses' 
        ? ['Work', 'Date Night', 'Casual', 'Formal']
        : product?.category === 'upper' || product?.category === 'upper_body'
        ? ['Casual', 'Work', 'Weekend', 'Layering']
        : ['Casual', 'Work', 'Weekend', 'Active'];
      
      const stylingTips = [
        product?.fit === 'oversized' ? 'Pair with fitted bottoms for balance' : null,
        product?.color ? `Works with neutral accessories` : null,
        'Layer with basics for versatility',
        'Add statement piece for interest',
      ].filter(Boolean);
      
      setHowToWearData({
        occasions: occasions.slice(0, 5),
        stylingTips: stylingTips.slice(0, 4),
      });
      
      // DO NOT call Gemini here - only when button is clicked
      // Gemini will be called separately via callGeminiInsights function
      
    } catch (error) {
      console.error('Error loading Fit Check insights:', error);
      // Set empty fallback
      setFitSizeData({
        status: 'High Risk',
        recommendedSize: null,
        backupSize: null,
        risk: 'high',
        confidence: 0,
        measurementDeltas: [],
        stylistTranslation: 'Unable to analyze fit. Please check your measurements and product details.',
        hasEnoughData: false,
        missingData: ['Unable to load fit analysis'],
        missingBody: true,
        missingGarment: false,
      });
      setColorSuitability({ status: 'INSUFFICIENT_DATA', verdict: null, reasons: ['Unable to analyze color'], alternatives: [] });
      setBodyShapeSuitability({ status: 'INSUFFICIENT_DATA', verdict: null, reasons: ['Unable to analyze body shape'], alternatives: [] });
      setFabricComfort({ verdict: 'Need Fabric Info', insights: ['Unable to analyze fabric'], hasEnoughData: false });
    } finally {
      setLoading(false);
      setIsRequesting(false);
      requestInProgress.current = false;
    }
  };
  
  // Call Gemini insights when button is clicked
  const callGeminiInsights = async () => {
    if (geminiLoading) return;
    
    setGeminiLoading(true);
    try {
      // Load user profile data
      let userProfileData = null;
      if (user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileData) userProfileData = profileData;
      }
      
      const colorProfile = user?.id ? await loadColorProfile(user.id) : null;
      
      const userProfile = {
        height: userProfileData?.height || '',
        weight: userProfileData?.weight || '',
        topSize: userProfileData?.top_size || '',
        bottomSize: userProfileData?.bottom_size || '',
        chest: userProfileData?.chest || '',
        waist: userProfileData?.waist || '',
        hips: userProfileData?.hips || '',
        bodyShape: userProfileData?.body_shape || '',
        gender: userProfileData?.gender || '',
        skinTone: colorProfile?.tone || userProfileData?.color_tone || '',
        colorSeason: colorProfile?.season || userProfileData?.color_season || '',
      };
      
      const productInfo = {
        name: product?.name || 'Item',
        category: product?.category || inferCategory(product?.name),
        color: product?.color || inferColor(product?.name),
        fabric: product?.fabric,
        fit: product?.fit,
        length: product?.length,
        price: product?.price,
        brand: product?.brand,
      };
      
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
      if (!API_BASE) {
        alert('API not configured');
        return;
      }
      
      const requestBody = {
        userProfile,
        product: productInfo,
        userId: user?.id,
        garment_id: product?.garment_id || product?.id,
      };
      
      // Call Gemini for enhanced insights
      const [fitResponse, styleResponse] = await Promise.all([
        fetch(`${API_BASE}/api/ai-insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, insightType: 'fit' })
        }),
        fetch(`${API_BASE}/api/ai-insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, insightType: 'style' })
        })
      ]);
      
      if (fitResponse.ok) {
        const fitData = await fitResponse.json();
        if (fitData.insights) {
          setGeminiAdvice(prev => ({ ...prev, fit: fitData.insights }));
        }
      }
      
      if (styleResponse.ok) {
        const styleData = await styleResponse.json();
        if (styleData.insights) {
          setGeminiAdvice(prev => ({ ...prev, style: styleData.insights }));
          // Update how to wear with Gemini insights
          if (styleData.insights.bestFor || styleData.insights.stylingTips) {
            setHowToWearData(prev => ({
              occasions: styleData.insights.bestFor || prev?.occasions || [],
              stylingTips: styleData.insights.stylingTips || prev?.stylingTips || [],
            }));
          }
        }
      }
      
      setUseGemini(true);
    } catch (error) {
      console.error('Gemini error:', error);
      alert('Failed to get AI insights. Please try again.');
    } finally {
      setGeminiLoading(false);
    }
  };

  // Helper to infer category from product name
  const inferCategory = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower.includes('dress')) return 'dress';
    if (lower.includes('top') || lower.includes('blouse') || lower.includes('shirt')) return 'top';
    if (lower.includes('pant') || lower.includes('trouser') || lower.includes('jean')) return 'pants';
    if (lower.includes('skirt')) return 'skirt';
    if (lower.includes('jacket') || lower.includes('coat') || lower.includes('blazer')) return 'jacket';
    return '';
  };

  // Helper to infer color from product name
  const inferColor = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    const colors = ['black', 'white', 'red', 'blue', 'green', 'pink', 'yellow', 'orange', 'purple', 'brown', 'beige', 'grey', 'gray', 'navy', 'cream', 'ivory'];
    for (const color of colors) {
      if (lower.includes(color)) return color;
    }
    return '';
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Animated.View 
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View 
        style={[
          styles.sheet,
          { transform: [{ translateY }] }
        ]}
      >
        {/* Draggable Header Area - ONLY this area responds to drag */}
        <View {...panResponder.panHandlers}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={{ fontSize: 24 }}>✨</Text>
            </View>
            <Text style={styles.headerTitle}>Stylit Notes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!useGemini && (
                <Pressable 
                  onPress={callGeminiInsights}
                  style={{ 
                    paddingVertical: 6, 
                    paddingHorizontal: 12, 
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderRadius: 8,
                  }}
                  disabled={geminiLoading}
                >
                  <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: '600' }}>
                    {geminiLoading ? '...' : 'Gemini'}
                  </Text>
                </Pressable>
              )}
              {isCached && (
                <>
                  <Pressable 
                    onPress={() => loadInsights(true)}
                    style={{ padding: 4 }}
                    disabled={isRequesting}
                  >
                    <Text style={{ fontSize: 16 }}>🔄</Text>
                  </Pressable>
                  <Text style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                    Cached
                  </Text>
                </>
              )}
            <Pressable style={styles.closeBtn} onPress={closeSheet}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
            </View>
          </View>
        </View>

        {/* Content - Scrollable, NOT affected by pan responder */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled={true}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>
                {isRequesting ? 'Analyzing your perfect fit...' : 'Please wait...'}
              </Text>
            </View>
          ) : (
            <>
              {/* Section 1: FIT & SIZE (Primary) */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>📏</Text>
                  <Text style={styles.cardTitle}>FIT & SIZE</Text>
                </View>

                {!fitSizeData?.hasEnoughData ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>
                      {fitSizeData?.missingGarment
                        ? 'Failed to fetch garment measurements. Size chart not available for this product.'
                        : fitSizeData?.missingBody
                        ? 'Need body measurements. Add your measurements in Fit Profile.'
                        : fitSizeData?.missingData?.join(' ') || 'Need body measurements and garment size chart for accurate fit analysis.'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {fitSizeData?.missingBody && (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => {
                            closeSheet();
                            // Navigate to account and set flag to open Edit Fit Profile
                            AsyncStorage.setItem('openFitProfile', 'true');
                            setRoute('account');
                          }}
                        >
                          <Text style={styles.addDataBtnText}>📏 Add Body Measurements →</Text>
                        </Pressable>
                      )}
                      {fitSizeData?.missingGarment && (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => setShowGarmentInputModal(true)}
                        >
                          <Text style={styles.addDataBtnText}>📐 Add Garment Measurements →</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <>
                    {/* Status Label */}
                    <View style={[
                      styles.verdictBadge,
                      fitSizeData?.status === 'Perfect Fit' && styles.verdictGood,
                      fitSizeData?.status === 'Good Fit' && styles.verdictGood,
                      fitSizeData?.status === 'Good with Tweaks' && styles.verdictNeutral,
                      (fitSizeData?.status === 'Runs Small' || fitSizeData?.status === 'Runs Large' || fitSizeData?.status === 'High Risk') && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>{fitSizeData?.status || 'Analyzing...'}</Text>
                    </View>

                    {/* Recommended Size */}
                    {fitSizeData?.recommendedSize ? (
                      <View style={styles.sizeRecommendation}>
                        <Text style={styles.sizeLabel}>Recommended Size:</Text>
                        <View style={styles.sizeBadge}>
                          <Text style={styles.sizeText}>{fitSizeData.recommendedSize}</Text>
                        </View>
                        {fitSizeData?.backupSize && (
                          <Text style={styles.backupSize}>Backup: {fitSizeData.backupSize}</Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.missingDataText}>Need size chart</Text>
                    )}

                    {/* Measurement Deltas (2-5 bullets) */}
                    {fitSizeData?.measurementDeltas && fitSizeData.measurementDeltas.length > 0 && (
                      <View style={styles.adviceSection}>
                        {fitSizeData.measurementDeltas.map((delta, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {delta}</Text>
                        ))}
                      </View>
                    )}

                    {/* Stylist Translation */}
                    {fitSizeData?.stylistTranslation && (
                      <View style={styles.stylistTranslationBox}>
                        <Text style={styles.stylistTranslationText}>{fitSizeData.stylistTranslation}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 2: COLOR */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>🎨</Text>
                  <Text style={styles.cardTitle}>COLOR</Text>
                </View>

                {colorSuitability?.status === 'INSUFFICIENT_DATA' ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>
                      {colorSuitability.reasons?.[0]?.includes('Color Profile') 
                        ? 'Need Color Info: Set your Color Profile (undertone + depth)'
                        : 'Need Color Info: Product color not detected'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {colorSuitability.reasons?.[0]?.includes('Color Profile') ? (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => {
                            closeSheet();
                            setRoute('account');
                          }}
                        >
                          <Text style={styles.addDataBtnText}>Set Color Profile →</Text>
                        </Pressable>
                      ) : (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => setShowColorInputModal(true)}
                        >
                          <Text style={styles.addDataBtnText}>🎨 Detect/Enter Color →</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={[
                      styles.verdictBadge,
                      colorSuitability?.verdict === 'great' && styles.verdictGood,
                      colorSuitability?.verdict === 'ok' && styles.verdictNeutral,
                      colorSuitability?.verdict === 'risky' && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>
                        {colorSuitability?.verdict === 'great' && '✅ Great'}
                        {colorSuitability?.verdict === 'ok' && '⚡ OK'}
                        {colorSuitability?.verdict === 'risky' && '⚠️ Risky'}
                      </Text>
                    </View>

                    {colorSuitability?.reasons && colorSuitability.reasons.length > 0 && (
                      <View style={styles.adviceSection}>
                        {colorSuitability.reasons.slice(0, 4).map((reason, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {reason}</Text>
                        ))}
                      </View>
                    )}

                    {colorSuitability?.alternatives && colorSuitability.alternatives.length > 0 && (
                      <View style={styles.alternativesSection}>
                        <Text style={styles.alternativesTitle}>Alternate Colors:</Text>
                        {colorSuitability.alternatives.slice(0, 3).map((alt, idx) => (
                          <Text key={idx} style={styles.alternativeItem}>• {alt}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 3: BODY SHAPE */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>👗</Text>
                  <Text style={styles.cardTitle}>BODY SHAPE</Text>
                </View>

                {bodyShapeSuitability?.status === 'INSUFFICIENT_DATA' ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>Generic safe advice: This fit should work for most body types; tweak with styling (tuck, belt, layering).</Text>
                    <Pressable 
                      style={styles.addDataBtn}
                      onPress={() => {
                        closeSheet();
                        setRoute('account');
                      }}
                    >
                      <Text style={styles.addDataBtnText}>Set Body Shape →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={[
                      styles.verdictBadge,
                      bodyShapeSuitability?.verdict === 'flattering' && styles.verdictGood,
                      bodyShapeSuitability?.verdict === 'ok' && styles.verdictNeutral,
                      bodyShapeSuitability?.verdict === 'neutral' && styles.verdictNeutral,
                      bodyShapeSuitability?.verdict === 'risky' && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>
                        {bodyShapeSuitability?.verdict === 'flattering' && '✅ Flattering'}
                        {(bodyShapeSuitability?.verdict === 'ok' || bodyShapeSuitability?.verdict === 'neutral') && '⚡ Neutral'}
                        {bodyShapeSuitability?.verdict === 'risky' && '⚠️ Risky'}
                      </Text>
                      </View>

                    {bodyShapeSuitability?.reasons && bodyShapeSuitability.reasons.length > 0 && (
                      <View style={styles.adviceSection}>
                        {bodyShapeSuitability.reasons.slice(0, 4).map((reason, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {reason}</Text>
                        ))}
                    </View>
                    )}

                    {bodyShapeSuitability?.alternatives && bodyShapeSuitability.alternatives.length > 0 && (
                      <View style={styles.alternativesSection}>
                        <Text style={styles.alternativesTitle}>Tweak Tip:</Text>
                        {bodyShapeSuitability.alternatives.slice(0, 1).map((alt, idx) => (
                          <Text key={idx} style={styles.alternativeItem}>• {alt}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 4: FABRIC & COMFORT (New) */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>🧵</Text>
                  <Text style={styles.cardTitle}>FABRIC & COMFORT</Text>
                </View>

                {fabricComfort?.status === 'INSUFFICIENT_DATA' ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>{fabricComfort.insights?.[0] || 'Need Fabric Info'}</Text>
                    <Pressable 
                      style={styles.addDataBtn}
                      onPress={() => setShowMaterialInputModal(true)}
                    >
                      <Text style={styles.addDataBtnText}>🧵 Enter Material →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={[
                      styles.verdictBadge,
                      fabricComfort?.verdict === 'comfortable' && styles.verdictGood,
                      fabricComfort?.verdict === 'ok' && styles.verdictNeutral,
                      fabricComfort?.verdict === 'risky' && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>
                        {fabricComfort?.verdict === 'comfortable' && '✅ Comfortable'}
                        {fabricComfort?.verdict === 'ok' && '⚡ Okay'}
                        {fabricComfort?.verdict === 'risky' && '⚠️ Risky'}
                      </Text>
                    </View>

                    {fabricComfort?.insights && fabricComfort.insights.length > 0 && (
                      <View style={styles.adviceSection}>
                        {fabricComfort.insights.slice(0, 4).map((insight, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {insight}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 5: HOW TO WEAR / OCCASIONS */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>💡</Text>
                  <Text style={styles.cardTitle}>HOW TO WEAR / OCCASIONS</Text>
                </View>

                {howToWearData?.occasions && howToWearData.occasions.length > 0 && (
                  <View style={styles.bestForSection}>
                    <View style={styles.tagRow}>
                      {howToWearData.occasions.slice(0, 5).map((item, idx) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {howToWearData?.stylingTips && howToWearData.stylingTips.length > 0 && (
                  <View style={styles.tipsSection}>
                    {howToWearData.stylingTips.slice(0, 4).map((tip, idx) => (
                      <Text key={idx} style={styles.tipItem}>• {tip}</Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Bottom padding */}
              <View style={{ height: 60 }} />
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Garment Measurements Input Modal */}
      <Modal
        visible={showGarmentInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGarmentInputModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Garment Measurements</Text>
              <Pressable onPress={() => setShowGarmentInputModal(false)}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Option 1: Select from Brand */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>1. Select Brand (if available)</Text>
                <Text style={styles.modalSectionSubtitle}>Choose from brands with consistent size charts</Text>
                <FlatList
                  data={getAvailableBrands()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.brandButton,
                        selectedBrand === item && styles.brandButtonActive
                      ]}
                      onPress={() => {
                        setSelectedBrand(item);
                        // Auto-apply brand size chart
                        const category = product?.category || 'upper_body';
                        const brandChart = getBrandSizeChart(item, category);
                        if (brandChart) {
                          const sizeChart = convertBrandChartToFitLogic(brandChart);
                          setParsedSizeChart(sizeChart);
                          // Update product with size chart and reload insights
                          const updatedProduct = {
                            ...product,
                            sizeChart: sizeChart,
                            brand: item,
                          };
                          // Trigger reload with new data
                          setTimeout(() => {
                            loadInsights(true);
                          }, 100);
                        }
                      }}
                    >
                      <Text style={[
                        styles.brandButtonText,
                        selectedBrand === item && styles.brandButtonTextActive
                      ]}>
                        {item}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>

              {/* Option 2: Upload Screenshot */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>2. Upload Size Chart Screenshot</Text>
                <Text style={styles.modalSectionSubtitle}>Take a photo of the size chart from the product page</Text>
                <Pressable
                  style={styles.uploadButton}
                  onPress={async () => {
                    try {
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert('Permission needed', 'Please allow access to your photos');
                        return;
                      }

                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: false,
                        quality: 1,
                      });

                      if (!result.canceled && result.assets[0]) {
                        setIsParsingSizeChart(true);
                        const imageUri = result.assets[0].uri;
                        
                        // Convert image to base64
                        const response = await fetch(imageUri);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result;
                          
                          // Call fit-check-utils API for parsing size chart
                          try {
                            const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://mvpstyli-fresh.vercel.app';
                            const parseResponse = await fetch(`${API_BASE}/api/fit-check-utils`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ type: 'parse-size-chart', imageBase64: base64 }),
                            });
                            
                            const parseData = await parseResponse.json();
                            
                            if (parseData.success && parseData.data) {
                              setParsedSizeChart(parseData.data);
                              // Update product and reload
                              const updatedProduct = {
                                ...product,
                                sizeChart: parseData.data,
                              };
                              setProduct(updatedProduct);
                              setShowGarmentInputModal(false);
                              setTimeout(() => {
                                loadInsights(true);
                              }, 100);
                            } else {
                              // Show manual input with pre-filled structure
                              setManualSizeChartInput(parseData.structure || {
                                sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
                                measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
                              });
                              // Don't close modal - show manual input form
                            }
                          } catch (error) {
                            console.error('Error parsing size chart:', error);
                            Alert.alert('Error', 'Failed to parse size chart. Please try manual input.');
                          } finally {
                            setIsParsingSizeChart(false);
                          }
                        };
                        reader.readAsDataURL(blob);
                      }
                    } catch (error) {
                      console.error('Error picking image:', error);
                      Alert.alert('Error', 'Failed to pick image');
                      setIsParsingSizeChart(false);
                    }
                  }}
                >
                  {isParsingSizeChart ? (
                    <ActivityIndicator color="#6366f1" />
                  ) : (
                    <>
                      <Text style={styles.uploadButtonText}>📷 Upload Screenshot</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* Option 3: Manual Input */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>3. Enter Manually</Text>
                <Text style={styles.modalSectionSubtitle}>If brand is not available or screenshot parsing failed</Text>
                <Pressable
                  style={styles.uploadButton}
                  onPress={() => {
                    // Show manual input form
                    setManualSizeChartInput({
                      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
                      measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
                    });
                  }}
                >
                  <Text style={styles.uploadButtonText}>✏️ Enter Measurements</Text>
                </Pressable>
              </View>

              {/* Manual Input Form */}
              {Object.keys(manualSizeChartInput).length > 0 && manualSizeChartInput.sizes && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Manual Size Chart Entry</Text>
                  <ScrollView style={{ maxHeight: 400 }}>
                    {manualSizeChartInput.sizes.map((size) => (
                      <View key={size} style={styles.manualSizeRow}>
                        <Text style={styles.manualSizeLabel}>{size}:</Text>
                        <View style={styles.manualMeasurementsRow}>
                          {manualSizeChartInput.measurements?.map((measure) => (
                            <View key={measure} style={styles.manualMeasurementInput}>
                              <Text style={styles.manualMeasurementLabel}>{measure}</Text>
                              <TextInput
                                style={styles.manualMeasurementTextInput}
                                placeholder="0"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={manualSizeChartInput[`${size}_${measure}`] || ''}
                                onChangeText={(text) => {
                                  setManualSizeChartInput({
                                    ...manualSizeChartInput,
                                    [`${size}_${measure}`]: text,
                                  });
                                }}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => {
                      // Convert manual input to size chart format
                      const sizeChart = manualSizeChartInput.sizes.map((size) => {
                        const measurements = {};
                        manualSizeChartInput.measurements.forEach((measure) => {
                          const value = parseFloat(manualSizeChartInput[`${size}_${measure}`]);
                          if (!isNaN(value)) {
                            measurements[measure] = value;
                          }
                        });
                        return { size, measurements };
                      }).filter(item => Object.keys(item.measurements).length > 0);

                      if (sizeChart.length > 0) {
                        setParsedSizeChart(sizeChart);
                        const updatedProduct = {
                          ...product,
                          sizeChart: sizeChart,
                        };
                        setProduct(updatedProduct);
                        setShowGarmentInputModal(false);
                        setManualSizeChartInput({});
                        setTimeout(() => {
                          loadInsights(true);
                        }, 100);
                      } else {
                        Alert.alert('Error', 'Please enter at least one measurement');
                      }
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save Size Chart</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Color Input Modal */}
      <Modal
        visible={showColorInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColorInputModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detect/Enter Product Color</Text>
              <Pressable onPress={() => setShowColorInputModal(false)}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Show detected color or allow manual entry */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>
                  {detectedColor ? 'Detected Color' : 'Product Color'}
                </Text>
                {isDetectingColor ? (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <ActivityIndicator color="#6366f1" size="large" />
                    <Text style={{ color: '#9ca3af', marginTop: 10 }}>Detecting color...</Text>
                  </View>
                ) : (
                  <>
                    {detectedColor && (
                      <Text style={styles.detectedColorText}>
                        Auto-detected: {detectedColor}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Manual input */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Or Enter Manually</Text>
                <TextInput
                  style={styles.colorInput}
                  placeholder="e.g., Navy, Black, Plum Purple"
                  placeholderTextColor="#666"
                  value={userEnteredColor || detectedColor || ''}
                  onChangeText={setUserEnteredColor}
                />
                <Pressable
                  style={styles.saveButton}
                  onPress={() => {
                    if (userEnteredColor || detectedColor) {
                      const updatedProduct = {
                        ...product,
                        color: userEnteredColor || detectedColor,
                      };
                      setProduct(updatedProduct);
                      setShowColorInputModal(false);
                      setTimeout(() => {
                        loadInsights(true);
                      }, 100);
                    }
                  }}
                >
                  <Text style={styles.saveButtonText}>Save Color</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Material Input Modal */}
      <Modal
        visible={showMaterialInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMaterialInputModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Material</Text>
              <Pressable onPress={() => setShowMaterialInputModal(false)}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Material Composition</Text>
                <Text style={styles.modalSectionSubtitle}>e.g., "Cotton, Spandex" or "100% Polyester"</Text>
                <TextInput
                  style={styles.materialInput}
                  placeholder="Enter material..."
                  placeholderTextColor="#666"
                  value={userEnteredMaterial || ''}
                  onChangeText={setUserEnteredMaterial}
                  multiline
                />
                {userEnteredMaterial && (
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialInfoLabel}>Stretch detected:</Text>
                    <Text style={styles.materialInfoValue}>
                      {hasStretch(userEnteredMaterial) ? 'Yes' : 'No'} ({getStretchLevel(userEnteredMaterial)})
                    </Text>
                  </View>
                )}
                <Pressable
                  style={styles.saveButton}
                  onPress={() => {
                    if (userEnteredMaterial) {
                      const updatedProduct = {
                        ...product,
                        material: userEnteredMaterial,
                        fabric: userEnteredMaterial,
                        fabricStretch: hasStretch(userEnteredMaterial) ? 'medium' : 'none',
                      };
                      setProduct(updatedProduct);
                      setShowMaterialInputModal(false);
                      setTimeout(() => {
                        loadInsights(true);
                      }, 100);
                    }
                  }}
                >
                  <Text style={styles.saveButtonText}>Save Material</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  missingDataBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  missingDataText: {
    color: '#fbbf24',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  addDataBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addDataBtnText: {
    color: '#fbbf24',
    fontWeight: '600',
    fontSize: 14,
  },
  verdictBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  verdictGood: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verdictNeutral: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  verdictWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  verdictText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  adviceSection: {
    marginBottom: 12,
  },
  adviceSectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  adviceItem: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  sizeRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sizeLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginRight: 8,
  },
  sizeBadge: {
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  sizeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backupSize: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  confidenceLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginRight: 8,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  insightsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightsTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  insightItem: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  riskLow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  riskMedium: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  riskHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  riskLabel: {
    color: '#9ca3af',
    fontSize: 13,
  },
  riskText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bestForSection: {
    marginBottom: 16,
  },
  bestForLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tagText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '500',
  },
  occasionsSection: {
    marginBottom: 16,
  },
  occasionsLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  occasionsText: {
    color: '#fff',
    fontSize: 14,
  },
  tipsSection: {
    marginTop: 8,
  },
  tipsTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  tipItem: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 8,
  },
  alternativesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  alternativesTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  alternativeItem: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  stylistTranslationBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  stylistTranslationText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseBtn: {
    fontSize: 24,
    color: '#fff',
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  modalScroll: {
    flexGrow: 1,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalSectionSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  brandButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  brandButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  brandButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  brandButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  uploadButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginTop: 8,
  },
  uploadButtonText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '600',
  },
  colorInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  materialInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  materialInfo: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  materialInfoLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  materialInfoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detectedColorText: {
    color: '#10b981',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Manual size chart input styles
  manualSizeRow: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  manualSizeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  manualMeasurementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manualMeasurementInput: {
    width: '30%',
    minWidth: 80,
  },
  manualMeasurementLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  manualMeasurementTextInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14,
  },
});

export default AskAISheet;
