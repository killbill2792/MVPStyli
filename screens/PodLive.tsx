import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  getPod, 
  getPodVotes, 
  submitVote, 
  getPodComments, 
  addComment, 
  subscribeToPodVotes, 
  expirePod,
  calculateConfidence,
  getVoteCounts,
  Pod,
  PodVote,
  PodComment
} from '../lib/pods';

const { width, height } = Dimensions.get('window');

interface PodLiveProps {
  podId: string;
  onBack: () => void;
  onRecap: (podId: string) => void;
  userId?: string;
}

const PodLive: React.FC<PodLiveProps> = ({ podId, onBack, onRecap, userId }) => {
  const [pod, setPod] = useState<Pod | null>(null);
  const [votes, setVotes] = useState<PodVote[]>([]);
  const [comments, setComments] = useState<PodComment[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    loadPod();
    loadVotes();
    loadComments();
  }, [podId]);

  useEffect(() => {
    if (pod) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const endTime = new Date(pod.ends_at).getTime();
        const remaining = Math.max(0, endTime - now);
        setTimeLeft(remaining);

        if (remaining === 0) {
          handlePodExpire();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [pod]);

  useEffect(() => {
    if (pod) {
      const unsubscribe = subscribeToPodVotes(podId, (newVotes) => {
        setVotes(newVotes);
        checkIfUserVoted(newVotes);
      });

      return unsubscribe;
    }
  }, [podId, userId]);

  const loadPod = async () => {
    const podData = await getPod(podId);
    setPod(podData);
  };

  const loadVotes = async () => {
    const votesData = await getPodVotes(podId);
    setVotes(votesData);
    checkIfUserVoted(votesData);
  };

  const loadComments = async () => {
    if (pod?.audience === 'friends') {
      const commentsData = await getPodComments(podId);
      setComments(commentsData);
    }
  };

  const checkIfUserVoted = (votesData: PodVote[]) => {
    if (userId) {
      const userVote = votesData.find(vote => vote.voter_id === userId);
      setHasVoted(!!userVote);
    }
  };

  const handleVote = async (choice: 'yes' | 'maybe' | 'no') => {
    if (hasVoted) return;

    const success = await submitVote(podId, choice, userId);
    if (success) {
      setHasVoted(true);
      Alert.alert('Thanks for voting!', 'Your vote has been recorded.');
    }
  };

  const handleComment = async () => {
    if (!newComment.trim() || !userId) return;

    setIsSubmittingComment(true);
    const success = await addComment(podId, userId, newComment.trim());
    if (success) {
      setNewComment('');
      loadComments();
    }
    setIsSubmittingComment(false);
  };

  const handlePodExpire = async () => {
    await expirePod(podId);
    Alert.alert('Pod Ended', 'Generating recap...', [
      { text: 'OK', onPress: () => onRecap(podId) }
    ]);
  };

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const confidence = calculateConfidence(votes);
  const voteCounts = getVoteCounts(votes);
  const isTimeRunningOut = timeLeft < 60000; // Last minute

  if (!pod) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading pod...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a2e']}
        style={styles.background}
      >
        {/* Fixed Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Pod Live</Text>
          <Pressable style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, isTimeRunningOut && styles.timerWarning]}>
              {formatTime(timeLeft)}
            </Text>
            <Text style={styles.timerLabel}>Time Remaining</Text>
          </View>

          {/* Main Image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: pod.image_url }} style={styles.mainImage} />
            
            {/* Confidence Overlay */}
            <View style={styles.confidenceOverlay}>
              <Text style={styles.confidenceLabel}>Live Confidence</Text>
              <Text style={styles.confidenceValue}>{confidence}%</Text>
            </View>
          </View>

          {/* Vote Counts */}
          <View style={styles.voteCountsContainer}>
            <View style={styles.voteCountItem}>
              <Text style={styles.voteCountNumber}>{voteCounts.yes}</Text>
              <Text style={styles.voteCountLabel}>🔥 Yes</Text>
            </View>
            <View style={styles.voteCountItem}>
              <Text style={styles.voteCountNumber}>{voteCounts.maybe}</Text>
              <Text style={styles.voteCountLabel}>💯 Maybe</Text>
            </View>
            <View style={styles.voteCountItem}>
              <Text style={styles.voteCountNumber}>{voteCounts.no}</Text>
              <Text style={styles.voteCountLabel}>❌ No</Text>
            </View>
          </View>

          {/* Comments Section (Friends only) */}
          {pod.audience === 'friends' && (
            <View style={styles.commentsSection}>
              <Pressable 
                style={styles.commentsToggle}
                onPress={() => setShowComments(!showComments)}
              >
                <Text style={styles.commentsToggleText}>
                  {showComments ? 'Hide Comments' : 'Show Comments'} ({comments.length})
                </Text>
              </Pressable>

              {showComments && (
                <View style={styles.commentsContainer}>
                  {comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleTimeString()}
                      </Text>
                    </View>
                  ))}

                  {/* Add Comment */}
                  <View style={styles.addCommentContainer}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment..."
                      placeholderTextColor="#6b7280"
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <Pressable 
                      style={styles.commentButton}
                      onPress={handleComment}
                      disabled={isSubmittingComment}
                    >
                      <Text style={styles.commentButtonText}>Post</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Vote Bar */}
        <View style={styles.voteBar}>
          <Pressable 
            style={[styles.voteButton, styles.yesButton, hasVoted && styles.disabledButton]}
            onPress={() => handleVote('yes')}
            disabled={hasVoted}
          >
            <Text style={styles.voteButtonText}>🔥 Yes</Text>
          </Pressable>
          <Pressable 
            style={[styles.voteButton, styles.maybeButton, hasVoted && styles.disabledButton]}
            onPress={() => handleVote('maybe')}
            disabled={hasVoted}
          >
            <Text style={styles.voteButtonText}>💯 Maybe</Text>
          </Pressable>
          <Pressable 
            style={[styles.voteButton, styles.noButton, hasVoted && styles.disabledButton]}
            onPress={() => handleVote('no')}
            disabled={hasVoted}
          >
            <Text style={styles.voteButtonText}>❌ No</Text>
          </Pressable>
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
  shareButton: {
    padding: 8,
  },
  shareButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingTop: 80,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  timerWarning: {
    color: '#ef4444',
  },
  timerLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  mainImage: {
    width: '100%',
    height: height * 0.5,
    borderRadius: 16,
  },
  confidenceOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  voteCountsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  voteCountItem: {
    alignItems: 'center',
  },
  voteCountNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  voteCountLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  commentsSection: {
    marginBottom: 20,
  },
  commentsToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commentsToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  commentsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  commentItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentBody: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  commentTime: {
    color: '#9ca3af',
    fontSize: 12,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
  commentButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  commentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  voteBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#10b981',
  },
  maybeButton: {
    backgroundColor: '#f59e0b',
  },
  noButton: {
    backgroundColor: '#ef4444',
  },
  disabledButton: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PodLive;
