import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '../lib/SimpleGradient';
import { 
  getUserNotifications, 
  markNotificationRead, 
  markAllNotificationsRead, 
  clearAllNotifications 
} from '../lib/pods';

const Inbox = ({ onBack, onPodLive, onPodRecap, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = async (isRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    if (isRefresh) {
      setRefreshing(true);
    } else if (!notifications.length) {
      setLoading(true);
    }
    
    try {
      const notifs = await getUserNotifications(userId);
      setNotifications(notifs || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    loadNotifications(true);
  }, [userId]);

  const handleNotificationPress = async (notification) => {
    // Mark as read locally first (optimistic update)
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );

    // Mark as read in database
    await markNotificationRead(notification.id);

    // Navigate based on type
    const podId = notification.payload?.pod_id || notification.podId;
    if (podId) {
      if (notification.type === 'pod_ended' && onPodRecap) {
        onPodRecap(podId);
      } else if (onPodLive) {
        onPodLive(podId);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Update in database
    const success = await markAllNotificationsRead(userId);
    if (!success) {
      // Revert on failure
      loadNotifications();
    }
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            // Optimistic update
            setNotifications([]);
            
            // Clear in database
            const success = await clearAllNotifications(userId);
            if (!success) {
              // Revert on failure
              loadNotifications();
            }
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'pod_invite': return '📨';
      case 'pod_vote': return '👍';
      case 'pod_comment': return '💬';
      case 'pod_milestone': return '🎉';
      case 'pod_ended': return '⏰';
      case 'friend_request': return '👋';
      case 'friend_accepted': return '🤝';
      default: return '🔔';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'pod_invite': return ['#6366f1', '#8b5cf6'];
      case 'pod_vote': return ['#22c55e', '#16a34a'];
      case 'pod_comment': return ['#3b82f6', '#2563eb'];
      case 'pod_milestone': return ['#10b981', '#059669'];
      case 'pod_ended': return ['#f59e0b', '#d97706'];
      case 'friend_request': return ['#ec4899', '#db2777'];
      case 'friend_accepted': return ['#8b5cf6', '#7c3aed'];
      default: return ['#6b7280', '#4b5563'];
    }
  };

  const formatTimestamp = (createdAt) => {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationMessage = (notification) => {
    if (notification.message) return notification.message;
    
    const payload = notification.payload || {};
    switch (notification.type) {
      case 'pod_invite':
        return `${payload.inviter_name || 'Someone'} invited you to vote on their pod`;
      case 'pod_vote':
        return `${payload.voter_name || 'Someone'} voted on your pod`;
      case 'pod_comment':
        return `${payload.commenter_name || 'Someone'} commented on your pod`;
      case 'pod_milestone':
        return `Your pod reached ${payload.milestone || 'a milestone'}!`;
      case 'pod_ended':
        return 'Your pod has ended - check out the results!';
      case 'friend_request':
        return `${payload.requester_name || 'Someone'} wants to be friends`;
      case 'friend_accepted':
        return `${payload.friend_name || 'Someone'} accepted your friend request`;
      default:
        return 'You have a new notification';
    }
  };

  const getNotificationTitle = (notification) => {
    if (notification.title) return notification.title;
    
    switch (notification.type) {
      case 'pod_invite': return 'New Pod Invite';
      case 'pod_vote': return 'New Vote';
      case 'pod_comment': return 'New Comment';
      case 'pod_milestone': return 'Milestone Reached! 🎉';
      case 'pod_ended': return 'Pod Ended';
      case 'friend_request': return 'Friend Request';
      case 'friend_accepted': return 'Friend Accepted';
      default: return 'Notification';
    }
  };

  // Swipeable notification card with mark as read action
  const NotificationCard = ({ notification }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const swipeThreshold = -80;
    
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to horizontal swipes
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow left swipe (negative dx)
          if (gestureState.dx < 0) {
            translateX.setValue(Math.max(gestureState.dx, -100));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < swipeThreshold && !notification.read) {
            // Swipe to mark as read
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            // Mark as read
            handleMarkSingleRead(notification);
          } else {
            // Spring back
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      })
    ).current;
    
    // Different colors for read vs unread
    const isRead = notification.read;
    const bgColors = isRead 
      ? ['#374151', '#1f2937'] // Gray for read
      : getNotificationColor(notification.type); // Colorful for unread
    
    return (
      <View style={styles.swipeContainer}>
        {/* Background action indicator */}
        <View style={styles.swipeActionContainer}>
          <View style={styles.swipeAction}>
            <Text style={styles.swipeActionText}>✓ Mark Read</Text>
          </View>
        </View>
        
        {/* Swipeable card */}
        <Animated.View
          style={[{ transform: [{ translateX }] }]}
          {...panResponder.panHandlers}
        >
          <Pressable 
            style={[styles.notificationCard, !isRead && styles.notificationCardUnread]}
            onPress={() => handleNotificationPress(notification)}
          >
            <LinearGradient
              colors={bgColors}
              style={styles.notificationGradient}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationIcon, isRead && { opacity: 0.6 }]}>
                    {getNotificationIcon(notification.type)}
                  </Text>
                  <View style={styles.notificationTextContainer}>
                    <Text style={[styles.notificationTitle, isRead && styles.readText]}>
                      {getNotificationTitle(notification)}
                    </Text>
                    <Text style={[styles.notificationMessage, isRead && styles.readText]}>
                      {getNotificationMessage(notification)}
                    </Text>
                  </View>
                  {!isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={[styles.notificationTime, isRead && { opacity: 0.5 }]}>
                  {formatTimestamp(notification.created_at)}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  const handleMarkSingleRead = async (notification) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
    // Update in database
    await markNotificationRead(notification.id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <Pressable 
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All ({notifications.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
            onPress={() => setActiveTab('unread')}
          >
            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
              Unread ({unreadCount})
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        
        {/* Action Buttons */}
        {notifications.length > 0 && (
          <View style={styles.actionButtons}>
            {unreadCount > 0 && (
              <Pressable 
                style={styles.actionButton}
                onPress={handleMarkAllRead}
              >
                <Text style={styles.actionButtonText}>Mark all read</Text>
              </Pressable>
            )}
            <Pressable 
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={handleClearAll}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>Clear all</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>
              {activeTab === 'unread' ? '✨' : '🔔'}
            </Text>
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {activeTab === 'unread' 
                ? 'You\'ve read all your notifications.' 
                : 'New notifications will appear here when you get invites, votes, or comments.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            renderItem={({ item }) => <NotificationCard notification={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.notificationsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#6366f1"
                colors={['#6366f1']}
              />
            }
          />
        )}
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionButtonText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextDanger: {
    color: '#ef4444',
  },
  content: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationsList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  swipeContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  swipeActionContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  swipeAction: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  notificationCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
  },
  notificationCardUnread: {
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.6)',
  },
  readText: {
    opacity: 0.7,
  },
  notificationGradient: {
    padding: 16,
  },
  notificationContent: {
    flexDirection: 'column',
    gap: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginLeft: 8,
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 36,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default Inbox;
