/**
 * Garment Management API
 * Handles CRUD operations for garments with detailed measurements
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { classifyGarment } from '../../lib/colorClassification';

// Initialize Supabase client with any type to avoid strict typing issues
let supabase: ReturnType<typeof createClient<any, any>> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL or SUPABASE_ANON_KEY');
    }

    // Use 'any' type parameters to avoid strict schema typing
    supabase = createClient<any, any>(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// CORS helper
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Helper to check if user is admin
function isAdminUser(req: VercelRequest): boolean {
  // Get user email from request body or query params
  const adminEmail = req.body?.admin_email || req.query?.admin_email;
  
  // Only admin@stylit.ai can access
  return adminEmail === 'admin@stylit.ai';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers first
  setCors(res);
  
  // Set Content-Type to JSON for all responses
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  try {
    // Initialize Supabase client
    const supabase = getSupabaseClient();
    // Check admin access for write operations (POST, PUT, DELETE)
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      if (!isAdminUser(req)) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Admin access required. Only admin@stylit.ai can perform this operation.' 
        });
      }
    }
    // GET - List all garments or get single garment
    if (req.method === 'GET') {
      const { id, category, gender, active_only } = req.query;

      if (id) {
        // Get single garment with sizes
        const { data: garment, error: garmentError } = await supabase
          .from('garments')
          .select('*')
          .eq('id', id)
          .single();

        if (garmentError) {
          return res.status(404).json({ error: 'Garment not found', details: garmentError.message });
        }

        // Get sizes for this garment (if table exists)
        let sizes = [];
        try {
          const { data: sizesData, error: sizesError } = await supabase
            .from('garment_sizes')
            .select('*')
            .eq('garment_id', id)
            .order('size_label');

          if (sizesError) {
            // If table doesn't exist, that's OK - just return empty sizes array
            if (sizesError.message?.includes('does not exist') || sizesError.code === '42P01') {
              console.warn('garment_sizes table does not exist yet. Run SQL migration.');
            } else {
              console.warn('Error fetching sizes:', sizesError);
            }
          } else if (sizesData) {
            sizes = sizesData;
          }
        } catch (err: any) {
          // Table might not exist - that's OK
          console.warn('Could not fetch sizes (table may not exist):', err.message);
        }

        if (!garment) {
          return res.status(404).json({ error: 'Garment not found' });
        }

        return res.status(200).json({ 
          garment: { ...garment, sizes: sizes }
        });
      }

      // List garments with optional filters
      let query = supabase.from('garments').select('*');

      if (active_only === 'true') {
        query = query.eq('is_active', true);
      }

      if (category && typeof category === 'string') {
        query = query.eq('category', category);
      }

      if (gender && typeof gender === 'string') {
        query = query.eq('gender', gender);
      }

      query = query.order('created_at', { ascending: false });

      const { data: garments, error } = await query;

      if (error) {
        console.error('Error fetching garments:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        // Check if it's an RLS error
        if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.code === '42501') {
          return res.status(500).json({ 
            error: 'Database permission error', 
            details: 'Please run the SQL migration script FIX_GARMENTS_RLS_AND_MULTI_SIZE.sql in Supabase to fix RLS policies.',
            hint: error.message,
            code: error.code
          });
        }
        
        // Check if table doesn't exist
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          return res.status(500).json({ 
            error: 'Table not found', 
            details: 'The garments table does not exist. Please run the SQL migration script CREATE_GARMENTS_TABLE.sql in Supabase.',
            hint: error.message,
            code: error.code
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to fetch garments', 
          details: error.message,
          code: error.code,
          hint: error.hint
        });
      }

      // Fetch sizes for all garments (if garment_sizes table exists)
      if (garments && Array.isArray(garments) && garments.length > 0) {
        const garmentIds = garments.map((g: any) => g.id).filter((id: any) => id != null);
        let allSizes = null;
        
        try {
          const { data, error } = await supabase
            .from('garment_sizes')
            .select('*')
            .in('garment_id', garmentIds);
          
          if (error) {
            // If table doesn't exist, just continue without sizes
            if (error.message?.includes('does not exist') || error.code === '42P01') {
              console.warn('garment_sizes table does not exist yet. Run SQL migration.');
            } else {
              console.error('Error fetching sizes:', error);
            }
          } else {
            allSizes = data;
          }
        } catch (err: any) {
          // Table might not exist - that's OK, just continue without sizes
          console.warn('Could not fetch sizes (table may not exist):', err.message);
        }

        // Group sizes by garment_id
        const sizesByGarment: { [key: string]: any[] } = {};
        if (allSizes) {
          allSizes.forEach(size => {
            if (!sizesByGarment[size.garment_id]) {
              sizesByGarment[size.garment_id] = [];
            }
            sizesByGarment[size.garment_id].push(size);
          });
        }

        // Attach sizes to each garment (empty array if no sizes)
        const garmentsWithSizes = garments.map((garment: any) => ({
          ...garment,
          sizes: sizesByGarment[garment.id] || []
        }));

        return res.status(200).json({ garments: garmentsWithSizes });
      }

      return res.status(200).json({ garments: garments || [] });
    }

    // POST - Create new garment with multiple sizes
    if (req.method === 'POST') {
      const {
        name,
        description,
        category,
        gender,
        image_url,
        additional_images,
        product_link,
        brand,
        price,
        material,
        color,
        color_hex, // Hex color code for classification
        fit_type, // slim | regular | relaxed | oversized
        fabric_stretch, // none | low | medium | high
        tags,
        is_active,
        created_by,
        sizes, // Array of size objects: [{ size_label: 'S', chest_width: 50, ... }, ...]
      } = req.body;

      // Validate required fields
      if (!name || !category) {
        return res.status(400).json({ error: 'name and category are required' });
      }

      if (!['upper', 'lower', 'dresses'].includes(category)) {
        return res.status(400).json({ error: 'category must be upper, lower, or dresses' });
      }

      if (gender && !['men', 'women', 'unisex'].includes(gender)) {
        return res.status(400).json({ error: 'gender must be men, women, or unisex' });
      }

      // Validate fit_type and fabric_stretch if provided
      if (fit_type && !['slim', 'regular', 'relaxed', 'oversized'].includes(fit_type)) {
        return res.status(400).json({ error: 'fit_type must be slim, regular, relaxed, or oversized' });
      }

      if (fabric_stretch && !['none', 'low', 'medium', 'high'].includes(fabric_stretch)) {
        return res.status(400).json({ error: 'fabric_stretch must be none, low, medium, or high' });
      }

      // Classify color if color_hex is provided
      let classificationData: any = {};
      if (color_hex && typeof color_hex === 'string') {
        try {
          const classification = classifyGarment(color_hex);
          // Use the classification status directly
          // New constraint (from ADD_SECONDARY_SEASON_AND_STATUS.sql): 'great', 'good', 'ambiguous', 'unclassified'
          // Old constraint: 'ok', 'ambiguous', 'unclassified'
          // Since user ran ADD_SECONDARY_SEASON_AND_STATUS.sql, use new values directly
          classificationData = {
            dominant_hex: classification.dominantHex,
            lab_l: classification.lab.L,
            lab_a: classification.lab.a,
            lab_b: classification.lab.b,
            // Primary classification
            season_tag: classification.seasonTag,
            micro_season_tag: classification.microSeasonTag,
            group_tag: classification.groupTag,
            nearest_palette_color_name: classification.nearestPaletteColor?.name || null,
            min_delta_e: classification.minDeltaE,
            // Status: use new values directly (great, good, ambiguous, unclassified)
            classification_status: classification.classificationStatus,
          };
          // Note: Secondary classification fields are not included for backward compatibility
          // with databases that don't have these columns yet
        } catch (error) {
          console.error('Error classifying color:', error);
          // Continue without classification if it fails
        }
      }

      // Build garment data object (simplified - no measurements on garment itself)
      const garmentData: any = {
        name,
        category,
        description,
        gender,
        image_url,
        additional_images: Array.isArray(additional_images) ? additional_images : undefined,
        product_link,
        brand,
        price: price ? parseFloat(price) : undefined,
        material,
        color,
        color_hex, // Store the hex value
        fit_type,
        fabric_stretch,
        tags: Array.isArray(tags) ? tags : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        created_by,
        ...classificationData, // Include classification results
      };

      // Remove undefined values
      Object.keys(garmentData).forEach((key) => {
        if (garmentData[key] === undefined || garmentData[key] === null || garmentData[key] === '') {
          delete garmentData[key];
        }
      });

      // Create the garment
      const result = await supabase
        .from('garments')
        .insert(garmentData)
        .select()
        .single();
      
      const garment = result.data;
      const garmentError = result.error;

      if (garmentError || !garment) {
        console.error('Error creating garment:', garmentError);
        return res.status(500).json({ error: 'Failed to create garment', details: garmentError?.message || 'Garment creation failed' });
      }

      // Create sizes if provided
      if (Array.isArray(sizes) && sizes.length > 0) {
        const sizeData = sizes
          .filter((size: any) => size.size_label && size.size_label.trim() !== '') // Only include sizes with labels
          .map((size: any) => {
            if (!garment.id) {
              throw new Error('Garment ID is required to create sizes');
            }
            
            const sizeObj: any = {
              garment_id: garment.id,
              size_label: size.size_label.trim(),
            };
            
            // Universal measurements (circumference, stored in inches)
            if (size.chest_circumference && !isNaN(size.chest_circumference)) {
              sizeObj.chest_circumference = parseFloat(size.chest_circumference);
            }
            if (size.waist_circumference && !isNaN(size.waist_circumference)) {
              sizeObj.waist_circumference = parseFloat(size.waist_circumference);
            }
            if (size.hip_circumference && !isNaN(size.hip_circumference)) {
              sizeObj.hip_circumference = parseFloat(size.hip_circumference);
            }
            if (size.garment_length_in && !isNaN(size.garment_length_in)) {
              sizeObj.garment_length_in = parseFloat(size.garment_length_in);
            }
            // Upper body (lengths in inches)
            if (size.shoulder_width_in && !isNaN(size.shoulder_width_in)) {
              sizeObj.shoulder_width_in = parseFloat(size.shoulder_width_in);
            }
            if (size.sleeve_length_in && !isNaN(size.sleeve_length_in)) {
              sizeObj.sleeve_length_in = parseFloat(size.sleeve_length_in);
            }
            // Lower body (circumference and lengths in inches)
            if (size.inseam_in && !isNaN(size.inseam_in)) {
              sizeObj.inseam_in = parseFloat(size.inseam_in);
            }
            if (size.rise_in && !isNaN(size.rise_in)) {
              sizeObj.rise_in = parseFloat(size.rise_in);
            }
            if (size.thigh_circumference && !isNaN(size.thigh_circumference)) {
              sizeObj.thigh_circumference = parseFloat(size.thigh_circumference);
            }
            if (size.leg_opening_circumference && !isNaN(size.leg_opening_circumference)) {
              sizeObj.leg_opening_circumference = parseFloat(size.leg_opening_circumference);
            }
            
            return sizeObj;
          });

        if (sizeData.length > 0) {
          const { error: sizesError } = await supabase
            .from('garment_sizes')
            .insert(sizeData as unknown as any[]);

          if (sizesError) {
            console.error('Error creating sizes:', sizesError);
            // If sizes table doesn't exist, return a helpful error
            if (sizesError.message?.includes('does not exist') || sizesError.code === '42P01') {
              return res.status(500).json({ 
                error: 'Database schema not ready', 
                details: 'Please run the SQL migration script FIX_GARMENTS_RLS_AND_MULTI_SIZE.sql in Supabase to create the garment_sizes table.' 
              });
            }
            // Don't fail the whole request for other size errors, just log
            console.warn('Some sizes may not have been saved:', sizesError.message);
          }
        }
      }

      // Fetch the created garment with sizes
      const { data: garmentSizes } = await supabase
        .from('garment_sizes')
        .select('*')
        .eq('garment_id', garment.id)
        .order('size_label');

      return res.status(201).json({ 
        garment: { ...garment, sizes: garmentSizes || [] }
      });
    }

    // PUT - Update garment
    if (req.method === 'PUT') {
      const { id, admin_email, sizes, ...rawData } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'id is required for updates' });
      }

      // Only allow specific fields to be updated (whitelist approach)
      // Start with base fields that always exist
      const baseAllowedFields = [
        'name', 'description', 'category', 'gender', 'image_url', 'additional_images',
        'product_link', 'brand', 'price', 'material', 'color', 'color_hex',
        'fit_type', 'fabric_stretch', 'tags', 'is_active', 'measurement_unit',
        // Color classification fields (always present from ADD_COLOR_CLASSIFICATION_TO_GARMENTS.sql)
        'dominant_hex', 'lab_l', 'lab_a', 'lab_b',
        'season_tag', 'group_tag', 
        'nearest_palette_color_name', 'min_delta_e', 'classification_status',
      ];
      
      // Optional fields that may not exist in older schemas
      // Only include if they're explicitly being sent (suggests they exist in DB)
      const optionalFields = [];
      if (rawData.micro_season_tag !== undefined) {
        // Only include if explicitly being sent (not from classification)
        optionalFields.push('micro_season_tag');
      }
      if (rawData.secondary_season_tag !== undefined || rawData.secondary_micro_season_tag !== undefined) {
        // Only include if explicitly being sent (not from classification)
        optionalFields.push('secondary_micro_season_tag', 'secondary_season_tag', 'secondary_group_tag', 'secondary_delta_e');
      }
      
      const allowedFields = [...baseAllowedFields, ...optionalFields];

      // Filter to only allowed fields
      const updateData: Record<string, any> = {};
      allowedFields.forEach((field) => {
        if (rawData[field] !== undefined) {
          updateData[field] = rawData[field];
        }
      });

      // Classify color if color_hex is being updated
      if (updateData.color_hex && typeof updateData.color_hex === 'string') {
        try {
          const classification = classifyGarment(updateData.color_hex);
          updateData.dominant_hex = classification.dominantHex;
          updateData.lab_l = classification.lab.L;
          updateData.lab_a = classification.lab.a;
          updateData.lab_b = classification.lab.b;
          // Primary classification - only set fields that exist in database
          updateData.season_tag = classification.seasonTag;
          updateData.group_tag = classification.groupTag;
          // Only set micro_season_tag if it was explicitly in the request (column exists)
          // This field is added by ADD_MICRO_SEASON_TO_GARMENTS.sql migration
          // Don't set it from classification if column might not exist
          if (rawData.micro_season_tag !== undefined || allowedFields.includes('micro_season_tag')) {
            updateData.micro_season_tag = classification.microSeasonTag;
          }
          updateData.nearest_palette_color_name = classification.nearestPaletteColor?.name || null;
          updateData.min_delta_e = classification.minDeltaE;
          // Status handling: Use the classification status directly
          // New constraint (from ADD_SECONDARY_SEASON_AND_STATUS.sql): 'great', 'good', 'ambiguous', 'unclassified'
          // Old constraint (from ADD_COLOR_CLASSIFICATION_TO_GARMENTS.sql): 'ok', 'ambiguous', 'unclassified'
          // Since user ran ADD_SECONDARY_SEASON_AND_STATUS.sql, use new values directly
          // If database has old constraint, we'll get an error and can handle it
          const status = classification.classificationStatus;
          updateData.classification_status = status;
          // Secondary classification (for crossover colors) - only set if columns exist
          // Only set if they were explicitly in the request (columns exist)
          const hasSecondaryFields = rawData.secondary_season_tag !== undefined || rawData.secondary_micro_season_tag !== undefined;
          if (hasSecondaryFields && classification.secondarySeasonTag) {
            if (allowedFields.includes('secondary_micro_season_tag')) {
              updateData.secondary_micro_season_tag = classification.secondaryMicroSeasonTag;
            }
            if (allowedFields.includes('secondary_season_tag')) {
              updateData.secondary_season_tag = classification.secondarySeasonTag;
            }
            if (allowedFields.includes('secondary_group_tag')) {
              updateData.secondary_group_tag = classification.secondaryGroupTag;
            }
            if (allowedFields.includes('secondary_delta_e')) {
              updateData.secondary_delta_e = classification.secondaryDeltaE;
            }
          } else if (hasSecondaryFields) {
            // Clear secondary fields if no secondary classification and columns exist
            if (allowedFields.includes('secondary_micro_season_tag')) {
              updateData.secondary_micro_season_tag = null;
            }
            if (allowedFields.includes('secondary_season_tag')) {
              updateData.secondary_season_tag = null;
            }
            if (allowedFields.includes('secondary_group_tag')) {
              updateData.secondary_group_tag = null;
            }
            if (allowedFields.includes('secondary_delta_e')) {
              updateData.secondary_delta_e = null;
            }
          }
        } catch (error) {
          console.error('Error classifying color:', error);
          // Continue without classification if it fails
        }
      }

      // Validate category if provided
      if (updateData.category && !['upper', 'lower', 'dresses'].includes(updateData.category)) {
        return res.status(400).json({ error: 'category must be upper, lower, or dresses' });
      }

      // Validate gender if provided
      if (updateData.gender && !['men', 'women', 'unisex'].includes(updateData.gender)) {
        return res.status(400).json({ error: 'gender must be men, women, or unisex' });
      }

      // Parse numeric fields
      const numericFields = [
        'price', 'lab_l', 'lab_a', 'lab_b', 'min_delta_e'
      ];

      numericFields.forEach((field) => {
        if (updateData[field] !== undefined && updateData[field] !== null && updateData[field] !== '') {
          updateData[field] = parseFloat(updateData[field]);
        }
      });

      // Remove undefined/null/empty string values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined || updateData[key] === null || updateData[key] === '') {
          delete updateData[key];
        }
      });

      // Remove any fields that might cause issues
      // Remove read-only fields
      delete updateData.id;
      delete updateData.created_at;
      delete updateData.updated_at;
      delete updateData.created_by;
      
      // Remove any undefined/null/empty values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined || updateData[key] === null || updateData[key] === '') {
          delete updateData[key];
        }
      });
      
      console.log('Updating garment with data:', JSON.stringify(updateData, null, 2));
      
      // Update the garment
      const result = await supabase
        .from('garments')
        .update(updateData as Record<string, any>)
        .eq('id', id)
        .select()
        .single();
      
      const garment = result.data;
      const garmentError = result.error;

      if (garmentError) {
        console.error('Error updating garment:', garmentError);
        console.error('Error code:', garmentError.code);
        console.error('Error message:', garmentError.message);
        console.error('Error details:', garmentError.details);
        console.error('Error hint:', garmentError.hint);
        return res.status(500).json({ 
          error: 'Failed to update garment', 
          details: garmentError.message || JSON.stringify(garmentError),
          code: garmentError.code,
          hint: garmentError.hint
        });
      }

      if (!garment) {
        return res.status(404).json({ error: 'Garment not found' });
      }

      // Update sizes if provided
      if (Array.isArray(sizes) && sizes.length > 0) {
        // First, delete existing sizes for this garment
        await supabase
          .from('garment_sizes')
          .delete()
          .eq('garment_id', id);

        // Then insert new sizes
        const sizeData = sizes
          .filter((size: any) => size.size_label && size.size_label.trim() !== '')
          .map((size: any) => {
            const sizeObj: any = {
              garment_id: id,
              size_label: size.size_label.trim(),
            };
            
            // Universal measurements (circumference, stored in inches)
            if (size.chest_circumference && !isNaN(size.chest_circumference)) {
              sizeObj.chest_circumference = parseFloat(size.chest_circumference);
            }
            if (size.waist_circumference && !isNaN(size.waist_circumference)) {
              sizeObj.waist_circumference = parseFloat(size.waist_circumference);
            }
            if (size.hip_circumference && !isNaN(size.hip_circumference)) {
              sizeObj.hip_circumference = parseFloat(size.hip_circumference);
            }
            if (size.garment_length_in && !isNaN(size.garment_length_in)) {
              sizeObj.garment_length_in = parseFloat(size.garment_length_in);
            }
            // Upper body (lengths in inches)
            if (size.shoulder_width_in && !isNaN(size.shoulder_width_in)) {
              sizeObj.shoulder_width_in = parseFloat(size.shoulder_width_in);
            }
            if (size.sleeve_length_in && !isNaN(size.sleeve_length_in)) {
              sizeObj.sleeve_length_in = parseFloat(size.sleeve_length_in);
            }
            // Lower body (circumference and lengths in inches)
            if (size.inseam_in && !isNaN(size.inseam_in)) {
              sizeObj.inseam_in = parseFloat(size.inseam_in);
            }
            if (size.rise_in && !isNaN(size.rise_in)) {
              sizeObj.rise_in = parseFloat(size.rise_in);
            }
            if (size.thigh_circumference && !isNaN(size.thigh_circumference)) {
              sizeObj.thigh_circumference = parseFloat(size.thigh_circumference);
            }
            if (size.leg_opening_circumference && !isNaN(size.leg_opening_circumference)) {
              sizeObj.leg_opening_circumference = parseFloat(size.leg_opening_circumference);
            }
            
            return sizeObj;
          });

        if (sizeData.length > 0) {
          const { error: sizesError } = await supabase
            .from('garment_sizes')
            .insert(sizeData as unknown as any[]);

          if (sizesError) {
            console.error('Error updating sizes:', sizesError);
            // Don't fail the whole request, just log the error
          }
        }
      }

      // Fetch the updated garment with sizes
      const { data: garmentSizes } = await supabase
        .from('garment_sizes')
        .select('*')
        .eq('garment_id', id)
        .order('size_label');

      if (!garment) {
        return res.status(404).json({ error: 'Garment not found' });
      }

      return res.status(200).json({ 
        garment: { ...garment, sizes: garmentSizes || [] }
      });
    }

    // DELETE - Delete garment (soft delete by setting is_active to false)
    if (req.method === 'DELETE') {
      const { id, hard_delete } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'id is required for deletion' });
      }

      if (hard_delete === 'true') {
        // Hard delete
        const { error } = await supabase
          .from('garments')
          .delete()
          .eq('id', id);

        if (error) {
          return res.status(500).json({ error: 'Failed to delete garment', details: error.message });
        }

        return res.status(200).json({ message: 'Garment deleted permanently' });
      } else {
        // Soft delete
        const { data, error } = await supabase
          .from('garments')
          .update({ is_active: false } as any)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: 'Failed to deactivate garment', details: error.message });
        }

        return res.status(200).json({ garment: data, message: 'Garment deactivated' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in garments API:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return JSON, even for unexpected errors
    const errorMessage = error?.message || 'Unknown error occurred';
    const errorDetails = {
      error: 'Internal server error',
      message: errorMessage,
      type: error?.name || 'Error',
      ...(process.env.NODE_ENV === 'development' && { stack: error?.stack })
    };
    
    return res.status(500).json(errorDetails);
  }
}

