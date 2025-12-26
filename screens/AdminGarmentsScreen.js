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

  // Form state
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
    size: '',
    is_active: true,
    measurement_unit: 'cm', // 'cm' or 'in'
    // Upper body measurements
    chest: '',
    waist: '',
    hip: '',
    front_length: '',
    back_length: '',
    sleeve_length: '',
    back_width: '',
    arm_width: '',
    shoulder_width: '',
    collar_girth: '',
    cuff_girth: '',
    armscye_depth: '',
    across_chest_width: '',
    // Lower body measurements
    front_rise: '',
    back_rise: '',
    inseam: '',
    outseam: '',
    thigh_girth: '',
    knee_girth: '',
    hem_girth: '',
    // Dress measurements
    side_neck_to_hem: '',
    back_neck_to_hem: '',
    tags: '',
  });

  useEffect(() => {
    loadGarments();
  }, [filterCategory, filterGender]);

  const loadGarments = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/api/garments?active_only=false`;
      if (filterCategory !== 'all') url += `&category=${filterCategory}`;
      if (filterGender !== 'all') url += `&gender=${filterGender}`;

      const response = await fetch(url);
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Try to parse as JSON anyway, might be missing content-type header
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          console.error('Response status:', response.status);
          console.error('Response headers:', Object.fromEntries(response.headers.entries()));
          throw new Error(`API returned non-JSON response (Status: ${response.status}). Make sure the API endpoint is deployed.`);
        }
      }
      
      if (!response.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
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
      Alert.alert('Error', error.message || 'Failed to load garments. Check console for details.');
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
      size: '',
      is_active: true,
      measurement_unit: 'cm',
      chest: '',
      waist: '',
      hip: '',
      front_length: '',
      back_length: '',
      sleeve_length: '',
      back_width: '',
      arm_width: '',
      shoulder_width: '',
      collar_girth: '',
      cuff_girth: '',
      armscye_depth: '',
      across_chest_width: '',
      front_rise: '',
      back_rise: '',
      inseam: '',
      outseam: '',
      thigh_girth: '',
      knee_girth: '',
      hem_girth: '',
      side_neck_to_hem: '',
      back_neck_to_hem: '',
      tags: '',
    });
    setEditingGarment(null);
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
    // Determine measurement unit from stored data (default to cm)
    const storedUnit = garment.measurement_unit || 'cm';
    
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
      size: garment.size || '',
      is_active: garment.is_active !== false,
      measurement_unit: storedUnit,
      // Measurements are stored in cm, convert to display unit if needed
      chest: garment.chest ? convertMeasurement(garment.chest, 'cm', storedUnit).toString() : '',
      waist: garment.waist ? convertMeasurement(garment.waist, 'cm', storedUnit).toString() : '',
      hip: garment.hip ? convertMeasurement(garment.hip, 'cm', storedUnit).toString() : '',
      front_length: garment.front_length ? convertMeasurement(garment.front_length, 'cm', storedUnit).toString() : '',
      back_length: garment.back_length ? convertMeasurement(garment.back_length, 'cm', storedUnit).toString() : '',
      sleeve_length: garment.sleeve_length ? convertMeasurement(garment.sleeve_length, 'cm', storedUnit).toString() : '',
      back_width: garment.back_width ? convertMeasurement(garment.back_width, 'cm', storedUnit).toString() : '',
      arm_width: garment.arm_width ? convertMeasurement(garment.arm_width, 'cm', storedUnit).toString() : '',
      shoulder_width: garment.shoulder_width ? convertMeasurement(garment.shoulder_width, 'cm', storedUnit).toString() : '',
      collar_girth: garment.collar_girth ? convertMeasurement(garment.collar_girth, 'cm', storedUnit).toString() : '',
      cuff_girth: garment.cuff_girth ? convertMeasurement(garment.cuff_girth, 'cm', storedUnit).toString() : '',
      armscye_depth: garment.armscye_depth ? convertMeasurement(garment.armscye_depth, 'cm', storedUnit).toString() : '',
      across_chest_width: garment.across_chest_width ? convertMeasurement(garment.across_chest_width, 'cm', storedUnit).toString() : '',
      front_rise: garment.front_rise ? convertMeasurement(garment.front_rise, 'cm', storedUnit).toString() : '',
      back_rise: garment.back_rise ? convertMeasurement(garment.back_rise, 'cm', storedUnit).toString() : '',
      inseam: garment.inseam ? convertMeasurement(garment.inseam, 'cm', storedUnit).toString() : '',
      outseam: garment.outseam ? convertMeasurement(garment.outseam, 'cm', storedUnit).toString() : '',
      thigh_girth: garment.thigh_girth ? convertMeasurement(garment.thigh_girth, 'cm', storedUnit).toString() : '',
      knee_girth: garment.knee_girth ? convertMeasurement(garment.knee_girth, 'cm', storedUnit).toString() : '',
      hem_girth: garment.hem_girth ? convertMeasurement(garment.hem_girth, 'cm', storedUnit).toString() : '',
      side_neck_to_hem: garment.side_neck_to_hem ? convertMeasurement(garment.side_neck_to_hem, 'cm', storedUnit).toString() : '',
      back_neck_to_hem: garment.back_neck_to_hem ? convertMeasurement(garment.back_neck_to_hem, 'cm', storedUnit).toString() : '',
      tags: Array.isArray(garment.tags) ? garment.tags.join(', ') : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category) {
      Alert.alert('Validation Error', 'Name and category are required');
      return;
    }

    try {
      setSaving(true);
      const payload = { ...formData };
      
      // Convert tags string to array
      if (payload.tags) {
        payload.tags = payload.tags.split(',').map(t => t.trim()).filter(t => t);
      } else {
        payload.tags = [];
      }

      // Convert measurements to cm for storage (always store in cm)
      const measurementFields = [
        'chest', 'waist', 'hip', 'front_length', 'back_length', 'sleeve_length',
        'back_width', 'arm_width', 'shoulder_width', 'collar_girth', 'cuff_girth',
        'armscye_depth', 'across_chest_width', 'front_rise', 'back_rise', 'inseam',
        'outseam', 'thigh_girth', 'knee_girth', 'hem_girth', 'side_neck_to_hem', 'back_neck_to_hem'
      ];
      
      measurementFields.forEach(field => {
        if (payload[field] && !isNaN(payload[field])) {
          // Convert to cm if input is in inches
          if (payload.measurement_unit === 'in') {
            payload[field] = parseFloat(payload[field]) * 2.54;
          } else {
            payload[field] = parseFloat(payload[field]);
          }
        }
      });
      
      // Store measurement unit used for input (for display purposes)
      // But always store measurements in cm
      const inputUnit = payload.measurement_unit;
      payload.measurement_unit = inputUnit; // Keep for reference

      // Remove empty strings, null, undefined and convert to appropriate types
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined || 
            (Array.isArray(payload[key]) && payload[key].length === 0)) {
          delete payload[key];
        }
        // Convert empty measurement strings to undefined
        const measurementFields = [
          'chest', 'waist', 'hip', 'front_length', 'back_length', 'sleeve_length',
          'back_width', 'arm_width', 'shoulder_width', 'collar_girth', 'cuff_girth',
          'armscye_depth', 'across_chest_width', 'front_rise', 'back_rise', 'inseam',
          'outseam', 'thigh_girth', 'knee_girth', 'hem_girth', 'side_neck_to_hem', 'back_neck_to_hem'
        ];
        if (measurementFields.includes(key) && (payload[key] === '' || isNaN(payload[key]))) {
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save garment');
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

  const renderMeasurementInputs = () => {
    const category = formData.category;
    
    // Common measurements for all categories
    const common = [
      { key: 'chest', label: 'Chest (cm)' },
      { key: 'waist', label: 'Waist (cm)' },
      { key: 'hip', label: 'Hip (cm)' },
    ];

    // Upper body measurements
    const upper = [
      { key: 'front_length', label: 'Front Length (cm)' },
      { key: 'back_length', label: 'Back Length (cm)' },
      { key: 'sleeve_length', label: 'Sleeve Length (cm)' },
      { key: 'back_width', label: 'Back Width (cm)' },
      { key: 'arm_width', label: 'Arm Width (cm)' },
      { key: 'shoulder_width', label: 'Shoulder Width (cm)' },
      { key: 'collar_girth', label: 'Collar Girth (cm)' },
      { key: 'cuff_girth', label: 'Cuff Girth (cm)' },
      { key: 'armscye_depth', label: 'Armscye Depth (cm)' },
      { key: 'across_chest_width', label: 'Across Chest Width (cm)' },
    ];

    // Lower body measurements
    const lower = [
      { key: 'front_rise', label: 'Front Rise (cm)' },
      { key: 'back_rise', label: 'Back Rise (cm)' },
      { key: 'inseam', label: 'Inseam (cm)' },
      { key: 'outseam', label: 'Outseam (cm)' },
      { key: 'thigh_girth', label: 'Thigh Girth (cm)' },
      { key: 'knee_girth', label: 'Knee Girth (cm)' },
      { key: 'hem_girth', label: 'Hem Girth (cm)' },
    ];

    // Dress measurements
    const dresses = [
      { key: 'side_neck_to_hem', label: 'Side Neck to Hem (cm)' },
      { key: 'back_neck_to_hem', label: 'Back Neck to Hem (cm)' },
      { key: 'front_length', label: 'Front Length (cm)' },
      { key: 'back_length', label: 'Back Length (cm)' },
      { key: 'sleeve_length', label: 'Sleeve Length (cm)' },
    ];

    let measurements = [...common];
    if (category === 'upper') {
      measurements = [...measurements, ...upper];
    } else if (category === 'lower') {
      measurements = [...measurements, ...lower];
    } else if (category === 'dresses') {
      measurements = [...measurements, ...dresses];
    }

    return measurements.map((m) => (
      <View key={m.key} style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          {m.label.replace('(cm)', `(${formData.measurement_unit})`)}
        </Text>
        <TextInput
          style={styles.input}
          value={formData[m.key]}
          onChangeText={(text) => setFormData({ ...formData, [m.key]: text })}
          placeholder={`Optional (${formData.measurement_unit})`}
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
        />
      </View>
    ));
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
                <Text style={styles.inputLabel}>Color</Text>
                <TextInput
                  style={styles.input}
                  value={formData.color}
                  onChangeText={(text) => setFormData({ ...formData, color: text })}
                  placeholder="Color"
                  placeholderTextColor="#666"
                />
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
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Measurement Unit</Text>
                <View style={styles.radioGroup}>
                  {['cm', 'in'].map((unit) => (
                    <Pressable
                      key={unit}
                      style={[
                        styles.radioButton,
                        formData.measurement_unit === unit && styles.radioButtonActive,
                      ]}
                      onPress={() => {
                        // Convert existing measurements when unit changes
                        const currentUnit = formData.measurement_unit;
                        const newUnit = unit;
                        const updatedData = { ...formData, measurement_unit: newUnit };
                        
                        // Convert all measurement fields
                        const measurementFields = [
                          'chest', 'waist', 'hip', 'front_length', 'back_length', 'sleeve_length',
                          'back_width', 'arm_width', 'shoulder_width', 'collar_girth', 'cuff_girth',
                          'armscye_depth', 'across_chest_width', 'front_rise', 'back_rise', 'inseam',
                          'outseam', 'thigh_girth', 'knee_girth', 'hem_girth', 'side_neck_to_hem', 'back_neck_to_hem'
                        ];
                        
                        measurementFields.forEach(field => {
                          if (updatedData[field] && !isNaN(updatedData[field])) {
                            const value = parseFloat(updatedData[field]);
                            if (currentUnit === 'cm' && newUnit === 'in') {
                              updatedData[field] = (value / 2.54).toFixed(2);
                            } else if (currentUnit === 'in' && newUnit === 'cm') {
                              updatedData[field] = (value * 2.54).toFixed(2);
                            }
                          }
                        });
                        
                        setFormData(updatedData);
                      }}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          formData.measurement_unit === unit && styles.radioButtonTextActive,
                        ]}
                      >
                        {unit.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.sectionSubtitle, { marginTop: Spacing.xs }]}>
                  Measurements will be stored in cm. You can enter in {formData.measurement_unit === 'cm' ? 'centimeters' : 'inches'} and they will be converted automatically.
                </Text>
              </View>
              {renderMeasurementInputs()}
            </View>
          </ScrollView>
        </SafeAreaView>
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
});

export default AdminGarmentsScreen;

