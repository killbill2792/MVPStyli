import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert, StatusBar, TextInput, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { customAlphabet } from 'nanoid/non-secure';
import { supabase } from './lib/supabase';
import { uploadImageAsync } from './lib/upload';
import productsData from './data/products.json';
import { Linking } from 'react-native';

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
  rooms: []
};

export function AppProvider({ children }) {
  const [state, setState] = useState(initial);
  
  const api = useMemo(() => ({
    state,
    setRoute: (route, params) => setState(s => ({ ...s, route, params: params || {} })),
    setTwinUrl: (url) => setState(s => ({ ...s, twinUrl: url })),
    setUser: (user) => setState(s => ({ ...s, user })),
    setCurrentProduct: (id) => setState(s => ({ ...s, currentProductId: id })),
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
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { state: { route, user }, setRoute, setUser } = useApp();
  
  // Initialize user on first load - create local user without Supabase
  useEffect(() => {
    if (!user) {
      // Create a local user without Supabase auth
      setUser({ id: "local-user-" + Date.now(), email: null });
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
    <SafeAreaView style={s.app} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        style={s.container} 
        contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {route === "signin" && <SignInScreen onDone={() => setRoute("onboarding")} />}
        {route === "onboarding" && <Onboarding />}
        {route === "shop" && <Shop />}
        {route === "product" && <Product />}
        {route === "tryon" && <TryOn />}
        {route === "askhelp" && <AskHelp />}
        {route === "createpod" && <CreatePod />}
        {route === "rooms" && <RoomsInbox />}
        {route === "room_owner" && <RoomOwner />}
        {route === "room_guest" && <RoomGuest />}
        {route === "recap" && <Recap />}
        {route === "feed" && <Explore />}
        {route === "ai-analytics" && <AIAnalytics />}
        {route === "suggested-outfits" && <SuggestedOutfits />}
        {route === "stylecraft" && <StyleCraft />}
        {route === "account" && <AccountScreen onBack={() => setRoute("shop")} />}
      </ScrollView>
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
        Alert.alert('Error', 'No image was selected.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Please try again.');
    }
  };
  
  const next = () => {
    if (twinUrl) {
      setRoute('shop');
    } else {
      Alert.alert('Upload required', 'Please upload your photo.');
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
  const { state: { products }, setRoute, setCurrentProduct } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  
  // Enhanced product data with more realistic information - expanded catalog
  const enhancedProducts = [
    {
      id: "zara-black-blazer",
      name: "Zara Black Blazer",
      price: 119,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Black blazer with structured fit and classic lapels",
      buyUrl: "https://www.zara.com/",
      brand: "Zara",
      color: "Black",
      material: "Wool Blend",
      size: "S, M, L, XL"
    },
    {
      id: "asos-denim-jacket",
      name: "ASOS Denim Jacket",
      price: 69,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Classic blue denim jacket with button closure",
      buyUrl: "https://www.asos.com/",
      brand: "ASOS",
      color: "Blue",
      material: "Denim",
      size: "XS, S, M, L, XL"
    },
    {
      id: "cos-silk-dress",
      name: "COS Silk Dress",
      price: 159,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200",
      category: "dress",
      garment_des: "Elegant silk dress with flowing silhouette",
      buyUrl: "https://www.cos.com/",
      brand: "COS",
      color: "Navy",
      material: "Silk",
      size: "XS, S, M, L"
    },
    {
      id: "nike-air-force-1",
      name: "Nike Air Force 1",
      price: 90,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&auto=format&fit=crop&w=1200",
      category: "shoes",
      garment_des: "Classic white leather sneakers with rubber sole",
      buyUrl: "https://www.nike.com/",
      brand: "Nike",
      color: "White",
      material: "Leather",
      size: "6, 7, 8, 9, 10, 11"
    },
    {
      id: "coach-leather-tote",
      name: "Coach Leather Tote",
      price: 295,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&auto=format&fit=crop&w=1200",
      category: "accessories",
      garment_des: "Premium leather tote bag with shoulder straps",
      buyUrl: "https://www.coach.com/",
      brand: "Coach",
      color: "Brown",
      material: "Leather",
      size: "One Size"
    },
    {
      id: "uniqlo-cashmere",
      name: "Uniqlo Cashmere Knit",
      price: 79,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Soft cashmere knit sweater with crew neck",
      buyUrl: "https://www.uniqlo.com/",
      brand: "Uniqlo",
      color: "Cream",
      material: "Cashmere",
      size: "XS, S, M, L, XL"
    },
    {
      id: "hm-trench",
      name: "H&M Classic Trench",
      price: 139,
      rating: 4.2,
      image: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "Classic beige trench coat with belt closure",
      buyUrl: "https://www2.hm.com/",
      brand: "H&M",
      color: "Beige",
      material: "Cotton Blend",
      size: "XS, S, M, L, XL"
    },
    {
      id: "levi-501",
      name: "Levi's 501 Original",
      price: 98,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Classic blue denim jeans with straight fit",
      buyUrl: "https://www.levi.com/",
      brand: "Levi's",
      color: "Blue",
      material: "Denim",
      size: "24, 26, 28, 30, 32, 34"
    },
    {
      id: "reformation-wrap",
      name: "Reformation Wrap Dress",
      price: 248,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&auto=format&fit=crop&w=1200",
      category: "dress",
      garment_des: "Floral wrap dress with tie waist",
      buyUrl: "https://www.thereformation.com/",
      brand: "Reformation",
      color: "Floral",
      material: "Viscose",
      size: "XXS, XS, S, M, L, XL"
    },
    {
      id: "adidas-samba",
      name: "Adidas Samba OG",
      price: 100,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&auto=format&fit=crop&w=1200",
      category: "shoes",
      garment_des: "Classic white and black leather sneakers",
      buyUrl: "https://www.adidas.com/",
      brand: "Adidas",
      color: "White/Black",
      material: "Leather",
      size: "6, 7, 8, 9, 10, 11"
    },
    {
      id: "aritzia-wilfred",
      name: "Aritzia Wilfred Blouse",
      price: 88,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Silk blouse with button front and relaxed fit",
      buyUrl: "https://www.aritzia.com/",
      brand: "Aritzia",
      color: "White",
      material: "Silk",
      size: "XXS, XS, S, M, L"
    },
    {
      id: "mango-slip-dress",
      name: "Mango Satin Slip",
      price: 119,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&auto=format&fit=crop&w=1200",
      category: "dress",
      garment_des: "Satin slip dress with adjustable straps",
      buyUrl: "https://shop.mango.com/",
      brand: "Mango",
      color: "Black",
      material: "Satin",
      size: "XS, S, M, L"
    },
    {
      id: "hugo-boss-suit",
      name: "Hugo Boss Business Suit",
      price: 450,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&auto=format&fit=crop&w=1200",
      category: "suit",
      garment_des: "Professional business suit with tailored fit",
      buyUrl: "https://www.hugoboss.com/",
      brand: "Hugo Boss",
      color: "Navy",
      material: "Wool",
      size: "S, M, L, XL"
    },
    {
      id: "calvin-klein-jeans",
      name: "Calvin Klein Skinny Jeans",
      price: 89,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&auto=format&fit=crop&w=1200",
      category: "jeans",
      garment_des: "Skinny fit jeans with stretch denim",
      buyUrl: "https://www.calvinklein.com/",
      brand: "Calvin Klein",
      color: "Blue",
      material: "Denim",
      size: "24, 26, 28, 30, 32"
    },
    {
      id: "gucci-handbag",
      name: "Gucci Leather Handbag",
      price: 1200,
      rating: 4.9,
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&auto=format&fit=crop&w=1200",
      category: "accessories",
      garment_des: "Luxury leather handbag with gold hardware",
      buyUrl: "https://www.gucci.com/",
      brand: "Gucci",
      color: "Brown",
      material: "Leather",
      size: "One Size"
    },
    {
      id: "prada-sunglasses",
      name: "Prada Sunglasses",
      price: 350,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&auto=format&fit=crop&w=1200",
      category: "accessories",
      garment_des: "Designer sunglasses with UV protection",
      buyUrl: "https://www.prada.com/",
      brand: "Prada",
      color: "Black",
      material: "Acetate",
      size: "One Size"
    },
    {
      id: "versace-dress",
      name: "Versace Evening Dress",
      price: 850,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200",
      category: "dress",
      garment_des: "Elegant evening dress with sequin details",
      buyUrl: "https://www.versace.com/",
      brand: "Versace",
      color: "Gold",
      material: "Silk",
      size: "XS, S, M, L"
    },
    {
      id: "balenciaga-sneakers",
      name: "Balenciaga Triple S",
      price: 650,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&auto=format&fit=crop&w=1200",
      category: "shoes",
      garment_des: "Chunky sneakers with bold design",
      buyUrl: "https://www.balenciaga.com/",
      brand: "Balenciaga",
      color: "White",
      material: "Leather",
      size: "6, 7, 8, 9, 10, 11"
    },
    {
      id: "chanel-jacket",
      name: "Chanel Tweed Jacket",
      price: 4200,
      rating: 4.9,
      image: "https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200",
      category: "jacket",
      garment_des: "Classic tweed jacket with signature buttons",
      buyUrl: "https://www.chanel.com/",
      brand: "Chanel",
      color: "Beige",
      material: "Tweed",
      size: "XS, S, M, L"
    },
    {
      id: "louis-vuitton-bag",
      name: "Louis Vuitton Speedy",
      price: 1800,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&auto=format&fit=crop&w=1200",
      category: "accessories",
      garment_des: "Iconic monogram handbag",
      buyUrl: "https://www.louisvuitton.com/",
      brand: "Louis Vuitton",
      color: "Brown",
      material: "Canvas",
      size: "One Size"
    },
    {
      id: "hermes-scarf",
      name: "Hermès Silk Scarf",
      price: 450,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200",
      category: "accessories",
      garment_des: "Luxury silk scarf with hand-rolled edges",
      buyUrl: "https://www.hermes.com/",
      brand: "Hermès",
      color: "Multicolor",
      material: "Silk",
      size: "90cm"
    },
    {
      id: "dior-heels",
      name: "Dior J'Adior Pumps",
      price: 750,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&auto=format&fit=crop&w=1200",
      category: "shoes",
      garment_des: "Elegant pumps with ribbon detail",
      buyUrl: "https://www.dior.com/",
      brand: "Dior",
      color: "Black",
      material: "Leather",
      size: "6, 7, 8, 9, 10"
    },
    {
      id: "burberry-trench",
      name: "Burberry Heritage Trench",
      price: 1650,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "Classic trench coat with check lining",
      buyUrl: "https://www.burberry.com/",
      brand: "Burberry",
      color: "Honey",
      material: "Cotton",
      size: "XS, S, M, L, XL"
    },
    // Top Wear - Women
    {
      id: "genz-crop-hoodie",
      name: "Gen Z Crop Hoodie",
      price: 45,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Trendy crop hoodie perfect for street style",
      buyUrl: "https://www.streetwear.com/",
      brand: "StreetWear",
      color: "Pink",
      material: "Cotton",
      size: "XS, S, M, L"
    },
    {
      id: "oversized-graphic-tee",
      name: "Oversized Graphic Tee",
      price: 28,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Comfortable oversized tee with bold graphics",
      buyUrl: "https://www.urban.com/",
      brand: "Urban",
      color: "White",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "y2k-mesh-top",
      name: "Y2K Mesh Top",
      price: 35,
      rating: 4.1,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Retro mesh top with Y2K aesthetic",
      buyUrl: "https://www.retro.com/",
      brand: "Retro",
      color: "Black",
      material: "Mesh",
      size: "XS, S, M, L"
    },
    {
      id: "tie-dye-sweatshirt",
      name: "Tie-Dye Sweatshirt",
      price: 52,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Colorful tie-dye sweatshirt for casual wear",
      buyUrl: "https://www.hippie.com/",
      brand: "Hippie",
      color: "Multi",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "corset-style-top",
      name: "Corset Style Top",
      price: 65,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Trendy corset-style top with structured fit",
      buyUrl: "https://www.gothic.com/",
      brand: "Gothic",
      color: "Black",
      material: "Satin",
      size: "XS, S, M"
    },
    {
      id: "neon-sports-bra",
      name: "Neon Sports Bra",
      price: 32,
      rating: 4.2,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Bright neon sports bra for active wear",
      buyUrl: "https://www.active.com/",
      brand: "Active",
      color: "Neon Green",
      material: "Spandex",
      size: "XS, S, M, L"
    },
    {
      id: "vintage-band-tee",
      name: "Vintage Band Tee",
      price: 38,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Classic vintage band t-shirt",
      buyUrl: "https://www.music.com/",
      brand: "Music",
      color: "Gray",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "crochet-bikini-top",
      name: "Crochet Bikini Top",
      price: 42,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Handmade crochet bikini top",
      buyUrl: "https://www.beach.com/",
      brand: "Beach",
      color: "White",
      material: "Cotton",
      size: "XS, S, M"
    },
    {
      id: "puff-sleeve-blouse",
      name: "Puff Sleeve Blouse",
      price: 58,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Feminine blouse with dramatic puff sleeves",
      buyUrl: "https://www.feminine.com/",
      brand: "Feminine",
      color: "Lavender",
      material: "Silk",
      size: "XS, S, M, L"
    },
    {
      id: "techwear-jacket",
      name: "Techwear Jacket",
      price: 120,
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "Futuristic techwear jacket with multiple pockets",
      buyUrl: "https://www.cyber.com/",
      brand: "Cyber",
      color: "Black",
      material: "Nylon",
      size: "S, M, L, XL"
    },
    // Top Wear - Men
    {
      id: "streetwear-hoodie-m",
      name: "Streetwear Hoodie",
      price: 68,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Comfortable streetwear hoodie for men",
      buyUrl: "https://www.street.com/",
      brand: "Street",
      color: "Gray",
      material: "Cotton",
      size: "S, M, L, XL, XXL"
    },
    {
      id: "vintage-logo-tee-m",
      name: "Vintage Logo Tee",
      price: 35,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Retro vintage logo t-shirt",
      buyUrl: "https://www.retro.com/",
      brand: "Retro",
      color: "Black",
      material: "Cotton",
      size: "M, L, XL, XXL"
    },
    {
      id: "oversized-button-up-m",
      name: "Oversized Button-Up",
      price: 75,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Relaxed fit button-up shirt",
      buyUrl: "https://www.casual.com/",
      brand: "Casual",
      color: "White",
      material: "Linen",
      size: "M, L, XL, XXL"
    },
    {
      id: "gaming-jersey-m",
      name: "Gaming Jersey",
      price: 55,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Gaming team jersey with team colors",
      buyUrl: "https://www.gaming.com/",
      brand: "Gaming",
      color: "Blue",
      material: "Polyester",
      size: "S, M, L, XL"
    },
    {
      id: "minimalist-tank-m",
      name: "Minimalist Tank",
      price: 25,
      rating: 4.2,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Simple minimalist tank top",
      buyUrl: "https://www.minimal.com/",
      brand: "Minimal",
      color: "White",
      material: "Cotton",
      size: "M, L, XL, XXL"
    },
    {
      id: "tech-fleece-jacket-m",
      name: "Tech Fleece Jacket",
      price: 95,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "High-tech fleece jacket with advanced materials",
      buyUrl: "https://www.tech.com/",
      brand: "Tech",
      color: "Navy",
      material: "Fleece",
      size: "S, M, L, XL, XXL"
    },
    {
      id: "skater-longsleeve-m",
      name: "Skater Longsleeve",
      price: 42,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Skateboarding inspired long sleeve shirt",
      buyUrl: "https://www.skate.com/",
      brand: "Skate",
      color: "Green",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "vintage-windbreaker-m",
      name: "Vintage Windbreaker",
      price: 85,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "Classic vintage windbreaker jacket",
      buyUrl: "https://www.vintage.com/",
      brand: "Vintage",
      color: "Yellow",
      material: "Nylon",
      size: "M, L, XL, XXL"
    },
    {
      id: "oversized-sweater-m",
      name: "Oversized Sweater",
      price: 65,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&auto=format&fit=crop&w=1200",
      category: "upper",
      garment_des: "Comfortable oversized knit sweater",
      buyUrl: "https://www.cozy.com/",
      brand: "Cozy",
      color: "Beige",
      material: "Wool",
      size: "L, XL, XXL"
    },
    {
      id: "streetwear-vest-m",
      name: "Streetwear Vest",
      price: 48,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200",
      category: "outerwear",
      garment_des: "Urban streetwear vest with utility pockets",
      buyUrl: "https://www.urban.com/",
      brand: "Urban",
      color: "Black",
      material: "Canvas",
      size: "M, L, XL, XXL"
    },
    // Bottom Wear - Women
    {
      id: "genz-cargo-pants-w",
      name: "Gen Z Cargo Pants",
      price: 55,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Trendy cargo pants with multiple pockets",
      buyUrl: "https://www.street.com/",
      brand: "Street",
      color: "Black",
      material: "Cotton",
      size: "XS, S, M, L"
    },
    {
      id: "y2k-mini-skirt-w",
      name: "Y2K Mini Skirt",
      price: 38,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Retro Y2K style mini skirt",
      buyUrl: "https://www.retro.com/",
      brand: "Retro",
      color: "Pink",
      material: "Polyester",
      size: "XS, S, M"
    },
    {
      id: "oversized-sweatpants-w",
      name: "Oversized Sweatpants",
      price: 45,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Comfortable oversized sweatpants",
      buyUrl: "https://www.comfy.com/",
      brand: "Comfy",
      color: "Gray",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "high-waist-jeans-w",
      name: "High-Waist Jeans",
      price: 68,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Flattering high-waist denim jeans",
      buyUrl: "https://www.denim.com/",
      brand: "Denim",
      color: "Blue",
      material: "Denim",
      size: "24, 26, 28, 30, 32"
    },
    {
      id: "mesh-shorts-w",
      name: "Mesh Shorts",
      price: 32,
      rating: 4.2,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Sporty mesh shorts for active wear",
      buyUrl: "https://www.sport.com/",
      brand: "Sport",
      color: "Black",
      material: "Mesh",
      size: "XS, S, M, L"
    },
    {
      id: "pleated-skirt-w",
      name: "Pleated Skirt",
      price: 42,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Classic pleated school-style skirt",
      buyUrl: "https://www.school.com/",
      brand: "School",
      color: "Navy",
      material: "Polyester",
      size: "XS, S, M, L"
    },
    {
      id: "wide-leg-trousers-w",
      name: "Wide-Leg Trousers",
      price: 58,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Professional wide-leg trousers",
      buyUrl: "https://www.office.com/",
      brand: "Office",
      color: "Beige",
      material: "Cotton",
      size: "XS, S, M, L, XL"
    },
    {
      id: "bike-shorts-w",
      name: "Bike Shorts",
      price: 28,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Comfortable bike shorts for cycling",
      buyUrl: "https://www.active.com/",
      brand: "Active",
      color: "Black",
      material: "Spandex",
      size: "XS, S, M, L"
    },
    {
      id: "flare-jeans-w",
      name: "Flare Jeans",
      price: 72,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Retro flare leg denim jeans",
      buyUrl: "https://www.vintage.com/",
      brand: "Vintage",
      color: "Light Blue",
      material: "Denim",
      size: "24, 26, 28, 30, 32"
    },
    {
      id: "cargo-shorts-w",
      name: "Cargo Shorts",
      price: 48,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Utility cargo shorts with side pockets",
      buyUrl: "https://www.utility.com/",
      brand: "Utility",
      color: "Olive",
      material: "Cotton",
      size: "XS, S, M, L"
    },
    // Bottom Wear - Men
    {
      id: "streetwear-joggers-m",
      name: "Streetwear Joggers",
      price: 52,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Comfortable streetwear jogger pants",
      buyUrl: "https://www.street.com/",
      brand: "Street",
      color: "Black",
      material: "Cotton",
      size: "S, M, L, XL, XXL"
    },
    {
      id: "vintage-denim-m",
      name: "Vintage Denim",
      price: 75,
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Classic vintage denim jeans",
      buyUrl: "https://www.retro.com/",
      brand: "Retro",
      color: "Blue",
      material: "Denim",
      size: "28, 30, 32, 34, 36, 38"
    },
    {
      id: "cargo-pants-m",
      name: "Cargo Pants",
      price: 65,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Utility cargo pants with multiple pockets",
      buyUrl: "https://www.utility.com/",
      brand: "Utility",
      color: "Khaki",
      material: "Cotton",
      size: "M, L, XL, XXL"
    },
    {
      id: "basketball-shorts-m",
      name: "Basketball Shorts",
      price: 35,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Performance basketball shorts",
      buyUrl: "https://www.sport.com/",
      brand: "Sport",
      color: "Red",
      material: "Polyester",
      size: "S, M, L, XL, XXL"
    },
    {
      id: "tech-pants-m",
      name: "Tech Pants",
      price: 85,
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "High-tech pants with advanced materials",
      buyUrl: "https://www.tech.com/",
      brand: "Tech",
      color: "Black",
      material: "Nylon",
      size: "M, L, XL, XXL"
    },
    {
      id: "chino-shorts-m",
      name: "Chino Shorts",
      price: 42,
      rating: 4.2,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Classic chino shorts for casual wear",
      buyUrl: "https://www.casual.com/",
      brand: "Casual",
      color: "Navy",
      material: "Cotton",
      size: "S, M, L, XL"
    },
    {
      id: "sweatpants-m",
      name: "Sweatpants",
      price: 38,
      rating: 4.4,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Comfortable sweatpants for lounging",
      buyUrl: "https://www.comfy.com/",
      brand: "Comfy",
      color: "Gray",
      material: "Cotton",
      size: "M, L, XL, XXL"
    },
    {
      id: "track-pants-m",
      name: "Track Pants",
      price: 48,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Athletic track pants for training",
      buyUrl: "https://www.athletic.com/",
      brand: "Athletic",
      color: "Blue",
      material: "Polyester",
      size: "M, L, XL, XXL"
    },
    {
      id: "wide-leg-pants-m",
      name: "Wide-Leg Pants",
      price: 55,
      rating: 4.5,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Fashion-forward wide-leg pants",
      buyUrl: "https://www.fashion.com/",
      brand: "Fashion",
      color: "Beige",
      material: "Cotton",
      size: "M, L, XL, XXL"
    },
    {
      id: "cargo-shorts-m",
      name: "Cargo Shorts",
      price: 45,
      rating: 4.3,
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      category: "lower",
      garment_des: "Utility cargo shorts with side pockets",
      buyUrl: "https://www.utility.com/",
      brand: "Utility",
      color: "Green",
      material: "Cotton",
      size: "S, M, L, XL"
    }
  ];
  
  // Enhanced NLP search function
  const performSearch = (query) => {
    if (!query.trim()) {
      setFilteredProducts(enhancedProducts);
      return;
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const filtered = enhancedProducts.filter(product => {
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
    setFilteredProducts(enhancedProducts);
  }, []);
  
  const handleSearch = (text) => {
    setSearchQuery(text);
    performSearch(text);
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Floating Search Bar */}
      <View style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#a1a1aa', marginRight: 8 }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search dresses, brands, colors..."
              placeholderTextColor="#a1a1aa"
              style={{ flex: 1, color: '#e4e4e7', fontSize: 14 }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(''); setFilteredProducts(enhancedProducts); }}>
                <Text style={{ color: '#a1a1aa', fontSize: 16 }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
      
      {/* Products Grid */}
      <ScrollView 
        style={{ flex: 1, marginTop: 80 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
                  <Text style={{ color: '#fff', fontSize: 12 }}>👁️</Text>
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
    </View>
  );
}

function Product() {
  const { state: { products, currentProductId }, setRoute } = useApp();
  const product = products.find(p => p.id === currentProductId);
  const [cleanUrl, setCleanUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [priceHistory, setPriceHistory] = useState([
    { date: '2024-01-15', price: 129 },
    { date: '2024-01-10', price: 119 },
    { date: '2024-01-05', price: 139 },
    { date: '2024-01-01', price: 119 }
  ]);
  
  useEffect(() => {
    if (product) {
      // Upload garment image to Supabase for Replicate access
      uploadGarmentImage(product.image, product.id)
        .then(url => {
          setCleanUrl(url);
          setLoading(false);
        })
        .catch(error => {
          console.error('Garment upload error:', error);
          setCleanUrl(product.image);
          setLoading(false);
        });
    }
  }, [product]);
  
  const togglePriceTracking = () => {
    setIsTracking(!isTracking);
    if (!isTracking) {
      Alert.alert('Price Tracking Enabled', 'You\'ll be notified when the price drops below $' + (product.price - 10));
    }
  };
  
  if (!product) return null;
  
  const lowestPrice = Math.min(...priceHistory.map(p => p.price));
  const isOnSale = product.price < priceHistory[0].price;
  
  return (
    <View style={{ gap: 14 }}>
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden' }}>
        <Image source={{ uri: product.image }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
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
        
        {/* Price Tracking Section */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>Price Tracking</Text>
            <Pressable 
              onPress={togglePriceTracking}
              style={{ 
                backgroundColor: isTracking ? '#10b981' : 'rgba(255,255,255,0.1)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8
              }}
            >
              <Text style={{ color: isTracking ? '#fff' : '#a1a1aa', fontSize: 12, fontWeight: '600' }}>
                {isTracking ? 'Tracking' : 'Track Price'}
              </Text>
            </Pressable>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>30-day low: ${lowestPrice}</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>30-day high: ${Math.max(...priceHistory.map(p => p.price))}</Text>
          </View>
          
          {isTracking && (
            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#10b981', fontSize: 12, textAlign: 'center' }}>
                🔔 We'll notify you when price drops below ${product.price - 10}
              </Text>
            </View>
          )}
        </View>
        
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable 
            disabled={!cleanUrl || loading} 
            onPress={() => setRoute('tryon', { garmentCleanUrl: cleanUrl, garmentId: product.id, category: product.category })} 
            style={{ 
              flex: 1, 
              backgroundColor: (cleanUrl && !loading) ? '#fff' : 'rgba(255,255,255,0.3)', 
              padding: 12, 
              borderRadius: 14, 
              alignItems: 'center' 
            }}
          >
            <Text style={{ color: (cleanUrl && !loading) ? '#000' : '#111' }}>
              {loading ? 'Preparing…' : 'Try On'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(product.buyUrl)}
            style={{ 
              flex: 1, 
              backgroundColor: '#10b981', 
              padding: 12, 
              borderRadius: 14, 
              alignItems: 'center' 
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Buy Now</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setRoute('shop')}><Text style={{ color: '#3b82f6', marginTop: 8 }}>Back to shop</Text></Pressable>
      </View>
    </View>
  );
}

function TryOn() {
  const { state: { twinUrl, currentProductId, products }, setRoute, setTwinUrl } = useApp();
  const product = products.find(p => p.id === currentProductId);
  const garmentCleanUrl = useApp().state.params?.garmentCleanUrl;
  const garmentId = useApp().state.params?.garmentId;
  const category = useApp().state.params?.category;
  
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayContent, setOverlayContent] = useState(null);
  
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
      Alert.alert('Error', 'Please upload your photo and select a garment first.');
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
      
      // Call try-on API directly
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          human_img: humanImgUrl, 
          garm_img: garmentCleanUrl, 
          category,
          garment_des: product?.garment_des || "Garment item"
        })
      });
      
      const data = await response.json();
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
          // AI try-on generated successfully
        } else {
          throw new Error(status.error || 'Try-on failed');
        }
      } else {
        throw new Error(data.error || 'Failed to start try-on');
      }
    } catch (error) {
      console.error('Try-on error:', error);
      Alert.alert('Try-On Error', `AI try-on failed: ${error.message}`);
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
    <View style={{ alignItems: 'center', flex: 1 }}>
      {busy && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', borderRadius: 0 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Text style={{ fontSize: 32, marginBottom: 16 }}>✨</Text>
              <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>AI Processing...</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center' }}>Generating your try-on with AI</Text>
              <View style={{ width: 200, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 16, overflow: 'hidden' }}>
                <View style={{ width: '60%', height: '100%', backgroundColor: '#fff', borderRadius: 2 }} />
              </View>
            </View>
          </View>
        </View>
      )}

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
      
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', maxWidth: 420 }}>
        <Image source={{ uri: result || twinUrl }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        
        <Pressable onPress={() => setTwinUrl(null)} style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>📷 Change Photo</Text>
        </Pressable>
        
        {/* Top-right vertical buttons */}
        {result && (
          <View style={{ position: 'absolute', right: 12, top: 12, flexDirection: 'column', gap: 8 }}>
            <Pressable 
              onPress={() => showFeatureOverlay({ 
                title: 'AI Analytics', 
                description: 'Get detailed analysis of your outfit including style recommendations, color harmony, and confidence scores.' 
              })} 
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 }}
            >
              <Text style={{ color: '#10b981', fontSize: 16 }}>📊</Text>
            </Pressable>
            <Pressable 
              onPress={() => showFeatureOverlay({ 
                title: 'Pods', 
                description: 'Create a Pod to get feedback from friends, taste twins, or the global community on your outfit.' 
              })} 
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 }}
            >
              <Text style={{ color: '#10b981', fontSize: 16 }}>👥</Text>
            </Pressable>
            <Pressable 
              onPress={() => showFeatureOverlay({ 
                title: 'Suggested Outfits', 
                description: 'Discover similar styles and complementary pieces that would work well with your current look.' 
              })} 
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 }}
            >
              <Text style={{ color: '#10b981', fontSize: 16 }}>💡</Text>
            </Pressable>
          </View>
        )}
        
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
              {busy ? '⏳ Processing...' : '✨ Try On'}
            </Text>
          </Pressable>
          {result && (
            <Pressable 
              onPress={() => Linking.openURL(product?.buyUrl || 'https://example.com')} 
              style={{ backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>🛒 Buy</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
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
      podResult: 'Taste Twins prefer this (82%)'
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
      podResult: 'Taste Twins love this (89%)'
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
      podResult: 'Taste Twins love this (89%)'
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
      podResult: 'Taste Twins split (45%)'
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
    // Auto advance after voting
    setTimeout(() => {
      if (currentIndex < exploreItems.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }, 1000);
  };

  const nextItem = () => {
    if (currentIndex < exploreItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', maxWidth: 420 }}>
        <Image source={{ uri: currentItem.uri }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        
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
        <View style={{ position: 'absolute', right: 12, top: 12, flexDirection: 'column', gap: 8 }}>
          <Pressable 
            onPress={() => setRoute('tryon')}
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 }}
          >
            <Text style={{ color: '#10b981', fontSize: 16 }}>👗</Text>
          </Pressable>
          <Pressable 
            onPress={() => setRoute('createpod')}
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 }}
          >
            <Text style={{ color: '#10b981', fontSize: 16 }}>👥</Text>
          </Pressable>
        </View>

        {/* Voting buttons */}
        {!hasVoted ? (
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
            <Pressable 
              onPress={() => handleVote('dislike')}
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>❌</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleVote('like')}
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>❤️</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleVote('fire')}
              style={{ backgroundColor: 'rgba(251, 146, 60, 0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>🔥</Text>
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

        {/* Progress indicator */}
        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {currentIndex + 1} / {exploreItems.length}
          </Text>
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
      title: 'Taste Twins',
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
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('tryon')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Create Pod</Text>
      </View>

      <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 20 }}>
        Choose your audience for feedback
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {podModes.map(mode => (
          <Pressable 
            key={mode.id} 
            onPress={() => setSelectedMode(mode.id)}
            style={{ 
              backgroundColor: selectedMode === mode.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
              borderColor: selectedMode === mode.id ? '#3b82f6' : 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>{mode.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600' }}>{mode.title}</Text>
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{mode.description}</Text>
              </View>
            </View>
            
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Duration: {mode.duration}
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {mode.features.map((feature, index) => (
                <View key={index} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{feature}</Text>
                </View>
              ))}
            </View>
        </Pressable>
        ))}
        
        {selectedMode === 'friends' && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Duration</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 12 }}>How long should this pod stay active?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[30, 60, 90, 120].map(mins => (
                <Pressable 
                  key={mins}
                  onPress={() => setDuration(mins)}
                  style={{ 
                    backgroundColor: duration === mins ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8
                  }}
                >
                  <Text style={{ color: duration === mins ? '#fff' : '#a1a1aa', fontSize: 14, fontWeight: '600' }}>
                    {mins}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        
        <Pressable onPress={create} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>Create Pod</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RoomsInbox() {
  const { state: { rooms }, setRoute } = useApp();
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>My Rooms</Text>
        <Text style={s.muted}>Active help rooms</Text>
        <View style={{ height: 24 }} />
        {rooms.length === 0 ? (
          <Text style={{ color: '#a1a1aa', textAlign: 'center' }}>No active rooms</Text>
        ) : (
          rooms.map(room => (
            <Pressable key={room.id} onPress={() => setRoute('room_owner', { roomId: room.id })} style={s.btn}>
              <Text style={s.btnText}>{room.title}</Text>
            </Pressable>
          ))
        )}
        <Pressable onPress={() => setRoute('askhelp')} style={s.btn}>
          <Text style={s.btnText}>Back</Text>
        </Pressable>
      </Card>
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
        return { icon: '🎯', color: '#10b981', description: 'Taste Twins' };
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
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('createpod')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>Pod Room</Text>
      </View>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>{modeInfo.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600' }}>{modeInfo.description}</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Active • {room.durationMins || 60} minutes</Text>
          </View>
        </View>
        
        {room.mode === 'taste-twins' && (
          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Taste Twin Match</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>AI found people with 87% style similarity to you</Text>
          </View>
        )}
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600' }}>Voting Results</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{totalVotes} votes</Text>
        </View>
        
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 14 }}>🔥 Yes</Text>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>{room.votes.yes} ({yesPercentage}%)</Text>
          </View>
          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${yesPercentage}%`, height: '100%', backgroundColor: '#10b981', borderRadius: 3 }} />
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>❤️ Maybe</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{room.votes.maybe}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>❌ No</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{room.votes.no}</Text>
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
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>Guest Room</Text>
        <Text style={s.muted}>Vote on this outfit</Text>
      </Card>
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
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
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
              backgroundColor: msg.type === 'user' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
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
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
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
            <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
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

              <Pressable style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>Proceed with this vendor</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setRoute('shop')} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>StyleCraft</Text>
      </View>

      <Text style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 20 }}>
        Design your custom dress and get quotes from professional vendors
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Design Type Selection */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Design Input</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable 
              onPress={() => setDesignType('upload')}
              style={{ 
                flex: 1, 
                backgroundColor: designType === 'upload' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.1)',
                borderWidth: designType === 'upload' ? 1 : 0,
                borderColor: designType === 'upload' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                padding: 12, 
                borderRadius: 12, 
                alignItems: 'center' 
              }}
            >
              <Text style={{ color: designType === 'upload' ? '#10b981' : '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Upload Image</Text>
            </Pressable>
            <Pressable 
              onPress={() => setDesignType('describe')}
              style={{ 
                flex: 1, 
                backgroundColor: designType === 'describe' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.1)',
                borderWidth: designType === 'describe' ? 1 : 0,
                borderColor: designType === 'describe' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                padding: 12, 
                borderRadius: 12, 
                alignItems: 'center' 
              }}
            >
              <Text style={{ color: designType === 'describe' ? '#10b981' : '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Describe</Text>
            </Pressable>
          </View>
        </View>

        {/* Image Upload */}
        {designType === 'upload' && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Upload Reference Image</Text>
            <Pressable onPress={pickImage} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' }}>
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
          <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Design Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your dream dress... (style, occasion, fit, etc.)"
            placeholderTextColor="#a1a1aa"
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: 12,
              borderRadius: 12,
              color: '#e4e4e7',
              fontSize: 14,
              textAlignVertical: 'top'
            }}
          />
        </View>

        {/* Budget and Material */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Preferences</Text>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Budget Range</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              placeholder="e.g., $200-500"
              placeholderTextColor="#a1a1aa"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: 12,
                borderRadius: 12,
                color: '#e4e4e7',
                fontSize: 14
              }}
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Preferred Material</Text>
            <TextInput
              value={material}
              onChangeText={setMaterial}
              placeholder="e.g., Silk, Cotton, Linen"
              placeholderTextColor="#a1a1aa"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: 12,
                borderRadius: 12,
                color: '#e4e4e7',
                fontSize: 14
              }}
            />
          </View>

          <View>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Additional Notes</Text>
            <TextInput
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder="Any special requirements or details..."
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
          </View>
        </View>

        <Pressable onPress={submitDesign} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>Get Vendor Quotes</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function AccountScreen({ onBack }) {
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
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={onBack} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>
          Account
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Profile Photo</Text>
          
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            {profileData.bodyPhoto ? (
              <Image source={{ uri: profileData.bodyPhoto }} style={{ width: 120, height: 120, borderRadius: 60 }} />
            ) : (
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#a1a1aa', fontSize: 24 }}>📷</Text>
              </View>
            )}
          </View>
          
          <Pressable onPress={pickBodyPhoto} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>
              {profileData.bodyPhoto ? 'Change Photo' : 'Upload Body Photo'}
            </Text>
          </Pressable>
        </View>

        {/* Profile Information */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600' }}>Profile Information</Text>
            <Pressable onPress={() => setIsEditing(!isEditing)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '600' }}>
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
              <Pressable onPress={saveProfile} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>Save Changes</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Account Settings */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Settings</Text>
          
          <View style={{ gap: 12 }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Notifications</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>On</Text>
            </Pressable>
            
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Privacy</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Public</Text>
            </Pressable>
            
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>Data & Storage</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Manage</Text>
            </Pressable>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable onPress={handleSignOut} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
            Sign Out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function BottomBar({ route, go }) {
  const items = [
    ['shop', 'Shop'], ['feed', 'Explore'], ['tryon', 'Try-On'], ['stylecraft', 'StyleCraft']
  ];
  return (
    <View style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      paddingBottom: 20, // Reduced bottom padding
      backgroundColor: 'rgba(0,0,0,0.9)',
      paddingTop: 8
    }}>
      <View style={{
        flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 9999,
        paddingHorizontal: 8, paddingVertical: 6
      }}>
        {items.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => go(k)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
              backgroundColor: route === k ? '#fff' : 'transparent'
            }}
          >
            <Text style={{
              color: route === k ? '#000' : '#d4d4d8',
              fontWeight: route === k ? '700' : '500',
              fontSize: 12
            }}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => go('account')}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
            backgroundColor: route === 'account' ? '#fff' : 'transparent'
          }}
        >
          <Text style={{
            color: route === 'account' ? '#000' : '#d4d4d8',
            fontWeight: route === 'account' ? '700' : '500',
            fontSize: 12
          }}>⚙️</Text>
        </Pressable>
      </View>
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

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 }, // Add bottom padding for bottom bar
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
  productPrice: { color: '#a1a1aa', fontSize: 14 }
});
