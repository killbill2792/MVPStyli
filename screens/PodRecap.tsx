import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  getPod, 
  getPodVotes, 
  getPodComments,
  calculateConfidence,
  getVoteCounts,
  Pod,
  PodVote,
  PodComment
} from '../lib/pods';

const { width, height } = Dimensions.get('window');

interface PodRecapProps {
  podId: string;
  onBack: () => void;
  onStyleCraft: () => void;
  onShopSimilar: () => void;
}

const PodRecap: React.FC<PodRecapProps> = ({ podId, onBack, onStyleCraft, onShopSimilar }) => {
  const [pod, setPod] = useState<Pod | null>(null);
  const [votes, setVotes] = useState<PodVote[]>([]);
  const [comments, setComments] = useState<PodComment[]>([]);

  useEffect(() => {
    loadPodData();
  }, [podId]);

  const loadPodData = async () => {
    const [podData, votesData, commentsData] = await Promise.all([
      getPod(podId),
      getPodVotes(podId),
      getPodComments(podId)
    ]);
    
    setPod(podData);
    setVotes(votesData);
    setComments(commentsData);
  };

  const getAISummary = (confidence: number, voteCounts: any): string => {
    if (confidence >= 70) {
      return `Go for it! Your look got ${confidence}% positive feedback. This style clearly resonates with your audience.`;
    } else if (confidence >= 50) {
      return `Mixed signals with ${confidence}% confidence. Consider tweaking the styling or trying a different approach.`;
    } else {
      return `This look needs work - only ${confidence}% positive feedback. Try a different style or get more specific feedback.`;
    }
  };

  const getRecommendations = (confidence: number): string[] => {
    if (confidence >= 70) {
      return [
        'Add this to your favorites',
        'Share your success story',
        'Try similar styles in different colors'
      ];
    } else if (confidence >= 50) {
      return [
        'Get detailed feedback from friends',
        'Try a different color palette',
        'Experiment with accessories'
      ];
    } else {
      return [
        'Start fresh with a new look',
        'Get inspiration from trending styles',
        'Ask for specific styling tips'
      ];
    }
  };

  if (!pod) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading recap...</Text>
      </View>
    );
  }

  const confidence = calculateConfidence(votes);
  const voteCounts = getVoteCounts(votes);
  const aiSummary = getAISummary(confidence, voteCounts);
  const recommendations = getRecommendations(confidence);

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
          <Text style={styles.headerTitle}>Pod Recap</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Final Results */}
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Final Results</Text>
            
            {/* Confidence Score */}
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceValue}>{confidence}%</Text>
              <Text style={styles.confidenceLabel}>Confidence Score</Text>
            </View>

            {/* Vote Breakdown */}
            <View style={styles.voteBreakdown}>
              <View style={styles.voteItem}>
                <Text style={styles.voteEmoji}>🔥</Text>
                <Text style={styles.voteNumber}>{voteCounts.yes}</Text>
                <Text style={styles.voteLabel}>Yes</Text>
              </View>
              <View style={styles.voteItem}>
                <Text style={styles.voteEmoji}>💯</Text>
                <Text style={styles.voteNumber}>{voteCounts.maybe}</Text>
                <Text style={styles.voteLabel}>Maybe</Text>
              </View>
              <View style={styles.voteItem}>
                <Text style={styles.voteEmoji}>❌</Text>
                <Text style={styles.voteNumber}>{voteCounts.no}</Text>
                <Text style={styles.voteLabel}>No</Text>
              </View>
            </View>
          </View>

          {/* Main Image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: pod.image_url }} style={styles.mainImage} />
          </View>

          {/* AI Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>AI Summary</Text>
            <Text style={styles.summaryText}>{aiSummary}</Text>
          </View>

          {/* Recommendations */}
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Next Steps</Text>
            {recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationBullet}>•</Text>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>

          {/* Top Comments (Friends only) */}
          {pod.audience === 'friends' && comments.length > 0 && (
            <View style={styles.commentsContainer}>
              <Text style={styles.commentsTitle}>Top Comments</Text>
              {comments.slice(0, 3).map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <Text style={styles.commentText}>"{comment.body}"</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Pressable style={styles.actionButton} onPress={onStyleCraft}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.actionGradient}
              >
                <Text style={styles.actionButtonText}>Ask Tailors in StyleCraft</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={onShopSimilar}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.actionGradient}
              >
                <Text style={styles.actionButtonText}>Shop Similar</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Share Recap</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  resultsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  confidenceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confidenceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 16,
    color: '#9ca3af',
  },
  voteBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  voteItem: {
    alignItems: 'center',
  },
  voteEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  voteNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  voteLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  imageContainer: {
    marginBottom: 30,
  },
  mainImage: {
    width: '100%',
    height: height * 0.4,
    borderRadius: 16,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 24,
  },
  recommendationsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#6366f1',
    marginRight: 12,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 16,
    color: '#e5e7eb',
    flex: 1,
    lineHeight: 22,
  },
  commentsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  commentItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentText: {
    fontSize: 16,
    color: '#e5e7eb',
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  shareButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PodRecap;
