#!/usr/bin/env npx tsx
/**
 * Bundle Size Analysis Script
 *
 * Analyzes the production build to:
 * - Verify bundle size is under 500KB target
 * - Identify large dependencies
 * - Check tree-shaking effectiveness
 * - Generate size report
 *
 * Usage:
 *   npx tsx scripts/bundle-analyze.ts
 *   npm run analyze:bundle (if script is added to package.json)
 *
 * @module scripts/bundle-analyze
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { gzipSync } from 'zlib';

// MARK: - Constants

const DIST_DIR = join(process.cwd(), 'dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');

// Performance targets (in bytes)
const TARGETS = {
  TOTAL_BUNDLE: 500 * 1024,       // 500KB total
  MAIN_CHUNK: 200 * 1024,         // 200KB for main chunk
  VENDOR_CHUNK: 300 * 1024,       // 300KB for vendor chunks
  SINGLE_FILE: 150 * 1024,        // 150KB per file
  CSS_TOTAL: 50 * 1024,           // 50KB CSS total
  GZIP_TOTAL: 150 * 1024,         // 150KB gzipped total
};

// Known large dependencies and their expected sizes
const EXPECTED_DEPENDENCIES = {
  'libsodium-wrappers-sumo': { maxSize: 200 * 1024, critical: true },
  'nostr-tools': { maxSize: 100 * 1024, critical: true },
  'preact': { maxSize: 15 * 1024, critical: true },
  'zustand': { maxSize: 10 * 1024, critical: false },
  'dexie': { maxSize: 50 * 1024, critical: false },
  'trystero': { maxSize: 50 * 1024, critical: false },
};

// MARK: - Types

interface FileInfo {
  name: string;
  path: string;
  size: number;
  gzipSize: number;
  type: 'js' | 'css' | 'html' | 'other';
  isVendor: boolean;
  isMain: boolean;
}

interface BundleAnalysis {
  files: FileInfo[];
  totalSize: number;
  totalGzipSize: number;
  jsTotalSize: number;
  jsGzipSize: number;
  cssTotalSize: number;
  cssGzipSize: number;
  largestFiles: FileInfo[];
  vendorChunks: FileInfo[];
  mainChunks: FileInfo[];
  warnings: string[];
  errors: string[];
}

interface DependencyAnalysis {
  name: string;
  estimatedSize: number;
  appearances: number;
  chunks: string[];
}

// MARK: - Utilities

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get file type from extension
 */
function getFileType(filename: string): 'js' | 'css' | 'html' | 'other' {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case '.js':
    case '.mjs':
      return 'js';
    case '.css':
      return 'css';
    case '.html':
      return 'html';
    default:
      return 'other';
  }
}

/**
 * Check if file is a vendor chunk
 */
function isVendorChunk(filename: string): boolean {
  return filename.includes('vendor') ||
    filename.includes('node_modules') ||
    /chunk-[a-f0-9]+/i.test(filename);
}

/**
 * Check if file is a main chunk
 */
function isMainChunk(filename: string): boolean {
  return filename.startsWith('index') ||
    filename.includes('main') ||
    filename.includes('app');
}

/**
 * Calculate gzip size
 */
function getGzipSize(content: Buffer | string): number {
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;
  return gzipSync(buffer).length;
}

/**
 * Recursively get all files in directory
 */
function getAllFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// MARK: - Analysis Functions

/**
 * Analyze all files in the dist directory
 */
