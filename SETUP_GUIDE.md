# MVPStyli - Complete Setup Guide

This guide will help you set up MVPStyli as a fully functional app with real APIs.

## 🚀 Quick Setup Steps

### 1. Supabase Setup (Required)

1. **Create Supabase Project:**
   - Go to [https://supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization
   - Enter project name: `mvpstyli`
   - Set a strong database password
   - Choose region closest to you
   - Click "Create new project"

2. **Get API Credentials:**
   - Go to Settings → API
   - Copy your **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - Copy your **anon public** key (starts with `eyJ...`)

3. **Enable Anonymous Authentication:**
   - Go to Authentication → Settings
   - Enable "Enable anonymous sign-ins"
   - Save changes

4. **Create Storage Bucket:**
   - Go to Storage
   - Click "Create a new bucket"
   - Name: `images`
   - Make it **Public**
   - Click "Create bucket"

### 2. Vercel API Setup (Required)

1. **Deploy API Functions:**
   - Install Vercel CLI: `npm i -g vercel`
   - Run: `vercel login`
   - Run: `vercel --prod`
   - Copy your deployment URL (looks like: `https://your-app.vercel.app`)

2. **Set Environment Variables in Vercel:**
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add these variables:
     - `REPLICATE_API_TOKEN` = your Replicate token
     - `TRYON_MODEL_ID` = your model ID

### 3. Replicate AI Setup (Required)

1. **Get API Token:**
   - Go to [https://replicate.com](https://replicate.com)
   - Sign up/login
   - Go to Account → API tokens
   - Create a new token
   - Copy the token

2. **Choose Try-On Model:**
   - Go to [https://replicate.com/explore](https://replicate.com/explore)
   - Search for "try-on" or "outfit"
   - Popular models:
     - `outfit-anyone/model:version`
     - `tryondiffusion/model:version`
   - Copy the model ID

### 4. Update Environment File

Edit `.env.local` with your real credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_API_BASE=https://your-app.vercel.app
REPLICATE_API_TOKEN=r8_...
TRYON_MODEL_ID=outfit-anyone/model:version
```

### 5. Test the App

1. **Start the app:**
   ```bash
   npm start
   ```

2. **Test the flow:**
   - Sign in as guest ✅
   - Upload photo ✅
   - Browse shop ✅
   - Try on outfit ✅
   - Use all features ✅

## 🔧 Troubleshooting

### "Network request failed" Error
- Check your Supabase URL and key in `.env.local`
- Make sure Supabase project is active
- Verify anonymous auth is enabled

### "API base URL not configured" Error
- Check your Vercel deployment URL
- Make sure API functions are deployed
- Verify environment variables in Vercel

### Upload Issues
- Check if `images` bucket exists in Supabase
- Verify bucket is public
- Check storage permissions

### Try-On Not Working
- Verify Replicate API token
- Check model ID format
- Ensure Vercel API functions are working

## 📱 Features That Will Work

Once set up, you'll have:
- ✅ Real user authentication
- ✅ Photo upload to Supabase storage
- ✅ AI-powered garment cleaning
- ✅ Virtual try-on with Replicate AI
- ✅ Real-time outfit voting
- ✅ Help rooms and feedback
- ✅ Complete user flow

## 💰 Cost Estimates

- **Supabase:** Free tier (500MB storage, 50MB bandwidth)
- **Vercel:** Free tier (100GB bandwidth)
- **Replicate:** Pay per use (~$0.10-0.50 per try-on)

## 🆘 Need Help?

If you get stuck:
1. Check the console logs for specific error messages
2. Verify all credentials are correct
3. Test each service individually
4. Check the troubleshooting section above

The app is designed to be fully functional with real APIs - no demo mode needed!
