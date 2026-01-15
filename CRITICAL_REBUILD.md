# Critical: Rebuild Required After Removing Native Modules

## Problem
The app is still crashing with Fabric component registration errors even after removing problematic packages. This is because the **native code from the previous build still includes the removed modules**.

## Solution: Clean Rebuild

You **MUST** rebuild the development client with `--clear-cache` to remove the native modules from the build:

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

## What Was Removed

1. ✅ **TensorFlow packages** - Removed from package.json
   - `@tensorflow/tfjs`
   - `@tensorflow/tfjs-react-native`
   - `@tensorflow-models/face-detection`
   - `@mediapipe/face_detection`

2. ✅ **react-native-image-colors** - Removed from package.json
   - This package was trying to register Fabric components

## Why Rebuild is Critical

- Removing packages from `package.json` doesn't remove them from the **native iOS build**
- The previous build still has native code linking these modules
- Only a fresh build with `--clear-cache` will:
  - Unlink removed native modules
  - Regenerate native code without problematic modules
  - Apply correct `newArchEnabled: false` settings

## After Rebuild

The app should:
- ✅ Start without crashing
- ✅ No Fabric component registration errors
- ✅ All remaining native modules work correctly

## If Still Crashing

If the crash persists after rebuilding, check:
1. Build logs: `npx eas-cli build:view [BUILD_ID]`
2. Verify no TensorFlow references in native code
3. Check if any other native modules need to be removed