function analyzeBundle(): BundleAnalysis {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!existsSync(DIST_DIR)) {
    errors.push('Dist directory not found. Run "npm run build" first.');
    return {
      files: [],
      totalSize: 0,
      totalGzipSize: 0,
      jsTotalSize: 0,
      jsGzipSize: 0,
      cssTotalSize: 0,
      cssGzipSize: 0,
      largestFiles: [],
      vendorChunks: [],
      mainChunks: [],
      warnings,
      errors,
    };
  }

  const allPaths = getAllFiles(DIST_DIR);
  const files: FileInfo[] = [];

  for (const filePath of allPaths) {
    const stat = statSync(filePath);
    const name = basename(filePath);
    const type = getFileType(name);

    // Skip source maps and non-essential files
    if (name.endsWith('.map') || name.endsWith('.txt')) continue;

    let gzipSize = 0;
    if (type === 'js' || type === 'css' || type === 'html') {
      const content = readFileSync(filePath);
      gzipSize = getGzipSize(content);
    }

    files.push({
      name,
      path: filePath,
      size: stat.size,
      gzipSize,
      type,
      isVendor: isVendorChunk(name),
      isMain: isMainChunk(name),
    });
  }

  // Calculate totals
  const jsFiles = files.filter(f => f.type === 'js');
  const cssFiles = files.filter(f => f.type === 'css');

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalGzipSize = files.reduce((sum, f) => sum + f.gzipSize, 0);
  const jsTotalSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
  const jsGzipSize = jsFiles.reduce((sum, f) => sum + f.gzipSize, 0);
  const cssTotalSize = cssFiles.reduce((sum, f) => sum + f.size, 0);
  const cssGzipSize = cssFiles.reduce((sum, f) => sum + f.gzipSize, 0);

  // Get largest files
  const largestFiles = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  // Separate vendor and main chunks
  const vendorChunks = jsFiles.filter(f => f.isVendor);
  const mainChunks = jsFiles.filter(f => f.isMain);

  // Check against targets
  if (jsTotalSize > TARGETS.TOTAL_BUNDLE) {
    errors.push(
      `JS bundle size (${formatBytes(jsTotalSize)}) exceeds target (${formatBytes(TARGETS.TOTAL_BUNDLE)})`
    );
  }

  if (totalGzipSize > TARGETS.GZIP_TOTAL) {
    warnings.push(
      `Gzipped size (${formatBytes(totalGzipSize)}) exceeds target (${formatBytes(TARGETS.GZIP_TOTAL)})`
    );
  }

  if (cssTotalSize > TARGETS.CSS_TOTAL) {
    warnings.push(
      `CSS size (${formatBytes(cssTotalSize)}) exceeds target (${formatBytes(TARGETS.CSS_TOTAL)})`
    );
  }

  // Check individual file sizes
  for (const file of jsFiles) {
    if (file.size > TARGETS.SINGLE_FILE) {
      warnings.push(
        `Large chunk: ${file.name} (${formatBytes(file.size)})`
      );
    }
  }

  return {
    files,
    totalSize,
    totalGzipSize,
    jsTotalSize,
    jsGzipSize,
    cssTotalSize,
    cssGzipSize,
    largestFiles,
    vendorChunks,
    mainChunks,
    warnings,
    errors,
  };
}

/**
 * Analyze dependencies in bundle
 */
function analyzeDependencies(): DependencyAnalysis[] {
  const dependencies: Map<string, DependencyAnalysis> = new Map();

  if (!existsSync(ASSETS_DIR)) return [];

  const jsFiles = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));

  for (const filename of jsFiles) {
    const filePath = join(ASSETS_DIR, filename);
    const content = readFileSync(filePath, 'utf-8');
    const fileSize = statSync(filePath).size;

    // Look for known dependency patterns
    for (const [depName] of Object.entries(EXPECTED_DEPENDENCIES)) {
      const regex = new RegExp(depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        const existing = dependencies.get(depName);
        if (existing) {
          existing.appearances += matches.length;
          existing.chunks.push(filename);
          // Estimate size contribution (rough heuristic)
          existing.estimatedSize += Math.floor(fileSize * 0.1);
        } else {
          dependencies.set(depName, {
            name: depName,
            estimatedSize: Math.floor(fileSize * 0.3),
            appearances: matches.length,
            chunks: [filename],
          });
        }
      }
    }
  }

  return Array.from(dependencies.values()).sort(
    (a, b) => b.estimatedSize - a.estimatedSize
  );
}

