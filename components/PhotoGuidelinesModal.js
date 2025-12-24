import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';

const PhotoGuidelinesModal = ({ visible, type, onClose, onContinue }) => {
  const isBodyPhoto = type === 'body';
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Title */}
            <Text style={styles.title}>
              {isBodyPhoto ? 'Get the best try-on results' : 'Find your best colors'}
            </Text>

            {/* Short explanation */}
            <Text style={styles.explanation}>
              {isBodyPhoto 
                ? 'Stylit uses your body photo to understand fit, proportions, and how clothes fall on you.'
                : 'We analyze your face photo to understand undertone, contrast, and color harmony.'}
            </Text>

            {/* Works best section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✅ Works best if:</Text>
              {isBodyPhoto ? (
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Full body or waist-up photo</Text>
                  <Text style={styles.bulletPoint}>• Neutral pose (standing straight)</Text>
                  <Text style={styles.bulletPoint}>• Fitted clothing (tee, tank, jeans, leggings)</Text>
                  <Text style={styles.bulletPoint}>• Good lighting, plain background</Text>
                </View>
              ) : (
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Clear face photo</Text>
                  <Text style={styles.bulletPoint}>• Natural light</Text>
                  <Text style={styles.bulletPoint}>• No heavy makeup</Text>
                  <Text style={styles.bulletPoint}>• Neutral expression</Text>
                </View>
              )}
            </View>

            {/* Avoid section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ Avoid:</Text>
              {isBodyPhoto ? (
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Nude or underwear-only photos</Text>
                  <Text style={styles.bulletPoint}>• Very loose outfits (oversized hoodies, blankets)</Text>
                  <Text style={styles.bulletPoint}>• Cropped or mirror selfies</Text>
                  <Text style={styles.bulletPoint}>• Group photos</Text>
                  <Text style={styles.bulletPoint}>• Heavy filters or extreme angles</Text>
                </View>
              ) : (
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Sunglasses or hats</Text>
                  <Text style={styles.bulletPoint}>• Strong filters</Text>
                  <Text style={styles.bulletPoint}>• Low-light photos</Text>
                </View>
              )}
            </View>

            {/* Reassurance / Fun payoff */}
            <Text style={styles.reassurance}>
              {isBodyPhoto 
                ? "Your photo is used only for AI processing. You're always in control."
                : 'This helps us suggest colors that actually suit you — not trends.'}
            </Text>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable 
              style={styles.continueButton}
              onPress={onContinue}
            >
              <Text style={styles.continueButtonText}>Got it — Upload</Text>
            </Pressable>
            <Pressable 
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    minHeight: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 28,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  explanation: {
    fontSize: 16,
    color: '#d1d5db',
    lineHeight: 24,
    marginBottom: 28,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 14,
  },
  bulletList: {
    marginLeft: 8,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 24,
    marginBottom: 10,
  },
  reassurance: {
    fontSize: 15,
    color: '#9ca3af',
    lineHeight: 22,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  buttonContainer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a1a',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default PhotoGuidelinesModal;

