#!/bin/bash
echo "Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
echo "Cache cleared! Now restart Expo with: npx expo start -c"
