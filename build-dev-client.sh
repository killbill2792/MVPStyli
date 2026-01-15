#!/bin/bash

# Quick script to build Expo Dev Client
# Run this after logging in to EAS

echo "🚀 Building Expo Dev Client for iOS..."
echo ""
echo "This will:"
echo "  ✅ Build your app in the cloud (no local setup needed!)"
echo "  ✅ Include all native modules (expo-face-detector)"
echo "  ✅ Create a development build you can install"
echo ""
echo "⏳ This takes 10-20 minutes..."
echo ""

npx eas-cli build --platform ios --profile development

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed!"
    echo ""
    echo "📱 Next steps:"
    echo "   1. Download the .ipa from the link above"
    echo "   2. Install on your iOS device"
    echo "   3. Run: npx expo start --dev-client"
    echo "   4. Open the app and scan the QR code"
    echo ""
    echo "🎉 Face detection will now work!"
else
    echo ""
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi
