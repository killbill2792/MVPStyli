import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';
import { sendFriendRequest, areFriends, hasSentFriendRequest, unfriend } from '../lib/friends';

const { width } = Dimensions.get('window');

const UserProfileScreen = ({ userId, onBack, onPodGuest, onViewTryOn }) => {
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { user: currentUser } = state;
  const [profile, setProfile] = useState(null);
  const [publicPods, setPublicPods] = useState([]);
  const [publicTryOns, setPublicTryOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState('none'); // 'none', 'sent', 'friends'
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [showUnfriendDropdown, setShowUnfriendDropdown] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      checkFriendStatus();
    }
  }, [userId, currentUser?.id]);

  const checkFriendStatus = async () => {
    if (!currentUser?.id || !userId || currentUser.id === userId) {
      setFriendStatus('none');
      return;
    }

    try {
      const isFriend = await areFriends(currentUser.id, userId);
      if (isFriend) {
        setFriendStatus('friends');
      } else {
        const hasSent = await hasSentFriendRequest(currentUser.id, userId);
        setFriendStatus(hasSent ? 'sent' : 'none');
      }
    } catch (error) {
      console.error('Error checking friend status:', error);
      setFriendStatus('none');
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser?.id || !userId || isSendingRequest) return;

    setIsSendingRequest(true);
    try {
      const result = await sendFriendRequest(currentUser.id, userId);
      if (result.success) {
        if (result.isMutual) {
          setFriendStatus('friends');
          // Show success message
        } else {
          setFriendStatus('sent');
        }
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setProfile(profileData);

      // Load public pods (visibility = 'public' or 'everyone')
      const { data: pods } = await supabase
        .from('pods')
        .select('*')
        .eq('owner_id', userId)
        .in('visibility', ['public', 'everyone'])
        .order('created_at', { ascending: false })
        .limit(10);

      setPublicPods(pods || []);

      // Load public try-ons if table exists
      try {
        const { data: tryOns } = await supabase
          .from('try_on_history')
          .select('*')
          .eq('user_id', userId)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(10);

        setPublicTryOns(tryOns || []);
      } catch (e) {
        // Table might not exist
        setPublicTryOns([]);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyEmoji}>👤</Text>
          <Text style={styles.emptyTitle}>Profile not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#ec4899']}
            style={styles.avatarGradient}
          >
            <View style={styles.avatar}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(profile.name || 'U')[0].toUpperCase()}</Text>
              )}
            </View>
          </LinearGradient>
          
          <Text style={styles.profileName}>{profile.name || 'User'}</Text>
          <Text style={styles.profileBio}>Style enthusiast</Text>
          
          {/* Add Friend / Friends Button - Only show if viewing someone else's profile */}
          {currentUser?.id && currentUser.id !== userId && (
            <View style={{ position: 'relative', marginTop: 16 }}>
              <Pressable 
                style={[
                  styles.addFriendButton,
                  friendStatus === 'friends' && styles.addFriendButtonFriends,
                  friendStatus === 'sent' && styles.addFriendButtonSent,
                  isSendingRequest && styles.addFriendButtonDisabled
                ]}
                onPress={() => {
                  if (friendStatus === 'friends') {
                    setShowUnfriendDropdown(!showUnfriendDropdown);
                  } else {
                    handleAddFriend();
                  }
                }}
                disabled={isSendingRequest}
              >
                {isSendingRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.addFriendButtonText}>
                      {friendStatus === 'friends' ? '✓ Friends' : 
                       friendStatus === 'sent' ? 'Request Sent' : 
                       '+ Add Friend'}
                    </Text>
                    {friendStatus === 'friends' && (
                      <Text style={styles.addFriendButtonText}>▼</Text>
                    )}
                  </View>
                )}
              </Pressable>
              
              {/* Unfriend Dropdown */}
              {showUnfriendDropdown && friendStatus === 'friends' && (
                <View style={styles.unfriendDropdown}>
                  <Pressable
                    style={styles.unfriendOption}
                    onPress={async () => {
                      if (currentUser?.id && userId) {
                        try {
                          const success = await unfriend(currentUser.id, userId);
                          if (success) {
                            setFriendStatus('none');
                            setShowUnfriendDropdown(false);
                            // Optionally show a success message
                          }
                        } catch (error) {
                          console.error('Error unfriending:', error);
                        }
                      }
                    }}
                  >
                    <Text style={styles.unfriendOptionText}>Unfriend</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Public Pods */}
        {publicPods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Public Pods</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {publicPods.map(pod => (
                <Pressable 
                  key={pod.id} 
                  style={styles.podCard}
                  onPress={() => onPodGuest && onPodGuest(pod.id)}
                >
                  <Image source={{ uri: pod.image_url }} style={styles.podImage} />
                  <View style={styles.podOverlay}>
                    <Text style={styles.podTitle} numberOfLines={2}>{pod.title}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Public Try-Ons */}
        {publicTryOns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Public Try-Ons</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {publicTryOns.map((tryOn, idx) => (
                <Pressable 
                  key={tryOn.id || idx} 
                  style={styles.tryOnCard}
                  onPress={() => onViewTryOn && onViewTryOn(tryOn)}
                >
                  <Image source={{ uri: tryOn.result_url }} style={styles.tryOnImage} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {publicPods.length === 0 && publicTryOns.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyTitle}>Nothing public yet</Text>
            <Text style={styles.emptyText}>This user hasn't shared any public content</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileBio: {
    color: '#888',
    fontSize: 14,
  },
  addFriendButton: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 140,
  },
  addFriendButtonFriends: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  addFriendButtonSent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  addFriendButtonDisabled: {
    opacity: 0.6,
  },
  addFriendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  podCard: {
    width: 150,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#1a1a1a',
  },
  podImage: {
    width: '100%',
    height: '100%',
  },
  podOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  podTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tryOnCard: {
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#1a1a1a',
  },
  tryOnImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  unfriendDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    zIndex: 1000,
  },
  unfriendOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  unfriendOptionText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UserProfileScreen;

