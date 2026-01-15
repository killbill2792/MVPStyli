#!/bin/bash

# Script to setup Expo Dev Client with EAS Build

echo "🚀 Setting up Expo Dev Client..."
echo ""

# Check if EAS CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

echo "📦 Step 1: Login to EAS"
echo "   Please enter your credentials when prompted:"
echo "   Username: Raj_ksn"
echo "   Password: Rinku2792!"
echo ""
npx eas-cli login

if [ $? -ne 0 ]; then
    echo "❌ Login failed. Please try again."
    exit 1
fi

echo ""
echo "✅ Logged in successfully!"
echo ""

echo "📋 Step 2: Configure EAS Build (if not already done)"
npx eas-cli build:configure

echo ""
echo "🏗️  Step 3: Building iOS Development Build..."
echo "   This will take 10-20 minutes and build in the cloud."
echo "   You'll get a download link when it's done."
echo ""
npx eas-cli build --platform ios --profile development

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📱 Next steps:"
    echo "   1. Download the .ipa file from the link provided"
    echo "   2. Install it on your iOS device (via TestFlight or direct install)"
    echo "   3. Run 'npx expo start --dev-client' to start the development server"
    echo "   4. Open the app on your device - it will connect to the dev server"
    echo ""
    echo "🎉 You can now test your app with native modules (expo-face-detector)!"
else
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi
