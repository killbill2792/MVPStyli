# Fix for Fabric Component Registration Crash

## Problem
The app crashes on startup with:
```
NSInvalidArgumentException: attempt to insert nil object from objects[0]
in RCTThirdPartyComponentsProvider thirdPartyFabricComponents
```

This happens when a native module tries to register Fabric components but returns `nil`.

## Root Cause
Even though `newArchEnabled: false` is set, some native modules (likely `@tensorflow/tfjs-react-native`) may still try to register Fabric components during app initialization.

## Solution Applied

1. **Disabled TensorFlow.js initialization** - Since we're using `expo-face-detector`, TensorFlow setup is now a no-op
2. **Verified build properties** - Ensured `newArchEnabled: false` is set for both iOS and Android
3. **Added deployment target** - Set iOS deployment target to 15.1

## Next Steps

### Option 1: Rebuild the Development Client (Recommended)

The current build might have been created with incorrect settings. Rebuild:

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

The `--clear-cache` flag ensures a fresh build with the correct settings.

### Option 2: Remove Unused TensorFlow Dependencies (If not needed)

If you're not using TensorFlow anywhere, you can remove these packages:

```bash
npm uninstall @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow-models/face-detection @mediapipe/face_detection
```

Then rebuild:
```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

### Option 3: Check Build Logs

If the issue persists, check the build logs to see which module is causing the issue:

```bash
npx eas-cli build:view [BUILD_ID]
```

## Verification

After rebuilding, the app should:
- ✅ Start without crashing
- ✅ Load the development client
- ✅ Connect to Metro bundler
- ✅ Face detection should work via expo-face-detector

## If Issue Persists

1. Check if any other native modules are trying to register Fabric components
2. Verify all Expo modules are compatible with SDK 54
3. Ensure no conflicting native dependencies
