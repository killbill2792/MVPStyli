import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getPod, 
  getPodVotes, 
  submitVote, 
  addComment, 
  subscribeToPodVotes, 
  calculateConfidence,
  getVoteCounts
} from '../lib/pods';
import { Colors, Spacing } from '../lib/designSystem';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';

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

const { width, height } = Dimensions.get('window');
const BOTTOM_BAR_HEIGHT = 70;

const PodGuest = ({ podId, onBack, onRecap, userId }) => {
  const { setRoute } = useApp();
  const insets = useSafeAreaInsets();
  const [pod, setPod] = useState(null);
  const [votes, setVotes] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const [showVoteSuccess, setShowVoteSuccess] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inviterInfo, setInviterInfo] = useState(null); // { name, avatar, id }
  const [podImages, setPodImages] = useState([]); // Array of image URLs
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Image height calculation - same as Explore
  const imageHeight = height - insets.top - insets.bottom - BOTTOM_BAR_HEIGHT - 20;

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  useEffect(() => {
    if (podId && podId !== 'undefined' && podId.length >= 30) {
      loadPod();
      loadVotes();
    }
  }, [podId]);

  useEffect(() => {
    if (pod) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const endTime = new Date(pod.ends_at).getTime();
        const remaining = Math.max(0, endTime - now);
        setTimeLeft(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pod]);

  useEffect(() => {
    if (pod && podId && podId !== 'undefined' && podId.length >= 30) {
      const unsubscribe = subscribeToPodVotes(podId, (newVotes) => {
        setVotes(newVotes);
        checkIfUserVoted(newVotes);
      });
      return unsubscribe;
    }
  }, [podId, userId, pod]);

  const loadPod = async () => {
    if (!podId || podId === 'undefined' || podId.length < 30) {
      console.error('Cannot load pod - invalid podId:', podId);
      return;
    }
    const podData = await getPod(podId);
    setPod(podData);
    
    // Parse image_url - could be single URL or JSON array
    if (podData?.image_url && typeof podData.image_url === 'string') {
      try {
        const parsed = JSON.parse(podData.image_url);
        if (Array.isArray(parsed)) {
          const validImages = parsed.filter(img => img && typeof img === 'string' && img.length > 0);
          setPodImages(validImages.length > 0 ? validImages : [podData.image_url]);
        } else {
          setPodImages([podData.image_url]);
        }
      } catch {
        // Not JSON, treat as single URL
        setPodImages([podData.image_url]);
      }
    } else {
      // Set placeholder if no image
      setPodImages(['https://via.placeholder.com/400x600?text=No+Image']);
    }
    
    // If this is an invited pod, get the inviter info
    if (userId && podData) {
      try {
        const { data: invite } = await supabase
          .from('pod_invites')
          .select('from_user')
          .eq('pod_id', podId)
          .eq('to_user', userId)
          .single();
        
        if (invite?.from_user) {
          // Get inviter profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, email')
            .eq('id', invite.from_user)
            .single();
          
          if (profile) {
            setInviterInfo({
              id: profile.id,
              name: profile.name || profile.email?.split('@')[0] || 'Friend',
              avatar: profile.avatar_url,
            });
          }
        }
      } catch (error) {
        console.log('Error loading inviter info:', error);
      }
    }
  };

  const loadVotes = async () => {
    if (!podId || podId === 'undefined' || podId.length < 30) return;
    const votesData = await getPodVotes(podId);
    setVotes(votesData);
    checkIfUserVoted(votesData);
  };

  const checkIfUserVoted = (votesData) => {
    if (userId) {
      const vote = votesData.find(v => v.voter_id === userId);
      if (vote) {
        setHasVoted(true);
        setUserVote(vote.vote);
      }
    }
  };

  const handleVote = async (choice) => {
    if (hasVoted) return;
    
    setHasVoted(true);
    setUserVote(choice);
    setShowVoteSuccess(true);
    setTimeout(() => setShowVoteSuccess(false), 2000);

    // For multi-image voting, choice is '1', '2', '3', etc. - map to 'yes'
    const voteChoice = ['1', '2', '3'].includes(choice) ? 'yes' : choice;
    await submitVote(podId, voteChoice, userId);
    loadVotes();
  };

  const handleSubmitComment = async () => {
    // FIX: Don't allow comments on ended pods
    if (isEnded) {
      console.log('Pod has ended - commenting disabled');
      return;
    }
    
    if (!newComment.trim() || commentSubmitted) return;
    
    const success = await addComment(podId, userId, newComment.trim());
    if (success) {
      setCommentSubmitted(true);
      setNewComment('');
      Keyboard.dismiss();
    }
  };

  const formatTime = (ms) => {
    if (ms <= 0) return 'Ended';
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m left`;
  };

  const isEnded = timeLeft <= 0 || pod?.status === 'expired';

  if (!pod) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const getModeLabel = (mode) => {
    if (mode === 'friends') return '👥 Friends';
    if (mode === 'style_twins') return '🧬 Twins';
    if (mode === 'global_mix') return '🌍 Global';
    return mode;
  };

  // Get owner info - use inviter if available (for invited pods), otherwise use owner
  const displayName = inviterInfo?.name || pod.owner_profile?.name || pod.owner_name || 'Someone';
  const displayAvatar = inviterInfo?.avatar || pod.owner_profile?.avatar_url || pod.owner_avatar;
  const displayUserId = inviterInfo?.id || pod.owner_id;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.feedItem, { paddingTop: insets.top + 10 }]}>
        {/* Image Container - Explore Style */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {podImages.length > 1 ? (
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(newIndex);
              }}
            >
              {podImages.filter(img => img && typeof img === 'string').map((img, idx) => (
                <View key={idx} style={{ width: width - 20, height: '100%' }}>
                  <SafeImage source={{ uri: img }} style={styles.image} resizeMode="cover" />
                  {/* Image Label */}
                  <View style={styles.imageLabel}>
                    <Text style={styles.imageLabelText}>{idx + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            (podImages[0] || pod.image_url) ? (
              <SafeImage source={{ uri: podImages[0] || pod.image_url }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#888', fontSize: 16 }}>No image</Text>
              </View>
            )
          )}
          
          {/* Dots Indicator for multiple images */}
          {podImages.length > 1 && (
            <View style={styles.dotsIndicator}>
              {podImages.map((_, idx) => (
                <View 
                  key={idx} 
                  style={[
                    styles.dot,
                    currentImageIndex === idx && styles.dotActive
                  ]} 
                />
              ))}
            </View>
          )}
          
          {/* Top Gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.topGradient}
          >
            {/* User Info Row - Adjusted to avoid X button */}
            <View style={[styles.userRow, { marginLeft: 50 }]}>
              {displayAvatar ? (
                <SafeImage source={{ uri: displayAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() || 'S'}</Text>
                </View>
              )}
              <Pressable 
                style={styles.userInfo}
                onPress={() => {
                  if (displayUserId && setRoute) {
                    setRoute('userprofile', { userId: displayUserId });
                  }
                }}
              >
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.podMode}>{getModeLabel(pod.audience)}</Text>
              </Pressable>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>{isEnded ? '🔴 Ended' : `⏱ ${formatTime(timeLeft)}`}</Text>
              </View>
            </View>

            {/* Question/Title */}
            <Text style={styles.podQuestion}>{pod.title}</Text>
          </LinearGradient>

          {/* Bottom Gradient with Voting */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.bottomGradient}
          >
            {/* Voting Buttons - Multi-image (1,2,3) or Single-image (Fire, Maybe, X) */}
            {!isEnded && (
              <View style={styles.voteContainer}>
                {hasVoted ? (
                  <View style={styles.votedFeedback}>
                    {podImages.length > 1 ? (
                      <Text style={styles.votedEmoji}>{userVote}</Text>
                    ) : (
                    <Text style={styles.votedEmoji}>
                      {userVote === 'yes' ? '🔥' : userVote === 'maybe' ? '🤔' : '❌'}
                    </Text>
                    )}
                    {showVoteSuccess && (
                      <Text style={styles.votedText}>Vote submitted!</Text>
                    )}
                  </View>
                ) : podImages.length > 1 ? (
                  // Multi-image voting: 1, 2, 3...
                  <View style={styles.voteRow}>
                    {podImages.slice(0, 3).map((_, idx) => {
                      const voteNum = (idx + 1).toString();
                      const isSelected = userVote === voteNum;
                      return (
                        <Pressable 
                          key={voteNum}
                          style={[styles.voteBtn, styles.multiVoteBtn, isSelected && styles.voteBtnSelected]} 
                          onPress={() => handleVote(voteNum)}
                        >
                          <Text style={styles.multiVoteText}>{voteNum}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  // Single-image voting: Fire, Maybe, X
                  <View style={styles.voteRow}>
                    <Pressable style={styles.voteBtn} onPress={() => handleVote('yes')}>
                      <Text style={styles.voteEmoji}>🔥</Text>
                    </Pressable>
                    <Pressable style={styles.voteBtn} onPress={() => handleVote('maybe')}>
                      <Text style={styles.voteEmoji}>🤔</Text>
                    </Pressable>
                    <Pressable style={styles.voteBtn} onPress={() => handleVote('no')}>
                      <Text style={styles.voteEmoji}>❌</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Comment Input - for friends and global (even after voting) */}
            {!isEnded && pod.audience !== 'style_twins' && (
              <View style={styles.commentContainer}>
                {commentSubmitted ? (
                  <Text style={styles.commentSubmittedText}>✓ Comment sent</Text>
                ) : (
                  <View style={styles.commentInputRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment..."
                      placeholderTextColor="#9ca3af"
                      value={newComment}
                      onChangeText={setNewComment}
                      returnKeyType="send"
                      onSubmitEditing={handleSubmitComment}
                    />
                    {newComment.trim() && (
                      <Pressable style={styles.sendBtn} onPress={handleSubmitComment}>
                        <Text style={styles.sendBtnText}>Send</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Ended State */}
            {isEnded && (
              <View style={styles.endedContainer}>
                <Text style={styles.endedText}>This pod has ended</Text>
                <Text style={styles.endedSubtext}>Thanks for checking in! 🙌</Text>
                {/* Only show View Recap to the pod owner */}
                {pod.owner_id === userId && (
                  <Pressable style={styles.recapButton} onPress={() => onRecap(podId)}>
                    <Text style={styles.recapButtonText}>View Recap</Text>
                  </Pressable>
                )}
              </View>
            )}
          </LinearGradient>

          {/* Product Thumbnail if available */}
          {(pod.product_image || pod.product_url) && (
            <Pressable 
              style={[styles.productThumb, { top: 70, right: 16 }]} // Position below header
              onPress={() => {
                if (pod.product_url) {
                   Linking.openURL(pod.product_url);
                } else {
                   Alert.alert('Original Product', 'This is the outfit used for the try-on.');
                }
              }}
            >
              <SafeImage 
                source={{ uri: pod.product_image || 'https://via.placeholder.com/50' }} 
                style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                resizeMode="cover"
              />
              <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: '#000', borderRadius: 6, paddingHorizontal: 4 }}>
                <Text style={{ color: '#fff', fontSize: 8 }}>Original</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {/* Back Button - Positioned to avoid overlap */}
      <Pressable style={[styles.backButton, { top: insets.top + 10, left: 20 }]} onPress={onBack}>
        <Text style={styles.backButtonText}>✕</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 100,
  },
  feedItem: {
    flex: 1,
    paddingHorizontal: 10,
  },
  imageContainer: {
    width: width - 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  userName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  podMode: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  timerBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  podQuestion: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 8,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
  },
  voteContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  voteBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteEmoji: {
    fontSize: 28,
  },
  votedFeedback: {
    alignItems: 'center',
  },
  votedEmoji: {
    fontSize: 48,
  },
  votedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  commentContainer: {
    marginTop: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  commentSubmittedText: {
    color: '#10b981',
    fontSize: 14,
    textAlign: 'center',
  },
  endedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  endedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  endedSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 16,
  },
  recapButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  recapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productThumb: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  productThumbText: {
    fontSize: 20,
  },
  backButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  imageLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLabelText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dotsIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  multiVoteBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  voteBtnSelected: {
    backgroundColor: 'transparent',
    borderColor: '#fff',
  },
  multiVoteText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default PodGuest;
