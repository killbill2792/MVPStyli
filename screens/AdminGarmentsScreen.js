import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';
import { uploadImageAsync } from '../lib/upload';
import { Colors, Typography, Spacing, BorderRadius, CardStyles, TextStyles } from '../lib/designSystem';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const AdminGarmentsScreen = ({ onBack }) => {
  const { state } = useApp();
  const { user } = state;
  
  // Check if user is admin - only admin@stylit.ai can access
  const isAdmin = user?.email === 'admin@stylit.ai';
  
  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to access the admin panel.',
        [{ text: 'OK', onPress: () => onBack && onBack() }]
      );
    }
  }, [isAdmin, onBack]);
  
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGarment, setEditingGarment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterGender, setFilterGender] = useState('all');

  // Form state - simplified with multiple sizes support
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'upper',
    gender: 'unisex',
    image_url: '',
    additional_images: [],
    product_link: '',
    brand: '',
    price: '',
    material: '',
    color: '',
    color_hex: '', // Hex code for color
    fit_type: 'regular', // slim | regular | relaxed | oversized
    fabric_stretch: 'none', // none | low | medium | high
    is_active: true,
    tags: '',
    sizes: [], // Array of size objects: [{ size_label: 'S', chest_width: 50, ... }, ...]
  });
  
  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickedColorHex, setPickedColorHex] = useState('');
  const [pickedColorName, setPickedColorName] = useState('');
  
  const [measurementUnit, setMeasurementUnit] = useState('in'); // 'cm' or 'in' for input display (stored in inches)

  useEffect(() => {
    loadGarments();
  }, [filterCategory, filterGender]);

  const loadGarments = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/api/garments?active_only=false`;
      if (filterCategory !== 'all') url += `&category=${filterCategory}`;
      if (filterGender !== 'all') url += `&gender=${filterGender}`;

      console.log('Fetching garments from:', url);
      const response = await fetch(url);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Always try to get text first to see what we're dealing with
      const text = await response.text();
      console.log('Response text (first 500 chars):', text.substring(0, 500));
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text:', text);
          throw new Error(`API returned invalid JSON (Status: ${response.status}). Response: ${text.substring(0, 200)}`);
        }
      } else {
        // Try to parse as JSON anyway, might be missing content-type header
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          console.error('Response status:', response.status);
          console.error('Response text:', text);
          
          // Check if it's an HTML error page (common with Vercel deployment issues)
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error(`API endpoint returned HTML instead of JSON (Status: ${response.status}). This usually means the API is not deployed or there's a deployment error. Check Vercel logs.`);
          }
          
          throw new Error(`API returned non-JSON response (Status: ${response.status}). Response: ${text.substring(0, 200)}`);
        }
      }
      
      if (!response.ok) {
        const errorMsg = data?.error || data?.message || data?.details || `HTTP ${response.status}`;
        const errorDetails = data?.details || data?.hint || '';
        throw new Error(`${errorMsg}${errorDetails ? `: ${errorDetails}` : ''}`);
      }
      
      if (data.garments) {
        setGarments(data.garments);
      } else if (Array.isArray(data)) {
        setGarments(data);
      } else {
        setGarments([]);
      }
    } catch (error) {
      console.error('Error loading garments:', error);
      console.error('Error stack:', error.stack);
      Alert.alert(
        'Error Loading Garments', 
        error.message || 'Failed to load garments. Check console for details.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImagePicker = async (isMainImage = true) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // No cropping - upload full images
        allowsMultipleSelection: true, // Allow multiple image selection
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSaving(true);
        try {
          // Upload all selected images
          const uploadedUrls = await Promise.all(
            result.assets.map(async (asset) => {
              try {
                return await uploadImageAsync(asset.uri);
              } catch (error) {
                console.error('Failed to upload image:', error);
                return null;
              }
            })
          );

          const validUrls = uploadedUrls.filter(url => url !== null);

          if (validUrls.length === 0) {
            Alert.alert('Error', 'Failed to upload images');
            return;
          }

          if (isMainImage) {
            // Set first image as main, rest as additional
            setFormData({
              ...formData,
              image_url: validUrls[0],
              additional_images: validUrls.slice(1),
            });
          } else {
            // Add to additional images
            setFormData({
              ...formData,
              additional_images: [...(formData.additional_images || []), ...validUrls],
            });
          }

          Alert.alert('Success', `${validUrls.length} image(s) uploaded successfully`);
        } catch (error) {
          console.error('Upload error:', error);
          Alert.alert('Error', 'Failed to upload images');
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (index, isMain = false) => {
    if (isMain) {
      // Remove main image, promote first additional to main
      const newAdditional = formData.additional_images || [];
      setFormData({
        ...formData,
        image_url: newAdditional[0] || '',
        additional_images: newAdditional.slice(1),
      });
    } else {
      // Remove from additional images
      const newAdditional = [...(formData.additional_images || [])];
      newAdditional.splice(index, 1);
      setFormData({
        ...formData,
        additional_images: newAdditional,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'upper',
      gender: 'unisex',
      image_url: '',
      additional_images: [],
      product_link: '',
      brand: '',
      price: '',
      material: '',
      color: '',
      fit_type: 'regular',
      fabric_stretch: 'none',
      is_active: true,
      tags: '',
      sizes: [],
    });
    setMeasurementUnit('in'); // Default to inches since we store in inches
    setEditingGarment(null);
  };
  
  // Add a new size to the sizes array
  const addSize = () => {
    const newSize = {
      size_label: '',
      // Universal measurements (circumference in inches)
      chest_circumference: '',
      waist_circumference: '',
      hip_circumference: '',
      garment_length_in: '',
      // Upper body measurements (in inches)
      shoulder_width_in: '',
      sleeve_length_in: '',
      // Lower body measurements (circumference in inches)
      inseam_in: '',
      rise_in: '',
      thigh_circumference: '',
      leg_opening_circumference: '',
    };
    setFormData({
      ...formData,
      sizes: [...formData.sizes, newSize],
    });
  };
  
  // Update a specific size in the sizes array
  const updateSize = (index, field, value) => {
    const updatedSizes = [...formData.sizes];
    updatedSizes[index] = {
      ...updatedSizes[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      sizes: updatedSizes,
    });
  };
  
  // Remove a size from the sizes array
  const removeSize = (index) => {
    const updatedSizes = formData.sizes.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      sizes: updatedSizes,
    });
  };

  // Helper to convert measurements
  const convertMeasurement = (value, fromUnit, toUnit) => {
    if (!value || isNaN(value)) return value;
    const num = parseFloat(value);
    if (fromUnit === toUnit) return num;
    if (fromUnit === 'in' && toUnit === 'cm') return (num * 2.54).toFixed(2);
    if (fromUnit === 'cm' && toUnit === 'in') return (num / 2.54).toFixed(2);
    return num;
  };

  const handleEdit = (garment) => {
    setEditingGarment(garment);
    
    // Convert sizes from garment_sizes table to form format
    // Support both old (flat) and new (circumference) field names
    const sizes = (garment.sizes || []).map(size => {
      // Helper to get value, converting old flat cm to circumference inches if needed
      const getCircumference = (circField, widthField) => {
        if (size[circField] != null) return size[circField].toString();
        // Convert old flat width (cm) to circumference (inches): flat * 2 / 2.54
        if (size[widthField] != null) {
          const flatCm = Number(size[widthField]);
          return ((flatCm * 2) / 2.54).toString();
        }
        return '';
      };
      
      const getLength = (newField, oldField) => {
        if (size[newField] != null) return size[newField].toString();
        // Convert old cm to inches
        if (size[oldField] != null) {
          const cm = Number(size[oldField]);
          return (cm / 2.54).toString();
        }
        return '';
      };
      
      return {
        size_label: size.size_label || '',
        chest_circumference: getCircumference('chest_circumference', 'chest_width'),
        waist_circumference: getCircumference('waist_circumference', 'waist_width'),
        hip_circumference: getCircumference('hip_circumference', 'hip_width'),
        garment_length_in: getLength('garment_length_in', 'garment_length'),
        shoulder_width_in: getLength('shoulder_width_in', 'shoulder_width'),
        sleeve_length_in: getLength('sleeve_length_in', 'sleeve_length'),
        inseam_in: getLength('inseam_in', 'inseam'),
        rise_in: getLength('rise_in', 'rise'),
        thigh_circumference: getCircumference('thigh_circumference', 'thigh_width'),
        leg_opening_circumference: getCircumference('leg_opening_circumference', 'leg_opening'),
      };
    });
    
    setFormData({
      name: garment.name || '',
      description: garment.description || '',
      category: garment.category || 'upper',
      gender: garment.gender || 'unisex',
      image_url: garment.image_url || '',
      additional_images: Array.isArray(garment.additional_images) ? garment.additional_images : [],
      product_link: garment.product_link || '',
      brand: garment.brand || '',
      price: garment.price?.toString() || '',
      material: garment.material || '',
      color: garment.color || '',
      color_hex: garment.color_hex || '',
      fit_type: garment.fit_type || 'regular',
      fabric_stretch: garment.fabric_stretch || 'none',
      is_active: garment.is_active !== false,
      tags: Array.isArray(garment.tags) ? garment.tags.join(', ') : '',
      sizes: sizes,
    });
    setPickedColorHex(garment.color_hex || '');
    setPickedColorName(garment.color || '');
    setMeasurementUnit('in'); // Default to inches since we store in inches
    setShowForm(true);
  };

  // Color picker handler
  const handleColorPick = async (imageUrl, x, y, imageWidth, imageHeight) => {
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_URL || 'https://mvp-styli.vercel.app';
      const apiUrl = `${API_BASE}/api/color`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'pick',
          imageUrl: imageUrl,
          x: x,
          y: y,
          imageWidth: imageWidth,
          imageHeight: imageHeight,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.color) {
          const hex = result.color;
          // Get color name using the naming system
          const { getNearestColorName } = require('../lib/colorNaming');
          const nearestColor = getNearestColorName(hex);
          
          setFormData({ ...formData, color_hex: hex, color: nearestColor.name });
          setPickedColorHex(hex);
          setPickedColorName(nearestColor.name);
          setShowColorPicker(false);
        }
      } else {
        Alert.alert('Error', 'Failed to pick color from image');
      }
    } catch (error) {
      console.error('Color pick error:', error);
      Alert.alert('Error', 'Failed to pick color from image');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category) {
      Alert.alert('Validation Error', 'Name and category are required');
      return;
    }
    
    if (!formData.sizes || formData.sizes.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one size with measurements');
      return;
    }
    
    // Validate that all sizes have size_label
    const invalidSizes = formData.sizes.filter(s => !s.size_label || s.size_label.trim() === '');
    if (invalidSizes.length > 0) {
      Alert.alert('Validation Error', 'All sizes must have a size label (S, M, L, etc.)');
      return;
    }

    try {
      setSaving(true);
      const payload = { ...formData };
      
      // Convert tags string to array
      if (payload.tags && typeof payload.tags === 'string') {
        payload.tags = payload.tags.split(',').map(t => t.trim()).filter(t => t);
      } else if (!payload.tags) {
        payload.tags = [];
      }

      // Process sizes: convert to inches and store (all measurements stored in inches)
      const processedSizes = formData.sizes.map(size => {
        const processedSize: any = {
          size_label: size.size_label,
        };
        
        // List of measurement fields (circumference in inches)
        const circumferenceFields = [
          'chest_circumference', 'waist_circumference', 'hip_circumference',
          'thigh_circumference', 'leg_opening_circumference'
        ];
        
        // Length fields (in inches)
        const lengthFields = [
          'garment_length_in', 'shoulder_width_in', 'sleeve_length_in',
          'inseam_in', 'rise_in'
        ];
        
        // Process circumference fields - convert to inches if input is cm
        circumferenceFields.forEach(field => {
          if (size[field] && size[field].trim() !== '' && !isNaN(size[field])) {
            let value = parseFloat(size[field]);
            // Convert to inches if input is in cm
            if (measurementUnit === 'cm') {
              value = value / 2.54; // cm to inches
            }
            // Store in inches
            processedSize[field] = value;
          }
        });
        
        // Process length fields - convert to inches if input is cm
        lengthFields.forEach(field => {
          if (size[field] && size[field].trim() !== '' && !isNaN(size[field])) {
            let value = parseFloat(size[field]);
            // Convert to inches if input is in cm
            if (measurementUnit === 'cm') {
              value = value / 2.54; // cm to inches
            }
            // Store in inches
            processedSize[field] = value;
          }
        });
        
        return processedSize;
      });
      
      payload.sizes = processedSizes;

      // Remove empty strings, null, undefined
      Object.keys(payload).forEach(key => {
        if (key === 'sizes') return; // Keep sizes array
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
        if (Array.isArray(payload[key]) && payload[key].length === 0 && key !== 'sizes') {
          delete payload[key];
        }
      });

      // Add admin email to payload for API verification
      payload.admin_email = user?.email;
      
      let response;
      if (editingGarment) {
        // Update
        response = await fetch(`${API_BASE}/api/garments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingGarment.id, ...payload }),
        });
      } else {
        // Create
        if (user?.id) {
          payload.created_by = user.id;
        }
        response = await fetch(`${API_BASE}/api/garments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        console.error('API error response:', data);
        throw new Error(data.error || data.message || `Failed to save garment: ${response.status}`);
      }

      Alert.alert('Success', editingGarment ? 'Garment updated' : 'Garment created');
      setShowForm(false);
      resetForm();
      loadGarments();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save garment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (garment) => {
    Alert.alert(
      'Delete Garment',
      `Are you sure you want to delete "${garment.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE}/api/garments?id=${garment.id}&admin_email=${encodeURIComponent(user?.email || '')}`, {
                method: 'DELETE',
              });
              
              if (response.ok) {
                Alert.alert('Success', 'Garment deleted');
                loadGarments();
              } else {
                throw new Error('Failed to delete');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete garment');
            }
          },
        },
      ]
    );
  };

  // Render size inputs for a specific size
  const renderSizeInputs = (size, sizeIndex) => {
    const category = formData.category;
    const unitLabel = measurementUnit.toUpperCase();
    
    return (
      <View key={sizeIndex} style={styles.sizeCard}>
        <View style={styles.sizeHeader}>
          <Text style={styles.sizeTitle}>Size {sizeIndex + 1}</Text>
          <Pressable
            style={styles.removeSizeButton}
            onPress={() => removeSize(sizeIndex)}
          >
            <Text style={styles.removeSizeButtonText}>Remove</Text>
          </Pressable>
        </View>
        
        {/* Size Label */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Size Label * (e.g., S, M, L, XL)</Text>
          <TextInput
            style={styles.input}
            value={size.size_label}
            onChangeText={(text) => updateSize(sizeIndex, 'size_label', text)}
            placeholder="S"
            placeholderTextColor="#666"
          />
        </View>
        
        {/* Universal measurements - Circumference only */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Chest Circumference ({unitLabel}) *</Text>
          <TextInput
            style={styles.input}
            value={size.chest_circumference}
            onChangeText={(text) => updateSize(sizeIndex, 'chest_circumference', text)}
            placeholder="e.g., 38"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Waist Circumference ({unitLabel}) *</Text>
          <TextInput
            style={styles.input}
            value={size.waist_circumference}
            onChangeText={(text) => updateSize(sizeIndex, 'waist_circumference', text)}
            placeholder="e.g., 32"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Hip Circumference ({unitLabel}) *</Text>
          <TextInput
            style={styles.input}
            value={size.hip_circumference}
            onChangeText={(text) => updateSize(sizeIndex, 'hip_circumference', text)}
            placeholder="e.g., 40"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Garment Length ({unitLabel})</Text>
          <TextInput
            style={styles.input}
            value={size.garment_length_in}
            onChangeText={(text) => updateSize(sizeIndex, 'garment_length_in', text)}
            placeholder="Optional"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        {/* Upper body measurements */}
        {(category === 'upper' || category === 'dresses') && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shoulder Width ({unitLabel})</Text>
              <TextInput
                style={styles.input}
                value={size.shoulder_width_in}
                onChangeText={(text) => updateSize(sizeIndex, 'shoulder_width_in', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sleeve Length ({unitLabel}) - Only if sleeves exist</Text>
              <TextInput
                style={styles.input}
                value={size.sleeve_length_in}
                onChangeText={(text) => updateSize(sizeIndex, 'sleeve_length_in', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
          </>
        )}
        
        {/* Lower body measurements */}
        {(category === 'lower' || category === 'dresses') && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Inseam ({unitLabel})</Text>
              <TextInput
                style={styles.input}
                value={size.inseam_in}
                onChangeText={(text) => updateSize(sizeIndex, 'inseam_in', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rise ({unitLabel}) - Optional but recommended for jeans</Text>
              <TextInput
                style={styles.input}
                value={size.rise_in}
                onChangeText={(text) => updateSize(sizeIndex, 'rise_in', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thigh Circumference ({unitLabel})</Text>
              <TextInput
                style={styles.input}
                value={size.thigh_circumference}
                onChangeText={(text) => updateSize(sizeIndex, 'thigh_circumference', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Leg Opening Circumference ({unitLabel})</Text>
              <TextInput
                style={styles.input}
                value={size.leg_opening_circumference}
                onChangeText={(text) => updateSize(sizeIndex, 'leg_opening_circumference', text)}
                placeholder="Optional"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>
          </>
        )}
      </View>
    );
  };

  const renderGarmentCard = ({ item }) => (
    <View style={styles.garmentCard}>
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.garmentImage} />
      )}
      <View style={styles.garmentInfo}>
        <Text style={styles.garmentName}>{item.name}</Text>
        <Text style={styles.garmentMeta}>
          {item.category} • {item.gender || 'unisex'} • {item.brand || 'No brand'}
        </Text>
        {item.price && (
          <Text style={styles.garmentPrice}>${item.price}</Text>
        )}
        <View style={styles.garmentActions}>
          <Pressable
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Don't render if not admin
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Access Denied</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && garments.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading garments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Admin: Garments</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[styles.filterChip, filterCategory === 'all' && styles.filterChipActive]}
            onPress={() => setFilterCategory('all')}
          >
            <Text style={[styles.filterChipText, filterCategory === 'all' && styles.filterChipTextActive]}>
              All Categories
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterCategory === 'upper' && styles.filterChipActive]}
            onPress={() => setFilterCategory('upper')}
          >
            <Text style={[styles.filterChipText, filterCategory === 'upper' && styles.filterChipTextActive]}>
              Upper
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterCategory === 'lower' && styles.filterChipActive]}
            onPress={() => setFilterCategory('lower')}
          >
            <Text style={[styles.filterChipText, filterCategory === 'lower' && styles.filterChipTextActive]}>
              Lower
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterCategory === 'dresses' && styles.filterChipActive]}
            onPress={() => setFilterCategory('dresses')}
          >
            <Text style={[styles.filterChipText, filterCategory === 'dresses' && styles.filterChipTextActive]}>
              Dresses
            </Text>
          </Pressable>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
          <Pressable
            style={[styles.filterChip, filterGender === 'all' && styles.filterChipActive]}
            onPress={() => setFilterGender('all')}
          >
            <Text style={[styles.filterChipText, filterGender === 'all' && styles.filterChipTextActive]}>
              All Genders
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterGender === 'men' && styles.filterChipActive]}
            onPress={() => setFilterGender('men')}
          >
            <Text style={[styles.filterChipText, filterGender === 'men' && styles.filterChipTextActive]}>
              Men
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterGender === 'women' && styles.filterChipActive]}
            onPress={() => setFilterGender('women')}
          >
            <Text style={[styles.filterChipText, filterGender === 'women' && styles.filterChipTextActive]}>
              Women
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterGender === 'unisex' && styles.filterChipActive]}
            onPress={() => setFilterGender('unisex')}
          >
            <Text style={[styles.filterChipText, filterGender === 'unisex' && styles.filterChipTextActive]}>
              Unisex
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Garments List */}
      <FlatList
        data={garments}
        renderItem={renderGarmentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadGarments}
      />

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowForm(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingGarment ? 'Edit Garment' : 'New Garment'}
            </Text>
            <Pressable onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
            {/* Basic Info */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Garment name"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Description"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <View style={styles.radioGroup}>
                  {['upper', 'lower', 'dresses'].map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.radioButton,
                        formData.category === cat && styles.radioButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          formData.category === cat && styles.radioButtonTextActive,
                        ]}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.radioGroup}>
                  {['men', 'women', 'unisex'].map((gen) => (
                    <Pressable
                      key={gen}
                      style={[
                        styles.radioButton,
                        formData.gender === gen && styles.radioButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, gender: gen })}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          formData.gender === gen && styles.radioButtonTextActive,
                        ]}
                      >
                        {gen.charAt(0).toUpperCase() + gen.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Main Image</Text>
                {formData.image_url ? (
                  <View>
                    <Image source={{ uri: formData.image_url }} style={styles.previewImage} />
                    <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                      <Pressable style={styles.changeImageButton} onPress={() => handleImagePicker(true)}>
                        <Text style={styles.changeImageButtonText}>Change Main</Text>
                      </Pressable>
                      <Pressable 
                        style={[styles.changeImageButton, { backgroundColor: Colors.error }]} 
                        onPress={() => removeImage(0, true)}
                      >
                        <Text style={styles.changeImageButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={styles.uploadButton} onPress={() => handleImagePicker(true)}>
                    <Text style={styles.uploadButtonText}>Upload Main Image</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Additional Images</Text>
                <Pressable style={styles.uploadButton} onPress={() => handleImagePicker(false)}>
                  <Text style={styles.uploadButtonText}>+ Add More Images</Text>
                </Pressable>
                {formData.additional_images && formData.additional_images.length > 0 && (
                  <ScrollView horizontal style={{ marginTop: Spacing.sm }}>
                    {formData.additional_images.map((url, index) => (
                      <View key={index} style={{ marginRight: Spacing.sm, position: 'relative' }}>
                        <Image source={{ uri: url }} style={[styles.previewImage, { width: 120, height: 120 }]} />
                        <Pressable
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            backgroundColor: Colors.error,
                            borderRadius: 12,
                            width: 24,
                            height: 24,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => removeImage(index, false)}
                        >
                          <Text style={{ color: '#fff', fontSize: 16 }}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Link</Text>
                <TextInput
                  style={styles.input}
                  value={formData.product_link}
                  onChangeText={(text) => setFormData({ ...formData, product_link: text })}
                  placeholder="https://example.com/product"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Brand</Text>
                <TextInput
                  style={styles.input}
                  value={formData.brand}
                  onChangeText={(text) => setFormData({ ...formData, brand: text })}
                  placeholder="Brand name"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price</Text>
                <TextInput
                  style={styles.input}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Material</Text>
                <TextInput
                  style={styles.input}
                  value={formData.material}
                  onChangeText={(text) => setFormData({ ...formData, material: text })}
                  placeholder="e.g., Cotton, Polyester"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Color</Text>
                <View style={styles.colorPickerContainer}>
                  {/* Color Swatch */}
                  {formData.color_hex && (
                    <View style={[styles.colorSwatch, { backgroundColor: formData.color_hex }]} />
                  )}
                  
                  {/* Color Name Input */}
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    value={formData.color}
                    onChangeText={(text) => setFormData({ ...formData, color: text })}
                    placeholder="Color name (e.g., Navy Blue)"
                    placeholderTextColor="#666"
                  />
                  
                  {/* Pick Color Button with Eyedropper Icon */}
                  <Pressable
                    style={styles.colorPickerButton}
                    onPress={() => {
                      if (formData.image_url) {
                        setShowColorPicker(true);
                      } else {
                        Alert.alert('Image Required', 'Please upload a product image first to pick a color from it.');
                      }
                    }}
                  >
                    <Text style={styles.colorPickerIcon}>🎨</Text>
                    <Text style={styles.colorPickerButtonText}>Pick</Text>
                  </Pressable>
                </View>
                
                {/* Show HEX code if available */}
                {formData.color_hex && (
                  <Text style={styles.colorHexText}>HEX: {formData.color_hex.toUpperCase()}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Size</Text>
                <TextInput
                  style={styles.input}
                  value={formData.size}
                  onChangeText={(text) => setFormData({ ...formData, size: text })}
                  placeholder="e.g., M, L, XL"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.tags}
                  onChangeText={(text) => setFormData({ ...formData, tags: text })}
                  placeholder="tag1, tag2, tag3"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={[styles.inputGroup, styles.switchGroup]}>
                <Text style={styles.inputLabel}>Active</Text>
                <Switch
                  value={formData.is_active}
                  onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                  trackColor={{ false: '#767577', true: Colors.primary }}
                  thumbColor={formData.is_active ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Measurements */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Measurements (Optional)</Text>
              {/* Fit Type and Fabric Stretch */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fit Type</Text>
                <View style={styles.radioGroup}>
                  {['slim', 'regular', 'relaxed', 'oversized'].map((fit) => (
                    <Pressable
                      key={fit}
                      style={[
                        styles.radioButton,
                        formData.fit_type === fit && styles.radioButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, fit_type: fit })}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          formData.fit_type === fit && styles.radioButtonTextActive,
                        ]}
                      >
                        {fit.charAt(0).toUpperCase() + fit.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fabric Stretch</Text>
                <View style={styles.radioGroup}>
                  {['none', 'low', 'medium', 'high'].map((stretch) => (
                    <Pressable
                      key={stretch}
                      style={[
                        styles.radioButton,
                        formData.fabric_stretch === stretch && styles.radioButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, fabric_stretch: stretch })}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          formData.fabric_stretch === stretch && styles.radioButtonTextActive,
                        ]}
                      >
                        {stretch.charAt(0).toUpperCase() + stretch.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Sizes Section */}
              <View style={styles.formSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                  <Text style={styles.sectionTitle}>Sizes & Measurements</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                    <Text style={styles.inputLabel}>Unit: </Text>
                    {['cm', 'in'].map((unit) => (
                      <Pressable
                        key={unit}
                        style={[
                          styles.radioButton,
                          measurementUnit === unit && styles.radioButtonActive,
                        ]}
                        onPress={() => setMeasurementUnit(unit)}
                      >
                        <Text
                          style={[
                            styles.radioButtonText,
                            measurementUnit === unit && styles.radioButtonTextActive,
                          ]}
                        >
                          {unit.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: Spacing.md }]}>
                  Add multiple sizes (S, M, L, XL, etc.) with their measurements. All measurements are circumference (not flat). Values will be stored in inches.
                </Text>
                
                {formData.sizes.map((size, index) => renderSizeInputs(size, index))}
                
                <Pressable style={styles.addSizeButton} onPress={addSize}>
                  <Text style={styles.addSizeButtonText}>+ Add Size</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.colorPickerModalOverlay}>
          <View style={styles.colorPickerModalContent}>
            <View style={styles.colorPickerModalHeader}>
              <Text style={styles.colorPickerModalTitle}>Pick Color from Product</Text>
              <Pressable onPress={() => setShowColorPicker(false)}>
                <Text style={styles.colorPickerModalClose}>✕</Text>
              </Pressable>
            </View>
            
            {formData.image_url ? (
              <View style={styles.colorPickerImageContainer}>
                <Image
                  source={{ uri: formData.image_url }}
                  style={styles.colorPickerImage}
                  resizeMode="contain"
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    // Store image dimensions for coordinate conversion
                  }}
                />
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={(event) => {
                    // Simple center tap for now - can be enhanced with coordinate mapping
                    const { width, height } = event.nativeEvent.layout || { width: 0, height: 0 };
                    // Use center of image as default
                    handleColorPick(formData.image_url, 0.5, 0.5, 1, 1);
                  }}
                />
              </View>
            ) : (
              <View style={styles.colorPickerNoImage}>
                <Text style={styles.colorPickerNoImageText}>No image available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TextStyles.body,
    marginTop: Spacing.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  backButtonText: {
    ...TextStyles.body,
    color: Colors.primary,
  },
  headerTitle: {
    ...TextStyles.h3,
    fontWeight: Typography.bold,
  },
  addButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    ...TextStyles.body,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  filters: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    marginRight: Spacing.sm,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  listContent: {
    padding: Spacing.md,
  },
  garmentCard: {
    ...CardStyles.container,
    flexDirection: 'row',
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  garmentImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
  },
  garmentInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  garmentName: {
    ...TextStyles.body,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  garmentMeta: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  garmentPrice: {
    ...TextStyles.body,
    color: Colors.primary,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.sm,
  },
  garmentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    ...TextStyles.caption,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    ...TextStyles.body,
    color: Colors.textSecondary,
  },
  modalTitle: {
    ...TextStyles.h3,
    fontWeight: Typography.bold,
  },
  modalSaveButton: {
    ...TextStyles.body,
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: Spacing.lg,
  },
  formSection: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    ...TextStyles.h3,
    fontWeight: Typography.bold,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...TextStyles.body,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  input: {
    ...CardStyles.container,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...TextStyles.body,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  radioButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioButtonText: {
    ...TextStyles.body,
    color: Colors.textSecondary,
  },
  radioButtonTextActive: {
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  sizeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sizeTitle: {
    ...TextStyles.h4,
    fontWeight: Typography.semibold,
  },
  removeSizeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
  },
  removeSizeButtonText: {
    ...TextStyles.caption,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  addSizeButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addSizeButtonText: {
    ...TextStyles.body,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  uploadButton: {
    ...CardStyles.container,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    ...TextStyles.body,
    color: Colors.primary,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  changeImageButton: {
    padding: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  changeImageButtonText: {
    ...TextStyles.body,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  colorPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  colorPickerIcon: {
    fontSize: 16,
  },
  colorPickerButtonText: {
    ...TextStyles.body,
    color: Colors.textWhite,
    fontWeight: Typography.semibold,
  },
  colorHexText: {
    ...TextStyles.caption,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  colorPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  colorPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colorPickerModalTitle: {
    ...TextStyles.h3,
    fontWeight: Typography.bold,
  },
  colorPickerModalClose: {
    ...TextStyles.h3,
    color: Colors.textSecondary,
  },
  colorPickerImageContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  colorPickerImage: {
    width: '100%',
    height: '100%',
  },
  colorPickerNoImage: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  colorPickerNoImageText: {
    ...TextStyles.body,
    color: Colors.textSecondary,
  },
});

export default AdminGarmentsScreen;

