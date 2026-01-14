#!/usr/bin/env npx tsx
/**
 * Coverage Gate - Deployment Blocker for Test Coverage
 *
 * This script enforces minimum test coverage thresholds before allowing deployments.
 * It reads coverage reports, validates against thresholds, and tracks coverage trends.
 *
 * Features:
 * - Block deploy if coverage < threshold
 * - Track coverage over time
 * - Generate coverage badge
 * - Support for different coverage types (lines, branches, functions, statements)
 * - CI integration with exit codes
 *
 * Usage:
 *   npx tsx scripts/coverage-gate.ts
 *   npx tsx scripts/coverage-gate.ts --threshold 80
 *   npx tsx scripts/coverage-gate.ts --ci
 *   npx tsx scripts/coverage-gate.ts --track
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CoverageSummary {
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

interface CoverageReport {
  total: CoverageSummary;
  [filePath: string]: CoverageSummary;
}

interface CoverageThresholds {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

interface CoverageHistoryEntry {
  timestamp: string;
  commit?: string;
  branch?: string;
  coverage: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
}

interface CoverageGateResult {
  passed: boolean;
  coverage: CoverageSummary;
  thresholds: CoverageThresholds;
  failures: string[];
  warnings: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_THRESHOLDS: CoverageThresholds = {
  lines: 80,
  statements: 80,
  functions: 75,
  branches: 70,
};

const WARNING_THRESHOLD_DELTA = 5; // Warn if within 5% of threshold

const COVERAGE_REPORT_PATH = 'coverage/coverage-summary.json';
const COVERAGE_HISTORY_PATH = '.coverage-history.json';
const COVERAGE_BADGE_PATH = 'coverage/badge.svg';

// ============================================================================
// Utilities
// ============================================================================

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    success: '\x1b[32m[SUCCESS]\x1b[0m',
  };
  console.log(`${prefix[level]} ${message}`);
}

function parseArgs(): {
  threshold?: number;
  ci: boolean;
  track: boolean;
  badge: boolean;
  verbose: boolean;
  reportPath?: string;
} {
  const args = process.argv.slice(2);
  const result = {
    threshold: undefined as number | undefined,
    ci: false,
    track: false,
    badge: false,
    verbose: false,
    reportPath: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--threshold':
      case '-t':
        result.threshold = parseInt(args[++i], 10);
        break;
      case '--ci':
        result.ci = true;
        break;
      case '--track':
        result.track = true;
        break;
      case '--badge':
        result.badge = true;
        break;
      case '--verbose':
      case '-v':
        result.verbose = true;
        break;
      case '--report':
      case '-r':
        result.reportPath = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Coverage Gate - Test Coverage Enforcement

Usage:
  npx tsx scripts/coverage-gate.ts [options]

Options:
  -t, --threshold <n>  Set minimum coverage threshold (default: 80)
  --ci                 Run in CI mode (strict exit codes)
  --track              Track coverage history
  --badge              Generate coverage badge SVG
  -r, --report <path>  Path to coverage-summary.json
  -v, --verbose        Enable verbose output
  -h, --help           Show this help message

Examples:
  npx tsx scripts/coverage-gate.ts --threshold 80
  npx tsx scripts/coverage-gate.ts --ci --track --badge
  npx tsx scripts/coverage-gate.ts -r ./custom-coverage.json

Exit Codes:
  0 - Coverage meets thresholds
  1 - Coverage below thresholds (deploy blocked)
  2 - Coverage report not found
  3 - Invalid coverage report format
`);
}

// ============================================================================
// Coverage Report Handling
// ============================================================================

function loadCoverageReport(reportPath: string): CoverageReport | null {
  const fullPath = path.resolve(process.cwd(), reportPath);

  if (!fs.existsSync(fullPath)) {
    log(`Coverage report not found: ${fullPath}`, 'error');
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as CoverageReport;
  } catch (error) {
    log(`Failed to parse coverage report: ${error}`, 'error');
    return null;
  }
}

function validateCoverageReport(report: CoverageReport): boolean {
  if (!report.total) {
    log('Coverage report missing "total" summary', 'error');
    return false;
  }

  const required = ['lines', 'statements', 'functions', 'branches'];
  for (const key of required) {
    if (!(key in report.total)) {
      log(`Coverage report missing "${key}" in total summary`, 'error');
      return false;
    }
  }

  return true;
}

// ============================================================================
// Coverage Gate Logic
// ============================================================================

function checkCoverage(
  report: CoverageReport,
  thresholds: CoverageThresholds
): CoverageGateResult {
  const coverage = report.total;
  const failures: string[] = [];
  const warnings: string[] = [];

  // Check each coverage type
  const checks = [
    { type: 'lines', pct: coverage.lines.pct, threshold: thresholds.lines },
    { type: 'statements', pct: coverage.statements.pct, threshold: thresholds.statements },
    { type: 'functions', pct: coverage.functions.pct, threshold: thresholds.functions },
    { type: 'branches', pct: coverage.branches.pct, threshold: thresholds.branches },
  ];

  for (const check of checks) {
    if (check.pct < check.threshold) {
      failures.push(
        `${check.type}: ${check.pct.toFixed(2)}% < ${check.threshold}% (need +${(check.threshold - check.pct).toFixed(2)}%)`
      );
    } else if (check.pct < check.threshold + WARNING_THRESHOLD_DELTA) {
      warnings.push(
        `${check.type}: ${check.pct.toFixed(2)}% is close to threshold ${check.threshold}%`
      );
    }
  }

  return {
    passed: failures.length === 0,
    coverage,
    thresholds,
    failures,
    warnings,
  };
}

function printResult(result: CoverageGateResult, verbose: boolean): void {
  console.log('\n' + '='.repeat(60));
  console.log('COVERAGE GATE RESULTS');
  console.log('='.repeat(60) + '\n');

  // Print coverage summary
  console.log('Coverage Summary:');
  console.log(`  Lines:      ${result.coverage.lines.pct.toFixed(2)}% (${result.coverage.lines.covered}/${result.coverage.lines.total})`);
  console.log(`  Statements: ${result.coverage.statements.pct.toFixed(2)}% (${result.coverage.statements.covered}/${result.coverage.statements.total})`);
  console.log(`  Functions:  ${result.coverage.functions.pct.toFixed(2)}% (${result.coverage.functions.covered}/${result.coverage.functions.total})`);
  console.log(`  Branches:   ${result.coverage.branches.pct.toFixed(2)}% (${result.coverage.branches.covered}/${result.coverage.branches.total})`);

  console.log('\nThresholds:');
  console.log(`  Lines:      ${result.thresholds.lines}%`);
  console.log(`  Statements: ${result.thresholds.statements}%`);
  console.log(`  Functions:  ${result.thresholds.functions}%`);
  console.log(`  Branches:   ${result.thresholds.branches}%`);

  // Print failures
  if (result.failures.length > 0) {
    console.log('\n' + '\x1b[31m' + 'FAILURES:' + '\x1b[0m');
    result.failures.forEach((f) => console.log(`  - ${f}`));
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('\n' + '\x1b[33m' + 'WARNINGS:' + '\x1b[0m');
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  // Print final status
  console.log('\n' + '-'.repeat(60));
  if (result.passed) {
    log('Coverage gate PASSED - deploy allowed', 'success');
  } else {
    log('Coverage gate FAILED - deploy BLOCKED', 'error');
    console.log('\nTo fix, increase test coverage in the failing areas.');
    console.log('Run "npm run test:coverage:report" to see detailed coverage.');
  }
  console.log('');
}

// ============================================================================
// Coverage History Tracking
// ============================================================================

function loadCoverageHistory(): CoverageHistoryEntry[] {
  const historyPath = path.resolve(process.cwd(), COVERAGE_HISTORY_PATH);

  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(content) as CoverageHistoryEntry[];
  } catch {
    return [];
  }
}

function saveCoverageHistory(history: CoverageHistoryEntry[]): void {
  const historyPath = path.resolve(process.cwd(), COVERAGE_HISTORY_PATH);

  // Keep only last 100 entries
  const trimmedHistory = history.slice(-100);

  fs.writeFileSync(historyPath, JSON.stringify(trimmedHistory, null, 2));
  log(`Coverage history saved to ${COVERAGE_HISTORY_PATH}`);
}

function trackCoverage(coverage: CoverageSummary): void {
  const history = loadCoverageHistory();

  // Get git info if available
  let commit: string | undefined;
  let branch: string | undefined;

  try {
    const { execSync } = require('child_process');
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // Git not available or not in a git repo
  }

  const entry: CoverageHistoryEntry = {
    timestamp: new Date().toISOString(),
    commit,
    branch,
    coverage: {
      lines: coverage.lines.pct,
      statements: coverage.statements.pct,
      functions: coverage.functions.pct,
      branches: coverage.branches.pct,
    },
  };

  history.push(entry);
  saveCoverageHistory(history);

  // Print trend
  if (history.length > 1) {
    const previous = history[history.length - 2];
    console.log('\nCoverage Trend:');

    const delta = {
      lines: coverage.lines.pct - previous.coverage.lines,
      statements: coverage.statements.pct - previous.coverage.statements,
      functions: coverage.functions.pct - previous.coverage.functions,
      branches: coverage.branches.pct - previous.coverage.branches,
    };

    const formatDelta = (d: number) => {
      if (d > 0) return `\x1b[32m+${d.toFixed(2)}%\x1b[0m`;
      if (d < 0) return `\x1b[31m${d.toFixed(2)}%\x1b[0m`;
      return `${d.toFixed(2)}%`;
    };

    console.log(`  Lines:      ${formatDelta(delta.lines)}`);
    console.log(`  Statements: ${formatDelta(delta.statements)}`);
    console.log(`  Functions:  ${formatDelta(delta.functions)}`);
    console.log(`  Branches:   ${formatDelta(delta.branches)}`);
  }
}

// ============================================================================
// Badge Generation
// ============================================================================

function generateBadge(coverage: CoverageSummary): void {
  const avgCoverage = (
    (coverage.lines.pct +
      coverage.statements.pct +
      coverage.functions.pct +
      coverage.branches.pct) /
    4
  ).toFixed(1);

  // Determine color based on coverage
  let color: string;
  const avg = parseFloat(avgCoverage);
  if (avg >= 90) color = '#4c1'; // Bright green
  else if (avg >= 80) color = '#97ca00'; // Green
  else if (avg >= 70) color = '#a4a61d'; // Yellow-green
  else if (avg >= 60) color = '#dfb317'; // Yellow
  else if (avg >= 50) color = '#fe7d37'; // Orange
  else color = '#e05d44'; // Red

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="106" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="106" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h61v20H0z"/>
    <path fill="${color}" d="M61 0h45v20H61z"/>
    <path fill="url(#b)" d="M0 0h106v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text x="315" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)"  textLength="510">coverage</text>
    <text x="315" y="140" transform="scale(.1)" textLength="510">coverage</text>
    <text x="825" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="350">${avgCoverage}%</text>
    <text x="825" y="140" transform="scale(.1)" textLength="350">${avgCoverage}%</text>
  </g>
</svg>`;

  const badgePath = path.resolve(process.cwd(), COVERAGE_BADGE_PATH);
  const badgeDir = path.dirname(badgePath);

  if (!fs.existsSync(badgeDir)) {
    fs.mkdirSync(badgeDir, { recursive: true });
  }

  fs.writeFileSync(badgePath, svg);
  log(`Coverage badge generated: ${COVERAGE_BADGE_PATH}`);
}

// ============================================================================
// File Coverage Analysis
// ============================================================================

function analyzeFileCoverage(
  report: CoverageReport,
  thresholds: CoverageThresholds
): void {
  console.log('\nFile Coverage Analysis:');
  console.log('-'.repeat(80));

  const files: Array<{ path: string; coverage: CoverageSummary }> = [];

  for (const [filePath, coverage] of Object.entries(report)) {
    if (filePath === 'total') continue;
    files.push({ path: filePath, coverage });
  }

  // Sort by line coverage (lowest first)
  files.sort((a, b) => a.coverage.lines.pct - b.coverage.lines.pct);

  // Show worst files
  console.log('\nFiles with lowest coverage:');
  const worstFiles = files.slice(0, 10);
  for (const file of worstFiles) {
    const status = file.coverage.lines.pct < thresholds.lines ? '\x1b[31m!\x1b[0m' : ' ';
    console.log(
      `${status} ${file.coverage.lines.pct.toFixed(1).padStart(6)}% | ${file.path}`
    );
  }

  // Show uncovered files
  const uncoveredFiles = files.filter((f) => f.coverage.lines.pct === 0);
  if (uncoveredFiles.length > 0) {
    console.log(`\n\x1b[31mUncovered files (${uncoveredFiles.length}):\x1b[0m`);
    uncoveredFiles.slice(0, 5).forEach((f) => console.log(`  - ${f.path}`));
    if (uncoveredFiles.length > 5) {
      console.log(`  ... and ${uncoveredFiles.length - 5} more`);
    }
  }

  // Show fully covered files
  const fullyCoveredFiles = files.filter((f) => f.coverage.lines.pct === 100);
  console.log(`\n\x1b[32mFully covered files: ${fullyCoveredFiles.length}/${files.length}\x1b[0m`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // Determine report path
  const reportPath = args.reportPath || COVERAGE_REPORT_PATH;

  // Load coverage report
  const report = loadCoverageReport(reportPath);
  if (!report) {
    log('Run "npm run test:coverage" first to generate coverage report', 'info');
    process.exit(2);
  }

  // Validate report format
  if (!validateCoverageReport(report)) {
    process.exit(3);
  }

  // Determine thresholds
  const thresholds: CoverageThresholds = args.threshold
    ? {
        lines: args.threshold,
        statements: args.threshold,
        functions: Math.max(args.threshold - 5, 50),
        branches: Math.max(args.threshold - 10, 40),
      }
    : DEFAULT_THRESHOLDS;

  // Check coverage against thresholds
  const result = checkCoverage(report, thresholds);

  // Print results
  printResult(result, args.verbose);

  // Analyze file coverage if verbose
  if (args.verbose) {
    analyzeFileCoverage(report, thresholds);
  }

  // Track coverage history
  if (args.track) {
    trackCoverage(report.total);
  }

  // Generate badge
  if (args.badge) {
    generateBadge(report.total);
  }

  // Exit with appropriate code
  if (args.ci && !result.passed) {
    log('CI mode: Failing build due to coverage threshold violation', 'error');
    process.exit(1);
  }

  process.exit(result.passed ? 0 : 1);
}

// Run main function
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
