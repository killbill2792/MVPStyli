# Expo Dev Client Setup Guide

## Overview
This guide will help you move from Expo Go to Expo Dev Client, which supports native modules like `expo-face-detector`.

## Prerequisites
- ✅ EAS CLI installed (done)
- ✅ `eas.json` configured (done)
- ⏳ EAS account login (next step)

## Step-by-Step Instructions

### Step 1: Login to EAS

Run this command and enter your credentials when prompted:

```bash
npx eas-cli login
```

**Credentials:**
- Username: `Raj_ksn`
- Password: `Rinku2792!`

After successful login, you'll see: "Logged in as Raj_ksn"

### Step 2: Build iOS Development Build

Once logged in, build the development client:

```bash
npx eas-cli build --platform ios --profile development
```

**What this does:**
- Builds your app in the cloud (no local CocoaPods needed!)
- Includes all native modules (expo-face-detector)
- Creates a development build you can install on your device
- Takes 10-20 minutes

**During the build:**
- You'll see a build URL you can monitor
- EAS will handle all dependencies automatically
- No need to wait for CocoaPods installation!

### Step 3: Download and Install

After the build completes:

1. **Download the .ipa file** from the link provided
2. **Install on your iOS device:**
   - Option A: Use TestFlight (if configured)
   - Option B: Install directly via Finder (drag .ipa to device)
   - Option C: Use `xcrun simctl install` for simulator

### Step 4: Start Development Server

Once the app is installed on your device:

```bash
npx expo start --dev-client
```

This starts the Metro bundler in dev client mode.

### Step 5: Connect Your Device

1. Open the development build app on your device
2. Scan the QR code or enter the URL shown in terminal
3. The app will load your JavaScript bundle
4. **Face detection will now work!** 🎉

## Quick Commands

```bash
# Login (one time)
npx eas-cli login

# Build iOS development build
npx eas-cli build --platform ios --profile development

# Start dev server
npx expo start --dev-client

# Check build status
npx eas-cli build:list

# View build logs
npx eas-cli build:view [BUILD_ID]
```

## Troubleshooting

### "Not logged in" error
Run `npx eas-cli login` again

### Build fails
- Check the build logs: `npx eas-cli build:view [BUILD_ID]`
- Ensure `app.json` is properly configured
- Verify bundle identifier is unique

### App won't connect to dev server
- Ensure device and computer are on same network
- Check firewall settings
- Try using tunnel: `npx expo start --dev-client --tunnel`

## Benefits of Dev Client

✅ Native modules work (expo-face-detector)  
✅ No Expo Go limitations  
✅ Faster development  
✅ Production-like environment  
✅ Custom native code support  

## Next Steps After Setup

Once you have the dev client installed:
1. Face detection will work automatically
2. You can test all native features
3. Development workflow is the same as before
4. Just use `npx expo start --dev-client` instead of `npx expo start`
