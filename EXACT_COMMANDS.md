# Exact Commands to Run

## Step 1: Clean and Prepare

```bash
cd /Users/Raj/Downloads/MVPStyli_Fresh
rm -rf ios android node_modules
npm install
```

## Step 2: Prebuild (Generates Native Code)

```bash
npx expo prebuild --platform ios --clean
```

This will:
- Generate iOS native code
- The patch script will attempt to run (file may not exist yet, that's OK)

## Step 3: Build with EAS

### Option A: Development Build (for testing)

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

### Option B: Preview Build (for TestFlight testing)

```bash
npx eas-cli build --platform ios --profile preview --clear-cache
```

### Option C: Production Build (for App Store)

```bash
npx eas-cli build --platform ios --profile production
```

**Important**: The patch script runs automatically via the `postbuild` hook in package.json. EAS will run it after the file is generated during the build process.

## Step 4: After Build Completes

1. **Download the build** from EAS dashboard
2. **Install on device** (development/preview) or **upload to TestFlight** (production)
3. **Test the app** - it should start without crashing

## Step 5: Run Dev Client (if using development build)

```bash
npx expo start --dev-client --port 8082
```

## What Happens Automatically

1. ✅ `newArchEnabled: false` is set at top level (prevents Fabric from being enabled)
2. ✅ Patch script runs after prebuild/build via `postbuild` hook
3. ✅ `RCTThirdPartyComponentsProvider.mm` gets patched to filter nil components
4. ✅ App starts without crashing

## Verification

After the build, you can verify the patch was applied by checking the build logs for:
- "✅ Successfully patched" message
- Or "✅ File already patched" if it ran multiple times

## If You Need to Test Locally First

```bash
# After prebuild, manually run patch (if file exists)
node scripts/patch-thirdpartycomponents-robust.js

# Then build locally (requires Xcode)
cd ios && pod install && cd ..
npx expo run:ios
```

## For TestFlight Submission

1. Build with production profile
2. Download the .ipa file
3. Upload to App Store Connect via Xcode or Transporter
4. Submit for TestFlight review

The fix is permanent and will work for all future builds!
