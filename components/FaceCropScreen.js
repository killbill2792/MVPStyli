import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Square crop guide dimensions
const CROP_SIZE = SCREEN_WIDTH * 0.6;
const CROP_X = (SCREEN_WIDTH - CROP_SIZE) / 2;
const CROP_Y = SCREEN_HEIGHT * 0.25;

const clampNum = (n, min, max) => Math.max(min, Math.min(max, n));

const getDistance = (t1, t2) => {
  const dx = t2.pageX - t1.pageX;
  const dy = t2.pageY - t1.pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Clamp translation so that the crop square is always fully inside the image.
 * We compute image rect on screen after scale + translation, and ensure it covers crop rect.
 */
function clampTranslationToCoverCrop({
  scale,
  tx,
  ty,
  displayWidth,
  displayHeight,
  cropRect,
}) {
  const imgW = displayWidth * scale;
  const imgH = displayHeight * scale;

  // Image is centered on screen before transforms
  const baseLeft = (SCREEN_WIDTH - imgW) / 2;
  const baseTop = (SCREEN_HEIGHT - imgH) / 2;

  const cropLeft = cropRect.x;
  const cropTop = cropRect.y;
  const cropRight = cropRect.x + cropRect.w;
  const cropBottom = cropRect.y + cropRect.h;

  // Image rect after translation: [baseLeft + tx, baseTop + ty] to + imgW/imgH
  // We want:
  // (baseLeft + tx) <= cropLeft
  // (baseLeft + tx + imgW) >= cropRight
  // So tx <= cropLeft - baseLeft
  // and tx >= cropRight - baseLeft - imgW
  const maxTx = cropLeft - baseLeft;
  const minTx = cropRight - baseLeft - imgW;

  const maxTy = cropTop - baseTop;
  const minTy = cropBottom - baseTop - imgH;

  return {
    tx: clampNum(tx, minTx, maxTx),
    ty: clampNum(ty, minTy, maxTy),
  };
}

export default function FaceCropScreen({ visible, imageUri, onCropComplete, onCancel }) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);

  // Crop rect (screen coordinates)
  const cropRect = useMemo(
    () => ({ x: CROP_X, y: CROP_Y, w: CROP_SIZE, h: CROP_SIZE }),
    []
  );

  // Animated values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const txAnim = useRef(new Animated.Value(0)).current;
  const tyAnim = useRef(new Animated.Value(0)).current;

  // True source of current transform (do NOT rely on _value)
  const currentScale = useRef(1);
  const currentTx = useRef(0);
  const currentTy = useRef(0);

  // Gesture state refs
  const isPinching = useRef(false);
  const pinchStartDist = useRef(null);
  const pinchStartScale = useRef(1);

  // ✅ These fix your “initialPan doesn’t exist”
  const initialPanX = useRef(0);
  const initialPanY = useRef(0);

  // Display size of the image (contain fit using full screen width)
  const display = useMemo(() => {
    const ar = imageSize.width > 0 ? imageSize.width / imageSize.height : 1;
    const w = SCREEN_WIDTH;
    const h = SCREEN_WIDTH / ar;
    return { w, h };
  }, [imageSize.width, imageSize.height]);

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        setImageSize({ width: w, height: h });

        // Reset transforms when image changes
        currentScale.current = 1;
        currentTx.current = 0;
        currentTy.current = 0;

        scaleAnim.setValue(1);
        txAnim.setValue(0);
        tyAnim.setValue(0);

        isPinching.current = false;
        pinchStartDist.current = null;
      },
      (err) => {
        console.error('🎨 [CROP] Image.getSize error:', err);
      }
    );
  }, [imageUri, scaleAnim, txAnim, tyAnim]);

  // PanResponder
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches || [];

        if (touches.length === 2) {
          isPinching.current = true;
          pinchStartDist.current = getDistance(touches[0], touches[1]);
          pinchStartScale.current = currentScale.current;
        } else {
          isPinching.current = false;
          pinchStartDist.current = null;

          // ✅ Remember start translation for drag
          initialPanX.current = currentTx.current;
          initialPanY.current = currentTy.current;
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches || [];

        // --- PINCH ---
        if (touches.length === 2) {
          if (!isPinching.current) {
            isPinching.current = true;
            pinchStartDist.current = getDistance(touches[0], touches[1]);
            pinchStartScale.current = currentScale.current;
            return;
          }

          const dist = getDistance(touches[0], touches[1]);
          if (!pinchStartDist.current || pinchStartDist.current <= 0) return;

          const ratio = dist / pinchStartDist.current;
          const nextScale = clampNum(pinchStartScale.current * ratio, 1, 5);

          // Clamp translation after scaling so crop stays covered
          const clamped = clampTranslationToCoverCrop({
            scale: nextScale,
            tx: currentTx.current,
            ty: currentTy.current,
            displayWidth: display.w,
            displayHeight: display.h,
            cropRect,
          });

          currentScale.current = nextScale;
          currentTx.current = clamped.tx;
          currentTy.current = clamped.ty;

          scaleAnim.setValue(nextScale);
          txAnim.setValue(clamped.tx);
          tyAnim.setValue(clamped.ty);
          return;
        }

        // --- PAN (one finger) ---
        if (touches.length === 1 && !isPinching.current) {
          // ✅ rawTx/rawTy defined right here
          const rawTx = initialPanX.current + gestureState.dx;
          const rawTy = initialPanY.current + gestureState.dy;

          const clamped = clampTranslationToCoverCrop({
            scale: currentScale.current,
            tx: rawTx,
            ty: rawTy,
            displayWidth: display.w,
            displayHeight: display.h,
            cropRect,
          });

          currentTx.current = clamped.tx;
          currentTy.current = clamped.ty;

          txAnim.setValue(clamped.tx);
          tyAnim.setValue(clamped.ty);
        }
      },

      onPanResponderRelease: () => {
        // When releasing pinch, switch back to pan mode cleanly
        isPinching.current = false;
        pinchStartDist.current = null;

        // Reset pan bases for next drag
        initialPanX.current = currentTx.current;
        initialPanY.current = currentTy.current;
      },

      onPanResponderTerminate: () => {
        isPinching.current = false;
        pinchStartDist.current = null;

        initialPanX.current = currentTx.current;
        initialPanY.current = currentTy.current;
      },
    });
  }, [cropRect, display.h, display.w, scaleAnim, txAnim, tyAnim]);

  const handleCancel = () => onCancel?.();

  const handleCrop = async () => {
    if (!imageUri || imageSize.width === 0) return;

    setLoading(true);
    try {
      const s = currentScale.current;
      const tx = currentTx.current;
      const ty = currentTy.current;

      const scaledW = display.w * s;
      const scaledH = display.h * s;

      // Image top-left on screen after transforms
      const imgLeft = (SCREEN_WIDTH - scaledW) / 2 + tx;
      const imgTop = (SCREEN_HEIGHT - scaledH) / 2 + ty;

      // Crop rect in screen coords
      const cropScreenLeft = cropRect.x;
      const cropScreenTop = cropRect.y;

      // Convert crop rect into "displayed image coords" (before scale to original)
      const cropInDisplayedX = (cropScreenLeft - imgLeft) / s;
      const cropInDisplayedY = (cropScreenTop - imgTop) / s;
      const cropInDisplayedW = cropRect.w / s;
      const cropInDisplayedH = cropRect.h / s;

      // displayed -> original
      const scaleToOriginalX = imageSize.width / display.w;
      const scaleToOriginalY = imageSize.height / display.h;

      let cropX = cropInDisplayedX * scaleToOriginalX;
      let cropY = cropInDisplayedY * scaleToOriginalY;
      let cropW = cropInDisplayedW * scaleToOriginalX;
      let cropH = cropInDisplayedH * scaleToOriginalY;

      // Clamp bounds to original image
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

      console.log('🎨 [FACE CROP] cropInfo:', cropInfo);

      onCropComplete?.({ imageUri, cropInfo });
    } catch (e) {
      console.error('🎨 [FACE CROP] Error:', e);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const animatedStyle = {
    transform: [{ scale: scaleAnim }, { translateX: txAnim }, { translateY: tyAnim }],
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header} pointerEvents="box-none">
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

        <View style={styles.cropContainer} collapsable={false} {...panResponder.panHandlers}>
          {imageSize.width > 0 && (
            <View style={styles.imageStage}>
              <Animated.View style={[styles.animatedWrap, animatedStyle]}>
                <Image source={{ uri: imageUri }} style={{ width: display.w, height: display.h }} resizeMode="contain" />
              </Animated.View>
            </View>
          )}

          {/* Overlay guide */}
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayRow}>
              <View style={styles.overlayLeft} />
              <View style={styles.squareContainer}>
                <View style={styles.squareGuide}>
                  <View style={styles.squareBorder} />
                  <View style={styles.squareInner}>
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
          <Text style={styles.instructionText}>• Face should fill 60–75% of the square</Text>
          <Text style={styles.instructionText}>• Eyes should be in upper 40%</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

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
  cancelButton: { padding: 8 },
  cancelButtonText: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },

  doneButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  doneButtonDisabled: { opacity: 0.5 },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  cropContainer: { flex: 1, position: 'relative' },

  imageStage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  animatedWrap: {},

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
  overlayTop: { height: CROP_Y, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  overlayRow: { flexDirection: 'row', height: CROP_SIZE },
  overlayLeft: { width: CROP_X, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  overlayRight: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' },

  squareContainer: { width: CROP_SIZE, height: CROP_SIZE, justifyContent: 'center', alignItems: 'center' },
  squareGuide: { width: CROP_SIZE, height: CROP_SIZE, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  squareBorder: { position: 'absolute', width: CROP_SIZE, height: CROP_SIZE, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },

  squareInner: { alignItems: 'center', top: '40%' },
  guideLine: { width: 2, height: 20, backgroundColor: '#fff', marginBottom: 8 },
  guideText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  guideSubtext: { color: '#ccc', fontSize: 12, textAlign: 'center', marginTop: 4 },

  instructions: { padding: 20, backgroundColor: '#111' },
  instructionText: { color: '#999', fontSize: 12, marginBottom: 4 },

  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 50 },
  button: { backgroundColor: '#6366f1', padding: 15, borderRadius: 8, marginTop: 20, alignSelf: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});