/**
 * Check tree-shaking effectiveness
 */
function checkTreeShaking(): { issues: string[]; suggestions: string[] } {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!existsSync(ASSETS_DIR)) {
    return { issues: ['Assets directory not found'], suggestions: [] };
  }

  const jsFiles = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));

  for (const filename of jsFiles) {
    const filePath = join(ASSETS_DIR, filename);
    const content = readFileSync(filePath, 'utf-8');

    // Check for common tree-shaking issues

    // 1. Check for entire lodash import
    if (content.includes('lodash') && !content.includes('lodash-es')) {
      issues.push(`${filename}: Uses lodash (should use lodash-es for tree-shaking)`);
      suggestions.push('Replace lodash imports with lodash-es or individual imports');
    }

    // 2. Check for moment.js (known to be large)
    if (content.includes('moment')) {
      issues.push(`${filename}: Contains moment.js (consider using date-fns or dayjs)`);
      suggestions.push('Replace moment.js with a lighter alternative');
    }

    // 3. Check for unused exports pattern (heuristic)
    const exportCount = (content.match(/export\s+/g) || []).length;
    const importCount = (content.match(/import\s+/g) || []).length;

    if (exportCount > 50 && importCount < 10) {
      issues.push(
        `${filename}: High export count (${exportCount}) with low imports - possible tree-shaking issue`
      );
    }

    // 4. Check for polyfill bloat
    if (content.includes('core-js') || content.includes('@babel/runtime')) {
      issues.push(`${filename}: Contains runtime polyfills - verify they're necessary`);
      suggestions.push('Review browserslist config to minimize polyfills');
    }
  }

  return { issues, suggestions };
}

// MARK: - Report Generation

/**
 * Generate analysis report
 */
