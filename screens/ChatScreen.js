import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Platform, KeyboardAvoidingView, Keyboard, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, TextStyles, getColors } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';
import { useApp } from '../lib/AppContext';
import { trackEvent } from '../lib/styleEngine';
import { supabase } from '../lib/supabase';

export default function ChatScreen({ onBack, onProductSelect }) {
  const { state } = useApp();
  const { user } = state;
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details!' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const insets = useSafeAreaInsets();
  const [primaryColor, setPrimaryColor] = useState(getColors().primary);
  const chatScrollRef = useRef(null);
  const textInputRef = useRef(null);
  
  // Chat history states
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  
  const INPUT_ROW_HEIGHT = 60;

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

  // Load conversation history on mount
  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

  // Load user's conversations
  const loadConversations = async () => {
    if (!user?.id) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setConversations(data);
      }
    } catch (err) {
      console.log('Error loading conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load messages for a specific conversation
  const loadConversation = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        const messages = data.map(msg => ({
          type: msg.type,
          message: msg.message,
          image: msg.image_url,
          products: msg.products || []
        }));
        setChatHistory(messages.length > 0 ? messages : [
          { type: 'ai', message: 'Continue our conversation!' }
        ]);
        setCurrentConversationId(conversationId);
      }
    } catch (err) {
      console.log('Error loading conversation:', err);
    }
    setShowHistorySidebar(false);
  };

  // Create a new conversation
  const createNewConversation = async () => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: 'New Chat'
        })
        .select()
        .single();
      
      if (!error && data) {
        setCurrentConversationId(data.id);
        await loadConversations();
        return data.id;
      }
    } catch (err) {
      console.log('Error creating conversation:', err);
    }
    return null;
  };

  // Save a message to the current conversation
  const saveMessage = async (message) => {
    if (!user?.id) return;
    
    let convId = currentConversationId;
    if (!convId) {
      convId = await createNewConversation();
    }
    if (!convId) return;
    
    try {
      await supabase.from('chat_messages').insert({
        conversation_id: convId,
        type: message.type,
        message: message.message || '',
        image_url: message.image || null,
        products: message.products || null
      });
      
      // Update conversation title based on first user message
      if (message.type === 'user' && message.message) {
        const title = message.message.substring(0, 50) + (message.message.length > 50 ? '...' : '');
        await supabase
          .from('chat_conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', convId);
        await loadConversations();
      }
    } catch (err) {
      console.log('Error saving message:', err);
    }
  };

  // Start a new chat
  const startNewChat = () => {
    setCurrentConversationId(null);
    setChatHistory([
      { type: 'ai', message: 'Hi! I\'m your AI shopping assistant. Ask me anything like "show me red polka dot dresses" or "what dress would suit me?" You can also paste a product URL to get details!' }
    ]);
    setShowHistorySidebar(false);
  };

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
    
    // Save user message to database
    saveMessage(newUserMessage);
    
    setUploadedImage(null);

    // Track search event
    if (user?.id && userMessage) {
      trackEvent(user.id, 'search_query', { query: userMessage, name: userMessage });
    }

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
      
      // Save AI message to database
      saveMessage(aiMessage);
      
      // Dismiss keyboard after sending
      Keyboard.dismiss();
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = {
        type: 'ai',
        message: 'Sorry, I encountered an error. Please try again.',
        products: []
      };
      setChatHistory(prev => [...prev, errorMessage]);
      saveMessage(errorMessage);
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
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: insets.top + Spacing.sm,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
        zIndex: 10
      }}>
        <Pressable onPress={onBack} style={{ marginRight: Spacing.md }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ ...TextStyles.heading, flex: 1 }}>AI Assistant</Text>
        
        {/* History Button */}
        <Pressable 
          onPress={() => setShowHistorySidebar(true)} 
          style={{ 
            marginRight: Spacing.sm,
            padding: Spacing.xs,
          }}
        >
          <Text style={{ fontSize: 20 }}>📋</Text>
        </Pressable>
        
        {/* New Chat Button */}
        <Pressable 
          onPress={startNewChat}
          style={{ 
            padding: Spacing.xs,
          }}
        >
          <Text style={{ fontSize: 20 }}>✏️</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Chat Messages - Takes remaining space */}
        <ScrollView 
          ref={chatScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl,
          }}
          onContentSizeChange={() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollToEnd({ animated: true });
            }
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={true}
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

        {/* Input Bar */}
        <View style={{
          backgroundColor: Colors.background,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.sm,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm,
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
              
              <TextInput
                ref={textInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                placeholder="Ask me anything or paste a URL..."
                placeholderTextColor={Colors.textSecondary}
                style={{ 
                  flex: 1, 
                  height: 40,
                  backgroundColor: Colors.backgroundSecondary,
                  borderRadius: BorderRadius.md,
                  paddingHorizontal: Spacing.md,
                  color: Colors.textPrimary,
                  fontSize: Typography.sm,
                  paddingVertical: 10,
                }}
                returnKeyType="send"
                multiline={false}
                editable={!isSearching}
                autoCapitalize="none"
                autoCorrect={true}
              />
              
              <Pressable 
                onPress={handleSearchSubmit}
                disabled={isSearching || (!searchQuery.trim() && !uploadedImage)}
                style={{ 
                  backgroundColor: (isSearching || (!searchQuery.trim() && !uploadedImage)) ? Colors.backgroundSecondary : primaryColor,
                  paddingHorizontal: Spacing.md, 
                  paddingVertical: Spacing.sm,
                  height: 40,
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
      </KeyboardAvoidingView>

      {/* Chat History Sidebar Modal */}
      <Modal visible={showHistorySidebar} transparent animationType="slide">
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowHistorySidebar(false)}
        >
          <View style={{
            width: '80%',
            maxWidth: 320,
            height: '100%',
            backgroundColor: Colors.background,
            paddingTop: insets.top + Spacing.lg,
          }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Sidebar Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingHorizontal: Spacing.lg,
                paddingBottom: Spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}>
                <Text style={{ ...TextStyles.heading, fontSize: 18 }}>Chat History</Text>
                <Pressable onPress={() => setShowHistorySidebar(false)}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 24 }}>✕</Text>
                </Pressable>
              </View>

              {/* New Chat Button */}
              <Pressable 
                onPress={startNewChat}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: Spacing.lg,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                  gap: Spacing.sm,
                }}
              >
                <Text style={{ fontSize: 16 }}>✨</Text>
                <Text style={{ color: Colors.primary, fontWeight: Typography.semibold }}>
                  New Chat
                </Text>
              </Pressable>

              {/* Conversation List */}
              {loadingConversations ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              ) : conversations.length === 0 ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Text style={{ color: Colors.textSecondary }}>No chat history yet</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: '70%' }}>
                  {conversations.map((conv) => (
                    <Pressable
                      key={conv.id}
                      onPress={() => loadConversation(conv.id)}
                      style={{
                        padding: Spacing.lg,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.border,
                        backgroundColor: currentConversationId === conv.id 
                          ? Colors.primaryLight 
                          : 'transparent',
                      }}
                    >
                      <Text 
                        style={{ 
                          color: Colors.textPrimary, 
                          fontWeight: currentConversationId === conv.id ? Typography.semibold : Typography.regular,
                        }}
                        numberOfLines={2}
                      >
                        {conv.title || 'New Chat'}
                      </Text>
                      <Text style={{ 
                        color: Colors.textSecondary, 
                        fontSize: Typography.xs,
                        marginTop: 4,
                      }}>
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
