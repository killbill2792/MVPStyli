import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert, StatusBar, TextInput, ScrollView, TouchableWithoutFeedback, PanGestureHandler } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { customAlphabet } from 'nanoid/non-secure';
import { supabase } from './lib/supabase';
import { uploadImageAsync } from './lib/upload';
import productsData from './data/products.json';
import { Linking } from 'react-native';
import BottomBar from './components/BottomBar';
import PodsScreen from './screens/PodsScreen';
import StyleCraftScreen from './screens/StyleCraftScreen';
import NewAccountScreen from './screens/AccountScreen';
import PodLive from './screens/PodLive';
import PodRecap from './screens/PodRecap';
import PodsHome from './screens/PodsHome';
import Inbox from './screens/Inbox';
import { ProductDetector } from './components/ProductDetector';
import { fetchRealClothingProducts } from './lib/productApi';

// Enhanced product data with working model images - upper body and lower body items
const enhancedProducts = [
  // Men's Upper Body (10 items)
  {
    id: "zara-black-blazer",
    name: "Zara Black Blazer",
    price: 119,
    rating: 4.4,
    brand: "Zara",
    category: "upper",
    color: "Black",
    material: "Wool Blend",
    garment_des: "Black blazer with structured fit and classic lapels",
    image: "https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.zara.com/"
  },
  {
    id: "asos-denim-jacket",
    name: "ASOS Denim Jacket",
    price: 69,
    rating: 4.6,
    brand: "ASOS",
    category: "upper",
    color: "Blue",
    material: "Denim",
    garment_des: "Classic blue denim jacket with button closure",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.asos.com/"
  },
  {
    id: "uniqlo-cashmere",
    name: "Uniqlo Cashmere Knit",
    price: 79,
    rating: 4.3,
    brand: "Uniqlo",
    category: "upper",
    color: "Gray",
    material: "Cashmere",
    garment_des: "Soft cashmere knit sweater with crew neck",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.uniqlo.com/"
  },
  {
    id: "hm-trench",
    name: "H&M Classic Trench",
    price: 139,
    rating: 4.2,
    brand: "H&M",
    category: "upper",
    color: "Beige",
    material: "Cotton Blend",
    garment_des: "Classic beige trench coat with belt closure",
    image: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www2.hm.com/"
  },
  {
    id: "aritzia-wilfred",
    name: "Aritzia Wilfred Blouse",
    price: 88,
    rating: 4.4,
    brand: "Aritzia",
    category: "upper",
    color: "White",
    material: "Silk",
    garment_des: "Silk blouse with button front and relaxed fit",
    image: "https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.aritzia.com/"
  },
  {
    id: "coach-leather-tote",
    name: "Coach Leather Tote",
    price: 295,
    rating: 4.5,
    brand: "Coach",
    category: "upper",
    color: "Brown",
    material: "Leather",
    garment_des: "Premium leather tote bag with shoulder straps",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.coach.com/"
  },
  // Men's Lower Body (10 items)
  {
    id: "levi-501",
    name: "Levi's 501 Original",
    price: 98,
    rating: 4.6,
    brand: "Levi's",
    category: "lower",
    color: "Blue",
    material: "Denim",
    garment_des: "Classic blue denim jeans with straight fit",
    image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.levi.com/"
  },
  {
    id: "nike-air-force-1",
    name: "Nike Air Force 1",
    price: 90,
    rating: 4.8,
    brand: "Nike",
    category: "lower",
    color: "White",
    material: "Leather",
    garment_des: "Classic white leather sneakers with rubber sole",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.nike.com/"
  },
  {
    id: "adidas-samba",
    name: "Adidas Samba OG",
    price: 100,
    rating: 4.6,
    brand: "Adidas",
    category: "lower",
    color: "White/Black",
    material: "Leather",
    garment_des: "Classic white and black leather sneakers",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.adidas.com/"
  },
  // Women's Upper Body (20 items)
  {
    id: "cos-silk-dress",
    name: "COS Silk Dress",
    price: 159,
    rating: 4.7,
    brand: "COS",
    category: "upper",
    color: "Black",
    material: "Silk",
    garment_des: "Elegant silk dress with flowing silhouette",
    image: "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.cos.com/"
  },
  {
    id: "reformation-wrap",
    name: "Reformation Wrap Dress",
    price: 248,
    rating: 4.7,
    brand: "Reformation",
    category: "upper",
    color: "Floral",
    material: "Silk",
    garment_des: "Floral wrap dress with tie waist",
    image: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://www.thereformation.com/"
  },
  {
    id: "mango-slip-dress",
    name: "Mango Satin Slip",
    price: 119,
    rating: 4.3,
    brand: "Mango",
    category: "upper",
    color: "Black",
    material: "Satin",
    garment_des: "Satin slip dress with adjustable straps",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&auto=format&fit=crop&w=1200",
    buyUrl: "https://shop.mango.com/"
  }
];

// Save try-on result to Supabase for persistence
async function saveTryOnResult(resultUrl, productId, productName, setTryOnResults) {
  try {
    console.log('Saving try-on result:', resultUrl);
    
    // Upload the result image to Supabase
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch result image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const path = `tryon-results/${productId}-${Date.now()}.jpg`;
    
    const { error } = await supabase.storage
      .from('images')
      .upload(path, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });
    
    if (error) {
      console.error('Try-on result upload error:', error);
      throw error;
    }
    
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    console.log('Try-on result saved to Supabase:', data.publicUrl);
    
    // Store metadata in global state
    const tryOnData = {
      id: `${productId}-${Date.now()}`,
      productId,
      productName,
      resultUrl: data.publicUrl,
      createdAt: new Date().toISOString()
    };
    
    // Update global state
    setTryOnResults(prev => [tryOnData, ...prev.slice(0, 19)]); // Keep last 20
    
    return data.publicUrl;
  } catch (error) {
    console.error('Save try-on result error:', error);
    // Don't throw - this is not critical for the user experience
  }
}

