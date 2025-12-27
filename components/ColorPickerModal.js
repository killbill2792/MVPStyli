/**
 * Professional Color Picker Component
 * Client-side canvas-based pixel color picker with zoom, magnifier, and crosshair
 * Completely separate from auto-detect color logic
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

const ColorPickerModal = ({ visible, imageUri, onColorPicked, onClose }) => {
  const [pickedColor, setPickedColor] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panResponder = useRef(null);
  const webViewRef = useRef(null);

  // HTML content for canvas-based color picker
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
      touch-action: none;
    }
    #container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #canvas {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      cursor: crosshair;
    }
    #magnifier {
      position: absolute;
      width: 120px;
      height: 120px;
      border: 3px solid #fff;
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
      display: none;
      overflow: hidden;
    }
    #magnifierCanvas {
      width: 100%;
      height: 100%;
      transform: scale(3);
      image-rendering: pixelated;
    }
    #crosshair {
      position: absolute;
      width: 20px;
      height: 20px;
      border: 2px solid #fff;
      border-radius: 50%;
      pointer-events: none;
      display: none;
      box-shadow: 0 0 10px rgba(255,255,255,0.5);
    }
    #crosshair::before, #crosshair::after {
      content: '';
      position: absolute;
      background: #fff;
      box-shadow: 0 0 5px rgba(255,255,255,0.5);
    }
    #crosshair::before {
      width: 2px;
      height: 100%;
      left: 50%;
      transform: translateX(-50%);
    }
    #crosshair::after {
      height: 2px;
      width: 100%;
      top: 50%;
      transform: translateY(-50%);
    }
    #colorPreview {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      padding: 15px 20px;
      border-radius: 12px;
      display: none;
      align-items: center;
      gap: 12px;
      z-index: 1000;
    }
    #colorSwatch {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: 2px solid #fff;
    }
    #colorInfo {
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="container">
    <img id="canvas" src="${imageUri}" alt="Product Image" />
    <canvas id="magnifierCanvas"></canvas>
    <div id="magnifier"></div>
    <div id="crosshair"></div>
    <div id="colorPreview">
      <div id="colorSwatch"></div>
      <div id="colorInfo">RGB: --, --, --<br>HEX: ------</div>
    </div>
  </div>
  <script>
    const img = document.getElementById('canvas');
    const magnifier = document.getElementById('magnifier');
    const magnifierCanvas = document.getElementById('magnifierCanvas');
    const crosshair = document.getElementById('crosshair');
    const colorPreview = document.getElementById('colorPreview');
    const colorSwatch = document.getElementById('colorSwatch');
    const colorInfo = document.getElementById('colorInfo');
    
    let canvas = null;
    let ctx = null;
    let isPicking = false;
    
    // Create offscreen canvas for pixel sampling
    img.onload = function() {
      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Setup magnifier canvas
      const magCtx = magnifierCanvas.getContext('2d');
      magnifierCanvas.width = 120;
      magnifierCanvas.height = 120;
    };
    
    function getPixelColor(x, y) {
      if (!ctx) return null;
      
      // Convert screen coordinates to image coordinates
      const rect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      
      const imgX = Math.floor((x - rect.left) * scaleX);
      const imgY = Math.floor((y - rect.top) * scaleY);
      
      // Clamp to image bounds
      const pixelX = Math.max(0, Math.min(imgX, canvas.width - 1));
      const pixelY = Math.max(0, Math.min(imgY, canvas.height - 1));
      
      // Get exact pixel color (no averaging)
      const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
      const [r, g, b] = imageData.data;
      
      return { r, g, b, x: pixelX, y: pixelY };
    }
    
    function updateMagnifier(x, y) {
      if (!ctx || !img) return;
      
      const rect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      
      const imgX = (x - rect.left) * scaleX;
      const imgY = (y - rect.top) * scaleY;
      
      // Position magnifier above finger
      magnifier.style.left = (x - 60) + 'px';
      magnifier.style.top = (y - 140) + 'px';
      magnifier.style.display = 'block';
      
      // Draw magnified view (3x zoom)
      const magCtx = magnifierCanvas.getContext('2d');
      const sourceSize = 40;
      const sourceX = Math.max(0, Math.min(imgX - sourceSize/2, canvas.width - sourceSize));
      const sourceY = Math.max(0, Math.min(imgY - sourceSize/2, canvas.height - sourceSize));
      
      magCtx.clearRect(0, 0, 120, 120);
      magCtx.drawImage(
        canvas,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, 120, 120
      );
      
      // Draw grid
      magCtx.strokeStyle = 'rgba(255,255,255,0.3)';
      magCtx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        magCtx.beginPath();
        magCtx.moveTo(i * 40, 0);
        magCtx.lineTo(i * 40, 120);
        magCtx.stroke();
        magCtx.beginPath();
        magCtx.moveTo(0, i * 40);
        magCtx.lineTo(120, i * 40);
        magCtx.stroke();
      }
      
      // Center crosshair
      magCtx.strokeStyle = '#fff';
      magCtx.lineWidth = 2;
      magCtx.beginPath();
      magCtx.moveTo(60, 0);
      magCtx.lineTo(60, 120);
      magCtx.moveTo(0, 60);
      magCtx.lineTo(120, 60);
      magCtx.stroke();
    }
    
    function updateCrosshair(x, y) {
      crosshair.style.left = (x - 10) + 'px';
      crosshair.style.top = (y - 10) + 'px';
      crosshair.style.display = 'block';
    }
    
    function updateColorPreview(color) {
      if (!color) {
        colorPreview.style.display = 'none';
        return;
      }
      
      const hex = '#' + [color.r, color.g, color.b]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('');
      
      colorSwatch.style.backgroundColor = hex;
      colorInfo.innerHTML = \`RGB: \${color.r}, \${color.g}, \${color.b}<br>HEX: \${hex.toUpperCase()}\`;
      colorPreview.style.display = 'flex';
    }
    
    // Touch/Mouse events
    function handleMove(e) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const color = getPixelColor(clientX, clientY);
      if (color) {
        updateMagnifier(clientX, clientY);
        updateCrosshair(clientX, clientY);
        updateColorPreview(color);
      }
    }
    
    function handleEnd(e) {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      
      const color = getPixelColor(clientX, clientY);
      if (color) {
        const hex = '#' + [color.r, color.g, color.b]
          .map(c => c.toString(16).padStart(2, '0'))
          .join('');
        
        // Send color to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'colorPicked',
            color: {
              r: color.r,
              g: color.g,
              b: color.b,
              hex: hex,
            }
          }));
        }
      }
      
      magnifier.style.display = 'none';
      crosshair.style.display = 'none';
      colorPreview.style.display = 'none';
    }
    
    img.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isPicking = true;
      handleMove(e);
    });
    
    img.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (isPicking) handleMove(e);
    });
    
    img.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isPicking) {
        handleEnd(e);
        isPicking = false;
      }
    });
    
    // Mouse events for web/desktop
    img.addEventListener('mousemove', handleMove);
    img.addEventListener('click', handleEnd);
  </script>
</body>
</html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'colorPicked' && data.color) {
        const { r, g, b, hex } = data.color;
        console.log('🎨 [MANUAL PICKER] Color picked:', { r, g, b, hex });
        setPickedColor(data.color);
        
        // Convert RGB to color name (client-side, no API call)
        const colorName = rgbToColorName(r, g, b);
        
        // Call callback with picked color
        if (onColorPicked) {
          onColorPicked({
            color: hex,
            name: colorName,
            rgb: { r, g, b },
            confidence: 1.0,
            source: 'manual-pick',
          });
        }
      }
    } catch (error) {
      console.error('🎨 [MANUAL PICKER] Error parsing message:', error);
    }
  };

  // Simple RGB to color name (client-side, no API)
  const rgbToColorName = (r, g, b) => {
    // Basic color name mapping
    const colors = [
      { name: 'black', rgb: [0, 0, 0], threshold: 40 },
      { name: 'white', rgb: [255, 255, 255], threshold: 230 },
      { name: 'grey', rgb: [128, 128, 128], threshold: 60 },
      { name: 'red', rgb: [255, 0, 0], threshold: 120 },
      { name: 'blue', rgb: [0, 0, 255], threshold: 120 },
      { name: 'green', rgb: [0, 255, 0], threshold: 120 },
      { name: 'yellow', rgb: [255, 255, 0], threshold: 200 },
      { name: 'orange', rgb: [255, 165, 0], threshold: 120 },
      { name: 'pink', rgb: [255, 192, 203], threshold: 150 },
      { name: 'purple', rgb: [128, 0, 128], threshold: 100 },
      { name: 'brown', rgb: [165, 42, 42], threshold: 70 },
      { name: 'navy', rgb: [0, 0, 128], threshold: 60 },
      { name: 'burgundy', rgb: [128, 0, 32], threshold: 60 },
      { name: 'coral', rgb: [255, 127, 80], threshold: 120 },
      { name: 'teal', rgb: [0, 128, 128], threshold: 80 },
    ];

    let minDistance = Infinity;
    let closestColor = 'unknown';

    for (const color of colors) {
      const distance = Math.sqrt(
        Math.pow(r - color.rgb[0], 2) +
        Math.pow(g - color.rgb[1], 2) +
        Math.pow(b - color.rgb[2], 2)
      );
      
      if (distance < minDistance && distance < color.threshold) {
        minDistance = distance;
        closestColor = color.name;
      }
    }

    return closestColor;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick Color from Product</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.modalCloseBtn}>✕</Text>
            </Pressable>
          </View>
          
          <View style={styles.webViewContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent }}
              style={styles.webView}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
            />
          </View>
          
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Tap anywhere on the image to pick the exact color
            </Text>
            {pickedColor && (
              <View style={styles.colorDisplay}>
                <View style={[styles.colorSwatch, { backgroundColor: pickedColor.hex }]} />
                <Text style={styles.colorText}>
                  {pickedColor.hex.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseBtn: {
    fontSize: 24,
    color: '#fff',
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  instructions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  instructionText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  colorDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  colorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ColorPickerModal;

