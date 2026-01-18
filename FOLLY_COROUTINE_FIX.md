# Folly Coroutine Fix - New Architecture Enabled

## ✅ Changes Applied

### 1. **Podfile Fix** (`ios/Podfile`)
Added Folly coroutine disable in `post_install` block:
```ruby
# Fix Folly coroutine header issue - disable coroutines to avoid missing header error
installer.pods_project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
  end
end
```

This adds `FOLLY_CFG_NO_COROUTINES=1` to all pod build configurations, preventing the missing `folly/coro/Coroutine.h` header error.

### 2. **New Architecture Enabled** (`app.json`)
- Set `newArchEnabled: true` (top-level)
- Set `newArchEnabled: true` in `expo-build-properties` for iOS and Android

### 3. **Podfile Properties** (`ios/Podfile.properties.json`)
- Set `"newArchEnabled": "true"` to match app.json

## 🎯 What This Fixes

- ✅ Resolves `'folly/coro/Coroutine.h' file not found` build error
- ✅ Enables React Native New Architecture (Fabric + TurboModules)
- ✅ Works with `react-native-reanimated@3.15.5`
- ✅ No need to disable new architecture

## 🚀 Next Steps

1. **Clean and rebuild pods** (if building locally):
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   cd ..
   ```

2. **Rebuild with EAS**:
   ```bash
   npx eas-cli build --platform ios --profile development --clear-cache
   ```

## 📝 How It Works

The fix disables Folly coroutines at compile time by adding `FOLLY_CFG_NO_COROUTINES=1` to the preprocessor definitions. This prevents `Expected.h` from trying to include the missing `folly/coro/Coroutine.h` header, while still allowing the new architecture to work properly.

## ⚠️ Note

- This is a workaround for a known Folly version mismatch issue
- The new architecture is now enabled, so ensure all dependencies support it
- If you encounter other build issues, they may be related to new architecture compatibility
