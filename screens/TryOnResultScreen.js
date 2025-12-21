import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../lib/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/styleEngine';
import AskAISheet from '../components/AskAISheet';

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

const { width, height } = Dimensions.get('window');

const TryOnResultScreen = () => {
  const { state, setRoute, setSavedFits, setBannerMessage, setBannerType, setCurrentProduct } = useApp();
  const { processingResult, currentProduct, user, savedFits, tryOnHistory, routeParams } = state;
  
  // State for AI Sheet
  const [showAISheet, setShowAISheet] = useState(false);
  
  // Determine product to display - Robust fallback
  const displayProduct = routeParams?.product || currentProduct || (tryOnHistory && processingResult ? 
    tryOnHistory.find(item => item.resultUrl === processingResult) : null);
  
  // Determine image URL for thumbnail
  let originalImageUrl = displayProduct?.image || displayProduct?.productImage || displayProduct?.product_image;
  
  // Debug logging
  useEffect(() => {
    console.log('TryOnResultScreen Debug:', {
        processingResult: processingResult ? 'Yes' : 'No',
        displayProduct: displayProduct,
        originalImageUrl: originalImageUrl,
        routeParams: routeParams
    });
  }, [processingResult, displayProduct, originalImageUrl]);

  // If still no image, try to find it in tryOnHistory
  if (!originalImageUrl && tryOnHistory && processingResult) {
    const match = tryOnHistory.find(t => t.resultUrl === processingResult);
    if (match) originalImageUrl = match.productImage || match.image;
  }

  // If currentProduct is missing but we have processingResult, try to find it in tryOnHistory
  useEffect(() => {
    if (!currentProduct && processingResult && tryOnHistory) {
      const matchingTryOn = tryOnHistory.find(item => item.resultUrl === processingResult);
      if (matchingTryOn && (matchingTryOn.productImage || matchingTryOn.image)) {
        setCurrentProduct({
          name: matchingTryOn.productName,
          image: matchingTryOn.productImage || matchingTryOn.image,
          url: matchingTryOn.productUrl,
          link: matchingTryOn.productUrl
        });
      }
    }
  }, [processingResult, currentProduct, tryOnHistory]);

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

  if (!processingResult) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No result available.</Text>
        <Pressable onPress={() => setRoute('tryon')} style={styles.btn}>
          <Text style={styles.btnText}>Back to Try On</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full Screen Image Layout */}
      <View style={styles.imageContainer}>
        <SafeImage source={{ uri: processingResult }} style={styles.image} resizeMode="cover" />
        
        {/* Top Overlay */}
        <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent']}
            style={styles.topOverlay}
        >
            <View style={styles.badge}>
                <Text style={styles.badgeText}>✨ Try-On Result</Text>
            </View>
        </LinearGradient>
            
        {/* Product Thumbnail */}
        {originalImageUrl ? (
            <Pressable 
              style={styles.productThumbnail}
              onPress={() => {
              const productToUse = displayProduct || { name: 'Original Item' };
              const productData = {
                  name: productToUse.name || productToUse.productName || 'Original Item',
                  image: originalImageUrl,
                  url: productToUse.url || productToUse.productUrl || productToUse.link,
                  price: productToUse.price
              };
              setRoute('product', { product: productData });
              }}
            >
            <SafeImage 
              source={{ uri: originalImageUrl }} 
                style={styles.productThumbImage} 
              resizeMode="contain" 
              />
              <View style={styles.productThumbBadge}>
                <Text style={styles.productThumbText}>Original</Text>
              </View>
            </Pressable>
        ) : null}

        {/* Bottom Overlay with Action Buttons */}
        <LinearGradient 
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          style={styles.bottomOverlay}
        >
          {/* Product Name */}
          {displayProduct?.name && (
            <Text style={styles.productName}>{displayProduct.name}</Text>
          )}
          
          {/* Main Action Buttons - AI Insights & Ask Pod */}
          <View style={styles.actions}>
            <Pressable 
                style={styles.aiInsightsBtn}
                onPress={() => setShowAISheet(true)}
            >
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiInsightsGradient}
                >
                  <Text style={styles.aiInsightsText}>✨ AI Insights</Text>
                </LinearGradient>
            </Pressable>
            <Pressable 
                style={styles.askPodBtn}
                onPress={() => setRoute('createpod', { imageUrl: processingResult, product: currentProduct })}
            >
                <Text style={styles.askPodText}>💬 Ask Pod</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
      
      {/* Close Button */}
      <Pressable style={styles.closeBtn} onPress={() => setRoute('tryon')}>
        <Text style={{ color: '#fff', fontSize: 24 }}>✕</Text>
      </Pressable>

      {/* AI Insights Bottom Sheet */}
      <AskAISheet 
        visible={showAISheet}
        onClose={() => setShowAISheet(false)}
        product={displayProduct || currentProduct}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: width - 20,
    height: height - 120,
    marginHorizontal: 10,
    marginTop: 60,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
  },
  productThumbnail: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 75,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  productThumbImage: {
    width: '100%',
    height: '85%',
    resizeMode: 'contain',
    backgroundColor: '#fff',
  },
  productThumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productThumbText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  productName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  aiInsightsBtn: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  aiInsightsGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  askPodBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  askPodText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#fff' },
  btn: { padding: 20, backgroundColor: '#333' },
  btnText: { color: '#fff' }
});

export default TryOnResultScreen;