function generateReport(
  analysis: BundleAnalysis,
  dependencies: DependencyAnalysis[],
  treeShaking: { issues: string[]; suggestions: string[] }
): void {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  BitChat Bundle Analysis Report');
  console.log('='.repeat(60));
  console.log('\n');

  // Summary
  console.log('## Summary\n');
  console.log(`Total Size:     ${formatBytes(analysis.totalSize)}`);
  console.log(`Gzipped Size:   ${formatBytes(analysis.totalGzipSize)}`);
  console.log(`JS Size:        ${formatBytes(analysis.jsTotalSize)} (${formatBytes(analysis.jsGzipSize)} gzip)`);
  console.log(`CSS Size:       ${formatBytes(analysis.cssTotalSize)} (${formatBytes(analysis.cssGzipSize)} gzip)`);
  console.log(`Total Files:    ${analysis.files.length}`);
  console.log('\n');

  // Target Check
  console.log('## Target Check\n');
  const jsPassed = analysis.jsTotalSize <= TARGETS.TOTAL_BUNDLE;
  const gzipPassed = analysis.totalGzipSize <= TARGETS.GZIP_TOTAL;
  const cssPassed = analysis.cssTotalSize <= TARGETS.CSS_TOTAL;

  console.log(`JS Bundle:      ${jsPassed ? 'PASS' : 'FAIL'} (${formatBytes(analysis.jsTotalSize)} / ${formatBytes(TARGETS.TOTAL_BUNDLE)})`);
  console.log(`Gzipped:        ${gzipPassed ? 'PASS' : 'WARN'} (${formatBytes(analysis.totalGzipSize)} / ${formatBytes(TARGETS.GZIP_TOTAL)})`);
  console.log(`CSS:            ${cssPassed ? 'PASS' : 'WARN'} (${formatBytes(analysis.cssTotalSize)} / ${formatBytes(TARGETS.CSS_TOTAL)})`);
  console.log('\n');

  // Largest Files
  console.log('## Largest Files\n');
  console.log('| File | Size | Gzipped |');
  console.log('|------|------|---------|');
  for (const file of analysis.largestFiles.slice(0, 10)) {
    const sizeStr = formatBytes(file.size).padEnd(10);
    const gzipStr = formatBytes(file.gzipSize).padEnd(10);
    console.log(`| ${file.name.padEnd(30)} | ${sizeStr} | ${gzipStr} |`);
  }
  console.log('\n');

  // Vendor Chunks
  if (analysis.vendorChunks.length > 0) {
    console.log('## Vendor Chunks\n');
    console.log('| Chunk | Size | Gzipped |');
    console.log('|-------|------|---------|');
    for (const chunk of analysis.vendorChunks) {
      console.log(`| ${chunk.name.padEnd(30)} | ${formatBytes(chunk.size).padEnd(10)} | ${formatBytes(chunk.gzipSize).padEnd(10)} |`);
    }
    console.log('\n');
  }

  // Dependencies
  if (dependencies.length > 0) {
    console.log('## Detected Dependencies\n');
    console.log('| Dependency | Est. Size | Chunks |');
    console.log('|------------|-----------|--------|');
    for (const dep of dependencies) {
      console.log(`| ${dep.name.padEnd(25)} | ${formatBytes(dep.estimatedSize).padEnd(10)} | ${dep.chunks.length} |`);
    }
    console.log('\n');
  }

  // Tree-shaking Analysis
  if (treeShaking.issues.length > 0) {
    console.log('## Tree-shaking Analysis\n');
    console.log('Issues found:');
    for (const issue of treeShaking.issues) {
      console.log(`  - ${issue}`);
    }
    console.log('\n');

    if (treeShaking.suggestions.length > 0) {
      console.log('Suggestions:');
      for (const suggestion of treeShaking.suggestions) {
        console.log(`  - ${suggestion}`);
      }
      console.log('\n');
    }
  }

  // Errors and Warnings
  if (analysis.errors.length > 0) {
    console.log('## Errors\n');
    for (const error of analysis.errors) {
      console.log(`  ERROR: ${error}`);
    }
    console.log('\n');
  }

  if (analysis.warnings.length > 0) {
    console.log('## Warnings\n');
    for (const warning of analysis.warnings) {
      console.log(`  WARNING: ${warning}`);
    }
    console.log('\n');
  }

  // Recommendations
  console.log('## Recommendations\n');

  if (!jsPassed) {
    console.log('1. Bundle size exceeds 500KB target:');
    console.log('   - Review large vendor chunks');
    console.log('   - Consider code splitting');
    console.log('   - Audit dependencies for lighter alternatives');
    console.log('');
  }

  if (analysis.vendorChunks.some(c => c.size > TARGETS.VENDOR_CHUNK)) {
    console.log('2. Large vendor chunks detected:');
    console.log('   - Consider splitting large dependencies');
    console.log('   - Use dynamic imports for non-critical code');
    console.log('');
  }

  if (dependencies.some(d => EXPECTED_DEPENDENCIES[d.name as keyof typeof EXPECTED_DEPENDENCIES]?.critical)) {
    console.log('3. Critical dependencies present:');
    console.log('   - libsodium-wrappers-sumo: Required for crypto (consider lazy loading)');
    console.log('   - nostr-tools: Required for protocol (optimize imports)');
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('\n');

  // Exit with error code if targets not met
  if (analysis.errors.length > 0 || !jsPassed) {
    console.log('Bundle analysis completed with errors.');
    process.exit(1);
  } else {
    console.log('Bundle analysis completed successfully!');
    process.exit(0);
  }
}

// MARK: - Main

async function main(): Promise<void> {
  console.log('Analyzing bundle...\n');

  const analysis = analyzeBundle();
  const dependencies = analyzeDependencies();
  const treeShaking = checkTreeShaking();

  generateReport(analysis, dependencies, treeShaking);
}

main().catch((error) => {
  console.error('Bundle analysis failed:', error);
  process.exit(1);
});
