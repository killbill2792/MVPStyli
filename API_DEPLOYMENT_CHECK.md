# API Deployment Check for Vercel

## API Endpoints Structure

Your API endpoints are located in:
- `/api/searchwebproducts/index.ts` - Product search endpoint
- `/api/productfromurl/index.ts` - URL import endpoint

## Vercel Deployment Requirements

### 1. File Structure
Vercel automatically detects API routes in the `/api` folder. Each endpoint should have:
- A folder named after the route (e.g., `searchwebproducts`)
- An `index.ts` file inside that folder
- A default export function that handles `VercelRequest` and `VercelResponse`

### 2. Current Structure ✅
```
api/
  ├── searchwebproducts/
  │   └── index.ts  ✅ (exports default handler)
  ├── productfromurl/
  │   └── index.ts  ✅ (exports default handler)
  └── ...
```

### 3. Vercel Configuration
Your `vercel.json` is correctly configured:
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

## How to Verify Deployment

### Check in Vercel Dashboard:
1. Go to your Vercel project dashboard
2. Click on "Functions" tab
3. You should see:
   - `/api/searchwebproducts`
   - `/api/productfromurl`
   - Other API endpoints

### Test Endpoints Directly:
```bash
# Test search endpoint
curl -X POST https://mvpstyli-fresh.vercel.app/api/searchwebproducts \
  -H "Content-Type: application/json" \
  -d '{"query": "red dress"}'

# Test URL import endpoint
curl -X POST https://mvpstyli-fresh.vercel.app/api/productfromurl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/product"}'
```

## Environment Variables Required

Make sure these are set in Vercel:
- `PRODUCT_SEARCH_API_KEY` - For web product search (SerpAPI or Google)
- `PRODUCT_SEARCH_PROVIDER` - Optional, defaults to 'serpapi'
- `CUSTOM_SEARCH_ENGINE_ID` - Only if using Google Custom Search

## Common Issues

### APIs Not Showing in Vercel:
1. **Check file structure** - Must be `api/[route]/index.ts`
2. **Check exports** - Must have `export default async function handler`
3. **Check deployment** - Push to main branch triggers auto-deploy
4. **Check build logs** - Look for TypeScript compilation errors

### APIs Returning 404:
1. Wait for deployment to complete (can take 1-2 minutes)
2. Check function logs in Vercel dashboard
3. Verify the route name matches the folder name exactly

### APIs Returning 500:
1. Check function logs in Vercel dashboard
2. Verify environment variables are set
3. Check for runtime errors in logs

## Next Steps

If APIs are not showing:
1. Verify the files exist in the repository
2. Check that they're committed to main branch
3. Trigger a new deployment if needed
4. Check Vercel build logs for errors

