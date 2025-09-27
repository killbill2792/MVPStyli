# MVPStyli QA Testing Guide

## Setup Instructions

### 1. Environment Configuration
Create `.env.local` with your credentials:
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Vercel API Base URL
EXPO_PUBLIC_API_BASE=https://your-vercel-app.vercel.app

# Replicate API Configuration
REPLICATE_API_TOKEN=your-replicate-token-here
TRYON_MODEL_ID=owner/model:version
```

### 2. Supabase Setup
1. Create a new Supabase project
2. Create a storage bucket named `images` (public access)
3. Copy the project URL and anon key to `.env.local`

### 3. Vercel Deployment
1. Deploy the `/api` folder to Vercel
2. Set environment variables in Vercel dashboard:
   - `REPLICATE_API_TOKEN`
   - `TRYON_MODEL_ID`
3. Copy the Vercel app URL to `.env.local`

### 4. Clean Install & Run
```bash
rm -rf node_modules .expo .cache
npm install
npx expo start -c --tunnel
```

## QA Test Cases

### Authentication Flow
- [ ] **Guest Sign-in**: Click "Continue as Guest" → Should proceed to onboarding
- [ ] **Magic Link**: Enter email → Click "Send Magic Link" → Should show success message
- [ ] **Account Screen**: Navigate to account → Should show "Guest session" or email

### Onboarding Flow
- [ ] **Photo Upload**: Click upload → Select photo → Should upload to Supabase and show preview
- [ ] **Continue Blocked**: Try to continue without photo → Should show "Upload required" alert
- [ ] **Preview Display**: After upload → Should show uploaded photo in preview

### Shop & Product Flow
- [ ] **Product Grid**: Shop screen → Should show 6 products in 2-column grid
- [ ] **Product Details**: Click product → Should show full-bleed hero + details sheet
- [ ] **Garment Cleaning**: Product screen → Should call garment-clean API and enable "Try On"
- [ ] **Try On Button**: Should be disabled until garment cleaning completes

### Try-On Flow (Real AI)
- [ ] **No Photo Upload**: Try-On screen without photo → Should show upload screen
- [ ] **Auto Try-On**: With photo → Should automatically start try-on process
- [ ] **Loading State**: Should show "Generating Try-On..." overlay
- [ ] **Real AI Processing**: Should call Replicate API and poll for results
- [ ] **Result Display**: Should show AI-generated try-on result
- [ ] **Error Handling**: If AI fails → Should show error message and fallback to original
- [ ] **Photo Change**: Click "📷 Change Photo" → Should upload new photo and restart try-on

### AI Analytics & Suggestions
- [ ] **AI Analytics**: Click 📈 icon → Should show glass HUD with confidence and fit tips
- [ ] **Suggestions**: Click 🧩 icon → Should show styling suggestions in glass HUD
- [ ] **HUD Dismissal**: Click outside HUD → Should close the overlay
- [ ] **HUD Size**: Glass HUDs should be 330px wide with 18px padding

### Social Features
- [ ] **Ask Help**: Try-On → Ask for Help → Should show 4 option cards
- [ ] **Pod Creation**: Select mode → Set duration → Create Pod → Should create room
- [ ] **Voting**: Room screen → Should allow voting with emoji buttons
- [ ] **AI Recap**: After voting → Should show confidence score and recommendations

### Feed Flow
- [ ] **Feed Items**: Should cycle through 4 different feed items
- [ ] **Voting**: Click vote buttons → Should update counts and auto-advance
- [ ] **No Alerts**: Voting should not show popup alerts
- [ ] **No Counter**: Should not show "X of 4" counter

### Navigation
- [ ] **Bottom Bar**: Should show Shop/Feed/Try-On/Rooms tabs
- [ ] **Active State**: Current tab should be highlighted in white
- [ ] **Navigation**: All tabs should navigate correctly
- [ ] **No Overlap**: Buttons should not overlap with bottom navigation

### Error Handling
- [ ] **Network Errors**: Test with poor connection → Should show appropriate error messages
- [ ] **API Failures**: Test with invalid API keys → Should handle gracefully
- [ ] **Rate Limiting**: Test rapid requests → Should respect rate limits
- [ ] **Permission Errors**: Test without photo permissions → Should show permission request

### Console Tracking
Check browser/device console for tracking logs:
- [ ] `[TRACK] auth_anonymous_start`
- [ ] `[TRACK] upload_success`
- [ ] `[TRACK] tryon_start`
- [ ] `[TRACK] tryon_success`
- [ ] `[TRACK] tryon_fail`

### Performance
- [ ] **Upload Speed**: Photo uploads should complete within 5 seconds
- [ ] **Try-On Speed**: AI processing should complete within 30 seconds
- [ ] **Navigation**: Screen transitions should be smooth
- [ ] **Memory**: App should not crash after extended use

## Known Issues
- ImagePicker deprecation warnings are expected (using correct API)
- SafeAreaView deprecation warning is expected (will be updated later)

## Success Criteria
- All test cases pass
- Real AI try-on works with Replicate
- No mock data or fake timers
- Proper error handling throughout
- Smooth user experience

## Demo Mode Testing

The app includes a **Demo Mode** that works without real API credentials:

### Demo Mode Features
- ✅ **Mock Authentication**: Guest sign-in works without Supabase
- ✅ **Mock Upload**: Photo uploads return demo URLs
- ✅ **Mock Try-On**: AI try-on uses demo results (random images)
- ✅ **Mock Garment Cleaning**: Returns original image URLs
- ✅ **No Network Errors**: All API calls are mocked

### Demo Mode Indicators
- 🚧 **Demo Banner**: Shows "DEMO MODE" at top of app
- 📝 **Console Logs**: Shows "Demo mode:" messages
- 🔄 **Mock Data**: Uses placeholder URLs and responses

### Testing Demo Mode
1. **Start App**: `npm start` (works with demo credentials)
2. **Guest Sign-in**: Click "Continue as Guest" → Should work instantly
3. **Photo Upload**: Upload photo → Should return demo URL
4. **Try-On**: Select product → Should show mock AI processing
5. **No Errors**: Should not show network request failures

### Switching to Production Mode
To test with real APIs:
1. Update `.env.local` with real Supabase/Vercel credentials
2. Deploy Vercel functions with real Replicate API token
3. Restart app: `npm start`
4. Demo banner should disappear
5. All features will use real APIs

### Demo vs Production Comparison
| Feature | Demo Mode | Production Mode |
|---------|-----------|------------------|
| Auth | Mock guest session | Real Supabase auth |
| Upload | Mock URLs | Real Supabase storage |
| Try-On | Random demo images | Real Replicate AI |
| Garment Clean | Original URLs | Real API processing |
| Error Handling | Graceful fallbacks | Real error messages |
