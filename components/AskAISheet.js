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
import { detectDominantColor, clearColorCache } from '../lib/colorDetection';
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

  // Auto-detect color from product image (ALWAYS uses original product image, never try-on result)
  const autoDetectColor = async () => {
    // Always use original product image, never try-on result
    const imageToUse = originalProductImage.current || product?.image;
    
    if (!imageToUse) {
      console.log('🎨 [CLIENT COLOR] No product image available for color detection');
      return;
    }
    
    // Don't re-detect if already detecting
    if (isDetectingColor) {
      console.log('🎨 [CLIENT COLOR] Color detection already in progress');
      return;
    }
    
    setIsDetectingColor(true);
    try {
      console.log('🎨 [CLIENT COLOR] Starting color detection from ORIGINAL product image:', imageToUse.substring(0, 100));
      
      // Use client-side color detection (no API call)
      const colorResult = await detectDominantColor(imageToUse);
      
      console.log('🎨 [CLIENT COLOR] Color detection result:', JSON.stringify(colorResult, null, 2));
      
      if (colorResult && colorResult.color && colorResult.confidence > 0) {
        const hex = colorResult.color;
        const name = colorResult.name || 'unknown';
        
        console.log('🎨 [CLIENT COLOR] Color detected successfully:', {
          name: name,
          hex: hex,
          rgb: colorResult.rgb || 'N/A',
          confidence: colorResult.confidence,
        });
        
        setDetectedColor(name);
        setDetectedColorHex(hex);
        setUserEnteredColor(name);
        setColorSource('auto-detected'); // Mark as auto-detected
        
        // Update product - store hex as source of truth, name for UI
        const updatedProduct = {
          ...product,
          color: name, // For UI display
          colorHex: hex, // Source of truth for logic
        };
        setProduct(updatedProduct);
        console.log('🎨 [CLIENT COLOR] Product color updated:', { name, hex });
        
        // Reload insights with new color after a short delay
        setTimeout(() => {
          console.log('🎨 [CLIENT COLOR] Reloading insights with new color');
          loadInsights(true);
        }, 500);
      } else {
        console.warn('🎨 [CLIENT COLOR] Color detection failed or returned unknown:', {
          name: colorResult?.name,
          confidence: colorResult?.confidence,
          fullResult: colorResult,
        });
      }
    } catch (error) {
      console.error('🎨 [CLIENT COLOR] Error auto-detecting color:', error);
      console.error('🎨 [CLIENT COLOR] Error stack:', error.stack);
      // Silent fail - user can manually enter color
    } finally {
      setIsDetectingColor(false);
    }
  };
  
  // Helper to infer color from product name (moved to avoid duplicate)
  const inferColorFromName = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    const colors = ['black', 'white', 'red', 'blue', 'green', 'pink', 'yellow', 'orange', 'purple', 'brown', 'beige', 'grey', 'gray', 'navy', 'cream', 'ivory', 'burgundy', 'maroon', 'plum', 'coral', 'salmon', 'teal', 'emerald', 'lavender', 'violet', 'rust', 'olive', 'khaki', 'camel', 'tan'];
    for (const color of colors) {
      if (lower.includes(color)) return color;
    }
    return '';
  };
  
  // Manual Color Picker State (COMPLETELY SEPARATE from auto-detect)
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [pickerTouchPosition, setPickerTouchPosition] = useState(null);
  const [magnifierPosition, setMagnifierPosition] = useState(null);
  const [livePickedColor, setLivePickedColor] = useState(null);
  const [isSamplingColor, setIsSamplingColor] = useState(false);
  const colorPickerImageUrlRef = useRef(null); // Pre-loaded image URL for API
  const colorPickerApiInProgress = useRef(false);
  
  // Convert touch coordinates to image pixel coordinates (accounts for resizeMode: contain letterboxing)
  // Follows exact specification: scale = min(containerW / naturalW, containerH / naturalH)
  const convertTouchToImageCoords = (touchX, touchY) => {
    if (!imageLayout.width || !imageLayout.height || !imageNaturalSize.width || !imageNaturalSize.height) {
      console.warn('🎨 [MANUAL PICKER] Missing layout or natural size:', {
        layout: imageLayout,
        natural: imageNaturalSize,
      });
      return null;
    }
    
    const containerW = imageLayout.width;
    const containerH = imageLayout.height;
    const naturalW = imageNaturalSize.width;
    const naturalH = imageNaturalSize.height;
    
    // Calculate scale: min(containerW / naturalW, containerH / naturalH)
    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    
    // Calculate displayed image dimensions
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    
    // Calculate offsets (centering)
    const offsetX = (containerW - displayW) / 2;
    const offsetY = (containerH - displayH) / 2;
    
    // Convert touch coordinates to coordinates relative to displayed image
    const ix = touchX - offsetX;
    const iy = touchY - offsetY;
    
    // Check if touch is outside displayed image rect
    if (ix < 0 || ix > displayW || iy < 0 || iy > displayH) {
      console.warn('🎨 [MANUAL PICKER] Touch outside image bounds:', {
        touchX, touchY,
        ix, iy,
        displayW, displayH,
        offsetX, offsetY,
      });
      return null; // Touch outside image
    }
    
    // Clamp to displayed image bounds
    const clampedIx = Math.max(0, Math.min(ix, displayW));
    const clampedIy = Math.max(0, Math.min(iy, displayH));
    
    // Convert displayed image coordinates to actual image pixel coordinates
    const pixelX = Math.floor((clampedIx / displayW) * naturalW);
    const pixelY = Math.floor((clampedIy / displayH) * naturalH);
    
    // Final clamp to image bounds
    const finalX = Math.max(0, Math.min(pixelX, naturalW - 1));
    const finalY = Math.max(0, Math.min(pixelY, naturalH - 1));
    
    return {
      imageX: finalX,
      imageY: finalY,
      displayX: clampedIx,
      displayY: clampedIy,
      displayWidth: displayW,
      displayHeight: displayH,
    };
  };
  
  // Manual color picker - CLIENT-SIDE ONLY, never calls auto-detect
  // Live preview handler - NO API CALLS, just UI updates for instant feedback
  const handleManualColorPickerMove = (touchX, touchY) => {
    // Convert touch coordinates to image coordinates (accounts for letterboxing)
    const coords = convertTouchToImageCoords(touchX, touchY);
    if (!coords) {
      // Touch outside image - don't update
      return;
    }

    // Update touch position for magnifier/crosshair (live preview) - immediate UI update (0ms latency)
    setPickerTouchPosition({ x: touchX, y: touchY });
    setMagnifierPosition({ x: touchX, y: Math.max(10, touchY - 150) }); // Position above finger
    
    // NO API CALLS during move - only visual feedback
  };
  
  // Pick color at coordinates - called only on release
  const pickColorAtCoordinates = async (touchX, touchY) => {
    // Try to get image URL from multiple sources
    let imageUrl = colorPickerImageUrlRef.current;
    if (!imageUrl) {
      // Fallback: try to get from current state
      imageUrl = originalProductImage.current || product?.image;
      if (imageUrl) {
        console.log('🎨 [MANUAL PICKER] Using fallback image URL');
        colorPickerImageUrlRef.current = imageUrl;
      }
    }
    
    if (!imageUrl) {
      console.error('🎨 [MANUAL PICKER] No image available:', {
        ref: colorPickerImageUrlRef.current,
        original: originalProductImage.current,
        product: product?.image,
      });
      return null;
    }

    if (!imageLayout.width || !imageLayout.height || !imageNaturalSize.width || !imageNaturalSize.height) {
      console.error('🎨 [MANUAL PICKER] Missing layout or natural size:', {
        layout: imageLayout,
        natural: imageNaturalSize,
      });
      return null;
    }

    // Convert touch coordinates to image coordinates (accounts for letterboxing)
    const coords = convertTouchToImageCoords(touchX, touchY);
    if (!coords) {
      console.warn('🎨 [MANUAL PICKER] Touch outside image bounds');
      return null;
    }

    const startTime = Date.now();
    setIsSamplingColor(true);
    colorPickerApiInProgress.current = true;

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://mvp-styli.vercel.app';
      const apiUrl = `${API_BASE}/api/pick-pixel-color`;
      
      // Send display coordinates (ix, iy) and display dimensions (displayW, displayH) as specified
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl, // Use pre-loaded URL (much faster than base64)
          x: coords.imageX, // Actual pixel X in natural image
          y: coords.imageY, // Actual pixel Y in natural image
          imageWidth: imageNaturalSize.width, // Natural image width
          imageHeight: imageNaturalSize.height, // Natural image height
          // Also send display dimensions for verification
          displayWidth: coords.displayWidth,
          displayHeight: coords.displayHeight,
        }),
      });

      const timeTaken = Date.now() - startTime;

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        
        if (result.color) {
          const hex = result.color;
          const { r, g, b } = result.rgb || { r: 0, g: 0, b: 0 };
          
          // Import color name helper (for UI display only)
          const { colorNameFromHex } = require('../lib/colorAttributes');
          const colorName = colorNameFromHex(hex);
          
          console.log('🎨 [MANUAL PICKER] Color picked successfully:', {
            hex: hex,
            rgb: { r, g, b },
            name: colorName,
            imageCoords: { x: coords.imageX, y: coords.imageY },
            displayCoords: { x: touchX, y: touchY },
            imageSize: { width: imageNaturalSize.width, height: imageNaturalSize.height },
            timeTaken: `${timeTaken}ms`,
          });
          
          return { hex, rgb: { r, g, b }, name: colorName };
        }
      } else {
        const errorText = await apiResponse.text();
        console.error('🎨 [MANUAL PICKER] API error:', apiResponse.status, errorText);
      }
    } catch (apiError) {
      console.error('🎨 [MANUAL PICKER] API error:', apiError);
    } finally {
      setIsSamplingColor(false);
      colorPickerApiInProgress.current = false;
    }
    
    return null;
  };

  // Final tap handler - confirms color selection (receives colorResult from pickColorAtCoordinates)
  const handleManualColorPickerTap = async (event) => {
    const colorResult = event.colorResult;
    
    if (!colorResult) {
      console.warn('🎨 [MANUAL PICKER] No color result available');
      return;
    }

    const { colorNameFromHex } = require('../lib/colorAttributes');
    const colorName = colorNameFromHex(colorResult.hex);
    
    setPickedColorHex(colorResult.hex);
    setPickedColorName(colorName);
    setDetectedColor(colorName);
    setDetectedColorHex(colorResult.hex);
    setUserEnteredColor(colorName);
    setColorSource('manual');
    setLivePickedColor({ hex: colorResult.hex, rgb: colorResult.rgb, name: colorName });
    
    // Update product - store hex as source of truth, name for UI
    const updatedProduct = {
      ...product,
      color: colorName, // For UI display
      colorHex: colorResult.hex, // Source of truth for logic
    };
    setProduct(updatedProduct);
    
    console.log('🎨 [MANUAL PICKER] Color confirmed and product updated:', {
      name: colorName,
      hex: colorResult.hex,
      rgb: colorResult.rgb,
      source: 'manual-pick',
    });
    
    // Re-run fit analysis with new color
    setTimeout(() => {
      loadInsights(true);
    }, 100);
  };
  
  // Pre-load image when color picker modal opens
  useEffect(() => {
    if (showColorPicker) {
      // Try multiple sources for the image
      const imageToUse = originalProductImage.current || product?.image;
      if (imageToUse) {
        console.log('🎨 [MANUAL PICKER] Pre-loading image for picker:', imageToUse.substring(0, 100));
        colorPickerImageUrlRef.current = imageToUse;
      } else {
        console.warn('🎨 [MANUAL PICKER] No image available for pre-loading:', {
          originalProductImage: originalProductImage.current,
          productImage: product?.image,
        });
      }
    } else {
      // Cleanup when modal closes
      colorPickerImageUrlRef.current = null;
      setLivePickedColor(null);
      setPickerTouchPosition(null);
      setMagnifierPosition(null);
    }
  }, [showColorPicker, product?.image]);
  
  // Simple RGB to color name (client-side, for manual picker only)
  const rgbToColorNameSimple = (r, g, b) => {
    const colors = [
      { name: 'black', rgb: [0, 0, 0], threshold: 40 },
      { name: 'white', rgb: [255, 255, 255], threshold: 230 },
      { name: 'grey', rgb: [128, 128, 128], threshold: 60 },
      { name: 'red', rgb: [255, 0, 0], threshold: 120 },
      { name: 'blue', rgb: [0, 0, 255], threshold: 120 },
      { name: 'green', rgb: [0, 255, 0], threshold: 120 },
      { name: 'yellow', rgb: [255, 255, 0], threshold: 200 },
      { name: 'orange', rgb: [255, 165, 0], threshold: 120 },
      { name: 'pink', rgb: [255, 192, 203], threshold: 150 },
      { name: 'purple', rgb: [128, 0, 128], threshold: 100 },
      { name: 'brown', rgb: [165, 42, 42], threshold: 70 },
      { name: 'navy', rgb: [0, 0, 128], threshold: 60 },
      { name: 'burgundy', rgb: [128, 0, 32], threshold: 60 },
      { name: 'coral', rgb: [255, 127, 80], threshold: 120 },
      { name: 'teal', rgb: [0, 128, 128], threshold: 80 },
      { name: 'emerald', rgb: [80, 200, 120], threshold: 90 },
      { name: 'lavender', rgb: [230, 230, 250], threshold: 180 },
    ];

    let minDistance = Infinity;
    let closestColor = 'unknown';

    for (const color of colors) {
      const distance = Math.sqrt(
        Math.pow(r - color.rgb[0], 2) +
        Math.pow(g - color.rgb[1], 2) +
        Math.pow(b - color.rgb[2], 2)
      );
      
      if (distance < minDistance && distance < color.threshold) {
        minDistance = distance;
        closestColor = color.name;
      }
    }

    return closestColor;
  };
  
  // Confirm manual color pick
  const confirmManualColorPick = () => {
    if (livePickedColor) {
      console.log('🎨 [MANUAL PICKER] Confirming color pick:', livePickedColor);
      setShowColorPicker(false);
      setPickerTouchPosition(null);
      setMagnifierPosition(null);
      
      // Re-run fit analysis with manually picked color
      console.log('🎨 [MANUAL PICKER] Re-running fit analysis with manually selected color:', livePickedColor.name);
      setTimeout(() => {
        loadInsights(true);
      }, 300);
      
      Alert.alert(
        'Color Picked',
        `Selected: ${livePickedColor.name}\n\nFit analysis will update with this color.`,
        [{ text: 'OK' }]
      );
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
  const requestInProgress = useRef(false); // Prevent multiple simultaneous requests
  
  // New state for missing data inputs
  const [showGarmentInputModal, setShowGarmentInputModal] = useState(false);
  const [showColorInputModal, setShowColorInputModal] = useState(false);
  const [showMaterialInputModal, setShowMaterialInputModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [detectedColor, setDetectedColor] = useState(null);
  const [detectedColorHex, setDetectedColorHex] = useState(null); // Store hex for color swatch
  const [userEnteredColor, setUserEnteredColor] = useState(null);
  const [userEnteredMaterial, setUserEnteredMaterial] = useState(null);
  const [parsedSizeChart, setParsedSizeChart] = useState(null);
  const [isDetectingColor, setIsDetectingColor] = useState(false);
  const [isParsingSizeChart, setIsParsingSizeChart] = useState(false);
  const [ocrParsingStatus, setOcrParsingStatus] = useState(null);
  const [manualSizeChartInput, setManualSizeChartInput] = useState({});
  const [showParsedDataConfirmation, setShowParsedDataConfirmation] = useState(false);
  const [pendingParsedData, setPendingParsedData] = useState(null);
  
  // Color source tracking: 'product' | 'auto-detected' | 'manual' | null
  const [colorSource, setColorSource] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickedColorHex, setPickedColorHex] = useState(null);
  const [pickedColorName, setPickedColorName] = useState(null);
  
  // Store original product image (not try-on result) for color detection
  const originalProductImage = useRef(null);
  
  // Initialize original product image on mount
  useEffect(() => {
    if (product?.image) {
      // Always use the original product image, never a try-on result
      originalProductImage.current = product.image;
      console.log('🎨 [COLOR] Original product image stored:', product.image.substring(0, 100));
    }
  }, [product?.id]); // Only update when product ID changes

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
      
      // Check if color is already in product name/metadata
      const productColorFromName = inferColorFromName(product?.name || '');
      if (productColorFromName && !product?.color) {
        console.log('🎨 [COLOR] Color detected from product name:', productColorFromName);
        setColorSource('product');
        setDetectedColor(productColorFromName);
        setUserEnteredColor(productColorFromName);
      } else if (product?.color && !detectedColor && !userEnteredColor) {
        // Product already has color set
        console.log('🎨 [COLOR] Color from product metadata:', product.color);
        setColorSource('product');
        setDetectedColor(product.color);
        setUserEnteredColor(product.color);
      }
      
      // Auto-detect color immediately when Fit Check opens (only if no color from product)
      // Note: autoDetectColor will reload insights after detection, so we don't need to call loadInsights here
      if (originalProductImage.current && !productColorFromName && !product?.color) {
        console.log('🎨 [COLOR] Auto-detecting color from product image...');
        // Start color detection (non-blocking) - it will reload insights after detection
        autoDetectColor().then(() => {
          // Only load insights if color detection didn't trigger a reload
          // (autoDetectColor already calls loadInsights after detection)
        });
      } else {
        // Load insights immediately if we already have color or no image
        loadInsights();
      }
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
      console.log('📏 [FIT CHECK] Using fitLogic for size recommendations');
      console.log('📏 [FIT CHECK] Input to fitLogic - userProfileForFitLogic:', JSON.stringify(userProfileForFitLogic, null, 2));
      console.log('📏 [FIT CHECK] Input to fitLogic - productForFitLogic:', JSON.stringify(productForFitLogic, null, 2));
      console.log('📏 [FIT CHECK] Size chart data:', {
        hasSizeChart: !!productForFitLogic.sizeChart && productForFitLogic.sizeChart.length > 0,
        sizeCount: productForFitLogic.sizeChart?.length || 0,
        sizes: productForFitLogic.sizeChart?.map(s => s.size) || [],
        firstSizeMeasurements: productForFitLogic.sizeChart?.[0]?.measurements || null,
      });
      
      const sizeRecommendation = recommendSizeAndFit(userProfileForFitLogic, productForFitLogic, {});
      
      console.log('📏 [FIT CHECK] Size recommendation result:', JSON.stringify(sizeRecommendation, null, 2));
      console.log('📏 [FIT CHECK] Missing measurements:', sizeRecommendation.missing);
      console.log('📏 [FIT CHECK] Recommended size:', sizeRecommendation.recommendedSize);
      console.log('📏 [FIT CHECK] Risk level:', sizeRecommendation.risk);
      console.log('📏 [FIT CHECK] Confidence:', sizeRecommendation.confidence);
      
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
      // Also check detectedColor and userEnteredColor (from auto-detection or manual input)
      const productColorRaw = product?.color || product?.color_raw || product?.primaryColor || detectedColor || userEnteredColor || null;
      const productColor = (productColorRaw && String(productColorRaw).trim() !== '' && String(productColorRaw).trim() !== 'null' && String(productColorRaw).trim() !== 'undefined')
        ? String(productColorRaw).trim()
        : (inferColor(product?.name) || null);
      
      // If we have a detected/entered color but product doesn't have it, update product
      if ((detectedColor || userEnteredColor) && !product?.color && productColor) {
        console.log('🎨 [FIT CHECK] Updating product color from detected/entered:', productColor);
        const updatedProduct = {
          ...product,
          color: productColor,
        };
        setProduct(updatedProduct);
      }
      
      // LOG: Color detection for debugging
      console.log('🎨 [FIT CHECK] Product color check:', {
        productColor: productColor,
        productColorRaw: product?.color,
        productColor_raw: product?.color_raw,
        productPrimaryColor: product?.primaryColor,
        productName: product?.name,
        inferred: inferColor(product?.name),
        detectedColor: detectedColor,
        userEnteredColor: userEnteredColor,
        hasColor: !!productColor && productColor !== 'unknown',
        productObjectColor: product?.color,
      });
      
      // Get colorHex as source of truth (fallback to primaryColor for UI display)
      const productColorHex = product?.colorHex || detectedColorHex || null;
      
      const productForSuitability = {
        primaryColor: productColor, // For UI display/fallback
        colorHex: productColorHex, // Source of truth for color logic
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
      
      // Build HOW TO WEAR data (rule-based)
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
      
      // All insights are rule-based (fitLogic, styleSuitability, fabricComfort)
      
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
  
  // Gemini removed - all insights are rule-based (fitLogic, styleSuitability, fabricComfort)

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

              {/* Section 2: COLOR CARD */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>🎨</Text>
                  <Text style={styles.cardTitle}>COLOR</Text>
                </View>

                {/* Color Card - Always shows color information */}
                <View style={styles.colorCardContainer}>
                  {/* Color Source Label */}
                  <View style={styles.colorSourceRow}>
                    <Text style={styles.colorSourceLabel}>
                      {colorSource === 'product' && 'Color detected from product'}
                      {colorSource === 'auto-detected' && 'Color auto-detected'}
                      {colorSource === 'manual' && 'Color selected manually'}
                      {!colorSource && (product?.color || detectedColor || userEnteredColor) && 'Color detected from product'}
                      {!colorSource && !product?.color && !detectedColor && !userEnteredColor && 'No color detected'}
                    </Text>
                  </View>

                  {/* Color Display: Name + Swatch */}
                  {(product?.color || detectedColor || userEnteredColor) ? (
                    <View style={styles.colorDisplayRow}>
                      {/* Circular Color Swatch */}
                      <View style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: detectedColorHex || pickedColorHex || '#808080',
                        }
                      ]} />
                      
                      {/* Color Name */}
                      <Text style={styles.colorNameText}>
                        {product?.color || detectedColor || userEnteredColor}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.colorDisplayRow}>
                      <View style={[styles.colorSwatch, { backgroundColor: '#808080' }]} />
                      <Text style={[styles.colorNameText, { color: '#666' }]}>No color detected</Text>
                    </View>
                  )}

                  {/* Pick Color Button */}
                  <Pressable
                    style={styles.pickColorButton}
                    onPress={() => {
                      if (originalProductImage.current || product?.image) {
                        setShowColorPicker(true);
                      } else {
                        setShowColorInputModal(true);
                      }
                    }}
                  >
                    <Text style={styles.pickColorButtonText}>🎯 Pick color from product</Text>
                  </Pressable>
                </View>

                {/* Color Suitability Analysis */}
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
                ) : colorSuitability?.verdict ? (
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
                ) : null}
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
                        setOcrParsingStatus('Preparing image...');
                        const imageUri = result.assets[0].uri;
                        
                        console.log('📊 [FRONTEND] Image selected:', imageUri);
                        
                        // Convert image to base64
                        try {
                          setOcrParsingStatus('Converting image to base64...');
                          const response = await fetch(imageUri);
                          const blob = await response.blob();
                          console.log('📊 [FRONTEND] Image blob size:', blob.size, 'bytes');
                          console.log('📊 [FRONTEND] Image blob type:', blob.type);
                          
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64 = reader.result;
                            console.log('📊 [FRONTEND] Base64 length:', base64?.length || 0);
                            
                            // Call fit-check-utils API for parsing size chart
                            try {
                              const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://mvpstyli-fresh.vercel.app';
                              console.log('📊 [FRONTEND] Uploading size chart image...');
                              console.log('📊 [FRONTEND] Image size:', blob.size, 'bytes');
                              console.log('📊 [FRONTEND] API endpoint:', `${API_BASE}/api/ocr-sizechart`);
                              
                              setOcrParsingStatus('Sending to OCR service...');
                              
                              const parseResponse = await fetch(`${API_BASE}/api/ocr-sizechart`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageBase64: base64 }),
                              });
                              
                              console.log('📊 [FRONTEND] OCR response status:', parseResponse.status);
                              
                              if (!parseResponse.ok) {
                                const errorText = await parseResponse.text();
                                console.error('📊 [FRONTEND] OCR API error:', parseResponse.status, errorText);
                                setOcrParsingStatus(`Error: ${parseResponse.status}`);
                                throw new Error(`OCR API error: ${parseResponse.status}`);
                              }
                              
                              setOcrParsingStatus('Processing OCR results...');
                              
                              const parseData = await parseResponse.json();
                              console.log('📊 [FRONTEND] Size chart parse result:', JSON.stringify(parseData, null, 2));
                              console.log('📊 [FRONTEND] Parse success:', parseData.success);
                              console.log('📊 [FRONTEND] Parsed data:', parseData.data);
                              console.log('📊 [FRONTEND] Raw text length:', parseData.rawText?.length || 0);
                              
                              if (parseData.success && parseData.data) {
                                setOcrParsingStatus('✓ Successfully parsed size chart!');
                                // Store parsed data for confirmation
                                setPendingParsedData(parseData.data);
                                setShowParsedDataConfirmation(true);
                                setIsParsingSizeChart(false);
                              } else {
                                setOcrParsingStatus('Could not auto-parse. Please enter manually.');
                                // Show manual input with pre-filled structure
                                setManualSizeChartInput(parseData.structure || {
                                  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
                                  measurements: ['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder', 'inseam', 'rise'],
                                });
                                // Don't close modal - show manual input form
                              }
                            } catch (error) {
                              console.error('Error parsing size chart:', error);
                              setOcrParsingStatus(`Error: ${error.message}`);
                              Alert.alert('Error', 'Failed to parse size chart. Please try manual input.');
                            } finally {
                              setIsParsingSizeChart(false);
                            }
                          };
                          reader.readAsDataURL(blob);
                        } catch (error) {
                          console.error('Error converting image:', error);
                          setOcrParsingStatus(`Error: ${error.message}`);
                          Alert.alert('Error', 'Failed to process image');
                          setIsParsingSizeChart(false);
                        }
                      }
                    } catch (error) {
                      console.error('Error picking image:', error);
                      Alert.alert('Error', 'Failed to pick image');
                      setIsParsingSizeChart(false);
                    }
                  }}
                >
                  {isParsingSizeChart ? (
                    <>
                      <ActivityIndicator color="#6366f1" style={{ marginBottom: 8 }} />
                      <Text style={styles.uploadButtonText}>Processing...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.uploadButtonText}>📷 Upload Screenshot</Text>
                    </>
                  )}
                </Pressable>
                
                {ocrParsingStatus && (
                  <Text style={[styles.detectedColorText, { 
                    marginTop: 12, 
                    color: ocrParsingStatus.startsWith('✓') ? '#10b981' : ocrParsingStatus.startsWith('Error') ? '#ef4444' : '#6366f1',
                    fontSize: 13,
                  }]}>
                    {ocrParsingStatus}
                  </Text>
                )}
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

              {/* Parsed Data Confirmation Table */}
              {showParsedDataConfirmation && pendingParsedData && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Review Parsed Size Chart</Text>
                  <Text style={styles.modalSectionSubtitle}>Please confirm the measurements are correct</Text>
                  
                  <ScrollView 
                    style={{ maxHeight: 400, marginTop: 16 }}
                    horizontal={true}
                    showsHorizontalScrollIndicator={true}
                  >
                    <View style={styles.parsedTableContainer}>
                      {/* Header Row */}
                      <View style={styles.parsedTableRow}>
                        <View style={[styles.parsedTableCell, styles.parsedTableHeader]}>
                          <Text style={styles.parsedTableHeaderText}>Size</Text>
                        </View>
                        {pendingParsedData[0]?.measurements && Object.keys(pendingParsedData[0].measurements).map((measure) => (
                          <View key={measure} style={[styles.parsedTableCell, styles.parsedTableHeader]}>
                            <Text style={styles.parsedTableHeaderText}>{measure}</Text>
                            <Text style={styles.parsedTableUnitText}>(inches)</Text>
                          </View>
                        ))}
                      </View>
                      
                      {/* Data Rows */}
                      {pendingParsedData.map((item, idx) => (
                        <View key={`${item.size}-${idx}`} style={styles.parsedTableRow}>
                          <View style={[styles.parsedTableCell, styles.parsedTableSizeCell]}>
                            <Text style={styles.parsedTableSizeText}>{item.size}</Text>
                          </View>
                          {item.measurements && Object.entries(item.measurements).map(([measure, value]) => (
                            <View key={measure} style={styles.parsedTableCell}>
                              <Text style={styles.parsedTableValueText}>
                                {typeof value === 'number' ? value.toFixed(1) : value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <Pressable
                      style={[styles.saveButton, { flex: 1, backgroundColor: '#ef4444' }]}
                      onPress={() => {
                        // Preserve parsed values when entering edit mode
                        const sizes = pendingParsedData.map(item => item.size);
                        const measurements = pendingParsedData[0]?.measurements 
                          ? Object.keys(pendingParsedData[0].measurements) 
                          : ['chest', 'waist', 'hips'];
                        
                        // Pre-populate manual input with parsed values
                        const prePopulatedInput = {
                          sizes: sizes,
                          measurements: measurements,
                        };
                        
                        // Fill in all the parsed values
                        pendingParsedData.forEach((item) => {
                          if (item.measurements) {
                            Object.entries(item.measurements).forEach(([measure, value]) => {
                              prePopulatedInput[`${item.size}_${measure}`] = String(value);
                            });
                          }
                        });
                        
                        setManualSizeChartInput(prePopulatedInput);
                        setShowParsedDataConfirmation(false);
                        // Keep pendingParsedData in case user wants to go back
                      }}
                    >
                      <Text style={styles.saveButtonText}>✏️ Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.saveButton, { flex: 1 }]}
                      onPress={() => {
                        // User confirmed - use the parsed data
                        setParsedSizeChart(pendingParsedData);
                        const updatedProduct = {
                          ...product,
                          sizeChart: pendingParsedData,
                        };
                        setProduct(updatedProduct);
                        setShowParsedDataConfirmation(false);
                        setPendingParsedData(null);
                        setOcrParsingStatus(null);
                        setShowGarmentInputModal(false);
                        setTimeout(() => {
                          loadInsights(true);
                        }, 100);
                      }}
                    >
                      <Text style={styles.saveButtonText}>✓ Confirm & Continue</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Manual Input Form - Fully Editable */}
              {Object.keys(manualSizeChartInput).length > 0 && manualSizeChartInput.sizes && !showParsedDataConfirmation && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Edit Size Chart</Text>
                  <Text style={[styles.modalSectionSubtitle, { marginBottom: 16 }]}>
                    Add sizes, add measurements, or modify values as needed
                  </Text>
                  
                  {/* Add Size Button */}
                  <Pressable
                    style={[styles.uploadButton, { marginBottom: 16 }]}
                    onPress={() => {
                      // Simple approach: add a default size that user can edit
                      const defaultSize = `Size${manualSizeChartInput.sizes.length + 1}`;
                      setManualSizeChartInput({
                        ...manualSizeChartInput,
                        sizes: [...manualSizeChartInput.sizes, defaultSize],
                      });
                    }}
                  >
                    <Text style={styles.uploadButtonText}>+ Add Size</Text>
                  </Pressable>
                  
                  {/* Add Measurement Button */}
                  <Pressable
                    style={[styles.uploadButton, { marginBottom: 16 }]}
                    onPress={() => {
                      // Simple approach: add a default measurement that user can edit
                      const defaultMeasure = `measure${(manualSizeChartInput.measurements?.length || 0) + 1}`;
                      setManualSizeChartInput({
                        ...manualSizeChartInput,
                        measurements: [...(manualSizeChartInput.measurements || []), defaultMeasure],
                      });
                    }}
                  >
                    <Text style={styles.uploadButtonText}>+ Add Measurement</Text>
                  </Pressable>
                  
                  <ScrollView style={{ maxHeight: 400 }}>
                    {manualSizeChartInput.sizes.map((size, sizeIdx) => (
                      <View key={`${size}-${sizeIdx}`} style={styles.manualSizeRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <TextInput
                            style={[styles.manualSizeLabel, { flex: 1, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 4, color: '#fff' }]}
                            value={size}
                            onChangeText={(text) => {
                              const newSizes = [...manualSizeChartInput.sizes];
                              newSizes[sizeIdx] = text;
                              // Update all keys that reference this size
                              const updated = { ...manualSizeChartInput, sizes: newSizes };
                              manualSizeChartInput.measurements?.forEach((measure) => {
                                const oldKey = `${manualSizeChartInput.sizes[sizeIdx]}_${measure}`;
                                const newKey = `${text}_${measure}`;
                                if (updated[oldKey] !== undefined) {
                                  updated[newKey] = updated[oldKey];
                                  delete updated[oldKey];
                                }
                              });
                              setManualSizeChartInput(updated);
                            }}
                            placeholder="Size"
                            placeholderTextColor="#666"
                          />
                          <Pressable
                            onPress={() => {
                              const newSizes = manualSizeChartInput.sizes.filter((_, idx) => idx !== sizeIdx);
                              const updated = { ...manualSizeChartInput, sizes: newSizes };
                              // Remove all keys for this size
                              manualSizeChartInput.measurements?.forEach((measure) => {
                                delete updated[`${size}_${measure}`];
                              });
                              setManualSizeChartInput(updated);
                            }}
                            style={{ padding: 4 }}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 18 }}>✕</Text>
                          </Pressable>
                        </View>
                        <View style={styles.manualMeasurementsRow}>
                          {manualSizeChartInput.measurements?.map((measure, measureIdx) => (
                            <View key={`${measure}-${measureIdx}`} style={styles.manualMeasurementInput}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <TextInput
                                  style={[styles.manualMeasurementLabel, { flex: 1, fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 4, color: '#fff' }]}
                                  value={measure}
                                  onChangeText={(text) => {
                                    const newMeasures = [...manualSizeChartInput.measurements];
                                    newMeasures[measureIdx] = text.toLowerCase();
                                    const updated = { ...manualSizeChartInput, measurements: newMeasures };
                                    // Update all keys that reference this measurement
                                    manualSizeChartInput.sizes.forEach((s) => {
                                      const oldKey = `${s}_${measure}`;
                                      const newKey = `${s}_${text.toLowerCase()}`;
                                      if (updated[oldKey] !== undefined) {
                                        updated[newKey] = updated[oldKey];
                                        delete updated[oldKey];
                                      }
                                    });
                                    setManualSizeChartInput(updated);
                                  }}
                                  placeholder="measurement"
                                  placeholderTextColor="#666"
                                />
                                <Pressable
                                  onPress={() => {
                                    const newMeasures = manualSizeChartInput.measurements.filter((_, idx) => idx !== measureIdx);
                                    const updated = { ...manualSizeChartInput, measurements: newMeasures };
                                    // Remove all keys for this measurement
                                    manualSizeChartInput.sizes.forEach((s) => {
                                      delete updated[`${s}_${measure}`];
                                    });
                                    setManualSizeChartInput(updated);
                                  }}
                                  style={{ padding: 2, marginLeft: 4 }}
                                >
                                  <Text style={{ color: '#ef4444', fontSize: 12 }}>✕</Text>
                                </Pressable>
                              </View>
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
                        manualSizeChartInput.measurements?.forEach((measure) => {
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
                        setPendingParsedData(null);
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

      {/* Manual Color Picker Modal - COMPLETELY SEPARATE from auto-detect */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowColorPicker(false);
          setPickerTouchPosition(null);
          setMagnifierPosition(null);
          setLivePickedColor(null);
          colorPickerImageUrlRef.current = null;
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Color from Product</Text>
              <Pressable onPress={() => {
                setShowColorPicker(false);
                setPickerTouchPosition(null);
                setMagnifierPosition(null);
                setLivePickedColor(null);
              }}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </Pressable>
            </View>
            
            <View style={{ flex: 1, position: 'relative' }}>
              <Text style={[styles.modalSectionSubtitle, { 
                marginBottom: 16, 
                textAlign: 'center', 
                paddingHorizontal: 20,
                color: '#9ca3af',
              }]}>
                Tap anywhere on the image to pick the exact pixel color
              </Text>
              
              {originalProductImage.current || product?.image ? (
                <View style={{ flex: 1, position: 'relative' }}>
                  {/* PanResponder for live preview as user moves finger */}
                  {(() => {
                    // Create PanResponder using useMemo pattern (created once per render cycle)
                    const colorPickerPanResponder = PanResponder.create({
                      onStartShouldSetPanResponder: () => true,
                      onMoveShouldSetPanResponder: () => true,
                      onPanResponderGrant: (evt) => {
                        // User started touching - show live preview
                        const { locationX, locationY } = evt.nativeEvent;
                        handleManualColorPickerMove(locationX, locationY);
                      },
                      onPanResponderMove: (evt) => {
                        // User is moving finger - update live preview
                        const { locationX, locationY } = evt.nativeEvent;
                        handleManualColorPickerMove(locationX, locationY);
                      },
                      onPanResponderRelease: async (evt) => {
                        // User lifted finger - confirm color selection (ONLY API CALL HERE)
                        const { locationX, locationY } = evt.nativeEvent;
                        const colorResult = await pickColorAtCoordinates(locationX, locationY);
                        if (colorResult) {
                          handleManualColorPickerTap({ nativeEvent: { locationX, locationY }, colorResult });
                        }
                      },
                    });
                    
                    return (
                      <View style={{ flex: 1, width: '100%' }} {...colorPickerPanResponder.panHandlers}>
                        <Image
                          source={{ uri: originalProductImage.current || product?.image }}
                          style={{ 
                            width: '100%', 
                            flex: 1,
                            minHeight: 500,
                            resizeMode: 'contain',
                          }}
                          onLayout={(event) => {
                            const { width, height, x, y } = event.nativeEvent.layout;
                            setImageLayout({ width, height, x, y });
                          }}
                          onLoad={(event) => {
                            const { width, height } = event.nativeEvent.source;
                            setImageNaturalSize({ width, height });
                          }}
                        />
                        
                        {/* Crosshair at tap position - crisp, professional design */}
                        {pickerTouchPosition && (
                          <View
                            style={[
                              styles.crosshair,
                              {
                                left: pickerTouchPosition.x - 12,
                                top: pickerTouchPosition.y - 12,
                              }
                            ]}
                            pointerEvents="none"
                          >
                            {/* Outer ring */}
                            <View style={styles.crosshairRing} />
                            {/* Center dot */}
                            <View style={styles.crosshairDot} />
                            {/* Horizontal line */}
                            <View style={[styles.crosshairLine, { width: 24, height: 1, top: 11 }]} />
                            {/* Vertical line */}
                            <View style={[styles.crosshairLine, { width: 1, height: 24, left: 11 }]} />
                          </View>
                        )}
                        
                        {/* Magnifier/Loupe above finger - shows zoomed view */}
                        {magnifierPosition && livePickedColor && (
                          <View
                            style={[
                              styles.magnifier,
                              {
                                left: Math.max(10, Math.min(magnifierPosition.x - 60, width - 130)),
                                top: Math.max(10, magnifierPosition.y - 140),
                              }
                            ]}
                          >
                            <View style={styles.magnifierContent}>
                              {/* Zoomed color swatch (larger for better visibility) */}
                              <View style={[styles.magnifierColorSwatch, { backgroundColor: livePickedColor.hex }]} />
                              <Text style={styles.magnifierText}>
                                {livePickedColor.hex.toUpperCase()}
                              </Text>
                              <Text style={styles.magnifierTextSmall}>
                                RGB: {livePickedColor.rgb.r}, {livePickedColor.rgb.g}, {livePickedColor.rgb.b}
                              </Text>
                              <Text style={styles.magnifierTextSmall}>
                                {livePickedColor.name}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                  <Text style={styles.modalSectionSubtitle}>No product image available</Text>
                </View>
              )}
              
              {/* Live Color Preview */}
              {livePickedColor && (
                <View style={styles.colorPreviewContainer}>
                  <View style={[styles.colorPreviewSwatch, { backgroundColor: livePickedColor.hex }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.colorPreviewName}>{livePickedColor.name}</Text>
                    <Text style={styles.colorPreviewHex}>{livePickedColor.hex.toUpperCase()}</Text>
                  </View>
                  <Pressable
                    style={styles.confirmColorButton}
                    onPress={confirmManualColorPick}
                  >
                    <Text style={styles.confirmColorButtonText}>✓ Use This Color</Text>
                  </Pressable>
                </View>
              )}
              
              {!livePickedColor && (
                <View style={styles.instructions}>
                  <Text style={styles.instructionText}>
                    {isDetectingColor ? 'Picking color...' : 'Tap the image to pick a color'}
                  </Text>
                </View>
              )}
            </View>
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
              {/* Auto-detect button */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Detect Color from Image</Text>
                <Pressable
                  style={[styles.saveButton, isDetectingColor && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (isDetectingColor) {
                      console.log('🎨 [COLOR MODAL] Color detection already in progress, ignoring click');
                      return;
                    }
                    
                    console.log('🎨 [COLOR MODAL] Detect Color button clicked');
                    const imageToUse = originalProductImage.current || product?.image;
                    console.log('🎨 [COLOR MODAL] Using ORIGINAL product image:', imageToUse?.substring(0, 100));
                    
                    if (!imageToUse) {
                      Alert.alert('Error', 'No product image available for color detection');
                      return;
                    }
                    
                    // Clear cache to force fresh detection
                    console.log('🎨 [COLOR MODAL] Clearing color cache...');
                    clearColorCache();
                    
                    console.log('🎨 [COLOR MODAL] Starting color detection from original image...');
                    setColorSource('auto-detected');
                    await autoDetectColor();
                    console.log('🎨 [COLOR MODAL] Color detection completed');
                  }}
                  disabled={isDetectingColor}
                >
                  {isDetectingColor ? (
                    <>
                      <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.saveButtonText}>Detecting Color...</Text>
                    </>
                  ) : (
                    <Text style={styles.saveButtonText}>🔍 Auto-Detect Color</Text>
                  )}
                </Pressable>
                
                {isDetectingColor && (
                  <Text style={[styles.detectedColorText, { marginTop: 12, color: '#6366f1' }]}>
                    Analyzing image...
                  </Text>
                )}
                
                {detectedColor && !isDetectingColor && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
                    <Text style={[styles.detectedColorText, { color: '#10b981', fontWeight: 'bold' }]}>
                      ✓ Detected: {detectedColor}
                    </Text>
                    {product?.color && (
                      <Text style={[styles.detectedColorText, { marginTop: 4, fontSize: 12, color: '#666' }]}>
                        Saved to product
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Manual input */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Or Enter Manually</Text>
                <TextInput
                  style={styles.colorInput}
                  placeholder="e.g., Navy, Black, Plum Purple"
                  placeholderTextColor="#666"
                  value={userEnteredColor || detectedColor || product?.color || ''}
                  onChangeText={(text) => {
                    setUserEnteredColor(text);
                    // Clear detected color if user manually enters
                    if (text && text !== detectedColor) {
                      setDetectedColor(null);
                    }
                  }}
                />
                <Pressable
                  style={[styles.saveButton, { marginTop: 12 }]}
                  onPress={() => {
                    const colorToSave = userEnteredColor || detectedColor || product?.color;
                    if (colorToSave && colorToSave.trim() !== '') {
                      console.log('🎨 [COLOR MODAL] Saving color:', colorToSave);
                      const updatedProduct = {
                        ...product,
                        color: colorToSave.trim(),
                      };
                      setProduct(updatedProduct);
                      setUserEnteredColor(colorToSave.trim());
                      // Mark as manual if user entered it manually
                      if (userEnteredColor && userEnteredColor !== detectedColor) {
                        setColorSource('manual');
                      }
                      setShowColorInputModal(false);
                      setTimeout(() => {
                        console.log('🎨 [COLOR MODAL] Reloading insights with saved color');
                        loadInsights(true);
                      }, 100);
                    } else {
                      Alert.alert('Error', 'Please enter a color or detect one from the image');
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
                
                {/* Show material analysis if material entered */}
                {userEnteredMaterial && (() => {
                  const materialLower = (userEnteredMaterial || '').toLowerCase();
                  const detectedStretch = hasStretch(userEnteredMaterial);
                  const stretchLevel = getStretchLevel(userEnteredMaterial);
                  
                  // Check if we have high confidence in stretch detection
                  const hasStretchKeywords = materialLower.includes('stretch') || 
                                            materialLower.includes('elastic') || 
                                            materialLower.includes('spandex') || 
                                            materialLower.includes('elastane') ||
                                            materialLower.includes('lycra');
                  
                  const hasKnownMaterial = materialLower.includes('cotton') || 
                                         materialLower.includes('polyester') ||
                                         materialLower.includes('silk') ||
                                         materialLower.includes('wool') ||
                                         materialLower.includes('linen') ||
                                         materialLower.includes('denim');
                  
                  const confidence = (hasStretchKeywords || hasKnownMaterial) ? 'high' : 'low';
                  
                  return (
                    <View style={styles.materialInfo}>
                      <Text style={styles.materialInfoLabel}>Analysis:</Text>
                      <Text style={styles.materialInfoValue}>
                        Stretch: {detectedStretch ? 'Yes' : 'No'} ({stretchLevel})
                      </Text>
                      {confidence === 'low' && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8 }}>
                          <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                            ⚠️ Low Confidence
                          </Text>
                          <Text style={{ color: '#92400E', fontSize: 11 }}>
                            We couldn't determine elasticity with high confidence. Is this material stretchy?
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <Pressable
                              style={[styles.materialToggle, detectedStretch && styles.materialToggleActive]}
                              onPress={() => {
                                // User confirms stretch
                                const updated = {
                                  ...product,
                                  material: userEnteredMaterial,
                                  fabric: userEnteredMaterial,
                                  fabricStretch: 'medium',
                                };
                                setProduct(updated);
                                setShowMaterialInputModal(false);
                                setTimeout(() => loadInsights(true), 100);
                              }}
                            >
                              <Text style={[styles.materialToggleText, detectedStretch && styles.materialToggleTextActive]}>
                                Yes, Stretchy
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[styles.materialToggle, !detectedStretch && styles.materialToggleActive]}
                              onPress={() => {
                                // User confirms no stretch
                                const updated = {
                                  ...product,
                                  material: userEnteredMaterial,
                                  fabric: userEnteredMaterial,
                                  fabricStretch: 'none',
                                };
                                setProduct(updated);
                                setShowMaterialInputModal(false);
                                setTimeout(() => loadInsights(true), 100);
                              }}
                            >
                              <Text style={[styles.materialToggleText, !detectedStretch && styles.materialToggleTextActive]}>
                                No Stretch
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}
                
                <Pressable
                  style={styles.saveButton}
                  onPress={() => {
                    if (userEnteredMaterial) {
                      const updatedProduct = {
                        ...product,
                        material: userEnteredMaterial,
                        fabric: userEnteredMaterial,
                        fabricStretch: hasStretch(userEnteredMaterial) ? getStretchLevel(userEnteredMaterial) : 'none',
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
    maxHeight: height * 0.9,
    height: height * 0.9,
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
  // Color Card styles
  colorCardContainer: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 16,
  },
  colorSourceRow: {
    marginBottom: 12,
  },
  colorSourceLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
  },
  colorNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  pickColorButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  pickColorButtonText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
  },
  // Manual Color Picker styles
  colorPickerCursor: {
    position: 'absolute',
    width: 30,
    height: 30,
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  colorPickerCursorIcon: {
    fontSize: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  crosshair: {
    position: 'absolute',
    width: 24,
    height: 24,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  crosshairRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 10,
  },
  crosshairDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    left: 10,
    top: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 10,
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 10,
  },
  magnifier: {
    position: 'absolute',
    width: 120,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 15,
    overflow: 'hidden',
  },
  magnifierContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  magnifierColorSwatch: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  magnifierText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  magnifierTextSmall: {
    color: '#9ca3af',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },
  colorPreviewContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 1002,
  },
  colorPreviewSwatch: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
  },
  colorPreviewName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  colorPreviewHex: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  confirmColorButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmColorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
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
  materialToggle: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  materialToggleActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  materialToggleText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  materialToggleTextActive: {
    color: '#fff',
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
  // Parsed data confirmation table styles
  parsedTableContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  parsedTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  parsedTableCell: {
    padding: 12,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  parsedTableHeader: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  parsedTableHeaderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  parsedTableUnitText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
  },
  parsedTableSizeCell: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  parsedTableSizeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  parsedTableValueText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AskAISheet;
