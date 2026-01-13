#!/usr/bin/env node
/**
 * Update Version Script
 *
 * Updates version.json with current build info before deployment.
 * Run this script before `npm run build` to update version info.
 *
 * Usage:
 *   npx tsx scripts/update-version.ts
 *   npx tsx scripts/update-version.ts --release-notes "Bug fixes"
 *   npx tsx scripts/update-version.ts --critical
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

interface VersionInfo {
  version: string;
  buildTime: string;
  releaseNotes?: string[];
  features?: string[];
  critical?: boolean;
  cid?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const releaseNotes: string[] = [];
let isCritical = false;
let newVersion: string | null = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--release-notes' && args[i + 1]) {
    releaseNotes.push(args[++i]);
  } else if (arg === '--critical') {
    isCritical = true;
  } else if (arg === '--version' && args[i + 1]) {
    newVersion = args[++i];
  }
}

// Read package.json
const pkgPath = resolve(rootDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

// Read existing version.json
const versionPath = resolve(rootDir, 'public/version.json');
let existingVersion: VersionInfo;
try {
  existingVersion = JSON.parse(readFileSync(versionPath, 'utf-8'));
} catch {
  existingVersion = {
    version: '0.0.0',
    buildTime: new Date().toISOString(),
  };
}

// Update version info
const updatedVersion: VersionInfo = {
  version: newVersion || pkg.version,
  buildTime: new Date().toISOString(),
  releaseNotes: releaseNotes.length > 0 ? releaseNotes : existingVersion.releaseNotes,
  features: existingVersion.features,
  critical: isCritical || existingVersion.critical,
};

// Write updated version.json
writeFileSync(versionPath, JSON.stringify(updatedVersion, null, 2) + '\n');

console.log('Version updated:');
console.log(`  Version: ${updatedVersion.version}`);
console.log(`  Build Time: ${updatedVersion.buildTime}`);
if (updatedVersion.critical) {
  console.log('  CRITICAL UPDATE');
}
if (releaseNotes.length > 0) {
  console.log(`  Release Notes: ${releaseNotes.join(', ')}`);
}

// Also update package.json version if specified
if (newVersion && newVersion !== pkg.version) {
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  Package.json version updated to ${newVersion}`);
}
