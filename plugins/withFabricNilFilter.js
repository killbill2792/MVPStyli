const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Fabric component registration crash
 * Patches RCTThirdPartyComponentsProvider to filter out nil components
 */
function withFabricNilFilter(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      
      // Create a bridging header patch file
      const bridgingHeaderPath = path.join(projectRoot, projectName, 'MVPStyli-Bridging-Header.h');
      let bridgingHeader = '';
      
      if (fs.existsSync(bridgingHeaderPath)) {
        bridgingHeader = fs.readFileSync(bridgingHeaderPath, 'utf8');
      }
      
      // Add React import if not present
      if (!bridgingHeader.includes('#import <React/RCTBridgeModule.h>')) {
        bridgingHeader += '\n#import <React/RCTBridgeModule.h>\n';
      }
      
      // Create a Swift extension file to patch the component registration
      const patchSwiftPath = path.join(projectRoot, projectName, 'FabricNilFilter.swift');
      const patchSwiftContent = `//
// FabricNilFilter.swift
// Auto-generated patch to filter nil Fabric components and prevent crashes
//

import Foundation
import React

@objc extension NSObject {
  // This method will be swizzled at runtime to filter nil components
  @objc static func safeThirdPartyFabricComponents() -> [String: Any] {
    // Get original components
    let original = RCTThirdPartyComponentsProvider.thirdPartyFabricComponents()
    
    // Filter out nil values
    var filtered: [String: Any] = [:]
    for (key, value) in original {
      // Only add non-nil values
      if !(value is NSNull) {
        filtered[key] = value
      }
    }
    
    return filtered
  }
}

// Runtime swizzling will be done in AppDelegate
`;

      // Write the patch file
      fs.writeFileSync(patchSwiftPath, patchSwiftContent);
      fs.writeFileSync(bridgingHeaderPath, bridgingHeader);

      // Modify AppDelegate to apply the patch
      const appDelegatePath = path.join(projectRoot, projectName, 'AppDelegate.swift');
      if (fs.existsSync(appDelegatePath)) {
        let appDelegate = fs.readFileSync(appDelegatePath, 'utf8');
        
        // Add import for Objective-C runtime if not present
        if (!appDelegate.includes('import ObjectiveC')) {
          appDelegate = 'import ObjectiveC\n' + appDelegate;
        }
        
        // Add swizzling code before factory.startReactNative
        if (!appDelegate.includes('FabricNilFilter')) {
          const swizzleCode = `
    // Patch Fabric component registration to filter nil components
    // This prevents crashes when modules try to register nil Fabric components
    do {
      let originalMethod = class_getClassMethod(RCTThirdPartyComponentsProvider.self, #selector(getter: RCTThirdPartyComponentsProvider.thirdPartyFabricComponents))
      let swizzledMethod = class_getClassMethod(NSObject.self, #selector(NSObject.safeThirdPartyFabricComponents))
      
      if let original = originalMethod, let swizzled = swizzledMethod {
        method_exchangeImplementations(original, swizzled)
        print("✅ Fabric nil filter patch applied")
      }
    } catch {
      print("⚠️ Could not apply Fabric nil filter patch: \\(error)")
    }
`;
          
          // Insert before factory.startReactNative
          const insertPoint = appDelegate.indexOf('factory.startReactNative');
          if (insertPoint !== -1) {
            appDelegate = 
              appDelegate.slice(0, insertPoint) +
              swizzleCode +
              appDelegate.slice(insertPoint);
          }
        }
        
        fs.writeFileSync(appDelegatePath, appDelegate);
      }

      return config;
    },
  ]);
}

module.exports = withFabricNilFilter;
