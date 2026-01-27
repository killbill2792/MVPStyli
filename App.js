import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, StatusBar, TextInput, ScrollView, Modal, ActivityIndicator, Dimensions, FlatList, Animated, PanResponder, KeyboardAvoidingView, Platform, InteractionManager, Linking, Image, RefreshControl } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from './lib/SimpleGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './lib/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync, uploadRemoteImage } from './lib/upload';
import { fetchGarmentsAsProducts } from './lib/garmentUtils';
import BottomBar from './components/BottomBar';
import PodsScreen from './screens/PodsScreen';
import StyleCraftScreen from './screens/StyleCraftScreen';
import StyleVaultScreen from './screens/StyleVaultScreen';
import PodLive from './screens/PodLive';
import PodGuest from './screens/PodGuest';
import PodRecap from './screens/PodRecap';
import PodsHome from './screens/PodsHome';
import Inbox from './screens/Inbox';
import ChatScreen from './screens/ChatScreen';
import ProductScreen from './screens/ProductScreen';
import TryOnResultScreen from './screens/TryOnResultScreen';
import AuthScreen from './screens/AuthScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import AdminGarmentsScreen from './screens/AdminGarmentsScreen';
import PhotoGuidelinesModal from './components/PhotoGuidelinesModal';
import { startTryOn, pollTryOn } from './lib/tryon';
import { setupStylitFriends } from './lib/setupFriends';
import { runMigrations } from './lib/migrations';
import { supabase } from './lib/supabase';
import { trackEvent, refreshStyleProfile } from './lib/styleEngine';
import { buildShareUrl, parseDeepLink } from './lib/share';
import { sendFriendRequest, areFriends } from './lib/friends';
import { createPodInvites } from './lib/pods';
import { submitVote as submitVoteToDB } from './lib/pods';
import { SafeImage, OptimizedImage } from './lib/OptimizedImage';
import { Avatar } from './components/Avatar';
import { checkNewArchitecture, verifyFabricComponents } from './lib/newArchCheck';
import { logger } from './lib/logger';

