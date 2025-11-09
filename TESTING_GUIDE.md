# Testing Guide for Product Search & URL Import

## What Was Fixed

### 1. SerpAPI Integration Improvements
- ✅ Better error handling for API responses
- ✅ Improved price extraction (handles both string and number formats)
- ✅ Currency detection (USD, EUR, GBP)
- ✅ Better image URL extraction (thumbnail, image, original_image)
- ✅ Enhanced logging for debugging
- ✅ Proper error messages when API key is invalid or quota exceeded

### 2. Gap Factory / Banana Republic Factory Support
- ✅ Added dedicated scraper for Gap Factory URLs
- ✅ Supports multiple Gap brands: Gap, Banana Republic, Old Navy, Athleta
- ✅ Multiple price extraction patterns
- ✅ Multiple image extraction patterns
- ✅ JSON-LD product data extraction

### 3. Error Handling
- ✅ Better error messages
- ✅ Proper handling of non-JSON responses
- ✅ Graceful fallbacks when scraping fails

## Testing the Endpoints

### Test 1: URL Import (No API Key Needed)

**Test URL:** `https://bananarepublicfactory.gapfactory.com/browse/product.do?pid=809756021&rrec=true`

**Expected Result:**
```json
{
  "item": {
    "id": "imported-...",
    "kind": "imported",
    "title": "Product Name",
    "brand": "Banana Republic",
    "price": 29.99,
    "imageUrl": "https://...",
    "productUrl": "https://...",
    "sourceLabel": "Banana Republic",
    "category": "upper"
  }
}
```

**How to Test:**
1. Open your app
2. Go to Shop screen
3. Paste the URL in search bar
4. Click Search
5. Should display the product

### Test 2: Web Search (Requires SerpAPI Key)

**Test Query:** `red polka dot midi dress under 80 dollars`

**Expected Result:**
```json
{
  "items": [
    {
      "id": "web-...",
      "kind": "web",
      "title": "Red Polka Dot Midi Dress",
      "price": 45.99,
      "imageUrl": "https://...",
      "productUrl": "https://...",
      "sourceLabel": "Amazon",
      "category": "dress"
    },
    ...
  ]
}
```

**How to Test:**
1. Make sure `PRODUCT_SEARCH_API_KEY` is set in Vercel
2. Open your app
3. Go to Shop screen
4. Type the query
5. Click Search
6. Should return multiple products

## Common Issues & Solutions

### Issue: "API endpoint not deployed yet"
**Solution:** Wait 1-2 minutes after pushing to GitHub for Vercel to deploy

### Issue: "SerpAPI error: Invalid API key"
**Solution:** 
1. Check API key in Vercel environment variables
2. Verify key is correct at https://serpapi.com/dashboard
3. Make sure key is added to Production environment

### Issue: "No shopping results found"
**Solution:**
- This is normal if query doesn't match products
- Try a more specific query
- Check SerpAPI quota at https://serpapi.com/dashboard

### Issue: URL import returns "Product missing required fields"
**Solution:**
- Some websites block scraping
- Try a different product URL
- Check Vercel function logs for detailed error

## Verification Checklist

- [ ] URL import works for Gap Factory URL
- [ ] URL import works for Zara URL
- [ ] URL import works for Amazon URL
- [ ] Web search returns results (with API key)
- [ ] Error messages are clear and helpful
- [ ] Products display correctly in Shop screen
- [ ] "View Original" button works on Product screen

## API Endpoints

- **URL Import:** `POST /api/product-from-url`
  - Body: `{ "url": "https://..." }`
  - Returns: `{ "item": {...} }`

- **Web Search:** `POST /api/search-web-products`
  - Body: `{ "query": "red dress" }`
  - Returns: `{ "items": [...] }`

## Next Steps After Deployment

1. Wait for Vercel deployment to complete (check dashboard)
2. Test URL import with Gap Factory URL
3. Test web search with a simple query
4. Check Vercel function logs if errors occur
5. Verify environment variables are set correctly

