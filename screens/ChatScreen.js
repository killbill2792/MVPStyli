import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, Dimensions, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, InputStyles, TextStyles, createButtonStyle, getButtonTextStyle, getColors } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ChatScreen({ onBack, onProductSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details! You can also upload images of clothing items for me to analyze.' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const chatScrollRef = useRef(null);
  const [showResults, setShowResults] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const insets = useSafeAreaInsets();

  // Bottom bar height calculation - BottomBar has SafeAreaView, so we only need content height
  // BottomBar: paddingTop(5) + paddingBottom(2) + inner paddingVertical(5*2) + button paddingVertical(8*2) ≈ 33px
  // Plus safe area is handled by BottomBar's SafeAreaView, so we don't add insets.bottom here
  // But we need to account for the actual rendered height including safe area padding
  const BOTTOM_BAR_CONTENT_HEIGHT = 33; // Content height only
  const INPUT_BAR_HEIGHT = 56; // Actual input bar height

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current && !showResults) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory, showResults]);

  // Enhanced natural language query processing
  const processQuery = (query) => {
    const lowerQuery = query.toLowerCase();
    
    const intent = {
      type: 'search',
      category: null,
      color: null,
      pattern: null,
      priceRange: null,
    };
    
    if (lowerQuery.includes('dress') || lowerQuery.includes('gown')) intent.category = 'dress';
    else if (lowerQuery.includes('shirt') || lowerQuery.includes('blouse') || lowerQuery.includes('top') || lowerQuery.includes('sweater') || lowerQuery.includes('jacket') || lowerQuery.includes('blazer')) intent.category = 'upper';
    else if (lowerQuery.includes('pants') || lowerQuery.includes('jeans') || lowerQuery.includes('trousers') || lowerQuery.includes('shorts')) intent.category = 'lower';
    else if (lowerQuery.includes('shoes') || lowerQuery.includes('sneakers') || lowerQuery.includes('boots')) intent.category = 'shoes';
    
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'grey', 'pink', 'purple', 'orange', 'brown', 'beige', 'navy'];
    for (const color of colors) {
      if (lowerQuery.includes(color)) {
        intent.color = color;
        break;
      }
    }
    
    if (lowerQuery.includes('polka dot') || lowerQuery.includes('polkadot')) intent.pattern = 'polka dot';
    else if (lowerQuery.includes('striped') || lowerQuery.includes('stripe')) intent.pattern = 'striped';
    else if (lowerQuery.includes('floral') || lowerQuery.includes('flower')) intent.pattern = 'floral';
    else if (lowerQuery.includes('plaid') || lowerQuery.includes('check')) intent.pattern = 'plaid';
    
    const priceMatch = lowerQuery.match(/(?:under|below|less than|max|maximum)\s*\$?(\d+)/i);
    if (priceMatch) {
      intent.priceRange = { max: parseInt(priceMatch[1]) };
    }
    
    if (lowerQuery.includes('what') && (lowerQuery.includes('suit') || lowerQuery.includes('fit') || lowerQuery.includes('look good'))) {
      intent.type = 'recommend';
    }
    
    return intent;
  };

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();
    
    if (!query && !uploadedImage) return;
    
    // Add user message to chat
    const userMessage = { type: 'user', message: query || 'Analyze this image', image: uploadedImage };
    setChatHistory(prev => [...prev, userMessage]);
    setSearchQuery('');
    setUploadedImage(null);
    setIsSearching(true);
    setShowResults(false);
    
    try {
      if (isUrl(query)) {
        // URL import
        const thinkingMessage = { type: 'ai', message: 'Analyzing product URL...' };
        setChatHistory(prev => [...prev, thinkingMessage]);
        
        try {
          const importedProduct = await importProductFromUrl(query);
          const normalized = normalizeProduct(importedProduct);
          
          const productForUI = {
            id: normalized.id || `imported-${Date.now()}`,
            name: normalized.title || normalized.name || 'Imported Product',
            title: normalized.title || normalized.name || 'Imported Product',
            price: normalized.price || 0,
            rating: normalized.rating || 4.0,
            brand: normalized.brand || normalized.sourceLabel || 'Online Store',
            category: normalized.category || 'upper',
            color: normalized.color || 'Mixed',
            material: normalized.material || 'Unknown',
            garment_des: normalized.garment_des || '',
            image: normalized.imageUrl || normalized.image || 'https://via.placeholder.com/400',
            buyUrl: normalized.productUrl || normalized.buyUrl,
            kind: normalized.kind || 'imported',
            sourceLabel: normalized.sourceLabel
          };
          
          if (!productForUI.image || productForUI.image === 'https://via.placeholder.com/400') {
            throw new Error('Product image could not be extracted from URL. Please try a different product page.');
          }
          
          setSearchResults([productForUI]);
          setSelectedProductIndex(0);
          setShowResults(true);
          
          const successMessage = { 
            type: 'ai', 
            message: `Found product: ${productForUI.name} by ${productForUI.brand} - $${productForUI.price}. Tap the image to view details!`
          };
          setChatHistory(prev => [...prev, successMessage]);
        } catch (urlError) {
          console.error('URL import error:', urlError);
          const errorMessage = { 
            type: 'ai', 
            message: `Sorry, I couldn't extract product information from that URL. Error: ${urlError.message || 'Please try a different product page or paste a direct product link.'}` 
          };
          setChatHistory(prev => [...prev, errorMessage]);
          setSearchResults([]);
        }
      } else {
        // Natural language search
        const intent = processQuery(query);
        
        let thinkingMsg = 'Searching for products...';
        if (intent.type === 'recommend') {
          thinkingMsg = 'Finding recommendations based on your preferences...';
        } else if (intent.color || intent.pattern) {
          thinkingMsg = `Looking for ${intent.color || ''} ${intent.pattern || ''} ${intent.category || 'items'}...`;
        }
        const thinkingMessage = { type: 'ai', message: thinkingMsg };
        setChatHistory(prev => [...prev, thinkingMessage]);
        
        try {
          const webProducts = await searchWebProducts(query);
          
          if (webProducts.length === 0) {
            const errorMessage = { 
              type: 'ai', 
              message: 'Sorry, I couldn\'t find any products matching your search. Try asking differently, like "show me red dresses" or paste a product URL.' 
            };
            setChatHistory(prev => [...prev, errorMessage]);
            setSearchResults([]);
          } else {
            const limitedProducts = webProducts.slice(0, 10);
            
            const productsForUI = limitedProducts.map(normalized => ({
              id: normalized.id || `web-${Date.now()}-${Math.random()}`,
              name: normalized.title || normalized.name || 'Product',
              title: normalized.title || normalized.name || 'Product',
              price: normalized.price || 0,
              rating: normalized.rating || 4.0,
              brand: normalized.brand || normalized.sourceLabel || 'Online Store',
              category: normalized.category || 'upper',
              color: normalized.color || 'Mixed',
              material: normalized.material || 'Unknown',
              garment_des: normalized.garment_des || '',
              image: normalized.imageUrl || normalized.image || 'https://via.placeholder.com/400',
              buyUrl: normalized.productUrl || normalized.buyUrl,
              kind: normalized.kind || 'web',
              sourceLabel: normalized.sourceLabel
            })).filter(p => p.image && p.image !== 'https://via.placeholder.com/400');
            
            if (productsForUI.length === 0) {
              const errorMessage = { 
                type: 'ai', 
                message: 'Found products but couldn\'t load images. Please try again.' 
              };
              setChatHistory(prev => [...prev, errorMessage]);
              setSearchResults([]);
            } else {
              setSearchResults(productsForUI);
              setSelectedProductIndex(0);
              setShowResults(true);
              
              const successMessage = { 
                type: 'ai', 
                message: `Found ${productsForUI.length} product${productsForUI.length > 1 ? 's' : ''} for you! Swipe through the thumbnails below to see all options.`
              };
              setChatHistory(prev => [...prev, successMessage]);
            }
          }
        } catch (searchError) {
          console.error('Search error:', searchError);
          const errorMessage = { 
            type: 'ai', 
            message: `Sorry, I encountered an error: ${searchError.message || 'Please try again or paste a product URL directly.'}` 
          };
          setChatHistory(prev => [...prev, errorMessage]);
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error('General error:', error);
      const errorMessage = { 
        type: 'ai', 
        message: `Sorry, something went wrong: ${error.message || 'Please try again.'}` 
      };
      setChatHistory(prev => [...prev, errorMessage]);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setUploadedImage(imageUri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleProductPress = (product) => {
    if (!product) {
      console.error('Product is null or undefined');
      Alert.alert('Error', 'Product information is missing. Please try again.');
      return;
    }
    
    const productWithDefaults = {
      ...product,
      id: product.id || `product-${Date.now()}-${Math.random()}`,
      kind: product.kind || 'web',
      name: product.name || product.title || 'Product',
      title: product.title || product.name || 'Product',
      price: product.price || 0,
      rating: product.rating || 4.0,
      brand: product.brand || product.sourceLabel || 'Online Store',
      category: product.category || 'upper',
      color: product.color || 'Mixed',
      material: product.material || 'Unknown',
      garment_des: product.garment_des || product.description || '',
      image: product.image || product.imageUrl || 'https://via.placeholder.com/400',
      buyUrl: product.buyUrl || product.productUrl || '',
      sourceLabel: product.sourceLabel || product.brand || 'Online Store'
    };
    
    if (!productWithDefaults.id || typeof productWithDefaults.id !== 'string') {
      productWithDefaults.id = String(productWithDefaults.id || `product-${Date.now()}-${Math.random()}`);
    }
    
    try {
      if (onProductSelect && typeof onProductSelect === 'function') {
        onProductSelect(productWithDefaults);
      } else {
        Alert.alert('Error', 'Navigation function not available. Please try again.');
      }
    } catch (error) {
      console.error('Error selecting product:', error);
      Alert.alert('Error', `Unable to view product: ${error.message || 'Unknown error'}`);
    }
  };

  const currentProduct = searchResults[selectedProductIndex];
  const thumbnailHeight = 70;
  const dynamicColors = getColors(); // Get dynamic colors for send button

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {showResults && searchResults.length > 0 ? (
          /* Explore-style Product View */
          <View style={{ flex: 1, position: 'relative' }}>
            <Pressable 
            onPress={() => handleProductPress(currentProduct)}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              bottom: 80 + thumbnailHeight,
              }}
            >
              <Image 
                source={{ uri: currentProduct.image }} 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  backgroundColor: Colors.backgroundSecondary
                }}
              resizeMode="contain"
              />
              
              <View style={{
                position: 'absolute',
              bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                padding: Spacing.md,
                paddingBottom: Spacing.sm,
              maxHeight: 130
              }}>
                <Text 
                  style={{ ...TextStyles.h3, color: Colors.textWhite, marginBottom: Spacing.xs }}
                  numberOfLines={1}
                >
                  {currentProduct.name}
                </Text>
                <Text style={{ ...TextStyles.body, color: Colors.textWhite, marginBottom: Spacing.xs }}>
                  {currentProduct.brand} • ${currentProduct.price}
                </Text>
                {currentProduct.rating && (
                  <Text style={{ ...TextStyles.caption, color: Colors.textWhite }}>
                    ⭐ {currentProduct.rating}
                  </Text>
                )}
                <Pressable 
                  onPress={() => handleProductPress(currentProduct)}
                  style={{
                    marginTop: Spacing.sm,
                    backgroundColor: Colors.primary,
                    padding: Spacing.sm,
                    borderRadius: BorderRadius.md,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ ...TextStyles.body, color: Colors.textWhite, fontWeight: Typography.semibold, fontSize: Typography.sm }}>
                    View Details →
                  </Text>
                </Pressable>
              </View>
            </Pressable>

          <View style={{
            position: 'absolute',
            bottom: BOTTOM_BAR_CONTENT_HEIGHT,
            left: 0,
            right: 0,
              backgroundColor: 'rgba(0,0,0,0.95)',
              paddingTop: Spacing.xs,
              paddingBottom: Spacing.xs,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              height: thumbnailHeight
            }}>
              <Text style={{ 
                ...TextStyles.small, 
                color: Colors.textWhite, 
                marginLeft: Spacing.md, 
                marginBottom: Spacing.xs,
                fontWeight: Typography.semibold,
                fontSize: Typography.xs
              }}>
                {searchResults.length} Result{searchResults.length > 1 ? 's' : ''}
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.md }}
              >
                {searchResults.map((product, index) => (
                  <Pressable
                    key={product.id || index}
                  onPress={() => setSelectedProductIndex(index)}
                    style={{
                      width: 50,
                      height: 50,
                      marginRight: Spacing.xs,
                      borderRadius: BorderRadius.sm,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: index === selectedProductIndex ? Colors.primary : 'rgba(255,255,255,0.3)'
                    }}
                  >
                    <Image 
                      source={{ uri: product.image }} 
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Chat Messages */
        <>
          <ScrollView 
            ref={chatScrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              padding: Spacing.lg,
              paddingBottom: INPUT_BAR_HEIGHT + BOTTOM_BAR_CONTENT_HEIGHT
            }}
            onContentSizeChange={() => {
              if (chatScrollRef.current && !showResults) {
                chatScrollRef.current.scrollToEnd({ animated: true });
              }
            }}
          >
            {chatHistory.map((msg, idx) => (
              <View key={idx} style={{ marginBottom: Spacing.lg }}>
                {msg.type === 'user' ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{
                      backgroundColor: Colors.primaryLight,
                      padding: Spacing.md,
                      borderRadius: BorderRadius.lg,
                      borderTopRightRadius: BorderRadius.sm,
                      maxWidth: '80%'
                    }}>
                      {msg.image && (
                        <Image 
                          source={{ uri: msg.image }} 
                          style={{ 
                            width: 200, 
                            height: 200, 
                            borderRadius: BorderRadius.md, 
                            marginBottom: Spacing.sm 
                          }} 
                          resizeMode="cover"
                        />
                      )}
                      <Text style={{ ...TextStyles.body, color: Colors.primary }}>
                        {msg.message}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'flex-start' }}>
                    <View style={{
                      backgroundColor: Colors.backgroundSecondary,
                      padding: Spacing.md,
                      borderRadius: BorderRadius.lg,
                      borderTopLeftRadius: BorderRadius.sm,
                      maxWidth: '85%'
                    }}>
                      <Text style={{ ...TextStyles.body, color: Colors.textPrimary }}>
                        {msg.message}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
            
            {isSearching && (
              <View style={{ alignItems: 'flex-start', marginBottom: Spacing.lg }}>
                <View style={{
                  backgroundColor: Colors.backgroundSecondary,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  borderTopLeftRadius: BorderRadius.sm,
                }}>
                  <Text style={{ ...TextStyles.body, color: Colors.textSecondary }}>
                    Searching...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Bar - Fixed at bottom, flush above nav bar */}
          <View style={{ 
            position: 'absolute',
            bottom: BOTTOM_BAR_CONTENT_HEIGHT,
            left: 0,
            right: 0,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.background,
          }}>
            <View style={{ 
              flexDirection: 'row', 
              gap: Spacing.xs, 
              alignItems: 'center',
            }}>
              {uploadedImage ? (
                <Pressable
                  onPress={() => setUploadedImage(null)}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: BorderRadius.sm,
                    overflow: 'hidden',
                  }}
                >
                  <Image 
                    source={{ uri: uploadedImage }} 
                    style={{ width: 36, height: 36 }} 
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: Colors.error,
                    borderRadius: 8,
                    width: 14,
                    height: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ color: Colors.textWhite, fontSize: 8 }}>×</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleImageUpload}
                  style={{
                    padding: Spacing.xs,
                    borderRadius: BorderRadius.sm,
                    backgroundColor: Colors.backgroundSecondary,
                    minWidth: 36,
                    minHeight: 36,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>📷</Text>
                </Pressable>
              )}
              <View style={{ ...InputStyles.container, flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, minHeight: 36 }}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                  placeholder="Ask me anything or paste a URL..."
                  placeholderTextColor={Colors.textSecondary}
                  style={{ flex: 1, ...InputStyles.text, paddingVertical: 0, fontSize: Typography.sm }}
                  returnKeyType="send"
                  multiline={false}
                />
              </View>
              <Pressable 
                onPress={handleSearchSubmit}
                disabled={isSearching || (!searchQuery.trim() && !uploadedImage)}
                style={{ 
                  backgroundColor: (isSearching || (!searchQuery.trim() && !uploadedImage)) ? Colors.backgroundSecondary : dynamicColors.primary,
                  paddingHorizontal: Spacing.md, 
                  paddingVertical: Spacing.xs,
                  minHeight: 36,
                  borderRadius: BorderRadius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: (isSearching || (!searchQuery.trim() && !uploadedImage)) ? Colors.textSecondary : Colors.textWhite,
                  fontSize: Typography.sm,
                  fontWeight: Typography.semibold,
                }}>
                  {isSearching ? '...' : 'Send'}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
