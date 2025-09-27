# MVPStyli - AI Fashion Assistant

A production-ready React Native app with Supabase backend and Vercel serverless functions for AI-powered try-on experiences.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file with your credentials:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration  
EXPO_PUBLIC_API_BASE=https://your-vercel-app.vercel.app

# Try-On Model Configuration
REPLICATE_API_TOKEN=your-replicate-token
TRYON_MODEL_ID=owner/model:version
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Create a storage bucket named `images` (public)
3. Copy your project URL and anon key to `.env`

### 3. Vercel Deployment

1. Deploy the `/api` folder to Vercel
2. Set environment variables in Vercel dashboard
3. Copy your Vercel app URL to `.env`

### 4. Install & Run

```bash
# Clean install
rm -rf node_modules .expo .cache
npm install

# Start development server
npx expo start -c --tunnel
```

## 📱 Features

- **Auth**: Guest sessions + magic link authentication
- **Onboarding**: Photo upload with Supabase storage
- **Shop**: Curated product grid with real images
- **Product**: Full-bleed hero + detailed product sheet
- **Try-On**: AI-powered virtual try-on with glass HUD overlays
- **Ask Help**: Social voting pods (Friends, Twins, Broader, Mix)
- **Rooms**: Real-time voting with countdown timers
- **Feed**: Social feed with voting functionality

## 🏗️ Architecture

- **Frontend**: React Native + Expo SDK 51
- **Backend**: Supabase (auth, storage, database)
- **AI**: Vercel serverless functions + Replicate API
- **Styling**: Apple-clean, full-screen imagery, glass overlays

## 🔧 Development

### Project Structure
```
├── lib/           # Supabase client, upload, cleaner, tryon
├── screens/       # Auth, Account, Home, Shop, Product, etc.
├── components/    # BottomBar, Glass, reusable components
├── api/           # Vercel serverless functions
└── App.js         # Main app with Context state management
```

### Key Components
- **BottomBar**: Minimal floating navigation
- **Glass**: Reusable glass overlay component
- **TryOn**: AI canvas with HUD overlays
- **Product**: Full-bleed hero + details sheet

## 🚨 Production Checklist

- [ ] Supabase project created with `images` bucket
- [ ] Vercel functions deployed with environment variables
- [ ] Replicate API token configured
- [ ] Environment variables set in `.env`
- [ ] App tested on iOS/Android/Web
- [ ] Auth flow working (guest + magic link)
- [ ] Photo upload to Supabase working
- [ ] Try-on API calls functional
- [ ] All navigation flows working

## 🎯 QA Testing

1. **Auth**: Guest continues; magic link sends email
2. **Onboarding**: Blocks continue until photo uploaded
3. **Product**: Try On disabled until cleaner returns cleanUrl
4. **Try-On**: Apply Outfit triggers job; image swaps to result
5. **Rooms**: Create Pod → timer counts down; votes increment
6. **BottomBar**: All tabs reachable; Account accessible

## 💰 Budget & Limits

- Try-on: 3/day for guests, 10/day for signed-in users
- Cache results for 48h to reduce API calls
- Use heuristic garment cleaning for MVP

## 🔄 Next Steps

1. Add real person detection for garment cleaning
2. Implement social auth (Google, Apple)
3. Add push notifications for room updates
4. Implement real-time chat in rooms
5. Add product recommendations based on try-on results
