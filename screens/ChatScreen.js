import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, ButtonStyles, CardStyles, InputStyles, TextStyles, createButtonStyle, getButtonTextStyle } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ChatScreen({ onBack, onProductSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details!' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const chatScrollRef = useRef(null);
  const [showResults, setShowResults] = useState(false);
  const insets = useSafeAreaInsets();

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
    
    if (!query) return;
    
    // Add user message to chat
    const userMessage = { type: 'user', message: query };
    setChatHistory(prev => [...prev, userMessage]);
    setSearchQuery('');
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
          
          // Ensure required fields
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
            // Limit to 10 results
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
            })).filter(p => p.image && p.image !== 'https://via.placeholder.com/400'); // Filter out products without images
            
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

  const handleProductPress = (product) => {
    if (!product || !product.id) {
      console.error('Invalid product:', product);
      return;
    }
    
    try {
      if (onProductSelect) {
        onProductSelect(product);
      }
    } catch (error) {
      console.error('Error selecting product:', error);
    }
  };

  const currentProduct = searchResults[selectedProductIndex];
  const bottomBarHeight = 70; // Approximate height of bottom nav bar
  const thumbnailHeight = 80; // Height of thumbnail strip (reduced)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={[]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header - Minimal spacing */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingTop: Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          backgroundColor: Colors.background
        }}>
          <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
            <Text style={{ ...TextStyles.body, color: Colors.primary, fontSize: Typography.base }}>← Back</Text>
          </Pressable>
          <Text style={{ ...TextStyles.h3, flex: 1 }}>AI Shopping Assistant</Text>
        </View>

        {showResults && searchResults.length > 0 ? (
          /* Explore-style Product View */
          <View style={{ flex: 1 }}>
            {/* Main Product Image */}
            <Pressable 
              onPress={() => handleProductPress(currentProduct)}
              style={{ flex: 1, position: 'relative' }}
            >
              <Image 
                source={{ uri: currentProduct.image }} 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  backgroundColor: Colors.backgroundSecondary
                }}
                resizeMode="cover"
              />
              
              {/* Product Info Overlay - Above thumbnails */}
              <View style={{
                position: 'absolute',
                bottom: thumbnailHeight + Spacing.sm, // Above thumbnail strip with gap
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0,0,0,0.75)',
                padding: Spacing.md,
                paddingBottom: Spacing.sm
              }}>
                <Text style={{ ...TextStyles.h3, color: Colors.textWhite, marginBottom: Spacing.xs }}>
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
                    marginTop: Spacing.md,
                    backgroundColor: Colors.primary,
                    padding: Spacing.md,
                    borderRadius: BorderRadius.md,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ ...TextStyles.body, color: Colors.textWhite, fontWeight: Typography.semibold }}>
                    View Details →
                  </Text>
                </Pressable>
              </View>
            </Pressable>

            {/* Thumbnail Strip - At absolute bottom of image, above nav bar */}
            <View style={{
              position: 'absolute',
              bottom: bottomBarHeight + insets.bottom + Spacing.xs, // At absolute bottom, just above nav bar
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.95)',
              paddingVertical: Spacing.xs,
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
                    onPress={() => {
                      setSelectedProductIndex(index);
                    }}
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
          <ScrollView 
            ref={chatScrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}
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
        )}

        {/* Input Bar - Above nav bar */}
        <View style={{ 
          padding: Spacing.lg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.background,
          paddingBottom: bottomBarHeight + insets.bottom + Spacing.md // Space above nav bar
        }}>
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <View style={{ ...InputStyles.container, flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                placeholder="Ask me anything or paste a URL..."
                placeholderTextColor={Colors.textSecondary}
                style={{ flex: 1, ...InputStyles.text }}
                returnKeyType="send"
                multiline={false}
              />
            </View>
            <Pressable 
              onPress={handleSearchSubmit}
              disabled={isSearching || !searchQuery.trim()}
              style={createButtonStyle('primary', isSearching || !searchQuery.trim())}
            >
              <Text style={getButtonTextStyle('primary')}>
                {isSearching ? '...' : 'Send'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
