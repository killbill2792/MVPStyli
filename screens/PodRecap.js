import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  getPod, 
  getPodVotes, 
  getPodComments, 
  calculateConfidence,
  getVoteCounts
} from '../lib/pods';
import { supabase } from '../lib/supabase';
import { Colors, getColors } from '../lib/designSystem';

// Safe Image Component
const SafeImage = ({ source, style, resizeMode, ...props }) => {
  const [error, setError] = useState(false);
  
  if (error || !source || !source.uri || typeof source.uri !== 'string') {
    return (
      <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
         <Text style={{ fontSize: 10, color: '#666' }}>IMG</Text>
      </View>
    );
  }

  return (
    <Image 
      source={source} 
      style={style} 
      resizeMode={resizeMode} 
      onError={(e) => {
        console.log('Image load error:', e.nativeEvent.error, source.uri);
        setError(true);
      }}
      {...props} 
    />
  );
};

// Helper to parse image URI
const getValidImageUri = (imageField) => {
  if (!imageField) return null;
  if (typeof imageField !== 'string') return null;
  
  try {
    if (imageField.trim().startsWith('[')) {
      const parsed = JSON.parse(imageField);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return { uri: parsed[0] };
      }
    }
  } catch (e) {}
  
  return { uri: imageField };
};

const { width, height } = Dimensions.get('window');

