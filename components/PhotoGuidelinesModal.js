import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Image,
  Dimensions,
  Linking,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_WIDTH = (SCREEN_WIDTH - 64) / 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.35;

const PhotoGuidelinesModal = ({ visible, type, onClose, onContinue }) => {
  const isBodyPhoto = type === 'body';
  
  // Image assets
  const bodyGood1 = require('../assets/guidelines/body_good_1.png');
  const bodyGood2 = require('../assets/guidelines/body_good_2.png');
  const bodyBad1 = require('../assets/guidelines/body_bad_1.png');
  const bodyBad2 = require('../assets/guidelines/body_bad_2.png');
  const faceGood = require('../assets/guidelines/face_good.png');
  const faceBad = require('../assets/guidelines/face_bad.png');

  // Good/bad tips for each type
  const bodyGoodTips = ['Full body', 'Neutral pose', 'Fitted clothes'];
  const bodyBadTips = ['Baggy clothes', 'Mirror selfie', 'Cropped'];
  const faceGoodTips = ['Clear face', 'Natural light'];
  const faceBadTips = ['Sunglasses', 'Hats', 'Filters'];

  const goodTips = isBodyPhoto ? bodyGoodTips : faceGoodTips;
  const badTips = isBodyPhoto ? bodyBadTips : faceBadTips;


  // Tag chip component
  const TagChip = ({ label, isGood }) => (
    <View style={[styles.tagChip, isGood ? styles.goodChip : styles.badChip]}>
      <Text style={[styles.tagChipIcon, isGood ? styles.goodChipIcon : styles.badChipIcon]}>
        {isGood ? '✓' : '✕'}
      </Text>
      <Text style={[styles.tagChipText, isGood ? styles.goodChipText : styles.badChipText]}>
        {label}
      </Text>
    </View>
  );

  const openPrivacy = () => Linking.openURL('https://stylit.ai/privacy.html');
  const openTerms = () => Linking.openURL('https://stylit.ai/terms.html');
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onContinue} // Use onContinue instead of onClose since we removed X button
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* No X close button - Apple guideline compliance */}

          {/* Title */}
          <Text style={styles.title}>
            {isBodyPhoto ? 'Upload a Body Photo' : 'Upload a Face Photo'}
          </Text>

          {/* Good Examples Section */}
          <View style={styles.section}>
            <Text style={styles.goodTitle}>✓ What works best</Text>
            
            <View style={[styles.imageRow, !isBodyPhoto && styles.imageRowCentered]}>
              {isBodyPhoto ? (
                <>
                  <View style={[styles.imageContainer, styles.goodImageContainer]}>
                    <Image source={bodyGood1} style={styles.guideImage} resizeMode="cover" />
                  </View>
                  <View style={[styles.imageContainer, styles.goodImageContainer]}>
                    <Image source={bodyGood2} style={styles.guideImage} resizeMode="cover" />
                  </View>
                </>
              ) : (
                <View style={[styles.singleImageContainer, styles.goodImageContainer]}>
                  <Image source={faceGood} style={styles.guideImageSingle} resizeMode="cover" />
                </View>
              )}
            </View>
            
            <View style={styles.tagsContainer}>
              {goodTips.map((tip, index) => (
                <TagChip key={index} label={tip} isGood={true} />
              ))}
            </View>
          </View>

          {/* Bad Examples Section */}
          <View style={styles.section}>
            <Text style={styles.badTitle}>✕ Avoid</Text>
            
            <View style={[styles.imageRow, !isBodyPhoto && styles.imageRowCentered]}>
              {isBodyPhoto ? (
                <>
                  <View style={[styles.imageContainer, styles.badImageContainer]}>
                    <Image source={bodyBad1} style={styles.guideImage} resizeMode="cover" />
                  </View>
                  <View style={[styles.imageContainer, styles.badImageContainer]}>
                    <Image source={bodyBad2} style={styles.guideImage} resizeMode="cover" />
                  </View>
                </>
              ) : (
                <View style={[styles.singleImageContainer, styles.badImageContainer]}>
                  <Image source={faceBad} style={styles.guideImageSingle} resizeMode="cover" />
                </View>
              )}
            </View>
            
            <View style={styles.tagsContainer}>
              {badTips.map((tip, index) => (
                <TagChip key={index} label={tip} isGood={false} />
              ))}
            </View>
          </View>

          {/* Body photo warning */}
          {isBodyPhoto && (
            <View style={styles.warningContainer}>
              <View style={styles.warningTags}>
                <View style={styles.warningChip}><Text style={styles.warningChipText}>No bikini</Text></View>
                <View style={styles.warningChip}><Text style={styles.warningChipText}>No nudes</Text></View>
                <View style={styles.warningChip}><Text style={styles.warningChipText}>No lingerie</Text></View>
              </View>
            </View>
          )}

          {/* Privacy note - simplified */}
          <Text style={styles.privacyNote}>
            Your photos are processed securely.{' '}
            <Text style={styles.privacyLink} onPress={openPrivacy}>Privacy Policy</Text>
            {' '}•{' '}
            <Text style={styles.privacyLink} onPress={openTerms}>Terms</Text>
          </Text>

          {/* Continue Button - Single button as per Apple guidelines */}
          <Pressable style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  goodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 10,
    textAlign: 'center',
  },
  badTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 10,
    textAlign: 'center',
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  imageRowCentered: {
    justifyContent: 'center',
  },
  imageContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  singleImageContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  goodImageContainer: {
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  badImageContainer: {
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  guideImage: {
    width: '100%',
    height: '100%',
  },
  guideImageSingle: {
    width: '100%',
    height: '100%',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  goodChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  badChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  tagChipIcon: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 5,
  },
  goodChipIcon: {
    color: '#22c55e',
  },
  badChipIcon: {
    color: '#ef4444',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  goodChipText: {
    color: '#22c55e',
  },
  badChipText: {
    color: '#ef4444',
  },
  warningContainer: {
    marginBottom: 12,
  },
  warningTags: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  warningChip: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  warningChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fbbf24',
  },
  privacyNote: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  privacyLink: {
    color: '#818cf8',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PhotoGuidelinesModal;
