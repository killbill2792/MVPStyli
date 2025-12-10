import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, TextInput, Alert, Dimensions, Modal, FlatList, Animated, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/AppContext';
import { Colors } from '../lib/designSystem';
import { trackEvent } from '../lib/styleEngine';
import { LinearGradient } from 'expo-linear-gradient';
import BottomBar from '../components/BottomBar';
import AskAISheet from '../components/AskAISheet';

const { width, height } = Dimensions.get('window');

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

const ProductScreen = () => {
  const { state, setRoute, setPriceTracking, setCurrentProduct } = useApp();
  const { currentProduct, priceTracking, user, routeParams } = state;
  const insets = useSafeAreaInsets();
  const [targetPrice, setTargetPrice] = useState('');
  const [isTrackPriceOpen, setIsTrackPriceOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAISheet, setShowAISheet] = useState(false);

  // ALWAYS use currentProduct as the source of truth
  // routeParams?.product is only used to initially SET currentProduct
  const product = currentProduct;

  // When navigating with routeParams, update currentProduct
  useEffect(() => {
    if (routeParams?.product && setCurrentProduct) {
      console.log('🔄 Updating currentProduct from routeParams:', routeParams.product?.name);
      setCurrentProduct(routeParams.product);
    }
  }, [routeParams?.product?.id]);

  // Generate image gallery - use multiple images if available
  const images = product?.images || (product?.image ? [product.image] : []);
  
  // Infer product attributes from name/description
  const inferredCategory = inferCategory(product?.name || product?.description);
  const inferredColor = inferColor(product?.name || product?.description);
  const inferredFabric = inferFabric(product?.description);

  // Get tracking state for current product
  const trackingData = product?.id ? priceTracking?.[product.id] : null;
  const isTracking = !!trackingData;
  const trackedPrice = trackingData?.price || null;

  // Track view event when product changes
  useEffect(() => {
    if (product && user?.id) {
      console.log('📊 Tracking product view:', product?.name);
      trackEvent(user.id, 'product_view', product);
    }
  }, [product?.id]);

  if (!product) return null;

  const handleTrackPrice = () => {
    if (!targetPrice && !isTracking) {
      setIsTrackPriceOpen(!isTrackPriceOpen);
      return;
    }
    
    if (targetPrice) {
      // Set new tracking
      if (setPriceTracking && product?.id) {
        setPriceTracking({
          ...priceTracking,
          [product.id]: { price: targetPrice, productId: product.id }
        });
        setTargetPrice('');
        setIsTrackPriceOpen(false);
      }
    } else if (isTracking) {
      // Remove tracking
      if (setPriceTracking && product?.id) {
        const newTracking = { ...priceTracking };
        delete newTracking[product.id];
        setPriceTracking(newTracking);
        setIsTrackPriceOpen(false);
      }
    }
  };

  const BOTTOM_BAR_HEIGHT = 80;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Image Gallery Card */}
        <View style={[styles.imageContainer, { marginTop: insets.top + 10 }]}>
          {images.length > 1 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                  setCurrentImageIndex(newIndex);
                }}
              >
                {images.map((img, idx) => (
                  <Pressable 
                    key={idx} 
                    onPress={() => setShowFullImage(true)}
                    style={{ width: width, height: 500 }}
                  >
                    <SafeImage source={{ uri: img }} style={styles.image} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
              
              {/* Dots Indicator */}
              <View style={styles.dotsContainer}>
                {images.map((_, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.dot,
                      currentImageIndex === idx && styles.dotActive
                    ]} 
                  />
                ))}
              </View>
              
              {/* Image Counter */}
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>{currentImageIndex + 1}/{images.length}</Text>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setShowFullImage(true)} style={{ flex: 1 }}>
              <SafeImage source={{ uri: images[0] }} style={styles.image} resizeMode="cover" />
            </Pressable>
          )}
          
          {/* Back Button */}
          <Pressable onPress={() => setRoute('shop')} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>

          {/* Add to Cart Overlay (Bottom Right) */}
          <Pressable 
            style={styles.addToCartOverlay}
            onPress={() => Alert.alert('Added to cart')}
          >
            <Text style={{ fontSize: 20 }}>🛒</Text>
          </Pressable>
        </View>

        {/* Product Details Card */}
        <View style={styles.content}>
          {/* Header: Brand, Name, Price */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>{product.brand || 'Brand'}</Text>
              <Text style={styles.name}>{product.name}</Text>
            </View>
            <View style={styles.priceContainer}>
              {product.originalPrice && product.originalPrice > product.price && (
                <Text style={styles.originalPrice}>${product.originalPrice}</Text>
              )}
              <Text style={styles.price}>${product.price}</Text>
            </View>
          </View>

          {/* Product Tags */}
          <View style={styles.tagsRow}>
            {inferredCategory && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{inferredCategory}</Text>
              </View>
            )}
            {inferredColor && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{inferredColor}</Text>
              </View>
            )}
            {inferredFabric && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{inferredFabric}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtnPrimary} onPress={() => {
              // Track intent
              if (user?.id) {
                trackEvent(user.id, 'tryon_attempt', product);
              }
              // Ensure currentProduct is set before navigating to try-on
              if (setCurrentProduct) {
                setCurrentProduct(product);
              }
              setRoute('tryon');
            }}>
              <Text style={styles.actionBtnTextPrimary}>✨ Try On</Text>
            </Pressable>
            <Pressable style={styles.actionBtnSecondary} onPress={() => setRoute('createpod')}>
              <Text style={styles.actionBtnTextSecondary}>💬 Ask Pod</Text>
            </Pressable>
            <Pressable style={styles.actionBtnGradient} onPress={() => setShowAISheet(true)}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradientInner}
              >
                <Text style={styles.actionBtnTextGradient}>✨ AI</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Track Price Section */}
          <Pressable 
            style={[styles.trackPriceContainer, isTracking && styles.trackPriceContainerActive]} 
            onPress={() => setIsTrackPriceOpen(!isTrackPriceOpen)}
          >
            <View style={styles.trackPriceHeader}>
              <View style={{ flex: 1 }}>
                {isTracking ? (
                  <View>
                    <Text style={styles.trackPriceLabelActive}>🔔 Tracking Price</Text>
                    <Text style={styles.trackPriceValue}>Alert set at ${trackedPrice}</Text>
                  </View>
                ) : (
                  <Text style={styles.trackPriceLabel}>🔔 Track Price Drop</Text>
                )}
              </View>
              <Text style={styles.trackPriceArrow}>{isTrackPriceOpen ? '▲' : '▼'}</Text>
            </View>
            
            {isTrackPriceOpen && (
              <View style={styles.trackPriceInputRow}>
                {!isTracking ? (
                  <>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Target price ($)"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={targetPrice}
                      onChangeText={setTargetPrice}
                    />
                    <Pressable style={styles.setAlertBtn} onPress={handleTrackPrice}>
                      <Text style={styles.setAlertText}>Set</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable style={styles.removeAlertBtn} onPress={handleTrackPrice}>
                    <Text style={styles.removeAlertText}>Remove Alert</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>

          {/* Description */}
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            {product.garment_des || product.description || "A premium quality item that fits perfectly with your style. Made from high-quality materials designed for comfort and durability."}
          </Text>

          {/* Product Details */}
          {(product.fabric || product.fit || product.length || inferredFabric) && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Product Details</Text>
              <View style={styles.detailsGrid}>
                {(product.fabric || inferredFabric) && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Material</Text>
                    <Text style={styles.detailValue}>{product.fabric || inferredFabric}</Text>
                  </View>
                )}
                {product.fit && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Fit</Text>
                    <Text style={styles.detailValue}>{product.fit}</Text>
                  </View>
                )}
                {product.length && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Length</Text>
                    <Text style={styles.detailValue}>{product.length}</Text>
                  </View>
                )}
                {inferredCategory && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{inferredCategory}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Size & Fit Section */}
          <View style={styles.divider} />
          <View style={styles.sizeFitSection}>
            <Text style={styles.sectionTitle}>Size & Fit</Text>
            {product.sizeChart ? (
              <View style={styles.sizeChartContainer}>
                <Text style={styles.sizeChartTitle}>Size Chart</Text>
                {/* Render size chart if available */}
                <View style={styles.sizeChartGrid}>
                  {Object.entries(product.sizeChart).slice(0, 4).map(([size, measurements]) => (
                    <View key={size} style={styles.sizeChartItem}>
                      <Text style={styles.sizeChartSize}>{size}</Text>
                      <Text style={styles.sizeChartMeasure}>
                        {measurements.bust && `B: ${measurements.bust}`}
                        {measurements.waist && ` W: ${measurements.waist}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.sizeHelpBox}>
                <Text style={styles.sizeHelpText}>
                  📏 Not sure about your size? Tap "AI" above for personalized size recommendations based on your measurements.
                </Text>
                <Pressable 
                  style={styles.askAISizeBtn}
                  onPress={() => setShowAISheet(true)}
                >
                  <Text style={styles.askAISizeText}>Get My Size →</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* View Original */}
          {(product.buyUrl || product.productUrl || product.url) && (
            <Pressable 
              style={styles.viewOriginalBtn}
              onPress={() => Linking.openURL(product.buyUrl || product.productUrl || product.url)}
            >
              <Text style={styles.viewOriginalText}>View Original Product ↗</Text>
            </Pressable>
          )}

        </View>

      </ScrollView>
      
      <BottomBar route="shop" go={setRoute} />

      {/* Full Screen Image Modal - Explore Style */}
      <Modal visible={showFullImage} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
              <View style={styles.modalImageContainer}>
                  {images.length > 1 ? (
                    <FlatList
                      data={images}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      initialScrollIndex={currentImageIndex}
                      getItemLayout={(data, index) => ({
                        length: width - 20,
                        offset: (width - 20) * index,
                        index,
                      })}
                      renderItem={({ item }) => (
                        <SafeImage source={{ uri: item }} style={styles.fullImage} resizeMode="contain" />
                      )}
                      keyExtractor={(item, idx) => idx.toString()}
                    />
                  ) : (
                    <SafeImage source={{ uri: images[0] }} style={styles.fullImage} resizeMode="contain" />
                  )}
                  
                  {/* Top Overlay */}
                  <LinearGradient
                      colors={['rgba(0,0,0,0.6)', 'transparent']}
                      style={styles.modalTopOverlay}
                  >
                      <Pressable style={styles.modalCloseBtn} onPress={() => setShowFullImage(false)}>
                          <Text style={styles.modalCloseText}>✕</Text>
                      </Pressable>
                  </LinearGradient>
              </View>
          </View>
      </Modal>

      {/* AI Insights Bottom Sheet */}
      <AskAISheet 
        visible={showAISheet}
        onClose={() => setShowAISheet(false)}
        product={{
          ...product,
          category: inferredCategory,
          color: inferredColor,
          fabric: inferredFabric
        }}
      />
    </View>
  );
};

// Helper functions to infer product attributes
function inferCategory(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.includes('dress')) return 'Dress';
  if (lower.includes('top') || lower.includes('blouse') || lower.includes('shirt') || lower.includes('tee')) return 'Top';
  if (lower.includes('pant') || lower.includes('trouser') || lower.includes('jean') || lower.includes('denim')) return 'Pants';
  if (lower.includes('skirt')) return 'Skirt';
  if (lower.includes('jacket') || lower.includes('coat') || lower.includes('blazer')) return 'Outerwear';
  if (lower.includes('sweater') || lower.includes('cardigan') || lower.includes('knit')) return 'Knitwear';
  if (lower.includes('jumpsuit') || lower.includes('romper')) return 'Jumpsuit';
  return '';
}

function inferColor(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const colors = [
    { name: 'Black', keywords: ['black'] },
    { name: 'White', keywords: ['white', 'ivory', 'cream'] },
    { name: 'Red', keywords: ['red', 'burgundy', 'wine', 'crimson'] },
    { name: 'Blue', keywords: ['blue', 'navy', 'cobalt', 'denim'] },
    { name: 'Green', keywords: ['green', 'olive', 'emerald', 'sage'] },
    { name: 'Pink', keywords: ['pink', 'blush', 'rose', 'coral'] },
    { name: 'Yellow', keywords: ['yellow', 'gold', 'mustard'] },
    { name: 'Orange', keywords: ['orange', 'rust', 'terracotta'] },
    { name: 'Purple', keywords: ['purple', 'violet', 'lavender', 'plum'] },
    { name: 'Brown', keywords: ['brown', 'tan', 'camel', 'beige', 'khaki'] },
    { name: 'Grey', keywords: ['grey', 'gray', 'charcoal'] },
  ];
  
  for (const color of colors) {
    if (color.keywords.some(kw => lower.includes(kw))) {
      return color.name;
    }
  }
  return '';
}

function inferFabric(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const fabrics = ['cotton', 'linen', 'silk', 'satin', 'wool', 'cashmere', 'polyester', 'viscose', 'rayon', 'leather', 'denim', 'velvet', 'chiffon'];
  
  for (const fabric of fabrics) {
    if (lower.includes(fabric)) {
      return fabric.charAt(0).toUpperCase() + fabric.slice(1);
    }
  }
  return '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    height: 500,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -2,
  },
  addToCartOverlay: {
    position: 'absolute',
    bottom: 50,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  content: {
    padding: 20,
    paddingTop: 30,
    marginTop: -40,
    backgroundColor: '#000',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brand: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 28,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 14,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  price: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tagText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionBtnPrimary: {
    flex: 2,
    backgroundColor: '#fff',
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnTextPrimary: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnSecondary: {
    flex: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnTextSecondary: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  actionBtnGradient: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  actionBtnGradientInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnTextGradient: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  trackPriceContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trackPriceContainerActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  trackPriceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  trackPriceLabel: {
    color: '#fbbf24',
    fontWeight: '600',
    fontSize: 14,
  },
  trackPriceLabelActive: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  trackPriceValue: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  trackPriceArrow: {
    color: '#666',
    fontSize: 12,
  },
  trackPriceInputRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  priceInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  setAlertBtn: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setAlertText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 13,
  },
  removeAlertBtn: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  removeAlertText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#d4d4d8',
    lineHeight: 24,
    marginBottom: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  sizeFitSection: {
    marginBottom: 20,
  },
  sizeChartContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  sizeChartTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  sizeChartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChartItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  sizeChartSize: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sizeChartMeasure: {
    color: '#9ca3af',
    fontSize: 10,
  },
  sizeHelpBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  sizeHelpText: {
    color: '#a5b4fc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  viewOriginalBtn: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  viewOriginalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  askAISizeBtn: {
    alignSelf: 'flex-start',
  },
  askAISizeText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: width - 20,
    height: height - 120,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  fullImage: {
    width: width - 20,
    height: height - 120,
  },
  modalTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 50,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default ProductScreen;
