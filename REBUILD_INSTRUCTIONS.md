# URGENT: Rebuild Instructions to Fix Fabric Crash

## The Problem

Your app is crashing because the **native iOS build still contains code from removed modules**. Even though we removed problematic packages from `package.json`, the native build (created before removal) still tries to register Fabric components, causing the crash.

## The Solution: Clean Rebuild

You **MUST** rebuild your development client with a clean cache. Here's how:

### Option 1: Rebuild with EAS (Recommended)

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

**Important**: The `--clear-cache` flag is **CRITICAL** - it removes all stale native code.

### Option 2: Clean Local Build (if building locally)

1. **Run the clean script**:
   ```bash
   ./clean-ios-build.sh
   ```

2. **Reinstall dependencies**:
   ```bash
   npm install
   ```

3. **Reinstall Pods**:
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   ```

4. **Rebuild**:
   ```bash
   npx expo run:ios
   ```

## Why This Will Fix It

1. ✅ **All problematic modules removed** from package.json:
   - No TensorFlow packages
   - No react-native-webview
   - No react-native-image-colors
   - No react-native-fs
   - No expo-gl

2. ✅ **Only safe modules remain**:
   - `react-native-safe-area-context` (Expo-compatible)
   - All Expo modules (expo-camera, expo-image-picker, etc.)

3. ✅ **Clean build removes stale native code**:
   - Unlinks all removed modules
   - Regenerates native code without problematic modules
   - Applies correct `newArchEnabled: false` settings

## Current Configuration

Your `app.json` is correctly configured:
- ✅ `newArchEnabled: false` for iOS and Android
- ✅ iOS deployment target: 15.1
- ✅ All build properties set correctly

## After Rebuild

Once you rebuild with `--clear-cache`, the app should:
- ✅ Start without crashing
- ✅ Load the development client
- ✅ Connect to Metro bundler
- ✅ All features work correctly

## If It Still Crashes

If the crash persists after rebuilding with `--clear-cache`:

1. **Check the build was actually rebuilt**:
   - Verify the build timestamp is recent
   - Make sure you're using the new build, not an old one

2. **Check build logs**:
   ```bash
   npx eas-cli build:view [BUILD_ID]
   ```

3. **Verify no stale references**:
   ```bash
   grep -r "tensorflow\|webview" ios/ 2>/dev/null
   ```

4. **Contact support** with:
   - The full crash log
   - The build ID
   - Confirmation that you used `--clear-cache`

## Summary

**The fix is simple but critical**: Rebuild with `--clear-cache`. The crash will persist until you do this because the old build still has removed modules' native code.
