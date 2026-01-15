import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  PanResponder,
  Animated,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Note: Using server-side cropping instead of expo-image-manipulator to avoid native module rebuild
// Using View with borderRadius for oval instead of SVG

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Oval crop guide dimensions
const OVAL_WIDTH = SCREEN_WIDTH * 0.75;
const OVAL_HEIGHT = OVAL_WIDTH * 1.2; // Slightly taller for face
const OVAL_X = (SCREEN_WIDTH - OVAL_WIDTH) / 2;
const OVAL_Y = SCREEN_HEIGHT * 0.25; // Position in upper portion

export default function FaceCropScreen({ visible, imageUri, onCropComplete, onCancel }) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  
  // Transform state
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  // Base values for gestures
  const scaleBase = useRef(1);
  const translateXBase = useRef(0);
  const translateYBase = useRef(0);
  
  // Last gesture values
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  
  // Pinch gesture tracking (separate ref to avoid setting properties on PanResponder)
  const initialPinchDistance = useRef(null);
  const initialPinchScale = useRef(null);

  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        setImageSize({ width, height });
      });
    }
  }, [imageUri]);

  // Calculate display dimensions
  const imageAspectRatio = imageSize.width > 0 ? imageSize.width / imageSize.height : 1;
  const displayWidth = SCREEN_WIDTH;
  const displayHeight = SCREEN_WIDTH / imageAspectRatio;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Always allow starting - we'll check in move
        return imageSize.width > 0 && imageSize.height > 0;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Always respond to movement or pinch - don't be too restrictive
        const hasMovement = Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1;
        const isPinch = evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2;
        return hasMovement || isPinch;
      },
      
      onPanResponderGrant: (evt) => {
        // Store current values when gesture starts
        scaleBase.current = lastScale.current;
        translateXBase.current = lastTranslateX.current;
        translateYBase.current = lastTranslateY.current;
        
        // Handle initial pinch setup
        const touchCount = evt.nativeEvent.touches ? evt.nativeEvent.touches.length : 0;
        if (touchCount === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          initialPinchDistance.current = distance;
          initialPinchScale.current = lastScale.current;
          console.log('🎨 [CROP] Pinch grant, initial distance:', distance);
        } else {
          initialPinchDistance.current = null;
          initialPinchScale.current = null;
        }
      },
      
      onPanResponderMove: (evt, gestureState) => {
        // Handle pinch zoom (two fingers)
        const touchCount = evt.nativeEvent.touches ? evt.nativeEvent.touches.length : 0;
        
        if (touchCount === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          
          // Initialize on first pinch if not already set
          if (initialPinchDistance.current === null || initialPinchDistance.current === 0) {
            initialPinchDistance.current = distance;
            initialPinchScale.current = lastScale.current;
            console.log('🎨 [CROP] Pinch started, initial distance:', distance, 'scale:', lastScale.current);
          }
          
          // Calculate new scale
          const scaleRatio = distance / initialPinchDistance.current;
          const newScale = Math.max(
            1,
            Math.min(3, initialPinchScale.current * scaleRatio)
          );
          
          console.log('🎨 [CROP] Pinch move, distance:', distance, 'ratio:', scaleRatio, 'newScale:', newScale);
          
          lastScale.current = newScale;
          scale.setValue(newScale);
        } else if (touchCount === 1) {
          // Handle pan (single finger)
          const newX = translateXBase.current + gestureState.dx;
          const newY = translateYBase.current + gestureState.dy;
          
          // Calculate constraints based on scaled image size
          const scaledWidth = displayWidth * lastScale.current;
          const scaledHeight = displayHeight * lastScale.current;
          
          // Allow panning within reasonable bounds
          // When scaled, image can move within screen bounds
          const maxX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
          const maxY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);
          
          lastTranslateX.current = Math.max(-maxX, Math.min(maxX, newX));
          lastTranslateY.current = Math.max(-maxY, Math.min(maxY, newY));
          
          translateX.setValue(lastTranslateX.current);
          translateY.setValue(lastTranslateY.current);
        }
      },
      
      onPanResponderRelease: () => {
        // Update base values to current position for next gesture
        scaleBase.current = lastScale.current;
        translateXBase.current = lastTranslateX.current;
        translateYBase.current = lastTranslateY.current;
        // Reset pinch tracking
        initialPinchDistance.current = null;
        initialPinchScale.current = null;
      },
      
      onPanResponderTerminate: () => {
        // Reset on termination
        initialPinchDistance.current = null;
        initialPinchScale.current = null;
      },
    })
  ).current;

  const handleCrop = async () => {
    if (!imageUri || imageSize.width === 0) return;
    
    setLoading(true);
    try {
      // Get current transform values
      const currentScale = lastScale.current;
      const currentX = lastTranslateX.current;
      const currentY = lastTranslateY.current;
      
      // Calculate the visible image dimensions (scaled)
      const scaledImageWidth = displayWidth * currentScale;
      const scaledImageHeight = displayHeight * currentScale;
      
      // Screen center
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;
      
      // Oval center in screen coordinates
      const ovalCenterX = OVAL_X + OVAL_WIDTH / 2;
      const ovalCenterY = OVAL_Y + OVAL_HEIGHT / 2;
      
      // Image center position (accounting for translation)
      const imageCenterScreenX = screenCenterX + currentX;
      const imageCenterScreenY = screenCenterY + currentY;
      
      // Offset from image center to oval center in screen coordinates
      const offsetScreenX = ovalCenterX - imageCenterScreenX;
      const offsetScreenY = ovalCenterY - imageCenterScreenY;
      
      // Convert to image coordinates (divide by scale)
      const offsetImageX = offsetScreenX / currentScale;
      const offsetImageY = offsetScreenY / currentScale;
      
      // Crop region in image coordinates
      // Start from image center, apply offset, then subtract half crop size
      const cropX = (imageSize.width / 2) + offsetImageX - (OVAL_WIDTH / 2 / currentScale);
      const cropY = (imageSize.height / 2) + offsetImageY - (OVAL_HEIGHT / 2 / currentScale);
      const cropWidth = OVAL_WIDTH / currentScale;
      const cropHeight = OVAL_HEIGHT / currentScale;
      
      // Ensure crop is within image bounds
      const finalCropX = Math.max(0, Math.min(imageSize.width - cropWidth, cropX));
      const finalCropY = Math.max(0, Math.min(imageSize.height - cropHeight, cropY));
      const finalCropWidth = Math.min(imageSize.width - finalCropX, cropWidth);
      const finalCropHeight = Math.min(imageSize.height - finalCropY, cropHeight);
      
      console.log('🎨 [FACE CROP] Crop parameters:', {
        imageSize,
        currentScale,
        currentX,
        currentY,
        cropX: finalCropX,
        cropY: finalCropY,
        cropWidth: finalCropWidth,
        cropHeight: finalCropHeight,
      });
      
      // Instead of cropping client-side (requires native module rebuild),
      // send the full image + crop coordinates to server
      // Server will handle cropping using sharp
      const cropInfo = {
        x: finalCropX,
        y: finalCropY,
        width: finalCropWidth,
        height: finalCropHeight,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
      };
      
      console.log('🎨 [FACE CROP] Sending image with crop info to server');
      
      if (onCropComplete) {
        // Pass both the image URI and crop info
        onCropComplete({ imageUri, cropInfo });
      }
    } catch (error) {
      console.error('🎨 [FACE CROP] Error cropping image:', error);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleCancel} 
          style={styles.cancelButton}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Position Your Face</Text>
        <TouchableOpacity
          onPress={handleCrop}
          style={[styles.doneButton, (loading || imageSize.width === 0) && styles.doneButtonDisabled]}
          disabled={loading || imageSize.width === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.doneButtonText}>Done</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.cropContainer}>
        <View style={styles.gestureArea} {...panResponder.panHandlers} collapsable={false}>
        {imageSize.width > 0 && (
          <Animated.View
            style={[
              styles.imageContainer,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={{
                width: displayWidth,
                height: displayHeight,
              }}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        </View>
        
        {/* Oval overlay guide - pointerEvents: 'none' so it doesn't block touches */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayRow}>
            <View style={styles.overlayLeft} />
            <View style={styles.ovalContainer}>
              {/* Oval guide using View with borderRadius */}
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
        <Text style={styles.instructionText}>• Face should fill 60-75% of the oval</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gestureArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  imageContainer: {
    position: 'absolute',
    zIndex: 0,
  },
  overlay: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
