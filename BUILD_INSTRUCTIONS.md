# Building Development Build for Face Detection

## Problem
You're currently running the app in **Expo Go**, which doesn't support native modules like `expo-face-detector`. You need to build a **development build** instead.

## Solution Options

### Option 1: Manual CocoaPods Installation (Recommended for iOS)

1. **Install CocoaPods manually:**
   ```bash
   # Try Homebrew first (if you have it)
   brew install cocoapods
   
   # OR use gem with sudo
   sudo gem install cocoapods
   
   # Verify installation
   pod --version
   ```

2. **Install iOS dependencies:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Build and run:**
   ```bash
   npx expo run:ios
   ```

### Option 2: Use EAS Build (Cloud Build - No Local Setup Needed)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure project:**
   ```bash
   eas build:configure
   ```

4. **Build for iOS:**
   ```bash
   eas build --platform ios --profile development
   ```

5. **Install on device:**
   - EAS will provide a download link
   - Install the `.ipa` file on your iOS device via TestFlight or direct install

### Option 3: Build for Android (If iOS setup is problematic)

Android doesn't require CocoaPods:

```bash
npx expo run:android
```

## What's Already Done ✅

- ✅ Native code generated (`npx expo prebuild --clean` completed)
- ✅ `expo-face-detector` is in dependencies
- ✅ Podfile configured with auto-linking
- ✅ Face detection code is ready and isolated

## After Building

Once you have a development build (not Expo Go):
- Face detection will automatically work
- The "Running in Expo Go" warning will disappear
- Native modules will be properly linked

## Troubleshooting

If CocoaPods installation fails:
- Check your Ruby version: `ruby --version`
- Try updating Ruby: `brew upgrade ruby` (if using Homebrew)
- Or use EAS Build (Option 2) which handles everything in the cloud
