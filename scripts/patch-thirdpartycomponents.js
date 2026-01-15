#!/usr/bin/env node

/**
 * Patch RCTThirdPartyComponentsProvider.mm to filter nil components
 * This prevents crashes when NSClassFromString returns nil for Fabric components
 * that aren't available when newArchEnabled is false.
 * 
 * This script runs after prebuild to patch the generated file.
 */

const fs = require('fs');
const path = require('path');

const POSSIBLE_PATHS = [
  'ios/build/generated/ios/RCTThirdPartyComponentsProvider.mm',
  'ios/MVPStyli/build/generated/ios/RCTThirdPartyComponentsProvider.mm',
  'ios/Pods/Headers/Public/React-Core/RCTThirdPartyComponentsProvider.mm',
  'node_modules/react-native/React/CoreModules/RCTThirdPartyComponentsProvider.mm',
];

function findFile(rootDir) {
  // Try exact paths first
  for (const relPath of POSSIBLE_PATHS.slice(0, 2)) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // Try recursive search
  function searchDir(dir, depth = 0) {
    if (depth > 5) return null; // Limit recursion
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const found = searchDir(fullPath, depth + 1);
          if (found) return found;
        } else if (entry.name === 'RCTThirdPartyComponentsProvider.mm') {
          return fullPath;
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
    return null;
  }
  
  const iosDir = path.join(rootDir, 'ios');
  if (fs.existsSync(iosDir)) {
    return searchDir(iosDir);
  }
  
  return null;
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  RCTThirdPartyComponentsProvider.mm not found at ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Check if already patched
  if (content.includes('// PATCHED: Safe nil-checked dictionary')) {
    console.log('✅ RCTThirdPartyComponentsProvider.mm already patched');
    return true;
  }

  // Pattern 1: Dictionary literal with @{ ... }
  const dictLiteralPattern = /(@\{[^}]*NSClassFromString\([^)]+\)[^}]*\})/s;
  
  // Pattern 2: Dictionary with individual entries
  const dictEntryPattern = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;

  // Try to find and replace dictionary literal
  if (dictLiteralPattern.test(content)) {
    // Replace entire dictionary literal with safe version
    content = content.replace(
      dictLiteralPattern,
      (match) => {
        // Extract all entries from the dictionary
        const entries = [];
        let entryMatch;
        const entryRegex = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;
        while ((entryMatch = entryRegex.exec(match)) !== null) {
          entries.push({
            key: entryMatch[1],
            className: entryMatch[2]
          });
        }

        // Build safe NSMutableDictionary version
        let safeDict = '// PATCHED: Safe nil-checked dictionary\n';
        safeDict += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
        
        for (const entry of entries) {
          safeDict += `        Class ${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}Class = NSClassFromString(@"${entry.className}");\n`;
          safeDict += `        if (${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}Class != nil) {\n`;
          safeDict += `            components[@"${entry.key}"] = ${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}Class;\n`;
          safeDict += `        }\n`;
        }
        
        safeDict += '        return [components copy];';
        
        return safeDict;
      }
    );
  } else {
    // Try to find individual entries and wrap in safe dictionary
    const entries = [];
    let match;
    while ((match = dictEntryPattern.exec(content)) !== null) {
      entries.push({
        key: match[1],
        className: match[2],
        fullMatch: match[0]
      });
    }

    if (entries.length > 0) {
      // Find the return statement or dictionary assignment
      const returnPattern = /return\s+(@\{[^}]+\});/s;
      if (returnPattern.test(content)) {
        content = content.replace(returnPattern, () => {
          let safeCode = '// PATCHED: Safe nil-checked dictionary\n';
          safeCode += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
          
          for (const entry of entries) {
            const varName = entry.key.replace(/[^a-zA-Z0-9]/g, '_') + '_Class';
            safeCode += `        Class ${varName} = NSClassFromString(@"${entry.className}");\n`;
            safeCode += `        if (${varName} != nil) {\n`;
            safeCode += `            components[@"${entry.key}"] = ${varName};\n`;
            safeCode += `        }\n`;
          }
          
          safeCode += '        return [components copy];';
          return safeCode;
        });
      }
    }
  }

  // More aggressive pattern: find the entire thirdPartyFabricComponents implementation
  // Match the method implementation with dictionary return (multiline)
  const implementationPattern = /(\+ \(NSDictionary<NSString \*, Class> \*\)thirdPartyFabricComponents\s*\{[\s\S]*?return\s+@\{[\s\S]*?\};[\s\S]*?\})/;
  
  // Alternative pattern for block-based implementation
  const blockPattern = /(static\s+NSDictionary<NSString \*, Class> \*thirdPartyFabricComponents\(void\)\s*\{[\s\S]*?return\s+@\{[\s\S]*?\};[\s\S]*?\})/;
  
  // Try block pattern first
  if (blockPattern.test(content) && content === originalContent) {
    content = content.replace(blockPattern, (match) => {
      // Extract entries
      const entries = [];
      let entryMatch;
      const entryRegex = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;
      while ((entryMatch = entryRegex.exec(match)) !== null) {
        entries.push({
          key: entryMatch[1],
          className: entryMatch[2]
        });
      }

      if (entries.length === 0) {
        return match; // No entries found, don't modify
      }

      // Build safe implementation
      let safeImpl = match.split('return')[0]; // Keep everything before return
      safeImpl += '// PATCHED: Safe nil-checked dictionary\n';
      safeImpl += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
      
      for (const entry of entries) {
        const varName = entry.key.replace(/[^a-zA-Z0-9]/g, '_') + '_Class';
        safeImpl += `        Class ${varName} = NSClassFromString(@"${entry.className}");\n`;
        safeImpl += `        if (${varName} != nil) {\n`;
        safeImpl += `            components[@"${entry.key}"] = ${varName};\n`;
        safeImpl += `        }\n`;
      }
      
      safeImpl += '        return [components copy];\n';
      safeImpl += '    }';
      
      return safeImpl;
    });
  }
  
  if (implementationPattern.test(content) && content === originalContent) {
    content = content.replace(implementationPattern, (match) => {
      // Extract entries
      const entries = [];
      let entryMatch;
      const entryRegex = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;
      while ((entryMatch = entryRegex.exec(match)) !== null) {
        entries.push({
          key: entryMatch[1],
          className: entryMatch[2]
        });
      }

      if (entries.length === 0) {
        return match; // No entries found, don't modify
      }

      // Build safe implementation
      let safeImpl = match.split('return')[0]; // Keep everything before return
      safeImpl += '// PATCHED: Safe nil-checked dictionary\n';
      safeImpl += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
      
      for (const entry of entries) {
        const varName = entry.key.replace(/[^a-zA-Z0-9]/g, '_') + '_Class';
        safeImpl += `        Class ${varName} = NSClassFromString(@"${entry.className}");\n`;
        safeImpl += `        if (${varName} != nil) {\n`;
        safeImpl += `            components[@"${entry.key}"] = ${varName};\n`;
        safeImpl += `        }\n`;
      }
      
      safeImpl += '        return [components copy];\n';
      safeImpl += '    }';
      
      return safeImpl;
    });
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Patched RCTThirdPartyComponentsProvider.mm at ${filePath}`);
    return true;
  } else {
    console.log(`⚠️  Could not find dictionary pattern in ${filePath}`);
    console.log('   File may already be patched or have a different format');
    return false;
  }
}

// Main execution
const rootDir = process.cwd();
const filePath = findFile(rootDir);

if (filePath) {
  const success = patchFile(filePath);
  process.exit(success ? 0 : 1);
} else {
  console.log('⚠️  RCTThirdPartyComponentsProvider.mm not found. Run `npx expo prebuild` first.');
  process.exit(0); // Don't fail if file doesn't exist yet
}
