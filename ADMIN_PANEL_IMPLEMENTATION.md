# Admin Panel & Supabase Garments Implementation

This document describes the implementation of the admin panel for managing garments with detailed measurements in Supabase.

## Overview

The implementation includes:
1. **Database Schema**: Garments table with comprehensive measurement fields
2. **Admin Panel**: React Native screen for managing garments (CRUD operations)
3. **API Endpoints**: RESTful API for garment management
4. **Integration**: Updated tryon and AI insights to use garment dimensions

## Database Schema

### Garments Table

Created via SQL migration: `scripts/CREATE_GARMENTS_TABLE.sql`

**Key Features:**
- Supports three categories: `upper`, `lower`, `dresses`
- Supports three genders: `men`, `women`, `unisex`
- Image storage via Supabase Storage (URLs stored in `image_url`)
- Comprehensive measurement fields (all optional):
  - **Common**: chest, waist, hip
  - **Upper body**: front_length, back_length, sleeve_length, back_width, arm_width, shoulder_width, collar_girth, cuff_girth, armscye_depth, across_chest_width
  - **Lower body**: front_rise, back_rise, inseam, outseam, thigh_girth, knee_girth, hem_girth
  - **Dresses**: side_neck_to_hem, back_neck_to_hem

**To apply the migration:**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL from `scripts/CREATE_GARMENTS_TABLE.sql`

## Admin Panel

**Location**: `screens/AdminGarmentsScreen.js`

**Features:**
- List all garments with filtering by category and gender
- Create new garments with image upload
- Edit existing garments
- Delete/deactivate garments
- Form dynamically shows relevant measurements based on category
- Image upload to Supabase Storage (automatically converts to URL)

**Navigation:**
- Accessible from Account screen → "Admin: Garments" section
- Route: `admingarments`

## API Endpoints

### Garments API
**Location**: `api/garments/index.ts`

**Endpoints:**
- `GET /api/garments` - List all garments (supports filters: `category`, `gender`, `active_only`)
- `GET /api/garments?id={id}` - Get single garment
- `POST /api/garments` - Create new garment
- `PUT /api/garments` - Update garment
- `DELETE /api/garments?id={id}` - Delete garment (soft delete by default, use `hard_delete=true` for permanent)

**Request Body Example (POST/PUT):**
```json
{
  "name": "Classic T-Shirt",
  "category": "upper",
  "gender": "unisex",
  "image_url": "https://...",
  "brand": "Brand Name",
  "price": 29.99,
  "chest": 100,
  "waist": 90,
  "sleeve_length": 25,
  "is_active": true
}
```

## Integration Updates

### Try-On API
**Location**: `api/tryon/index.ts`

**Updates:**
- Now accepts optional `garment_id` parameter
- Fetches garment dimensions from database if `garment_id` is provided
- Includes dimensions in `garment_des` sent to Replicate
- Returns garment dimensions in response for client use

**Usage:**
```javascript
// In your tryon call, include garment_id if available
const response = await fetch(`${API}/api/tryon`, {
  method: 'POST',
  body: JSON.stringify({
    human_img: personUrl,
    garm_img: clothUrl,
    category: 'upper_body',
    garment_id: 'uuid-here' // Optional
  })
});
```

### AI Insights API
**Location**: `api/ai-insights/index.ts`

**Updates:**
- Now accepts optional `garment_id` parameter
- Fetches garment dimensions from database if `garment_id` is provided
- Includes dimensions in product description sent to Gemini AI
- Uses dimensions for more accurate size recommendations

**Usage:**
```javascript
// In your AI insights call, include garment_id if available
const response = await fetch(`${API}/api/ai-insights`, {
  method: 'POST',
  body: JSON.stringify({
    userProfile: {...},
    product: {...},
    insightType: 'size',
    garment_id: 'uuid-here' // Optional
  })
});
```

## Image Upload

Images are uploaded to Supabase Storage bucket `images` and automatically converted to public URLs.

**Process:**
1. User selects image from device
2. Image is uploaded via `uploadImageAsync()` from `lib/upload.ts`
3. Supabase returns public URL
4. URL is stored in `garment.image_url`

**Storage Path**: `garments/{timestamp}-{random}.jpg`

## Measurement Fields

All measurement fields are optional. The form dynamically shows relevant fields based on the selected category:

- **Upper**: Shows upper body measurements (sleeve length, back width, etc.)
- **Lower**: Shows lower body measurements (front rise, inseam, etc.)
- **Dresses**: Shows dress-specific measurements (side neck to hem, etc.)

Common measurements (chest, waist, hip) are shown for all categories.

## Environment Variables

Ensure these are set in your Vercel environment:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Next Steps

1. **Run the SQL migration** in Supabase to create the garments table
2. **Test the admin panel** by creating a few sample garments
3. **Update product selection** to optionally link to garments (add `garment_id` to products)
4. **Update tryon calls** to pass `garment_id` when available
5. **Update AI insights calls** to pass `garment_id` when available

## Notes

- All measurements are stored in centimeters (cm)
- Not all measurements are required - only fill in what's available
- The admin panel is accessible to all authenticated users (you may want to add role-based access control)
- Images are stored in Supabase Storage and automatically converted to public URLs
- Soft delete is the default (sets `is_active = false`) - use `hard_delete=true` query param for permanent deletion

