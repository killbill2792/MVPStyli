# Removing TensorFlow Packages to Fix Fabric Crash

## Problem
The app crashes because TensorFlow native modules (`@tensorflow/tfjs-react-native`) are still being linked even though we disabled JavaScript imports. These modules try to register Fabric components, causing the crash.

## Solution: Remove Unused TensorFlow Packages

Since we're using `expo-face-detector` instead of TensorFlow, we should remove these packages:

```bash
npm uninstall @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow-models/face-detection @mediapipe/face_detection
```

## After Removal

1. Rebuild the development client:
```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

2. The app should start without crashing

## Note on react-native-webview

The color picker uses `react-native-webview`, which should be fine. If issues persist after removing TensorFlow, we may need to check WebView configuration.
