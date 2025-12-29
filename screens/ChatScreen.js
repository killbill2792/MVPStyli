import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, KeyboardAvoidingView, Keyboard, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, TextStyles, getColors } from '../lib/designSystem';
import { isUrl, importProductFromUrl, searchWebProducts, normalizeProduct } from '../lib/productSearch';
import { useApp } from '../lib/AppContext';
import { trackEvent } from '../lib/styleEngine';
import { supabase } from '../lib/supabase';
import { SafeImage, OptimizedImage } from '../lib/OptimizedImage';

export default function ChatScreen({ onBack, onProductSelect }) {
  const { state } = useApp();
  const { user } = state;
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Discover Products using smart search.\n\nDescribe what you want, we\'ll find matching items from internet.\n\nEx: Find me a Red Polka Dots, Dresses under $50 for women, Pink dinner dress, Dresses for Miami vacation etc' }
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

  // Load conversation history on mount and auto-load most recent conversation
  useEffect(() => {
    if (user?.id) {
      loadConversationsAndResume();
    }
  }, [user?.id]);
  
  // Load conversations and automatically resume the most recent one
  const loadConversationsAndResume = async () => {
    if (!user?.id) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .neq('title', 'New Chat')
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setConversations(data);
        
        // Auto-load the most recent conversation if one exists and we're not already in one
        if (data.length > 0 && !currentConversationId) {
          console.log('🔄 Auto-loading most recent conversation:', data[0].title);
          loadConversation(data[0].id);
        }
      }
    } catch (err) {
      console.log('Error loading conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

  // Debug: Log chatHistory state to see if products are present
  useEffect(() => {
    const productsInHistory = chatHistory.filter(m => m.products && m.products.length > 0);
    if (productsInHistory.length > 0) {
      console.log('🎨 ChatHistory state has products:', productsInHistory.length, 'messages with products');
      productsInHistory.forEach((msg, idx) => {
        console.log(`  Message ${idx}: ${msg.products.length} products`);
      });
    } else {
      console.log('⚠️ ChatHistory state has NO products');
    }
  }, [chatHistory]);

  // Reload conversations list (without auto-loading)
  const loadConversations = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .neq('title', 'New Chat')
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setConversations(data);
      }
    } catch (err) {
      console.log('Error loading conversations:', err);
    }
  };

  // Load messages for a specific conversation
  const loadConversation = async (conversationId) => {
    try {
      console.log('📂 Loading conversation:', conversationId);
      // Explicitly select all fields including products JSONB
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, conversation_id, type, message, image_url, products, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.log('❌ Error loading messages:', error);
        return;
      }
      
      if (data) {
        console.log('📂 Raw messages from DB:', data.length);
        
        // Log all message types to see what we have
        data.forEach((msg, idx) => {
          console.log(`📋 Message ${idx}: type=${msg.type}, hasProducts=${!!msg.products}, message="${msg.message?.substring(0, 50)}"`);
        });
        
        const messages = data.map((msg, idx) => {
          // Parse products - handle various formats
          let products = msg.products;
          
          // Debug: Log the raw products value
          console.log(`📦 Message ${idx} (${msg.type}):`, {
            hasProducts: !!products,
            productsType: typeof products,
            isArray: Array.isArray(products),
            rawValue: products ? JSON.stringify(products).substring(0, 150) : 'null'
          });
          
          // Handle null/undefined
          if (!products || products === null) {
            products = [];
          }
          // Parse if string
          else if (typeof products === 'string') {
            try {
              products = JSON.parse(products);
            } catch (e) {
              console.log('⚠️ Failed to parse products string:', e.message);
              products = [];
            }
          }
          // Handle object (might be JSONB object)
          else if (typeof products === 'object' && !Array.isArray(products)) {
            // Check if it has array-like properties
            if (products.length !== undefined) {
              products = Array.from(products);
            } else if (Object.keys(products).length > 0) {
              // Single product object? Wrap in array
              products = [products];
            } else {
              products = [];
            }
          }
          
          // Ensure it's an array
          if (!Array.isArray(products)) {
            console.log('⚠️ Products is not an array after parsing, converting to empty array');
            products = [];
          }
          
          // Validate and clean products - ensure they have required fields
          products = products.filter(p => {
            if (!p) return false;
            const hasImage = !!(p.image || p.imageUrl);
            const hasName = !!(p.name || p.title);
            if (!hasImage || !hasName) {
              console.log('⚠️ Filtering out invalid product:', { hasImage, hasName, product: p.name || p.title });
            }
            return hasImage && hasName;
          });
          
          // Normalize product structure
          products = products.map(p => ({
            id: p.id || `prod_${idx}_${Math.random().toString(36).substr(2, 9)}`,
            name: p.name || p.title || 'Product',
            price: p.price,
            image: p.image || p.imageUrl, // Use image or imageUrl
            brand: p.brand,
            url: p.url || p.buyUrl || p.productUrl,
            category: p.category
          }));
          
          console.log(`✅ Message ${idx} final products:`, products.length);
          
          return {
            type: msg.type,
            message: msg.message,
            image: msg.image_url,
            products: products
          };
        });
        
        const productsCount = messages.reduce((sum, m) => sum + (m.products?.length || 0), 0);
        console.log('📂 Total products loaded:', productsCount);
        
        // Verify by querying all messages to see what we have
        console.log('🔍 All messages in conversation:');
        data.forEach((msg, idx) => {
          console.log(`  ${idx}. ${msg.type.toUpperCase()}: "${msg.message?.substring(0, 40)}" - Products: ${msg.products ? (Array.isArray(msg.products) ? msg.products.length : 'not array') : 'null'}`);
        });
        
        // Check if we have any AI messages with products
        const aiMessagesWithProducts = data.filter(m => m.type === 'ai' && m.products);
        console.log(`📊 Found ${aiMessagesWithProducts.length} AI messages with products`);
        
        if (aiMessagesWithProducts.length === 0 && data.some(m => m.type === 'ai')) {
          console.log('⚠️ WARNING: AI messages exist but have no products!');
          console.log('⚠️ This means products were not saved when the AI responded.');
        }
        
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
  // Returns the conversation ID that was used
  // Optionally accepts a conversationId to use (to avoid race conditions)
  const saveMessage = async (message, providedConvId = null) => {
    if (!user?.id) {
      console.log('⚠️ Cannot save message: no user');
      return null;
    }
    
    let convId = providedConvId || currentConversationId;
    if (!convId) {
      console.log('📝 No current conversation, creating new one...');
      convId = await createNewConversation();
      if (convId) {
        setCurrentConversationId(convId);
        console.log('✅ Created new conversation:', convId);
      }
    }
    
    if (!convId) {
      console.log('❌ Failed to get/create conversation ID');
      return null;
    }
    
    console.log('💾 Saving message to conversation:', convId, 'type:', message.type);
    
    try {
      // Clean and serialize products for JSONB storage
      let productsToSave = null;
      if (message.products && message.products.length > 0) {
        // Only keep essential fields that can be serialized
        productsToSave = message.products.map(p => ({
          id: p.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: p.name || p.title || 'Product',
          price: p.price,
          image: p.image || p.imageUrl, // Support both field names
          brand: p.brand,
          url: p.url || p.buyUrl || p.productUrl,
          category: p.category
        }));
        console.log('📦 Products to save:', productsToSave.map(p => ({ name: p.name, hasImage: !!p.image })));
      }
      
      console.log('💾 Saving message:', { 
        type: message.type, 
        productsCount: productsToSave?.length || 0,
        convId 
      });
      
      // Prepare insert data
      const insertData = {
        conversation_id: convId,
        type: message.type,
        message: message.message || '',
        image_url: message.image || null,
        products: productsToSave // This should be an array or null
      };
      
      console.log('💾 Insert data:', {
        hasProducts: !!productsToSave,
        productsCount: productsToSave?.length || 0,
        productsType: typeof productsToSave,
        productsIsArray: Array.isArray(productsToSave),
        productsSample: productsToSave ? JSON.stringify(productsToSave[0]).substring(0, 100) : 'null'
      });
      
      const { data: savedData, error } = await supabase
        .from('chat_messages')
        .insert(insertData)
        .select('id, type, message, products');
      
      if (error) {
        console.log('❌ Error saving message:', error);
        console.log('❌ Error details:', JSON.stringify(error, null, 2));
      } else if (savedData && savedData.length > 0) {
        // Verify what was actually saved (select returns array)
        const savedRecord = savedData[0];
        console.log('✅ Message saved. Verifying products in DB...');
        console.log('📦 Saved record:', {
          id: savedRecord.id,
          type: savedRecord.type,
          hasProducts: !!savedRecord.products,
          productsType: typeof savedRecord.products,
          productsIsArray: Array.isArray(savedRecord.products),
          productsValue: savedRecord.products ? JSON.stringify(savedRecord.products).substring(0, 200) : 'null'
        });
        
        if (!savedRecord.products) {
          console.log('⚠️ WARNING: Products were NOT saved to database!');
          console.log('⚠️ This might be an RLS policy issue or JSONB field issue');
          
          // Try to query the record directly to see what's in DB
          setTimeout(async () => {
            const { data: verifyData, error: verifyError } = await supabase
              .from('chat_messages')
              .select('id, products')
              .eq('id', savedRecord.id)
              .single();
            
            if (!verifyError && verifyData) {
              console.log('🔍 Direct DB query result:', {
                hasProducts: !!verifyData.products,
                products: verifyData.products
              });
            }
          }, 500);
        } else {
          console.log('✅ Products successfully saved!');
        }
      } else {
        console.log('⚠️ No data returned from insert');
      }
      
      // Update conversation title based on first user message
      if (message.type === 'user' && message.message) {
        const title = message.message.substring(0, 50) + (message.message.length > 50 ? '...' : '');
        await supabase
          .from('chat_conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', convId);
        await loadConversations();
      }
      
      return convId; // Return the conversation ID used
    } catch (err) {
      console.log('Error saving message:', err);
      return null;
    }
  };

  // Start a new chat
  const startNewChat = () => {
    setCurrentConversationId(null);
    setChatHistory([
      { type: 'ai', message: 'Discover Products using smart search.\n\nDescribe what you want, we\'ll find matching items from internet.\n\nEx: Find me a Red Polka Dots, Dresses under $50 for women, Pink dinner dress, Dresses for Miami vacation etc' }
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
    if (!searchQuery.trim()) return;

    const userMessage = searchQuery.trim();
    setSearchQuery('');
    setIsSearching(true);

    // Add user message to chat
    const newUserMessage = {
      type: 'user',
      message: userMessage
    };
    setChatHistory(prev => [...prev, newUserMessage]);
    
    // Save user message to database and get conversation ID
    const convId = await saveMessage(newUserMessage);
    if (convId && !currentConversationId) {
      setCurrentConversationId(convId);
    }

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
      
      // Save AI message to database (use the same conversation ID from user message)
      console.log('💾 About to save AI message. Using conversation ID:', convId);
      if (convId) {
        setCurrentConversationId(convId); // Update state for future messages
      }
      const aiConvId = await saveMessage(aiMessage, convId); // Pass convId directly to avoid race condition
      console.log('✅ AI message saved to conversation:', aiConvId);
      
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
      {/* Header - ChatGPT Style */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: insets.top + Spacing.sm,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
        zIndex: 10
      }}>
        {/* Left: Hamburger Menu */}
        <Pressable 
          onPress={() => setShowHistorySidebar(true)} 
          style={{ 
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ gap: 5 }}>
            <View style={{ width: 20, height: 2, backgroundColor: Colors.textPrimary, borderRadius: 1 }} />
            <View style={{ width: 20, height: 2, backgroundColor: Colors.textPrimary, borderRadius: 1 }} />
            <View style={{ width: 20, height: 2, backgroundColor: Colors.textPrimary, borderRadius: 1 }} />
          </View>
        </Pressable>
        
        {/* Center: Title */}
        <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '600' }}>Stylit Shop</Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>▼</Text>
        </Pressable>
        
        {/* Right: New Chat Button */}
        <Pressable 
          onPress={startNewChat}
          style={{ 
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: '300' }}>+</Text>
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
                    <OptimizedImage 
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
                  <Text style={{ ...TextStyles.body, color: Colors.textPrimary, marginBottom: msg.products && msg.products.length > 0 ? Spacing.md : 0, lineHeight: 22 }}>
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
                          {(product.image || product.imageUrl) ? (
                            <OptimizedImage 
                              source={{ uri: product.image || product.imageUrl }} 
                              style={{ 
                                width: '100%', 
                                height: 150,
                                backgroundColor: Colors.backgroundSecondary
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={{ 
                              width: '100%', 
                              height: 150,
                              backgroundColor: Colors.backgroundSecondary,
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}>
                              <Text style={{ ...TextStyles.caption, color: Colors.textSecondary }}>No Image</Text>
                            </View>
                          )}
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
            <TextInput
              ref={textInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Search Products by Style, Color or Price..."
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
              disabled={isSearching || !searchQuery.trim()}
              style={{ 
                backgroundColor: (isSearching || !searchQuery.trim()) ? Colors.backgroundSecondary : primaryColor,
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
                color: (isSearching || !searchQuery.trim()) ? Colors.textSecondary : Colors.textWhite,
                fontSize: Typography.sm,
                fontWeight: Typography.semibold,
              }}>
                {isSearching ? '...' : 'Send'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Chat History Sidebar Modal - ChatGPT Style */}
      <Modal visible={showHistorySidebar} transparent animationType="none">
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Sidebar */}
          <View style={{
            width: '75%',
            maxWidth: 280,
            height: '100%',
            backgroundColor: '#171717',
            paddingTop: insets.top,
          }}>
            {/* New Chat Button */}
            <Pressable 
              onPress={startNewChat}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                margin: 12,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                gap: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>+</Text>
              <Text style={{ color: '#fff', fontSize: 14 }}>New chat</Text>
            </Pressable>

            {/* Conversation List */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {loadingConversations ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator color="#666" size="small" />
                </View>
              ) : conversations.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: 13 }}>No conversations yet</Text>
                </View>
              ) : (
                <>
                  <Text style={{ color: '#666', fontSize: 11, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }}>
                    Recent
                  </Text>
                  {conversations.map((conv) => (
                    <Pressable
                      key={conv.id}
                      onPress={() => loadConversation(conv.id)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        marginHorizontal: 8,
                        borderRadius: 6,
                        backgroundColor: currentConversationId === conv.id 
                          ? 'rgba(255,255,255,0.1)' 
                          : 'transparent',
                      }}
                    >
                      <Text 
                        style={{ 
                          color: currentConversationId === conv.id ? '#fff' : '#ececec',
                          fontSize: 14,
                        }}
                        numberOfLines={1}
                      >
                        {conv.title || 'New Chat'}
                      </Text>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>

            {/* Bottom section */}
            <View style={{ 
              borderTopWidth: 1, 
              borderTopColor: 'rgba(255,255,255,0.1)',
              padding: 12,
            }}>
              <Pressable 
                onPress={() => setShowHistorySidebar(false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
              >
                <Text style={{ color: '#ececec', fontSize: 14 }}>← Back</Text>
              </Pressable>
            </View>
          </View>

          {/* Overlay to close */}
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setShowHistorySidebar(false)}
          />
        </View>
      </Modal>
    </View>
  );
}
