#!/bin/bash

# Clean iOS Build Script
# This script completely cleans the iOS build to remove any stale native modules

set -e

echo "🧹 Cleaning iOS build artifacts..."

# Remove Pods
echo "Removing Pods..."
rm -rf ios/Pods
rm -rf ios/Podfile.lock

# Remove build folders
echo "Removing build folders..."
rm -rf ios/build
rm -rf ios/DerivedData

# Remove node_modules (optional, but ensures clean state)
echo "Removing node_modules..."
rm -rf node_modules

# Clean Metro bundler cache
echo "Cleaning Metro cache..."
rm -rf .expo
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*

# Clean npm cache (optional)
echo "Cleaning npm cache..."
npm cache clean --force

echo "✅ iOS build cleaned!"
echo ""
echo "Next steps:"
echo "1. Run: npm install"
echo "2. Run: cd ios && pod install"
echo "3. Rebuild your dev client with: npx eas-cli build --platform ios --profile development --clear-cache"
