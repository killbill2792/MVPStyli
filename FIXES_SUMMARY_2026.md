# Fixes Applied - January 2026

## ✅ 1. Price Tracking Persistence
**Issue**: Price tracking wasn't saving when app closed and reopened.

**Fix**: Restored AsyncStorage save/load functionality in `App.js`:
- Added `useEffect` to load price tracking from AsyncStorage on app start
- Added `useEffect` to save price tracking to AsyncStorage whenever it changes
- Price tracking now persists across app restarts

## ✅ 2. Fit Check Brand Selection - Show Dimensions
**Issue**: After selecting a brand (H&M, Nike, etc.), dimensions weren't shown for confirmation.

**Fix**: Updated `components/AskAISheet.js`:
- When brand is selected, size chart is now stored in `pendingParsedData`
- Shows confirmation modal with dimensions table (same as screenshot OCR)
- User can review dimensions and click "Confirm & Continue" to proceed
- Analysis runs after confirmation

## ✅ 3. Admin Garment Size Entry - Simplified
**Issue**: Confusing size entry with text field and separate measurement entry.

**Fix**: Updated `screens/AdminGarmentsScreen.js`:
- **Removed** the "Size" text input field
- **Replaced** "Add Size" button with modal that has 3 options (matching fit check):
  1. **Select Brand**: Choose from H&M, Nike, Adidas, Uniqlo, Zara, Banana Republic
  2. **Upload Screenshot**: Take photo of size chart (uses OCR)
  3. **Enter Manually**: Opens manual entry form
- Brand selection shows dimensions for confirmation before adding
- All sizes are added to the `sizes` array with measurements

## ✅ 4. Style Tags Modal Not Opening
**Issue**: Tapping "Style Tags" in admin garment screen did nothing.

**Fix**: Updated `screens/AdminGarmentsScreen.js`:
- Added `onRequestClose` handler to modal
- Added logging to debug modal state
- Ensured modal is not nested inside form modal
- Added `transparent={false}` to ensure modal renders properly
- Modal should now open when "Style Tags" is tapped

## ⚠️ 5. Skin Tone API Logs Not Showing in Vercel
**Issue**: Client logs show API is working, but Vercel dashboard doesn't show calculation logs.

**Status**: Logs are present in code. Possible reasons:
1. **Vercel logs may be filtered** - Check Vercel Dashboard > Your Project > Functions > `analyze-skin-tone` > Logs tab
2. **Logs may not appear in real-time** - Vercel may buffer logs
3. **Check function-specific logs** - Not all logs appear in main deployment logs

**What to check**:
- Go to Vercel Dashboard
- Select your project
- Go to **Functions** tab
- Click on `analyze-skin-tone`
- Check the **Logs** tab (not the main deployment logs)
- Look for logs prefixed with `🎨 [SKIN TONE API]`

**Note**: The API is working (client receives results), so logs should be there. They may just be in a different location in Vercel dashboard.

## ✅ 6. SQL Constraint Error - Brand Size Charts
**Issue**: `ERROR: 23505: duplicate key value violates unique constraint "brand_size_charts_brand_name_key"`

**Fix**: Updated `scripts/CREATE_BRAND_SIZE_CHARTS_TABLE.sql`:
- **Removed** `UNIQUE` constraint from `brand_name` column (line 6)
- **Kept** composite `UNIQUE(brand_name, category, size_label)` constraint (line 12)
- This allows same brand to have multiple categories (upper_body, lower_body, dresses)
- Each brand+category+size combination is still unique

**To apply fix**:
1. If table already exists with wrong constraint, run:
   ```sql
   ALTER TABLE public.brand_size_charts DROP CONSTRAINT IF EXISTS brand_size_charts_brand_name_key;
   ```
2. Then run the updated `CREATE_BRAND_SIZE_CHARTS_TABLE.sql` script
3. Or manually remove the UNIQUE constraint from brand_name column

## Files Modified
- `App.js` - Price tracking persistence, shop filters, console logging
- `components/AskAISheet.js` - Brand selection confirmation
- `screens/AdminGarmentsScreen.js` - Size entry modal, brand selection, style tags modal
- `api/analyze-skin-tone/index.ts` - Enhanced logging
- `scripts/CREATE_BRAND_SIZE_CHARTS_TABLE.sql` - Fixed constraint
- `lib/logger.js` - Created logger utility
- `lib/garmentUtils.js` - Console logging fixes

## Testing Checklist
- [ ] Price tracking persists after app restart
- [ ] Fit check shows brand dimensions for confirmation
- [ ] Admin garment "Add Size" opens modal with 3 options
- [ ] Brand selection in admin shows dimensions before adding
- [ ] Style tags modal opens when tapped
- [ ] SQL script runs without constraint errors
- [ ] Skin tone API logs appear in Vercel function logs
