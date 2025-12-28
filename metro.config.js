const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver alias for react-native-fs to use our polyfill
// This allows TensorFlow.js to work in Expo managed workflow
config.resolver = {
  ...config.resolver,
  alias: {
    ...(config.resolver?.alias || {}),
    'react-native-fs': path.resolve(__dirname, 'lib/react-native-fs-polyfill.ts'),
  },
};

module.exports = config;
