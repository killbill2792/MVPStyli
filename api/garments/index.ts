/**
 * Garment Management API
 * Handles CRUD operations for garments with detailed measurements
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
      if (garments && garments.length > 0) {
        const garmentIds = garments.map(g => g.id);
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
        const garmentsWithSizes = garments.map(garment => ({
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
        fit_type,
        fabric_stretch,
        tags: Array.isArray(tags) ? tags : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        created_by,
      };

      // Remove undefined values
      Object.keys(garmentData).forEach((key) => {
        if (garmentData[key] === undefined || garmentData[key] === null || garmentData[key] === '') {
          delete garmentData[key];
        }
      });

      // Create the garment first
      const { data: garment, error: garmentError } = await supabase
        .from('garments')
        .insert(garmentData)
        .select()
        .single();

      if (garmentError) {
        console.error('Error creating garment:', garmentError);
        return res.status(500).json({ error: 'Failed to create garment', details: garmentError.message });
      }

      // Create sizes if provided
      if (Array.isArray(sizes) && sizes.length > 0) {
        const sizeData = sizes
          .filter((size: any) => size.size_label && size.size_label.trim() !== '') // Only include sizes with labels
          .map((size: any) => {
            const sizeObj: any = {
              garment_id: garment.id,
              size_label: size.size_label.trim(),
            };
            
            // Universal measurements (flat widths, stored in cm)
            if (size.chest_width && !isNaN(size.chest_width)) {
              sizeObj.chest_width = parseFloat(size.chest_width);
            }
            if (size.waist_width && !isNaN(size.waist_width)) {
              sizeObj.waist_width = parseFloat(size.waist_width);
            }
            if (size.hip_width && !isNaN(size.hip_width)) {
              sizeObj.hip_width = parseFloat(size.hip_width);
            }
            if (size.garment_length && !isNaN(size.garment_length)) {
              sizeObj.garment_length = parseFloat(size.garment_length);
            }
            // Upper body
            if (size.shoulder_width && !isNaN(size.shoulder_width)) {
              sizeObj.shoulder_width = parseFloat(size.shoulder_width);
            }
            if (size.sleeve_length && !isNaN(size.sleeve_length)) {
              sizeObj.sleeve_length = parseFloat(size.sleeve_length);
            }
            // Lower body
            if (size.inseam && !isNaN(size.inseam)) {
              sizeObj.inseam = parseFloat(size.inseam);
            }
            if (size.rise && !isNaN(size.rise)) {
              sizeObj.rise = parseFloat(size.rise);
            }
            if (size.thigh_width && !isNaN(size.thigh_width)) {
              sizeObj.thigh_width = parseFloat(size.thigh_width);
            }
            if (size.leg_opening && !isNaN(size.leg_opening)) {
              sizeObj.leg_opening = parseFloat(size.leg_opening);
            }
            
            return sizeObj;
          });

        if (sizeData.length > 0) {
          const { error: sizesError } = await supabase
            .from('garment_sizes')
            .insert(sizeData);

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
      const { data: sizes } = await supabase
        .from('garment_sizes')
        .select('*')
        .eq('garment_id', garment.id)
        .order('size_label');

      return res.status(201).json({ 
        garment: { ...garment, sizes: sizes || [] }
      });
    }

    // PUT - Update garment
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'id is required for updates' });
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
        'price', 'chest', 'waist', 'hip', 'front_length', 'back_length', 'sleeve_length',
        'back_width', 'arm_width', 'shoulder_width', 'collar_girth', 'cuff_girth',
        'armscye_depth', 'across_chest_width', 'front_rise', 'back_rise', 'inseam',
        'outseam', 'thigh_girth', 'knee_girth', 'hem_girth', 'side_neck_to_hem', 'back_neck_to_hem'
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

      const { data, error } = await supabase
        .from('garments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating garment:', error);
        return res.status(500).json({ error: 'Failed to update garment', details: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Garment not found' });
      }

      return res.status(200).json({ garment: data });
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
          .update({ is_active: false })
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
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

