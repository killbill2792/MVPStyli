import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../lib/designSystem';

const { width, height } = Dimensions.get('window');

const StyleCraftScreen = ({ onBack, onShowQuotes }) => {
  const insets = useSafeAreaInsets();
  const [uploadedImage, setUploadedImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [minBudget, setMinBudget] = useState(100);
  const [maxBudget, setMaxBudget] = useState(500);
  const [suggestTailors, setSuggestTailors] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [previousEnquiries, setPreviousEnquiries] = useState([
    {
      id: '1',
      prompt: 'A flowy summer dress with vintage vibes',
      image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=400',
      date: '2024-01-15',
      status: 'completed',
      vendor: 'Elite Tailors'
    },
    {
      id: '2',
      prompt: 'Streetwear + Summer',
      image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400',
      date: '2024-01-10',
      status: 'in-progress',
      vendor: null
    }
  ]);
  const [showPreviousEnquiries, setShowPreviousEnquiries] = useState(false);

  const aiSuggestions = [
    "Streetwear + Summer",
    "Evening + Elegant", 
    "Cozy + Minimalist",
    "Vintage + Modern",
    "Athletic + Chic",
    "Bohemian + Edgy"
  ];

  const handleImageUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Allow full image selection
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadedImage(result.assets[0].uri);
    }
  };

  const handleGetQuotes = () => {
    if (!uploadedImage || !prompt) {
      Alert.alert('Required Fields', 'Please upload an image and describe your design.');
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing, then show waitlist message
    setTimeout(() => {
      setIsProcessing(false);
      
      // Save to previous enquiries
      const newEnquiry = {
        id: Date.now().toString(),
        prompt: prompt,
        image: uploadedImage,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        vendor: null
      };
      setPreviousEnquiries([newEnquiry, ...previousEnquiries]);
      
      // Show waitlist confirmation instead of fake quotes
      Alert.alert(
        'Request Saved ✓',
        "Your request is saved. We'll notify you when your design is ready.",
        [{ text: 'OK', onPress: () => {
          // Reset form
          setUploadedImage(null);
          setPrompt('');
          setMinBudget(100);
          setMaxBudget(500);
        }}]
      );
    }, 2000);
  };

  const handleSuggestionTap = (suggestion) => {
    setPrompt(suggestion);
    setShowSuggestions(false);
  };

  return (
    <View style={styles.fullScreenContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Early Access Badge */}
          <View style={{ marginBottom: 20, alignItems: 'center' }}>
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.4)',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginBottom: 12,
            }}>
              <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600' }}>🚧 Early Access</Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              StyleCraft is in early access. We're training AI on real style data.
            </Text>
          </View>

          {/* Previous Enquiries Toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>StyleCraft</Text>
            <Pressable
              onPress={() => setShowPreviousEnquiries(!showPreviousEnquiries)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: showPreviousEnquiries ? Colors.primary : 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                borderColor: showPreviousEnquiries ? Colors.primary : 'rgba(255,255,255,0.2)',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {showPreviousEnquiries ? 'Hide' : 'Show'} Previous ({previousEnquiries.length})
              </Text>
            </Pressable>
          </View>

          {/* Previous Enquiries Section */}
          {showPreviousEnquiries && previousEnquiries.length > 0 && (
            <View style={{ marginBottom: 32 }}>
              <Text style={{ ...styles.sectionTitle, marginBottom: 16 }}>Previous Enquiries</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {previousEnquiries.map((enquiry) => (
                  <Pressable
                    key={enquiry.id}
                    onPress={() => {
                      // Show waitlist message for previous enquiries too
                      Alert.alert(
                        'Request Saved ✓',
                        "Your request is saved. We'll notify you when your design is ready.",
                        [{ text: 'OK' }]
                      );
                    }}
                    style={{
                      width: 200,
                      marginRight: 16,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {enquiry.image && (
                      <Image source={{ uri: enquiry.image }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                    )}
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 4 }} numberOfLines={2}>
                        {enquiry.prompt}
                      </Text>
                      <Text style={{ color: '#9ca3af', fontSize: 10, marginBottom: 4 }}>{enquiry.date}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: enquiry.status === 'completed' ? '#10b981' : enquiry.status === 'in-progress' ? '#f59e0b' : '#6b7280',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                            {enquiry.status === 'completed' ? '✓ Done' : enquiry.status === 'in-progress' ? '⏳ Processing' : '⏸ Pending'}
                          </Text>
                        </View>
                        {enquiry.vendor && (
                          <Text style={{ color: '#9ca3af', fontSize: 10 }}>• {enquiry.vendor}</Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroSubtitle}>
              Drop your inspo, AI does the rest 🎨
            </Text>
          </View>

          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Upload Your Inspiration</Text>
            <Pressable style={styles.uploadArea} onPress={handleImageUpload}>
              <LinearGradient
                colors={uploadedImage ? ['#10b981', '#059669'] : ['#374151', '#1f2937']}
                style={styles.uploadGradient}
              >
                {uploadedImage ? (
                  <View style={styles.uploadedContent}>
                    <Image source={{ uri: uploadedImage }} style={styles.uploadedImage} />
                    <Text style={styles.uploadedText}>🎨 AI Analyzing...</Text>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadIcon}>📸</Text>
                    <Text style={styles.uploadText}>Drop your inspo, AI does the rest 🎨</Text>
                    <Text style={styles.uploadSubtext}>Tap to upload image</Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* AI Prompt Section */}
          <View style={styles.promptSection}>
            <Text style={styles.sectionTitle}>Describe your dream look</Text>
            <View style={styles.promptContainer}>
              <TextInput
                style={styles.promptInput}
                placeholder="e.g., A flowy summer dress with vintage vibes..."
                placeholderTextColor="#6b7280"
                value={prompt}
                onChangeText={(text) => {
                  setPrompt(text);
                  if (text.length > 0) {
                    setShowSuggestions(false);
                  }
                }}
                multiline
                numberOfLines={4}
                onFocus={() => {
                  if (prompt.length === 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              
              {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>AI Ideas</Text>
                  <View style={styles.suggestionsGrid}>
                    {aiSuggestions.map((suggestion, index) => (
                      <Pressable
                        key={index}
                        style={styles.suggestionChip}
                        onPress={() => {
                          console.log('Suggestion tapped:', suggestion);
                          setPrompt(suggestion);
                          setShowSuggestions(false);
                        }}
                        onPressIn={() => {
                          // Prevent blur from firing
                        }}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Budget Section */}
          <View style={styles.budgetSection}>
            <Text style={styles.sectionTitle}>Budget Range</Text>
            <View style={styles.budgetContainer}>
              {/* Min/Max Budget Inputs */}
              <View style={styles.budgetInputsContainer}>
                <View style={styles.budgetInputWrapper}>
                  <Text style={styles.budgetInputLabel}>Min Budget ($)</Text>
                  <TextInput
                    style={styles.budgetInput}
                    value={minBudget.toString()}
                    onChangeText={(text) => {
                      // Allow empty string while typing
                      if (text === '') {
                        setMinBudget(0);
                        return;
                      }
                      const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                      if (num >= 0 && num <= 2000) {
                        if (num <= maxBudget) {
                          setMinBudget(num);
                        } else {
                          // If min exceeds max, update both
                          setMinBudget(num);
                          setMaxBudget(num);
                        }
                      }
                    }}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor="#6b7280"
                  />
                </View>
                <View style={styles.budgetInputWrapper}>
                  <Text style={styles.budgetInputLabel}>Max Budget ($)</Text>
                  <TextInput
                    style={styles.budgetInput}
                    value={maxBudget.toString()}
                    onChangeText={(text) => {
                      // Allow empty string while typing
                      if (text === '') {
                        setMaxBudget(0);
                        return;
                      }
                      const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                      if (num >= minBudget && num <= 2000) {
                        setMaxBudget(num);
                      } else if (num < minBudget) {
                        // If max is less than min, update min
                        setMaxBudget(num);
                        setMinBudget(num);
                      }
                    }}
                    keyboardType="number-pad"
                    placeholder="500"
                    placeholderTextColor="#6b7280"
                  />
                </View>
              </View>
            </View>

            <Pressable
              style={styles.toggleContainer}
              onPress={() => setSuggestTailors(!suggestTailors)}
            >
              <View style={[styles.toggle, suggestTailors && styles.toggleActive]}>
                <View style={[styles.toggleHandle, suggestTailors && styles.toggleHandleActive]} />
              </View>
              <Text style={styles.toggleLabel}>Suggest Tailors</Text>
            </Pressable>
          </View>

          {/* CTA Button */}
          <Pressable
            style={styles.ctaButton}
            onPress={handleGetQuotes}
            disabled={!uploadedImage || !prompt || isProcessing}
          >
            <LinearGradient
              colors={uploadedImage && prompt && !isProcessing ? ['#6366f1', '#8b5cf6'] : ['#374151', '#1f2937']}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaButtonText}>
                {isProcessing ? '🪡 Saving Request...' : 'Submit Request'}
              </Text>
            </LinearGradient>
          </Pressable>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <View style={styles.processingBar}>
                <View style={styles.processingFill} />
              </View>
              <Text style={styles.processingText}>Saving your request...</Text>
            </View>
          )}
        </ScrollView>

        {/* Vendor Quotes Screen - Photo at top, list below */}
        {showQuotes && (
          <View style={StyleSheet.absoluteFillObject}>
            <View style={{
              flex: 1,
              backgroundColor: '#000',
            }}>
              {/* Photo at top */}
              {uploadedImage && (
                <View style={{ width: '100%', height: 300, backgroundColor: '#1a1a1a' }}>
                  <Image 
                    source={{ uri: uploadedImage }} 
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
              )}
              
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
                <Pressable onPress={() => setShowQuotes(false)} style={{ marginRight: 16 }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
                </Pressable>
                <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Vendor Quotes</Text>
              </View>

              {/* Vendor Quotes List */}
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingTop: 0 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 20 }}>
                  Choose your preferred vendor for your custom design
                </Text>

                {quotes.filter(quote => quote && quote.id).map((quote, index) => (
                  <Pressable
                    key={quote.id}
                    onPress={() => {
                      // Show detailed quote view
                      setSelectedQuote(quote);
                      setShowQuoteDetails(true);
                    }}
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      borderRadius: 16, 
                      padding: 16, 
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 4 }}>{quote.vendor}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Text style={{ color: '#3b82f6', fontSize: 14 }}>⭐ {quote.rating}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{quote.material}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{quote.deliveryTime}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#e4e4e7', fontSize: 20, fontWeight: '700' }}>${quote.price}</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 12 }}>+ ${quote.shipping} shipping</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>Tap to view details →</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        
        {/* Detailed Quote View */}
        {showQuoteDetails && selectedQuote && (
          <View style={StyleSheet.absoluteFillObject}>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.98)',
              padding: 20,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Pressable onPress={() => {
                  setShowQuoteDetails(false);
                  setSelectedQuote(null);
                }} style={{ marginRight: 16 }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
                </Pressable>
                <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Quote Details</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700', marginBottom: 12 }}>{selectedQuote.vendor}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Text style={{ color: '#3b82f6', fontSize: 16 }}>⭐ {selectedQuote.rating}</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{selectedQuote.material}</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{selectedQuote.deliveryTime}</Text>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '700', marginBottom: 4 }}>${selectedQuote.price}</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>+ ${selectedQuote.shipping} shipping</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 4 }}>Total: ${selectedQuote.price + selectedQuote.shipping}</Text>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Vendor Comments</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 20 }}>
                      {selectedQuote.comments || `We can create this design using ${selectedQuote.material}. The estimated delivery time is ${selectedQuote.deliveryTime}. We offer free revisions and ensure high-quality craftsmanship.`}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Material Options</Text>
                    <View style={{ gap: 8 }}>
                      {[
                        { name: selectedQuote.material, price: 0, selected: true },
                        { name: 'Premium Silk', price: 50, selected: false },
                        { name: 'Luxury Cotton', price: 30, selected: false },
                        { name: 'Designer Blend', price: 75, selected: false },
                      ].map((option, idx) => (
                        <Pressable
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 12,
                            backgroundColor: option.selected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: option.selected ? Colors.primary : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <Text style={{ color: '#e4e4e7', fontSize: 14 }}>{option.name}</Text>
                          {option.price > 0 && (
                            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>+${option.price}</Text>
                          )}
                          {option.price === 0 && (
                            <Text style={{ color: Colors.primary, fontSize: 12 }}>Included</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Additional Options</Text>
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                        <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Rush Delivery (1 week)</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 14 }}>+$100</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                        <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Extra Fittings</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 14 }}>+$50</Text>
                      </View>
                    </View>
                  </View>

                  <Pressable style={{ backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Confirm & Proceed</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  uploadSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  uploadArea: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  uploadGradient: {
    padding: 24,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  uploadedContent: {
    alignItems: 'center',
  },
  uploadedImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadedText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  promptSection: {
    marginBottom: 32,
  },
  promptContainer: {
    position: 'relative',
  },
  promptInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textAlignVertical: 'top',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1000,
    maxHeight: 200,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  suggestionText: {
    color: '#a5b4fc',
    fontSize: 14,
  },
  budgetSection: {
    marginBottom: 32,
  },
  budgetContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  budgetInputsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  budgetInputWrapper: {
    flex: 1,
  },
  budgetInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  budgetInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderTrackWrapper: {
    width: '100%',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    position: 'relative',
    width: '100%',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  sliderHandle: {
    position: 'absolute',
    top: -8,
    width: 22,
    height: 22,
    backgroundColor: '#fff',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6366f1',
    zIndex: 10,
  },
  budgetRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  toggle: {
    width: 44,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#6366f1',
  },
  toggleHandle: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  toggleHandleActive: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  ctaGradient: {
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  processingFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
    width: '70%',
  },
  processingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StyleCraftScreen;

