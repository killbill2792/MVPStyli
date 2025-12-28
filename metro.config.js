const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver alias for react-native-fs to use our polyfill
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver?.alias,
    'react-native-fs': require.resolve('./lib/react-native-fs-polyfill.ts'),
  },
};

module.exports = config;
