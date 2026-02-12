#!/usr/bin/env node

/**
 * Normalize all @croco/* package.json files
 *
 * Changes:
 * 1. Set version to "0.1.0"
 * 2. Ensure publishConfig.access = "public"
 * 3. Move files = ["dist"] to root level (from inside publishConfig)
 * 4. Preserve all other fields (dependencies, scripts, etc.)
 * 5. Preserve publishConfig.exports, publishConfig.main, publishConfig.types
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);
const packagesDir = path.join(rootDir, 'packages');

// Find all package.json files recursively, excluding node_modules
function findPackageJsonFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      findPackageJsonFiles(fullPath, results);
    } else if (entry.isFile() && entry.name === 'package.json') {
      results.push(fullPath);
    }
  }

  return results;
}

const packageJsonFiles = findPackageJsonFiles(packagesDir);

let modifiedCount = 0;
let skippedCount = 0;

for (const pkgPath of packageJsonFiles) {
  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Skip if private or not @croco/*
    if (pkg.private === true || !pkg.name?.startsWith('@croco/')) {
      skippedCount++;
      continue;
    }

    let modified = false;

    // 1. Set version to "0.1.0"
    if (pkg.version !== '0.1.0') {
      pkg.version = '0.1.0';
      modified = true;
    }

    // 2. Ensure publishConfig.access = "public"
    if (!pkg.publishConfig) {
      pkg.publishConfig = {};
    }
    if (pkg.publishConfig.access !== 'public') {
      pkg.publishConfig.access = 'public';
      modified = true;
    }

    // 3. Move files to root level if inside publishConfig
    if (pkg.publishConfig.files) {
      delete pkg.publishConfig.files;
      modified = true;
    }

    // 4. Ensure files exists at root level
    // Special case: @croco/utils-next-font-pretendard needs extra font file
    if (pkg.name === '@croco/utils-next-font-pretendard') {
      if (!pkg.files || !pkg.files.includes('PretendardVariable.woff2')) {
        pkg.files = ['dist', 'PretendardVariable.woff2'];
        modified = true;
      }
    } else {
      // Standard case: just ["dist"]
      if (!pkg.files || JSON.stringify(pkg.files) !== JSON.stringify(['dist'])) {
        pkg.files = ['dist'];
        modified = true;
      }
    }

    if (modified) {
      // Write back with proper formatting
      const newContent = `${JSON.stringify(pkg, null, 2)}\n`;
      fs.writeFileSync(pkgPath, newContent, 'utf-8');
      console.log(`✓ Modified: ${pkg.name}`);
      modifiedCount++;
    } else {
      console.log(`- Already normalized: ${pkg.name}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${pkgPath}:`, error.message);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Modified: ${modifiedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Total: ${packageJsonFiles.length}`);

if (modifiedCount > 0) {
  console.log(`\n✓ ${modifiedCount} package.json files have been normalized.`);
} else {
  console.log(`\n✓ All packages already normalized.`);
}
