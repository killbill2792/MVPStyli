import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, Image, StyleSheet, Alert, StatusBar, TextInput, ScrollView, TouchableWithoutFeedback } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { customAlphabet } from 'nanoid/non-secure';
import { supabase } from './lib/supabase';
import { uploadImageAsync } from './lib/upload';
import { getCleanGarmentUrl } from './lib/cleaner';
import { startTryOn, pollTryOn } from './lib/tryon';

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const Ctx = createContext(null);
function rid() { return nano(); }

const initial = {
  route: 'setup',
  params: {},
  twinUri: null,
  user: null,
  products: [
    { id: 'denim-jacket', title: 'ASOS Denim Jacket', price: 69, rating: 4.6, image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&auto=format&fit=crop&w=1200', category: 'upper' },
    { id: 'black-blazer', title: 'Zara Black Blazer', price: 119, rating: 4.4, image: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', category: 'upper' },
    { id: 'silk-dress', title: 'COS Silk Dress', price: 159, rating: 4.7, image: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200', category: 'dress' },
    { id: 'white-sneakers', title: 'Nike Air Force 1', price: 90, rating: 4.8, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&auto=format&fit=crop&w=1200', category: 'lower' },
    { id: 'leather-bag', title: 'Coach Leather Tote', price: 295, rating: 4.5, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&auto=format&fit=crop&w=1200', category: 'upper' },
    { id: 'knit-sweater', title: 'Uniqlo Cashmere', price: 79, rating: 4.3, image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&auto=format&fit=crop&w=1200', category: 'upper' }
  ],
  currentProductId: 'denim-jacket',
  feedItems: [
    { id: 'f1', uri: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&auto=format&fit=crop&w=1200', handle: '@mina', sub: 'Party • Streetwear', yes: 82, maybe: 15, no: 9 },
    { id: 'f2', uri: 'https://images.unsplash.com/photo-1503342217505-b0a15cf70489?q=80&auto=format&fit=crop&w=1200', handle: '@sophia', sub: 'Office • Minimalist', yes: 67, maybe: 23, no: 12 },
    { id: 'f3', uri: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&auto=format&fit=crop&w=1200', handle: '@zara', sub: 'Casual • Boho', yes: 91, maybe: 7, no: 4 },
    { id: 'f4', uri: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&auto=format&fit=crop&w=1200', handle: '@emma', sub: 'Weekend • Cozy', yes: 74, maybe: 18, no: 8 }
  ],
  currentFeedIndex: 0,
  rooms: []
};

export function AppProvider({ children }) {
  const [state, setState] = useState(initial);
  
  const api = useMemo(() => ({
    state,
    setRoute: (route, params) => setState(s => ({ ...s, route, params: params || {} })),
    setTwinUri: (uri) => setState(s => ({ ...s, twinUri: uri })),
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
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { state: { route, user }, setRoute, setUser } = useApp();
  
  // Check if we have real Supabase credentials
  const hasSupabaseCredentials = process.env.EXPO_PUBLIC_SUPABASE_URL && 
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && 
    !process.env.EXPO_PUBLIC_SUPABASE_URL.includes("your-project");
  
  // Show setup screen if credentials are missing
  if (!hasSupabaseCredentials) {
    return <SetupScreen />;
  }
  
  // Initialize user on first load
  useEffect(() => {
    if (!user) {
      supabase.auth.signInAnonymously().then(({ data, error }) => {
        if (error) {
          console.error("Auth error:", error);
          setUser({ id: "local-user-" + Date.now(), email: null });
        } else {
          setUser(data.user);
        }
      });
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
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
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

function SetupScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000', padding: 24 }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#e4e4e7', fontSize: 32, fontWeight: '700', marginBottom: 16 }}>
          MVPStyli Setup Required
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 16, textAlign: 'center', marginBottom: 32 }}>
          To use this app, you need to configure your API credentials
        </Text>
        
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 24, padding: 20, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: '#e4e4e7', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
            Required Setup:
          </Text>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              1. Supabase Setup
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
              • Create project at supabase.com{'\n'}
              • Get Project URL and anon key{'\n'}
              • Enable anonymous auth{'\n'}
              • Create public 'images' bucket
            </Text>
          </View>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              2. Vercel API Setup
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
              • Deploy /api folder to Vercel{'\n'}
              • Get your Vercel app URL{'\n'}
              • Set environment variables
            </Text>
          </View>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              3. Replicate AI Setup
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
              • Get API token from replicate.com{'\n'}
              • Choose try-on model
            </Text>
          </View>
          
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
              Current Status:
            </Text>
            <Text style={{ color: '#ef4444', fontSize: 12 }}>
              Supabase credentials not configured
            </Text>
          </View>
        </View>
        
        <View style={{ marginTop: 24, backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
            Next Steps:
          </Text>
          <Text style={{ color: '#22c55e', fontSize: 12 }}>
            1. Update .env.local with real credentials{'\n'}
            2. Restart the app{'\n'}
            3. Follow SETUP_GUIDE.md for details
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SignInScreen({ onDone }) {
  const [email, setEmail] = useState('');
  const { setUser } = useApp();

  const handleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setUser(data.user);
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
  const { setTwinUri, setRoute, state: { twinUri } } = useApp();
  
  const pick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo access.');
        return;
      }
      
      const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        quality: 0.9 
      });
      
      if (!res.canceled) {
        const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
        setTwinUri(uploadedUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Please try again.');
    }
  };
  
  const next = () => {
    if (twinUri) {
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
        {twinUri && (
          <View style={{ marginTop: 12 }}>
            <Image source={{ uri: twinUri }} style={{ width: 100, height: 100, borderRadius: 12 }} />
            <Text style={{ color: '#10b981', fontSize: 14, marginTop: 4 }}>✓ Photo uploaded</Text>
          </View>
        )}
        <View style={{ height: 12 }} />
        <Pressable onPress={next} style={[s.btn, s.btnPrimary, !twinUri && { opacity: 0.5 }]} disabled={!twinUri}>
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
            <Image source={{ uri: p.image }} style={s.productImage} />
            <View style={{ padding: 12 }}>
              <Text style={s.productTitle}>{p.title}</Text>
              <Text style={s.productPrice}>${p.price} • {p.rating}★</Text>
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
      getCleanGarmentUrl(product.id, product.image, product.category)
        .then(url => {
          setCleanUrl(url);
          setLoading(false);
        })
        .catch(error => {
          console.error('Clean URL error:', error);
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
          <Text style={{ color: '#a1a1aa' }}>{product.rating}★ · Free returns</Text>
        </View>
        <Text style={{ color: '#a1a1aa' }}>Fabric: Cotton blend • Shipping: 2–4 days • Returns: 30 days</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable 
            disabled={!cleanUrl || loading} 
            onPress={() => setRoute('tryon', { garmentCleanUrl: cleanUrl })} 
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
          <Pressable onPress={() => setRoute('askhelp')} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', padding: 12, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>Ask Help</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setRoute('shop')}><Text style={{ color: '#3b82f6', marginTop: 8 }}>Back to shop</Text></Pressable>
      </View>
    </View>
  );
}

function TryOn() {
  const { state: { twinUri, currentProductId, products }, setRoute, setTwinUri } = useApp();
  const product = products.find(p => p.id === currentProductId);
  const garmentCleanUrl = useApp().state.params?.garmentCleanUrl;
  
  const [showAI, setShowAI] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  
  useEffect(() => {
    if (twinUri && garmentCleanUrl) {
      applyOutfit();
    }
  }, [twinUri, garmentCleanUrl]);
  
  const applyOutfit = async () => {
    if (!twinUri || !garmentCleanUrl) {
      Alert.alert('Error', 'Please upload your photo and select a garment first.');
      return;
    }
    
    try {
      setBusy(true);
      const { jobId } = await startTryOn(twinUri, garmentCleanUrl, product?.category);
      
      let status;
      do {
        await new Promise(r => setTimeout(r, 1500));
        status = await pollTryOn(jobId);
      } while (status.status === 'queued' || status.status === 'running');
      
      if (status.status === 'succeeded' && status.resultUrl) {
        setResult(status.resultUrl);
        Alert.alert('Success', 'Try-on generated!');
      } else {
        throw new Error(status.error || 'Try-on failed');
      }
    } catch (error) {
      Alert.alert('Try-On Error', String(error?.message || error));
    } finally {
      setBusy(false);
    }
  };
  
  if (!twinUri) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#e4e4e7', fontSize: 18, marginBottom: 16 }}>No photo uploaded</Text>
        <Pressable onPress={() => setRoute('onboarding')} style={s.btn}>
          <Text style={s.btnText}>Upload Photo</Text>
        </Pressable>
      </View>
    );
  }
  
  return (
    <TouchableWithoutFeedback onPress={() => { setShowAI(false); setShowSuggest(false); }}>
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
          <Image source={{ uri: result || twinUri }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          
          <Pressable onPress={() => setTwinUri(null)} style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>📷 Change Photo</Text>
          </Pressable>
          
          <View style={{ position: 'absolute', right: 8, top: 8, gap: 8 }}>
            <Rail icon="📈" onPress={() => { setShowAI(v => !v); setShowSuggest(false); }} />
            <Rail icon="🧩" onPress={() => { setShowSuggest(v => !v); setShowAI(false); }} />
          </View>
          
          {showAI && (
            <View style={{ position: 'absolute', right: 12, top: 12, width: 330, padding: 18, backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderRadius: 16 }}>
              <Text style={{ color: '#e4e4e7', fontWeight: '700', marginBottom: 8, fontSize: 16 }}>AI Analytics</Text>
              <Stat label="Confidence" value={82} />
              <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 8 }}>Fit tips:</Text>
              <Text style={{ color: '#e4e4e7', fontSize: 14 }}>• Shorten hem 2cm{'\n'}• Add belt to define waist</Text>
            </View>
          )}
          
          {showSuggest && (
            <View style={{ position: 'absolute', right: 12, top: 12, width: 330, padding: 18, backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderRadius: 16 }}>
              <Text style={{ color: '#e4e4e7', fontWeight: '700', marginBottom: 8, fontSize: 16 }}>Suggestions</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['White sneakers', 'Crossbody bag', 'Denim overshirt', 'Pearl studs'].map(t => (
                  <View key={t} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => Alert.alert('Save', 'Outfit saved!')} style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
              <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setRoute('product')} style={{ backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}>
              <Text style={{ color: '#fff' }}>Change Dress</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function Feed() {
  const { state: { feedItems, currentFeedIndex }, nextFeedItem } = useApp();
  const item = feedItems[currentFeedIndex];
  const [hasVoted, setHasVoted] = useState(false);
  
  const vote = (label) => {
    if (hasVoted) return;
    setHasVoted(true);
    setTimeout(() => {
      nextFeedItem();
      setHasVoted(false);
    }, 1000);
  };
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', maxWidth: 420 }}>
        <Image source={{ uri: item.uri }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        
        <View style={{ position: 'absolute', top: 16, left: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{item.handle}</Text>
          <Text style={{ color: '#fff', fontSize: 14, opacity: 0.9 }}>{item.sub}</Text>
        </View>
        
        <View style={{ position: 'absolute', bottom: 16, right: 16, gap: 12 }}>
          <Pressable onPress={() => vote('yes')} style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 9999, opacity: hasVoted ? 0.5 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 24 }}>👍</Text>
          </Pressable>
          <Pressable onPress={() => vote('maybe')} style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 9999, opacity: hasVoted ? 0.5 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 24 }}>🤔</Text>
          </Pressable>
          <Pressable onPress={() => vote('no')} style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 9999, opacity: hasVoted ? 0.5 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 24 }}>👎</Text>
          </Pressable>
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
          <Text style={s.btnPrimaryText}>👍 Yes ({room.votes.yes})</Text>
        </Pressable>
        <Pressable onPress={() => vote(roomId, 'maybe')} style={s.btn}>
          <Text style={s.btnText}>🤔 Maybe ({room.votes.maybe})</Text>
        </Pressable>
        <Pressable onPress={() => vote(roomId, 'no')} style={s.btn}>
          <Text style={s.btnText}>👎 No ({room.votes.no})</Text>
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
      await supabase.auth.signOut();
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

function Rail({ icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: 12, borderRadius: 14 }}>
      <Text style={{ fontSize: 18, color: '#fff' }}>{icon}</Text>
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{label}</Text>
        <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '700' }}>{value}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9999, marginTop: 6 }}>
        <View style={{ width: `${value}%`, height: 6, borderRadius: 9999, backgroundColor: '#fff' }} />
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
  container: { flex: 1, padding: 16 },
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
  productImage: { width: '100%', height: 200, borderRadius: 16 },
  productTitle: { color: '#e4e4e7', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  productPrice: { color: '#a1a1aa', fontSize: 14 }
});
