import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';

interface Notification {
  id: string;
  type: 'invite' | 'milestone' | 'expired';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  podId?: string;
}

interface InboxProps {
  onBack: () => void;
  onPodLive?: (podId: string) => void;
  onPodRecap?: (podId: string) => void;
  userId?: string;
}

const Inbox: React.FC<InboxProps> = ({ onBack, onPodLive, onPodRecap, userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = () => {
    // Mock notifications for now
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'invite',
        title: 'New Pod Invite',
        message: 'You\'ve been invited to vote on a friend\'s look',
        timestamp: '2 hours ago',
        read: false,
        podId: 'pod-123',
      },
      {
        id: '2',
        type: 'milestone',
        title: 'Pod Milestone Reached!',
        message: 'Your pod reached 70% confidence - great job!',
        timestamp: '1 day ago',
        read: true,
        podId: 'pod-456',
      },
      {
        id: '3',
        type: 'expired',
        title: 'Pod Ended',
        message: 'Your pod has ended - check out the recap',
        timestamp: '2 days ago',
        read: false,
        podId: 'pod-789',
      },
    ];
    setNotifications(mockNotifications);
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );

    // Navigate based on type
    if (notification.podId) {
      if (notification.type === 'expired' && onPodRecap) {
        onPodRecap(notification.podId);
      } else if (onPodLive) {
        onPodLive(notification.podId);
      }
    }
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'invite': return '📨';
      case 'milestone': return '🎉';
      case 'expired': return '⏰';
      default: return '🔔';
    }
  };

  const getNotificationColor = (type: string): [string, string] => {
    switch (type) {
      case 'invite': return ['#6366f1', '#8b5cf6'];
      case 'milestone': return ['#10b981', '#059669'];
      case 'expired': return ['#f59e0b', '#d97706'];
      default: return ['#6b7280', '#4b5563'];
    }
  };

  const NotificationCard = ({ notification }: { notification: Notification }) => (
    <Pressable 
      style={styles.notificationCard}
      onPress={() => handleNotificationPress(notification)}
    >
      <LinearGradient
        colors={getNotificationColor(notification.type)}
        style={styles.notificationGradient}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationIcon}>
              {getNotificationIcon(notification.type)}
            </Text>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
            </View>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationTime}>{notification.timestamp}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a2e']}
        style={styles.background}
      >
        {/* Unified Header */}
        <Header 
          title="Inbox" 
          onBack={onBack}
          rightAction={
            unreadCount > 0 ? (
              <View style={{
                backgroundColor: '#ef4444',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 6
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{unreadCount}</Text>
              </View>
            ) : undefined
          }
          backgroundColor="rgba(0, 0, 0, 0.8)"
        />

        <View style={[styles.content, { paddingBottom: 100 }]}>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No notifications</Text>
              <Text style={styles.emptyStateSubtitle}>
                You're all caught up! New notifications will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={({ item }) => <NotificationCard notification={item} />}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.notificationsList}
            />
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  backButton: {
    padding: 8,
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
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 80,
  },
  notificationsList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  notificationGradient: {
    padding: 16,
  },
  notificationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginLeft: 8,
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default Inbox;
