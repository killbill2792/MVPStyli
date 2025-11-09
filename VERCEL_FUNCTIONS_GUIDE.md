yment # Vercel Functions - How to Find Them

## Where to Find Functions in Vercel Dashboard

### Option 1: In Deployment Details (Current Method)
1. Go to your Vercel project: `mvp-styli`
2. Click on **"Deployments"** tab
3. Click on the latest deployment
4. Look for these tabs at the top:
   - **Deployment** (overview)
   - **Logs** (runtime logs)
   - **Resources** (this might show functions)
   - **Source** (code source)
   - **Open Graph** (preview)

### Option 2: Check Runtime Logs
1. In the deployment details, click **"Logs"** tab
2. Look for function invocations
3. If functions are being called, you'll see logs here

### Option 3: Test Directly via URL
Test if functions are deployed by calling them directly:

```bash
# Test search endpoint
curl -X POST https://mvp-styli.vercel.app/api/searchwebproducts \
  -H "Content-Type: application/json" \
  -d '{"query": "red dress"}'

# Test URL import
curl -X POST https://mvp-styli.vercel.app/api/productfromurl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.zara.com/us/en/product"}'
```

If you get JSON responses (even error messages), functions are deployed.
If you get 404 or "deployment not found", functions aren't deployed.

## Why Functions Tab Might Not Show

1. **Vercel UI Changed**: Newer Vercel dashboards might show functions differently
2. **Functions Not Detected**: If TypeScript compilation fails, functions won't be created
3. **Build Errors**: Check "Build Logs" for TypeScript/compilation errors
4. **Project Type**: Make sure project is set up as a Node.js project

## How to Verify Functions Are Deployed

### Method 1: Check Build Logs
1. Go to deployment → **Build Logs**
2. Look for messages like:
   - "Compiling /api/searchwebproducts"
   - "Created serverless function"
   - No TypeScript errors

### Method 2: Check Runtime Logs
1. Go to deployment → **Logs** tab
2. Make a request from your app
3. You should see function invocation logs

### Method 3: Test via Terminal
Use the curl commands above. If you get proper JSON responses, functions work.

## Current API Endpoints

Your project should have these endpoints:
- `/api/searchwebproducts` - POST - Product search
- `/api/productfromurl` - POST - URL import
- `/api/tryon` - POST - Try-on generation
- `/api/garment-clean` - POST - Garment cleaning
- `/api/test` - GET - Test endpoint

## If Functions Aren't Working

1. **Check Build Logs** for TypeScript errors
2. **Verify file structure**: `api/[name]/index.ts`
3. **Check vercel.json** configuration
4. **Redeploy** after fixing issues
5. **Wait 1-2 minutes** for deployment to complete

## Updated API URL

The code now uses: `https://mvp-styli.vercel.app`

Make sure your environment variable is set:
- `EXPO_PUBLIC_API_URL=https://mvp-styli.vercel.app`

Or it will use the default (now corrected to `mvp-styli`).

