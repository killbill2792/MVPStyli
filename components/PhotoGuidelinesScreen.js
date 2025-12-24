import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';

const PhotoGuidelinesScreen = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Photo Upload Guidelines</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Body Photo Section */}
            <View style={styles.guidelineSection}>
              <Text style={styles.sectionTitle}>🧍‍♀️ Body Photo Guidelines (AI Try-On)</Text>
              
              <Text style={styles.subtitle}>Get the best try-on results</Text>
              
              <Text style={styles.explanation}>
                Stylit uses your body photo to understand fit, proportions, and how clothes fall on you.
              </Text>

              <View style={styles.bulletSection}>
                <Text style={styles.bulletTitle}>✅ Works best if:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Full body or waist-up photo</Text>
                  <Text style={styles.bulletPoint}>• Neutral pose (standing straight)</Text>
                  <Text style={styles.bulletPoint}>• Fitted clothing (tee, tank, jeans, leggings)</Text>
                  <Text style={styles.bulletPoint}>• Good lighting, plain background</Text>
                </View>
              </View>

              <View style={styles.bulletSection}>
                <Text style={styles.bulletTitle}>⚠️ Avoid:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Nude or underwear-only photos</Text>
                  <Text style={styles.bulletPoint}>• Very loose outfits (oversized hoodies, blankets)</Text>
                  <Text style={styles.bulletPoint}>• Cropped or mirror selfies</Text>
                  <Text style={styles.bulletPoint}>• Group photos</Text>
                  <Text style={styles.bulletPoint}>• Heavy filters or extreme angles</Text>
                </View>
              </View>

              <Text style={styles.reassurance}>
                Your photo is used only for AI processing. You're always in control.
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Face Photo Section */}
            <View style={styles.guidelineSection}>
              <Text style={styles.sectionTitle}>😊 Face Photo Guidelines (Color Analysis)</Text>
              
              <Text style={styles.subtitle}>Find your best colors</Text>
              
              <Text style={styles.explanation}>
                We analyze your face photo to understand undertone, contrast, and color harmony.
              </Text>

              <View style={styles.bulletSection}>
                <Text style={styles.bulletTitle}>✅ Works best if:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Clear face photo</Text>
                  <Text style={styles.bulletPoint}>• Natural light</Text>
                  <Text style={styles.bulletPoint}>• No heavy makeup</Text>
                  <Text style={styles.bulletPoint}>• Neutral expression</Text>
                </View>
              </View>

              <View style={styles.bulletSection}>
                <Text style={styles.bulletTitle}>⚠️ Avoid:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• Sunglasses or hats</Text>
                  <Text style={styles.bulletPoint}>• Strong filters</Text>
                  <Text style={styles.bulletPoint}>• Low-light photos</Text>
                </View>
              </View>

              <Text style={styles.funPayoff}>
                This helps us suggest colors that actually suit you — not trends.
              </Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <View style={styles.buttonContainer}>
            <Pressable 
              style={styles.closeButtonBottom}
              onPress={onClose}
            >
              <Text style={styles.closeButtonBottomText}>Close</Text>
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  guidelineSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  explanation: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 16,
  },
  bulletSection: {
    marginBottom: 16,
  },
  bulletTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  bulletList: {
    marginLeft: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
    marginBottom: 4,
  },
  reassurance: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
  },
  funPayoff: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 24,
  },
  buttonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonBottom: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonBottomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PhotoGuidelinesScreen;

