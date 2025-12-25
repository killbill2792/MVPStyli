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
        // Get single garment
        const { data, error } = await supabase
          .from('garments')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return res.status(404).json({ error: 'Garment not found', details: error.message });
        }

        return res.status(200).json({ garment: data });
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

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch garments', details: error.message });
      }

      return res.status(200).json({ garments: data || [] });
    }

    // POST - Create new garment
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
        size,
        measurement_unit,
        // Upper body measurements
        chest,
        waist,
        hip,
        front_length,
        back_length,
        sleeve_length,
        back_width,
        arm_width,
        shoulder_width,
        collar_girth,
        cuff_girth,
        armscye_depth,
        across_chest_width,
        // Lower body measurements
        front_rise,
        back_rise,
        inseam,
        outseam,
        thigh_girth,
        knee_girth,
        hem_girth,
        // Dress measurements
        side_neck_to_hem,
        back_neck_to_hem,
        // Metadata
        tags,
        is_active,
        created_by,
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

      // Build garment data object (only include provided fields)
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
        size,
        measurement_unit: measurement_unit || 'cm',
        tags: Array.isArray(tags) ? tags : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        created_by,
      };

      // Add measurements only if provided (all optional)
      const measurements = {
        chest: chest ? parseFloat(chest) : undefined,
        waist: waist ? parseFloat(waist) : undefined,
        hip: hip ? parseFloat(hip) : undefined,
        front_length: front_length ? parseFloat(front_length) : undefined,
        back_length: back_length ? parseFloat(back_length) : undefined,
        sleeve_length: sleeve_length ? parseFloat(sleeve_length) : undefined,
        back_width: back_width ? parseFloat(back_width) : undefined,
        arm_width: arm_width ? parseFloat(arm_width) : undefined,
        shoulder_width: shoulder_width ? parseFloat(shoulder_width) : undefined,
        collar_girth: collar_girth ? parseFloat(collar_girth) : undefined,
        cuff_girth: cuff_girth ? parseFloat(cuff_girth) : undefined,
        armscye_depth: armscye_depth ? parseFloat(armscye_depth) : undefined,
        across_chest_width: across_chest_width ? parseFloat(across_chest_width) : undefined,
        front_rise: front_rise ? parseFloat(front_rise) : undefined,
        back_rise: back_rise ? parseFloat(back_rise) : undefined,
        inseam: inseam ? parseFloat(inseam) : undefined,
        outseam: outseam ? parseFloat(outseam) : undefined,
        thigh_girth: thigh_girth ? parseFloat(thigh_girth) : undefined,
        knee_girth: knee_girth ? parseFloat(knee_girth) : undefined,
        hem_girth: hem_girth ? parseFloat(hem_girth) : undefined,
        side_neck_to_hem: side_neck_to_hem ? parseFloat(side_neck_to_hem) : undefined,
        back_neck_to_hem: back_neck_to_hem ? parseFloat(back_neck_to_hem) : undefined,
      };

      // Only add defined measurements
      Object.keys(measurements).forEach((key) => {
        if (measurements[key as keyof typeof measurements] !== undefined) {
          garmentData[key] = measurements[key as keyof typeof measurements];
        }
      });

      const { data, error } = await supabase
        .from('garments')
        .insert(garmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating garment:', error);
        return res.status(500).json({ error: 'Failed to create garment', details: error.message });
      }

      return res.status(201).json({ garment: data });
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

