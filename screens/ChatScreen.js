import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Platform, Keyboard, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, TextStyles, getColors } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';

export default function ChatScreen({ onBack, onProductSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details!' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const [primaryColor, setPrimaryColor] = useState(getColors().primary);
  const chatScrollRef = useRef(null);

  // Bottom bar actual height calculation:
  // Outer View: paddingTop(5) + paddingBottom(2) = 7px
  // Inner container: paddingVertical(5) = 10px (5 top + 5 bottom)
  // Button: paddingVertical(8) = 16px (8 top + 8 bottom)
  // Text: fontSize(14) ≈ 14px
  // Border: borderTopWidth(1) = 1px
  // Total: 5 + 2 + 5 + 8 + 14 + 8 + 5 + 1 = 48px
  // SafeAreaView in BottomBar adds insets.bottom automatically, so we only need content height
  const BOTTOM_BAR_CONTENT_HEIGHT = 48;
  const INPUT_ROW_HEIGHT = 40;

  // Update color when theme changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentColor = getColors().primary;
      if (currentColor !== primaryColor) {
        setPrimaryColor(currentColor);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [primaryColor]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

  // Handle keyboard show/hide
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handleImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim() && !uploadedImage) return;

    const userMessage = searchQuery.trim();
    setSearchQuery('');
    setIsSearching(true);

    // Add user message to chat
    const newUserMessage = {
      type: 'user',
      message: userMessage || 'Image uploaded',
      image: uploadedImage
    };
    setChatHistory(prev => [...prev, newUserMessage]);
    setUploadedImage(null);

    try {
      let products = [];

      // Check if it's a URL
      if (userMessage && isUrl(userMessage)) {
        const product = await importProductFromUrl(userMessage);
        if (product) {
          products = [normalizeProduct(product)];
        }
      } else if (uploadedImage || userMessage) {
        // Search for products
        products = await searchWebProducts(userMessage || 'clothing fashion');
        products = products.slice(0, 10).map(normalizeProduct);
      }

      // Add AI response with products
      const aiMessage = {
        type: 'ai',
        message: products.length > 0 
          ? `I found ${products.length} product${products.length > 1 ? 's' : ''} for you!`
          : 'I couldn\'t find any products. Try a different search term or paste a product URL.',
        products: products
      };
      setChatHistory(prev => [...prev, aiMessage]);
      
      // Dismiss keyboard after sending
      Keyboard.dismiss();
    } catch (error) {
      console.error('Search error:', error);
      setChatHistory(prev => [...prev, {
        type: 'ai',
        message: 'Sorry, I encountered an error. Please try again.',
        products: []
      }]);
      Keyboard.dismiss();
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
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}>
          <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ ...TextStyles.heading, flex: 1 }}>AI Assistant</Text>
        </View>

        {/* Chat Messages */}
        <ScrollView 
          ref={chatScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: INPUT_ROW_HEIGHT + 60,
          }}
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
                  {msg.message && (
                    <Text style={{ ...TextStyles.body, color: Colors.primary }}>
                      {msg.message}
                    </Text>
                  )}
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
                  <Text style={{ ...TextStyles.body, color: Colors.textPrimary, marginBottom: msg.products && msg.products.length > 0 ? Spacing.md : 0 }}>
                    {msg.message}
                  </Text>
                  
                  {/* Products Grid */}
                  {msg.products && msg.products.length > 0 && (
                    <View style={{ 
                      flexDirection: 'row', 
                      flexWrap: 'wrap', 
                      gap: Spacing.sm,
                      marginTop: Spacing.sm
                    }}>
                      {msg.products.map((product, pIdx) => (
                        <Pressable
                          key={product.id || pIdx}
                          onPress={() => handleProductPress(product)}
                          style={{
                            width: '48%',
                            backgroundColor: Colors.background,
                            borderRadius: BorderRadius.md,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: Colors.border,
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
                          <View style={{ padding: Spacing.sm }}>
                            <Text 
                              style={{ ...TextStyles.small, fontWeight: Typography.semibold }}
                              numberOfLines={1}
                            >
                              {product.name}
                            </Text>
                            <Text style={{ ...TextStyles.caption, color: Colors.primary, marginTop: 2 }}>
                              ${product.price || 'N/A'}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
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

      {/* Input Bar Container - positioned absolutely at bottom */}
      <View style={{ 
        position: 'absolute',
        bottom: keyboardHeight > 0 ? keyboardHeight : (BOTTOM_BAR_CONTENT_HEIGHT + insets.bottom),
        left: 0,
        right: 0,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
      }}>
        <View style={{ 
          flexDirection: 'row', 
          gap: Spacing.xs, 
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.sm,
        }}>
          {uploadedImage ? (
            <Pressable
              onPress={() => setUploadedImage(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: BorderRadius.sm,
                overflow: 'hidden',
              }}
            >
              <Image 
                source={{ uri: uploadedImage }} 
                style={{ width: 40, height: 40 }} 
                resizeMode="cover"
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleImageUpload}
              style={{
                width: 40,
                height: 40,
                borderRadius: BorderRadius.sm,
                backgroundColor: Colors.backgroundSecondary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>📷</Text>
            </Pressable>
          )}
          <View style={{ 
            flex: 1, 
            height: INPUT_ROW_HEIGHT,
            backgroundColor: Colors.backgroundSecondary,
            borderRadius: BorderRadius.md,
            paddingHorizontal: Spacing.md,
            justifyContent: 'center',
          }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Ask me anything or paste a URL..."
              placeholderTextColor={Colors.textSecondary}
              style={{ 
                flex: 1, 
                color: Colors.textPrimary,
                fontSize: Typography.sm,
                paddingVertical: 0,
              }}
              returnKeyType="send"
              multiline={false}
            />
          </View>
          <Pressable 
            onPress={handleSearchSubmit}
            disabled={isSearching || (!searchQuery.trim() && !uploadedImage)}
            style={{ 
              backgroundColor: (isSearching || (!searchQuery.trim() && !uploadedImage)) ? Colors.backgroundSecondary : primaryColor,
              paddingHorizontal: Spacing.md, 
              paddingVertical: Spacing.sm,
              height: INPUT_ROW_HEIGHT,
              borderRadius: BorderRadius.md,
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: 60,
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
      </View>
    </KeyboardAvoidingView>
  );
}
