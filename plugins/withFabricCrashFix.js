const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Fabric component registration crash
 * This patches the native code to filter out nil components during registration
 */
function withFabricCrashFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const appDelegatePath = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        'AppDelegate.swift'
      );

      if (fs.existsSync(appDelegatePath)) {
        let appDelegateContent = fs.readFileSync(appDelegatePath, 'utf8');

        // Add import for RCTThirdPartyComponentsProvider if not present
        if (!appDelegateContent.includes('import ReactAppDependencyProvider')) {
          // The import should already be there, but we'll check
        }

        // Add a custom AppDependencyProvider that filters nil components
        const customProviderCode = `
// Custom AppDependencyProvider to filter nil Fabric components
class SafeAppDependencyProvider: RCTAppDependencyProvider {
  override func thirdPartyFabricComponents() -> [String : Any] {
    let components = super.thirdPartyFabricComponents()
    // Filter out any nil values
    return components.compactMapValues { $0 }
  }
}
`;

        // Replace RCTAppDependencyProvider with SafeAppDependencyProvider
        if (!appDelegateContent.includes('SafeAppDependencyProvider')) {
          // Insert the custom provider class before the AppDelegate class
          const insertIndex = appDelegateContent.indexOf('@UIApplicationMain');
          if (insertIndex !== -1) {
            appDelegateContent = 
              appDelegateContent.slice(0, insertIndex) +
              customProviderCode +
              appDelegateContent.slice(insertIndex);
          }

          // Replace the usage of RCTAppDependencyProvider
          appDelegateContent = appDelegateContent.replace(
            /delegate\.dependencyProvider = RCTAppDependencyProvider\(\)/g,
            'delegate.dependencyProvider = SafeAppDependencyProvider()'
          );

          fs.writeFileSync(appDelegatePath, appDelegateContent);
        }
      }

      return config;
    },
  ]);
}

module.exports = withFabricCrashFix;