// Upload garment image to Supabase for Replicate access
async function uploadGarmentImage(imageUrl, productId) {
  try {
    console.log('Uploading garment image:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Convert response to ArrayBuffer for React Native compatibility
    const arrayBuffer = await response.arrayBuffer();
    const path = `garments/${productId}-${Date.now()}.jpg`;
    
    const { error } = await supabase.storage
      .from('images')
      .upload(path, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
    
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    console.log('Garment uploaded to Supabase:', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.error('Garment upload error:', error);
    throw error;
  }
}

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const Ctx = createContext(null);
function rid() { return nano(); }

const initial = {
  route: 'signin',
  params: {},
  twinUrl: null,
  user: null,
  products: productsData,
  currentProductId: 'denim-jacket',
  feedItems: [],
  currentFeedIndex: 0,
  rooms: [],
  tryOnResults: [],
  detectedProduct: null
};

export function AppProvider({ children }) {
  const [state, setState] = useState(initial);
  
  const api = useMemo(() => ({
    state,
    setRoute: (route, params) => setState(s => ({ ...s, route, params: params || {} })),
    setTwinUrl: (url) => setState(s => ({ ...s, twinUrl: url })),
    setUser: (user) => setState(s => ({ ...s, user })),
    setTryOnResults: (results) => setState(s => ({ ...s, tryOnResults: results })),
    setCurrentProduct: (id) => setState(s => ({ ...s, currentProductId: id })),
    setDetectedProduct: (product) => setState(s => ({ ...s, detectedProduct: product })),
    nextFeedItem: () => setState(s => ({ ...s, currentFeedIndex: (s.currentFeedIndex + 1) % s.feedItems.length })),
    createRoom: ({ lookId, mode, durationMins = 60, title }) => {
      const room = {
        id: rid(),
        lookId,
        mode,
        title: title || mode,
        expiresAt: Date.now() + durationMins * 60 * 1000,
        status: 'active',
        votes: { yes: 0, maybe: 0, no: 0 }
      };
      setState(s => ({ ...s, rooms: [room, ...s.rooms] }));
      return room;
    },
    vote: (roomId, label) => setState(s => ({
      ...s,
      rooms: s.rooms.map(r => r.id === roomId ? { ...r, votes: { ...r.votes, [label]: r.votes[label] + 1 } } : r)
    }))
  }), [state]);
  
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

export default function App() {
  // Debug environment variables
  console.log('Environment check:', {
    apiBase: process.env.EXPO_PUBLIC_API_BASE,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  });
  
  return (
    <SafeAreaProvider>
    <AppProvider>
      <Shell />
    </AppProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { state, setRoute, setUser } = useApp();
  const { route, user, params } = state;
  
  // Initialize user on first load - create local user without Supabase
  useEffect(() => {
    if (!user) {
      // Generate a proper UUID for the user
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      // Create a local user without Supabase auth
      setUser({ id: generateUUID(), email: null });
      // Set Explore as default home page after user creation
      setRoute('feed');
    }
  }, [user, setUser, setRoute]);
  
  // If no user, show loading
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>MVPStyli</Text>
        <Text style={{ color: "#a1a1aa", fontSize: 16, marginTop: 8 }}>Loading...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" translucent={true} />
      
      {/* New screens that need full screen control */}
      {route === "createpod" && <PodsScreen 
        onBack={() => setRoute("feed")} 
        onCreatePod={(podId) => setRoute("podlive", { podId })}
        userId={user?.id}
      />}
      {route === "podlive" && <PodLive 
        podId={params?.podId || ''} 
        onBack={() => setRoute("feed")} 
        onRecap={(podId) => setRoute("podrecap", { podId })}
        userId={user?.id}
      />}
      {route === "podrecap" && <PodRecap 
        podId={params?.podId || ''} 
        onBack={() => setRoute("feed")} 
        onStyleCraft={() => setRoute("stylecraft")}
        onShopSimilar={() => setRoute("shop")}
      />}
      {route === "podshome" && <PodsHome 
        onBack={() => setRoute("feed")} 
        onPodLive={(podId) => setRoute("podlive", { podId })}
        onPodRecap={(podId) => setRoute("podrecap", { podId })}
        onInbox={() => setRoute("inbox")}
        onCreatePod={() => setRoute("createpod")}
        userId={user?.id}
        userEmail={user?.email}
      />}
      {route === "inbox" && <Inbox 
        onBack={() => setRoute("podshome")} 
        onPodLive={(podId) => setRoute("podlive", { podId })}
        onPodRecap={(podId) => setRoute("podrecap", { podId })}
        userId={user?.id}
      />}
      {route === "stylecraft" && <StyleCraftScreen onBack={() => setRoute("shop")} />}
      {route === "account" && <NewAccountScreen onBack={() => setRoute("shop")} tryOnResults={state.tryOnResults} />}
      
      {/* Shop screen - full screen like other new screens */}
      {route === "shop" && <Shop />}
      
      {/* Original screens that use the container */}
      {!["createpod", "podlive", "podrecap", "podshome", "inbox", "stylecraft", "account", "shop"].includes(route) && (
        <View style={s.container}>
          {route === "signin" && <SignInScreen onDone={() => setRoute("onboarding")} />}
          {route === "onboarding" && <Onboarding />}
          {route === "product" && <Product />}
          {route === "tryon" && <TryOn />}
          {route === "askhelp" && <AskHelp />}
      {route === "rooms" && <RoomsInbox />}
      {route === "room_owner" && <RoomOwner />}
      {route === "room_guest" && <RoomGuest />}
      {route === "recap" && <Recap />}
      {route === "feed" && <Explore />}
      {route === "ai-analytics" && <AIAnalytics />}
      {route === "suggested-outfits" && <SuggestedOutfits />}
      {route === "suggest" && <SuggestScreen />}
        </View>
      )}
      
      {/* Bottom bar for all screens except signin */}
      {route !== "signin" && <BottomBar route={route} go={setRoute} />}
    </SafeAreaView>
  );
}

function SignInScreen({ onDone }) {
  const { setUser } = useApp();

  const handleSignIn = async () => {
    try {
      // Create local user without Supabase
      setUser({ id: "local-user-" + Date.now(), email: null });
      onDone();
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Sign In Failed', 'Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24, gap: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
          MVPStyli
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 16, textAlign: 'center' }}>
          AI-powered fashion try-on
        </Text>
      </View>

      <Pressable onPress={handleSignIn} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, alignItems: 'center' }}>
        <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>
          Continue as Guest
        </Text>
      </Pressable>
    </View>
  );
}

function Onboarding() {
  const { setTwinUrl, setRoute, state: { twinUrl } } = useApp();
  
  const pick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo access.');
        return;
      }
      
      const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        quality: 0.9 
      });
      
      if (!res.canceled && res.assets && res.assets[0] && res.assets[0].uri) {
        try {
          console.log('Selected image URI:', res.assets[0].uri);
          const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
          setTwinUrl(uploadedUrl);
          // Photo uploaded successfully
        } catch (error) {
          console.error('Upload error:', error);
          // Fallback: use local URI
          setTwinUrl(res.assets[0].uri);
          // Photo saved locally
        }
      } else {
        console.error('No valid image selected:', res);
        console.log('No image was selected');
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.log('Upload failed, please try again');
    }
  };
  
  const next = () => {
    if (twinUrl) {
      setRoute('shop');
    } else {
      console.log('Please upload your photo to continue');
    }
  };
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>Create Your Twin</Text>
        <Text style={s.muted}>Upload a clear photo. Everything else is optional.</Text>
        <View style={{ height: 12 }} />
        <Pressable style={s.inputBox} onPress={pick}>
          <Text style={s.label}>Upload Photo <Text style={{ color: '#f87171' }}>(required)</Text></Text>
          <Text style={s.inputHint}>Tap to choose from gallery</Text>
        </Pressable>
        {twinUrl && (
          <View style={{ marginTop: 12 }}>
            <Image source={{ uri: twinUrl }} style={{ width: 100, height: 100, borderRadius: 12 }} />
            <Text style={{ color: '#10b981', fontSize: 14, marginTop: 4 }}>✓ Photo uploaded</Text>
          </View>
        )}
        <View style={{ height: 12 }} />
        <Pressable onPress={next} style={[s.btn, s.btnPrimary, !twinUrl && { opacity: 0.5 }]} disabled={!twinUrl}>
          <Text style={s.btnPrimaryText}>Continue →</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function Shop() {
  const { state: { products }, setRoute, setCurrentProduct, setDetectedProduct } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showProductDetector, setShowProductDetector] = useState(false);
  const [allProducts, setAllProducts] = useState(enhancedProducts);
  
  // Use the global enhancedProducts array
  
  // Load additional products from real clothing brands
  useEffect(() => {
    const loadAdditionalProducts = async () => {
      try {
        const realProducts = await fetchRealClothingProducts();
        setAllProducts([...enhancedProducts, ...realProducts]);
      } catch (error) {
        console.error('Error loading additional products:', error);
        setAllProducts(enhancedProducts);
      }
    };
    
    loadAdditionalProducts();
  }, []);

  // Enhanced NLP search function
  const performSearch = (query) => {
    if (!query.trim()) {
      setFilteredProducts(allProducts);
      return;
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const filtered = allProducts.filter(product => {
      const searchableText = `${product.name} ${product.brand} ${product.category} ${product.color} ${product.material} ${product.garment_des}`.toLowerCase();
      
      // Check for exact matches first
      if (searchableText.includes(query.toLowerCase())) {
        return true;
      }
      
      // Check for partial matches
      return searchTerms.every(term => searchableText.includes(term));
    });
    
    setFilteredProducts(filtered);
  };

  // Initialize with all products
  useEffect(() => {
    setFilteredProducts(allProducts);
  }, [allProducts]);
  
  const handleSearch = (text) => {
    setSearchQuery(text);
    performSearch(text);
  };

  const handleProductDetected = (newProduct) => {
    // Store the detected product and navigate to product details
    setDetectedProduct(newProduct);
    setCurrentProduct(newProduct.id);
    setRoute('product');
    setShowProductDetector(false);
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Search Bar */}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={{ color: '#a1a1aa', marginRight: 8 }}>⌕</Text>
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search dresses, brands, colors..."
              placeholderTextColor="#a1a1aa"
              style={{ flex: 1, color: '#e4e4e7', fontSize: 14 }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(''); setFilteredProducts(allProducts); }}>
                <Text style={{ color: '#a1a1aa', fontSize: 16 }}>✕</Text>
              </Pressable>
            )}
          </View>
          
          <Pressable 
            onPress={() => setShowProductDetector(true)}
            style={{ 
              backgroundColor: '#10b981', 
              paddingHorizontal: 16, 
              paddingVertical: 12, 
              borderRadius: 16 
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              + Detect
            </Text>
          </Pressable>
        </View>
      </View>
      
      {/* Products Grid */}
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between',
          gap: 12
        }}>
          {filteredProducts.map((product, index) => (
            <Pressable 
              key={product.id} 
              onPress={() => { setCurrentProduct(product.id); setRoute('product'); }}
              style={{ 
                width: '48%',
                marginBottom: 16
              }}
            >
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 16,
                overflow: 'hidden',
                position: 'relative'
              }}>
            <Image 
                  source={{ uri: product.image }} 
                  style={{ 
                    width: '100%', 
                    height: 200,
                    backgroundColor: 'rgba(255,255,255,0.05)'
                  }}
                  resizeMode="cover"
                />
                
                {/* Floating Overlays */}
                <View style={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    ${product.price}
                  </Text>
            </View>
                
                <View style={{ 
                  position: 'absolute', 
                  bottom: 8, 
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12
                }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>👁</Text>
                </View>
                
                {/* Product Info */}
            <View style={{ padding: 12 }}>
                  <Text style={{ 
                    color: '#e4e4e7', 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 4,
                    numberOfLines: 1
                  }}>
                    {product.name}
                  </Text>
                  <Text style={{ 
                    color: '#a1a1aa', 
                    fontSize: 12, 
                    marginBottom: 2
                  }}>
                    {product.brand}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: '#10b981', fontSize: 12 }}>⭐ {product.rating}</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }}>•</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{product.color}</Text>
            </View>
                </View>
              </View>
        </Pressable>
      ))}
        </View>
        
        {filteredProducts.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 16, textAlign: 'center' }}>
              No products found for "{searchQuery}"
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              Try searching for brands, colors, or categories
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Product Detector Overlay */}
      {showProductDetector && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <ProductDetector 
            onProductDetected={handleProductDetected}
            onClose={() => setShowProductDetector(false)}
          />
        </View>
      )}
    </View>
  );
}

