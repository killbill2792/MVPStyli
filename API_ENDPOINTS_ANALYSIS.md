# API Endpoints Analysis & Optimization

## Current Endpoints (14 total - EXCEEDS 12 limit)

1. ✅ **ai-insights** - Used in AskAISheet.js (Gemini AI insights)
2. ✅ **detect-color** - NEW, used in AskAISheet.js (color detection)
3. ✅ **parse-size-chart** - NEW, used in AskAISheet.js (OCR parsing)
4. ✅ **garments** - Used in garmentUtils.js, AdminGarmentsScreen.js (CRUD operations)
5. ✅ **garment-clean** - Used in cleaner.ts (image cleaning for try-on)
6. ✅ **pod-guest-vote** - Used for web voting (external web app)
7. ✅ **pod-public** - Used for web voting (external web app)
8. ✅ **productfromurl** - Used in productSearch.ts (import product from URL)
9. ❌ **scrape-product** - NOT USED (can be removed)
10. ✅ **searchwebproducts** - Used in productSearch.ts (web product search)
11. ✅ **tryon** - Used in tryon.ts (POST - start try-on job)
12. ✅ **tryon/[id]** - Used in tryon.ts (GET - poll try-on status)

## Optimization Plan

### Option 1: Remove Unused + Merge New Endpoints (RECOMMENDED)
- Remove: `scrape-product` (not used)
- Merge: `detect-color` + `parse-size-chart` → `/api/fit-check-utils` (single endpoint with `type` parameter)
- **Result: 11 endpoints** ✅ (under 12 limit)

### Option 2: Remove Unused + Merge Product Endpoints
- Remove: `scrape-product` (not used)
- Merge: `productfromurl` + `searchwebproducts` → `/api/products` (single endpoint with `action` parameter)
- **Result: 12 endpoints** ✅ (exactly at limit)

### Option 3: Remove Multiple Unused
- Remove: `scrape-product` (not used)
- Remove: `detect-color` (move to client-side or merge)
- Remove: `parse-size-chart` (move to client-side or merge)
- **Result: 11 endpoints** ✅ (under 12 limit)

## Recommended: Option 1
- Keeps all functionality
- Merges the 2 new endpoints into 1
- Removes unused endpoint
- Safest approach with room for future growth

