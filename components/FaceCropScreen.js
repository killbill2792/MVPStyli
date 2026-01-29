import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants
const MIN_CROP_SIZE = 80;
const HANDLE_HIT_AREA = 44; // Touch target size for corner handles
const HANDLE_VISUAL_SIZE = 24; // Visual size of corner handles

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export default function FaceCropScreen({ visible, imageUri, onCropComplete, onCancel }) {
  // Debug logging
  console.log('📸 [FaceCropScreen] Props:', { visible, imageUri: imageUri ? 'SET' : 'null' });
  
  const insets = useSafeAreaInsets();
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  
  // Use state for rendering, refs for gesture calculations
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, size: 150 });
  
  // Refs for gesture handling (avoid stale closures)
  const cropBoxRef = useRef({ x: 50, y: 50, size: 150 });
  const imageLayoutRef = useRef({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const imageSizeRef = useRef({ width: 0, height: 0 });
  
  // Gesture tracking
  const gestureMode = useRef(null);
  const gestureStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0, cropSize: 0 });

  // Calculate available space for image
  const HEADER_HEIGHT = 60;
  const INSTRUCTIONS_HEIGHT = 100;
  const VERTICAL_PADDING = 20;
  const imageAreaHeight = SCREEN_HEIGHT - insets.top - insets.bottom - HEADER_HEIGHT - INSTRUCTIONS_HEIGHT - VERTICAL_PADDING;

  // Sync refs when state changes
  useEffect(() => {
    cropBoxRef.current = cropBox;
  }, [cropBox]);

  useEffect(() => {
    imageLayoutRef.current = imageLayout;
  }, [imageLayout]);

  useEffect(() => {
    imageSizeRef.current = imageSize;
  }, [imageSize]);

  // Calculate image display size
  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        setImageSize({ width: w, height: h });
        imageSizeRef.current = { width: w, height: h };

        // Use almost full width and calculated height
        const availableWidth = SCREEN_WIDTH - 20; // 10px padding each side
        const availableHeight = imageAreaHeight;
        
        const imageAspect = w / h;
        let displayWidth, displayHeight;
        
        if (imageAspect > 1) {
          // Landscape image
          displayWidth = availableWidth;
          displayHeight = displayWidth / imageAspect;
          if (displayHeight > availableHeight) {
            displayHeight = availableHeight;
            displayWidth = displayHeight * imageAspect;
          }
        } else {
          // Portrait or square image - prioritize height
          displayHeight = availableHeight;
          displayWidth = displayHeight * imageAspect;
          if (displayWidth > availableWidth) {
            displayWidth = availableWidth;
            displayHeight = displayWidth / imageAspect;
          }
        }
        
        const offsetX = (SCREEN_WIDTH - displayWidth) / 2;
        const offsetY = (imageAreaHeight - displayHeight) / 2;
        
        const layout = { width: displayWidth, height: displayHeight, offsetX, offsetY };
        setImageLayout(layout);
        imageLayoutRef.current = layout;
        
        // Initialize crop box - make it larger (70% of smaller dimension)
        const initialSize = Math.min(displayWidth, displayHeight) * 0.7;
        const initialX = (displayWidth - initialSize) / 2;
        const initialY = (displayHeight - initialSize) / 2;
        
        const initialCrop = { x: initialX, y: initialY, size: initialSize };
        setCropBox(initialCrop);
        cropBoxRef.current = initialCrop;
      },
      (err) => {
        console.error('📸 [CROP] Image.getSize error:', err);
      }
    );
  }, [imageUri, imageAreaHeight]);

  // Clamp crop box to image bounds
  const clampCropBox = useCallback((box) => {
    const layout = imageLayoutRef.current;
    const maxSize = Math.min(layout.width, layout.height);
    const size = clamp(box.size, MIN_CROP_SIZE, maxSize || 300);
    const x = clamp(box.x, 0, Math.max(0, layout.width - size));
    const y = clamp(box.y, 0, Math.max(0, layout.height - size));
    return { x, y, size };
  }, []);

  // Determine gesture mode based on touch position
  const getGestureMode = useCallback((touchX, touchY) => {
    const crop = cropBoxRef.current;
    const halfHit = HANDLE_HIT_AREA / 2;
    
    // Check corners first (larger hit area)
    const nearLeft = touchX >= crop.x - halfHit && touchX <= crop.x + halfHit;
    const nearRight = touchX >= crop.x + crop.size - halfHit && touchX <= crop.x + crop.size + halfHit;
    const nearTop = touchY >= crop.y - halfHit && touchY <= crop.y + halfHit;
    const nearBottom = touchY >= crop.y + crop.size - halfHit && touchY <= crop.y + crop.size + halfHit;
    
    if (nearLeft && nearTop) return 'resize-tl';
    if (nearRight && nearTop) return 'resize-tr';
    if (nearLeft && nearBottom) return 'resize-bl';
    if (nearRight && nearBottom) return 'resize-br';
    
    // Check if inside box for move
    if (touchX >= crop.x && touchX <= crop.x + crop.size &&
        touchY >= crop.y && touchY <= crop.y + crop.size) {
      return 'move';
    }
    
    return null;
  }, []);

  // Create PanResponder once (no dependencies on changing state)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const mode = getGestureMode(locationX, locationY);
        
        gestureMode.current = mode;
        gestureStart.current = {
          x: locationX,
          y: locationY,
          cropX: cropBoxRef.current.x,
          cropY: cropBoxRef.current.y,
          cropSize: cropBoxRef.current.size,
        };
      },

      onPanResponderMove: (evt, gestureState) => {
        const mode = gestureMode.current;
        if (!mode) return;

        const { cropX, cropY, cropSize } = gestureStart.current;
        const { dx, dy } = gestureState;
        
        let newBox = { x: cropX, y: cropY, size: cropSize };

        if (mode === 'move') {
          newBox.x = cropX + dx;
          newBox.y = cropY + dy;
        } else if (mode === 'resize-br') {
          const delta = Math.max(dx, dy);
          newBox.size = cropSize + delta;
        } else if (mode === 'resize-bl') {
          const delta = Math.max(-dx, dy);
          newBox.size = cropSize + delta;
          newBox.x = cropX + cropSize - newBox.size;
        } else if (mode === 'resize-tr') {
          const delta = Math.max(dx, -dy);
          newBox.size = cropSize + delta;
          newBox.y = cropY + cropSize - newBox.size;
        } else if (mode === 'resize-tl') {
          const delta = Math.max(-dx, -dy);
          newBox.size = cropSize + delta;
          newBox.x = cropX + cropSize - newBox.size;
          newBox.y = cropY + cropSize - newBox.size;
        }

        const clamped = clampCropBox(newBox);
        cropBoxRef.current = clamped;
        setCropBox(clamped);
      },

      onPanResponderRelease: () => {
        gestureMode.current = null;
      },

      onPanResponderTerminate: () => {
        gestureMode.current = null;
      },
    })
  ).current;

  const handleCancel = () => onCancel?.();

  const handleCrop = async () => {
    const imgSize = imageSizeRef.current;
    const layout = imageLayoutRef.current;
    const crop = cropBoxRef.current;
    
    if (!imageUri || imgSize.width === 0 || layout.width === 0) return;

    setLoading(true);
    try {
      // Convert screen coordinates to original image pixels
      const scaleX = imgSize.width / layout.width;
      const scaleY = imgSize.height / layout.height;

      const cropX = Math.round(crop.x * scaleX);
      const cropY = Math.round(crop.y * scaleY);
      const cropW = Math.round(crop.size * scaleX);
      const cropH = Math.round(crop.size * scaleY);

      // Clamp to image bounds
      const finalX = clamp(cropX, 0, imgSize.width - 1);
      const finalY = clamp(cropY, 0, imgSize.height - 1);
      const finalW = clamp(cropW, 1, imgSize.width - finalX);
      const finalH = clamp(cropH, 1, imgSize.height - finalY);

      const cropInfo = {
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
        imageWidth: imgSize.width,
        imageHeight: imgSize.height,
      };

      onCropComplete?.({ imageUri, cropInfo });
    } catch (e) {
      console.error('📸 [FACE CROP] Error:', e);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!imageUri) {
    console.log('📸 [FaceCropScreen] No imageUri, showing error modal');
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <Text style={styles.errorText}>No image provided</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.button}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // console.log('📸 [FaceCropScreen] Rendering main modal with image');
  return (
    <Modal 
      visible={visible} 
      animationType="fade" 
      transparent={false}
      presentationStyle="overFullScreen" 
      onRequestClose={handleCancel}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#000' }]}>
        {/* Header - with proper padding */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Position Your Face</Text>
          <TouchableOpacity
            onPress={handleCrop}
            style={[styles.doneButton, (loading || imageSize.width === 0) && styles.doneButtonDisabled]}
            disabled={loading || imageSize.width === 0}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.doneButtonText}>Done</Text>}
          </TouchableOpacity>
        </View>

        {/* Image Container - takes most of the space */}
        <View style={[styles.imageContainer, { height: imageAreaHeight }]}>
          {imageSize.width > 0 && imageLayout.width > 0 && (
            <View
              style={[
                styles.imageWrapper,
                {
                  width: imageLayout.width,
                  height: imageLayout.height,
                  marginLeft: imageLayout.offsetX,
                  marginTop: imageLayout.offsetY,
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Image */}
              <Image
                source={{ uri: imageUri }}
                style={{ width: imageLayout.width, height: imageLayout.height }}
                resizeMode="cover"
              />

              {/* Dark overlay outside crop area */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.overlay, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
                <View style={[styles.overlay, { top: cropBox.y + cropBox.size, left: 0, right: 0, bottom: 0 }]} />
                <View style={[styles.overlay, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.size }]} />
                <View style={[styles.overlay, { top: cropBox.y, left: cropBox.x + cropBox.size, right: 0, height: cropBox.size }]} />
              </View>

              {/* Crop box border */}
              <View
                style={[
                  styles.cropBoxBorder,
                  { left: cropBox.x, top: cropBox.y, width: cropBox.size, height: cropBox.size },
                ]}
                pointerEvents="none"
              >
                {/* Grid lines */}
                <View style={[styles.gridLineH, { top: '33.33%' }]} />
                <View style={[styles.gridLineH, { top: '66.66%' }]} />
                <View style={[styles.gridLineV, { left: '33.33%' }]} />
                <View style={[styles.gridLineV, { left: '66.66%' }]} />
              </View>

              {/* Corner handles */}
              <CornerHandle x={cropBox.x} y={cropBox.y} corner="tl" />
              <CornerHandle x={cropBox.x + cropBox.size} y={cropBox.y} corner="tr" />
              <CornerHandle x={cropBox.x} y={cropBox.y + cropBox.size} corner="bl" />
              <CornerHandle x={cropBox.x + cropBox.size} y={cropBox.y + cropBox.size} corner="br" />
            </View>
          )}

          {imageSize.width === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          )}
        </View>

        {/* Instructions - at the bottom */}
        <View style={[styles.instructions, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={styles.instructionText}>• Hold and Place the box on your face</Text>
          <Text style={styles.instructionText}>• Drag corners to resize</Text>
          <Text style={styles.instructionText}>• Face should fill 60–75% of the box</Text>
        </View>
      </View>
    </Modal>
  );
}

// Corner handle component
const CornerHandle = ({ x, y, corner }) => {
  const offset = HANDLE_VISUAL_SIZE / 2;
  
  return (
    <View 
      style={{
        position: 'absolute',
        left: x - offset,
        top: y - offset,
        width: HANDLE_VISUAL_SIZE,
        height: HANDLE_VISUAL_SIZE,
      }} 
      pointerEvents="none"
    >
      {/* Horizontal line */}
      <View
        style={{
          position: 'absolute',
          width: HANDLE_VISUAL_SIZE,
          height: 4,
          backgroundColor: '#fff',
          top: corner.includes('t') ? 0 : HANDLE_VISUAL_SIZE - 4,
          left: 0,
          borderRadius: 2,
        }}
      />
      {/* Vertical line */}
      <View
        style={{
          position: 'absolute',
          width: 4,
          height: HANDLE_VISUAL_SIZE,
          backgroundColor: '#fff',
          top: 0,
          left: corner.includes('l') ? 0 : HANDLE_VISUAL_SIZE - 4,
          borderRadius: 2,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
    backgroundColor: '#000',
  },
  headerButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 70,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 17,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 70,
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
  imageContainer: {
    backgroundColor: '#0a0a0a',
  },
  imageWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cropBoxBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 15,
  },
  instructions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  instructionText: {
    color: '#888',
    fontSize: 14,
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
