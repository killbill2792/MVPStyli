import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Oval crop guide dimensions
const OVAL_WIDTH = SCREEN_WIDTH * 0.75;
const OVAL_HEIGHT = OVAL_WIDTH * 1.2; // Slightly taller for face
const OVAL_X = (SCREEN_WIDTH - OVAL_WIDTH) / 2;
const OVAL_Y = SCREEN_HEIGHT * 0.25; // Position in upper portion

const clampNum = (n, min, max) => Math.max(min, Math.min(max, n));

function clampTranslationToCoverCrop({ scale, tx, ty, displayWidth, displayHeight, crop }) {
  // image is centered on screen before transforms
  const imgW = displayWidth * scale;
  const imgH = displayHeight * scale;

  const imgLeft0 = (SCREEN_WIDTH - imgW) / 2;
  const imgTop0 = (SCREEN_HEIGHT - imgH) / 2;

  // Ensure crop rect is fully inside the image after translation
  const minTx = (crop.x + crop.w) - (imgLeft0 + imgW);
  const maxTx = crop.x - imgLeft0;

  const minTy = (crop.y + crop.h) - (imgTop0 + imgH);
  const maxTy = crop.y - imgTop0;

  return {
    tx: clampNum(tx, minTx, maxTx),
    ty: clampNum(ty, minTy, maxTy),
  };
}

