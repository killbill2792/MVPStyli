import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, ButtonStyles, CardStyles, InputStyles, TextStyles, createButtonStyle, getButtonTextStyle } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';

export default function ChatScreen({ onBack, onProductSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details!' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const chatScrollRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

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
    
    try {
      if (isUrl(query)) {
        // URL import
        const thinkingMessage = { type: 'ai', message: 'Analyzing product URL...' };
        setChatHistory(prev => [...prev, thinkingMessage]);
        
        const importedProduct = await importProductFromUrl(query);
        const normalized = normalizeProduct(importedProduct);
        
        const productForUI = {
          id: normalized.id,
          name: normalized.title || normalized.name,
          title: normalized.title || normalized.name,
          price: normalized.price || 0,
          rating: normalized.rating || 4.0,
          brand: normalized.brand || normalized.sourceLabel || 'Online Store',
          category: normalized.category || 'upper',
          color: normalized.color || 'Mixed',
          material: normalized.material || 'Unknown',
          garment_des: normalized.garment_des || '',
          image: normalized.imageUrl || normalized.image,
          buyUrl: normalized.productUrl || normalized.buyUrl,
          kind: normalized.kind,
          sourceLabel: normalized.sourceLabel
        };
        
        setSearchResults([productForUI]);
        
        const successMessage = { 
          type: 'ai', 
          message: `Found product: ${productForUI.name} by ${productForUI.brand} - $${productForUI.price}. Tap to view details!`,
          product: productForUI
        };
        setChatHistory(prev => [...prev, successMessage]);
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
        
        const webProducts = await searchWebProducts(query);
        
        if (webProducts.length === 0) {
          const errorMessage = { 
            type: 'ai', 
            message: 'Sorry, I couldn\'t find any products matching your search. Try asking differently, like "show me red dresses" or paste a product URL.' 
          };
          setChatHistory(prev => [...prev, errorMessage]);
          setSearchResults([]);
        } else {
          const productsForUI = webProducts.map(normalized => ({
            id: normalized.id,
            name: normalized.title || normalized.name,
            title: normalized.title || normalized.name,
            price: normalized.price || 0,
            rating: normalized.rating || 4.0,
            brand: normalized.brand || normalized.sourceLabel || 'Online Store',
            category: normalized.category || 'upper',
            color: normalized.color || 'Mixed',
            material: normalized.material || 'Unknown',
            garment_des: normalized.garment_des || '',
            image: normalized.imageUrl || normalized.image,
            buyUrl: normalized.productUrl || normalized.buyUrl,
            kind: normalized.kind,
            sourceLabel: normalized.sourceLabel
          }));
          
          setSearchResults(productsForUI);
          
          const successMessage = { 
            type: 'ai', 
            message: `Found ${productsForUI.length} product${productsForUI.length > 1 ? 's' : ''} for you!`,
            products: productsForUI
          };
          setChatHistory(prev => [...prev, successMessage]);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = { 
        type: 'ai', 
        message: `Sorry, I encountered an error: ${error.message || 'Please try again or paste a product URL directly.'}` 
      };
      setChatHistory(prev => [...prev, errorMessage]);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleProductPress = (product) => {
    if (onProductSelect) {
      onProductSelect(product);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: Spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border
        }}>
          <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
            <Text style={{ ...TextStyles.body, color: Colors.primary, fontSize: Typography.base }}>← Back</Text>
          </Pressable>
          <Text style={{ ...TextStyles.h3, flex: 1 }}>AI Shopping Assistant</Text>
        </View>

        {/* Chat Messages */}
        <ScrollView 
          ref={chatScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.lg }}
          onContentSizeChange={() => {
            if (chatScrollRef.current) {
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
                    
                    {/* Show products if available */}
                    {msg.products && msg.products.length > 0 && (
                      <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                        {msg.products.slice(0, 3).map((product) => (
                          <Pressable
                            key={product.id}
                            onPress={() => handleProductPress(product)}
                            style={{
                              ...CardStyles.container,
                              padding: 0,
                              overflow: 'hidden',
                              marginTop: Spacing.sm
                            }}
                          >
                            <Image 
                              source={{ uri: product.image }} 
                              style={{ 
                                width: '100%', 
                                height: 150,
                                backgroundColor: Colors.backgroundSecondary
                              }}
                              resizeMode="cover"
                            />
                            <View style={{ padding: Spacing.md }}>
                              <Text style={{ ...TextStyles.body, fontSize: Typography.sm, fontWeight: Typography.semibold, marginBottom: Spacing.xs }}>
                                {product.name}
                              </Text>
                              <Text style={{ ...TextStyles.caption, marginBottom: Spacing.xs }}>
                                {product.brand} • ${product.price}
                              </Text>
                              <Text style={{ ...TextStyles.small, color: Colors.primary }}>
                                Tap to view details →
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                        {msg.products.length > 3 && (
                          <Text style={{ ...TextStyles.caption, marginTop: Spacing.sm, textAlign: 'center' }}>
                            + {msg.products.length - 3} more products
                          </Text>
                        )}
                      </View>
                    )}
                    
                    {/* Show single product if available */}
                    {msg.product && (
                      <Pressable
                        onPress={() => handleProductPress(msg.product)}
                        style={{
                          ...CardStyles.container,
                          padding: 0,
                          overflow: 'hidden',
                          marginTop: Spacing.md
                        }}
                      >
                        <Image 
                          source={{ uri: msg.product.image }} 
                          style={{ 
                            width: '100%', 
                            height: 200,
                            backgroundColor: Colors.backgroundSecondary
                          }}
                          resizeMode="cover"
                        />
                        <View style={{ padding: Spacing.md }}>
                          <Text style={{ ...TextStyles.body, fontSize: Typography.base, fontWeight: Typography.semibold, marginBottom: Spacing.xs }}>
                            {msg.product.name}
                          </Text>
                          <Text style={{ ...TextStyles.caption, marginBottom: Spacing.xs }}>
                            {msg.product.brand} • ${msg.product.price}
                          </Text>
                          <Text style={{ ...TextStyles.small, color: Colors.primary }}>
                            Tap to view details →
                          </Text>
                        </View>
                      </Pressable>
                    )}
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

        {/* Input Bar */}
        <View style={{ 
          padding: Spacing.lg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.background
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

