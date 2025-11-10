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
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { Spacing } from '../lib/designSystem';
import { 
  getUserActivePods, 
  getUserPastPods, 
  getUserInvites,
  acceptInvite,
  declineInvite,
  calculateConfidence,
  getVoteCounts,
  Pod,
  PodInvite
} from '../lib/pods';

const { width, height } = Dimensions.get('window');

interface PodsHomeProps {
  onBack: () => void;
  onPodLive: (podId: string) => void;
  onPodRecap: (podId: string) => void;
  onInbox: () => void;
  onCreatePod: () => void;
  userId?: string;
  userEmail?: string;
}

const PodsHome: React.FC<PodsHomeProps> = ({ 
  onBack, 
  onPodLive, 
  onPodRecap, 
  onInbox, 
  onCreatePod,
  userId, 
  userEmail 
}) => {
  const insets = useSafeAreaInsets();
  const [activePods, setActivePods] = useState<Pod[]>([]);
  const [pastPods, setPastPods] = useState<Pod[]>([]);
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'invites' | 'past'>('active');

  useEffect(() => {
    loadPodsData();
  }, [userId, userEmail]);

  const loadPodsData = async () => {
    if (userId) {
      const [active, past] = await Promise.all([
        getUserActivePods(userId),
        getUserPastPods(userId)
      ]);
      setActivePods(active);
      setPastPods(past);
    }

    if (userEmail) {
      const userInvites = await getUserInvites(userEmail);
      setInvites(userInvites);
    }
  };

  const handleAcceptInvite = async (inviteId: string, podId: string) => {
    const success = await acceptInvite(inviteId);
    if (success) {
      loadPodsData();
      onPodLive(podId);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    const success = await declineInvite(inviteId);
    if (success) {
      loadPodsData();
    }
  };

  const formatTimeLeft = (endsAt: string): string => {
    const now = new Date().getTime();
    const endTime = new Date(endsAt).getTime();
    const remaining = Math.max(0, endTime - now);
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const ActivePodCard = ({ pod }: { pod: Pod }) => (
    <Pressable style={styles.podCard} onPress={() => onPodLive(pod.id)}>
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
        style={styles.podCardGradient}
      >
        <Image source={{ uri: pod.image_url }} style={styles.podCardImage} />
        <View style={styles.podCardContent}>
          <Text style={styles.podCardTitle}>{pod.title}</Text>
          <Text style={styles.podCardTime}>Ends in {formatTimeLeft(pod.ends_at)}</Text>
          <Text style={styles.podCardAudience}>{pod.audience.replace('_', ' ')}</Text>
        </View>
        <View style={styles.podCardBadge}>
          <Text style={styles.podCardBadgeText}>LIVE</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );

  const PastPodCard = ({ pod }: { pod: Pod }) => (
    <Pressable style={styles.podCard} onPress={() => onPodRecap(pod.id)}>
      <LinearGradient
        colors={['rgba(107, 114, 128, 0.2)', 'rgba(107, 114, 128, 0.1)']}
        style={styles.podCardGradient}
      >
        <Image source={{ uri: pod.image_url }} style={styles.podCardImage} />
        <View style={styles.podCardContent}>
          <Text style={styles.podCardTitle}>{pod.title}</Text>
          <Text style={styles.podCardDate}>
            {new Date(pod.created_at).toLocaleDateString()}
          </Text>
          <Text style={styles.podCardAudience}>{pod.audience.replace('_', ' ')}</Text>
        </View>
        <View style={styles.podCardBadge}>
          <Text style={styles.podCardBadgeText}>RECAP</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );

  const InviteCard = ({ invite }: { invite: PodInvite }) => (
    <View style={styles.inviteCard}>
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.1)']}
        style={styles.inviteCardGradient}
      >
        <View style={styles.inviteCardContent}>
          <Text style={styles.inviteCardTitle}>Pod Invite</Text>
          <Text style={styles.inviteCardText}>
            You've been invited to vote on a look
          </Text>
          <Text style={styles.inviteCardTime}>
            {new Date(invite.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.inviteCardActions}>
          <Pressable 
            style={styles.acceptButton}
            onPress={() => handleAcceptInvite(invite.id, invite.pod_id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </Pressable>
          <Pressable 
            style={styles.declineButton}
            onPress={() => handleDeclineInvite(invite.id)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );

  const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'active':
        if (activePods.length === 0) {
          return <EmptyState title="No live pods yet" subtitle="Start one from Try-On" />;
        }
        return (
          <FlatList
            data={activePods}
            renderItem={({ item }) => <ActivePodCard pod={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        );
      
      case 'invites':
        if (invites.length === 0) {
          return <EmptyState title="No invites right now" subtitle="Check back later" />;
        }
        return (
          <FlatList
            data={invites}
            renderItem={({ item }) => <InviteCard invite={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        );
      
      case 'past':
        if (pastPods.length === 0) {
          return <EmptyState title="Run a pod to see recaps here" subtitle="Start from Try-On" />;
        }
        return (
          <FlatList
            data={pastPods}
            renderItem={({ item }) => <PastPodCard pod={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a2e']}
        style={styles.background}
      >
        {/* Unified Header */}
        <Header
          title="Pods"
          rightAction={
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Pressable style={styles.createPodButton} onPress={onCreatePod}>
                <Text style={styles.createPodButtonText}>+</Text>
              </Pressable>
              <Pressable style={styles.inboxButton} onPress={onInbox}>
                <Text style={styles.inboxButtonText}>🔔</Text>
              </Pressable>
            </View>
          }
          backgroundColor="rgba(0, 0, 0, 0.8)"
        />

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Pressable 
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active ({activePods.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'invites' && styles.activeTab]}
            onPress={() => setActiveTab('invites')}
          >
            <Text style={[styles.tabText, activeTab === 'invites' && styles.activeTabText]}>
              Invites ({invites.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'past' && styles.activeTab]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
              Past ({pastPods.length})
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createPodButton: {
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPodButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  inboxButton: {
    padding: 8,
  },
  inboxButtonText: {
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 80, // Space for nav bar
  },
  podCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  podCardGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  podCardImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  podCardContent: {
    flex: 1,
  },
  podCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  podCardTime: {
    fontSize: 14,
    color: '#10b981',
    marginBottom: 4,
  },
  podCardDate: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  podCardAudience: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  podCardBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  podCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  inviteCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inviteCardGradient: {
    padding: 16,
  },
  inviteCardContent: {
    marginBottom: 16,
  },
  inviteCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  inviteCardText: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 8,
  },
  inviteCardTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  inviteCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default PodsHome;
