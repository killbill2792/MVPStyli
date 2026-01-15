import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Share,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from '../lib/SimpleGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getPod, 
  getPodVotes, 
  subscribeToPodVotes, 
  expirePod,
  getVoteCounts
} from '../lib/pods';
import { buildShareUrl } from '../lib/share';
import { supabase } from '../lib/supabase';
import { SafeImage, OptimizedImage } from '../lib/OptimizedImage';

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

const { height, width } = Dimensions.get('window');

const PodLive = ({ podId, onBack, onRecap, userId }) => {
  const [pod, setPod] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [podImages, setPodImages] = useState([]);
  const insets = useSafeAreaInsets();

  // Fetch pod data
  useEffect(() => {
    fetchPodData();
    const unsubscribe = subscribeToPodVotes(podId, (newVote) => {
      setVotes(prev => [...prev, newVote]);
    });
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, [podId]);

  // Parse images when pod loads
  useEffect(() => {
    if (pod?.image_url) {
      try {
        if (pod.image_url.trim().startsWith('[')) {
          const parsed = JSON.parse(pod.image_url);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPodImages(parsed.filter(img => img && typeof img === 'string'));
          } else {
            setPodImages([pod.image_url]);
          }
        } else {
          setPodImages([pod.image_url]);
        }
      } catch {
        setPodImages([pod.image_url]);
      }
    }
  }, [pod]);

  // Timer
  useEffect(() => {
    if (!pod) return;
    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(pod.ends_at);
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft(0);
        if (pod.status === 'live') {
             expirePod(pod.id); // Auto-expire
        }
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pod]);

  const fetchPodData = async () => {
    if (!podId) return;
    setLoading(true);
    const podData = await getPod(podId);
    const votesData = await getPodVotes(podId);
    setPod(podData);
    setVotes(votesData || []);
    setLoading(false);
  };

  const handleShare = async () => {
    try {
      if (!userId || !podId || !pod) return;
      const shareUrl = buildShareUrl({ kind: 'pod', podId, fromUserId: userId, audience: pod.audience });
      await Share.share({
        message: `Help me decide! Check out my look: ${shareUrl}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleEndPod = async () => {
    await expirePod(podId);
    setPod(prev => ({ ...prev, status: 'expired' }));
    setTimeLeft(0);
  };

  const formatTime = (ms) => {
    if (ms <= 0) return 'Ended';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m left`;
  };

  if (loading || !pod) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </View>
    );
  }

  const voteCounts = getVoteCounts(votes);
  const isEnded = pod.status === 'expired' || (timeLeft !== null && timeLeft <= 0);
  const BOTTOM_BAR_HEIGHT = 70;

  // Aggregate multi-image votes
  const getMultiImageStats = () => {
    if (podImages.length <= 1) return null;
    
    const stats = {};
    // Initialize with 0 for all images
    podImages.forEach((_, idx) => {
        stats[(idx + 1).toString()] = 0;
    });
    
    // Count votes
    votes.forEach(v => {
        // Check if vote matches "1", "2", etc.
        if (stats.hasOwnProperty(v.vote)) {
            stats[v.vote]++;
        }
    });
    
    return stats;
  };

  const multiStats = getMultiImageStats();

  return (
    <View style={styles.container}>
      
      {/* Full Screen Image Card */}
      <View style={[styles.imageContainer, { 
        height: height - insets.top - insets.bottom - BOTTOM_BAR_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 12,
        marginTop: insets.top + 8
      }]}>
        <SafeImage 
          source={getValidImageUri(pod.image_url)} 
          style={styles.fullImage} 
          resizeMode="cover"
          // No width/height = full-size image for pod live view
        />
        
        {/* Product Thumbnail - if available */}
        {pod.product_url && (
          <View style={styles.productThumb}>
            <Text style={styles.productThumbIcon}>👗</Text>
          </View>
        )}
        
        {/* Top Content - No container background */}
        <View style={styles.topOverlay}>
          <View style={styles.headerRow}>
              <View style={styles.userBadge}>
                  <Text style={styles.userName}>You</Text>
              </View>
              <View style={styles.modeBadge}>
                  <Text style={styles.modeText}>
                    {pod.audience === 'friends' ? '👥 Friends' : pod.audience === 'style_twins' ? '🧬 Twins' : '🌍 Global'}
                  </Text>
              </View>
              <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>{isEnded ? '🔴 Ended' : `⏱ ${formatTime(timeLeft)}`}</Text>
              </View>
          </View>
          <Text style={styles.questionText}>{pod.title}</Text>
        </View>

        {/* Bottom Controls Overlay - Inside the image card */}
        <LinearGradient 
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomOverlay}
        >
          {/* Stats */}
          <View style={styles.statsRow}>
              {podImages.length > 1 && multiStats ? (
                // Multi-image stats
                Object.keys(multiStats).slice(0, 3).map((key) => (
                    <View key={key} style={styles.statItem}>
                        <View style={styles.statBadge}>
                            <Text style={styles.statBadgeText}>{key}</Text>
                        </View>
                        <Text style={styles.count}>{multiStats[key]}</Text>
                    </View>
                ))
              ) : (
                // Standard stats
                <>
              <View style={styles.statItem}>
                  <Text style={styles.emoji}>🔥</Text>
                  <Text style={styles.count}>{voteCounts.yes}</Text>
              </View>
              <View style={styles.statItem}>
                  <Text style={styles.emoji}>🤔</Text>
                  <Text style={styles.count}>{voteCounts.maybe}</Text>
              </View>
              <View style={styles.statItem}>
                  <Text style={styles.emoji}>❌</Text>
                  <Text style={styles.count}>{voteCounts.no}</Text>
              </View>
                </>
              )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
              {isEnded ? (
                  <Pressable style={styles.glassBtn} onPress={() => onRecap(podId)}>
                      <Text style={styles.btnText}>View Recap</Text>
                  </Pressable>
              ) : (
                  <>
                      <Pressable style={styles.actionBtn} onPress={handleShare}>
                          <Text style={styles.actionBtnText}>Share</Text>
                      </Pressable>
                      <Pressable style={styles.destructBtn} onPress={handleEndPod}>
                          <Text style={styles.destructBtnText}>End Pod</Text>
                      </Pressable>
                  </>
              )}
          </View>
        </LinearGradient>
      </View>

      <Pressable style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={onBack}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600' }}>✕</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: width - 24,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userBadge: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  userName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  modeBadge: {
    backgroundColor: 'rgba(99,102,241,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  timeBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  productThumb: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  productThumbIcon: {
    fontSize: 22,
  },
  questionText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  statBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  count: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 0,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  glassBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 0,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  destructBtn: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.6)',
    paddingVertical: 0,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  destructBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  closeBtn: {
    position: 'absolute',
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }
});

export default PodLive;