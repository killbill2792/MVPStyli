import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from '../lib/SimpleGradient';
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
import { SafeImage, OptimizedImage } from '../lib/OptimizedImage';

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
      return;
    }
    
    // Don't re-detect if already detecting
    if (isDetectingColor) {
      return;
    }
    
    setIsDetectingColor(true);
    try {
      // Use client-side color detection (no API call)
      const colorResult = await detectDominantColor(imageToUse);
      
      if (colorResult && colorResult.color && colorResult.confidence > 0) {
        const hex = colorResult.color;
        
        // Use robust offline color naming system (Lab-based ΔE matching)
        const { getNearestColorName } = require('../lib/colorNaming');
        const nearestColor = getNearestColorName(hex);
        const name = nearestColor.name;
        
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
        
        // Reload insights with new color after a short delay
        // Pass updatedProduct to ensure loadInsights uses the new color
        setTimeout(() => {
          loadInsights(true, updatedProduct);
        }, 500);
      }
    } catch (error) {
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
  
  // Manual Color Picker State & Refs
  const [pickerTouchPosition, setPickerTouchPosition] = useState(null);
  const [livePickedColor, setLivePickedColor] = useState(null);
  const [serverSampledCoords, setServerSampledCoords] = useState(null); // For debug overlay
  const [isSamplingColor, setIsSamplingColor] = useState(false);
  
  const touchRef = useRef({ x: 0, y: 0 });
  const showColorPickerRef = useRef(showColorPicker);
  const colorPickerImageUrlRef = useRef(null);
  const sampleAtCurrentTouchRef = useRef(null);
  const colorPickerApiInProgress = useRef(false);
  const imageLayoutRef = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const imageNaturalSizeRef = useRef({ width: 0, height: 0 });
  
  // Convert touch coordinates to image pixel coordinates (accounts for resizeMode: contain letterboxing)
  const convertTouchToImageCoords = (touchX, touchY) => {
    const layout = imageLayoutRef.current;
    const natural = imageNaturalSizeRef.current;

    if (!layout.width || !layout.height || !natural.width || !natural.height) {
      return null;
    }
    
    const containerW = layout.width;
    const containerH = layout.height;
    const naturalW = natural.width;
    const naturalH = natural.height;
    
    // Calculate scale: min(containerW / naturalW, containerH / naturalH)
    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    
    // Calculate displayed image dimensions
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    
    // Calculate offsets (centering/letterboxing)
    const offsetX = (containerW - displayW) / 2;
    const offsetY = (containerH - displayH) / 2;
    
    // Convert touch coordinates to coordinates relative to displayed image
    const ix = touchX - offsetX;
    const iy = touchY - offsetY;
    
    // Check if touch is outside displayed image rect
    const TOLERANCE = 20;
    const isOutsideBounds = ix < -TOLERANCE || ix > displayW + TOLERANCE || iy < -TOLERANCE || iy > displayH + TOLERANCE;
    
    if (isOutsideBounds) {
      return null;
    }
    
    // Clamp to displayed image bounds
    const clampedIx = Math.max(0, Math.min(ix, displayW));
    const clampedIy = Math.max(0, Math.min(iy, displayH));
    
    // Convert to natural image coordinate space
    const ratioX = displayW > 0 ? clampedIx / displayW : 0;
    const ratioY = displayH > 0 ? clampedIy / displayH : 0;
    
    const pixelX = Math.round(ratioX * (naturalW - 1));
    const pixelY = Math.round(ratioY * (naturalH - 1));
    
    return {
      imageX: pixelX,
      imageY: pixelY,
      displayX: offsetX + clampedIx,
      displayY: offsetY + clampedIy,
      displayWidth: displayW,
      displayHeight: displayH,
    };
  };

  // Convert image pixel coordinates back to display coordinates (for debug overlay)
  const convertImageCoordsToDisplay = (imageX, imageY, imageWidth, imageHeight) => {
    const layout = imageLayoutRef.current;
    if (!layout.width || !layout.height || !imageWidth || !imageHeight) {
      return null;
    }
    
    const containerW = layout.width;
    const containerH = layout.height;
    const naturalW = imageWidth;
    const naturalH = imageHeight;
    
    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    const offsetX = (containerW - displayW) / 2;
    const offsetY = (containerH - displayH) / 2;
    
    // Convert image pixel to display coordinates
    const displayX = offsetX + (imageX / naturalW) * displayW;
    const displayY = offsetY + (imageY / naturalH) * displayH;
    
    return { displayX, displayY };
  };
  
  // Throttle for color name updates during drag (80ms debounce)
  const colorNameUpdateTimeout = useRef(null);
  
  // Update touch position - SINGLE SOURCE OF TRUTH
  // All UI elements (cursor, magnifier) derive from this
  const updateTouch = (locationX, locationY) => {
    touchRef.current = { x: locationX, y: locationY };
    
    // Always show cursor at exact touch position if within PanResponder view
    // This provides immediate visual feedback
    setPickerTouchPosition({ x: locationX, y: locationY });
  };
  
  // Update showColorPicker ref whenever it changes
  useEffect(() => {
    showColorPickerRef.current = showColorPicker;
  }, [showColorPicker]);
  
  // Create PanResponder at component level (outside JSX) to avoid hooks order violation
  // Always create a working PanResponder - check showColorPickerRef inside handlers
  const colorPickerPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return showColorPickerRef.current;
      },
      onMoveShouldSetPanResponder: () => {
        return showColorPickerRef.current;
      },
      onPanResponderGrant: async (evt) => {
        if (!showColorPickerRef.current) {
      return;
    }
        const { locationX, locationY } = evt.nativeEvent;
        updateTouch(locationX, locationY);
        // Initial sample on touch
        if (sampleAtCurrentTouchRef.current) {
          await sampleAtCurrentTouchRef.current();
        }
      },
      onPanResponderMove: (evt) => {
        if (!showColorPickerRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        updateTouch(locationX, locationY);
      },
      onPanResponderRelease: async () => {
        if (!showColorPickerRef.current) return;
        // Sample one last time on release (could also commit here)
        if (sampleAtCurrentTouchRef.current) {
          await sampleAtCurrentTouchRef.current({ commit: false }); // Release just updates preview
        }
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);
  
  // Primary touch handler using Pressable (more reliable than PanResponder)
  const handleImagePress = async (event) => {
    if (!showColorPicker) {
      return;
    }
    const { locationX, locationY } = event.nativeEvent;
    updateTouch(locationX, locationY);
    if (sampleAtCurrentTouchRef.current) {
      await sampleAtCurrentTouchRef.current();
    }
  };
  
  // Handle press in (for immediate feedback)
  const handleImagePressIn = (event) => {
    if (!showColorPicker) return;
    const { locationX, locationY } = event.nativeEvent;
    updateTouch(locationX, locationY);
  };
  
  // Pick color at coordinates - called only on release
  const pickColorAtCoordinates = async (touchX, touchY) => {
    // Try to get image URL from multiple sources
    let imageUrl = colorPickerImageUrlRef.current;
    if (!imageUrl) {
      imageUrl = originalProductImage.current || product?.image;
      if (imageUrl) colorPickerImageUrlRef.current = imageUrl;
    }
    
    if (!imageUrl) {
      return null;
    }

    const coords = convertTouchToImageCoords(touchX, touchY);
    if (!coords) {
      return null;
    }

    setIsSamplingColor(true);
    colorPickerApiInProgress.current = true;

    const requestBody = {
      mode: 'pick',
      imageUrl: imageUrl,
      x: coords.imageX,
      y: coords.imageY,
      imageWidth: imageNaturalSizeRef.current.width,
      imageHeight: imageNaturalSizeRef.current.height,
    };

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
      if (!API_BASE) return null;
      
      const apiUrl = `${API_BASE}/api/color`;
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        
        if (result.color) {
          const hex = result.color;
          const { r, g, b } = result.rgb || { r: 0, g: 0, b: 0 };
          
          const { getNearestColorName } = require('../lib/colorNaming');
          const nearestColor = getNearestColorName(hex);
          const colorName = nearestColor.name;
          
          const serverSampled = result.sampledAt || { x: coords.imageX, y: coords.imageY };
          const serverImageSize = result.imageSize || { width: imageNaturalSizeRef.current.width, height: imageNaturalSizeRef.current.height };
          const serverDisplayCoords = convertImageCoordsToDisplay(serverSampled.x, serverSampled.y, serverImageSize.width, serverImageSize.height);
          
          return { 
            hex, 
            rgb: { r, g, b },
            name: colorName,
            serverSampled,
            serverDisplayCoords,
          };
        }
      } else {
        const errorText = await apiResponse.text();
        console.error('🎨 [API] Error response:', apiResponse.status, errorText);
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
      return;
    }

    // Use robust offline color naming system (Lab-based ΔE matching)
    const { getNearestColorName } = require('../lib/colorNaming');
    const nearestColor = getNearestColorName(colorResult.hex);
    const colorName = nearestColor.name;
    
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
    
    // Re-run fit analysis with new color
    setTimeout(() => {
      loadInsights(true);
    }, 100);
  };
  
  // Sample color at current touch position
  // Defined after pickColorAtCoordinates and handleManualColorPickerTap so it can reference them
  const sampleAtCurrentTouch = async ({ commit = false } = {}) => {
    const { x, y } = touchRef.current;
    
    const coords = convertTouchToImageCoords(x, y);
    if (!coords) {
      return null;
    }
    
    const colorResult = await pickColorAtCoordinates(x, y);
    if (colorResult) {
      // Update live preview
      const { getNearestColorName } = require('../lib/colorNaming');
      const nearestColor = getNearestColorName(colorResult.hex);
      setLivePickedColor({ 
        hex: colorResult.hex, 
        rgb: colorResult.rgb, 
        name: nearestColor.name 
      });
      
      // Store server-sampled coordinates for debug overlay
      // Use server's actual sampled coordinates if available, otherwise use frontend calculation
      if (colorResult.serverSampled && colorResult.serverDisplayCoords) {
        setServerSampledCoords({
          imageX: colorResult.serverSampled.x,
          imageY: colorResult.serverSampled.y,
          displayX: colorResult.serverDisplayCoords.displayX,
          displayY: colorResult.serverDisplayCoords.displayY,
        });
      } else {
        // Fallback to frontend calculation
        setServerSampledCoords({
          imageX: coords.imageX,
          imageY: coords.imageY,
          displayX: coords.displayX,
          displayY: coords.displayY,
        });
      }
      
      if (commit) {
        handleManualColorPickerTap({ nativeEvent: { locationX: x, locationY: y }, colorResult });
      }
    }
    
    return colorResult;
  };
  
  // Update the ref whenever sampleAtCurrentTouch changes
  useEffect(() => {
    sampleAtCurrentTouchRef.current = sampleAtCurrentTouch;
  }, [sampleAtCurrentTouch]);
  
  // Pre-load image when color picker modal opens
  useEffect(() => {
    if (showColorPicker) {
      // Try multiple sources for the image
      const imageToUse = originalProductImage.current || product?.image;
      if (imageToUse) {
        colorPickerImageUrlRef.current = imageToUse;
      }
    } else {
      // Cleanup when modal closes
      colorPickerImageUrlRef.current = null;
      setLivePickedColor(null);
      setPickerTouchPosition(null);
      setServerSampledCoords(null);
      touchRef.current = { x: 0, y: 0 };
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
      // Update all color-related state FIRST (synchronously)
      setPickedColorHex(livePickedColor.hex);
      setPickedColorName(livePickedColor.name);
      setDetectedColor(livePickedColor.name);
      setDetectedColorHex(livePickedColor.hex);
      setUserEnteredColor(livePickedColor.name);
      setColorSource('manual');
      
      // Update product with the picked color
      const updatedProduct = {
        ...product,
        color: livePickedColor.name, // For UI display
        colorHex: livePickedColor.hex, // Source of truth for logic
      };
      setProduct(updatedProduct);
      
      // Close modal
      setShowColorPicker(false);
      setPickerTouchPosition(null);
      setServerSampledCoords(null);
      touchRef.current = { x: 0, y: 0 };
      
      // Re-run fit analysis with manually picked color
      // Pass updatedProduct to ensure colorHex is used
      // Use a longer delay to ensure state updates have propagated
      setTimeout(() => {
        loadInsights(true, updatedProduct);
      }, 500);
    }
  };
  
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(false); // Only used for initial load, not for fit check
  // Removed unused state: fitAdvice, sizeAdvice, styleAdvice (replaced by fitSizeData)
  const [colorSuitability, setColorSuitability] = useState(null);
  const [bodyShapeSuitability, setBodyShapeSuitability] = useState(null);
  const [fabricComfort, setFabricComfort] = useState(null);
  const [fitSizeData, setFitSizeData] = useState(null); // Combined fit & size data
  const [howToWearData, setHowToWearData] = useState(null); // Occasions and styling tips
  const [isCached, setIsCached] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false); // Client-side throttling
  const requestInProgress = useRef(false); // Prevent multiple simultaneous requests
  const [userProfileDataState, setUserProfileDataState] = useState(null); // Store user profile for UI access
  // Initialize from user.colorProfile if available (loaded on app startup)
  const [colorProfileState, setColorProfileState] = useState(user?.colorProfile || null); // Store color profile for UI access
  // Keep a ref for the latest colorProfile to avoid stale closures
  const colorProfileRef = useRef(user?.colorProfile || null);
  
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
    }
  }, [product?.id]); // Only update when product ID changes
  
  // Sync colorProfileState when user object changes (e.g., after app startup load)
  // Always sync to ensure we have the latest data
  useEffect(() => {
    if (user?.colorProfile?.season) {
      setColorProfileState(user.colorProfile);
      colorProfileRef.current = user.colorProfile;
    }
  }, [user?.colorProfile]);
  
  // Also update ref whenever colorProfileState changes
  useEffect(() => {
    if (colorProfileState?.season) {
      colorProfileRef.current = colorProfileState;
    }
  }, [colorProfileState]);

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
      // Set requesting state immediately to show analyzing screen
      setIsRequesting(true);
      
      // Open sheet after a brief delay to show analyzing state first
      setTimeout(() => {
        openSheet();
      }, 100);
      
      // Check if product has color hex from admin (highest priority)
      // Priority 1: Product has hex code from admin
      if (product?.colorHex) {
        setColorSource('product');
        setDetectedColorHex(product.colorHex);
        if (product?.color) {
          setDetectedColor(product.color);
          setUserEnteredColor(product.color);
        }
      }
      // Priority 2: Product has color name but no hex
      else if (product?.color && !detectedColor && !userEnteredColor) {
        setColorSource('product');
        setDetectedColor(product.color);
        setUserEnteredColor(product.color);
        // Note: No hex, so analysis will trigger auto-detection or ask user to pick
      }
      // Priority 3: Try to infer color from product name
      else {
        const productColorFromName = inferColorFromName(product?.name || '');
        if (productColorFromName) {
          setColorSource('product');
          setDetectedColor(productColorFromName);
          setUserEnteredColor(productColorFromName);
        }
      }
      
      // Auto-detect color if no hex available (product has no colorHex)
      // Note: autoDetectColor will reload insights after detection
      if (originalProductImage.current && !product?.colorHex && !detectedColorHex && !pickedColorHex) {
        // Start color detection (non-blocking) - it will reload insights after detection
        autoDetectColor().then(() => {
          // Only load insights if color detection didn't trigger a reload
          // (autoDetectColor already calls loadInsights after detection)
        });
      } else {
        // Ensure colorProfile is synced from user object before loading insights
        if (user?.colorProfile?.season && !colorProfileRef.current?.season) {
          setColorProfileState(user.colorProfile);
          colorProfileRef.current = user.colorProfile;
        }
        
        // Load insights immediately if we already have color or no image
        // Use a small delay to prevent double refresh
        setTimeout(() => {
      loadInsights();
        }, 100);
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

  const loadInsights = async (forceRefresh = false, productOverride = null) => {
    // Use productOverride if provided, otherwise use current product state
    // Define this FIRST so it's available throughout the function
    const productToUse = productOverride || product;
    
    // Client-side throttling: prevent multiple simultaneous requests
    if (requestInProgress.current && !forceRefresh) {
      return;
    }
    
    requestInProgress.current = true;
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
          setUserProfileDataState(profileData); // Store in state for UI access
        }
        
        // Load color profile - check multiple sources in order of priority
        // Priority 1: Check ref (most up-to-date, set by useEffect)
        if (colorProfileRef.current?.season) {
          colorProfile = colorProfileRef.current;
        }
        // Priority 2: Check user object (from App.js)
        else if (user?.colorProfile?.season) {
          colorProfile = user.colorProfile;
          setColorProfileState(colorProfile);
          colorProfileRef.current = colorProfile;
        }
        // Priority 3: Check current state
        else if (colorProfileState?.season) {
          colorProfile = colorProfileState;
        }
        // Priority 4: Load from database
        else {
        colorProfile = await loadColorProfile(user.id);
          if (colorProfile) {
            setColorProfileState(colorProfile);
            colorProfileRef.current = colorProfile;
          }
        }
        
        // Final fallback: build color profile from userProfileData if available
        if (!colorProfile && userProfileData?.color_season) {
          colorProfile = {
            tone: userProfileData.color_tone || 'neutral',
            depth: userProfileData.color_depth || 'medium',
            season: userProfileData.color_season,
            clarity: userProfileData.color_clarity || null,
            microSeason: userProfileData.micro_season || null,
            bestColors: userProfileData.best_colors || [],
            avoidColors: userProfileData.avoid_colors || [],
          };
          setColorProfileState(colorProfile);
          colorProfileRef.current = colorProfile;
        }
        
        // CRITICAL: If still no colorProfile, try database one more time
        // This handles edge cases where refs/state didn't catch updates
        if (!colorProfile && user?.id) {
          const dbProfile = await loadColorProfile(user.id);
          if (dbProfile) {
            colorProfile = dbProfile;
            setColorProfileState(dbProfile);
            colorProfileRef.current = dbProfile;
          }
        }
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
        chestIn: getNumericValue(userProfileData?.chest_in) ?? getNumericValue(userProfileData?.chest_circ_in) ?? getNumericValue(userProfileData?.chest),
        bustIn: getNumericValue(userProfileData?.chest_in) ?? getNumericValue(userProfileData?.bust_in) ?? getNumericValue(userProfileData?.bust_circ_in) ?? getNumericValue(userProfileData?.chest),
        waistIn: getNumericValue(userProfileData?.waist_in) ?? getNumericValue(userProfileData?.waist_circ_in) ?? getNumericValue(userProfileData?.waist),
        hipsIn: getNumericValue(userProfileData?.hips_in) ?? getNumericValue(userProfileData?.hip_circ_in) ?? getNumericValue(userProfileData?.hips),
        shoulderIn: getNumericValue(userProfileData?.shoulder_in) ?? getNumericValue(userProfileData?.shoulder_width_in) ?? getNumericValue(userProfileData?.shoulder),
        inseamIn: getNumericValue(userProfileData?.inseam_in) ?? getNumericValue(userProfileData?.inseam),
        gender: userProfileData?.gender || null,
      };

      // Build product info with URL for caching
      const productInfo = {
        name: productToUse?.name || 'Item',
        category: productToUse?.category || inferCategory(productToUse?.name),
        color: productToUse?.color || inferColor(productToUse?.name),
        fabric: productToUse?.fabric,
        fit: productToUse?.fit,
        length: productToUse?.length,
        price: productToUse?.price,
        brand: productToUse?.brand,
        url: productToUse?.url || productToUse?.link || productToUse?.product_link || productToUse?.name, // For cache key
      };

      // Build product for fitLogic - needs category mapping and sizeChart
      const category = productToUse?.category || inferCategory(productToUse?.name);
      const fitLogicCategory = category === 'dress' || category === 'dresses' ? 'dresses' :
                               category === 'lower' || category === 'pants' || category === 'jeans' ? 'lower_body' :
                               'upper_body';
      
      // Convert sizeChart to fitLogic format if available
      let sizeChart = [];
      if (productToUse?.sizeChart) {
        if (Array.isArray(productToUse.sizeChart)) {
          sizeChart = productToUse.sizeChart;
        } else if (typeof productToUse.sizeChart === 'object') {
          // Convert object format to array format
          sizeChart = Object.entries(productToUse.sizeChart).map(([size, measurements]) => ({
            size,
            measurements: typeof measurements === 'object' ? measurements : {}
          }));
        }
      }
      
      // Normalize fabric stretch: single source of truth
      // Check material keywords first, then fabricStretch field
      let normalizedFabricStretch = false;
      const materialStr = (productToUse?.fabric || productToUse?.material || '').toLowerCase();
      const hasStretchKeywords = materialStr.includes('stretch') || 
                                  materialStr.includes('elastic') || 
                                  materialStr.includes('spandex') || 
                                  materialStr.includes('elastane') ||
                                  materialStr.includes('lycra');
      
      if (productToUse?.fabricStretch) {
        // Direct fabric_stretch field from garment (none, low, medium, high)
        normalizedFabricStretch = productToUse.fabricStretch !== 'none' && productToUse.fabricStretch !== 'low';
      } else {
        // Fallback to keyword detection
        normalizedFabricStretch = hasStretchKeywords;
      }
      
      const productForFitLogic = {
        category: fitLogicCategory,
        name: product?.name || 'Item',
        fitType: product?.fit || product?.fitType || product?.fit_type || null,
        fabricStretch: normalizedFabricStretch, // Use normalized value
        sizeChart: sizeChart,
      };
      
      // Use fitLogic for size recommendations (NO-AI)
      const sizeRecommendation = recommendSizeAndFit(userProfileForFitLogic, productForFitLogic, {});
      
      // Convert fitLogic result to UI format
      const missingBody = sizeRecommendation.missing?.filter(m => 
        m.includes('In') || m.includes('height') || m.includes('waist') || m.includes('chest') || m.includes('hips') || m.includes('shoulder') || m.includes('inseam')
      ) || [];
      const missingGarment = sizeRecommendation.missing?.filter(m => 
        m.includes('sizeChart') || m.includes('size chart')
      ) || [];
          
      // Size advice is now part of fitSizeData, so we don't need separate setSizeAdvice calls
          
      // Use styleSuitability for color and body shape (NO-AI)
      
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
        // Include depth and clarity if available from skin tone analysis
        depth: colorProfile?.depth || userProfileData?.color_depth || null,
        clarity: colorProfile?.clarity || null,
        // Include micro-season if available (internal use only, not displayed)
        microSeason: colorProfile?.microSeason || null,
      };
      
      
      // Get color - check multiple possible fields
      // IMPORTANT: Use productToUse (which may be productOverride) for color values
      // Priority: pickedColorName > detectedColor > productToUse.color > userEnteredColor > inferred
      const productColorRaw = pickedColorName || detectedColor || productToUse?.color || productToUse?.color_raw || productToUse?.primaryColor || userEnteredColor || null;
      const productColor = (productColorRaw && String(productColorRaw).trim() !== '' && String(productColorRaw).trim() !== 'null' && String(productColorRaw).trim() !== 'undefined')
        ? String(productColorRaw).trim()
        : (inferColor(productToUse?.name) || null);
      
      // If we have a detected/entered color but product doesn't have it, update product
      if ((detectedColor || userEnteredColor || pickedColorName) && !productToUse?.color && productColor) {
        const updatedProduct = {
          ...productToUse,
          color: productColor,
        };
        setProduct(updatedProduct);
      }
      
      // Get colorHex as source of truth (fallback to primaryColor for UI display)
      // Priority: productToUse colorHex (from productOverride) > detected/picked hex > product state
      // When productOverride is passed (e.g., from confirmManualColorPick), use its colorHex first
      const productColorHex = productToUse?.colorHex || detectedColorHex || pickedColorHex || null;
      
      const productForSuitability = {
        primaryColor: productColor, // For UI display/fallback - includes detected/picked colors
        colorHex: productColorHex, // Source of truth for color logic - includes detected/picked hex
        category: fitLogicCategory, // Use same category mapping
        fitType: productToUse?.fit || productToUse?.fitType || null,
      };
      
      const suitability = evaluateSuitability(userProfileForSuitability, productForSuitability);
      
      setColorSuitability(suitability.color);
      setBodyShapeSuitability(suitability.body);
      
      // Use fabricComfort for fabric analysis (NO-AI)
      const fabricAnalysis = analyzeFabricComfort({
        material: productToUse?.material || productToUse?.fabric || null,
        fabric: productToUse?.fabric || null,
      });
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
      
      // Build HOW TO WEAR data (enhanced rule-based with 40+ rules)
      // IMPORTANT: Use fresh suitability results (suitability.color, suitability.body) not stale state
      const howToWearResult = buildHowToWearData(
        productToUse || product,
        userProfileForSuitability,
        suitability.color,  // Use fresh result, not state variable
        suitability.body,   // Use fresh result, not state variable
        fabricAnalysis,     // Use fresh result, not state variable
        sizeRecommendation
      );
      setHowToWearData({
        occasions: howToWearResult.occasions,
        stylingTips: howToWearResult.stylingTips,
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
      setIsRequesting(false);
      requestInProgress.current = false;
    }
  };
  
  // Gemini removed - all insights are rule-based (fitLogic, styleSuitability, fabricComfort)

  /**
   * Enhanced How to Wear logic with 40+ rules
   * Uses all available product, user profile, and analysis data
   */
  const buildHowToWearData = (product, userProfile, colorSuitability, bodyShapeSuitability, fabricComfort, sizeRecommendation) => {
    // Always start with safe defaults
    const defaultOccasions = ['Casual', 'Work', 'Weekend'];
    const defaultTips = ['Layer with basics for versatility', 'Add statement piece for interest'];
    
    const occasions = [];
    const stylingTips = [];
    const rulesApplied = [];

    try {
      // Safely extract data with fallbacks
      const category = (product?.category || '').toLowerCase();
      const fitType = (product?.fit || product?.fitType || product?.fit_type || 'regular').toLowerCase();
      const material = (product?.material || product?.fabric || '').toLowerCase();
      const color = (product?.color || '').toLowerCase();
      const colorHex = product?.colorHex || null;
      const fabricStretch = product?.fabricStretch || 'none';
      const tags = product?.tags || [];
      const brand = (product?.brand || '').toLowerCase();
      const name = (product?.name || '').toLowerCase();
      
      // User attributes
      const bodyShape = (userProfile?.bodyShape || userProfile?.body_shape || '').toLowerCase();
      const colorSeason = (userProfile?.season || userProfile?.color_season || '').toLowerCase();
      const colorVerdict = colorSuitability?.verdict || null;
      const colorVerdictLower = (colorVerdict || '').toLowerCase(); // Normalize for comparison
      const bodyVerdict = bodyShapeSuitability?.verdict || null;
      const fabricVerdict = fabricComfort?.verdict || null;
      const sizeStatus = sizeRecommendation?.status || null;
      const sizeRisk = sizeRecommendation?.risk || null;
      
      // ========== OCCASIONS LOGIC (40+ rules) ==========
      
      // RULE 1-5: Base occasions by category
      if (category === 'dress' || category === 'dresses') {
        occasions.push('Work', 'Date Night', 'Casual', 'Formal');
        rulesApplied.push('category-dress-base');
      } else if (category === 'upper' || category === 'upper_body' || category === 'top') {
        occasions.push('Casual', 'Work', 'Weekend', 'Layering');
        rulesApplied.push('category-upper-base');
      } else if (category === 'lower' || category === 'lower_body' || category === 'pants' || category === 'jeans') {
        occasions.push('Casual', 'Work', 'Weekend', 'Active');
        rulesApplied.push('category-lower-base');
      } else if (category === 'jacket' || category === 'coat' || category === 'blazer') {
        occasions.push('Work', 'Formal', 'Casual', 'Layering');
        rulesApplied.push('category-jacket-base');
      } else {
        occasions.push('Casual', 'Work', 'Weekend');
        rulesApplied.push('category-default');
      }
      
      // RULE 6-15: Material-based occasions
      if (material) {
        if (material.includes('satin') || material.includes('silk') || material.includes('velvet')) {
          occasions.push('Formal', 'Date Night', 'Wedding', 'Gala', 'Evening');
          rulesApplied.push('material-luxury');
        } else if (material.includes('cotton') || material.includes('linen')) {
          occasions.push('Brunch', 'Beach', 'Summer', 'Weekend', 'Casual');
          rulesApplied.push('material-casual');
        } else if (material.includes('denim')) {
          occasions.push('Day Out', 'Weekend', 'Casual', 'Street Style');
          rulesApplied.push('material-denim');
        } else if (material.includes('wool') || material.includes('cashmere')) {
          occasions.push('Work', 'Formal', 'Winter', 'Business', 'Office');
          rulesApplied.push('material-professional');
        } else if (material.includes('leather') || material.includes('pleather')) {
          occasions.push('Night Out', 'Concert', 'Edgy', 'Street Style');
          rulesApplied.push('material-edgy');
        } else if (material.includes('athletic') || material.includes('sport') || material.includes('active')) {
          occasions.push('Gym', 'Active', 'Workout', 'Sports');
          rulesApplied.push('material-athletic');
        } else if (material.includes('chiffon') || material.includes('sheer')) {
          occasions.push('Summer', 'Beach', 'Resort', 'Vacation');
          rulesApplied.push('material-sheer');
        } else if (material.includes('knit') || material.includes('sweater')) {
          occasions.push('Cozy', 'Winter', 'Layering', 'Comfort');
          rulesApplied.push('material-knit');
        }
      }
      
      // RULE 16-25: Color-based occasions
      if (color || colorHex) {
        const colorLower = color || '';
        if (colorLower.includes('black') || colorLower.includes('navy') || colorLower.includes('dark')) {
          occasions.push('Evening', 'Formal', 'Work', 'Professional');
          rulesApplied.push('color-dark-formal');
        }
        if (colorLower.includes('white') || colorLower.includes('cream') || colorLower.includes('beige') || colorLower.includes('ivory')) {
          occasions.push('Summer', 'Brunch', 'Wedding', 'Resort', 'Daytime');
          rulesApplied.push('color-light-daytime');
        }
        if (colorLower.includes('red') || colorLower.includes('pink') || colorLower.includes('coral')) {
          occasions.push('Date Night', 'Party', 'Special Event', 'Celebration');
          rulesApplied.push('color-bold-social');
        }
        if (colorLower.includes('blue') || colorLower.includes('navy')) {
          occasions.push('Work', 'Professional', 'Business', 'Office');
          rulesApplied.push('color-blue-professional');
        }
        if (colorLower.includes('green') || colorLower.includes('emerald')) {
          occasions.push('Casual', 'Weekend', 'Nature', 'Outdoor');
          rulesApplied.push('color-green-casual');
        }
        if (colorLower.includes('yellow') || colorLower.includes('gold')) {
          occasions.push('Summer', 'Beach', 'Festival', 'Bright Day');
          rulesApplied.push('color-yellow-summer');
        }
        if (colorLower.includes('purple') || colorLower.includes('lavender')) {
          occasions.push('Date Night', 'Evening', 'Creative', 'Artistic');
          rulesApplied.push('color-purple-creative');
        }
        if (colorLower.includes('neutral') || colorLower.includes('grey') || colorLower.includes('gray') || colorLower.includes('tan')) {
          occasions.push('Work', 'Versatile', 'Everyday', 'Professional');
          rulesApplied.push('color-neutral-versatile');
        }
      }
      
      // RULE 26-30: Fit-based occasions
      if (fitType === 'oversized' || fitType === 'relaxed') {
        occasions.push('Weekend', 'Casual', 'Comfort', 'Layering');
        rulesApplied.push('fit-oversized-casual');
      } else if (fitType === 'slim' || fitType === 'fitted' || fitType === 'bodycon') {
        occasions.push('Date Night', 'Cocktail Party', 'Formal', 'Evening');
        rulesApplied.push('fit-fitted-formal');
      } else if (fitType === 'athletic' || fitType === 'active') {
        occasions.push('Gym', 'Active', 'Sports', 'Workout');
        rulesApplied.push('fit-athletic');
      }
      
      // RULE 31-35: Brand/formality level
      if (brand) {
        const luxuryBrands = ['gucci', 'prada', 'chanel', 'dior', 'versace', 'louis vuitton', 'hermes'];
        const fastFashion = ['zara', 'h&m', 'forever 21', 'asos', 'boohoo'];
        if (luxuryBrands.some(b => brand.includes(b))) {
          occasions.push('Luxury Event', 'Gala', 'High-End');
          rulesApplied.push('brand-luxury');
        } else if (fastFashion.some(b => brand.includes(b))) {
          occasions.push('Casual', 'Everyday', 'Affordable Style');
          rulesApplied.push('brand-fast-fashion');
        }
      }
      
      // RULE 36-40: Category-specific name-based rules
      if (name) {
        if (name.includes('cocktail') || name.includes('evening')) {
          occasions.push('Cocktail Party', 'Evening', 'Formal');
          rulesApplied.push('name-cocktail');
        }
        if (name.includes('beach') || name.includes('resort')) {
          occasions.push('Beach', 'Resort', 'Vacation', 'Summer');
          rulesApplied.push('name-beach');
        }
        if (name.includes('work') || name.includes('office') || name.includes('business')) {
          occasions.push('Work', 'Office', 'Professional', 'Business');
          rulesApplied.push('name-work');
        }
        if (name.includes('party') || name.includes('celebration')) {
          occasions.push('Party', 'Celebration', 'Special Event');
          rulesApplied.push('name-party');
        }
        if (name.includes('wedding') || name.includes('bridal')) {
          occasions.push('Wedding', 'Formal', 'Special Occasion');
          rulesApplied.push('name-wedding');
        }
      }
      
      // Remove duplicates and prioritize based on color verdict
      let uniqueOccasions = [...new Set(occasions)];
      
      // If color is risky, remove formal/special occasions
      if (colorVerdictLower === 'risky') {
        uniqueOccasions = uniqueOccasions.filter(o => 
          !['Formal', 'Gala', 'Wedding', 'Special Event', 'Date Night', 'Cocktail Party'].includes(o)
        );
        // Add more casual alternatives
        if (!uniqueOccasions.includes('Casual')) uniqueOccasions.unshift('Casual');
        rulesApplied.push('color-risky-occasions-adjusted');
      }
      
      // If color is great, prioritize special occasions
      if (colorVerdictLower === 'great' && (category.includes('dress') || fitType === 'fitted')) {
        // Move special occasions to front
        const specialOccasions = uniqueOccasions.filter(o => 
          ['Date Night', 'Formal', 'Special Event', 'Wedding'].includes(o)
        );
        const otherOccasions = uniqueOccasions.filter(o => 
          !['Date Night', 'Formal', 'Special Event', 'Wedding'].includes(o)
        );
        uniqueOccasions = [...specialOccasions, ...otherOccasions];
        rulesApplied.push('color-great-occasions-prioritized');
      }
      
      // Limit to 5 most relevant
      uniqueOccasions = uniqueOccasions.slice(0, 5);
      
      // ========== STYLING TIPS LOGIC (40+ rules) ==========
      
      // RULE 1-10: Body shape + fit tips
      if (bodyShape && bodyShapeSuitability) {
        if (bodyShape.includes('pear')) {
          if (category === 'upper' || category === 'upper_body' || category === 'top') {
            if (fitType === 'oversized' || fitType === 'relaxed') {
              stylingTips.push('Balance with fitted bottoms to highlight your waist');
              rulesApplied.push('body-pear-oversized-top');
            } else {
              stylingTips.push('Pair with A-line or wide-leg bottoms to balance your proportions');
              rulesApplied.push('body-pear-fitted-top');
            }
          } else if (category === 'lower' || category === 'lower_body' || category === 'pants') {
            if (fitType === 'slim' || fitType === 'skinny') {
              stylingTips.push('Consider straight-leg or wide-leg styles for better balance');
              rulesApplied.push('body-pear-slim-bottom');
            } else {
              stylingTips.push('This fit creates a balanced silhouette for your shape');
              rulesApplied.push('body-pear-balanced-bottom');
            }
          }
        }
        
        if (bodyShape.includes('apple') || bodyShape.includes('oval')) {
          if (category === 'upper' || category === 'upper_body' || category === 'top') {
            if (fitType === 'slim' || fitType === 'fitted') {
              stylingTips.push('Try regular or relaxed fits for more comfort around the midsection');
              rulesApplied.push('body-apple-slim-top');
            } else {
              stylingTips.push('This fit creates a smoother silhouette');
              rulesApplied.push('body-apple-relaxed-top');
            }
          } else if (category === 'dress' || category === 'dresses') {
            stylingTips.push('A-line or structured styles create a flattering line');
            rulesApplied.push('body-apple-dress');
          }
        }
        
        if (bodyShape.includes('rectangle')) {
          if (fitType === 'oversized') {
            stylingTips.push('Add a belt to create definition at the waist');
            rulesApplied.push('body-rectangle-oversized');
          } else if (category === 'dress' || category === 'dresses') {
            stylingTips.push('Wrap styles or belted dresses add shape');
            rulesApplied.push('body-rectangle-dress');
          }
        }
        
        if (bodyShape.includes('hourglass')) {
          stylingTips.push('This shape works well with fitted styles that highlight your waist');
          rulesApplied.push('body-hourglass-fitted');
        }
        
        if (bodyShape.includes('inverted') || bodyShape.includes('triangle')) {
          if (category === 'upper' && (fitType === 'oversized' || fitType === 'relaxed')) {
            stylingTips.push('Balance with wider or looser bottoms to create harmony');
            rulesApplied.push('body-inverted-oversized-top');
          }
        }
      }
      
      // RULE 11-20: Color suitability tips based on CIEDE2000 analysis
      if (colorVerdictLower === 'great') {
        stylingTips.push(`This ${color || 'color'} is perfect for your ${colorSeason || 'skin tone'} coloring`);
        rulesApplied.push('color-verdict-great');
        // Add specific tip based on category
        if (category.includes('upper') || category.includes('top')) {
          stylingTips.push('Wear near your face to brighten your complexion');
          rulesApplied.push('color-great-near-face');
        }
      } else if (colorVerdictLower === 'good') {
        stylingTips.push(`${color ? color.charAt(0).toUpperCase() + color.slice(1) : 'This color'} harmonizes well with your coloring`);
        rulesApplied.push('color-verdict-good');
      } else if (colorVerdictLower === 'risky') {
        // Get specific advice from analysis
        const colorSummary = colorSuitability?.summary || '';
        if (colorSummary.includes('intense') || colorSummary.includes('vivid')) {
          stylingTips.push('This bold color may overpower your natural coloring - keep it away from your face');
          rulesApplied.push('color-risky-intensity');
        } else if (colorSummary.includes('undertone')) {
          stylingTips.push('The undertone clashes with your skin - pair with a scarf or necklace in your best colors near your face');
          rulesApplied.push('color-risky-undertone');
        } else {
          stylingTips.push('Wear this as a bottom or with a flattering color near your face');
          rulesApplied.push('color-risky-general');
        }
        // Suggest styling to make it work
        if (category.includes('upper') || category.includes('top') || category.includes('dress')) {
          stylingTips.push('Add a cardigan, jacket, or scarf in your best colors to break up the color near your face');
          rulesApplied.push('color-risky-styling-tip');
        }
      } else if (colorVerdictLower === 'ok') {
        stylingTips.push(`${color ? color.charAt(0).toUpperCase() + color.slice(1) : 'This color'} works - elevate with accessories in your best colors`);
        rulesApplied.push('color-verdict-ok');
      }
      
      // Add season-specific pairing tips
      if (colorSeason && colorVerdictLower && colorVerdictLower !== 'great') {
        const seasonTips = {
          'spring': 'Pair with warm, clear colors like coral, peach, or warm green',
          'summer': 'Complement with soft, muted colors like dusty rose, slate blue, or sage',
          'autumn': 'Layer with warm earth tones like rust, olive, or camel',
          'winter': 'Contrast with cool, clear colors like icy pink, bright white, or cobalt blue'
        };
        if (seasonTips[colorSeason]) {
          stylingTips.push(seasonTips[colorSeason]);
          rulesApplied.push(`season-${colorSeason}-pairing`);
        }
      }
      
      // RULE 21-25: Fit-specific tips
      if (fitType === 'oversized') {
        stylingTips.push('Pair with fitted bottoms for balance');
        stylingTips.push('Tuck in or add a belt to define your waist');
        rulesApplied.push('fit-oversized-tips');
      } else if (fitType === 'slim' || fitType === 'fitted') {
        stylingTips.push('Works well with relaxed or flowy pieces for contrast');
        rulesApplied.push('fit-fitted-tips');
      } else if (fitType === 'relaxed') {
        stylingTips.push('Great for comfort - add structure with accessories');
        rulesApplied.push('fit-relaxed-tips');
      }
      
      // RULE 26-35: Material/fabric tips
      if (fabricComfort) {
        if (material.includes('silk') || material.includes('satin')) {
          stylingTips.push('Handle with care - delicate fabric that wrinkles easily');
          rulesApplied.push('material-silk-care');
        }
        if (material.includes('denim')) {
          stylingTips.push('Denim softens with wear - expect it to stretch slightly');
          rulesApplied.push('material-denim-care');
        }
        if (material.includes('wool') && !material.includes('merino')) {
          stylingTips.push('Wool may feel itchy - consider a soft base layer');
          rulesApplied.push('material-wool-care');
        }
        if (material.includes('linen')) {
          stylingTips.push('Linen wrinkles easily but stays cool - perfect for summer');
          rulesApplied.push('material-linen-care');
        }
        if (fabricStretch === 'high' || fabricStretch === 'medium') {
          stylingTips.push('Stretch fabric offers flexibility and comfort');
          rulesApplied.push('fabric-stretch-comfort');
        } else if (fabricStretch === 'none' || fabricStretch === 'low') {
          stylingTips.push('No stretch - ensure proper fit for comfort');
          rulesApplied.push('fabric-no-stretch');
        }
        if (fabricVerdict === 'comfortable') {
          stylingTips.push('This fabric feels comfortable against the skin');
          rulesApplied.push('fabric-verdict-comfortable');
        } else if (fabricVerdict === 'risky') {
          stylingTips.push('Consider fabric texture - may need a base layer');
          rulesApplied.push('fabric-verdict-risky');
        }
      }
      
      // RULE 36-40: Category-specific tips
      if (category === 'dress' || category === 'dresses') {
        stylingTips.push('Accessorize with statement jewelry or a belt to personalize');
        rulesApplied.push('category-dress-accessories');
        if (fitType === 'bodycon' || fitType === 'fitted') {
          stylingTips.push('Bodycon styles work best with smooth undergarments');
          rulesApplied.push('category-dress-bodycon');
        }
      } else if (category === 'upper' || category === 'upper_body' || category === 'top') {
        stylingTips.push('Layer with a jacket or cardigan for versatility');
        rulesApplied.push('category-upper-layering');
        if (fitType === 'oversized') {
          stylingTips.push('Oversized tops work great half-tucked for definition');
          rulesApplied.push('category-upper-oversized');
        }
      } else if (category === 'lower' || category === 'lower_body' || category === 'pants') {
        stylingTips.push('Pair with a fitted top to balance the silhouette');
        rulesApplied.push('category-lower-balance');
        if (fitType === 'wide-leg' || fitType === 'flared') {
          stylingTips.push('Wide-leg styles elongate - pair with heels or platform shoes');
          rulesApplied.push('category-lower-wide-leg');
        }
      } else if (category === 'jacket' || category === 'coat') {
        stylingTips.push('Layer over fitted pieces for a polished look');
        rulesApplied.push('category-jacket-layering');
      }
      
      // RULE 41-45: Color-based styling
      if (color || colorHex) {
        const colorLower = color || '';
        if (colorLower.includes('neutral') || colorLower.includes('black') || colorLower.includes('navy') || colorLower.includes('white') || colorLower.includes('grey')) {
          stylingTips.push('Neutral colors work with bold accessories for interest');
          rulesApplied.push('color-neutral-accessories');
        } else if (colorLower.includes('bright') || colorLower.includes('bold') || colorLower.includes('vibrant')) {
          stylingTips.push('Let this color be the statement - keep accessories minimal');
          rulesApplied.push('color-bold-minimal');
        } else if (colorLower.includes('pastel') || colorLower.includes('soft')) {
          stylingTips.push('Pastel colors pair beautifully with other soft tones');
          rulesApplied.push('color-pastel-pairing');
        }
      }
      
      // RULE 46-50: Size/fit recommendations
      if (sizeRecommendation) {
        if (sizeStatus === 'OK' && sizeRisk === 'low') {
          stylingTips.push('Perfect fit - this size works great for your measurements');
          rulesApplied.push('size-perfect-fit');
        } else if (sizeStatus === 'OK' && sizeRisk === 'medium') {
          stylingTips.push('Good fit with minor adjustments - consider tailoring for perfection');
          rulesApplied.push('size-good-fit');
        } else if (sizeRecommendation.insights?.some(i => i.toLowerCase().includes('runs small'))) {
          stylingTips.push('This item runs small - consider sizing up');
          rulesApplied.push('size-runs-small');
        } else if (sizeRecommendation.insights?.some(i => i.toLowerCase().includes('runs large'))) {
          stylingTips.push('This item runs large - consider sizing down');
          rulesApplied.push('size-runs-large');
        }
      }
      
      // Remove duplicates and limit to 4
      const uniqueTips = [...new Set(stylingTips)];
      
      return {
        occasions: uniqueOccasions.length > 0 ? uniqueOccasions.slice(0, 5) : defaultOccasions,
        stylingTips: uniqueTips.length > 0 ? uniqueTips.slice(0, 4) : defaultTips,
        rulesApplied: rulesApplied,
      };
    } catch (error) {
      console.error('👔 [HOW TO WEAR] Error building how to wear data:', error);
      // Return defaults on error
      return {
        occasions: defaultOccasions,
        stylingTips: defaultTips,
        rulesApplied: ['error-fallback'],
      };
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
          {isRequesting && !fitSizeData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>
                Analyzing your perfect fit...
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
                    {/* Loading Indicator */}
                    {isRequesting && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>
                        <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '500' }}>
                          Analyzing fit & size...
                        </Text>
                      </View>
                    )}
                    
                    {/* Status Label */}
                    {!isRequesting && (
                    <View style={[
                      styles.verdictBadge,
                      fitSizeData?.status === 'Perfect Fit' && styles.verdictGood,
                      fitSizeData?.status === 'Good Fit' && styles.verdictGood,
                      fitSizeData?.status === 'Good with Tweaks' && styles.verdictNeutral,
                      (fitSizeData?.status === 'Runs Small' || fitSizeData?.status === 'Runs Large' || fitSizeData?.status === 'High Risk') && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>{fitSizeData?.status || 'Analyzing...'}</Text>
                    </View>
                    )}

                    {/* Recommended Size - Only show when not loading */}
                    {!isRequesting && (
                      <>
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
                      </>
                    )}

                    {/* Measurement Deltas (2-5 bullets) - Only show when not loading */}
                    {!isRequesting && fitSizeData?.measurementDeltas && fitSizeData.measurementDeltas.length > 0 && (
                      <View style={styles.adviceSection}>
                        {fitSizeData.measurementDeltas.map((delta, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {delta}</Text>
                        ))}
                      </View>
                    )}

                    {/* Stylist Translation - Only show when not loading */}
                    {!isRequesting && fitSizeData?.stylistTranslation && (
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
                      {colorSource === 'manual' && '✓ Color selected manually'}
                      {colorSource === 'product' && product?.colorHex && '✓ Product color from product details'}
                      {colorSource === 'product' && !product?.colorHex && 'Color name from product'}
                      {colorSource === 'auto-detected' && '⚡ Color auto-detected'}
                      {!colorSource && product?.colorHex && '✓ Product color from product details'}
                      {!colorSource && (product?.color || detectedColor || userEnteredColor) && !product?.colorHex && 'Color detected'}
                      {!colorSource && !product?.color && !detectedColor && !userEnteredColor && '⚠️ No color detected'}
                    </Text>
                    {/* Note for auto-detected colors */}
                    {colorSource === 'auto-detected' && (
                      <Text style={styles.colorAutoDetectNote}>
                        For accurate results, pick color manually
                      </Text>
                    )}
                  </View>

                  {/* Color Display: Swatch + Name + Hex */}
                  {(pickedColorName || detectedColor || product?.color || userEnteredColor) ? (
                    <View style={styles.colorDisplayRow}>
                      {/* Circular Color Swatch */}
                      <View style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: pickedColorHex || detectedColorHex || product?.colorHex || '#808080',
                        }
                      ]} />
                      
                      {/* Color Name and Hex */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.colorNameText}>
                          Name: {pickedColorName || detectedColor || product?.color || userEnteredColor}
                        </Text>
                        <Text style={styles.colorHexText}>
                          HEX: {(pickedColorHex || detectedColorHex || product?.colorHex || '#808080').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.colorDisplayRow}>
                      <View style={[styles.colorSwatch, { backgroundColor: '#808080' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.colorNameText, { color: '#666' }]}>Name: No color detected</Text>
                        <Text style={[styles.colorHexText, { color: '#666' }]}>HEX: #808080</Text>
                      </View>
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
                      {colorSuitability.reasons?.[0]?.includes('Product color not detected')
                        ? 'Product color not detected. Pick the color to get analysis.'
                        : colorSuitability.reasons?.[0]?.includes('Color Profile') || colorSuitability.reasons?.[0]?.includes('season')
                          ? 'Set your Color Profile to get personalized color feedback'
                          : colorSuitability.summary || 'Need color info for analysis'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {/* Show Pick Color button if product color not detected */}
                      {colorSuitability.reasons?.[0]?.includes('Product color not detected') && (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => {
                            if (originalProductImage.current || product?.image) {
                              setShowColorPicker(true);
                            } else {
                              setShowColorInputModal(true);
                            }
                          }}
                        >
                          <Text style={styles.addDataBtnText}>🎯 Pick Color →</Text>
                        </Pressable>
                      )}
                      {/* Show Set Color Profile button if user season not set */}
                      {(colorSuitability.reasons?.[0]?.includes('Color Profile') || colorSuitability.reasons?.[0]?.includes('season')) && (
                        <Pressable 
                          style={styles.addDataBtn}
                          onPress={() => {
                            closeSheet();
                            setRoute('account');
                          }}
                        >
                          <Text style={styles.addDataBtnText}>
                            {colorProfileState?.season 
                              ? 'Update Color Profile →' 
                              : 'Set Color Profile →'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : colorSuitability?.verdict ? (
                  <>
                    <View style={[
                      styles.verdictBadge,
                      colorSuitability?.verdict === 'great' && styles.verdictGood,
                      colorSuitability?.verdict === 'good' && styles.verdictGood,
                      colorSuitability?.verdict === 'ok' && styles.verdictNeutral,
                      colorSuitability?.verdict === 'risky' && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>
                        {colorSuitability?.verdict === 'great' && '✅ Great'}
                        {colorSuitability?.verdict === 'good' && '✅ Good'}
                        {colorSuitability?.verdict === 'ok' && '⚡ OK'}
                        {colorSuitability?.verdict === 'risky' && '⚠️ Risky'}
                      </Text>
                    </View>

                    {/* Summary */}
                    {colorSuitability?.summary && (
                      <Text style={styles.colorSummaryText}>
                        {colorSuitability.summary}
                      </Text>
                    )}

                    {/* Bullets - supports new format with isMicronote flag */}
                    {colorSuitability?.bullets && colorSuitability.bullets.length > 0 && (
                      <View style={styles.adviceSection}>
                        {colorSuitability.bullets.map((bullet, idx) => {
                          // Handle both old format (string) and new format (object with text/isMicronote)
                          const bulletText = typeof bullet === 'string' ? bullet : bullet.text;
                          const isMicronote = typeof bullet === 'object' && bullet.isMicronote;
                          return (
                            <Text key={idx} style={isMicronote ? styles.colorMicroNote : styles.adviceItem}>
                              {isMicronote ? '💡 ' : '• '}{bulletText}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {/* Fallback to reasons if bullets not available */}
                    {(!colorSuitability?.bullets || colorSuitability.bullets.length === 0) && 
                     colorSuitability?.reasons && colorSuitability.reasons.length > 0 && (
                      <View style={styles.adviceSection}>
                        {colorSuitability.reasons.slice(0, 3).map((reason, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {reason}</Text>
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

                    {bodyShapeSuitability?.bodyShapeLabel && (
                      <Text style={styles.bodyShapeLabel}>Based on your {bodyShapeSuitability.bodyShapeLabel} shape:</Text>
                    )}

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
                    {/* Loading Indicator - Always show when processing */}
                    {isRequesting && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>
                        <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '500' }}>
                          Analyzing fabric & comfort...
                        </Text>
                      </View>
                    )}
                    
                    {/* Material Name Display with Edit Option - Only show when not loading */}
                    {!isRequesting && product?.material && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>
                        <Text style={[styles.adviceItem, { flex: 1, marginBottom: 0 }]}>
                          Material: <Text style={{ fontWeight: '600' }}>{product.material}</Text>
                        </Text>
                        <Pressable 
                          onPress={() => setShowMaterialInputModal(true)}
                          style={{ padding: 4 }}
                        >
                          <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '600' }}>Edit</Text>
                        </Pressable>
                      </View>
                    )}
                    
                    {/* Verdict and Insights - Only show when not loading */}
                    {!isRequesting && (
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
                        // Get brand size chart and show for confirmation
                        const category = product?.category || 'upper_body';
                        const brandChart = getBrandSizeChart(item, category);
                        if (brandChart) {
                          const sizeChart = convertBrandChartToFitLogic(brandChart);
                          // Store sizeChart array directly for confirmation view
                          setPendingParsedData(sizeChart);
                          setShowParsedDataConfirmation(true);
                        } else {
                          Alert.alert('Brand Not Found', `Size chart for ${item} in ${category} category is not available. Please use manual entry or screenshot.`);
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
                        
                        // Convert image to base64
                        try {
                          setOcrParsingStatus('Converting image to base64...');
                        const response = await fetch(imageUri);
                        const blob = await response.blob();
                          
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result;
                          
                          // Call fit-check-utils API for parsing size chart
                          try {
                            const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL;
                            if (!API_BASE) {
                              setOcrParsingStatus('Error: API configuration missing');
                              return;
                            }
                              
                              setOcrParsingStatus('Analysing the screenshot...');
                            
                            const parseResponse = await fetch(`${API_BASE}/api/ocr-sizechart`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ imageBase64: base64 }),
                            });
                            
                            if (!parseResponse.ok) {
                              const errorText = await parseResponse.text();
                                setOcrParsingStatus(`Error: ${parseResponse.status}`);
                              throw new Error(`OCR API error: ${parseResponse.status}`);
                            }
                              
                              setOcrParsingStatus('Processing OCR results...');
                            
                            const parseData = await parseResponse.json();
                            
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
                      onPress={async () => {
                        // User confirmed - use the parsed data
                        setParsedSizeChart(pendingParsedData);
                        const updatedProduct = {
                          ...product,
                          sizeChart: pendingParsedData,
                        };
                        // Update product state first
                        setProduct(updatedProduct);
                        // Close modals
                        setShowParsedDataConfirmation(false);
                        setPendingParsedData(null);
                        setOcrParsingStatus(null);
                        setShowGarmentInputModal(false);
                        // Load insights immediately with updated product
                        await loadInsights(true, updatedProduct);
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
                    onPress={async () => {
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
                        // Update product state first
                        setProduct(updatedProduct);
                        // Close modal
                        setShowGarmentInputModal(false);
                        setManualSizeChartInput({});
                        setPendingParsedData(null);
                        // Load insights immediately with updated product
                        await loadInsights(true, updatedProduct);
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
          setLivePickedColor(null);
          setServerSampledCoords(null);
          touchRef.current = { x: 0, y: 0 };
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
                setLivePickedColor(null);
                setServerSampledCoords(null);
                touchRef.current = { x: 0, y: 0 };
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
                  {/* Image - behind the touch layer */}
                  <View style={{ flex: 1 }}>
                        <OptimizedImage
                          source={{ uri: originalProductImage.current || product?.image }}
                          style={{ 
                            width: '100%', 
                            flex: 1,
                            minHeight: 500,
                      }}
                      resizeMode="contain"
                      pointerEvents="none"
                          onLoad={(event) => {
                            const { width, height } = event.nativeEvent.source;
                        imageNaturalSizeRef.current = { width, height };
                          }}
                        />
                  </View>
                  
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
                    onPress={handleImagePress}
                    onPressIn={handleImagePressIn}
                    onLayout={(event) => {
                      const { width, height, x, y } = event.nativeEvent.layout;
                      imageLayoutRef.current = { width, height, x, y };
                    }}
                  />
                        
                  {/* Color picker cursor - circle showing exact pick location */}
                  {/* Rendered outside PanResponder View to prevent clipping, but uses same coordinates */}
                        {pickerTouchPosition && (
                          <View
                            style={[
                        styles.colorPickerCursorBox,
                              {
                          position: 'absolute',
                          left: pickerTouchPosition.x - 15,
                          top: pickerTouchPosition.y - 15,
                          opacity: 1,
                          zIndex: 1000,
                              }
                            ]}
                            pointerEvents="none"
                          >
                      <View style={styles.colorPickerCursorOuter} />
                      <View style={styles.colorPickerCursorInner} />
                      <View style={styles.colorPickerCursorCenter} />
                          </View>
                        )}
                        
                        {/* Magnifier/Loupe above finger - shows zoomed view */}
                  {pickerTouchPosition && (
                          <View
                            style={[
                              styles.magnifier,
                              {
                          position: 'absolute',
                          left: Math.max(10, Math.min(pickerTouchPosition.x - 60, width - 130)),
                          top: Math.max(10, pickerTouchPosition.y - 140),
                          opacity: 1,
                          zIndex: 1001,
                              }
                            ]}
                      pointerEvents="none"
                          >
                            <View style={styles.magnifierContent}>
                        {isSamplingColor ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : livePickedColor ? (
                          <>
                              <View style={[styles.magnifierColorSwatch, { backgroundColor: livePickedColor.hex }]} />
                              <Text style={styles.magnifierText}>
                                {livePickedColor.hex.toUpperCase()}
                              </Text>
                              <Text style={styles.magnifierTextSmall}>
                              {livePickedColor.name}
                              </Text>
                          </>
                        ) : (
                          <View style={{ alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#fff" style={{ marginBottom: 4 }} />
                            <Text style={styles.magnifierText}>Sampling...</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
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
                    <Text style={styles.colorPreviewName}>Name: {livePickedColor.name}</Text>
                    <Text style={styles.colorPreviewHex}>HEX: {livePickedColor.hex.toUpperCase()}</Text>
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
                      return;
                    }
                    
                    const imageToUse = originalProductImage.current || product?.image;
                    
                    if (!imageToUse) {
                      Alert.alert('Error', 'No product image available for color detection');
                      return;
                    }
                    
                    // Clear cache to force fresh detection
                    clearColorCache();
                    
                    setColorSource('auto-detected');
                    await autoDetectColor();
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
                  onPress={async () => {
                    if (userEnteredMaterial) {
                      const updatedProduct = {
                        ...product,
                        material: userEnteredMaterial,
                        fabric: userEnteredMaterial,
                        fabricStretch: hasStretch(userEnteredMaterial) ? getStretchLevel(userEnteredMaterial) : 'none',
                      };
                      // Update product state first
                      setProduct(updatedProduct);
                      // Close modal
                      setShowMaterialInputModal(false);
                      // Load insights immediately with updated product
                      await loadInsights(true, updatedProduct);
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
  bodyShapeLabel: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    fontStyle: 'italic',
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
  colorSummaryText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  colorMicroNote: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    fontStyle: 'italic',
  },
  lightingDisclaimer: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
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
  colorAutoDetectNote: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 4,
    fontStyle: 'italic',
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
  },
  colorHexText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ccc',
    marginTop: 2,
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
  // New square/circle cursor box for color picker
  colorPickerCursorBox: {
    position: 'absolute',
    width: 30,
    height: 30,
    zIndex: 10000, // Very high z-index to ensure visibility
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  colorPickerCursorOuter: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 15, // Circle
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 10, // Android shadow (higher for visibility)
  },
  colorPickerCursorInner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 2, // Thicker border for visibility
    borderColor: '#000000',
    borderRadius: 10, // Circle to match outer
    backgroundColor: 'transparent',
    left: 5, // Center within outer (30-20)/2 = 5
    top: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 8,
  },
  colorPickerCursorCenter: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    left: 13, // Center: (30-4)/2 = 13
    top: 13,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 10,
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