const { width, height } = Dimensions.get('window');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// iOS-style Swipeable Banner Component
const BannerNotification = ({ message, type, onDismiss, onPress, isTryOn = false }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismissBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 3;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30 || gestureState.vy < -0.5) {
          dismissBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const backgroundColor = 
    type === 'success' ? '#22c55e' :
    type === 'error' ? '#ef4444' :
    '#3b82f6';

  // Only show sparkle for Try On notifications
  const showSparkle = isTryOn && type === 'success';

  return (
    <Animated.View
      style={[
        styles.bannerNotification,
        { 
          backgroundColor, 
          transform: [{ translateY }],
          opacity,
        }
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={onPress} style={styles.bannerPressable}>
        <View style={styles.bannerContent}>
          {type === 'processing' && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 12 }} />}
          {showSparkle && <Text style={styles.bannerIcon}>✨</Text>}
          {type === 'error' && <Text style={styles.bannerIcon}>⚠️</Text>}
          <Text style={styles.bannerText}>{message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Helper function to get vote breakdown for single image pods
const getVoteBreakdown = (voteCounts) => {
  if (!voteCounts || voteCounts.total === 0) return { winner: null, percentage: 0, isTie: false, allVotes: null };
  
  const yesPercent = Math.round((voteCounts.yes / voteCounts.total) * 100);
  const maybePercent = Math.round((voteCounts.maybe / voteCounts.total) * 100);
  const noPercent = Math.round((voteCounts.no / voteCounts.total) * 100);
  const maxPercent = Math.max(yesPercent, maybePercent, noPercent);
  
  const allVotes = {
    fire: { emoji: '🔥', percent: yesPercent },
    maybe: { emoji: '🤔', percent: maybePercent },
    no: { emoji: '❌', percent: noPercent }
  };
  
  // Check for ties
  const winners = [];
  if (yesPercent === maxPercent && yesPercent > 0) winners.push({ type: 'fire', emoji: '🔥', percent: yesPercent });
  if (maybePercent === maxPercent && maybePercent > 0) winners.push({ type: 'maybe', emoji: '🤔', percent: maybePercent });
  if (noPercent === maxPercent && noPercent > 0) winners.push({ type: 'no', emoji: '❌', percent: noPercent });
  
  if (winners.length > 1) {
    return { winners, percentage: maxPercent, isTie: true, allVotes };
  } else if (winners.length === 1) {
    return { winner: winners[0], percentage: maxPercent, isTie: false, allVotes };
  }
  return { winner: null, percentage: 0, isTie: false, allVotes };
};

// Helper function to get percentage label for ended pods (single image) - based on winner type
const getPercentageLabelWithWinner = (breakdown) => {
  if (!breakdown || !breakdown.winner) {
    if (breakdown && breakdown.isTie) {
      return { text: '⚖️ Opinion Split', color: '#000', bg: 'rgba(251, 191, 36, 0.9)', border: 'rgba(251, 191, 36, 1)' };
    }
    return { text: '🚥 No Signal', color: '#fff', bg: 'rgba(107, 114, 128, 0.6)', border: 'rgba(107, 114, 128, 0.8)' };
  }
  
  const { winner, percentage } = breakdown;
  
  // Fire (yes) votes won
  if (winner.type === 'fire') {
    if (percentage >= 90) return { text: '🔥 Everyone\'s Favorite', color: '#fff', bg: 'rgba(249, 115, 22, 0.6)', border: 'rgba(249, 115, 22, 0.8)' };
    if (percentage >= 70) return { text: '❤️‍🔥 Most Were Into It', color: '#fff', bg: 'rgba(236, 72, 153, 0.6)', border: 'rgba(236, 72, 153, 0.8)' };
    if (percentage >= 40) return { text: '♥️ Leaning Yes', color: '#fff', bg: 'rgba(249, 115, 22, 0.5)', border: 'rgba(249, 115, 22, 0.7)' };
    return { text: '❣️ Some Liked It', color: '#fff', bg: 'rgba(249, 115, 22, 0.4)', border: 'rgba(249, 115, 22, 0.6)' };
  }
  
  // Maybe votes won
  if (winner.type === 'maybe') {
    return { text: '🤔 Mixed Feelings', color: '#fff', bg: 'rgba(251, 191, 36, 0.6)', border: 'rgba(251, 191, 36, 0.8)' };
  }
  
  // No (X) votes won
  if (winner.type === 'no') {
    if (percentage >= 70) return { text: '😬 Didn\'t Vibe', color: '#fff', bg: 'rgba(239, 68, 68, 0.6)', border: 'rgba(239, 68, 68, 0.8)' };
    return { text: '❌ Not Their Favorite', color: '#fff', bg: 'rgba(239, 68, 68, 0.5)', border: 'rgba(239, 68, 68, 0.7)' };
  }
  
  return { text: '🚥 No Signal', color: '#fff', bg: 'rgba(107, 114, 128, 0.6)', border: 'rgba(107, 114, 128, 0.8)' };
};

// Helper function for multi-image pods (backwards compatibility)
const getPercentageLabel = (percentage) => {
  if (percentage >= 90) return { text: '🔥 Clear Winner', color: '#fff', bg: 'rgba(249, 115, 22, 0.6)', border: 'rgba(249, 115, 22, 0.8)' };
  if (percentage >= 70) return { text: '👍 Strong Pick', color: '#fff', bg: 'rgba(236, 72, 153, 0.6)', border: 'rgba(236, 72, 153, 0.8)' };
  if (percentage >= 40) return { text: '⚖️ Close Call', color: '#fff', bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 0.8)' };
  if (percentage >= 1) return { text: '📊 Split Votes', color: '#fff', bg: 'rgba(107, 114, 128, 0.6)', border: 'rgba(107, 114, 128, 0.8)' };
  return { text: '🚥 No Signal', color: '#fff', bg: 'rgba(107, 114, 128, 0.6)', border: 'rgba(107, 114, 128, 0.8)' };
};

// Helper function to get highest vote percentage for single image pods
const getHighestVotePercentage = (voteCounts) => {
  if (!voteCounts || voteCounts.total === 0) return 0;
  const yesPercent = Math.round((voteCounts.yes / voteCounts.total) * 100);
  const maybePercent = Math.round((voteCounts.maybe / voteCounts.total) * 100);
  const noPercent = Math.round((voteCounts.no / voteCounts.total) * 100);
  return Math.max(yesPercent, maybePercent, noPercent);
};

// Explore Component
function Explore() {
  const { setRoute, state } = useApp();
  const { user } = state;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('global'); // 'friends', 'twins', 'global'
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // FIX: Track voted pods at parent level to persist across FlatList virtualization
  // This prevents flickering when items remount
  const localVoteStateRef = useRef(new Map()); // Map<podId, { voted: string, hasVoted: bool, hasCommented: bool }>
  
  // FlatList ref for auto-scroll after voting
  const flatListRef = useRef(null);
  
  // Auto-scroll to next card after voting
  const scrollToNextCard = (currentIndex) => {
    if (flatListRef.current && currentIndex < pods.length - 1) {
      // Small delay for vote animation to complete
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
      }, 800);
    }
  };

  // Fetch pods based on active tab
  useEffect(() => {
    loadPods(false);
  }, [activeTab, user?.id]);
  
  // Pull-to-refresh handler
  const onRefresh = async () => {
    await loadPods(true);
  };

  const loadPods = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      let fetchedPods = [];
      const userId = user?.id;
      
      // Get all pods (including voted ones) - we'll sort them by new logic
      if (activeTab === 'friends') {
        const { getFriendsTabPods } = await import('./lib/pods');
        fetchedPods = await getFriendsTabPods(userId);
      } else if (activeTab === 'twins') {
        const { getTwinsTabPods } = await import('./lib/pods');
        fetchedPods = await getTwinsTabPods(userId);
      } else {
        const { getGlobalTabPods } = await import('./lib/pods');
        fetchedPods = await getGlobalTabPods(userId);
      }
      
      // Transform pods to feed items format
      // Filter out ended pods older than 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const feedItems = fetchedPods
        .filter(pod => {
          // Filter out pods without images
          if (!pod.image_url) return false;
          
          // Filter out ended pods older than 7 days
          const endsAt = new Date(pod.ends_at);
          const isEnded = pod.status === 'expired' || endsAt < now;
          if (isEnded && endsAt < sevenDaysAgo) return false;
          
          return true;
        })
        .map(pod => {
        // Parse image_url - could be single URL or JSON array
        let images = [];
        if (pod.image_url && typeof pod.image_url === 'string') {
          try {
            // First check if it's a JSON array string
            if (pod.image_url.trim().startsWith('[')) {
                const parsed = JSON.parse(pod.image_url);
                if (Array.isArray(parsed)) {
                images = parsed.filter(img => img && typeof img === 'string' && img.length > 0);
                } else {
                images = [pod.image_url];
                }
            } else {
                // Not JSON, just a URL string
                images = [pod.image_url];
            }
          } catch {
            // Not JSON, treat as single URL
            images = [pod.image_url];
          }
        }
        // Ensure we have at least a placeholder if no valid images
        if (images.length === 0) {
          // Skip this pod if no images
          return null;
        }
        
        return {
          id: pod.id,
          podId: pod.id,
          type: pod.audience === 'friends' ? 'friends' : pod.audience === 'style_twins' ? 'twins' : 'global',
          user: pod.owner_name || 'Someone',
          userAvatar: pod.owner_avatar,
          userId: pod.owner_id,
          images: images,
          question: pod.title || "What do you think?",
          timeLeft: getTimeLeft(pod.ends_at),
          isLive: Boolean(pod.status === 'live' && new Date(pod.ends_at) > new Date()),
          ownerId: pod.owner_id,
          isOwner: pod.owner_id === userId,
          productUrl: pod.product_url,
        };
      })
      .filter(item => item !== null); // Remove null items
      
      // Check vote/comment status for each pod
      const podsWithStatus = await Promise.all(
        feedItems.map(async (item) => {
          let hasVoted = false;
          let hasCommented = false;
          
          if (userId && item.podId) {
            const { hasUserVoted, hasUserCommentedOnPod } = await import('./lib/pods');
            hasVoted = await hasUserVoted(item.podId, userId);
            hasCommented = await hasUserCommentedOnPod(item.podId, userId);
          }
          
          return {
            ...item,
            hasVoted,
            hasCommented,
          };
        })
      );
      
      // Helper function to determine pod tier for sorting
      // User's requested order:
      // 1. Live Pods - Where I have neither voted or commented
      // 2. Live pods - Where one of votes or comments is missing
      // 3. Ended Pods - Pods I didn't vote and comment
      // 4. Ended pods - Pods I missed one of vote or comment
      // 5. Ended Pods - Pods I have voted and commented
      // 6. Live Pods - Where I both voted and commented
      const getPodTier = (item, tab) => {
        const hasVoted = item.hasVoted || false;
        const hasCommented = item.hasCommented || false;
        const isLive = item.isLive;
        
        if (isLive) {
          // Live pods
          if (!hasVoted && !hasCommented) return 1; // Tier 1: Neither voted nor commented
          if (!hasVoted || !hasCommented) return 2; // Tier 2: Missing one (vote or comment)
          return 6; // Tier 6: Both voted and commented
        } else {
          // Ended pods
          if (!hasVoted && !hasCommented) return 3; // Tier 3: Didn't vote and comment
          if (!hasVoted || !hasCommented) return 4; // Tier 4: Missed one (vote or comment)
          return 5; // Tier 5: Voted and commented
        }
      };
      
      // NEW SORTING LOGIC matching user requirements
      const sortedPods = podsWithStatus.sort((a, b) => {
        const aPod = fetchedPods.find(p => p.id === a.podId);
        const bPod = fetchedPods.find(p => p.id === b.podId);
        
        // Get tiers for both pods
        const aTier = getPodTier(a, activeTab);
        const bTier = getPodTier(b, activeTab);
        
        // Sort by tier first (lower tier = higher priority)
        if (aTier !== bTier) {
          return aTier - bTier;
        }
        
        // Same tier - sort by created_at (most recent first)
        if (aPod?.created_at && bPod?.created_at) {
          return new Date(bPod.created_at).getTime() - new Date(aPod.created_at).getTime();
        }
        
        return 0;
      });
      
      setPods(sortedPods);
    } catch (error) {
      logger.error('Error loading pods:', error);
      setPods([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getTimeLeft = (endsAt) => {
    if (!endsAt) return 'No limit';
    const now = new Date().getTime();
    const endTime = new Date(endsAt).getTime();
    const remaining = Math.max(0, endTime - now);
    
    if (remaining <= 0) return 'Ended';
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const handleVoteComplete = (podId) => {
    try {
      // Remove pod from list after voting
      // Ensure podId is a string to avoid React Native bridge type errors
      if (!podId) return;
      const podIdStr = String(podId);
      
      // FIX: Track voted pods but don't remove them from feed
      setVotedPodIds(prev => {
        try {
          const newSet = new Set(prev);
          newSet.add(podIdStr);
          return newSet;
        } catch (e) {
          logger.warn('Error updating votedPodIds:', e);
          return prev;
        }
      });
      
      // FIX: Don't remove pods from feed - keep them visible even after voting
    } catch (error) {
      logger.error('Error in handleVoteComplete:', error);
    }
  };

  // FIX: Don't update pods array after voting - this causes flickering
  // Local component state (hasVoted, voted) already handles the UI
  // The pods array will be re-sorted on next manual refresh (pull to refresh)
  const handleInteractionComplete = (podId, newHasVoted, newHasCommented) => {
    // No-op: don't update pods array to prevent flickering
    // Local FeedItem state handles the voted status
    // Sorting happens on next loadPods() call (pull to refresh)
  };

  // FIX: Show all pods (including voted ones) - sorted by live/ended
  const filteredFeed = pods;

  const FeedItem = ({ item, index, onVoteComplete, onInteractionComplete, showComments = false, onRefresh, loadPods, localVoteStateRef, scrollToNextCard }) => {
    const { state } = useApp();
    const { user } = state;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [commentText, setCommentText] = useState('');
    const [commentSubmitted, setCommentSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [voteCounts, setVoteCounts] = useState(null); // For ended pods
    const [isTagExpanded, setIsTagExpanded] = useState(false); // Local state for tag expansion
    
    // FIX: Get persisted vote state from parent ref (survives FlatList virtualization)
    const podId = item.podId || item.id;
    const persistedState = localVoteStateRef?.current?.get(podId);
    
    // Initialize from persisted state first, then item data, then defaults
    const [hasVoted, setHasVoted] = useState(persistedState?.hasVoted ?? item.hasVoted ?? false);
    const [hasCommented, setHasCommented] = useState(persistedState?.hasCommented ?? item.hasCommented ?? false);
    const [voted, setVoted] = useState(persistedState?.voted ?? null);
    const [userVoteChoice, setUserVoteChoice] = useState(persistedState?.choice ?? null);
    
    const initialCheckDoneRef = useRef(false);
    
    // Only fetch vote details once on mount if user has already voted (to get the vote type)
    useEffect(() => {
      if (initialCheckDoneRef.current) return;
      initialCheckDoneRef.current = true;
      
      // Skip if we already have persisted vote state
      if (persistedState?.voted) return;
      
      // If we already know user voted (from item data), fetch the vote type
      const loadVoteDetails = async () => {
        if (!user?.id || !podId) return;
        
        // Only fetch if hasVoted is true but we don't know the vote type yet
        if ((item.hasVoted || hasVoted) && !voted) {
          try {
            const { getPodVotes } = await import('./lib/pods');
            const votes = await getPodVotes(podId);
            const userVote = votes.find(v => v.voter_id === user.id);
            
            if (userVote && !voted) {
              // Map choice back to UI type
              let voteType = null;
              if (userVote.choice === 'yes') {
                if (userVote.metadata?.selectedOption) {
                  voteType = userVote.metadata.selectedOption;
                } else {
                  voteType = 'fire';
                }
              } else if (userVote.choice === 'maybe') {
                voteType = 'maybe';
              } else if (userVote.choice === 'no') {
                voteType = 'x';
              }
              
              if (voteType) {
                setVoted(voteType);
                setUserVoteChoice(userVote.choice);
                // Persist to parent ref
                if (localVoteStateRef?.current) {
                  localVoteStateRef.current.set(podId, { voted: voteType, hasVoted: true, hasCommented, choice: userVote.choice });
                }
              }
            }
          } catch (error) {
            logger.error('Error loading vote details:', error);
          }
        }
      };
      
      loadVoteDetails();
    }, []); // Empty deps - only run once on mount
    
    const scaleAnims = {
        fire: useRef(new Animated.Value(1)).current,
        maybe: useRef(new Animated.Value(1)).current,
        x: useRef(new Animated.Value(1)).current,
        '1': useRef(new Animated.Value(1)).current,
        '2': useRef(new Animated.Value(1)).current,
        '3': useRef(new Animated.Value(1)).current,
    };

    const handleVote = async (type) => {
      // FIX: Disable voting on ended pods (read-only recaps)
      if (!item.isLive) {
        logger.log('Pod has ended - voting disabled');
        return;
      }
      // FIX: Prevent double voting using local state
      if (voted || hasVoted || isSubmitting) return;
      
      // Update local state immediately
      const voteType = String(type);
      setIsSubmitting(true);
      setVoted(voteType);
      setHasVoted(true);
      
      // FIX: Persist to parent ref to survive FlatList virtualization
      if (localVoteStateRef?.current) {
        localVoteStateRef.current.set(podId, { voted: voteType, hasVoted: true, hasCommented, choice: null });
      }
      
      // Safely animate if the animation ref exists
      try {
        const animRef = scaleAnims[type];
        if (animRef && typeof animRef === 'object' && 'setValue' in animRef) {
          Animated.sequence([
              Animated.timing(animRef, { toValue: 1.5, duration: 150, useNativeDriver: true }),
              Animated.timing(animRef, { toValue: 1, duration: 150, useNativeDriver: true })
          ]).start();
        }
      } catch (animError) {
        logger.warn('Animation error (non-critical):', animError);
      }

      // Map vote type to database choice
      let choice = 'maybe';
      let metadata = null;
      
      if (type === 'fire') {
        choice = 'yes';
      } else if (type === 'x') {
        choice = 'no';
      } else if (type === 'maybe') {
        choice = 'maybe';
      } else if (['1', '2', '3'].includes(String(type))) {
        // FIX: Store which option was selected for multi-image pods
        choice = 'yes';
        const selectedIndex = parseInt(String(type), 10) - 1;
        metadata = {
          selectedOption: String(type),
          selectedIndex: selectedIndex
        };
      }

      try {
        // Submit vote to Supabase - use direct import to avoid React Native bridge issues
        const podId = String(item.podId || item.id || '');
        const userId = user?.id ? String(user.id) : undefined;
        
        // Ensure all parameters are properly typed before passing
        if (!podId || podId === '') {
          logger.error('Invalid podId:', podId);
          setIsSubmitting(false);
          return;
        }
        
        // Call submitVote with proper parameters
        if (metadata && typeof metadata === 'object' && metadata.selectedOption) {
          await submitVoteToDB(podId, choice, userId, metadata);
        } else {
          await submitVoteToDB(podId, choice, userId);
        }
        
        // FIX: Mark as done submitting
        setIsSubmitting(false);
        
        // FIX: Don't refresh the entire feed after voting - just update local state
        // hasVoted was already set at the start of handleVote
        
        // Auto-scroll to next card (only if not in friends tab where comment is required)
        if (!showComments && scrollToNextCard && typeof index === 'number') {
          scrollToNextCard(index);
        }
      } catch (error) {
        logger.error('Error submitting vote:', error);
        setIsSubmitting(false);
      }
    };

    const handleSubmitComment = async () => {
      // FIX: Don't allow comments on ended pods
      if (!item.isLive) {
        logger.log('Pod has ended - commenting disabled');
        return;
      }
      
      if (!commentText.trim() || commentSubmitted || hasCommented) return;
      
      try {
        const { addComment } = await import('./lib/pods');
        const success = await addComment(podId, user?.id, commentText.trim());
        if (success) {
          // Set hasCommented immediately
          setHasCommented(true);
          setCommentText('');
          // Show "Comment sent" message for 1 second
          setCommentSubmitted(true);
          setTimeout(() => setCommentSubmitted(false), 1000);
          
          // FIX: Persist to parent ref to survive FlatList virtualization
          if (localVoteStateRef?.current) {
            const current = localVoteStateRef.current.get(podId) || {};
            localVoteStateRef.current.set(podId, { ...current, hasCommented: true });
          }
          
          // Auto-scroll to next card after comment is submitted (for friends tab)
          if (scrollToNextCard && typeof index === 'number') {
            scrollToNextCard(index);
          }
        }
      } catch (error) {
        logger.error('Error submitting comment:', error);
      }
    };

    // FIX: Fetch vote counts for ended pods
    useEffect(() => {
      if (!item.isLive && (item.podId || item.id)) {
        const loadVoteCounts = async () => {
          try {
            const { getPodVotes, getVoteCounts } = await import('./lib/pods');
            const votes = await getPodVotes(item.podId || item.id);
            const counts = getVoteCounts(votes);
            setVoteCounts(counts);
          } catch (error) {
            logger.error('Error loading vote counts:', error);
          }
        };
        loadVoteCounts();
      } else {
        // Reset for live pods
        setVoteCounts(null);
      }
    }, [item.isLive, item.podId, item.id]);

    // Calculate height based on available space above bottom bar
    const BOTTOM_BAR_HEIGHT = 80; // Bottom bar height
    const TAB_HEADER_HEIGHT = 50; // Top tabs height
    const availableHeight = height - insets.top - insets.bottom - BOTTOM_BAR_HEIGHT - TAB_HEADER_HEIGHT;

    // For ended multi-image pods: find winning image (but DON'T reorder)
    const displayImages = item.images; // Keep original order
    let winningImageIndex = null;
    let winningPercentage = 0;
    let isTie = false;
    let tiedImages = [];
    
    if (!item.isLive && voteCounts && item.images.length > 1) {
      const allPercentages = item.images.map((_, idx) => {
        const type = (idx + 1).toString();
        const optionVotes = voteCounts.multiImageCounts?.[type] || 0;
        return { idx, type, percentage: voteCounts.total > 0 ? Math.round((optionVotes / voteCounts.total) * 100) : 0 };
      });
      const maxPercentage = Math.max(...allPercentages.map(p => p.percentage));
      const winners = allPercentages.filter(p => p.percentage === maxPercentage && p.percentage > 0);
      
      if (winners.length > 1) {
        isTie = true;
        tiedImages = winners;
      } else if (winners.length === 1) {
        winningImageIndex = winners[0].idx;
        winningPercentage = winners[0].percentage;
      }
    }

    // Handle tag expansion toggle (local state - no refresh)
    const handleTagPress = () => {
      if (isTagExpanded) {
        setIsTagExpanded(false);
      } else {
        setIsTagExpanded(true);
        // Auto-revert after 2 seconds
        setTimeout(() => {
          setIsTagExpanded(false);
        }, 2000);
      }
    };

    // Get vote breakdown for single image pods
    const singleImageBreakdown = !item.isLive && voteCounts && item.images.length === 1 ? getVoteBreakdown(voteCounts) : null;

    return (
      <View style={{ height: availableHeight, marginBottom: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
        {/* Top-left tag for ended pods */}
        {!item.isLive && voteCounts && (
          (() => {
            let tagLabel = '';
            let expandedLabel = '';
            let tagBg = '';
            let tagBorder = '';
            let canTap = false;
            
            if (item.images.length > 1) {
              // Multi-image pod
              if (isTie) {
                // Show tied images: "⚖️ 1 & 3 Tie"
                const tiedNumbers = tiedImages.map(t => t.idx + 1).join(' & ');
                tagLabel = `⚖️ ${tiedNumbers} Tie`;
                expandedLabel = tiedImages.map(t => `${t.idx + 1}: ${t.percentage}%`).join(' | ');
                tagBg = 'rgba(245, 158, 11, 0.6)';
                tagBorder = 'rgba(245, 158, 11, 0.8)';
                canTap = true;
              } else if (winningImageIndex !== null && winningPercentage > 0) {
                const label = getPercentageLabel(winningPercentage);
                tagLabel = `${winningImageIndex + 1}/${item.images.length} received most votes`;
                expandedLabel = `${winningImageIndex + 1}/${item.images.length} got ${winningPercentage}%`;
                tagBg = label.bg;
                tagBorder = label.border;
                canTap = true;
              } else {
                tagLabel = '🚥 No Signal';
                tagBg = 'rgba(107, 114, 128, 0.6)';
                tagBorder = 'rgba(107, 114, 128, 0.8)';
                canTap = false;
              }
            } else {
              // Single image pod - use winner-aware label
              if (singleImageBreakdown) {
                const label = getPercentageLabelWithWinner(singleImageBreakdown);
                tagLabel = label.text;
                tagBg = label.bg;
                tagBorder = label.border;
                
                if (singleImageBreakdown.isTie && singleImageBreakdown.winners) {
                  // Tie - show both icons with percentages
                  expandedLabel = singleImageBreakdown.winners.map(w => `${w.emoji} ${w.percent}%`).join(' | ');
                  canTap = true;
                } else if (singleImageBreakdown.winner) {
                  // Single winner - show icon with percentage
                  expandedLabel = `${singleImageBreakdown.winner.emoji} ${singleImageBreakdown.winner.percent}%`;
                  canTap = true;
                }
              } else {
                tagLabel = '🚥 No Signal';
                tagBg = 'rgba(107, 114, 128, 0.6)';
                tagBorder = 'rgba(107, 114, 128, 0.8)';
                canTap = false;
              }
            }
            
            return (
              <Pressable
                onPress={() => canTap ? handleTagPress() : null}
                disabled={!canTap}
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  zIndex: 10,
                  backgroundColor: tagBg,
                  borderWidth: 1,
                  borderColor: tagBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  maxWidth: width - 60,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {isTagExpanded && expandedLabel ? expandedLabel : tagLabel}
                </Text>
              </Pressable>
            );
          })()
        )}

        {/* Image Carousel - Keep original order */}
        <View style={{ flex: 1 }}>
          {displayImages.length > 1 ? (
            <ScrollView 
              horizontal={true}
              pagingEnabled={true}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const scrollWidth = e.nativeEvent.layoutMeasurement.width;
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / scrollWidth);
                setCurrentImageIndex(newIndex);
              }}
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {displayImages.map((img, idx) => {
                const imageSource = img && typeof img === 'string' ? { uri: img } : null;
                const imageNumber = idx + 1;
                const isWinningImage = winningImageIndex === idx;
                
                return (
                  <View key={idx} style={{ width: width - 20, height: '100%' }}>
                    <SafeImage 
                      source={imageSource} 
                      style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                      width={width - 20}
                      height={availableHeight}
                    />
                    
                    {/* Image number label in top-right for all multi-image pods */}
                    <View style={{ 
                      position: 'absolute', 
                      top: 16, 
                      right: 16, 
                      backgroundColor: isWinningImage && !item.isLive ? 'rgba(34, 197, 94, 0.8)' : 'rgba(0,0,0,0.6)', 
                      borderRadius: 12, 
                      paddingHorizontal: 10, 
                      paddingVertical: 6,
                      borderWidth: isWinningImage && !item.isLive ? 1 : 0,
                      borderColor: 'rgba(255,255,255,0.3)'
                    }}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                        {imageNumber}/{item.images.length}{isWinningImage && !item.isLive ? ' ★' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <SafeImage 
              source={item.images[0] && typeof item.images[0] === 'string' ? { uri: item.images[0] } : null} 
              style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
              width={width - 20}
              height={availableHeight}
            />
          )}
          
          {/* Dots Indicator */}
          {item.images.filter(i => i && typeof i === 'string').length > 1 && (
            <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {item.images.filter(i => i && typeof i === 'string').map((_, idx) => (
                  <View 
                    key={idx} 
                    style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: 4, 
                        backgroundColor: currentImageIndex === idx ? '#fff' : 'rgba(255,255,255,0.3)' 
                    }} 
                  />
              ))}
            </View>
          )}
        </View>

        {/* Overlays */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 60 }}
        >
          {/* For ended pods: username and title at bottom, no voting UI */}
          {!item.isLive ? (
            <View style={{ marginTop: 'auto' }}>
              <View style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                paddingHorizontal: 12, 
                paddingVertical: 8, 
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                alignSelf: 'flex-start',
                marginBottom: 12,
              }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{item.question}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  onPress={() => {
                    if (item.userId && setRoute) {
                      setRoute('userprofile', { userId: item.userId });
                    }
                  }}
                >
                  <Avatar 
                    imageUri={item.userAvatar} 
                    name={item.user} 
                    size={20}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{item.user}</Text>
                </Pressable>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>Ended</Text>
              </View>
            </View>
          ) : (
            <>
              {/* Question & Time - for live pods */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Pressable 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                    onPress={() => {
                      if (item.userId && setRoute) {
                        setRoute('userprofile', { userId: item.userId });
                      }
                    }}
                  >
                    <Avatar 
                      imageUri={item.userAvatar} 
                      name={item.user} 
                      size={20}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{item.user}</Text>
                  </Pressable>
                  <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 12 }}>{item.timeLeft}</Text>
                </View>
                <View style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                  paddingHorizontal: 12, 
                  paddingVertical: 8, 
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  alignSelf: 'flex-start',
                }}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{item.question}</Text>
                </View>
              </View>

              {/* Show user's vote after they've voted (live pod only) */}
              {hasVoted && voted ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
                  <View style={{ alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    {item.images.length > 1 ? (
                      <Text style={{ fontSize: 18, color: '#10b981', fontWeight: '600' }}>You voted: {voted}</Text>
                    ) : (
                      <Text style={{ fontSize: 18, color: '#10b981', fontWeight: '600' }}>
                        You voted: {voted === 'fire' ? '🔥' : voted === 'maybe' ? '🤔' : '❌'}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </>
          )}
          
          {/* Voting Actions - Only show for live pods when user hasn't voted */}
          {item.isLive && !hasVoted && !voted && (
            <View style={{ alignItems: 'center' }}>
              {item.images.length > 1 ? (
                // Multi-image voting - Just fire icon with look number badge
                // Clean and consistent with single-image voting
                <Pressable 
                  onPress={() => handleVote((currentImageIndex + 1).toString())}
                  disabled={Boolean(isSubmitting)}
                  style={{ 
                    alignItems: 'center',
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  <View style={{ position: 'relative' }}>
                    <Text style={{ fontSize: 50 }}>🔥</Text>
                    {/* Look number badge - gradient like fire symbol */}
                    <LinearGradient
                      colors={['#f97316', '#ea580c', '#dc2626']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -8,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: 0.7,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{currentImageIndex + 1}</Text>
                    </LinearGradient>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Tap to vote</Text>
                </Pressable>
              ) : (
                // Single image voting (Fire, Maybe, X)
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                  {['fire', 'maybe', 'x'].map((type) => {
                    const emoji = type === 'fire' ? '🔥' : type === 'maybe' ? '🤔' : '❌';
                    
                    return (
                      <Pressable 
                        key={type}
                        onPress={() => handleVote(type)}
                        disabled={Boolean(isSubmitting)}
                        style={{ 
                          alignItems: 'center',
                          opacity: isSubmitting ? 0.5 : 1
                        }}
                      >
                        <Animated.View style={{ 
                          width: 60, 
                          height: 60, 
                          borderRadius: 30, 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          transform: [{ scale: (scaleAnims[type] && typeof scaleAnims[type] === 'object') ? scaleAnims[type] : 1 }]
                        }}>
                          <Text style={{ fontSize: 40 }}>{emoji}</Text>
                        </Animated.View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          
          {/* Comments for Friends - Only show for live pods where user has voted but hasn't commented yet */}
          {activeTab === 'friends' && item.isLive && hasVoted && !hasCommented && (
             <View style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput 
                      placeholder="Reply to your friend..."
                      placeholderTextColor="#999"
                      value={commentText}
                      onChangeText={setCommentText}
                      onSubmitEditing={handleSubmitComment}
                      editable={Boolean(item.isLive && !hasCommented && !commentSubmitted)} // FIX: Disable while submitting
                      returnKeyType="send"
                      style={{ 
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.3)', 
                        padding: 12, 
                        borderRadius: 12, 
                        color: '#fff',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)'
                      }}
                    />
                    <Pressable
                      onPress={handleSubmitComment}
                      disabled={Boolean(!item.isLive || hasCommented || !commentText.trim() || commentSubmitted)} // FIX: Disable if already commented
                      style={{
                        backgroundColor: commentText.trim() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                        opacity: (!item.isLive || hasCommented || !commentText.trim() || commentSubmitted) ? 0.5 : 1
                      }}
                    >
                      <Text style={{ color: commentText.trim() ? '#fff' : '#999', fontWeight: '600', fontSize: 14 }}>Send</Text>
                    </Pressable>
                  </View>
             </View>
          )}
          
          {/* Show "Comment sent" message for 1 second after submission */}
          {activeTab === 'friends' && item.isLive && hasCommented && commentSubmitted && (
            <View style={{ marginTop: 20 }}>
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Text style={{ color: '#10b981', fontSize: 13, textAlign: 'center' }}>✓ Comment sent! (Only visible to {item.user})</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const availableHeight = height - insets.top - insets.bottom - 80 - 50; // Recalculate for snap

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Top Tabs */}
      <View style={{ paddingHorizontal: 10, paddingVertical: 8, height: 44 }}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
          {[
            { id: 'friends', label: 'Friends' },
            { id: 'twins', label: 'Twins' },
            { id: 'global', label: 'Global' }
          ].map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.1)',
                marginRight: 8,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ 
                color: activeTab === tab.id ? '#000' : '#fff', 
                fontWeight: activeTab === tab.id ? '700' : '500',
                fontSize: 13,
                lineHeight: 16,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#888', marginTop: 16 }}>Loading pods...</Text>
        </View>
      ) : filteredFeed.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 60, marginBottom: 16 }}>
            {activeTab === 'friends' ? '👥' : activeTab === 'twins' ? '🧬' : '🌍'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            {activeTab === 'friends' ? 'No friend pods yet' : 
             activeTab === 'twins' ? 'No style twin pods' : 
             'No global pods right now'}
          </Text>
          <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            {activeTab === 'friends' 
              ? "Create a pod and invite your friends, or wait for friends to invite you!" 
              : "Check back soon for fresh fit questions from the community."}
          </Text>
          <Pressable 
            onPress={() => setRoute('createpod')}
            style={{ marginTop: 24, backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Create a Pod</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList 
          ref={flatListRef}
          data={filteredFeed}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <FeedItem 
              item={item} 
              index={index}
              onVoteComplete={handleVoteComplete}
              onInteractionComplete={handleInteractionComplete}
              showComments={Boolean(activeTab === 'friends')}
              onRefresh={onRefresh}
              loadPods={loadPods}
              localVoteStateRef={localVoteStateRef}
              scrollToNextCard={scrollToNextCard}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          snapToInterval={availableHeight + 20}
          snapToAlignment="start"
          decelerationRate="fast"
          // FIX: Prevent virtualization from unmounting items
          removeClippedSubviews={false}
          windowSize={21}
          maxToRenderPerBatch={10}
          onScrollToIndexFailed={(info) => {
            // Handle scroll to index failure gracefully
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 100);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={["#fff"]}
            />
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

// TryOn Component
const TryOn = () => {
  const { state, setRoute, setTryOnHistory, setCurrentProduct, setTwinUrl, setIsProcessing, setProcessingResult, setBannerMessage, setBannerType, setUser } = useApp();
  const { currentProduct, user, tryOnHistory, twinUrl, isProcessing } = state;
  const [selectedImage, setSelectedImage] = useState(null);
  // Removed local twinUrl and isProcessing state
  const [result, setResult] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingCategory, setPendingCategory] = useState(null); // Store category to use after user confirms
  const [selectedCategory, setSelectedCategory] = useState(null); // Category selected on screen
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(false); // Track if user manually selected
  const [showBodyPhotoGuidelines, setShowBodyPhotoGuidelines] = useState(false);
  
  // AI Search placeholder
  const placeholders = ["Dress below $80", "Find me a red polka dots dress", "suggest me wedding wear", "what to wear for miami vacation"];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Initialize selectedImage from currentProduct when it changes
  useEffect(() => {
    if (currentProduct?.image) {
      setSelectedImage(currentProduct.image);
      setResult(null); // Clear previous result when product changes
    }
    
    // Auto-detect category from product ONLY if user hasn't manually selected one
    // This prevents overriding user's manual selection
    if (!isCategoryManuallySelected && currentProduct?.category) {
      // Map product category to Replicate format
      const categoryMap = {
        'upper': 'upper_body',
        'upper_body': 'upper_body',
        'lower': 'lower_body',
        'lower_body': 'lower_body',
        'dress': 'dresses',
        'dresses': 'dresses'
      };
      const autoCategory = categoryMap[currentProduct.category] || null;
      if (autoCategory) {
        logger.log('🔍 Auto-detected category from product:', autoCategory);
        setSelectedCategory(autoCategory);
      }
    } else if (!isCategoryManuallySelected && currentProduct?.name) {
      // Try to detect from name only if no category manually selected
      const name = currentProduct.name.toLowerCase();
      let autoCategory = null;
      if (name.includes('dress') || name.includes('gown') || name.includes('jumpsuit')) {
        autoCategory = 'dresses';
      } else if (name.includes('pant') || name.includes('jean') || name.includes('trouser') || name.includes('skirt')) {
        autoCategory = 'lower_body';
      } else if (name.includes('top') || name.includes('shirt') || name.includes('blouse') || name.includes('jacket') || name.includes('sweater')) {
        autoCategory = 'upper_body';
      }
      if (autoCategory) {
        logger.log('🔍 Auto-detected category from name:', autoCategory);
        setSelectedCategory(autoCategory);
      }
    }
  }, [currentProduct?.image, currentProduct?.id, currentProduct?.category, currentProduct?.name]); // Update when product changes

  // Set default image only on mount if nothing is set
  useEffect(() => {
    if (!selectedImage && !currentProduct?.image) {
      setSelectedImage("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800");
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleImageUpload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8
    });
    if (!res.canceled && res.assets[0]) {
      setSelectedImage(res.assets[0].uri);
      setResult(null); // Clear previous result
      setCurrentProduct(null); // Clear product context
      setSelectedCategory(null); // Clear category - user must select
      setIsCategoryManuallySelected(false); // Reset manual selection flag
    }
  };

  const handleScreenshotUpload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8
    });
    if (!res.canceled && res.assets[0]) {
      setSelectedImage(res.assets[0].uri);
      setResult(null);
      setCurrentProduct(null);
      setSelectedCategory(null); // Clear category - user must select
      setIsCategoryManuallySelected(false); // Reset manual selection flag
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput('');
    setSelectedImage(url);
    setResult(null);
    setCurrentProduct({ image: url, fromUrl: true });
    setSelectedCategory(null); // Clear category - will be auto-detected or user selects
    setIsCategoryManuallySelected(false); // Reset manual selection flag
  };

  const handleTryOn = async (categoryParam) => {
    // categoryParam should ALWAYS be passed explicitly now
    // Validate it's a valid category string
    const validCategories = ['upper_body', 'lower_body', 'dresses'];
    const categoryToUse = validCategories.includes(categoryParam) ? categoryParam : null;
    
    logger.log('🚀 handleTryOn called with:', { categoryParam, categoryToUse, selectedCategory });

    if (!twinUrl) {
      Alert.alert("Add your photo", "Please upload a photo of yourself first.", [
        { text: "Upload", onPress: async () => {
           const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
           if (!res.canceled && res.assets[0]) setTwinUrl(res.assets[0].uri);
        }},
        { text: "Cancel", style: 'cancel' }
      ]);
      return;
    }
    if (!selectedImage) {
      Alert.alert("Select an outfit", "Please select an outfit image to try on.");
      return;
    }
    if (!categoryToUse) {
      logger.log('❌ No valid category - showing alert. categoryParam was:', categoryParam);
      Alert.alert("Select Category", "Please select an item type (Upper Body, Lower Body, or Dresses) before trying on.");
      return;
    }
    
    logger.log('✅ Valid category selected:', categoryToUse);

    setIsProcessing(true);
    setResult(null);
    
    // Show processing banner - keep it visible during processing
    setBannerMessage("AI is generating your try-on...");
    setBannerType('processing');
    
    try {
      // Validate required inputs
      if (!twinUrl) {
        throw new Error('Human image is required');
      }
      if (!selectedImage) {
        throw new Error('Garment image is required');
      }

      // Upload human image if it's a local URI
      let humanUrlToUse = twinUrl;
      if (twinUrl && twinUrl.startsWith('file://')) {
        logger.log('Uploading human image...');
        try {
          const uploadedUrl = await uploadImageAsync(twinUrl);
          if (!uploadedUrl || typeof uploadedUrl !== 'string') {
            throw new Error('Upload returned invalid URL');
          }
          humanUrlToUse = uploadedUrl;
          
          // Save this permanent URL to profile as body_image_url
          if (user?.id) {
            supabase.from('profiles').update({ body_image_url: humanUrlToUse }).eq('id', user.id).then(({ error }) => {
                if (error) logger.log('Error saving body image to profile:', error);
                else logger.log('Body image saved to profile');
            });
            // Update local user state
            setUser(prev => ({ ...prev, body_image_url: humanUrlToUse }));
            // Update local twinUrl state to use the remote URL
            setTwinUrl(humanUrlToUse);
          }
          
          logger.log('Human image uploaded successfully:', humanUrlToUse);
        } catch (uploadError) {
          logger.error('Error uploading human image:', uploadError);
          setIsProcessing(false);
          Alert.alert("Upload Error", "Failed to upload your photo. Please try again.");
          return;
        }
      } else if (!twinUrl || (!twinUrl.startsWith('http') && !twinUrl.startsWith('file://'))) {
        logger.error('Invalid human image URL:', twinUrl);
        setIsProcessing(false);
        Alert.alert("Invalid Image", "Please upload a valid photo.");
        return;
      }

      // Upload garment image if it's a local URI
      let garmentUrlToUse = selectedImage;
      if (selectedImage && selectedImage.startsWith('file://')) {
        logger.log('Uploading garment image...');
        try {
          const uploadedUrl = await uploadImageAsync(selectedImage);
          if (!uploadedUrl || typeof uploadedUrl !== 'string') {
            throw new Error('Upload returned invalid URL');
          }
          garmentUrlToUse = uploadedUrl;
          logger.log('Garment image uploaded successfully:', garmentUrlToUse);
        } catch (uploadError) {
          logger.error('Error uploading garment image:', uploadError);
          setIsProcessing(false);
          Alert.alert("Upload Error", "Failed to upload outfit image. Please try again.");
          return;
        }
      } else if (!selectedImage || (!selectedImage.startsWith('http') && !selectedImage.startsWith('file://'))) {
        logger.error('Invalid garment image URL:', selectedImage);
        setIsProcessing(false);
        Alert.alert("Invalid Image", "Please select a valid outfit image.");
        return;
      }

      // Ensure URLs are valid strings
      if (!humanUrlToUse || !garmentUrlToUse || typeof humanUrlToUse !== 'string' || typeof garmentUrlToUse !== 'string') {
        logger.error('Invalid URLs after processing:', { humanUrlToUse, garmentUrlToUse });
        setIsProcessing(false);
        Alert.alert("Error", "Failed to prepare images. Please try again.");
        return;
      }

      // categoryToUse is already validated - use it directly
      const category = categoryToUse;
      
      logger.log('📤 SENDING TO REPLICATE API - Category:', category);
      logger.log('Starting try-on API call with:', { 
        humanUrlToUse: humanUrlToUse.substring(0, 50) + '...', 
        garmentUrlToUse: garmentUrlToUse.substring(0, 50) + '...', 
        category 
      });

      // Start the try-on job
      let job;
      try {
        job = await startTryOn(humanUrlToUse, garmentUrlToUse, category);
        if (!job || !job.jobId) {
          throw new Error('Invalid job response from API');
        }
        logger.log('🎉 Try-on job started:', job.jobId);
        logger.log('📋 API confirmed category sent:', job.categorySent);
        
        // Alert if category mismatch (for debugging)
        if (job.categorySent && job.categorySent !== category) {
          logger.error('⚠️ CATEGORY MISMATCH! Sent:', category, 'API says:', job.categorySent);
        }
      } catch (apiError) {
        logger.error('Try-on API error:', apiError);
        setIsProcessing(false);
        Alert.alert("Try-On Error", apiError.message || "Failed to start try-on. Please check your connection and try again.");
        return;
      }
      let status = { status: 'queued' };
      let pollCount = 0;
      const maxPolls = 60; // Poll for up to 5 minutes (5s * 60)

      // Poll in background? No, we await here. 
      // To make it background, we shouldn't await loop here if we want to unmount.
      // But for now, keeping it simple: user can navigate away, but we need to handle component unmount or lift polling.
      // Since function is inside TryOn, if TryOn unmounts, this might stop?
      // Actually, async function continues running even if component unmounts, but state updates will warn.
      // We should move polling logic to App or use a ref/global handler.
      // For MVP: We lifted setIsProcessing to App, so updates are safe-ish (App doesn't unmount).
      
      while (status.status !== 'succeeded' && status.status !== 'failed' && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        status = await pollTryOn(job.jobId);
        pollCount++;
      }

      if (status.status === 'succeeded' && status.resultUrl) {
        // ALWAYS upload Replicate results to Supabase Storage immediately
        // We never save Replicate URLs - only permanent Supabase URLs
        let finalResultUrl = status.resultUrl;
        const isReplicateUrl = status.resultUrl.includes('replicate.delivery') || 
                              status.resultUrl.includes('replicate.com');
        
        if (isReplicateUrl) {
          logger.log('📤 Replicate URL detected, uploading to Supabase immediately...');
          try {
            finalResultUrl = await uploadRemoteImage(status.resultUrl);
            logger.log('✅ Replicate image uploaded to Supabase, permanent URL:', finalResultUrl);
            
            // Verify it's a Supabase URL, not still a Replicate URL
            if (finalResultUrl.includes('replicate')) {
              throw new Error('Upload failed - still a Replicate URL');
            }
          } catch (e) {
            logger.error("❌ Failed to upload Replicate image to Supabase:", e);
            setBannerMessage("Failed to save image. Please try again.");
            setBannerType('error');
            setIsProcessing(false);
            return; // Don't save if upload failed
          }
        } else {
          logger.log('✅ Using permanent URL (not Replicate):', finalResultUrl);
        }

        // Only use the permanent URL from here on
        setProcessingResult(finalResultUrl);
        setResult(finalResultUrl);
        
        // Define productImageUrl in the outer scope so it's available for both Supabase save and navigation
        const productImageUrl = currentProduct?.image || garmentUrlToUse || null;
        
        if (user?.id) {
          const entryId = generateUUID();
          const entry = {
            id: entryId,
            productName: currentProduct?.name || "Custom Item",
            resultUrl: finalResultUrl,
            productImage: productImageUrl, // Always include product image
            productUrl: currentProduct?.url || currentProduct?.link || null,
            image: productImageUrl, // Use product image for display
            createdAt: new Date().toISOString()
          };
          setTryOnHistory(prev => [entry, ...prev]);
          
          // Track Try On Event
          trackEvent(user.id, 'tryon_success', currentProduct || { image: garmentUrlToUse });
          
          // Save to Supabase - ensure product_image is always saved
          try {
            await supabase.from('try_on_history').insert({
              id: entryId,
              user_id: user.id,
              result_url: finalResultUrl,
              product_name: currentProduct?.name || "Custom Item",
              product_image: productImageUrl, // Always save product image
              product_url: currentProduct?.url || currentProduct?.link || null,
              visibility: 'private'
            });
          } catch (err) {
            logger.log('Error saving try-on to Supabase:', err?.message || String(err));
          }
        }
        
        // Ensure currentProduct is preserved for TryOnResultScreen
        if (!currentProduct?.image && garmentUrlToUse) {
          setCurrentProduct({
            ...currentProduct,
            image: garmentUrlToUse,
            name: currentProduct?.name || "Custom Item"
          });
        }
        // Show success banner instead of alert
        setBannerMessage("✨ Your AI look is ready!");
        setBannerType('success');
        
        // Navigate to result screen immediately, passing product details explicitly
        setRoute('tryonresult', {
            product: {
                name: currentProduct?.name || "Custom Item",
                image: productImageUrl, // Explicitly pass the correct original image
                url: currentProduct?.url || currentProduct?.link,
                price: currentProduct?.price
            }
        });
        
        setTimeout(() => {
          setBannerMessage(null);
          setBannerType(null);
        }, 5000);
      } else {
        setBannerMessage("Try-on failed. Please try again.");
        setBannerType('error');
        setTimeout(() => {
          setBannerMessage(null);
          setBannerType(null);
        }, 5000);
      }
    } catch (error) {
      logger.error("AI Try-On Error:", error);
      setBannerMessage("Something went wrong. Please try again.");
      setBannerType('error');
      setTimeout(() => {
        setBannerMessage(null);
        setBannerType(null);
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* AI Search Bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 }}>
        <Pressable 
            style={styles.searchBar}
            onPress={() => setRoute('chat')}
        >
            <Text style={styles.searchText}>{placeholders[placeholderIndex]}</Text>
            <View style={styles.searchIconContainer}>
                <Text>🔍</Text>
            </View>
        </Pressable>
      </View>

      {/* Main Image Area */}
      <View style={[styles.tryOnImageContainer, { marginBottom: 12 }]}>
        <Pressable onPress={handleImageUpload} style={{ flex: 1 }}>
          <OptimizedImage 
            source={{ uri: result || selectedImage }} 
            style={styles.tryOnMainImage} 
            resizeMode="cover" 
          />
          <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Tap to change</Text>
          </View>
        </Pressable>
        {result && (
            <View style={styles.resultOverlay}>
                <Text style={styles.resultLabel}>AI Generated</Text>
            </View>
        )}
        {currentProduct?.fromUrl && (
            <View style={styles.urlBadge}>
                <Text style={styles.urlText}>From Link</Text>
            </View>
        )}
      </View>

      {/* Image Upload Options - Original style but reduced height */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Pressable 
            style={[styles.secondaryBtn, { flex: 1, height: 50 }]} 
            onPress={handleImageUpload}
          >
            <Text style={styles.secondaryBtnText}>📷 Upload Image</Text>
          </Pressable>
          <Pressable 
            style={[styles.secondaryBtn, { flex: 1, height: 50 }]} 
            onPress={handleScreenshotUpload}
          >
            <Text style={styles.secondaryBtnText}>📸 Screenshot</Text>
          </Pressable>
        </View>
        
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {/* User Photo Upload/Display - Compact */}
        <View style={[styles.userPhotoRow, { marginBottom: 12 }]}>
            <View>
                <Text style={styles.sectionTitle}>Your Body Photo</Text>
                <Text style={styles.sectionSubtitle}>Used to generate the fit</Text>
            </View>
            <Pressable onPress={() => {
                setShowBodyPhotoGuidelines(true);
            }}>
                    {twinUrl ? (
                  <View>
                    <OptimizedImage 
                      source={{ uri: twinUrl }} 
                      style={styles.userThumbnail} 
                      resizeMode="cover"
                      width={80}  // Thumbnail size
                      height={80} // Thumbnail size
                      quality={85}
                    />
                    <Pressable 
                      style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setTwinUrl(null);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10 }}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                    <View style={styles.uploadPlaceholder}>
                        <Text style={{ color: '#fff', fontSize: 20 }}>+</Text>
                    </View>
                )}
            </Pressable>
        </View>

        {/* Category Selector */}
        <View style={styles.categorySelectorContainer}>
          <Text style={styles.categorySelectorLabel}>Item Type *</Text>
          <View style={styles.categorySelectorRow}>
            <Pressable 
              style={[styles.categorySelectorOption, selectedCategory === 'upper_body' && styles.categorySelectorOptionSelected]}
              onPress={() => {
                logger.log('👆 User selected category: upper_body');
                setSelectedCategory('upper_body');
                setIsCategoryManuallySelected(true);
              }}
            >
              <Text style={[styles.categorySelectorText, selectedCategory === 'upper_body' && styles.categorySelectorTextSelected]}>
                Upper Body
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.categorySelectorOption, selectedCategory === 'lower_body' && styles.categorySelectorOptionSelected]}
              onPress={() => {
                logger.log('👆 User selected category: lower_body');
                setSelectedCategory('lower_body');
                setIsCategoryManuallySelected(true);
              }}
            >
              <Text style={[styles.categorySelectorText, selectedCategory === 'lower_body' && styles.categorySelectorTextSelected]}>
                Lower Body
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.categorySelectorOption, selectedCategory === 'dresses' && styles.categorySelectorOptionSelected]}
              onPress={() => {
                logger.log('👆 User selected category: dresses');
                setSelectedCategory('dresses');
                setIsCategoryManuallySelected(true);
              }}
            >
              <Text style={[styles.categorySelectorText, selectedCategory === 'dresses' && styles.categorySelectorTextSelected]}>
                Dresses
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Main Action - Try On Button Only */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable 
              style={[styles.primaryBtn, (isProcessing || !selectedCategory) && styles.disabledBtn, { flex: 1, height: 50 }]} 
              onPress={() => {
                logger.log('🎯 Try On button pressed with selectedCategory:', selectedCategory);
                handleTryOn(selectedCategory);
              }}
              disabled={Boolean(isProcessing || !selectedCategory)}
          >
              {isProcessing ? (
                  <ActivityIndicator color="#000" size="small" />
              ) : (
                  <Text style={[styles.primaryBtnText, { fontSize: 16, fontWeight: '600' }]}>✨ Try On</Text>
              )}
          </Pressable>
        </View>
      </View>

      {/* Category Selection Modal */}
      <Modal visible={Boolean(showCategoryModal)} transparent={true} animationType="slide">
        <View style={styles.categoryModalContainer}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Select Item Type</Text>
              <Text style={styles.categoryModalSubtitle}>This helps AI fit the item correctly</Text>
            </View>
            
            <View style={styles.categoryOptions}>
              <Pressable 
                style={[styles.categoryOption, pendingCategory === 'upper_body' && styles.categoryOptionSelected]}
                onPress={() => setPendingCategory('upper_body')}
              >
                <Text style={styles.categoryOptionEmoji}>👕</Text>
                <View style={styles.categoryOptionTextContainer}>
                  <Text style={[styles.categoryOptionTitle, pendingCategory === 'upper_body' && styles.categoryOptionTitleSelected]}>
                    Upper Body
                  </Text>
                  <Text style={styles.categoryOptionDesc}>Shirts, blouses, jackets, sweaters</Text>
                </View>
                {pendingCategory === 'upper_body' && <Text style={styles.categoryCheck}>✓</Text>}
              </Pressable>

              <Pressable 
                style={[styles.categoryOption, pendingCategory === 'lower_body' && styles.categoryOptionSelected]}
                onPress={() => setPendingCategory('lower_body')}
              >
                <Text style={styles.categoryOptionEmoji}>👖</Text>
                <View style={styles.categoryOptionTextContainer}>
                  <Text style={[styles.categoryOptionTitle, pendingCategory === 'lower_body' && styles.categoryOptionTitleSelected]}>
                    Lower Body
                  </Text>
                  <Text style={styles.categoryOptionDesc}>Jeans, trousers, skirts, shorts</Text>
                </View>
                {pendingCategory === 'lower_body' && <Text style={styles.categoryCheck}>✓</Text>}
              </Pressable>

              <Pressable 
                style={[styles.categoryOption, pendingCategory === 'dresses' && styles.categoryOptionSelected]}
                onPress={() => setPendingCategory('dresses')}
              >
                <Text style={styles.categoryOptionEmoji}>👗</Text>
                <View style={styles.categoryOptionTextContainer}>
                  <Text style={[styles.categoryOptionTitle, pendingCategory === 'dresses' && styles.categoryOptionTitleSelected]}>
                    Dresses
                  </Text>
                  <Text style={styles.categoryOptionDesc}>Dresses, gowns, jumpsuits</Text>
                </View>
                {pendingCategory === 'dresses' && <Text style={styles.categoryCheck}>✓</Text>}
              </Pressable>
            </View>

            <View style={styles.categoryModalActions}>
              <Pressable 
                style={[styles.categoryModalButton, styles.categoryModalButtonCancel]}
                onPress={() => {
                  setShowCategoryModal(false);
                  setPendingCategory(null);
                }}
              >
                <Text style={styles.categoryModalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.categoryModalButton, styles.categoryModalButtonConfirm, !pendingCategory && styles.categoryModalButtonDisabled]}
                onPress={() => {
                  if (pendingCategory) {
                    logger.log('👆 User confirmed category from modal:', pendingCategory);
                    setSelectedCategory(pendingCategory); // Update the on-screen selector too
                    setIsCategoryManuallySelected(true);
                    setShowCategoryModal(false);
                    const category = pendingCategory;
                    setPendingCategory(null);
                    handleTryOn(category);
                  }
                }}
                disabled={Boolean(!pendingCategory)}
              >
                <Text style={[styles.categoryModalButtonTextConfirm, !pendingCategory && styles.categoryModalButtonTextDisabled]}>
                  Continue
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Body Photo Guidelines Modal */}
      <PhotoGuidelinesModal
        visible={Boolean(showBodyPhotoGuidelines)}
        type="body"
        onClose={() => setShowBodyPhotoGuidelines(false)}
        onContinue={async () => {
          logger.log('📸 onContinue START in TryOn');
          // Don't close modal yet - open ImagePicker first
          const res = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8
          });
          logger.log('📸 ImagePicker returned:', res.canceled ? 'CANCELLED' : 'SELECTED');
          // Now close the modal
          setShowBodyPhotoGuidelines(false);
          
          if (!res.canceled && res.assets && res.assets[0]) {
            try {
              logger.log('📸 Uploading image...');
              const uploadedUrl = await uploadImageAsync(res.assets[0].uri);
              logger.log('📸 Uploaded URL:', uploadedUrl);
              if (user?.id) {
                await supabase.from('profiles').update({ body_image_url: uploadedUrl }).eq('id', user.id);
              }
              setTwinUrl(uploadedUrl);
              if (setUser) setUser(prev => ({ ...prev, body_image_url: uploadedUrl }));
              setBannerMessage('✓ Body photo saved!');
              setBannerType('success');
              setTimeout(() => {
                setBannerMessage(null);
                setBannerType(null);
              }, 3000);
            } catch (error) {
              logger.error('❌ Error saving body photo:', error);
              setBannerMessage('Failed to save photo');
              setBannerType('error');
              setTimeout(() => {
                setBannerMessage(null);
                setBannerType(null);
              }, 3000);
            }
          } else {
            logger.log('📸 No image selected or cancelled');
          }
        }}
      />
    </ScrollView>
  );
};

// Main App Component
export default function App() {
  const [route, setRoute] = useState(null); // Start as null, will be set after auth check
  const [routeParams, setRouteParams] = useState({});
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Track if we're still checking auth
  const [twinUrl, setTwinUrl] = useState(null); // Lifted state for persistence
  const [isProcessing, setIsProcessing] = useState(false); // Global processing state
  const [processingResult, setProcessingResult] = useState(null); // Store result globally
  const [tryOnHistory, setTryOnHistory] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [priceTracking, setPriceTracking] = useState({}); // Store price tracking: { productId: { price, productId } }
  
  // Load price tracking from AsyncStorage on app start
  useEffect(() => {
    const loadPriceTracking = async () => {
      try {
        const stored = await AsyncStorage.getItem('price_tracking');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPriceTracking(parsed);
          logger.log('Loaded price tracking from storage:', Object.keys(parsed).length, 'products');
        }
      } catch (error) {
        logger.error('Error loading price tracking:', error);
      }
    };
    loadPriceTracking();
  }, []);
  
  // Save price tracking to AsyncStorage whenever it changes
  useEffect(() => {
    const savePriceTracking = async () => {
      try {
        await AsyncStorage.setItem('price_tracking', JSON.stringify(priceTracking));
        logger.log('Saved price tracking to storage');
      } catch (error) {
        logger.error('Error saving price tracking:', error);
      }
    };
    if (Object.keys(priceTracking).length > 0) {
      savePriceTracking();
    }
  }, [priceTracking]);
  
  const [bannerMessage, setBannerMessage] = useState(null); // Banner message state
  const [bannerType, setBannerType] = useState(null); // 'processing' or 'success'
  const [savedFits, setSavedFits] = useState([]); // Saved outfits
  const [pendingInvite, setPendingInvite] = useState(null); // Pending invite from deep link
  const [routeStack, setRouteStack] = useState([]); // Navigation stack for back button
  const [allProducts, setAllProducts] = useState([]); // Only garment products from API
  const [filterGender, setFilterGender] = useState('all'); // 'all', 'men', 'women', 'unisex'
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'upper', 'bottom', 'dress'
  
  // Check New Architecture status on app start
  useEffect(() => {
    checkNewArchitecture();
    verifyFabricComponents();
  }, []);
  
  // Fetch garments from API only (no static products)
  useEffect(() => {
    const loadGarments = async () => {
      try {
        logger.log('🛍️ Loading garments from admin panel...');
        const garmentProducts = await fetchGarmentsAsProducts({
          gender: filterGender !== 'all' ? filterGender : undefined,
          category: filterCategory !== 'all' ? filterCategory : undefined,
        });
        
        logger.log(`🛍️ Total products: ${garmentProducts.length} (all from API)`);
        setAllProducts(garmentProducts);
      } catch (error) {
        logger.error('Error loading garments:', error);
        // No fallback - use empty array if API fails
        setAllProducts([]);
      }
    };
    
    // Load garments when app starts or when route changes to shop
    if (route === 'shop' || route === null) {
      loadGarments();
    }
  }, [route, filterGender, filterCategory]);
  
  // Check for existing Supabase session on startup
  useEffect(() => {
    const loadUserData = async (userId) => {
      // Load try-on history
      try {
        logger.log('Loading try-on history for user:', userId);
        const { data: tryOns, error: tryOnError } = await supabase
          .from('try_on_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (tryOnError) {
          logger.log('Error fetching try-on history:', tryOnError.message);
        } else if (tryOns && tryOns.length > 0) {
          logger.log('Loaded', tryOns.length, 'try-ons');
          const validTryOns = tryOns.filter(item => {
            const url = item.result_url || item.resultUrl;
            // Filter out Replicate URLs (they expire) - only show permanent Supabase URLs
            const hasValidUrl = url && typeof url === 'string' && url.startsWith('http');
            const isReplicateUrl = url && (url.includes('replicate.delivery') || url.includes('replicate.com'));
            
            if (isReplicateUrl) {
              logger.log('⚠️ Filtering out expired Replicate URL from try-on history:', item.id);
            }
            
            return hasValidUrl && !isReplicateUrl;
          });
          setTryOnHistory(validTryOns.map(item => ({
            id: item.id,
            resultUrl: item.result_url || item.resultUrl, // Permanent Supabase URL only
            productName: item.product_name || item.productName,
            productImage: item.product_image || item.productImage, // Preserve image URL
            productUrl: item.product_url || item.productUrl,
            image: item.product_image || item.image, // Also store in image field for compatibility
            createdAt: item.created_at || item.createdAt
          })));
        } else {
          logger.log('No try-on history found');
          setTryOnHistory([]); 
        }
      } catch (e) {
        logger.log('Error loading try-on history on init:', e);
      }

      // Load saved fits
      try {
        logger.log('Loading saved fits for user:', userId);
        const { data: fits, error: fitsError } = await supabase
          .from('saved_fits')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (fitsError) {
          logger.log('Error fetching saved fits:', fitsError.message);
        } else if (fits && fits.length > 0) {
          logger.log('Loaded', fits.length, 'saved fits');
          const validFits = fits.filter(item => 
            (item.image_url || item.image) && typeof (item.image_url || item.image) === 'string'
          );
          setSavedFits(validFits.map(item => ({
            id: item.id,
            image: item.image_url || item.image, // Preserve image URL
            title: item.title,
            price: item.price,
            visibility: item.visibility || 'private',
            createdAt: item.created_at || item.createdAt
          })));
        } else {
          logger.log('No saved fits found');
          setSavedFits([]);
        }
      } catch (e) {
        logger.log('Error loading saved fits on init:', e);
      }
    };

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Load profile data
          const userId = session.user.id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          // Build color profile from database fields (load on startup!)
          const colorProfileData = (profile?.color_season || profile?.color_tone) ? {
            tone: profile.color_tone || 'neutral',
            depth: profile.color_depth || 'medium',
            season: profile.color_season,
            clarity: profile.color_clarity || null,
            microSeason: profile.micro_season || null,
            bestColors: profile.best_colors || [],
            avoidColors: profile.avoid_colors || [],
          } : null;
          
          if (colorProfileData) {
            logger.log('🎨 Loaded color profile on startup:', {
              season: colorProfileData.season,
              depth: colorProfileData.depth,
              clarity: colorProfileData.clarity,
            });
          }
          
          setUser({
            id: userId,
            email: session.user.email,
            phone: session.user.phone,
            name: profile?.name || session.user.user_metadata?.name,
            avatar_url: profile?.avatar_url,
            body_image_url: profile?.body_image_url, // Load body image
            face_image_url: profile?.face_image_url, // Load face image
            // Color profile fields loaded on app startup
            colorProfile: colorProfileData,
          });
          
          // Auto-fill body image for try-on
          if (profile?.body_image_url) {
            setTwinUrl(profile.body_image_url);
          }
          
          await loadUserData(userId);
          
          // Refresh style profile
          refreshStyleProfile(userId).catch(e => logger.log('Style profile refresh error:', e));
          
          logger.log('Restored session for:', session.user.email);
          setRoute('feed'); // User is logged in, go to explore
        } else {
          // No session - show login screen
          logger.log('No session found, showing login screen');
          setRoute('auth'); // Show login screen
          // Still create anonymous user for try-on history
          let userId = null;
          try {
            userId = await AsyncStorage.getItem('anonymous_user_id');
          } catch (e) {
            logger.log('Error getting anonymous ID:', e);
          }

          if (!userId) {
            userId = generateUUID();
            try {
                await AsyncStorage.setItem('anonymous_user_id', userId);
            } catch (e) {
                logger.log('Error saving anonymous ID:', e);
            }
          }

          logger.log('Using anonymous user ID:', userId);
          setUser({ id: userId, email: null });
          await loadUserData(userId);
        }
      } catch (error) {
        logger.log('Session check error:', error);
        // Fallback to login screen
        setRoute('auth');
        const userId = generateUUID();
        setUser({ id: userId, email: null });
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.log('Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        
        // Load profile
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        // If profile doesn't exist for new user, create it
        if (profileError && profileError.code === 'PGRST116') {
          logger.log('Creating profile for new user:', userId);
          const newProfile = {
            id: userId,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          };
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();
          
          if (createError) {
            logger.log('Failed to create profile:', createError);
          } else {
            profile = createdProfile;
            logger.log('Profile created successfully');
          }
        }
        
        // Build color profile from database fields
        const colorProfileData = (profile?.color_season || profile?.color_tone) ? {
          tone: profile.color_tone || 'neutral',
          depth: profile.color_depth || 'medium',
          season: profile.color_season,
          clarity: profile.color_clarity || null,
          microSeason: profile.micro_season || null,
          bestColors: profile.best_colors || [],
          avoidColors: profile.avoid_colors || [],
        } : null;
        
        setUser({
          id: userId,
          email: session.user.email,
          phone: session.user.phone,
          name: profile?.name || session.user.user_metadata?.name,
          avatar_url: profile?.avatar_url,
          body_image_url: profile?.body_image_url,
          face_image_url: profile?.face_image_url,
          colorProfile: colorProfileData,
        });

        // Auto-fill body image for try-on
        if (profile?.body_image_url) {
          setTwinUrl(profile.body_image_url);
        }
        
        await loadUserData(userId);
        
        // Refresh style profile
        refreshStyleProfile(userId).catch(e => logger.log('Style profile refresh error:', e));
        
        // Claim pending invite if exists (load from AsyncStorage)
        const storedInvite = await AsyncStorage.getItem('pendingInvite');
        if (storedInvite) {
          try {
            const invite = JSON.parse(storedInvite);
            const result = await claimInvite(invite, userId);
            if (result.success) {
              logger.log('Invite claimed successfully:', result.message);
              setPendingInvite(null);
              await AsyncStorage.removeItem('pendingInvite');
              setBannerMessage('✓ Connected with friend!');
              setBannerType('success');
              setTimeout(() => {
                setBannerMessage(null);
                setBannerType(null);
              }, 3000);
              
              // If it's a pod invite, navigate to the pod
              if (invite.type === 'pod' && invite.podId) {
                // Navigate to explore first, then to pod so back works correctly
                setRoute('feed');
                setTimeout(() => handleSetRoute('podlive', { id: invite.podId }), 100);
                return; // Don't navigate to explore again
              }
            } else {
              logger.log('Failed to claim invite:', result.message);
            }
          } catch (error) {
            logger.error('Error claiming invite:', error);
          }
        }
        
        // Navigate to explore after successful login
        setRoute('feed');
      } else if (event === 'SIGNED_OUT') {
        // Clear user data and go to login screen
        logger.log('Signed out, going to login screen');
        
        // 1. Clear all user-dependent state first
        setUser(null);
        setTryOnHistory([]);
        setSavedFits([]);
        setCurrentProduct(null);
        setProcessingResult(null);
        setTwinUrl(null); 
        
        // 2. Force route change immediately
        setRoute('auth');
        
        // 3. Setup anonymous user in background
        let userId = null;
        try {
            userId = await AsyncStorage.getItem('anonymous_user_id');
        } catch (e) {}

        if (!userId) {
            userId = generateUUID();
            try { await AsyncStorage.setItem('anonymous_user_id', userId); } catch (e) {}
        }
        
        // 4. Reset user state to anonymous ONLY if we are still on auth screen? 
        // Actually, we should just leave it as null until they login or we decide to support anonymous browsing.
        // But the app seems to use anonymous ID.
        setUser({ id: userId, email: null });
        
        // Don't await this, let it happen
        loadUserData(userId).catch(e => logger.log('Error loading anon data:', e));
      }
    });
    
    return () => subscription?.unsubscribe();
  }, []);

  // Deep link handling
  useEffect(() => {
    // Handle initial URL (when app opens from a link)
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          logger.log('App opened from deep link:', initialUrl);
          
          // Handle regular deep links (pods, invites, etc.)
          const parsed = parseDeepLink(initialUrl);
          if (parsed) {
            setPendingInvite(parsed);
            await AsyncStorage.setItem('pendingInvite', JSON.stringify(parsed));
            logger.log('Stored pending invite:', parsed);
            
            // If user is not logged in, ensure we're on auth screen
            if (!user?.email) {
              setRoute('auth');
            } else {
              // User is logged in, claim immediately
              try {
                const result = await claimInvite(parsed, user.id);
                if (result.success) {
                  logger.log('Invite claimed successfully:', result.message);
                  setPendingInvite(null);
                  await AsyncStorage.removeItem('pendingInvite');
                  setBannerMessage('✓ Connected with friend!');
                  setBannerType('success');
                  setTimeout(() => {
                    setBannerMessage(null);
                    setBannerType(null);
                  }, 3000);
                  
                  // If it's a pod invite, navigate to the pod
                  if (parsed.type === 'pod' && parsed.podId) {
                    // Navigate to explore first, then to pod so back works correctly
                    setRoute('feed');
                    setTimeout(() => handleSetRoute('podlive', { id: parsed.podId }), 100);
                  }
                }
              } catch (error) {
                logger.error('Error claiming invite:', error);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error handling initial URL:', error);
      }
    };

    handleInitialURL();

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', async (event) => {
      logger.log('Deep link received:', event.url);
      
      // Handle regular deep links (pods, invites, etc.)
      const parsed = parseDeepLink(event.url);
      if (parsed) {
        setPendingInvite(parsed);
        await AsyncStorage.setItem('pendingInvite', JSON.stringify(parsed));
        logger.log('Stored pending invite:', parsed);
        
        // If user is not logged in, go to auth screen
        if (!user?.email) {
          setRoute('auth');
        } else {
          // User is logged in, claim immediately
          try {
            const result = await claimInvite(parsed, user.id);
            if (result.success) {
              logger.log('Invite claimed successfully:', result.message);
              setPendingInvite(null);
              await AsyncStorage.removeItem('pendingInvite');
              setBannerMessage('✓ Connected with friend!');
              setBannerType('success');
              setTimeout(() => {
                setBannerMessage(null);
                setBannerType(null);
              }, 3000);
              
              // If it's a pod invite, navigate to the pod
              if (parsed.type === 'pod' && parsed.podId) {
                // Navigate to explore first, then to pod so back works correctly
                setRoute('feed');
                setTimeout(() => handleSetRoute('podlive', { id: parsed.podId }), 100);
              }
            }
          } catch (error) {
            logger.error('Error claiming invite:', error);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  // Run migrations and setup friends when Stylit user logs in
  useEffect(() => {
    if (user?.email === 'stylit@stylit.com' && user?.id) {
      // Run migrations (will check/create tables and setup friends)
      runMigrations().catch(err => {
        logger.log('Migrations error:', err?.message || String(err));
      });
      // Also run friends setup as backup
      setupStylitFriends(user.id).catch(err => {
        logger.log('Friends setup skipped:', err?.message || String(err));
      });
    }
  }, [user?.email, user?.id]);

  const handleSetRoute = (newRoute, params = {}) => {
    // Push current route to stack if it exists and is not a main tab route
    const mainTabRoutes = ['shop', 'feed', 'podshome', 'account'];
    const isNewRouteMainTab = mainTabRoutes.includes(newRoute);
    const isCurrentRouteMainTab = route && mainTabRoutes.includes(route);
    
    // Push to stack if:
    // 1. We have a current route
    // 2. We're navigating to a different route
    // 3. Either current route is NOT a main tab, OR we're navigating FROM a main tab TO a non-main tab
    if (route && route !== newRoute) {
      // Always push if current route is not a main tab
      // OR if navigating from main tab to non-main tab (e.g., shop -> product)
      if (!isCurrentRouteMainTab || (isCurrentRouteMainTab && !isNewRouteMainTab)) {
        setRouteStack(prev => [...prev, { route, params: routeParams || {} }]);
      }
    }
    
    // Always set params - if empty, clear the params to avoid stale data
    setRouteParams(params);
    setRoute(newRoute);
  };

  const goBack = () => {
    if (routeStack.length > 0) {
      const previous = routeStack[routeStack.length - 1];
      setRouteStack(prev => prev.slice(0, -1));
      setRouteParams(previous.params || {});
      setRoute(previous.route);
    } else {
      // Fallback: go to explore if no stack
      setRoute('feed');
    }
  };

  const appState = {
    user,
    tryOnHistory,
    currentProduct,
    route,
    routeParams
  };

  return (
    <SafeAreaProvider>
      <AppProvider value={{ 
        state: { ...appState, twinUrl, isProcessing, processingResult, priceTracking, savedFits }, 
        setRoute: handleSetRoute,
        goBack, 
        setUser, 
        setTryOnHistory, 
        setCurrentProduct,
        setTwinUrl,
        setIsProcessing,
        setProcessingResult,
        setPriceTracking,
        setBannerMessage,
        setBannerType,
        setSavedFits
      }}>
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />

          {/* Show loading while checking auth */}
          {isCheckingAuth && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
              <Text style={{ color: '#fff' }}>Loading...</Text>
            </View>
          )}

          {/* Screens */}
          {!isCheckingAuth && route === 'auth' && (
            <AuthScreen />
          )}

          {!isCheckingAuth && route === 'shop' && (
            <>
              {/* Sticky Search Bar */}
              <View style={styles.stickySearchBar}>
                <Pressable 
                  style={styles.stickySearchBarContent}
                  onPress={() => handleSetRoute('chat')}
                >
                  <View style={styles.searchBarIconContainer}>
                    <Image 
                      source={require('./assets/icon.png')} 
                      style={styles.searchBarIconImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.stickySearchBarText}>Search Styles by your Vibe, Color or Budget</Text>
                </Pressable>
              </View>
              
              {/* Filter Bar */}
              <View style={styles.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {/* Gender Filter */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Gender:</Text>
                    {['all', 'men', 'women', 'unisex'].map((gender) => (
                      <Pressable
                        key={gender}
                        style={[
                          styles.filterChip,
                          filterGender === gender && styles.filterChipActive
                        ]}
                        onPress={() => setFilterGender(gender)}
                      >
                        <Text style={[
                          styles.filterChipText,
                          filterGender === gender && styles.filterChipTextActive
                        ]}>
                          {gender === 'all' ? 'All' : gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  
                  {/* Category Filter */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Category:</Text>
                    {['all', 'upper', 'bottom', 'dress'].map((category) => (
                      <Pressable
                        key={category}
                        style={[
                          styles.filterChip,
                          filterCategory === category && styles.filterChipActive
                        ]}
                        onPress={() => setFilterCategory(category)}
                      >
                        <Text style={[
                          styles.filterChipText,
                          filterCategory === category && styles.filterChipTextActive
                        ]}>
                          {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
                
              <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100, paddingTop: 155 }}>
                {/* Product Grid */}
                <View style={styles.productGrid}>
                    {(allProducts || []).map((p) => (
                        <Pressable 
                            key={p.id} 
                            style={styles.productCard}
                            onPress={() => {
                                logger.log('🛒 Shop: selecting product:', p.name);
                                setCurrentProduct(p);
                                handleSetRoute('product');
                            }}
                        >
                            {(p.image || p.imageUrl) ? (
                                <OptimizedImage 
                                    source={{ uri: p.image || p.imageUrl }} 
                                    style={styles.productImage} 
                                    resizeMode="cover"
                                    width={300}  // Thumbnail width for Supabase transformations
                                    height={300} // Thumbnail height for Supabase transformations
                                    quality={85} // Good quality for product thumbnails
                                    showErrorPlaceholder={true}
                                    placeholder={
                                        <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' }]}>
                                            <ActivityIndicator size="small" color="#666" />
                                        </View>
                                    }
                                />
                            ) : (
                                <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' }]}>
                                    <Text style={{ color: '#666', fontSize: 14 }}>No Image</Text>
                                </View>
                            )}
                            <View style={styles.productInfo}>
                                <Text style={styles.productBrand}>{p.brand || 'Brand'}</Text>
                                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                                <Text style={styles.productPrice}>${p.price}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
              </ScrollView>
              
              {/* Floating AI Chat Button - Removed per user request */}

              <BottomBar route={route} go={handleSetRoute} />
            </>
          )}

          {!isCheckingAuth && route === 'feed' && (
            <>
              <Explore />
              <BottomBar route={route} go={handleSetRoute} />
            </>
          )}

          {!isCheckingAuth && route === 'tryon' && (
            <>
              <TryOn />
              <BottomBar route={route} go={(newRoute) => {
                // Clear currentProduct when navigating away from try-on
                if (newRoute !== 'tryon' && newRoute !== 'product') {
                  setCurrentProduct(null);
                }
                setRoute(newRoute);
              }} />
            </>
          )}

          {!isCheckingAuth && route === 'product' && <ProductScreen onBack={goBack} />}

          {!isCheckingAuth && route === 'tryonresult' && <TryOnResultScreen />}

          {!isCheckingAuth && route === 'podshome' && (
            <>
              <PodsHome 
                onCreatePod={(params) => {
                  if (params && params.imageUrl) {
                    handleSetRoute('createpod', params);
                  } else {
                    handleSetRoute('createpod', {});
                  }
                }}
                onPodLive={(id) => handleSetRoute('podlive', { id: String(id) })}
                onPodRecap={(id) => handleSetRoute('podrecap', { id: String(id) })}
                onPodGuest={(id) => handleSetRoute('podguest', { id: String(id) })}
                onInbox={() => handleSetRoute('inbox')}
                userId={user?.id}
                userEmail={user?.email}
                lastTryOn={tryOnHistory[0]}
              />
              <BottomBar route={route} go={handleSetRoute} />
            </>
          )}

          {!isCheckingAuth && route === 'createpod' && (
            <PodsScreen 
                onBack={goBack}
                onCreatePod={(id) => {
                  logger.log('onCreatePod called with id:', id, 'type:', typeof id);
                  if (id && id !== 'undefined' && String(id).length >= 30) {
                    logger.log('Navigating to podlive with id:', id);
                    handleSetRoute('podlive', { id: String(id) });
                  } else {
                    logger.error('Invalid pod ID received:', id, 'length:', id?.length);
                    Alert.alert('Error', 'Failed to create pod. Please try again.');
                  }
                }}
                userId={user?.id}
                userName={user?.name || user?.email?.split('@')[0] || 'A friend'}
                params={routeParams}
            />
          )}

          {!isCheckingAuth && route === 'podlive' && routeParams?.id && (
            <>
              <PodLive 
                  podId={String(routeParams.id)}
                  onBack={goBack}
                  onRecap={(id) => {
                    if (id && id !== 'undefined') {
                      handleSetRoute('podrecap', { id: String(id) });
                    }
                  }}
                  userId={user?.id}
              />
              <BottomBar route="podshome" go={(newRoute) => {
                // If navigating to podshome, keep the podlive routeParams
                if (newRoute === 'podshome') {
                  handleSetRoute('podshome');
                } else {
                  setRoute(newRoute);
                }
              }} />
            </>
          )}

          {!isCheckingAuth && route === 'podrecap' && routeParams?.id && (
            <PodRecap 
                podId={String(routeParams.id)}
                onBack={goBack}
                onViewProduct={(url) => {
                  handleSetRoute('product', { url });
                }}
                onUserProfile={(uid) => {
                  handleSetRoute('userprofile', { userId: uid });
                }}
                userId={user?.id}
            />
          )}

          {!isCheckingAuth && route === 'userprofile' && routeParams?.userId && (
            <UserProfileScreen
              userId={routeParams.userId}
              onBack={goBack}
              onPodGuest={(id) => handleSetRoute('podguest', { id: String(id) })}
            />
          )}

          {!isCheckingAuth && route === 'podguest' && routeParams?.id && (
            <PodGuest 
              podId={String(routeParams.id)}
              onBack={goBack}
              onRecap={() => handleSetRoute('podrecap', { id: routeParams.id })}
              userId={user?.id}
            />
          )}

          {!isCheckingAuth && route === 'inbox' && (
            <Inbox 
                onBack={goBack}
                onPodLive={(id) => handleSetRoute('podlive', { id })}
                onPodRecap={(id) => handleSetRoute('podrecap', { id })}
                userId={user?.id}
            />
          )}

          {!isCheckingAuth && route === 'chat' && (
            <ChatScreen 
                onBack={goBack}
                onProductSelect={(p) => {
                    setCurrentProduct(p);
                    handleSetRoute('product');
                }}
            />
          )}

          {!isCheckingAuth && route === 'stylecraft' && (
            <>
              <StyleCraftScreen />
              <BottomBar route={route} go={handleSetRoute} />
            </>
          )}

          {!isCheckingAuth && route === 'account' && (
            <>
              <StyleVaultScreen />
              <BottomBar route={route} go={handleSetRoute} />
            </>
          )}

          {!isCheckingAuth && route === 'admingarments' && (
            <AdminGarmentsScreen onBack={() => goBack()} />
          )}

          {/* Global Banner Notification - Rendered LAST to be on top of everything */}
          {bannerMessage && (
            <View style={styles.bannerWrapper}>
              <BannerNotification 
                message={bannerMessage} 
                type={bannerType}
                isTryOn={!!processingResult && bannerType === 'success'}
                onDismiss={() => {
                  setBannerMessage(null);
                  setBannerType(null);
                }}
                onPress={() => {
                  if (bannerType === 'success' && processingResult) {
                    handleSetRoute('tryonresult');
                    setBannerMessage(null);
                    setBannerType(null);
                  }
                }}
              />
            </View>
          )}

        </View>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  stickySearchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#000',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  stickySearchBarContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  searchBarIconImage: {
    width: 24,
    height: 24,
  },
  stickySearchBarText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 14,
  },
  filterBar: {
    position: 'absolute',
    top: 112,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  filterLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#6D6DF6',
    borderColor: '#6D6DF6',
  },
  filterChipText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 25,
  },
  productCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  productImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#222',
  },
  productInfo: {
    padding: 12,
  },
  productBrand: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  aiChatBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  aiChatGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 60,
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 24,
    marginBottom: 4,
  },
  iconBtnLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  urlInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 13,
  },
  urlGoBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  urlGoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  bannerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  bannerNotification: {
    marginTop: 50,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignSelf: 'center',
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 25,
  },
  bannerPressable: {
    alignSelf: 'center',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  bannerText: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    textAlign: 'center',
  },
  searchText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  searchIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tryOnImageContainer: {
    height: 400,
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  tryOnMainImage: {
    width: '100%',
    height: '100%',
  },
  resultOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resultLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  urlBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  urlText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  userPhotoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
  },
  userThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  primaryBtn: {
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  categoryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryModalHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  categoryModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  categoryModalSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  categoryOptions: {
    marginBottom: 24,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  categoryOptionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  categoryOptionTextContainer: {
    flex: 1,
  },
  categoryOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryOptionTitleSelected: {
    color: '#a5b4fc',
  },
  categoryOptionDesc: {
    color: '#9ca3af',
    fontSize: 12,
  },
  categoryCheck: {
    color: '#6366f1',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  categoryModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  categoryModalButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  categoryModalButtonConfirm: {
    backgroundColor: '#6366f1',
  },
  categoryModalButtonDisabled: {
    opacity: 0.5,
  },
  categoryModalButtonTextCancel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryModalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  categoryModalButtonTextDisabled: {
    opacity: 0.5,
  },
  categorySelectorContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categorySelectorLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  categorySelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categorySelectorOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelectorOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  categorySelectorText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  categorySelectorTextSelected: {
    color: '#a5b4fc',
  },
});
