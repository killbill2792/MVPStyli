import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '../lib/SimpleGradient';
import { Spacing, Colors, BorderRadius, Typography } from '../lib/designSystem';
import { 
  getUserActivePods, 
  getUserPastPods,
  getInvitedPods,
  getUserNotifications,
  getUnreadNotificationCount,
  deletePod
} from '../lib/pods';
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

const { width } = Dimensions.get('window');

const PodsHome = ({ 
  onBack, 
  onPodLive, 
  onPodRecap, 
  onInbox, 
  onCreatePod,
  userId, 
  userEmail,
  lastTryOn,
  onPodGuest
}) => {
  const [activePods, setActivePods] = useState([]);
  const [pastPods, setPastPods] = useState([]);
  const [invitedPods, setInvitedPods] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'past', 'invited'
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    loadPodsData();
  }, [userId]);

  const loadPodsData = async () => {
    // Only fetch if we have a valid UUID
    if (userId && userId.length >= 30 && userId.includes('-')) {
      // Only show loading spinner on initial load, not on subsequent refreshes
      if (!initialLoadDone) {
        setLoading(true);
      }
      try {
        const [active, past, invited, notifs, unread] = await Promise.all([
          getUserActivePods(userId),
          getUserPastPods(userId),
          getInvitedPods(userId),
          getUserNotifications(userId),
          getUnreadNotificationCount(userId)
        ]);
        
        const now = new Date().getTime();
        const validActive = (active || []).filter(p => new Date(p.ends_at).getTime() > now && p.status === 'live');
        const expiredActive = (active || []).filter(p => new Date(p.ends_at).getTime() <= now || p.status === 'expired');
        
        setActivePods(validActive);
        // Combine and deduplicate by ID, then sort by created_at descending (most recent first)
        const allPastPods = [...(past || []), ...expiredActive];
        const uniquePastPods = Array.from(
          new Map(allPastPods.map(pod => [pod.id, pod])).values()
        );
        uniquePastPods.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setPastPods(uniquePastPods);
        setInvitedPods(invited || []);
        setNotifications(notifs || []);
        setUnreadCount(unread || 0);
        setInitialLoadDone(true);
      } catch (error) {
        console.error('Error loading pods:', error);
        setActivePods([]);
        setPastPods([]);
        setInvitedPods([]);
      } finally {
        setLoading(false);
      }
    } else {
      setActivePods([]);
      setPastPods([]);
      setInvitedPods([]);
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const formatTimeLeft = (endsAt) => {
    const now = new Date().getTime();
    const endTime = new Date(endsAt).getTime();
    const remaining = Math.max(0, endTime - now);
    
    if (remaining <= 0) return 'Ended';

    const minutes = Math.floor(remaining / 60000);
    return `${minutes}m left`;
  };

  const getModeLabel = (mode) => {
    if (mode === 'friends') return 'Friends';
    if (mode === 'style_twins') return 'Twins';
    if (mode === 'global_mix') return 'Global';
    return mode;
  };

  // Only show the "Start from last try-on" card AFTER initial load is done
  // This prevents the flicker where card shows briefly then disappears
  const showStartCard = initialLoadDone && lastTryOn && !activePods.some(p => p.image_url === (lastTryOn.resultUrl || lastTryOn.image)) && !pastPods.some(p => p.image_url === (lastTryOn.resultUrl || lastTryOn.image));

  const ActivePodCard = ({ pod }) => (
    <Pressable style={styles.card} onPress={() => onPodLive(pod.id)}>
      <SafeImage 
        source={getValidImageUri(pod.image_url)} 
        style={styles.cardImage} 
        resizeMode="cover"
        width={300}  // Thumbnail width for pod cards
        height={200} // Thumbnail height for pod cards
        quality={85} // Good quality for pod cards
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{pod.title}</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          {getModeLabel(pod.audience)} · <Text style={{ color: Colors.primary }}>{formatTimeLeft(pod.ends_at)}</Text>
        </Text>
        <Text style={styles.confidenceText}>Tap to manage</Text>
      </View>
    </Pressable>
  );

  const PastPodCard = ({ pod }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const handleDelete = async () => {
      try {
        console.log('🗑️ Starting pod deletion:', pod.id);
        
        // Use the deletePod function from lib/pods.ts
        const success = await deletePod(pod.id);
        
        if (!success) {
          throw new Error('Delete operation returned false');
        }
        
        console.log('✅ Pod deleted, updating UI');
        
        // Remove from local state
        setPastPods(prev => prev.filter(p => p.id !== pod.id));
        setActivePods(prev => prev.filter(p => p.id !== pod.id));
        setShowDeleteConfirm(false);
        
        // Force refresh to ensure sync with database
        setTimeout(() => loadPodsData(), 500);
        
        Alert.alert('Deleted', 'Pod has been deleted.');
      } catch (error) {
        console.error('❌ Error deleting pod:', error);
        Alert.alert('Error', 'Failed to delete pod. Please try again.');
        setShowDeleteConfirm(false);
        // Reload to sync state
        loadPodsData();
      }
    };

    return (
      <Pressable 
        style={styles.card} 
        onPress={() => onPodRecap(pod.id)}
        onLongPress={() => setShowDeleteConfirm(true)}
      >
        <SafeImage 
        source={getValidImageUri(pod.image_url)} 
        style={styles.cardImage} 
        resizeMode="cover"
        width={300}  // Thumbnail width for pod cards
        height={200} // Thumbnail height for pod cards
        quality={85} // Good quality for pod cards
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{pod.title}</Text>
          <View style={[styles.liveBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <Text style={[styles.liveText, { color: '#ef4444' }]}>ENDED</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          {getModeLabel(pod.audience)} · <Text style={{ color: '#ef4444' }}>Ended</Text>
        </Text>
        <Text style={styles.confidenceText}>View results →</Text>
      </View>
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalTitle}>Delete Pod?</Text>
              <Text style={styles.deleteModalText}>This action cannot be undone.</Text>
              <View style={styles.deleteModalButtons}>
                <Pressable 
                  style={[styles.deleteModalButton, styles.deleteModalCancel]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.deleteModalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable 
                  style={[styles.deleteModalButton, styles.deleteModalConfirm]}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteModalConfirmText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
    </Pressable>
  );
  };

  const InvitedPodCard = ({ pod }) => {
    const isLive = pod.status === 'live' && new Date(pod.ends_at) > new Date();
    const ownerName = pod.owner_profile?.name || pod.owner_name || 'Friend';
    
    return (
      <Pressable 
        style={[styles.card, styles.invitedCard]} 
        onPress={() => {
          // Always go to guest view for invited pods
          // PodGuest will handle showing ended state appropriately
          if (onPodGuest) {
            onPodGuest(pod.id);
          } else {
            onPodLive(pod.id);
          }
        }}
      >
        <SafeImage 
        source={getValidImageUri(pod.image_url)} 
        style={styles.cardImage} 
        resizeMode="cover"
        width={300}  // Thumbnail width for pod cards
        height={200} // Thumbnail height for pod cards
        quality={85} // Good quality for pod cards
      />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{pod.title}</Text>
            {isLive ? (
              <View style={[styles.liveBadge, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                <Text style={[styles.liveText, { color: '#6366f1' }]}>INVITED</Text>
              </View>
            ) : (
              <View style={[styles.liveBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Text style={[styles.liveText, { color: '#ef4444' }]}>ENDED</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSubtitle}>
            {ownerName} · {getModeLabel(pod.audience)}
          </Text>
          <Text style={styles.confidenceText}>{isLive ? 'Vote now →' : 'View pod →'}</Text>
        </View>
      </Pressable>
    );
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <View style={styles.container}>
      {/* Floating Help Icon - At top level, outside SafeAreaView */}
      <Pressable 
        style={styles.helpFloatingButton}
        onPress={() => {
          console.log('🎯 Help button pressed!');
          setShowHelpModal(true);
        }}
      >
        <Text style={styles.helpFloatingButtonIcon}>?</Text>
      </Pressable>
      
      <SafeAreaView style={{ flex: 1, position: 'relative' }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pods</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Notification Bell - Always show, with badge if unread */}
          <Pressable 
            style={styles.notifBadge}
            onPress={() => setShowNotifications(!showNotifications)}
          >
            <Text style={styles.bellText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={onCreatePod} style={styles.startButton}>
            <Text style={styles.startButtonText}>Start Pod</Text>
          </Pressable>
        </View>
      </View>
      
      {/* Notifications Dropdown */}
      {showNotifications && (
        <View style={styles.notificationsDropdown}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>Notifications</Text>
            <Pressable onPress={() => setShowNotifications(false)}>
              <Text style={{ color: '#888', fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          {notifications.length > 0 ? (
            <>
              {notifications.slice(0, 5).map((notif, index) => {
                const podId = notif.payload?.pod_id;
                const hasValidPod = podId && podId.length >= 30;
                
                return (
                  <Pressable 
                    key={notif.id || index}
                    style={[styles.notifItem, !notif.read && styles.notifUnread]}
                    onPress={async () => {
                      setShowNotifications(false);
                      // Mark notification as read
                      if (!notif.read && notif.id) {
                        const { markNotificationRead } = await import('../lib/pods');
                        await markNotificationRead(notif.id);
                        // Update local state
                        setNotifications(prev => 
                          prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
                        );
                        // Reload unread count
                        const { getUnreadNotificationCount } = await import('../lib/pods');
                        const newCount = await getUnreadNotificationCount(userId);
                        setUnreadCount(newCount);
                      }
                      if (hasValidPod) {
                        // Navigate to explore Friends tab to vote
                        if (onPodGuest) {
                          onPodGuest(podId);
                        } else {
                          // Switch to invited tab
                          setActiveTab('invited');
                        }
                      }
                    }}
                  >
                    <Text style={styles.notifMessage}>
                      {/* Use enriched sender info if available */}
                      {notif.payload?.fromUserName 
                        ? `${notif.payload.fromUserName} invited you to vote` 
                        : notif.payload?.message || '🔔 New notification'}
                    </Text>
                    <Text style={styles.notifTime}>
                      {new Date(notif.created_at).toLocaleDateString()}
                    </Text>
                    {hasValidPod && (
                      <Text style={styles.notifAction}>Tap to vote →</Text>
                    )}
                  </Pressable>
                );
              })}
              {/* See All & Mark All Read buttons */}
              <View style={styles.notifActions}>
                {unreadCount > 0 && (
                  <Pressable 
                    style={styles.notifActionBtn}
                    onPress={async () => {
                      const { markAllNotificationsRead } = await import('../lib/pods');
                      await markAllNotificationsRead(userId);
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      setUnreadCount(0);
                    }}
                  >
                    <Text style={styles.notifActionBtnText}>Mark all read</Text>
                  </Pressable>
                )}
                <Pressable 
                  style={[styles.notifActionBtn, styles.notifActionBtnPrimary]}
                  onPress={() => {
                    setShowNotifications(false);
                    if (onInbox) onInbox();
                  }}
                >
                  <Text style={[styles.notifActionBtnText, styles.notifActionBtnTextPrimary]}>
                    See all →
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.notifEmpty}>No notifications yet</Text>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {['live', 'invited', 'past'].map(tab => (
          <Pressable 
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'live' ? 'My Pods' : tab === 'invited' ? `Invited${invitedPods.length > 0 ? ` (${invitedPods.length})` : ''}` : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Start New Pod Card - only in My Pods tab */}
        {activeTab === 'live' && showStartCard && (
          <Pressable style={styles.startCard} onPress={() => {
            onCreatePod({ imageUrl: lastTryOn.resultUrl || lastTryOn.image, product: { name: lastTryOn.productName } });
          }}>
            <LinearGradient
              colors={['#1a1a1a', '#111']}
              style={styles.startGradient}
            >
              <SafeImage 
                source={getValidImageUri(lastTryOn.resultUrl || lastTryOn.userImage || lastTryOn.image)} 
                style={styles.startImage} 
                resizeMode="cover"
                width={300}  // Thumbnail width for start image
                height={300} // Thumbnail height for start image
                quality={85} // Good quality for start image
              />
              <View style={styles.startContent}>
                <Text style={styles.startTitle}>Start from last try-on</Text>
                <Text style={styles.startSubtitle}>{lastTryOn.productName || 'Your latest look'}</Text>
                <Text style={styles.startAction}>Create Pod →</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Content based on active tab */}
        {activeTab === 'live' && (
          <View style={styles.section}>
            {loading ? (
               <Text style={styles.emptyText}>Loading...</Text>
            ) : activePods.length > 0 ? (
              activePods.map(pod => <ActivePodCard key={pod.id} pod={pod} />)
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyTitle}>No active pods</Text>
                <Text style={styles.emptyText}>Start a pod to get quick feedback on your outfits!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'invited' && (
          <View style={styles.section}>
            {loading ? (
               <Text style={styles.emptyText}>Loading...</Text>
            ) : invitedPods.length > 0 ? (
              invitedPods.map(pod => <InvitedPodCard key={pod.id} pod={pod} />)
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📬</Text>
                <Text style={styles.emptyTitle}>No invites yet</Text>
                <Text style={styles.emptyText}>When friends invite you to their pods, they'll appear here!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'past' && (
          <View style={styles.section}>
            {loading ? (
               <Text style={styles.emptyText}>Loading...</Text>
            ) : pastPods.length > 0 ? (
              pastPods.map(pod => <PastPodCard key={pod.id} pod={pod} />)
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>No past pods</Text>
                <Text style={styles.emptyText}>Your completed pods will show up here.</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
      
      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>What are Pods?</Text>
              <Pressable onPress={() => setShowHelpModal(false)}>
                <Text style={styles.helpModalClose}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView style={styles.helpModalScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.helpModalIntro}>
                Pods are a fun way to get fashion advice from your community! Share your outfit and get instant feedback.
              </Text>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>👥 Friends Pod</Text>
                <Text style={styles.helpSectionText}>
                  Share with your friends only. Perfect for getting honest feedback from people you trust. Only friends you've added can see and vote on your pod.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>👯 Style Twins Pod</Text>
                <Text style={styles.helpSectionText}>
                  Connect with users who have similar style preferences. Great for discovering new fashion ideas and getting advice from like-minded fashionistas.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>🌍 Global Pod</Text>
                <Text style={styles.helpSectionText}>
                  Share with everyone! Your pod will be visible to all Stylit users. Get diverse opinions and reach a wider audience. Perfect for showcasing your style to the world.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>⏱️ Duration</Text>
                <Text style={styles.helpSectionText}>
                  Choose how long your pod stays active (15, 30, 60, or 120 minutes). After the time expires, you'll see the final results and can no longer receive new votes.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>💬 Voting</Text>
                <Text style={styles.helpSectionText}>
                  Viewers can vote with 🔥 (Love it!), 🤔 (Maybe), or ❌ (Not for me). You'll see real-time results as votes come in!
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  startCard: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  startImage: {
    width: 60,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  startContent: {
    flex: 1,
    marginLeft: 16,
  },
  startTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  startSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  startAction: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardImage: {
    width: 60,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  liveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  endedDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  cardSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 4,
  },
  confidenceText: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
  },
  invitedCard: {
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  notifBadge: {
    position: 'relative',
    padding: 8,
  },
  bellText: {
    fontSize: 22,
  },
  notifDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationsDropdown: {
    position: 'absolute',
    top: 100,
    right: 20,
    left: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  notifTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  notifItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  notifUnread: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  notifMessage: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  notifTime: {
    color: '#888',
    fontSize: 12,
  },
  notifEmpty: {
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  notifAction: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  notifActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  notifActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  notifActionBtnPrimary: {
    backgroundColor: '#6366f1',
  },
  notifActionBtnText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  notifActionBtnTextPrimary: {
    color: '#fff',
  },
  deleteModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  deleteModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deleteModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  deleteModalText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteModalCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  deleteModalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirm: {
    backgroundColor: '#ef4444',
  },
  deleteModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpFloatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 99999,
  },
  helpFloatingButtonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  helpModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  helpModalClose: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  helpModalScroll: {
    maxHeight: 500,
  },
  helpModalIntro: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
    paddingBottom: 10,
  },
  helpSection: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  helpSectionTitle: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  helpSectionText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PodsHome;

