import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Image, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { analyzeProductUrl, analyzeProductImage, saveDetectedProduct } from '../lib/productApi';

export const ProductDetector = ({ onProductDetected, onClose }) => {
  const [inputType, setInputType] = useState('url'); // 'url' or 'image'
  const [url, setUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setAnalyzing(true);
    try {
      const productData = await analyzeProductUrl(url);
      if (productData) {
        // Navigate directly to product details without popup
        onProductDetected(productData);
      } else {
        Alert.alert('Error', 'Could not detect product from this URL');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze URL');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleImageSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image');
      return;
    }

    setAnalyzing(true);
    try {
      const productData = await analyzeProductImage(selectedImage.uri);
      if (productData) {
        // Navigate directly to product details without popup
        onProductDetected(productData);
      } else {
        Alert.alert('Error', 'Could not detect product from this image');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detect Product</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {/* Input Type Selector */}
      <View style={styles.typeSelector}>
        <Pressable 
          style={[styles.typeButton, inputType === 'url' && styles.activeType]}
          onPress={() => setInputType('url')}
        >
          <Text style={[styles.typeText, inputType === 'url' && styles.activeTypeText]}>
            📱 URL
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.typeButton, inputType === 'image' && styles.activeType]}
          onPress={() => setInputType('image')}
        >
          <Text style={[styles.typeText, inputType === 'image' && styles.activeTypeText]}>
            📷 Screenshot
          </Text>
        </Pressable>
      </View>

      {/* URL Input */}
      {inputType === 'url' && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Enter product URL:</Text>
          <TextInput
            style={styles.textInput}
            placeholder="https://example.com/product"
            placeholderTextColor="#666"
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            autoCapitalize="none"
          />
          <Pressable 
            style={[styles.submitButton, analyzing && styles.disabledButton]}
            onPress={handleUrlSubmit}
            disabled={analyzing}
          >
            <Text style={styles.submitText}>
              {analyzing ? 'Analyzing...' : 'Detect Product'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Image Input */}
      {inputType === 'image' && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Select product image:</Text>
          
          {selectedImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <Pressable onPress={() => setSelectedImage(null)} style={styles.removeImage}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.imagePicker} onPress={handleImagePick}>
              <Text style={styles.pickerText}>📷 Tap to select image</Text>
            </Pressable>
          )}
          
          <Pressable 
            style={[styles.submitButton, (!selectedImage || analyzing) && styles.disabledButton]}
            onPress={handleImageSubmit}
            disabled={!selectedImage || analyzing}
          >
            <Text style={styles.submitText}>
              {analyzing ? 'Analyzing...' : 'Detect Product'}
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.helpText}>
        Our AI will analyze the URL or image to detect the product and add it to your shop for try-on!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeType: {
    backgroundColor: '#fff',
  },
  typeText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTypeText: {
    color: '#000',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  imagePicker: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  pickerText: {
    color: '#fff',
    fontSize: 16,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.5)',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