export default function FaceCropScreen({ visible, imageUri, onCropComplete, onCancel }) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);

  // Animated values using Reanimated (more reliable than Animated API)
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Refs to hold current transform values (for crop calculation)
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        console.log('🎨 [CROP] Image size loaded:', w, h);
        setImageSize({ width: w, height: h });

        // Reset transforms when a new image loads
        lastScale.current = 1;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
      },
      (err) => {
        console.error('🎨 [CROP] Error loading image size:', err);
      }
    );
  }, [imageUri]);

  const imageAspectRatio = imageSize.width > 0 ? imageSize.width / imageSize.height : 1;
  const displayWidth = SCREEN_WIDTH;
  const displayHeight = SCREEN_WIDTH / imageAspectRatio;

  const cropRect = { x: OVAL_X, y: OVAL_Y, w: OVAL_WIDTH, h: OVAL_HEIGHT };

  // Gesture handlers using react-native-gesture-handler (more reliable than PanResponder)
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      // Store current scale as base
      lastScale.current = scale.value;
    })
    .onUpdate((e) => {
      const newScale = clampNum(lastScale.current * e.scale, 1, 5);
      scale.value = newScale;
      lastScale.current = newScale;

      // Clamp translation so crop rect stays covered after zoom
      const clamped = clampTranslationToCoverCrop({
        scale: newScale,
        tx: translateX.value,
        ty: translateY.value,
        displayWidth,
        displayHeight,
        crop: cropRect,
      });

      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
      lastTranslateX.current = clamped.tx;
      lastTranslateY.current = clamped.ty;
    })
    .onEnd(() => {
      // Update lastScale for next gesture
      lastScale.current = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      // Store current translation as base
      lastTranslateX.current = translateX.value;
      lastTranslateY.current = translateY.value;
    })
    .onUpdate((e) => {
      const rawTx = lastTranslateX.current + e.translationX;
      const rawTy = lastTranslateY.current + e.translationY;

      const clamped = clampTranslationToCoverCrop({
        scale: scale.value,
        tx: rawTx,
        ty: rawTy,
        displayWidth,
        displayHeight,
        crop: cropRect,
      });

      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
    })
    .onEnd(() => {
      // Update last values for next gesture
      lastTranslateX.current = translateX.value;
      lastTranslateY.current = translateY.value;
    });

  // Combine gestures - pinch and pan can work simultaneously
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style for the image
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });
  const handleCrop = async () => {
    if (!imageUri || imageSize.width === 0) return;

    setLoading(true);
    try {
      const currentScale = scale.value;
      const currentX = translateX.value;
      const currentY = translateY.value;

      // Map crop rect (screen) -> image coordinates.
      // We treat the displayed image (contain) as centered, then apply our transforms.
      const scaledW = displayWidth * currentScale;
      const scaledH = displayHeight * currentScale;

      const imgLeft = (SCREEN_WIDTH - scaledW) / 2 + currentX;
      const imgTop = (SCREEN_HEIGHT - scaledH) / 2 + currentY;

      // Crop rect in screen coords:
      const cropScreenLeft = OVAL_X;
      const cropScreenTop = OVAL_Y;

      // Convert crop rect to coordinates in the displayed image pixels (not original image yet):
      const cropInDisplayedX = (cropScreenLeft - imgLeft) / currentScale;
      const cropInDisplayedY = (cropScreenTop - imgTop) / currentScale;
      const cropInDisplayedW = OVAL_WIDTH / currentScale;
      const cropInDisplayedH = OVAL_HEIGHT / currentScale;

      // displayed image pixels map to original image pixels by ratio:
      const scaleToOriginalX = imageSize.width / displayWidth;
      const scaleToOriginalY = imageSize.height / displayHeight;

      let cropX = cropInDisplayedX * scaleToOriginalX;
      let cropY = cropInDisplayedY * scaleToOriginalY;
      let cropW = cropInDisplayedW * scaleToOriginalX;
      let cropH = cropInDisplayedH * scaleToOriginalY;

      // Clamp to original image bounds
      cropW = Math.max(1, Math.min(imageSize.width, cropW));
      cropH = Math.max(1, Math.min(imageSize.height, cropH));
      cropX = clampNum(cropX, 0, imageSize.width - cropW);
      cropY = clampNum(cropY, 0, imageSize.height - cropH);

      const cropInfo = {
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
      };

      console.log('🎨 [FACE CROP] Final cropInfo:', cropInfo);

      if (onCropComplete) {
        onCropComplete({ imageUri, cropInfo });
      }
    } catch (error) {
      console.error('🎨 [FACE CROP] Error:', error);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  if (!imageUri) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>No image provided</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.button}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Position Your Face</Text>

          <TouchableOpacity
            onPress={handleCrop}
            style={[styles.doneButton, (loading || imageSize.width === 0) && styles.doneButtonDisabled]}
            disabled={loading || imageSize.width === 0}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.doneButtonText}>Done</Text>}
          </TouchableOpacity>
        </View>

         <View style={styles.cropContainer} collapsable={false} pointerEvents="auto">
          {imageSize.width > 0 && (
            <GestureDetector gesture={composedGesture}>
              <View style={styles.imageStage} pointerEvents="box-none">
                <Animated.View style={[styles.animatedWrap, animatedStyle]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: displayWidth, height: displayHeight }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>
            </GestureDetector>
          )}

          {/* Oval overlay guide */}
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayRow}>
              <View style={styles.overlayLeft} />
              <View style={styles.ovalContainer}>
                <View style={styles.ovalGuide}>
                  <View style={styles.ovalBorder} />
                  <View style={styles.ovalInner}>
                    <View style={styles.guideLine} />
                    <Text style={styles.guideText}>Position face here</Text>
                    <Text style={styles.guideSubtext}>Include forehead and cheeks</Text>
                  </View>
                </View>
              </View>
              <View style={styles.overlayRight} />
            </View>
            <View style={styles.overlayBottom} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>• Pinch to zoom in/out</Text>
          <Text style={styles.instructionText}>• Drag to position your face</Text>
          <Text style={styles.instructionText}>• Face should fill 60–75% of the oval</Text>
          <Text style={styles.instructionText}>• Eyes should be in upper 40%</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

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
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    zIndex: 100,
    backgroundColor: '#000',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  cropContainer: {
    flex: 1,
    position: 'relative',
  },

  // Stage that centers image before transforms
  imageStage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  animatedWrap: {
    // no pointer events here; parent handles gestures
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
  overlayTop: {
    height: OVAL_Y,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayRow: {
    flexDirection: 'row',
    height: OVAL_HEIGHT,
  },
  overlayLeft: {
    width: OVAL_X,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayRight: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  ovalContainer: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ovalBorder: {
    position: 'absolute',
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  ovalInner: {
    alignItems: 'center',
    top: '40%',
  },
  guideLine: {
    width: 2,
    height: 20,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  guideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  guideSubtext: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  instructions: {
    padding: 20,
    backgroundColor: '#111',
  },
  instructionText: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },

  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});