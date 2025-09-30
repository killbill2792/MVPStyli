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
    }
  }, [user, setUser]);
  
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
    <SafeAreaView style={s.app} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        style={s.container} 
        contentContainerStyle={s.scrollContent}
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
        {route === "feed" && <Feed />}
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
          Alert.alert('Success', 'Photo uploaded to cloud storage!');
        } catch (error) {
          console.error('Upload error:', error);
          // Fallback: use local URI
          setTwinUrl(res.assets[0].uri);
          Alert.alert('Upload Note', 'Photo saved locally. Some features may be limited.');
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
  
  return (
    <View style={s.grid2}>
      {products.map(p => (
        <Pressable key={p.id} onPress={() => { setCurrentProduct(p.id); setRoute('product'); }}>
          <Card>
            <View style={s.productImageContainer}>
              <Image 
                source={{ uri: p.image }} 
                style={s.productImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Image load error for', p.id, error);
                }}
              />
            </View>
            <View style={{ padding: 12 }}>
              <Text style={s.productTitle}>{p.name}</Text>
              <Text style={s.productPrice}>${p.price}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function Product() {
  const { state: { products, currentProductId }, setRoute } = useApp();
  const product = products.find(p => p.id === currentProductId);
  const [cleanUrl, setCleanUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
  
  if (!product) return null;
  
  return (
    <View style={{ gap: 14 }}>
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden' }}>
        <Image source={{ uri: product.image }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#e4e4e7', fontWeight: '700', fontSize: 16 }}>${product.price}</Text>
          <Text style={{ color: '#a1a1aa' }}>Free returns</Text>
        </View>
        <Text style={{ color: '#a1a1aa' }}>Fabric: Cotton blend • Shipping: 2–4 days • Returns: 30 days</Text>
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
            <Pressable
              onPress={() => Linking.openURL(product.buyUrl)}
              style={[s.btn, s.btnGhost, { flex: 1 }]}
            >
              <Text>Buy</Text>
            </Pressable>
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
        Alert.alert('Success', 'Try-on loaded from cache!');
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
          Alert.alert('Success', 'AI try-on generated!');
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
  
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {busy && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', borderRadius: 0 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '700' }}>Generating Try-On...</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 8 }}>AI is applying the outfit to your photo</Text>
          </View>
        </View>
      )}
      
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', maxWidth: 420 }}>
        <Image source={{ uri: result || twinUrl }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        
        <Pressable onPress={() => setTwinUrl(null)} style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>📷 Change Photo</Text>
        </Pressable>
        
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={handleTryOn} style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
            <Text style={{ color: '#000', fontWeight: '700' }}>✨ Try On</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Feed() {
  const { state: { feedItems, currentFeedIndex }, nextFeedItem } = useApp();

  const items = (Array.isArray(feedItems) && feedItems.length > 0)
    ? feedItems
    : [
        { id: 'f1', uri: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200', handle: '@mina',  sub: 'Party • Streetwear' },
        { id: 'f2', uri: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', handle: '@sophia',sub: 'Office • Minimalist' },
        { id: 'f3', uri: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200', handle: '@zara',  sub: 'Casual • Boho' },
      ];

  const idx = currentFeedIndex % items.length;
  const current = items[idx];

  const [hasVoted, setHasVoted] = useState(false);

  const onVote = () => {
    if (hasVoted) return;
    setHasVoted(true);
    setTimeout(() => { setHasVoted(false); nextFeedItem(); }, 900);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', maxWidth: 420 }}>
        <Image source={{ uri: current.uri }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        <View style={{ position: 'absolute', left: 12, top: 12 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{current.handle}</Text>
          <Text style={{ color: '#fff', opacity: 0.9 }}>{current.sub}</Text>
        </View>

        {/* Horizontal emoji bar centered at bottom */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          {['🔥','💯','❌'].map((e, i) => (
            <Pressable key={i} onPress={onVote} style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9999, opacity: hasVoted ? 0.5 : 1 }}>
              <Text style={{ color: '#fff', fontSize: 22 }}>{e}</Text>
            </Pressable>
          ))}
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
  const [duration, setDuration] = useState(60);
  
  const create = () => {
    const room = createRoom({ 
      lookId: 'current-look', 
      mode: 'help', 
      durationMins: duration, 
      title: 'Help Room' 
    });
    setRoute('room_owner', { roomId: room.id });
  };
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>Create Help Room</Text>
        <Text style={s.muted}>Set duration and invite friends</Text>
        <View style={{ height: 24 }} />
        <Text style={s.label}>Duration: {duration} minutes</Text>
        <View style={{ height: 12 }} />
        <Pressable onPress={create} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>Create Room</Text>
        </Pressable>
        <Pressable onPress={() => setRoute('askhelp')} style={s.btn}>
          <Text style={s.btnText}>Back</Text>
        </Pressable>
      </Card>
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
  const { state: { rooms }, vote } = useApp();
  const roomId = useApp().state.params?.roomId;
  const room = rooms.find(r => r.id === roomId);
  
  if (!room) return null;
  
  return (
    <View style={s.grid2}>
      <Card>
        <Text style={s.h1}>Room: {room.title}</Text>
        <Text style={s.muted}>Votes: Yes {room.votes.yes} • Maybe {room.votes.maybe} • No {room.votes.no}</Text>
        <View style={{ height: 24 }} />
        <Pressable onPress={() => vote(roomId, 'yes')} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnPrimaryText}>🔥 Yes ({room.votes.yes})</Text>
        </Pressable>
        <Pressable onPress={() => vote(roomId, 'maybe')} style={s.btn}>
          <Text style={s.btnText}>❤️ Maybe ({room.votes.maybe})</Text>
        </Pressable>
        <Pressable onPress={() => vote(roomId, 'no')} style={s.btn}>
          <Text style={s.btnText}>❌ No ({room.votes.no})</Text>
        </Pressable>
        <Pressable onPress={() => useApp().setRoute('recap')} style={s.btn}>
          <Text style={s.btnText}>See AI Recap</Text>
        </Pressable>
      </Card>
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

function AccountScreen({ onBack }) {
  const { state: { user }, setUser, setRoute } = useApp();

  const handleSignOut = async () => {
    try {
      setUser(null);
      setRoute('signin');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 24, gap: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={onBack} style={{ marginRight: 16 }}>
          <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#e4e4e7', fontSize: 24, fontWeight: '700' }}>
          Account
        </Text>
      </View>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, gap: 16 }}>
        <View>
          <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>
            Email
          </Text>
          <Text style={{ color: '#e4e4e7', fontSize: 16 }}>
            {user?.email || 'Anonymous user'}
          </Text>
        </View>

        <View>
          <Text style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>
            User ID
          </Text>
          <Text style={{ color: '#e4e4e7', fontSize: 14, fontFamily: 'monospace' }}>
            {user?.id || 'Unknown'}
          </Text>
        </View>
      </View>

      <Pressable onPress={handleSignOut} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
          Sign Out
        </Text>
      </Pressable>
    </View>
  );
}

function BottomBar({ route, go }) {
  const items = [
    ['shop', 'Shop'], ['feed', 'Feed'], ['tryon', 'Try-On'], ['rooms', 'Rooms']
  ];
  return (
    <View style={{
      position: 'absolute', left: 0, right: 0, bottom: 12,
      alignItems: 'center'
    }}>
      <View style={{
        flexDirection: 'row', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 9999,
        paddingHorizontal: 10, paddingVertical: 8
      }}>
        {items.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => go(k)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
              backgroundColor: route === k ? '#fff' : 'transparent'
            }}
          >
            <Text style={{
              color: route === k ? '#000' : '#d4d4d8',
              fontWeight: route === k ? '700' : '500'
            }}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => go('account')}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
            backgroundColor: route === 'account' ? '#fff' : 'transparent'
          }}
        >
          <Text style={{
            color: route === 'account' ? '#000' : '#d4d4d8',
            fontWeight: route === 'account' ? '700' : '500'
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
