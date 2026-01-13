#!/usr/bin/env npx ts-node

/**
 * Build Verification Script
 *
 * Automated verification of the production build including:
 * - Bundle size checks
 * - Asset verification
 * - Source map validation
 * - Manifest validation
 * - Service worker verification
 *
 * Usage: npx ts-node scripts/verify-build.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
}

const DIST_DIR = path.join(__dirname, '..', 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

// Configuration
const MAX_MAIN_BUNDLE_KB = 600; // Main bundle limit
const MAX_TOTAL_BUNDLE_KB = 2000; // Total JS limit
const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
  'registerSW.js',
  'sw.js',
];

const results: VerificationResult[] = [];

function addResult(check: string, status: 'pass' | 'fail' | 'warn', message: string, details?: string) {
  results.push({ check, status, message, details });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function checkDistExists(): void {
  if (!fs.existsSync(DIST_DIR)) {
    addResult('Build output', 'fail', 'dist/ directory does not exist - run npm run build first');
    return;
  }
  addResult('Build output', 'pass', 'dist/ directory exists');
}

function checkRequiredFiles(): void {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(DIST_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      addResult(`Required file: ${file}`, 'pass', `Exists (${formatSize(stats.size)})`);
    } else {
      addResult(`Required file: ${file}`, 'fail', 'File not found');
    }
  }
}

function checkBundleSizes(): void {
  if (!fs.existsSync(ASSETS_DIR)) {
    addResult('Bundle sizes', 'fail', 'assets/ directory not found');
    return;
  }

  const jsFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
  const bundles: BundleInfo[] = [];
  let totalSize = 0;
  let mainBundleSize = 0;

  for (const file of jsFiles) {
    const filePath = path.join(ASSETS_DIR, file);
    const stats = fs.statSync(filePath);
    bundles.push({ name: file, size: stats.size });
    totalSize += stats.size;

    if (file.startsWith('index-')) {
      mainBundleSize = stats.size;
    }
  }

  // Check main bundle
  const mainBundleKB = mainBundleSize / 1024;
  if (mainBundleKB <= MAX_MAIN_BUNDLE_KB) {
    addResult('Main bundle size', 'pass', `${mainBundleKB.toFixed(2)}KB (limit: ${MAX_MAIN_BUNDLE_KB}KB)`);
  } else {
    addResult('Main bundle size', 'warn', `${mainBundleKB.toFixed(2)}KB exceeds limit of ${MAX_MAIN_BUNDLE_KB}KB`);
  }

  // Check total size
  const totalKB = totalSize / 1024;
  if (totalKB <= MAX_TOTAL_BUNDLE_KB) {
    addResult('Total JS size', 'pass', `${totalKB.toFixed(2)}KB (limit: ${MAX_TOTAL_BUNDLE_KB}KB)`);
  } else {
    addResult('Total JS size', 'warn', `${totalKB.toFixed(2)}KB exceeds limit of ${MAX_TOTAL_BUNDLE_KB}KB`);
  }

  // List all bundles
  const bundleDetails = bundles
    .map(b => `  ${b.name}: ${formatSize(b.size)}`)
    .join('\n');
  addResult('Bundle breakdown', 'pass', `${bundles.length} JS bundles`, bundleDetails);
}

function checkSourceMaps(): void {
  if (!fs.existsSync(ASSETS_DIR)) {
    addResult('Source maps', 'fail', 'assets/ directory not found');
    return;
  }

  const jsFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
  const mapFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js.map'));

  if (mapFiles.length >= jsFiles.length) {
    addResult('Source maps', 'pass', `${mapFiles.length} source maps for ${jsFiles.length} bundles`);
  } else {
    addResult('Source maps', 'warn', `Only ${mapFiles.length} source maps for ${jsFiles.length} bundles`);
  }
}

function checkCSS(): void {
  if (!fs.existsSync(ASSETS_DIR)) {
    addResult('CSS bundle', 'fail', 'assets/ directory not found');
    return;
  }

  const cssFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.css'));
  if (cssFiles.length === 0) {
    addResult('CSS bundle', 'fail', 'No CSS files found');
    return;
  }

  let totalCSSSize = 0;
  for (const file of cssFiles) {
    const stats = fs.statSync(path.join(ASSETS_DIR, file));
    totalCSSSize += stats.size;
  }

  addResult('CSS bundle', 'pass', `${cssFiles.length} CSS files (${formatSize(totalCSSSize)})`);
}

function checkManifest(): void {
  const manifestPath = path.join(DIST_DIR, 'manifest.webmanifest');
  if (!fs.existsSync(manifestPath)) {
    addResult('PWA Manifest', 'fail', 'manifest.webmanifest not found');
    return;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Check required fields
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
    const missingFields = requiredFields.filter(f => !(f in manifest));

    if (missingFields.length === 0) {
      addResult('PWA Manifest', 'pass', 'All required fields present');
    } else {
      addResult('PWA Manifest', 'fail', `Missing fields: ${missingFields.join(', ')}`);
    }

    // Check icons
    if (manifest.icons && Array.isArray(manifest.icons)) {
      addResult('PWA Icons', 'pass', `${manifest.icons.length} icons configured`);
    } else {
      addResult('PWA Icons', 'warn', 'No icons configured');
    }
  } catch (error) {
    addResult('PWA Manifest', 'fail', `Invalid JSON: ${error}`);
  }
}

function checkServiceWorker(): void {
  const swPath = path.join(DIST_DIR, 'sw.js');
  if (!fs.existsSync(swPath)) {
    addResult('Service Worker', 'fail', 'sw.js not found');
    return;
  }

  const stats = fs.statSync(swPath);
  const content = fs.readFileSync(swPath, 'utf-8');

  // Check for workbox
  if (content.includes('workbox')) {
    addResult('Service Worker', 'pass', `Workbox-based (${formatSize(stats.size)})`);
  } else {
    addResult('Service Worker', 'pass', `Custom implementation (${formatSize(stats.size)})`);
  }

  // Check for precache manifest
  const registerSWPath = path.join(DIST_DIR, 'registerSW.js');
  if (fs.existsSync(registerSWPath)) {
    addResult('SW Registration', 'pass', 'registerSW.js exists');
  } else {
    addResult('SW Registration', 'warn', 'registerSW.js not found');
  }
}

function checkIndexHTML(): void {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    addResult('index.html', 'fail', 'index.html not found');
    return;
  }

  const content = fs.readFileSync(indexPath, 'utf-8');

  // Check for critical elements
  const checks = [
    { name: 'Meta viewport', test: content.includes('viewport') },
    { name: 'Meta description', test: content.includes('meta name="description"') || content.includes("meta name='description'") },
    { name: 'Link manifest', test: content.includes('manifest') },
    { name: 'Link icon', test: content.includes('icon') },
    { name: 'Script module', test: content.includes('type="module"') },
  ];

  for (const check of checks) {
    if (check.test) {
      addResult(`HTML: ${check.name}`, 'pass', 'Present');
    } else {
      addResult(`HTML: ${check.name}`, 'warn', 'Not found');
    }
  }
}

function printResults(): void {
  console.log('\n========================================');
  console.log('        BUILD VERIFICATION REPORT       ');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  for (const result of results) {
    const icon = result.status === 'pass' ? '\u2713' : result.status === 'fail' ? '\u2717' : '\u26A0';
    const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${color}${icon}\x1b[0m ${result.check}: ${result.message}`);
    if (result.details) {
      console.log(`  ${result.details.split('\n').join('\n  ')}`);
    }
  }

  console.log('\n========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${warned} warnings`);
  console.log('========================================\n');

  // Exit with error if any failures
  if (failed > 0) {
    process.exit(1);
  }
}

// Run all checks
console.log('Verifying build output...\n');

checkDistExists();
checkRequiredFiles();
checkBundleSizes();
checkSourceMaps();
checkCSS();
checkManifest();
checkServiceWorker();
checkIndexHTML();

printResults();
