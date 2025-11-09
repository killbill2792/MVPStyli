# Deployment Troubleshooting Guide

## Current Issue: DEPLOYMENT_NOT_FOUND

Even though Vercel says deployment is successful, the API routes return `DEPLOYMENT_NOT_FOUND`.

## Possible Causes & Solutions

### 1. Routes Not Being Built

**Check:**
- Vercel Dashboard → Deployments → Latest → Build Logs
- Look for TypeScript compilation errors
- Check if `api/productfromurl/index.ts` and `api/searchwebproducts/index.ts` are being processed

**Solution:**
- If there are build errors, fix them
- If routes aren't being detected, check `vercel.json` configuration

### 2. Route Structure Issue

**Current Structure:**
```
api/
  productfromurl/
    index.ts
  searchwebproducts/
    index.ts
  scrape-product/
    index.ts  (this one works)
```

**Check:**
- Compare working route (`scrape-product`) with new routes
- Ensure `index.ts` files export `default async function handler`

### 3. Vercel Cache Issue

**Solution:**
1. Go to Vercel Dashboard
2. Settings → Functions
3. Clear cache (if available)
4. Or: Deployments → Latest → Redeploy (with "Clear cache" option)

### 4. Route Not Accessible

**Test Routes Directly:**
```bash
# Test URL import
curl -X POST https://mvpstyli-fresh.vercel.app/api/productfromurl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.zara.com"}'

# Test web search
curl -X POST https://mvpstyli-fresh.vercel.app/api/searchwebproducts \
  -H "Content-Type: application/json" \
  -d '{"query":"red dress"}'
```

### 5. Check Function Logs

**In Vercel Dashboard:**
1. Go to Deployments → Latest
2. Click on "Functions" tab
3. Check if `api/productfromurl` and `api/searchwebproducts` are listed
4. If not listed, they're not being deployed

### 6. Manual Verification

**Check if files exist in deployment:**
1. Vercel Dashboard → Deployments → Latest
2. Check "Source" or "Files" tab
3. Verify `api/productfromurl/index.ts` exists
4. Verify `api/searchwebproducts/index.ts` exists

## Quick Fix: Force Redeploy

1. Make a small change to trigger new deployment:
   ```bash
   echo "// Force redeploy" >> api/productfromurl/index.ts
   git add api/productfromurl/index.ts
   git commit -m "Force redeploy"
   git push origin main
   ```

2. Or manually redeploy in Vercel Dashboard

## Verify Route Format

Ensure routes match working format:

**Working route (scrape-product):**
- Path: `api/scrape-product/index.ts`
- URL: `/api/scrape-product`
- Export: `export default async function handler`

**New routes should match:**
- Path: `api/productfromurl/index.ts`
- URL: `/api/productfromurl`
- Export: `export default async function handler`

## If Still Not Working

1. **Check Vercel Project Settings:**
   - Settings → General → Framework Preset
   - Should be "Other" or auto-detected
   - Root Directory should be correct

2. **Check Build Command:**
   - Settings → General → Build & Development Settings
   - Build Command should be empty or minimal
   - Output Directory should be empty (for serverless functions)

3. **Check Environment Variables:**
   - Settings → Environment Variables
   - Ensure `PRODUCT_SEARCH_API_KEY` is set
   - Ensure variables are available in Production environment

4. **Contact Vercel Support:**
   - If routes still don't deploy after all checks
   - Provide deployment logs and route structure

