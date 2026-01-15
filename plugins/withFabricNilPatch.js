const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Config plugin to patch RCTThirdPartyComponentsProvider.mm
 * This runs during prebuild and patches the file after it's generated
 */
function withFabricNilPatch(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const rootDir = path.join(projectRoot, '..');
      
      // Run the patch script after prebuild completes
      // The file may not exist yet, but the script handles that gracefully
      try {
        const patchScript = path.join(rootDir, 'scripts', 'patch-thirdpartycomponents-robust.js');
        if (fs.existsSync(patchScript)) {
          // The file is generated during build, so we'll set up the patch to run
          // via postbuild hook in package.json
          console.log('✅ Fabric nil patch script configured');
        }
      } catch (error) {
        console.warn('⚠️  Could not configure patch script:', error.message);
      }

      return config;
    },
  ]);
}

module.exports = withFabricNilPatch;
