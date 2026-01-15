const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Fabric component registration crash by patching
 * RCTThirdPartyComponentsProvider to filter out nil components
 */
function withFabricNilFix(config) {
  // First, add a Swift file that patches the component registration
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const patchFile = path.join(projectRoot, projectName, 'FabricNilFix.swift');

      const patchContent = `//
// FabricNilFix.swift
// Auto-generated patch to filter nil Fabric components
//

import Foundation
import React

// Patch RCTThirdPartyComponentsProvider to filter nil components
extension RCTThirdPartyComponentsProvider {
  @objc static func safeThirdPartyFabricComponents() -> [String: Any] {
    let originalComponents = RCTThirdPartyComponentsProvider.thirdPartyFabricComponents()
    // Filter out nil values
    var filteredComponents: [String: Any] = [:]
    for (key, value) in originalComponents {
      if !(value is NSNull) {
        filteredComponents[key] = value
      }
    }
    return filteredComponents
  }
}

// Swizzle the method at runtime
extension RCTThirdPartyComponentsProvider {
  static func swizzleThirdPartyComponents() {
    let originalSelector = #selector(getter: RCTThirdPartyComponentsProvider.thirdPartyFabricComponents)
    let swizzledSelector = #selector(RCTThirdPartyComponentsProvider.safeThirdPartyFabricComponents)
    
    guard let originalMethod = class_getClassMethod(RCTThirdPartyComponentsProvider.self, originalSelector),
          let swizzledMethod = class_getClassMethod(RCTThirdPartyComponentsProvider.self, swizzledSelector) else {
      return
    }
    
    method_exchangeImplementations(originalMethod, swizzledMethod)
  }
}
`;

      // Write the patch file
      fs.writeFileSync(patchFile, patchContent);
      return config;
    },
  ]);

  // Then modify AppDelegate to call the swizzle
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const appDelegatePath = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        'AppDelegate.swift'
      );

      if (fs.existsSync(appDelegatePath)) {
        let appDelegateContent = fs.readFileSync(appDelegatePath, 'utf8');

        // Add import if not present
        if (!appDelegateContent.includes('import Foundation')) {
          appDelegateContent = 'import Foundation\n' + appDelegateContent;
        }

        // Add swizzle call in didFinishLaunchingWithOptions
        if (!appDelegateContent.includes('RCTThirdPartyComponentsProvider.swizzleThirdPartyComponents')) {
          const swizzleCall = `
    // Fix Fabric nil component registration crash
    RCTThirdPartyComponentsProvider.swizzleThirdPartyComponents()
`;
          
          // Insert after super.application call or at the start of didFinishLaunchingWithOptions
          const insertPoint = appDelegateContent.indexOf('let delegate = ReactNativeDelegate()');
          if (insertPoint !== -1) {
            appDelegateContent = 
              appDelegateContent.slice(0, insertPoint) +
              swizzleCall +
              appDelegateContent.slice(insertPoint);
          }
        }

        fs.writeFileSync(appDelegatePath, appDelegateContent);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withFabricNilFix;
