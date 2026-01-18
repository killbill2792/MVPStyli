# API Endpoint Count for Vercel

## Current API Endpoints: 11 total ✅

1. ✅ `api/analyze-skin-tone/index.ts` - Face color analysis
2. ✅ `api/color/index.ts` - Color detection from images
3. ✅ `api/garment-clean/index.ts` - Image cleaning for try-on
4. ✅ `api/garments/index.ts` - Garment CRUD operations
5. ✅ `api/ocr-sizechart/index.ts` - OCR for size charts
6. ✅ `api/pod-guest-vote/index.ts` - Guest voting for pods
7. ✅ `api/pod-public/index.ts` - Public pod access
8. ✅ `api/searchwebproducts/index.ts` - Web product search
9. ✅ `api/suggested-products/index.ts` - Color-classified product suggestions (NEW)
10. ✅ `api/tryon/index.ts` - Start try-on job
11. ✅ `api/tryon/[id].ts` - Poll try-on status (dynamic route)

## Status: ✅ Under the 12-endpoint limit for Vercel free plan

**Remaining capacity:** 1 endpoint

## Removed Endpoints

- ❌ `api/productfromurl/index.ts` - **REMOVED** (URL parsing no longer used in app)
  - Removed from `screens/ChatScreen.js`
  - Removed `isUrl()` and `importProductFromUrl()` functions from `lib/productSearch.ts`

## Notes

- `api/tryon/[id].ts` is a dynamic route that counts as 1 endpoint
- All endpoints are actively used in the application
