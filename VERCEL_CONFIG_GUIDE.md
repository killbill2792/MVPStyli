# Vercel API Configuration Guide

## Current Configuration

The `vercel.json` file is already configured correctly. Here's what it does:

```json
{
  "version": 2,
  "functions": {
    "api/**/*.{js,ts}": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

This configuration tells Vercel to:
- Treat all `.js` and `.ts` files in the `api/` folder (and subfolders) as serverless functions
- Allocate 1024MB of memory to each function
- Allow functions to run for up to 30 seconds

## How to Verify Configuration in Vercel Dashboard

### Method 1: Check Project Settings

1. Go to https://vercel.com/dashboard
2. Select your project (MVPStyli or mvpstyli-fresh)
3. Click **Settings** tab
4. Click **Functions** in the left sidebar
5. You should see:
   - **Memory**: 1024 MB
   - **Max Duration**: 30s
   - **Runtime**: Node.js (should be auto-detected)

### Method 2: Check vercel.json File

The configuration is in your `vercel.json` file at the root of your project. This file is automatically read by Vercel when deploying.

## API Route Structure

Vercel supports two formats for API routes:

### Format 1: Flat Files (Recommended)
```
api/
  product-from-url.ts
  search-web-products.ts
  scrape-product.ts
```

**URLs:**
- `/api/product-from-url`
- `/api/search-web-products`
- `/api/scrape-product`

### Format 2: Directory with index.ts
```
api/
  scrape-product/
    index.ts
  product-from-url/
    index.ts
```

**URLs:**
- `/api/scrape-product`
- `/api/product-from-url`

## Current Setup

Your project has **both formats** for maximum compatibility:

**Flat files:**
- `api/product-from-url.ts` ✅
- `api/search-web-products.ts` ✅

**Directory format:**
- `api/product-from-url/index.ts` ✅
- `api/search-web-products/index.ts` ✅

Vercel will use the flat files first if both exist.

## Troubleshooting

### If API routes still don't work:

1. **Check Deployment Logs:**
   - Vercel Dashboard → Your Project → Deployments
   - Click on the latest deployment
   - Check "Functions" tab for any build errors

2. **Verify File Structure:**
   ```bash
   ls -la api/*.ts
   ls -la api/*/index.ts
   ```

3. **Check Build Output:**
   - Vercel Dashboard → Deployments → Latest → Build Logs
   - Look for TypeScript compilation errors

4. **Manual Redeploy:**
   - Vercel Dashboard → Deployments
   - Click three dots (⋯) on latest deployment
   - Select "Redeploy"

## Configuration Options

You can customize the `vercel.json` file with these options:

```json
{
  "version": 2,
  "functions": {
    "api/**/*.{js,ts}": {
      "memory": 1024,        // Memory in MB (128-3008)
      "maxDuration": 30,     // Max execution time in seconds (1-300)
      "runtime": "nodejs18.x" // Node.js version
    }
  }
}
```

## No Additional Configuration Needed

The `vercel.json` file in your project is already correctly configured. Vercel will automatically:
- Detect TypeScript files
- Compile them
- Deploy them as serverless functions
- Make them available at `/api/[filename]`

## Next Steps

1. ✅ Configuration is already correct
2. Wait for Vercel to deploy (check dashboard)
3. Test the endpoints after deployment completes
4. Check function logs if errors persist

