# Deployment Guide - Fabric Crash Fix

## What Was Fixed

The app was crashing on startup due to `RCTThirdPartyComponentsProvider` trying to insert `nil` values into an Objective-C dictionary. This happens when Fabric component view classes aren't available (because `newArchEnabled: false`), but modules still try to register them.

## Changes Made

### 1. Fixed app.json Configuration ✅
- Moved `newArchEnabled: false` to top level (removed deprecated `ios.newArchEnabled`)
- This is the official way to disable Fabric in Expo SDK 54+

### 2. Created Persistent Patch Script ✅
- `scripts/patch-thirdpartycomponents-robust.js` automatically patches the generated file
- Runs after prebuild/build via `postbuild` script
- Replaces unsafe dictionary literal with nil-checked `NSMutableDictionary`
- Idempotent (safe to run multiple times)

### 3. Removed Problematic Modules ✅
- `expo-linear-gradient` → Replaced with `SimpleGradient` component
- `expo-image` → Using React Native's built-in `Image`
- `expo-image-manipulator` → Removed (using original images)

## How the Fix Works

The patch script:
1. Finds `RCTThirdPartyComponentsProvider.mm` (generated during build)
2. Replaces dictionary literal like:
   ```objc
   return @{@"RNCSafeAreaProvider": NSClassFromString(@"RNCSafeAreaProviderComponentView")};
   ```
3. With safe nil-checked version:
   ```objc
   NSMutableDictionary *components = [NSMutableDictionary dictionary];
   Class RNCSafeAreaProvider_Class = NSClassFromString(@"RNCSafeAreaProviderComponentView");
   if (RNCSafeAreaProvider_Class != nil) {
       components[@"RNCSafeAreaProvider"] = RNCSafeAreaProvider_Class;
   }
   return [components copy];
   ```

This prevents crashes when `NSClassFromString` returns `nil`.

## Deployment Commands

### For Local Development Build

```bash
# 1. Clean everything
rm -rf ios android node_modules
npm install

# 2. Generate native code (this will run the patch automatically)
npx expo prebuild --platform ios --clean

# 3. Install pods (if you have Xcode)
cd ios && pod install && cd ..

# 4. Build and run
npx expo run:ios
```

### For EAS Build (Development/Preview)

```bash
# 1. Clean and rebuild
rm -rf ios android
npx expo prebuild --platform ios --clean

# 2. Build with EAS
npx eas-cli build --platform ios --profile development --clear-cache
# OR for preview build:
npx eas-cli build --platform ios --profile preview --clear-cache
```

The patch script runs automatically via `postbuild` hook after prebuild.

### For Production/TestFlight Build

```bash
# 1. Clean
rm -rf ios android

# 2. Prebuild (patch runs automatically)
npx expo prebuild --platform ios --clean

# 3. Build for production
npx eas-cli build --platform ios --profile production
```

### Running Dev Client

After installing the dev client build:

```bash
# Start Metro bundler
npx expo start --dev-client --port 8082
```

## Why This Fix Works

1. **Persistent**: The patch script runs automatically after every prebuild
2. **Safe**: Only adds non-nil classes to the dictionary
3. **Compatible**: Works with all Expo modules that register Fabric components
4. **Future-proof**: Will work even if Expo updates the file format

## Verification

After building, verify the fix:

1. **Check the patched file** (if building locally):
   ```bash
   grep -A 5 "PATCHED" ios/**/RCTThirdPartyComponentsProvider.mm
   ```
   Should show the safe nil-checked dictionary code.

2. **Test the app**: The app should start without crashing.

3. **Check logs**: No `NSInvalidArgumentException` errors.

## Troubleshooting

### If patch doesn't run:
- Manually run: `node scripts/patch-thirdpartycomponents-robust.js`
- Check that `postbuild` script is in package.json

### If file not found:
- This is normal - file is generated during build
- Patch will apply when file is generated
- For EAS builds, the patch runs automatically

### If still crashing:
- Verify `newArchEnabled: false` is at top level in app.json
- Check that all problematic modules are removed
- Rebuild with `--clear-cache`

## Next Steps

1. ✅ Build with EAS (development or preview)
2. ✅ Test the app thoroughly
3. ✅ Build production version for TestFlight
4. ✅ Submit to App Store Connect

The fix is now permanent and will work for all future builds!
