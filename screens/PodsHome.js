import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Colors, BorderRadius, Typography } from '../lib/designSystem';
import { 
  getUserActivePods, 
  getUserPastPods,
  getInvitedPods,
  getUserNotifications,
  getUnreadNotificationCount,
  deletePod
} from '../lib/pods';

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

  useEffect(() => {
    loadPodsData();
  }, [userId]);

  const loadPodsData = async () => {
    // Only fetch if we have a valid UUID
    if (userId && userId.length >= 30 && userId.includes('-')) {
      setLoading(true);
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
        // Combine and sort by created_at descending (most recent first)
        const allPastPods = [...(past || []), ...expiredActive];
        allPastPods.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setPastPods(allPastPods);
        setInvitedPods(invited || []);
        setNotifications(notifs || []);
        setUnreadCount(unread || 0);
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

  const showStartCard = lastTryOn && !activePods.some(p => p.image_url === (lastTryOn.resultUrl || lastTryOn.image)) && !pastPods.some(p => p.image_url === (lastTryOn.resultUrl || lastTryOn.image));

  const ActivePodCard = ({ pod }) => (
    <Pressable style={styles.card} onPress={() => onPodLive(pod.id)}>
      <SafeImage source={getValidImageUri(pod.image_url)} style={styles.cardImage} resizeMode="cover" />
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
        <SafeImage source={getValidImageUri(pod.image_url)} style={styles.cardImage} resizeMode="cover" />
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
        <SafeImage source={getValidImageUri(pod.image_url)} style={styles.cardImage} resizeMode="cover" />
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            notifications.slice(0, 5).map((notif, index) => {
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
            })
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
    </SafeAreaView>
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
});

export default PodsHome;

