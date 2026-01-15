#!/usr/bin/env node

/**
 * Robust patch for RCTThirdPartyComponentsProvider.mm
 * Handles the file generated during React Native codegen/build process
 */

const fs = require('fs');
const path = require('path');

function findFile(rootDir) {
  const searchPaths = [
    path.join(rootDir, 'ios', 'build', 'generated', 'ios', 'RCTThirdPartyComponentsProvider.mm'),
    path.join(rootDir, 'ios', 'MVPStyli', 'build', 'generated', 'ios', 'RCTThirdPartyComponentsProvider.mm'),
  ];

  // Recursive search in ios directory
  function searchRecursive(dir, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth) return null;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === 'RCTThirdPartyComponentsProvider.mm') {
          return fullPath;
        }
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'Pods') {
          const found = searchRecursive(fullPath, maxDepth, currentDepth + 1);
          if (found) return found;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  }

  // Try exact paths first
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      return searchPath;
    }
  }

  // Recursive search
  const iosDir = path.join(rootDir, 'ios');
  if (fs.existsSync(iosDir)) {
    return searchRecursive(iosDir);
  }

  return null;
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Check if already patched
  if (content.includes('// PATCHED: Safe nil-checked dictionary') || 
      content.includes('NSMutableDictionary *components')) {
    console.log('✅ File already patched');
    return true;
  }

  // Pattern to match the entire method implementation
  // This handles both @implementation and static function patterns
  const methodPatterns = [
    // Pattern 1: + (NSDictionary<NSString *, Class> *)thirdPartyFabricComponents { ... }
    /(\+ \(NSDictionary<NSString \*, Class> \*\)thirdPartyFabricComponents\s*\{)([\s\S]*?)(return\s+@\{)([\s\S]*?)(\};[\s\S]*?\})/,
    // Pattern 2: static NSDictionary<NSString *, Class> *thirdPartyFabricComponents(void) { ... }
    /(static\s+NSDictionary<NSString \*, Class> \*thirdPartyFabricComponents\(void\)\s*\{)([\s\S]*?)(return\s+@\{)([\s\S]*?)(\};[\s\S]*?\})/,
  ];

  let patched = false;

  for (const pattern of methodPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, (match, methodStart, beforeReturn, returnStmt, dictContent, methodEnd) => {
        // Extract all dictionary entries
        const entries = [];
        const entryRegex = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;
        let entryMatch;
        
        while ((entryMatch = entryRegex.exec(dictContent)) !== null) {
          entries.push({
            key: entryMatch[1],
            className: entryMatch[2]
          });
        }

        if (entries.length === 0) {
          return match; // No entries, don't modify
        }

        // Build safe implementation
        let safeCode = methodStart;
        safeCode += beforeReturn;
        safeCode += '// PATCHED: Safe nil-checked dictionary to prevent crashes when Fabric components are nil\n';
        safeCode += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
        
        for (const entry of entries) {
          const varName = entry.key.replace(/[^a-zA-Z0-9]/g, '_') + '_Class';
          safeCode += `        Class ${varName} = NSClassFromString(@"${entry.className}");\n`;
          safeCode += `        if (${varName} != nil) {\n`;
          safeCode += `            components[@"${entry.key}"] = ${varName};\n`;
          safeCode += `        }\n`;
        }
        
        safeCode += '        return [components copy];';
        safeCode += methodEnd;
        
        patched = true;
        return safeCode;
      });

      if (patched) break;
    }
  }

  // If no pattern matched, try a simpler approach: find and replace the dictionary literal
  if (!patched) {
    // Find dictionary literal pattern
    const dictPattern = /(@\{[\s\S]*?NSClassFromString\(@"[^"]+"\)[\s\S]*?\})/;
    
    if (dictPattern.test(content)) {
      content = content.replace(dictPattern, (match) => {
        const entries = [];
        const entryRegex = /@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\)/g;
        let entryMatch;
        
        while ((entryMatch = entryRegex.exec(match)) !== null) {
          entries.push({
            key: entryMatch[1],
            className: entryMatch[2]
          });
        }

        if (entries.length === 0) {
          return match;
        }

        let safeCode = '// PATCHED: Safe nil-checked dictionary\n';
        safeCode += '        NSMutableDictionary *components = [NSMutableDictionary dictionary];\n';
        
        for (const entry of entries) {
          const varName = entry.key.replace(/[^a-zA-Z0-9]/g, '_') + '_Class';
          safeCode += `        Class ${varName} = NSClassFromString(@"${entry.className}");\n`;
          safeCode += `        if (${varName} != nil) {\n`;
          safeCode += `            components[@"${entry.key}"] = ${varName};\n`;
          safeCode += `        }\n`;
        }
        
        safeCode += '        [components copy]';
        
        patched = true;
        return safeCode;
      });
    }
  }

  if (patched && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Successfully patched ${filePath}`);
    return true;
  }

  return false;
}

// Main execution
const rootDir = process.cwd();
const filePath = findFile(rootDir);

if (filePath) {
  const success = patchFile(filePath);
  if (success) {
    console.log('✅ Patch applied successfully');
    process.exit(0);
  } else {
    console.log('⚠️  File found but could not be patched (may already be patched or have different format)');
    process.exit(0); // Don't fail
  }
} else {
  console.log('ℹ️  RCTThirdPartyComponentsProvider.mm not found yet.');
  console.log('   This is normal - the file is generated during the build process.');
  console.log('   The patch will be applied automatically when the file is generated.');
  process.exit(0); // Don't fail if file doesn't exist yet
}
