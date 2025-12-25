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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../lib/AppContext';
import { generateFitAdvice, generateSizeAdvice, generateStyleAdvice } from '../lib/askAI';
import { loadColorProfile } from '../lib/colorAnalysis';
import { supabase } from '../lib/supabase';
import { recommendSizeAndFit, toCm } from '../lib/fitLogic';
import { evaluateSuitability } from '../lib/styleSuitability';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;

const AskAISheet = ({ visible, onClose, product }) => {
  const { state, setRoute } = useApp();
  const { user } = state;
  
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(true);
  const [fitAdvice, setFitAdvice] = useState(null);
  const [sizeAdvice, setSizeAdvice] = useState(null);
  const [styleAdvice, setStyleAdvice] = useState(null);
  const [colorSuitability, setColorSuitability] = useState(null);
  const [bodyShapeSuitability, setBodyShapeSuitability] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false); // Client-side throttling
  const requestInProgress = useRef(false); // Prevent multiple simultaneous requests

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
      
      // Build user profile for fitLogic (size recommendations) - needs Cm suffix
      const userProfileForFitLogic = {
        heightCm: toCm(userProfileData?.height),
        weightKg: parseFloat(userProfileData?.weight) || null,
        chestCm: toCm(userProfileData?.chest),
        bustCm: toCm(userProfileData?.bust || userProfileData?.chest), // fallback
        waistCm: toCm(userProfileData?.waist),
        hipsCm: toCm(userProfileData?.hips),
        shoulderCm: toCm(userProfileData?.shoulder),
        inseamCm: toCm(userProfileData?.inseam),
        gender: userProfileData?.gender || null,
      };
      
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
      
      const productForFitLogic = {
        category: fitLogicCategory,
        name: product?.name || 'Item',
        fitType: product?.fit || product?.fitType || null,
        fabricStretch: product?.fabric?.toLowerCase().includes('stretch') || 
                      product?.fabric?.toLowerCase().includes('elastic') || 
                      product?.material?.toLowerCase().includes('stretch') || false,
        sizeChart: sizeChart,
      };
      
      // Use fitLogic for size recommendations (NO-AI)
      console.log('📏 Using fitLogic for size recommendations');
      const sizeRecommendation = recommendSizeAndFit(userProfileForFitLogic, productForFitLogic, {});
      console.log('📏 Size recommendation result:', sizeRecommendation);
      
      // Convert fitLogic result to UI format
      if (sizeRecommendation.status === 'OK') {
        setSizeAdvice({
          recommendedSize: sizeRecommendation.recommendedSize,
          backupSize: sizeRecommendation.backupSize,
          risk: sizeRecommendation.risk,
          confidence: sizeRecommendation.confidence,
          insights: sizeRecommendation.insights,
          hasEnoughData: true,
        });
      } else {
        setSizeAdvice({
          recommendedSize: null,
          backupSize: null,
          risk: sizeRecommendation.risk,
          confidence: sizeRecommendation.confidence,
          insights: sizeRecommendation.insights,
          hasEnoughData: false,
          missingDataMessage: sizeRecommendation.insights.join(' '),
        });
      }
      
      // Use styleSuitability for color and body shape (NO-AI)
      console.log('🎨 Using styleSuitability for color and body shape');
      const userProfileForSuitability = {
        undertone: colorProfile?.tone || userProfileData?.color_tone || null,
        season: colorProfile?.season || userProfileData?.color_season || null,
        bodyShape: userProfileData?.body_shape || null,
      };
      
      const productForSuitability = {
        primaryColor: product?.color || inferColor(product?.name) || null,
        category: fitLogicCategory, // Use same category mapping
        fitType: product?.fit || product?.fitType || null,
      };
      
      const suitability = evaluateSuitability(userProfileForSuitability, productForSuitability);
      console.log('🎨 Suitability result:', suitability);
      
      setColorSuitability(suitability.color);
      setBodyShapeSuitability(suitability.body);

      // Try to get AI-powered insights from API for fit and style
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
      
      if (API_BASE) {
        try {
          const requestBody = {
            userProfile,
            product: productInfo,
            userId: user?.id, // Pass userId for rate limiting and caching
            garment_id: product?.garment_id || product?.id, // If available
          };
          
          // Fetch fit and style insights in parallel (size is now handled by fitLogic)
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
          
          // Handle fit response
          if (fitResponse.ok) {
            const fitData = await fitResponse.json();
            console.log('📊 Fit response - cached:', fitData.cached, 'source:', fitData.source);
            if (fitData.cached) setIsCached(true);
            if (fitData.insights) {
              setFitAdvice(fitData.insights);
            } else if (fitData.error) {
              console.warn('⚠️ Fit API error:', fitData.error);
              if (fitData.errorCode === 'API_KEY_MISSING') {
                // Show user-friendly error
                setFitAdvice({ 
                  verdict: 'good_with_tweaks', 
                  verdictText: 'API key not configured', 
                  bodyAdvice: ['Please configure GEMINI_API_KEY in Vercel'], 
                  colorAdvice: [], 
                  hasEnoughData: false 
                });
              }
            }
          } else if (fitResponse.status === 429) {
            const errorData = await fitResponse.json();
            console.warn('⚠️ Rate limited:', errorData.message);
            alert(errorData.message || 'Please wait a moment before trying again.');
          } else {
            const errorText = await fitResponse.text();
            console.error('❌ Fit API error:', fitResponse.status, errorText);
          }
          
          // Handle style response
          if (styleResponse.ok) {
            const styleData = await styleResponse.json();
            console.log('📊 Style response - cached:', styleData.cached);
            if (styleData.cached) setIsCached(true);
            if (styleData.insights) {
              setStyleAdvice(styleData.insights);
            }
          } else if (styleResponse.status === 429) {
            // Already handled above
          } else {
            const errorText = await styleResponse.text();
            console.error('❌ Style API error:', styleResponse.status, errorText);
          }
          
        } catch (apiError) {
          console.log('AI API not available, using fallback:', apiError.message);
          // Fallback to local generation for fit/style
          const fit = generateFitAdvice(userProfile, productInfo);
          const style = generateStyleAdvice(userProfile, productInfo);
          setFitAdvice(fit);
          setStyleAdvice(style);
        }
      } else {
        // No API configured, use local fallback for fit/style
        const fit = generateFitAdvice(userProfile, productInfo);
        const style = generateStyleAdvice(userProfile, productInfo);
        setFitAdvice(fit);
        setStyleAdvice(style);
      }
      
    } catch (error) {
      console.error('Error loading AI insights:', error);
      // Set empty fallback
      setFitAdvice({ verdict: 'good_with_tweaks', verdictText: 'Unable to analyze', bodyAdvice: [], colorAdvice: [], hasEnoughData: false });
      setSizeAdvice({ recommendedSize: 'M', reasoning: ['Unable to determine'], returnRisk: 'medium', hasEnoughData: false });
      setStyleAdvice({ bestFor: ['Versatile'], stylingTips: ['Style as desired'], occasions: [] });
    } finally {
      setLoading(false);
      setIsRequesting(false);
      requestInProgress.current = false;
    }
  };
  
  // Fallback to local rule-based advice (for fit/style only, size uses fitLogic)
  const useFallbackAdvice = (userProfile, productInfo) => {
    const fit = generateFitAdvice(userProfile, productInfo);
    const style = generateStyleAdvice(userProfile, productInfo);
    setFitAdvice(fit);
    setStyleAdvice(style);
    // Size is already handled by fitLogic above
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
            <Text style={styles.headerTitle}>AI Style Insights</Text>
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
              {/* Section 1: Does this suit me? */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>👗</Text>
                  <Text style={styles.cardTitle}>Does this outfit suit me?</Text>
                </View>

                {!fitAdvice?.hasEnoughData ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>{fitAdvice?.missingDataMessage}</Text>
                    <Pressable 
                      style={styles.addDataBtn}
                      onPress={() => {
                        closeSheet();
                        setRoute('account');
                      }}
                    >
                      <Text style={styles.addDataBtnText}>Add Profile Info →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={[
                      styles.verdictBadge,
                      fitAdvice?.verdict === 'strong_match' && styles.verdictGood,
                      fitAdvice?.verdict === 'good_with_tweaks' && styles.verdictNeutral,
                      fitAdvice?.verdict === 'consider_alternatives' && styles.verdictWarning,
                    ]}>
                      <Text style={styles.verdictText}>{fitAdvice?.verdictText}</Text>
                    </View>

                    {fitAdvice?.bodyAdvice?.length > 0 && (
                      <View style={styles.adviceSection}>
                        <Text style={styles.adviceSectionTitle}>Body & Silhouette</Text>
                        {fitAdvice.bodyAdvice.map((advice, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {advice}</Text>
                        ))}
                      </View>
                    )}

                    {fitAdvice?.colorAdvice?.length > 0 && (
                      <View style={styles.adviceSection}>
                        <Text style={styles.adviceSectionTitle}>Color & Skin Tone</Text>
                        {fitAdvice.colorAdvice.map((advice, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {advice}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 2: What size should I buy? */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>📏</Text>
                  <Text style={styles.cardTitle}>What size should I buy?</Text>
                </View>

                {!sizeAdvice?.hasEnoughData ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>{sizeAdvice?.missingDataMessage || sizeAdvice?.insights?.join(' ') || 'Not enough data for size recommendation'}</Text>
                    <Pressable 
                      style={styles.addDataBtn}
                      onPress={() => {
                        closeSheet();
                        setRoute('account');
                      }}
                    >
                      <Text style={styles.addDataBtnText}>Add Measurements →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.sizeRecommendation}>
                      <Text style={styles.sizeLabel}>Recommended Size:</Text>
                      <View style={styles.sizeBadge}>
                        <Text style={styles.sizeText}>{sizeAdvice?.recommendedSize || 'N/A'}</Text>
                      </View>
                      {sizeAdvice?.backupSize && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.backupSize}>Backup Size: {sizeAdvice.backupSize}</Text>
                        </View>
                      )}
                    </View>

                    {sizeAdvice?.confidence != null && (
                      <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceLabel}>Confidence:</Text>
                        <Text style={styles.confidenceText}>{sizeAdvice.confidence}%</Text>
                      </View>
                    )}

                    <View style={[
                      styles.riskBadge,
                      sizeAdvice?.risk === 'low' && styles.riskLow,
                      sizeAdvice?.risk === 'medium' && styles.riskMedium,
                      sizeAdvice?.risk === 'high' && styles.riskHigh,
                    ]}>
                      <Text style={styles.riskLabel}>Risk:</Text>
                      <Text style={styles.riskText}>
                        {sizeAdvice?.risk === 'low' && '🟢 Low'}
                        {sizeAdvice?.risk === 'medium' && '🟡 Medium'}
                        {sizeAdvice?.risk === 'high' && '🔴 High'}
                      </Text>
                    </View>

                    {sizeAdvice?.insights && sizeAdvice.insights.length > 0 && (
                      <View style={styles.insightsSection}>
                        <Text style={styles.insightsTitle}>Insights:</Text>
                        {sizeAdvice.insights.map((insight, idx) => (
                          <Text key={idx} style={styles.insightItem}>• {insight}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 3: Color Suitability */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>🎨</Text>
                  <Text style={styles.cardTitle}>Color</Text>
                </View>

                {colorSuitability?.status === 'INSUFFICIENT_DATA' ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>{colorSuitability.reasons?.[0] || 'Set your Color Profile'}</Text>
                    <Pressable 
                      style={styles.addDataBtn}
                      onPress={() => {
                        closeSheet();
                        setRoute('account');
                      }}
                    >
                      <Text style={styles.addDataBtnText}>Set Color Profile →</Text>
                    </Pressable>
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
                        {colorSuitability.reasons.map((reason, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {reason}</Text>
                        ))}
                      </View>
                    )}

                    {colorSuitability?.alternatives && colorSuitability.alternatives.length > 0 && (
                      <View style={styles.alternativesSection}>
                        <Text style={styles.alternativesTitle}>Alternatives:</Text>
                        {colorSuitability.alternatives.map((alt, idx) => (
                          <Text key={idx} style={styles.alternativeItem}>💡 {alt}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 4: Body Shape Suitability */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>👗</Text>
                  <Text style={styles.cardTitle}>Body Shape</Text>
                </View>

                {bodyShapeSuitability?.status === 'INSUFFICIENT_DATA' ? (
                  <View style={styles.missingDataBox}>
                    <Text style={styles.missingDataText}>{bodyShapeSuitability.reasons?.[0] || 'Set your Body Shape'}</Text>
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
                        {bodyShapeSuitability?.verdict === 'ok' && '⚡ OK'}
                        {bodyShapeSuitability?.verdict === 'neutral' && '⚡ Neutral'}
                        {bodyShapeSuitability?.verdict === 'risky' && '⚠️ Risky'}
                      </Text>
                    </View>

                    {bodyShapeSuitability?.reasons && bodyShapeSuitability.reasons.length > 0 && (
                      <View style={styles.adviceSection}>
                        {bodyShapeSuitability.reasons.map((reason, idx) => (
                          <Text key={idx} style={styles.adviceItem}>• {reason}</Text>
                        ))}
                      </View>
                    )}

                    {bodyShapeSuitability?.alternatives && bodyShapeSuitability.alternatives.length > 0 && (
                      <View style={styles.alternativesSection}>
                        <Text style={styles.alternativesTitle}>Styling Tip:</Text>
                        {bodyShapeSuitability.alternatives.map((alt, idx) => (
                          <Text key={idx} style={styles.alternativeItem}>💡 {alt}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section 5: How should I wear this? */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>💡</Text>
                  <Text style={styles.cardTitle}>How should I wear this?</Text>
                </View>

                {styleAdvice?.bestFor?.length > 0 && (
                  <View style={styles.bestForSection}>
                    <Text style={styles.bestForLabel}>Best for:</Text>
                    <View style={styles.tagRow}>
                      {styleAdvice.bestFor.map((item, idx) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {styleAdvice?.occasions?.length > 0 && (
                  <View style={styles.occasionsSection}>
                    <Text style={styles.occasionsLabel}>Occasions:</Text>
                    <Text style={styles.occasionsText}>{styleAdvice.occasions.join(' • ')}</Text>
                  </View>
                )}

                {styleAdvice?.stylingTips?.length > 0 && (
                  <View style={styles.tipsSection}>
                    <Text style={styles.tipsTitle}>Styling Tips</Text>
                    {styleAdvice.stylingTips.map((tip, idx) => (
                      <Text key={idx} style={styles.tipItem}>💫 {tip}</Text>
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
});

export default AskAISheet;
