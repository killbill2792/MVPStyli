# Vercel Configuration Guide

This guide explains how to configure Vercel environment variables for the AI-powered product search feature.

## Required Environment Variables

### 1. Product Search API Key (Required for Web Search)

**Variable Name:** `PRODUCT_SEARCH_API_KEY`

**Options:**

#### Option A: SerpAPI (Recommended - Easy Setup)
1. Go to https://serpapi.com/
2. Sign up for a free account (100 free searches/month)
3. Navigate to your dashboard
4. Copy your API key
5. Add it to Vercel as `PRODUCT_SEARCH_API_KEY`

**Pros:**
- Easy setup
- Free tier: 100 searches/month
- Good product search results
- No additional configuration needed

#### Option B: Google Custom Search API
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "Custom Search API"
4. Create credentials (API Key)
5. Create a Custom Search Engine at https://programmablesearchengine.google.com/
6. Get your Search Engine ID
7. Add both to Vercel:
   - `PRODUCT_SEARCH_API_KEY` = Your Google API Key
   - `CUSTOM_SEARCH_ENGINE_ID` = Your Search Engine ID
   - `PRODUCT_SEARCH_PROVIDER` = `"google"`

**Pros:**
- More control
- Higher free tier limits
- Can customize search results

**Cons:**
- More complex setup
- Requires two environment variables

### 2. Search Provider (Optional)

**Variable Name:** `PRODUCT_SEARCH_PROVIDER`

**Value:** `"serpapi"` (default) or `"google"`

Only needed if using Google Custom Search. If using SerpAPI, you can skip this.

### 3. Custom Search Engine ID (Only for Google)

**Variable Name:** `CUSTOM_SEARCH_ENGINE_ID`

**Value:** Your Google Custom Search Engine ID

Only needed if using Google Custom Search API.

## Step-by-Step: Adding Environment Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Sign in to your account

2. **Select Your Project**
   - Click on your project (e.g., "MVPStyli" or "mvpstyli-fresh")

3. **Navigate to Settings**
   - Click on the "Settings" tab in the project dashboard

4. **Go to Environment Variables**
   - Click on "Environment Variables" in the left sidebar

5. **Add Variables**
   - Click "Add New" or the "+" button
   - For each variable:
     - **Key:** Enter the variable name (e.g., `PRODUCT_SEARCH_API_KEY`)
     - **Value:** Enter the API key value
     - **Environment:** Select "Production", "Preview", and "Development" (or just "Production" if you only want it in production)
     - Click "Save"

6. **Redeploy**
   - After adding variables, go to the "Deployments" tab
   - Click the three dots (⋯) on the latest deployment
   - Select "Redeploy"
   - Or push a new commit to trigger automatic deployment

### Method 2: Via Vercel CLI

1. **Install Vercel CLI** (if not already installed)
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Link your project** (if not already linked)
   ```bash
   vercel link
   ```

4. **Add environment variables**
   ```bash
   # For SerpAPI
   vercel env add PRODUCT_SEARCH_API_KEY production
   # Paste your API key when prompted
   
   # Optional: For Google Custom Search
   vercel env add PRODUCT_SEARCH_PROVIDER production
   # Enter: google
   
   vercel env add CUSTOM_SEARCH_ENGINE_ID production
   # Paste your Search Engine ID when prompted
   ```

5. **Redeploy**
   ```bash
   vercel --prod
   ```

## Quick Setup: SerpAPI (Recommended for Testing)

1. **Get SerpAPI Key:**
   - Visit: https://serpapi.com/users/sign_up
   - Sign up (free account)
   - Go to: https://serpapi.com/dashboard
   - Copy your API key

2. **Add to Vercel:**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Settings → Environment Variables
   - Add:
     - Key: `PRODUCT_SEARCH_API_KEY`
     - Value: (paste your SerpAPI key)
     - Environment: Production, Preview, Development
   - Save

3. **Redeploy:**
   - Deployments → Latest → Redeploy

## Testing Your Configuration

### Test URL Import (No API Key Needed)
1. Open your app
2. Go to Shop screen
3. Paste a product URL (e.g., `https://www.zara.com/us/en/woman/blazers-c358002.html`)
4. Click Search
5. Should import and display the product

### Test Web Search (Requires API Key)
1. Open your app
2. Go to Shop screen
3. Type a natural language query (e.g., `red polka dot midi dress under 80 dollars`)
4. Click Search
5. Should return web search results

## Troubleshooting

### "API endpoint not deployed yet"
- Wait 1-2 minutes after pushing to GitHub
- Vercel needs time to deploy new API routes
- Check Vercel dashboard → Deployments to see deployment status

### "Product search API key not configured"
- Make sure `PRODUCT_SEARCH_API_KEY` is set in Vercel
- Make sure you redeployed after adding the variable
- Check that the variable is available in the correct environment (Production/Preview/Development)

### "Invalid API key" or "API quota exceeded"
- Check your API key is correct
- For SerpAPI: Check your usage at https://serpapi.com/dashboard
- For Google: Check your quota at https://console.cloud.google.com/

### Search returns no results
- This is normal if API key is not set (web search requires API key)
- URL import should work without API key
- Make sure API key is valid and has remaining quota

## Environment Variable Summary

| Variable Name | Required | Default | Description |
|--------------|----------|---------|-------------|
| `PRODUCT_SEARCH_API_KEY` | Yes (for web search) | None | API key for product search (SerpAPI or Google) |
| `PRODUCT_SEARCH_PROVIDER` | No | `"serpapi"` | Search provider: `"serpapi"` or `"google"` |
| `CUSTOM_SEARCH_ENGINE_ID` | Yes (if using Google) | None | Google Custom Search Engine ID |

## Notes

- **URL Import** works without any API keys (uses web scraping)
- **Web Search** requires `PRODUCT_SEARCH_API_KEY`
- Environment variables take effect after redeployment
- Free tiers are usually sufficient for testing
- SerpAPI free tier: 100 searches/month
- Google Custom Search free tier: 100 queries/day

