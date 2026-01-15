/**
 * EAS Build Hooks
 * These run during EAS builds to patch generated files
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  // This hook runs after the build completes but before the app is packaged
  // We use it to patch the generated file
  async postBuild({ buildProfile, platform, projectDir }) {
    if (platform === 'ios') {
      console.log('🔧 Running post-build patch for RCTThirdPartyComponentsProvider...');
      
      const patchScript = path.join(projectDir, 'scripts', 'patch-thirdpartycomponents-robust.js');
      if (fs.existsSync(patchScript)) {
        try {
          const { execSync } = require('child_process');
          execSync(`node ${patchScript}`, { 
            cwd: projectDir,
            stdio: 'inherit'
          });
          console.log('✅ Post-build patch completed');
        } catch (error) {
          console.warn('⚠️  Post-build patch failed (non-critical):', error.message);
        }
      }
    }
  }
};