function Product() {
  const { state: { currentProductId, detectedProduct }, setRoute } = useApp();
  const [allProducts, setAllProducts] = useState([...enhancedProducts]);
  const [product, setProduct] = useState(null);
  const [cleanUrl, setCleanUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingPrice, setTrackingPrice] = useState('');
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [priceHistory, setPriceHistory] = useState([
    { date: '2024-01-15', price: 129 },
    { date: '2024-01-10', price: 119 },
    { date: '2024-01-05', price: 139 },
    { date: '2024-01-01', price: 119 }
  ]);

  // Load all products including detected ones
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const realProducts = await fetchRealClothingProducts();
        const allProductsList = [...enhancedProducts, ...realProducts];
        setAllProducts(allProductsList);
        
        // Find the current product
        const currentProduct = allProductsList.find(p => p.id === currentProductId);
        setProduct(currentProduct);
        
        if (currentProduct) {
          // Upload garment image to Supabase for Replicate access
          uploadGarmentImage(currentProduct.image, currentProduct.id)
            .then(url => {
              setCleanUrl(url);
              setLoading(false);
            })
            .catch(error => {
              console.error('Garment upload error:', error);
              setCleanUrl(currentProduct.image);
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        const currentProduct = enhancedProducts.find(p => p.id === currentProductId);
        setProduct(currentProduct);
        setLoading(false);
      }
    };
    
    loadAllProducts();
  }, [currentProductId]);
  
  const togglePriceTracking = () => {
    if (!showPriceInput) {
      setShowPriceInput(true);
      setTrackingPrice(lowestPrice.toString());
    } else if (trackingPrice && !isTracking) {
      setIsTracking(true);
      Alert.alert('Price Tracking Enabled', `You'll be notified when the price drops below $${trackingPrice}`);
    } else {
      setIsTracking(false);
      setShowPriceInput(false);
      setTrackingPrice('');
    }
  };
  
  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>
          Product Not Found
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          The product you're looking for doesn't exist or has been removed.
        </Text>
        <Pressable 
          onPress={() => setRoute('shop')}
          style={{ 
            backgroundColor: '#10b981', 
            paddingHorizontal: 24, 
            paddingVertical: 12, 
            borderRadius: 12 
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            Back to Shop
          </Text>
        </Pressable>
      </View>
    );
  }
  
  const lowestPrice = Math.min(...priceHistory.map(p => p.price));
  const isOnSale = product.price < priceHistory[0].price;
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
        <Image source={{ uri: product.image }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          
          {/* Floating Try On Button */}
          <Pressable 
            onPress={() => setRoute('tryon', { garmentId: product.id, category: product.category, garmentCleanUrl: cleanUrl || product.image })}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: '#fff',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>✦ Try On</Text>
          </Pressable>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#e4e4e7', fontWeight: '700', fontSize: 16 }}>${product.price}</Text>
              {isOnSale && (
                <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>SALE</Text>
                </View>
              )}
            </View>
            {isOnSale && (
              <Text style={{ color: '#10b981', fontSize: 12 }}>Lowest: ${lowestPrice} • Save ${priceHistory[0].price - product.price}</Text>
            )}
          </View>
          <Text style={{ color: '#a1a1aa' }}>Free returns</Text>
        </View>
        <Text style={{ color: '#a1a1aa' }}>Fabric: Cotton blend • Shipping: 2–4 days • Returns: 30 days</Text>
        
        {/* Action Buttons - Side by Side */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {/* Buy Now Button */}
          <Pressable 
            style={{ 
              flex: 1, 
              backgroundColor: '#fff',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Buy Now</Text>
            <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>${product.price}</Text>
          </Pressable>
          
          {/* Price Tracking Button */}
          <Pressable 
            onPress={togglePriceTracking}
            style={{
              flex: 1,
              backgroundColor: isTracking ? '#10b981' : 'rgba(255,255,255,0.1)',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: isTracking ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>
              {isTracking ? '🔔' : '◉'}
            </Text>
            <Text style={{ 
              color: isTracking ? '#fff' : '#e4e4e7', 
              fontSize: 14, 
              fontWeight: '600',
              textAlign: 'center'
            }}>
              {isTracking ? 'Tracking Active' : showPriceInput ? 'Set Price & Track' : 'Track Price'}
            </Text>
          </Pressable>
        </View>
        
        {/* Price Tracking Details - Expandable */}
        {showPriceInput && (
          <View style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            borderRadius: 12, 
            padding: 16, 
            marginTop: 12,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.2)'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>
                {isTracking ? 'Price Tracking Active' : 'Set Your Price Alert'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: '#10b981', fontSize: 12 }}>30d Low: ${lowestPrice}</Text>
                <Text style={{ color: '#ef4444', fontSize: 12 }}>30d High: ${Math.max(...priceHistory.map(p => p.price))}</Text>
              </View>
            </View>
            
            {/* Custom Price Input - Inline */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Notify me when price drops below:</Text>
              <Text style={{ color: '#e4e4e7', fontSize: 16 }}>$</Text>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: '#e4e4e7',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  maxWidth: 80
                }}
                placeholder={lowestPrice.toString()}
                placeholderTextColor="#a1a1aa"
                keyboardType="numeric"
                value={trackingPrice}
                onChangeText={setTrackingPrice}
              />
            </View>
            
            {!isTracking && (
            <Pressable
                onPress={togglePriceTracking}
                style={{
                  backgroundColor: '#10b981',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  Start Tracking at ${trackingPrice}
                </Text>
            </Pressable>
            )}
        </View>
        )}
      </View>
        
        <Pressable onPress={() => setRoute('shop')} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>← Back to shop</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function TryOn() {
  const { state: { twinUrl, currentProductId, tryOnResults }, setRoute, setTwinUrl, setTryOnResults } = useApp();
  const [allProducts, setAllProducts] = useState([...enhancedProducts]);
  const [product, setProduct] = useState(null);
  const garmentCleanUrl = useApp().state.params?.garmentCleanUrl;
  const garmentId = useApp().state.params?.garmentId;
  const category = useApp().state.params?.category;
  
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayContent, setOverlayContent] = useState(null);
  const [showOutfitAnalysis, setShowOutfitAnalysis] = useState(false);

  // Load all products including detected ones
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const realProducts = await fetchRealClothingProducts();
        const allProductsList = [...enhancedProducts, ...realProducts];
        setAllProducts(allProductsList);
        
        // Find the current product
        const currentProduct = allProductsList.find(p => p.id === currentProductId);
        setProduct(currentProduct);
      } catch (error) {
        console.error('Error loading products:', error);
        const currentProduct = enhancedProducts.find(p => p.id === currentProductId);
        setProduct(currentProduct);
      }
    };
    
    loadAllProducts();
  }, [currentProductId]);
  
  if (!twinUrl) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#e4e4e7', fontSize: 18, marginBottom: 16 }}>No photo uploaded</Text>
        <Pressable onPress={() => setRoute('onboarding')} style={s.btn}>
          <Text style={s.btnText}>Upload Photo</Text>
        </Pressable>
      </View>
    );
  }
  
  const handleTryOn = async () => {
    if (!twinUrl || !garmentCleanUrl) {
      // Silently return - user will just see the original images
      console.log('Try-on skipped - missing user photo or garment');
      return;
    }
    
    try {
      setBusy(true);
      
      console.log('Starting AI try-on with:', { 
        userUrl: twinUrl, 
        garmentUrl: garmentCleanUrl, 
        garmentId, 
        category 
      });
      
      // Upload user image to Supabase if it's a local file
      let humanImgUrl = twinUrl;
      if (twinUrl.startsWith('file://')) {
        console.log('Uploading user image to Supabase...');
        humanImgUrl = await uploadImageAsync(twinUrl);
        console.log('User image uploaded:', humanImgUrl);
      }
      
      // Upload garment image to Supabase for Replicate access
      let garmentImgUrl = garmentCleanUrl;
      if (garmentCleanUrl && !garmentCleanUrl.includes('supabase')) {
        console.log('Uploading garment image to Supabase...');
        garmentImgUrl = await uploadGarmentImage(garmentCleanUrl, garmentId);
        console.log('Garment image uploaded:', garmentImgUrl);
      }
      
      // Convert URLs to data URIs for Replicate compatibility
      const convertToDataUri = async (url) => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.log('Failed to convert to data URI, using original URL:', error);
          return url;
        }
      };
      
      // Try to convert to data URIs, but fallback to URLs if they're too large
      let humanDataUri = humanImgUrl;
      let garmentDataUri = garmentImgUrl;
      
      try {
        const humanUri = await convertToDataUri(humanImgUrl);
        const garmentUri = await convertToDataUri(garmentImgUrl);
        
        // Use data URIs only if they're reasonable size (less than 1MB)
        if (humanUri.length < 1000000) {
          humanDataUri = humanUri;
        }
        if (garmentUri.length < 1000000) {
          garmentDataUri = garmentUri;
        }
        
        console.log('Using data URIs:', {
          human: humanDataUri !== humanImgUrl,
          garment: garmentDataUri !== garmentImgUrl
        });
      } catch (error) {
        console.log('Data URI conversion failed, using URLs:', error);
      }
      
      // Call try-on API directly
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          human_img: humanDataUri, 
          garm_img: garmentDataUri, 
          category,
          garment_des: product?.garment_des || "Garment item"
        })
      });
      
      console.log('API response status:', response.status);
      console.log('API response headers:', response.headers);
      
      const responseText = await response.text();
      console.log('API response text:', responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log('JSON parse error - response is not JSON:', parseError);
        console.log('Full response:', responseText);
        // Silently handle - user will see original images
        return;
      }
      
      console.log('Try-on response:', data);
      
      if (data.cache) {
        setResult(data.resultUrl);
        // Try-on loaded from cache
        return;
      }
      
      if (data.jobId) {
        // Poll for result
        let status;
        do {
          await new Promise(r => setTimeout(r, 2000));
          const pollResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/tryon/${data.jobId}?cacheKey=${data.cacheKey}`);
          status = await pollResponse.json();
          console.log('Polling status:', status);
        } while (status.status === 'queued' || status.status === 'processing');
        
        if (status.status === 'succeeded' && status.resultUrl) {
          setResult(status.resultUrl);
          // Save try-on result to Supabase for persistence
          await saveTryOnResult(status.resultUrl, product?.id, product?.name, setTryOnResults);
          // AI try-on generated successfully
        } else {
          // Silently handle failures - log for debugging but don't show to user
          console.log('Try-on failed silently:', status.error || 'Unknown error');
          // Just return without setting result - user will see the original images
        }
      } else {
        throw new Error(data.error || 'Failed to start try-on');
      }
    } catch (error) {
      // Log error for debugging but don't show to user
      console.error('Try-on error:', error);
      // Silently handle - user will just see the original images
    } finally {
      setBusy(false);
    }
  };

  const showFeatureOverlay = (content) => {
    setOverlayContent(content);
    setShowOverlay(true);
  };

  const hideOverlay = () => {
    setShowOverlay(false);
    setOverlayContent(null);
  };
  
  return (
    <TouchableWithoutFeedback onLongPress={() => setRoute('shop')}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>

      {/* Transparent Overlay */}
      {showOverlay && (
        <TouchableWithoutFeedback onPress={hideOverlay}>
          <View style={StyleSheet.absoluteFillObject}>
            <View style={{ 
              ...StyleSheet.absoluteFillObject, 
              backgroundColor: 'rgba(0,0,0,0.7)', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                padding: 24, 
                borderRadius: 20, 
                margin: 20,
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.2)' 
              }}>
                <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>
                  {overlayContent?.title || 'Feature'}
                </Text>
                <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  {overlayContent?.description || 'Feature description'}
                </Text>
                <Pressable 
                  onPress={hideOverlay}
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.1)', 
                    padding: 12, 
                    borderRadius: 12, 
                    marginTop: 16,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
      
      <View style={{ flex: 1, width: '100%', position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
        <Image source={{ uri: result || twinUrl }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        
        {/* Processing indicator in middle of photo */}
        {busy && (
          <View style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.7)', 
            justifyContent: 'center', 
            alignItems: 'center',
            borderRadius: 24
          }}>
            <View style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: 24, 
              borderRadius: 20, 
              alignItems: 'center', 
              borderWidth: 1, 
              borderColor: 'rgba(255,255,255,0.2)',
              margin: 20
            }}>
              <Text style={{ fontSize: 32, marginBottom: 16 }}>✨</Text>
              <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>AI Processing...</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center' }}>Generating your try-on with AI</Text>
              <View style={{ width: 200, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 16, overflow: 'hidden' }}>
                <View style={{ width: '60%', height: '100%', backgroundColor: '#fff', borderRadius: 2 }} />
              </View>
            </View>
          </View>
        )}
        
        <Pressable onPress={() => setTwinUrl(null)} style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>📷 Change Photo</Text>
        </Pressable>
        
        {/* Top-right floating action buttons */}
        <View style={{ position: 'absolute', top: 17, right: 12, flexDirection: 'column', gap: 12 }}>
          <Pressable 
            onPress={() => setShowOutfitAnalysis(!showOutfitAnalysis)}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>⌕</Text>
          </Pressable>
          <Pressable 
            onPress={() => setRoute('createpod')}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>👥</Text>
          </Pressable>
          <Pressable 
            onPress={() => setRoute('suggested-outfits')}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>◊</Text>
          </Pressable>
        </View>
        
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', gap: 8 }}>
          <Pressable 
            onPress={handleTryOn} 
            disabled={busy}
            style={{ 
              backgroundColor: busy ? 'rgba(255,255,255,0.3)' : '#fff', 
              paddingHorizontal: 14, 
              paddingVertical: 10, 
              borderRadius: 14,
              opacity: busy ? 0.6 : 1
            }}
          >
            <Text style={{ color: busy ? '#666' : '#000', fontWeight: '700' }}>
              {busy ? '⏳ Processing...' : '✦ Try On'}
            </Text>
          </Pressable>
          {result && (
            <Pressable 
              onPress={() => Linking.openURL(product?.buyUrl || 'https://example.com')} 
              style={{ backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>◉ Buy</Text>
            </Pressable>
          )}
        </View>
        
        {/* Expandable Outfit Analysis */}
        {showOutfitAnalysis && (
          <View style={{ 
            backgroundColor: 'rgba(128,128,128,0.15)', 
            borderRadius: 16, 
            margin: 16, 
            borderWidth: 1, 
            borderColor: 'rgba(255,255,255,0.1)' 
          }}>
            <Pressable 
              onPress={() => setShowOutfitAnalysis(false)}
              style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: 16 
              }}
            >
              <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600' }}>
                Outfit Analysis
              </Text>
              <Text style={{ color: '#a1a1aa', fontSize: 20 }}>
                −
              </Text>
            </Pressable>
            
            <View style={{ padding: 16, paddingTop: 0 }}>
              <Text style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                This outfit features a modern silhouette with excellent color coordination. The proportions work well for your body type, and the styling suggests a contemporary, confident look.
              </Text>
              
              {/* Chat Input */}
              <View style={{ 
                flexDirection: 'row', 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                padding: 8,
                alignItems: 'center'
              }}>
                <TextInput
                  placeholder="Ask about this outfit..."
                  placeholderTextColor="#a1a1aa"
                  style={{ 
                    flex: 1, 
                    color: '#e4e4e7', 
                    fontSize: 14, 
                    paddingHorizontal: 8 
                  }}
                />
                <Pressable style={{ 
                  backgroundColor: '#10b981', 
                  paddingHorizontal: 12, 
                  paddingVertical: 6, 
                  borderRadius: 8 
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Send</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function Explore() {
  const { setRoute } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votedItems, setVotedItems] = useState(new Set());
  
  // 30 items for Explore page with voting
  const exploreItems = [
    { 
      id: 'e1', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200', 
      handle: '@mina', 
      sub: 'Party • Streetwear',
      likes: 234,
      comments: 12,
      isPodRecap: false
    },
    { 
      id: 'e2', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', 
      handle: '@sophia',
      sub: 'Office • Minimalist',
      likes: 189,
      comments: 8,
      isPodRecap: true,
      podResult: 'Global Mix picked this dress (78%)'
    },
    { 
      id: 'e3', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200', 
      handle: '@zara', 
      sub: 'Casual • Boho',
      likes: 156,
      comments: 5,
      isPodRecap: false,
      aiLabel: 'AI Styling'
    },
    { 
      id: 'e4', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200', 
      handle: '@alex', 
      sub: 'Formal • Business',
      likes: 298,
      comments: 23,
      isPodRecap: false
    },
    { 
      id: 'e5', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@taylor',
      sub: 'Casual • Weekend',
      likes: 167,
      comments: 9,
      isPodRecap: true,
      podResult: 'Style Twins prefer this (82%)'
    },
    { 
      id: 'e6', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@maya', 
      sub: 'Vintage • Retro',
      likes: 201,
      comments: 15,
      isPodRecap: false,
      aiLabel: 'Trending Fit'
    },
    { 
      id: 'e7', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200', 
      handle: '@jordan', 
      sub: 'Athletic • Sporty',
      likes: 145,
      comments: 7,
      isPodRecap: false
    },
    { 
      id: 'e8', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@riley',
      sub: 'Elegant • Evening',
      likes: 312,
      comments: 18,
      isPodRecap: true,
      podResult: 'Friends voted Yes (91%)'
    },
    { 
      id: 'e9', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@casey', 
      sub: 'Bohemian • Free Spirit',
      likes: 178,
      comments: 11,
      isPodRecap: false,
      aiLabel: 'Celeb Inspired'
    },
    { 
      id: 'e10', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200', 
      handle: '@sam', 
      sub: 'Preppy • Classic',
      likes: 223,
      comments: 14,
      isPodRecap: false
    },
    { 
      id: 'e11', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@blake',
      sub: 'Edgy • Alternative',
      likes: 189,
      comments: 6,
      isPodRecap: true,
      podResult: 'Global Mix says No (65%)'
    },
    { 
      id: 'e12', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@quinn', 
      sub: 'Romantic • Feminine',
      likes: 267,
      comments: 19,
      isPodRecap: false,
      aiLabel: 'Seasonal Drop'
    },
    { 
      id: 'e13', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200', 
      handle: '@sage', 
      sub: 'Minimalist • Clean',
      likes: 198,
      comments: 8,
      isPodRecap: false
    },
    { 
      id: 'e14', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@river',
      sub: 'Artistic • Creative',
      likes: 234,
      comments: 16,
      isPodRecap: true,
      podResult: 'Style Twins love this (89%)'
    },
    { 
      id: 'e15', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@skyler', 
      sub: 'Modern • Contemporary',
      likes: 156,
      comments: 4,
      isPodRecap: false,
      aiLabel: 'AI Styling'
    },
    { 
      id: 'e16', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200', 
      handle: '@luna', 
      sub: 'Y2K • Retro',
      likes: 189,
      comments: 8,
      isPodRecap: false
    },
    { 
      id: 'e17', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200', 
      handle: '@nova',
      sub: 'Streetwear • Urban',
      likes: 223,
      comments: 14,
      isPodRecap: true,
      podResult: 'Global Mix says Yes (67%)'
    },
    { 
      id: 'e18', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&auto=format&fit=crop&w=1200', 
      handle: '@zen', 
      sub: 'Minimalist • Clean',
      likes: 167,
      comments: 6,
      isPodRecap: false,
      aiLabel: 'Trending Fit'
    },
    { 
      id: 'e19', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200', 
      handle: '@phoenix', 
      sub: 'Gothic • Dark',
      likes: 198,
      comments: 12,
      isPodRecap: false
    },
    { 
      id: 'e20', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&auto=format&fit=crop&w=1200', 
      handle: '@sage',
      sub: 'Vintage • Classic',
      likes: 245,
      comments: 19,
      isPodRecap: true,
      podResult: 'Style Twins love this (89%)'
    },
    { 
      id: 'e21', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200', 
      handle: '@river', 
      sub: 'Bohemian • Flowy',
      likes: 134,
      comments: 9,
      isPodRecap: false,
      aiLabel: 'Celeb Inspired'
    },
    { 
      id: 'e22', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@storm', 
      sub: 'Athletic • Performance',
      likes: 176,
      comments: 7,
      isPodRecap: false
    },
    { 
      id: 'e23', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&auto=format&fit=crop&w=1200', 
      handle: '@blaze',
      sub: 'Formal • Elegant',
      likes: 287,
      comments: 16,
      isPodRecap: true,
      podResult: 'Friends approved (94%)'
    },
    { 
      id: 'e24', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', 
      handle: '@ember', 
      sub: 'Casual • Comfort',
      likes: 156,
      comments: 5,
      isPodRecap: false,
      aiLabel: 'AI Styling'
    },
    { 
      id: 'e25', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200', 
      handle: '@coral', 
      sub: 'Summer • Bright',
      likes: 203,
      comments: 11,
      isPodRecap: false
    },
    { 
      id: 'e26', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?q=80&auto=format&fit=crop&w=1200', 
      handle: '@mint',
      sub: 'Preppy • Fresh',
      likes: 167,
      comments: 8,
      isPodRecap: true,
      podResult: 'Global Mix mixed (52%)'
    },
    { 
      id: 'e27', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&auto=format&fit=crop&w=1200', 
      handle: '@pearl', 
      sub: 'Luxury • High-end',
      likes: 234,
      comments: 13,
      isPodRecap: false,
      aiLabel: 'Trending Fit'
    },
    { 
      id: 'e28', 
      type: 'public_post',
      uri: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&auto=format&fit=crop&w=1200', 
      handle: '@opal', 
      sub: 'Artistic • Creative',
      likes: 145,
      comments: 6,
      isPodRecap: false
    },
    { 
      id: 'e29', 
      type: 'pod_recap',
      uri: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200', 
      handle: '@ruby',
      sub: 'Bold • Statement',
      likes: 198,
      comments: 15,
      isPodRecap: true,
      podResult: 'Style Twins split (45%)'
    },
    { 
      id: 'e30', 
      type: 'ai_generated',
      uri: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', 
      handle: '@diamond', 
      sub: 'Futuristic • Tech',
      likes: 167,
      comments: 9,
      isPodRecap: false,
      aiLabel: 'Celeb Inspired'
    }
  ];

  const currentItem = exploreItems[currentIndex];
  const hasVoted = votedItems.has(currentItem.id);

  const handleVote = (vote) => {
    setVotedItems(prev => new Set([...prev, currentItem.id]));
    // Auto advance immediately after voting
    if (currentIndex < exploreItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const nextItem = () => {
    if (currentIndex < exploreItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ width: '100%', height: '100%', position: 'relative', marginTop: 20 }}>
        <Image source={{ uri: currentItem.uri }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: 24 }} />
        
        {/* Top overlay with user info and type indicator */}
        <View style={{ position: 'absolute', left: 12, top: 12, right: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 }}>{currentItem.handle}</Text>
              <Text style={{ color: '#fff', opacity: 0.9, fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 }}>{currentItem.sub}</Text>
        </View>

            {currentItem.isPodRecap && (
              <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Pod Recap</Text>
              </View>
            )}
            
            {currentItem.aiLabel && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{currentItem.aiLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pod result overlay */}
        {currentItem.isPodRecap && currentItem.podResult && (
          <View style={{ position: 'absolute', left: 12, top: 80, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{currentItem.podResult}</Text>
          </View>
        )}

        {/* Top-right vertical action buttons */}
        <View style={{ position: 'absolute', right: 12, top: 16, flexDirection: 'column', gap: 8 }}>
          <Pressable 
            onPress={() => setRoute('tryon')}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>👗</Text>
            </Pressable>
          <Pressable 
            onPress={() => setRoute('createpod')}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>👥</Text>
          </Pressable>
          <Pressable 
            onPress={() => setRoute('suggest', { itemId: currentItem.id, itemType: currentItem.type })}
            style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 26, 
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <Text style={{ fontSize: 20 }}>◈</Text>
          </Pressable>
        </View>

        {/* Voting buttons */}
        {!hasVoted ? (
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
            <Pressable 
              onPress={() => handleVote('dislike')}
              style={{ paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text style={{ fontSize: 32 }}>❌</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleVote('like')}
              style={{ paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text style={{ fontSize: 32 }}>❤️</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleVote('fire')}
              style={{ paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text style={{ fontSize: 32 }}>🔥</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 }}>
              Voted! Moving to next...
            </Text>
          </View>
        )}

        {/* Next button */}
        {hasVoted && (
          <View style={{ position: 'absolute', bottom: 20, right: 20 }}>
            <Pressable 
              onPress={nextItem}
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Next →</Text>
            </Pressable>
          </View>
        )}

        {/* Progress indicator removed */}

        {/* Instagram-style Suggested Items */}
        <View style={{ position: 'absolute', bottom: 80, left: 12, right: 12 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Suggested by Community
          </Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ height: 80, flexGrow: 0 }}
            contentContainerStyle={{ 
              paddingRight: 20, 
              alignItems: 'center',
              flexDirection: 'row'
            }}
            bounces={true}
            decelerationRate="normal"
            scrollEventThrottle={16}
            directionalLockEnabled={true}
            alwaysBounceHorizontal={true}
            pagingEnabled={false}
          >
            {[
              { id: 's1', name: 'White Shirt', price: 29, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=200', suggestedBy: '@sarah' },
              { id: 's2', name: 'Blue Jeans', price: 49, image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&auto=format&fit=crop&w=200', suggestedBy: '@mike' },
              { id: 's3', name: 'Black Blazer', price: 89, image: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=200', suggestedBy: '@alex' },
              { id: 's4', name: 'Red Dress', price: 79, image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=200', suggestedBy: '@emma' },
              { id: 's5', name: 'Green Jacket', price: 95, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&auto=format&fit=crop&w=200', suggestedBy: '@david' }
            ].map((suggestion, index) => (
              <View key={suggestion.id} style={{ width: 80, marginRight: 8, position: 'relative' }}>
                <Image 
                  source={{ uri: suggestion.image }} 
                  style={{ width: '100%', height: '100%', borderRadius: 8 }}
                  resizeMode="cover"
                />
                {/* Suggested by overlay */}
                <View style={{ 
                  position: 'absolute', 
                  top: 4, 
                  left: 4, 
                  backgroundColor: 'rgba(0,0,0,0.7)', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                    {suggestion.suggestedBy}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          
          {/* Dots indicator */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 }}>
            {[1, 2, 3, 4, 5].map((dot, index) => (
              <View 
                key={dot}
                style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: index === 0 ? '#10b981' : 'rgba(255,255,255,0.3)' 
                }} 
              />
            ))}
          </View>
        </View>

        {/* Bottom overlay with likes and comments */}
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>❤️</Text>
              <Text style={{ color: '#fff', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 }}>{currentItem.likes}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>💬</Text>
              <Text style={{ color: '#fff', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 }}>{currentItem.comments}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}



function AskHelp() {
  const { setRoute } = useApp();
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>Ask for Help</Text>
        <Text style={s.muted}>Get feedback from friends on your outfit</Text>
        <View style={{ height: 24 }} />
        <Pressable onPress={() => setRoute('createpod')} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>Create Help Room</Text>
        </Pressable>
        <Pressable onPress={() => setRoute('rooms')} style={s.btn}>
          <Text style={s.btnText}>View My Rooms</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function CreatePod() {
  const { setRoute, createRoom } = useApp();
  const [selectedMode, setSelectedMode] = useState('friends');
  const [duration, setDuration] = useState(60);
  
  const podModes = [
    {
      id: 'friends',
      title: 'Friends Pod',
      description: 'Invite your friends for feedback',
      duration: '30-120 min',
      features: ['Comments allowed', 'Longer duration', 'Personal feedback'],
      icon: '👥'
    },
    {
      id: 'taste-twins',
      title: 'Style Twins',
      description: 'AI finds people with similar style',
      duration: '5-15 min',
      features: ['Anonymous votes only', 'Style-matched audience', 'Fast feedback'],
      icon: '🎯'
    },
    {
      id: 'global-mix',
      title: 'Global Mix',
      description: 'Open to everyone worldwide',
      duration: '15-30 min',
      features: ['Anyone can vote', 'Cultural insights', 'Broader perspective'],
      icon: '🌍'
    }
  ];
  
  const create = () => {
    const mode = podModes.find(m => m.id === selectedMode);
    const room = createRoom({ 
      lookId: 'current-look', 
      mode: selectedMode, 
      durationMins: duration, 
      title: mode.title 
    });
    setRoute('room_owner', { roomId: room.id });
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Interactive Header */}
      <View style={{ 
        paddingHorizontal: 16, 
        paddingTop: 16, 
        paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Elements */}
        <View style={{ 
          position: 'absolute', 
          top: -50, 
          right: -50, 
          width: 200, 
          height: 200, 
          borderRadius: 100, 
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          opacity: 0.6
        }} />
        <View style={{ 
          position: 'absolute', 
          bottom: -30, 
          left: -30, 
          width: 120, 
          height: 120, 
          borderRadius: 60, 
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          opacity: 0.4
        }} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.2)', 
            borderRadius: 24, 
            padding: 16, 
            marginRight: 20,
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            <Text style={{ fontSize: 40 }}>👥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '800', marginBottom: 6 }}>Create Pod</Text>
            <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '600' }}>Get Style Feedback</Text>
          </View>
        </View>
        
        <Text style={{ color: '#a1a1aa', fontSize: 18, lineHeight: 28, marginBottom: 24 }}>
          Choose your audience and get instant feedback on your outfit from the community.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Interactive Pod Mode Selection */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
            Choose Your Audience
          </Text>
          
          <View style={{ gap: 16 }}>
            {podModes.map(mode => (
              <Pressable 
                key={mode.id}
                onPress={() => setSelectedMode(mode.id)}
                style={{
                  backgroundColor: selectedMode === mode.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: selectedMode === mode.id ? 2 : 1,
                  borderColor: selectedMode === mode.id ? '#10b981' : 'rgba(255,255,255,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {selectedMode === mode.id && (
                  <View style={{ 
                    position: 'absolute', 
                    top: 12, 
                    right: 12, 
                    width: 24, 
                    height: 24, 
                    backgroundColor: '#10b981', 
                    borderRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>
                  </View>
                )}
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 32, marginRight: 16 }}>{mode.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: selectedMode === mode.id ? '#10b981' : '#e4e4e7', 
                      fontSize: 18, 
                      fontWeight: '700', 
                      marginBottom: 4 
                    }}>
                      {mode.title}
                    </Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                      {mode.description}
                    </Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {mode.features.map((feature, index) => (
                    <View 
                      key={index}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)'
                      }}
                    >
                      <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{feature}</Text>
                    </View>
                  ))}
                </View>
        </Pressable>
            ))}
          </View>
        </View>
        
        {selectedMode === 'friends' && (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.label}>Duration</Text>
            <Text style={s.inputHint}>How long should this pod stay active?</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {[30, 60, 90, 120].map(mins => (
                <Pressable 
                  key={mins}
                  onPress={() => setDuration(mins)}
                  style={[s.btn, { 
                    flex: 1,
                    backgroundColor: duration === mins ? 'rgba(255,255,255,0.1)' : 'transparent',
                    borderColor: duration === mins ? '#fff' : 'rgba(255,255,255,0.2)',
                    marginBottom: 0
                  }]}
                >
                  <Text style={[s.btnText, { color: duration === mins ? '#fff' : '#a1a1aa' }]}>
                    {mins}m
                  </Text>
        </Pressable>
              ))}
            </View>
          </View>
        )}
        
        <Pressable onPress={create} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>Create Pod</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RoomsInbox() {
  const { state: { rooms }, setRoute } = useApp();
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('askhelp')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={s.h1}>My Pods</Text>
      </View>

      <Text style={s.muted}>Active feedback rooms</Text>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {rooms.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>👥</Text>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>No Active Pods</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center' }}>
              Create your first Pod to get feedback on your outfits
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {rooms.map(room => {
              const getModeIcon = (mode) => {
                switch(mode) {
                  case 'friends': return '👥';
                  case 'taste-twins': return '🎯';
                  case 'global-mix': return '🌍';
                  default: return '👥';
                }
              };
              
              return (
                <Pressable 
                  key={room.id} 
                  onPress={() => setRoute('room_owner', { roomId: room.id })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)'
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{getModeIcon(room.mode)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                      {room.title}
                    </Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                      {room.votes.yes + room.votes.maybe + room.votes.no} votes • Expires in {Math.ceil((room.expiresAt - Date.now()) / 60000)}m
                    </Text>
                  </View>
                  <Text style={{ color: '#10b981', fontSize: 12 }}>→</Text>
            </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function RoomOwner() {
  const { state: { rooms }, vote, setRoute } = useApp();
  const roomId = useApp().state.params?.roomId;
  const room = rooms.find(r => r.id === roomId);
  
  if (!room) return null;
  
  const getModeInfo = (mode) => {
    switch(mode) {
      case 'friends':
        return { icon: '👥', color: '#3b82f6', description: 'Friends Pod' };
      case 'taste-twins':
        return { icon: '🎯', color: '#10b981', description: 'Style Twins' };
      case 'global-mix':
        return { icon: '🌍', color: '#f59e0b', description: 'Global Mix' };
      default:
        return { icon: '👥', color: '#3b82f6', description: 'Pod' };
    }
  };
  
  const modeInfo = getModeInfo(room.mode);
  const totalVotes = room.votes.yes + room.votes.maybe + room.votes.no;
  const yesPercentage = totalVotes > 0 ? Math.round((room.votes.yes / totalVotes) * 100) : 0;
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('rooms')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={s.h1}>Pod Room</Text>
      </View>

      {/* Pod Status Header */}
      <View style={{ 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>{modeInfo.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600' }}>{modeInfo.description}</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Active • {Math.ceil((room.expiresAt - Date.now()) / 60000)}m left</Text>
          </View>
        </View>
        
        {room.mode === 'taste-twins' && (
          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Taste Twin Match</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>AI found people with 87% style similarity to you</Text>
          </View>
        )}
        
        {/* Live Voting Results */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600' }}>Live Results</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{totalVotes} votes</Text>
          </View>
          
          {/* Circular Progress for Yes votes */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8
            }}>
              <Text style={{ color: '#10b981', fontSize: 24, fontWeight: '700' }}>{yesPercentage}%</Text>
            </View>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>🔥 Yes</Text>
          </View>
          
          {/* Vote Distribution */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>❤️ Maybe</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 18, fontWeight: '600' }}>{room.votes.maybe}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>❌ No</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 18, fontWeight: '600' }}>{room.votes.no}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Share Pod</Text>
        <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16 }}>
          {room.mode === 'friends' ? 'Send link to your friends' : 
           room.mode === 'taste-twins' ? 'AI will find your style twins automatically' :
           'Pod is open to everyone in Explore'}
        </Text>
        
        {room.mode === 'friends' && (
          <Pressable style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>Copy Link</Text>
        </Pressable>
        )}
      </View>

        <Pressable onPress={() => setRoute('recap')} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>See AI Recap</Text>
        </Pressable>
    </View>
  );
}

function RoomGuest() {
  const { setRoute } = useApp();
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('feed')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={s.h1}>Guest Room</Text>
      </View>
      
      <Text style={s.muted}>Vote on this outfit and suggest alternatives</Text>
      
      {/* Voting Interface */}
      <View style={{ 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        borderRadius: 20, 
        padding: 24, 
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
      }}>
        <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
          What do you think?
        </Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <Pressable style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontSize: 32 }}>❌</Text>
          </Pressable>
          <Pressable style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontSize: 32 }}>❤️</Text>
          </Pressable>
          <Pressable style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontSize: 32 }}>🔥</Text>
          </Pressable>
        </View>
        
        <Pressable 
          onPress={() => setRoute('suggest', { itemId: 'pod-item', itemType: 'pod' })}
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.3)'
          }}
        >
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>
            👗 Suggest Alternative
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Recap() {
  const { setRoute } = useApp();
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>AI Recap</Text>
        <Text style={s.muted}>Analysis of your outfit</Text>
        <View style={{ height: 24 }} />
        <Text style={{ color: '#e4e4e7' }}>• Confidence: 85%</Text>
        <Text style={{ color: '#e4e4e7' }}>• Style: Casual</Text>
        <Text style={{ color: '#e4e4e7' }}>• Best for: Weekend</Text>
        <View style={{ height: 24 }} />
        <Pressable onPress={() => setRoute('shop')} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>Back to Shop</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function AIAnalytics() {
  const { setRoute } = useApp();
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { type: 'ai', message: 'Hi! I can analyze your outfit and answer questions about styling. What would you like to know?' }
  ]);

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    
    const userMessage = { type: 'user', message: chatMessage };
    setChatHistory(prev => [...prev, userMessage]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = { 
        type: 'ai', 
        message: 'Based on your outfit, I can see you\'re going for a casual look. The color combination works well together. Would you like suggestions for accessories or similar styles?' 
      };
      setChatHistory(prev => [...prev, aiResponse]);
    }, 1000);
    
    setChatMessage('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('tryon')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>AI Analytics</Text>
      </View>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Outfit Analysis</Text>
        <Text style={{ color: '#a1a1aa', marginBottom: 8 }}>• Style: Casual Chic</Text>
        <Text style={{ color: '#a1a1aa', marginBottom: 8 }}>• Confidence Score: 85%</Text>
        <Text style={{ color: '#a1a1aa', marginBottom: 8 }}>• Best Occasions: Weekend, Casual Events</Text>
        <Text style={{ color: '#a1a1aa' }}>• Color Harmony: Excellent</Text>
      </View>

      <ScrollView style={{ flex: 1, marginBottom: 16 }}>
        {chatHistory.map((msg, index) => (
          <View key={index} style={{ 
            marginBottom: 12, 
            alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%'
          }}>
            <View style={{
              backgroundColor: msg.type === 'user' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.1)',
              padding: 12,
              borderRadius: 16,
              borderTopLeftRadius: msg.type === 'ai' ? 4 : 16,
              borderTopRightRadius: msg.type === 'user' ? 4 : 16
            }}>
              <Text style={{ color: '#fff', fontSize: 14 }}>{msg.message}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={chatMessage}
          onChangeText={setChatMessage}
          placeholder="Ask about styling..."
          placeholderTextColor="#a1a1aa"
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: 12,
            borderRadius: 16,
            color: '#e4e4e7',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)'
          }}
        />
        <Pressable 
          onPress={sendMessage}
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}
        >
          <Text style={{ color: '#10b981', fontWeight: '600' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SuggestedOutfits() {
  const { setRoute } = useApp();
  
  const suggestions = [
    { id: 1, name: 'Casual Denim Look', price: '$89', image: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=300' },
    { id: 2, name: 'Street Style Mix', price: '$120', image: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=300' },
    { id: 3, name: 'Minimalist Chic', price: '$95', image: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=300' }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('tryon')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Suggested Outfits</Text>
      </View>

      <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 20 }}>
        Similar styles that go well with your current look
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {suggestions.map(item => (
          <Pressable key={item.id} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}>
              <Image source={{ uri: item.image }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{item.name}</Text>
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{item.price}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function StyleCraft() {
  const { setRoute } = useApp();
  const [designType, setDesignType] = useState('upload');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [material, setMaterial] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [showQuotes, setShowQuotes] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo access.');
        return;
      }
      
      const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        quality: 0.9 
      });
      
      if (!res.canceled && res.assets && res.assets[0] && res.assets[0].uri) {
        setUploadedImage(res.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const submitDesign = () => {
    // Simulate sending to vendors and receiving quotes
    const mockQuotes = [
      {
        id: 1,
        vendor: 'Elite Tailors',
        rating: 4.8,
        price: 450,
        material: 'Premium Silk',
        shipping: 25,
        timeToStitch: '7-10 days',
        timeToDeliver: '3-5 days',
        refImage: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&auto=format&fit=crop&w=300',
        description: 'Handcrafted with attention to detail'
      },
      {
        id: 2,
        vendor: 'Modern Couture',
        rating: 4.6,
        price: 380,
        material: 'Cotton Blend',
        shipping: 20,
        timeToStitch: '5-7 days',
        timeToDeliver: '2-3 days',
        refImage: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=300',
        description: 'Contemporary design with modern fit'
      },
      {
        id: 3,
        vendor: 'Artisan Studio',
        rating: 4.9,
        price: 520,
        material: 'Luxury Fabric',
        shipping: 30,
        timeToStitch: '10-14 days',
        timeToDeliver: '5-7 days',
        refImage: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=300',
        description: 'Bespoke creation with premium materials'
      }
    ];
    
    setQuotes(mockQuotes);
    setShowQuotes(true);
  };

  if (showQuotes) {
  return (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={() => setShowQuotes(false)} style={{ marginRight: 16 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
          <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Vendor Quotes</Text>
      </View>

        <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 20 }}>
          Choose your preferred vendor for your custom design
          </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {quotes.map(quote => (
            <View key={quote.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 4 }}>{quote.vendor}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: '#10b981', fontSize: 14 }}>⭐ {quote.rating}</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{quote.material}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 20, fontWeight: '700' }}>${quote.price}</Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 12 }}>+ ${quote.shipping} shipping</Text>
                </View>
        </View>

              <Image source={{ uri: quote.refImage }} style={{ width: '100%', height: 150, borderRadius: 12, marginBottom: 12 }} resizeMode="cover" />
              
              <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>{quote.description}</Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
                  <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>Stitching Time</Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{quote.timeToStitch}</Text>
                </View>
                <View>
                  <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>Delivery Time</Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{quote.timeToDeliver}</Text>
        </View>
      </View>

              <Pressable style={{ padding: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>Proceed with this vendor</Text>
      </Pressable>
            </View>
          ))}
        </ScrollView>
    </View>
  );
}

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Interactive Hero Section */}
    <View style={{
        paddingHorizontal: 16, 
        paddingTop: 16, 
        paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Elements */}
      <View style={{
          position: 'absolute', 
          top: -50, 
          right: -50, 
          width: 200, 
          height: 200, 
          borderRadius: 100, 
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          opacity: 0.6
        }} />
        <View style={{ 
          position: 'absolute', 
          bottom: -30, 
          left: -30, 
          width: 120, 
          height: 120, 
          borderRadius: 60, 
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          opacity: 0.4
        }} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.2)', 
            borderRadius: 24, 
            padding: 16, 
            marginRight: 20,
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            <Text style={{ fontSize: 40 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '800', marginBottom: 6 }}>StyleCraft</Text>
            <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '600' }}>AI-Powered Custom Fashion</Text>
          </View>
        </View>
        
        <Text style={{ color: '#a1a1aa', fontSize: 18, lineHeight: 28, marginBottom: 24 }}>
          Transform your vision into reality. Upload inspiration, describe your dream outfit, and connect with professional tailors.
        </Text>
        
        {/* Interactive Stats Cards */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(16, 185, 129, 0.2)'
            }}>
              <Text style={{ color: '#10b981', fontSize: 24, fontWeight: '700' }}>500+</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Designs Created</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(59, 130, 246, 0.2)'
            }}>
              <Text style={{ color: '#3b82f6', fontSize: 24, fontWeight: '700' }}>50+</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Expert Tailors</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)'
            }}>
              <Text style={{ color: '#f59e0b', fontSize: 24, fontWeight: '700' }}>4.9★</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Satisfaction</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Creative Input Section */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
            Choose Your Creative Path
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
          <Pressable
              onPress={() => setDesignType('upload')}
            style={{
                flex: 1,
                backgroundColor: designType === 'upload' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                borderRadius: 20,
                padding: 20,
                alignItems: 'center',
                borderWidth: designType === 'upload' ? 2 : 1,
                borderColor: designType === 'upload' ? '#10b981' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {designType === 'upload' && (
                <View style={{ 
                  position: 'absolute', 
                  top: 0, 
                  right: 0, 
                  width: 30, 
                  height: 30, 
                  backgroundColor: '#10b981', 
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>
                </View>
              )}
              <Text style={{ fontSize: 32, marginBottom: 12 }}>📷</Text>
              <Text style={{ color: designType === 'upload' ? '#10b981' : '#e4e4e7', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
                Visual Inspiration
              </Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center', lineHeight: 16 }}>
                Upload photos, sketches, or mood boards
              </Text>
          </Pressable>
            
        <Pressable
              onPress={() => setDesignType('describe')}
          style={{
                flex: 1,
                backgroundColor: designType === 'describe' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                borderRadius: 20,
                padding: 20,
                alignItems: 'center',
                borderWidth: designType === 'describe' ? 2 : 1,
                borderColor: designType === 'describe' ? '#10b981' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {designType === 'describe' && (
                <View style={{ 
                  position: 'absolute', 
                  top: 0, 
                  right: 0, 
                  width: 30, 
                  height: 30, 
                  backgroundColor: '#10b981', 
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>
                </View>
              )}
              <Text style={{ fontSize: 32, marginBottom: 12 }}>✍️</Text>
              <Text style={{ color: designType === 'describe' ? '#10b981' : '#e4e4e7', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
                Describe Your Vision
              </Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center', lineHeight: 16 }}>
                Tell us about your dream outfit
              </Text>
        </Pressable>
      </View>
        </View>

        {/* Image Upload */}
        {designType === 'upload' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.label}>Upload Reference Image</Text>
            <Pressable onPress={pickImage} style={[s.inputBox, { height: 120, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' }]}>
              {uploadedImage ? (
                <Image source={{ uri: uploadedImage }} style={{ width: 100, height: 100, borderRadius: 8 }} />
              ) : (
                <>
                  <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 8 }}>📷</Text>
                  <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Tap to upload image</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Description */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={s.label}>Design Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your dream dress... (style, occasion, fit, etc.)"
            placeholderTextColor="#a1a1aa"
            multiline
            numberOfLines={4}
            style={[s.inputBox, { height: 100, textAlignVertical: 'top' }]}
          />
        </View>

        {/* Budget and Material */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.label}>Preferences</Text>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={s.inputHint}>Budget Range</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              placeholder="e.g., $200-500"
              placeholderTextColor="#a1a1aa"
              style={s.inputBox}
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={s.inputHint}>Preferred Material</Text>
            <TextInput
              value={material}
              onChangeText={setMaterial}
              placeholder="e.g., Silk, Cotton, Linen"
              placeholderTextColor="#a1a1aa"
              style={s.inputBox}
            />
          </View>

          <View>
            <Text style={s.inputHint}>Additional Notes</Text>
            <TextInput
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder="Any special requirements or details..."
              placeholderTextColor="#a1a1aa"
              multiline
              numberOfLines={3}
              style={[s.inputBox, { height: 80, textAlignVertical: 'top' }]}
            />
          </View>
        </View>

        <Pressable onPress={submitDesign} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>Get Vendor Quotes</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function OldAccountScreen({ onBack }) {
  const { state: { user, twinUrl }, setUser, setRoute, setTwinUrl } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    bodyPhoto: twinUrl
  });

  const pickBodyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo access.');
        return;
      }
      
      const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        quality: 0.9 
      });
      
      if (!res.canceled && res.assets && res.assets[0] && res.assets[0].uri) {
        setProfileData(prev => ({ ...prev, bodyPhoto: res.assets[0].uri }));
        setTwinUrl(res.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const saveProfile = () => {
    setUser(prev => ({ ...prev, ...profileData }));
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleSignOut = async () => {
    try {
      setUser(null);
      setTwinUrl(null);
      setRoute('signin');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Interactive Profile Header */}
      <View style={{ 
        paddingHorizontal: 16, 
        paddingTop: 16, 
        paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Elements */}
        <View style={{ 
          position: 'absolute', 
          top: -40, 
          right: -40, 
          width: 160, 
          height: 160, 
          borderRadius: 80, 
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          opacity: 0.6
        }} />
        <View style={{ 
          position: 'absolute', 
          bottom: -20, 
          left: -20, 
          width: 100, 
          height: 100, 
          borderRadius: 50, 
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          opacity: 0.4
        }} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.2)', 
            borderRadius: 24, 
            padding: 16, 
            marginRight: 20,
            shadowColor: '#3b82f6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '800', marginBottom: 6 }}>My Profile</Text>
            <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '600' }}>Manage Your Account</Text>
          </View>
        </View>
        
        <Text style={{ color: '#a1a1aa', fontSize: 18, lineHeight: 28, marginBottom: 24 }}>
          Customize your profile, manage preferences, and track your fashion journey.
        </Text>
        
        {/* Profile Stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(59, 130, 246, 0.2)'
            }}>
              <Text style={{ color: '#3b82f6', fontSize: 24, fontWeight: '700' }}>12</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Outfits Created</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(16, 185, 129, 0.2)'
            }}>
              <Text style={{ color: '#10b981', fontSize: 24, fontWeight: '700' }}>8</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Pods Joined</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.1)', 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)'
            }}>
              <Text style={{ color: '#f59e0b', fontSize: 24, fontWeight: '700' }}>24</Text>
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Suggestions Made</Text>
          </View>
        </View>
      </View>

        <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={s.label}>Profile Photo</Text>
          
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            {profileData.bodyPhoto ? (
              <Image source={{ uri: profileData.bodyPhoto }} style={{ width: 120, height: 120, borderRadius: 60 }} />
            ) : (
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#a1a1aa', fontSize: 24 }}>📷</Text>
              </View>
            )}
          </View>
          
          <Pressable onPress={pickBodyPhoto} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>
              {profileData.bodyPhoto ? 'Change Photo' : 'Upload Body Photo'}
            </Text>
          </Pressable>
        </View>

        {/* Profile Information */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600' }}>Profile Information</Text>
            <Pressable onPress={() => setIsEditing(!isEditing)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 16 }}>
        <View>
              <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Name</Text>
              {isEditing ? (
                <TextInput
                  value={profileData.name}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
                  placeholder="Enter your name"
                  placeholderTextColor="#a1a1aa"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: 12,
                    borderRadius: 12,
                    color: '#e4e4e7',
                    fontSize: 14
                  }}
                />
              ) : (
                <Text style={{ color: '#e4e4e7', fontSize: 16 }}>
                  {profileData.name || 'Not set'}
          </Text>
              )}
            </View>

            <View>
              <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Email</Text>
              {isEditing ? (
                <TextInput
                  value={profileData.email}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, email: text }))}
                  placeholder="Enter your email"
                  placeholderTextColor="#a1a1aa"
                  keyboardType="email-address"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: 12,
                    borderRadius: 12,
                    color: '#e4e4e7',
                    fontSize: 14
                  }}
                />
              ) : (
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>
                  {profileData.email || 'Not set'}
          </Text>
              )}
        </View>

        <View>
              <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Bio</Text>
              {isEditing ? (
                <TextInput
                  value={profileData.bio}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, bio: text }))}
                  placeholder="Tell us about your style..."
                  placeholderTextColor="#a1a1aa"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: 12,
                    borderRadius: 12,
                    color: '#e4e4e7',
                    fontSize: 14,
                    textAlignVertical: 'top'
                  }}
                />
              ) : (
                <Text style={{ color: '#e4e4e7', fontSize: 16 }}>
                  {profileData.bio || 'No bio added'}
          </Text>
              )}
            </View>

            {isEditing && (
              <Pressable onPress={saveProfile} style={{ padding: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>Save Changes</Text>
              </Pressable>
            )}
        </View>
      </View>

        {/* Account Settings */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Settings</Text>
          
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Notifications</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>On</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Privacy</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Public</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Data & Storage</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Manage</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable onPress={handleSignOut} style={{ padding: 16, alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
          Sign Out
        </Text>
      </Pressable>
        </ScrollView>
    </View>
  );
}


function Card({ children }) {
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderRadius: 24,
      padding: 20
    }}>
      {children}
    </View>
  );
}

function SuggestScreen() {
  const { setRoute, state: { params } } = useApp();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  const itemId = params?.itemId;
  const itemType = params?.itemType;
  
  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setIsGeneratingPreview(true);
    
    try {
      // Generate try-on preview using Replicate
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_img: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200', // Default user image
          garm_img: product.image,
          category: product.category,
          garment_des: product.garment_des || product.name
        })
      });
      
      const { jobId } = await response.json();
      
      // Poll for result
      const pollResult = async () => {
        const resultResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/tryon/${jobId}`);
        const result = await resultResponse.json();
        
        if (result.status === 'succeeded') {
          setPreviewResult(result.output);
          setShowPreview(true);
          setIsGeneratingPreview(false);
        } else if (result.status === 'processing') {
          setTimeout(pollResult, 2000);
        } else {
          setIsGeneratingPreview(false);
          Alert.alert('Error', 'Failed to generate preview');
        }
      };
      
      setTimeout(pollResult, 2000);
    } catch (error) {
      console.error('Preview generation error:', error);
      setIsGeneratingPreview(false);
      Alert.alert('Error', 'Failed to generate preview');
    }
  };
  
  const handleSuggest = () => {
    // Add suggestion logic here
    Alert.alert('Suggestion Sent!', `You suggested ${selectedProduct.name} for this outfit.`);
    setRoute('feed');
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('feed')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={s.h1}>Suggest Outfit</Text>
      </View>
      
      <Text style={s.muted}>
        Browse and suggest clothing items for this outfit
      </Text>
      
      {showPreview && previewResult ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
            Preview: {selectedProduct.name}
          </Text>
          <Image 
            source={{ uri: previewResult }} 
            style={{ width: '100%', aspectRatio: 9/16, borderRadius: 20, marginBottom: 20 }}
            resizeMode="cover"
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable 
              onPress={() => setShowPreview(false)}
              style={[s.btn, { flex: 1 }]}
            >
              <Text style={s.btnText}>Back to Browse</Text>
            </Pressable>
            <Pressable 
              onPress={handleSuggest}
              style={[s.btn, s.btnPrimary, { flex: 1 }]}
            >
              <Text style={s.btnPrimaryText}>Suggest This</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'space-between',
            gap: 12
          }}>
            {enhancedProducts.map(product => (
              <Pressable 
                key={product.id}
                onPress={() => handleProductSelect(product)}
                style={{
                  width: '48%',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)'
                }}
              >
                <Image 
                  source={{ uri: product.image }} 
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <View style={{ padding: 12 }}>
                  <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                    {product.name}
                  </Text>
                  <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700' }}>
                    ${product.price}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      
      {isGeneratingPreview && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, marginBottom: 16 }}>Generating Preview...</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>This may take a few moments</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingBottom: 80 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  grid2: { gap: 16 },
  h1: { color: '#e4e4e7', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#a1a1aa', fontSize: 16, marginBottom: 16 },
  btn: { backgroundColor: 'rgba(255,255,255,0.12)', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimary: { backgroundColor: '#fff' },
  btnText: { color: '#e4e4e7', fontSize: 16, fontWeight: '600' },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
  inputBox: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  label: { color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  inputHint: { color: '#a1a1aa', fontSize: 14 },
  productImageContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  productImage: { width: '100%', height: '100%' },
  productTitle: { color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  productPrice: { color: '#a1a1aa', fontSize: 14 },
  productsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    gap: 8
  },
  productCard: { 
    width: '48%', 
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden'
  },
  productOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  productPriceContainer: {
    flex: 1
  },
  productOriginalPrice: {
    color: '#a1a1aa',
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginLeft: 4
  },
  productActionContainer: {
    marginLeft: 8
  },
  productActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  productActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8
  },
  emptyStateSubtext: {
    color: '#a1a1aa',
    fontSize: 14
  }
});

