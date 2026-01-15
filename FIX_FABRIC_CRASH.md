# Fix for Fabric Component Registration Crash

## Problem
The app crashes on startup with:
```
NSInvalidArgumentException: *** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]: attempt to insert nil object from objects[0]
in RCTThirdPartyComponentsProvider thirdPartyFabricComponents
```

This happens when a native module tries to register Fabric components but returns `nil`, even though `newArchEnabled: false` is set.

## Root Cause
The native iOS build still contains references to removed modules. Even though packages were removed from `package.json`, the native build (Pods, Xcode project) still has stale code trying to register Fabric components.

## Solution: Complete Clean Rebuild

### Step 1: Clean Everything Locally (if building locally)

Run the clean script:
```bash
./clean-ios-build.sh
```

Or manually:
```bash
# Remove Pods
rm -rf ios/Pods ios/Podfile.lock

# Remove build artifacts
rm -rf ios/build ios/DerivedData

# Clean Metro cache
rm -rf .expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*

# Reinstall dependencies
npm install
```

### Step 2: Rebuild with EAS (Recommended)

**CRITICAL**: You MUST rebuild with `--clear-cache` to remove all stale native modules:

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

The `--clear-cache` flag ensures:
- All removed native modules are unlinked
- Fresh native code generation
- No stale Fabric component registrations
- Correct `newArchEnabled: false` settings applied

### Step 3: Verify Configuration

Ensure `app.json` has:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "newArchEnabled": false,
            "deploymentTarget": "15.1"
          },
          "android": {
            "newArchEnabled": false
          }
        }
      ]
    ]
  }
}
```

## Current Dependencies (All Safe)

✅ **Remaining native modules:**
- `react-native-safe-area-context` - Expo-compatible
- All Expo modules (expo-camera, expo-image-picker, etc.) - All safe

✅ **Removed problematic modules:**
- `@tensorflow/tfjs` - Removed
- `@tensorflow/tfjs-react-native` - Removed
- `react-native-image-colors` - Removed
- `react-native-fs` - Removed (using polyfill)
- `react-native-webview` - Removed (ColorPickerModal disabled)
- `expo-gl` - Removed

## Why This Will Fix It

1. **Clean build removes all stale native code** from removed modules
2. **Only safe, Expo-compatible modules remain**
3. **Correct build properties** ensure Fabric is disabled
4. **Fresh Pod installation** ensures no old module links

## After Rebuild

The app should:
- ✅ Start without crashing
- ✅ Load the development client
- ✅ Connect to Metro bundler
- ✅ All remaining features work

## If Still Crashing After Rebuild

1. **Check build logs**:
   ```bash
   npx eas-cli build:view [BUILD_ID]
   ```

2. **Verify no stale references**:
   ```bash
   grep -r "tensorflow\|webview\|image-colors" ios/ 2>/dev/null
   ```

3. **Check which module is causing it**:
   - Look at the stack trace to identify the module
   - The error will show which module is trying to register nil components

4. **Temporary workaround** (if needed):
   - We may need to create a custom AppDelegate patch
   - Or temporarily remove more modules to isolate the issue

## Important Notes

- **DO NOT** skip the `--clear-cache` flag - it's essential
- **DO NOT** use an old build - you must rebuild after removing modules
- The crash will persist until you rebuild with `--clear-cache`
