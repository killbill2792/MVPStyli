const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Fabric component registration crash
 * Creates a custom AppDependencyProvider that filters nil components
 */
function withFabricFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const appDelegatePath = path.join(projectRoot, projectName, 'AppDelegate.swift');

      if (fs.existsSync(appDelegatePath)) {
        let appDelegate = fs.readFileSync(appDelegatePath, 'utf8');

        // Add custom provider class before AppDelegate
        if (!appDelegate.includes('SafeAppDependencyProvider')) {
          const customProvider = `
// Custom AppDependencyProvider to filter nil Fabric components
class SafeAppDependencyProvider: RCTAppDependencyProvider {
  override func thirdPartyFabricComponents() -> [String: Any] {
    // Get original components from parent
    let original = super.thirdPartyFabricComponents()
    
    // Filter out nil/NSNull values
    var filtered: [String: Any] = [:]
    for (key, value) in original {
      // Only add non-nil, non-NSNull values
      if !(value is NSNull) {
        filtered[key] = value
      }
    }
    
    return filtered
  }
}
`;

          // Insert before @UIApplicationMain
          const insertPoint = appDelegate.indexOf('@UIApplicationMain');
          if (insertPoint !== -1) {
            appDelegate = 
              appDelegate.slice(0, insertPoint) +
              customProvider +
              '\n' +
              appDelegate.slice(insertPoint);
          }
        }

        // Replace RCTAppDependencyProvider with SafeAppDependencyProvider
        if (appDelegate.includes('RCTAppDependencyProvider()') && !appDelegate.includes('SafeAppDependencyProvider()')) {
          appDelegate = appDelegate.replace(
            /delegate\.dependencyProvider = RCTAppDependencyProvider\(\)/g,
            'delegate.dependencyProvider = SafeAppDependencyProvider()'
          );
        }

        fs.writeFileSync(appDelegatePath, appDelegate);
      }

      return config;
    },
  ]);
}

module.exports = withFabricFix;