const PodRecap = ({ podId, onBack, onStyleCraft, onShopSimilar, onViewProduct, onUserProfile, userId }) => {
  const [pod, setPod] = useState(null);
  const [votes, setVotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [voterProfiles, setVoterProfiles] = useState({});
  const [commenterProfiles, setCommenterProfiles] = useState({});
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (podId && podId !== 'undefined' && podId.length >= 30) {
      loadPodData();
    } else {
      console.error('Cannot load pod recap - invalid podId:', podId);
    }
  }, [podId]);

  const loadPodData = async () => {
    if (!podId || podId === 'undefined' || podId.length < 30) {
      console.error('Cannot load pod data - invalid podId:', podId);
      return;
    }
    const [podData, votesData, commentsData] = await Promise.all([
      getPod(podId),
      getPodVotes(podId),
      getPodComments(podId, userId) // FIX: Pass viewerId for privacy filtering
    ]);
    
    setPod(podData);
    setVotes(votesData);
    setComments(commentsData);

    // For Friends pods, fetch voter and commenter profiles
    if (podData?.audience === 'friends') {
      const voterIds = [...new Set(votesData.map(v => v.voter_id).filter(Boolean))];
      const commenterIds = [...new Set(commentsData.map(c => c.author_id).filter(Boolean))];
      const allUserIds = [...new Set([...voterIds, ...commenterIds])];
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', allUserIds);
        
        const profileMap = {};
        (profiles || []).forEach(p => {
          profileMap[p.id] = {
            name: p.name || p.email?.split('@')[0] || 'Friend',
            avatar: p.avatar_url,
          };
        });
        setVoterProfiles(profileMap);
        setCommenterProfiles(profileMap);
      }
    }
  };

  if (!pod) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const confidence = calculateConfidence(votes);
  const voteCounts = getVoteCounts(votes);

  const getVerdict = (conf) => {
    if (conf >= 70) return { text: "Green light ✅", color: '#10b981' };
    if (conf >= 40) return { text: "Mixed feelings 🤔", color: '#f59e0b' };
    return { text: "Not their favorite ❌", color: '#ef4444' };
  };

  const verdict = getVerdict(confidence);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Recap</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        {/* Headline */}
        <View style={styles.headlineContainer}>
            <Text style={styles.questionText}>{pod.title}</Text>
            <Text style={[styles.verdictText, { color: verdict.color }]}>{verdict.text}</Text>
        </View>

        {/* Big Confidence */}
        <View style={styles.confidenceCard}>
            <Text style={styles.confidenceValue}>{confidence}%</Text>
            <Text style={styles.confidenceLabel}>Confidence Score</Text>
        </View>

        {/* Vote Breakdown */}
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Text style={styles.emoji}>🔥</Text>
                <Text style={styles.statCount}>{voteCounts.yes}</Text>
                <Text style={styles.statLabel}>Yes</Text>
            </View>
            <View style={styles.statItem}>
                <Text style={styles.emoji}>🤔</Text>
                <Text style={styles.statCount}>{voteCounts.maybe}</Text>
                <Text style={styles.statLabel}>Maybe</Text>
            </View>
            <View style={styles.statItem}>
                <Text style={styles.emoji}>❌</Text>
                <Text style={styles.statCount}>{voteCounts.no}</Text>
                <Text style={styles.statLabel}>No</Text>
            </View>
        </View>

        {/* Image Thumbnail */}
        <Pressable onPress={() => setShowFullImage(true)} style={styles.imageCard}>
            <SafeImage source={getValidImageUri(pod.image_url)} style={styles.thumbnail} resizeMode="cover" />
            <View style={styles.imageOverlay}>
                <Text style={styles.viewImageText}>View Outfit ↗</Text>
            </View>
        </Pressable>

        {/* Friend-by-Friend Vote Breakdown (for Friends pods) */}
        {pod.audience === 'friends' && votes.length > 0 && (
            <View style={styles.friendVotesSection}>
                <Text style={styles.sectionTitle}>Who Voted What</Text>
                <View style={styles.friendVotesGrid}>
                    {votes.slice(0, 10).map((vote, idx) => {
                        const profile = voterProfiles[vote.voter_id] || {};
                        const emoji = vote.choice === 'yes' ? '🔥' : vote.choice === 'maybe' ? '🤔' : '❌';
                        return (
                            <Pressable 
                                key={vote.id || idx} 
                                style={styles.friendVoteItem}
                                onPress={() => {
                                    if (vote.voter_id && onUserProfile) {
                                        onUserProfile(vote.voter_id);
                                    }
                                }}
                            >
                                {profile.avatar ? (
                                    <SafeImage source={{ uri: profile.avatar }} style={styles.friendAvatar} />
                                ) : (
                                    <View style={styles.friendAvatarPlaceholder}>
                                        <Text style={styles.friendAvatarText}>{(profile.name || 'F')[0]}</Text>
                                    </View>
                                )}
                                <Text style={styles.friendName}>{profile.name || 'Friend'}</Text>
                                <Text style={styles.friendVoteEmoji}>{emoji}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        )}

        {/* Comments with Author Info - ONLY visible to pod owner */}
        {pod.audience !== 'style_twins' && comments.length > 0 && pod.owner_id === userId && (
            <View style={styles.commentsSection}>
                <Text style={styles.sectionTitle}>Comments (Only you can see these)</Text>
                {comments.slice(0, 5).map(c => {
                    const profile = commenterProfiles[c.author_id] || {};
                    return (
                        <View key={c.id} style={styles.commentCard}>
                            <Pressable 
                                style={styles.commentHeader}
                                onPress={() => {
                                    if (c.author_id && onUserProfile) {
                                        onUserProfile(c.author_id);
                                    }
                                }}
                            >
                                {profile.avatar ? (
                                    <SafeImage source={{ uri: profile.avatar }} style={styles.commentAvatar} />
                                ) : (
                                    <View style={styles.commentAvatarPlaceholder}>
                                        <Text style={styles.commentAvatarText}>{(profile.name || 'F')[0]}</Text>
                                    </View>
                                )}
                                <Text style={styles.commentAuthor}>{profile.name || 'Friend'}</Text>
                            </Pressable>
                            <Text style={styles.commentBody}>"{c.body}"</Text>
                        </View>
                    );
                })}
            </View>
        )}

        {/* Product Link */}
        {pod.product_url && (
            <View style={styles.productSection}>
                <Text style={styles.sectionTitle}>Product Used</Text>
                <Pressable 
                    style={styles.productCard}
                    onPress={() => {
                        if (onViewProduct) {
                            onViewProduct(pod.product_url);
                        } else if (onShopSimilar) {
                            onShopSimilar(pod.product_url);
                        } else {
                            Linking.openURL(pod.product_url).catch(err => {
                                console.error('Failed to open URL:', err);
                            });
                        }
                    }}
                >
                    <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>🛍️ View Product</Text>
                        <Text style={styles.productUrl} numberOfLines={1}>{pod.product_url}</Text>
                    </View>
                    <Text style={styles.productArrow}>→</Text>
                </Pressable>
            </View>
        )}

      </ScrollView>

      {/* Full Screen Image Modal - Explore Style */}
      <Modal visible={showFullImage} transparent={true} animationType="fade">
          <View style={styles.exploreModalContainer}>
              {/* Close Button */}
              <Pressable style={styles.exploreCloseBtn} onPress={() => setShowFullImage(false)}>
                  <Text style={styles.exploreCloseText}>✕</Text>
              </Pressable>
              
              {/* Image */}
              <View style={styles.exploreImageContainer}>
                  <SafeImage source={getValidImageUri(pod.image_url)} style={styles.exploreFullImage} resizeMode="cover" />
                  
                  {/* Gradient Overlay */}
                  <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.exploreGradient}
                  >
                      <Text style={styles.exploreTitle}>{pod.title}</Text>
                      <View style={styles.exploreStats}>
                          <Text style={styles.exploreStatText}>🔥 {voteCounts.yes}</Text>
                          <Text style={styles.exploreStatText}>🤔 {voteCounts.maybe}</Text>
                          <Text style={styles.exploreStatText}>❌ {voteCounts.no}</Text>
                      </View>
                  </LinearGradient>
              </View>
          </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 100,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  headlineContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  verdictText: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  confidenceCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  confidenceValue: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 70,
  },
  confidenceLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statCount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  friendVoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  friendEmoji: {
    fontSize: 20,
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  insightText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  imageCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewImageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  friendVotesSection: {
    marginBottom: 32,
  },
  friendVotesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  friendVoteItem: {
    alignItems: 'center',
    width: 70,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 6,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  friendName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  friendVoteEmoji: {
    fontSize: 18,
  },
  commentsSection: {
    marginBottom: 32,
  },
  commentCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  commentAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  commentAuthor: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentBody: {
    color: '#d1d5db',
    fontSize: 14,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: height * 0.8,
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },
  closeModalText: {
    color: '#fff',
    fontSize: 32,
  },
  // Explore-style modal
  exploreModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  exploreCloseBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  exploreImageContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    margin: 10,
    marginTop: 50,
    marginBottom: 100,
  },
  exploreFullImage: {
    width: '100%',
    height: '100%',
  },
  exploreGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
  },
  exploreTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  exploreStats: {
    flexDirection: 'row',
    gap: 16,
  },
  exploreStatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productSection: {
    marginBottom: 32,
  },
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productUrl: {
    color: '#9ca3af',
    fontSize: 12,
  },
  productArrow: {
    color: '#6366f1',
    fontSize: 24,
    fontWeight: '700',
  },
});

export default PodRecap;

