#!/usr/bin/env npx tsx

/**
 * Synthetic Canary Testing Script for BitChat In Browser
 *
 * Performs end-to-end user journey tests using headless browser.
 * Runs every 15 minutes to ensure the deployed app is functional.
 *
 * Usage:
 *   npx tsx scripts/synthetic-canary.ts                        # Run canary test
 *   npx tsx scripts/synthetic-canary.ts --url <URL>            # Test specific URL
 *   npx tsx scripts/synthetic-canary.ts --cid <CID>            # Test IPFS deployment
 *   npx tsx scripts/synthetic-canary.ts --json                 # JSON output
 *   npx tsx scripts/synthetic-canary.ts --alert                # Create issue on failure
 *   npx tsx scripts/synthetic-canary.ts --report               # Generate success rate report
 *
 * Environment Variables:
 *   GITHUB_TOKEN           - GitHub token for creating issues
 *   GITHUB_REPOSITORY      - Repository for issues (owner/repo)
 *   CANARY_URL             - Default URL to test
 *   IPFS_CID               - CID for IPFS gateway testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

// Configuration
const DEFAULT_URL = 'https://bitbrowse.eth.limo';
const DEFAULT_TIMEOUT = 60000;
const CANARY_HISTORY_FILE = 'canary-history.json';

// Test steps for the user journey
const USER_JOURNEY_STEPS = [
  'page_load',
  'app_render',
  'identity_display',
  'channel_visible',
  'interactive',
] as const;

type StepName = typeof USER_JOURNEY_STEPS[number];

interface StepResult {
  name: StepName;
  passed: boolean;
  duration: number;
  error: string | null;
  screenshot: string | null;
}

interface CanaryResult {
  url: string;
  timestamp: string;
  success: boolean;
  totalDuration: number;
  steps: StepResult[];
  browserInfo: {
    name: string;
    version: string;
  };
  performanceMetrics: {
    timeToFirstByte: number | null;
    firstContentfulPaint: number | null;
    largestContentfulPaint: number | null;
    domInteractive: number | null;
  };
}

interface CanaryHistoryEntry {
  timestamp: string;
  success: boolean;
  duration: number;
  failedStep: string | null;
}

interface CanaryHistoryData {
  entries: CanaryHistoryEntry[];
  lastUpdated: string;
  successRate7d: number;
  successRate24h: number;
}

// Command line arguments
const args = process.argv.slice(2);
const urlArgIndex = args.indexOf('--url');
const cidArgIndex = args.indexOf('--cid');
const jsonOutput = args.includes('--json');
const shouldAlert = args.includes('--alert');
const generateReport = args.includes('--report');

let testUrl = process.env.CANARY_URL || DEFAULT_URL;

if (urlArgIndex >= 0 && args[urlArgIndex + 1]) {
  testUrl = args[urlArgIndex + 1];
} else if (cidArgIndex >= 0 && args[cidArgIndex + 1]) {
  const cid = args[cidArgIndex + 1];
  testUrl = `https://${cid}.ipfs.dweb.link`;
}

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  if (jsonOutput) return;

  const colors: Record<string, string> = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };

  const icons: Record<string, string> = {
    info: '[i]',
    success: '[+]',
    warn: '[!]',
    error: '[x]',
  };

  console.log(`${colors[level]}${icons[level]} ${message}${colors.reset}`);
}

/**
 * Load canary history
 */
function loadHistory(): CanaryHistoryData {
  const historyPath = path.join(process.cwd(), CANARY_HISTORY_FILE);

  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { entries: [], lastUpdated: '', successRate7d: 0, successRate24h: 0 };
    }
  }

  return { entries: [], lastUpdated: '', successRate7d: 0, successRate24h: 0 };
}

/**
 * Save canary history
 */
function saveHistory(history: CanaryHistoryData): void {
  const historyPath = path.join(process.cwd(), CANARY_HISTORY_FILE);
  history.lastUpdated = new Date().toISOString();

  // Keep last 7 days of data (15-minute intervals = ~672 entries)
  const maxEntries = 672;
  if (history.entries.length > maxEntries) {
    history.entries = history.entries.slice(-maxEntries);
  }

  // Calculate success rates
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  const entries24h = history.entries.filter(
    (e) => now - new Date(e.timestamp).getTime() <= day
  );
  const entries7d = history.entries.filter(
    (e) => now - new Date(e.timestamp).getTime() <= week
  );

  history.successRate24h = entries24h.length > 0
    ? (entries24h.filter((e) => e.success).length / entries24h.length) * 100
    : 0;

  history.successRate7d = entries7d.length > 0
    ? (entries7d.filter((e) => e.success).length / entries7d.length) * 100
    : 0;

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Record canary result to history
 */
function recordHistory(result: CanaryResult): void {
  const history = loadHistory();

  const failedStep = result.steps.find((s) => !s.passed);

  history.entries.push({
    timestamp: result.timestamp,
    success: result.success,
    duration: result.totalDuration,
    failedStep: failedStep ? failedStep.name : null,
  });

  saveHistory(history);
}

/**
 * Generate success rate report
 */
function generateSuccessReport(): void {
  const history = loadHistory();

  if (history.entries.length === 0) {
    log('No canary data available for report', 'warn');
    return;
  }

  console.log('\n========================================');
  console.log('Synthetic Canary Report - Last 7 Days');
  console.log('========================================\n');

  // Overall statistics
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  const entries24h = history.entries.filter(
    (e) => now - new Date(e.timestamp).getTime() <= day
  );
  const entries7d = history.entries.filter(
    (e) => now - new Date(e.timestamp).getTime() <= week
  );

  console.log('Success Rates:');
  console.log(`  Last 24 Hours: ${history.successRate24h.toFixed(2)}% (${entries24h.length} tests)`);
  console.log(`  Last 7 Days:   ${history.successRate7d.toFixed(2)}% (${entries7d.length} tests)`);

  // Failure breakdown
  const failures = entries7d.filter((e) => !e.success);
  if (failures.length > 0) {
    console.log(`\nFailures: ${failures.length}`);

    const failureByStep: Record<string, number> = {};
    for (const f of failures) {
      const step = f.failedStep || 'unknown';
      failureByStep[step] = (failureByStep[step] || 0) + 1;
    }

    console.log('By Step:');
    for (const [step, count] of Object.entries(failureByStep).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${step}: ${count}`);
    }
  }

  // Average duration
  const avgDuration = entries7d.reduce((sum, e) => sum + e.duration, 0) / entries7d.length;
  console.log(`\nAverage Test Duration: ${(avgDuration / 1000).toFixed(2)}s`);

  // Recent failures
  const recentFailures = failures.slice(-5);
  if (recentFailures.length > 0) {
    console.log('\nRecent Failures:');
    for (const f of recentFailures) {
      console.log(`  ${f.timestamp} - ${f.failedStep || 'unknown'}`);
    }
  }

  console.log('\n========================================\n');
}

/**
 * Run page load step
 */
async function runPageLoadStep(page: Page, url: string): Promise<StepResult> {
  const start = Date.now();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_TIMEOUT,
    });

    if (!response) {
      throw new Error('No response received');
    }

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    return {
      name: 'page_load',
      passed: true,
      duration: Date.now() - start,
      error: null,
      screenshot: null,
    };
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      name: 'page_load',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
      screenshot: screenshot ? screenshot.toString('base64') : null,
    };
  }
}

/**
 * Run app render step
 */
async function runAppRenderStep(page: Page): Promise<StepResult> {
  const start = Date.now();

  try {
    // Wait for the app container to be visible
    await page.waitForSelector('#app, #root, [data-app-container]', {
      state: 'visible',
      timeout: 30000,
    });

    // Check for React/Preact hydration or app mounting
    const appMounted = await page.evaluate(() => {
      const app = document.querySelector('#app') || document.querySelector('#root');
      return app && app.children.length > 0;
    });

    if (!appMounted) {
      throw new Error('App container exists but has no children');
    }

    return {
      name: 'app_render',
      passed: true,
      duration: Date.now() - start,
      error: null,
      screenshot: null,
    };
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      name: 'app_render',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
      screenshot: screenshot ? screenshot.toString('base64') : null,
    };
  }
}

/**
 * Run identity display step
 */
async function runIdentityDisplayStep(page: Page): Promise<StepResult> {
  const start = Date.now();

  try {
    // Wait for identity-related elements (fingerprint, public key indicator, etc.)
    // These selectors are based on typical BitChat UI patterns
    const identitySelectors = [
      '[data-testid="identity"]',
      '[data-testid="fingerprint"]',
      '[data-testid="pubkey"]',
      '.identity',
      '.fingerprint',
      '.user-identity',
    ];

    let identityFound = false;

    // Try each selector
    for (const selector of identitySelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        identityFound = true;
        break;
      } catch {
        // Continue to next selector
      }
    }

    // If no specific identity element, check for any identity-related text
    if (!identityFound) {
      const pageContent = await page.textContent('body');
      // Look for hex fingerprint patterns or npub patterns
      const hasIdentity = pageContent && (
        /[0-9a-f]{16}/i.test(pageContent) || // Hex fingerprint
        /npub[0-9a-z]{59}/i.test(pageContent) || // Nostr npub
        /bitchat/i.test(pageContent) // App name at minimum
      );

      if (!hasIdentity) {
        throw new Error('No identity indicators found on page');
      }
    }

    return {
      name: 'identity_display',
      passed: true,
      duration: Date.now() - start,
      error: null,
      screenshot: null,
    };
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      name: 'identity_display',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
      screenshot: screenshot ? screenshot.toString('base64') : null,
    };
  }
}

/**
 * Run channel visible step
 */
async function runChannelVisibleStep(page: Page): Promise<StepResult> {
  const start = Date.now();

  try {
    // Wait for channel-related UI elements
    const channelSelectors = [
      '[data-testid="channel"]',
      '[data-testid="channel-list"]',
      '[data-testid="messages"]',
      '.channel',
      '.channel-list',
      '.messages',
      '.chat',
    ];

    let channelFound = false;

    for (const selector of channelSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        channelFound = true;
        break;
      } catch {
        // Continue to next selector
      }
    }

    // If no specific channel element, look for message-related UI
    if (!channelFound) {
      // Check if there's any chat/messaging interface visible
      const hasMessageUI = await page.evaluate(() => {
        const body = document.body.textContent || '';
        // Look for typical chat UI indicators
        return (
          body.includes('channel') ||
          body.includes('message') ||
          body.includes('chat') ||
          body.includes('send') ||
          document.querySelector('input, textarea') !== null
        );
      });

      if (!hasMessageUI) {
        throw new Error('No channel or messaging UI found');
      }
    }

    return {
      name: 'channel_visible',
      passed: true,
      duration: Date.now() - start,
      error: null,
      screenshot: null,
    };
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      name: 'channel_visible',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
      screenshot: screenshot ? screenshot.toString('base64') : null,
    };
  }
}

/**
 * Run interactive step
 */
async function runInteractiveStep(page: Page): Promise<StepResult> {
  const start = Date.now();

  try {
    // Check that the page is interactive
    const isInteractive = await page.evaluate(() => {
      // Check if any buttons or inputs are present and enabled
      const interactiveElements = document.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]'
      );
      return interactiveElements.length > 0;
    });

    if (!isInteractive) {
      throw new Error('No interactive elements found on page');
    }

    // Check for JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    // Wait a moment to catch any late errors
    await page.waitForTimeout(1000);

    if (jsErrors.length > 0) {
      throw new Error(`JavaScript errors: ${jsErrors.join('; ')}`);
    }

    // Test basic interactivity - try to find and focus an input
    const inputFocusable = await page.evaluate(() => {
      const input = document.querySelector('input, textarea');
      if (input) {
        (input as HTMLElement).focus();
        return document.activeElement === input;
      }
      return true; // No input is OK
    });

    if (!inputFocusable) {
      log('Warning: Could not focus input element', 'warn');
    }

    return {
      name: 'interactive',
      passed: true,
      duration: Date.now() - start,
      error: null,
      screenshot: null,
    };
  } catch (error) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      name: 'interactive',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
      screenshot: screenshot ? screenshot.toString('base64') : null,
    };
  }
}

/**
 * Get performance metrics from the page
 */
async function getPerformanceMetrics(page: Page): Promise<CanaryResult['performanceMetrics']> {
  try {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      const fcp = paint.find((p) => p.name === 'first-contentful-paint');

      // LCP requires PerformanceObserver which may not be available
      let lcp = null;
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          lcp = (lcpEntries[lcpEntries.length - 1] as PerformanceEntry & { startTime: number }).startTime;
        }
      } catch {
        // LCP not available
      }

      return {
        timeToFirstByte: navigation?.responseStart ? Math.round(navigation.responseStart) : null,
        firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null,
        largestContentfulPaint: lcp ? Math.round(lcp) : null,
        domInteractive: navigation?.domInteractive ? Math.round(navigation.domInteractive) : null,
      };
    });

    return metrics;
  } catch {
    return {
      timeToFirstByte: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      domInteractive: null,
    };
  }
}

/**
 * Run the full canary test
 */
async function runCanaryTest(url: string): Promise<CanaryResult> {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  const steps: StepResult[] = [];

  log(`Starting canary test for: ${url}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'BitChat-Canary/1.0 (Synthetic Monitoring)',
    });

    page = await context.newPage();

    // Step 1: Page Load
    log('Step 1/5: Page Load');
    const pageLoadResult = await runPageLoadStep(page, url);
    steps.push(pageLoadResult);

    if (!pageLoadResult.passed) {
      return buildResult(url, timestamp, startTime, steps, browser);
    }

    // Step 2: App Render
    log('Step 2/5: App Render');
    const appRenderResult = await runAppRenderStep(page);
    steps.push(appRenderResult);

    if (!appRenderResult.passed) {
      return buildResult(url, timestamp, startTime, steps, browser);
    }

    // Step 3: Identity Display
    log('Step 3/5: Identity Display');
    const identityResult = await runIdentityDisplayStep(page);
    steps.push(identityResult);

    if (!identityResult.passed) {
      return buildResult(url, timestamp, startTime, steps, browser);
    }

    // Step 4: Channel Visible
    log('Step 4/5: Channel Visible');
    const channelResult = await runChannelVisibleStep(page);
    steps.push(channelResult);

    if (!channelResult.passed) {
      return buildResult(url, timestamp, startTime, steps, browser);
    }

    // Step 5: Interactive
    log('Step 5/5: Interactive Check');
    const interactiveResult = await runInteractiveStep(page);
    steps.push(interactiveResult);

    // Get performance metrics
    const performanceMetrics = await getPerformanceMetrics(page);

    const result: CanaryResult = {
      url,
      timestamp,
      success: steps.every((s) => s.passed),
      totalDuration: Date.now() - startTime,
      steps,
      browserInfo: {
        name: 'chromium',
        version: browser.version(),
      },
      performanceMetrics,
    };

    return result;
  } catch (error) {
    // Handle unexpected errors
    steps.push({
      name: 'page_load',
      passed: false,
      duration: Date.now() - startTime,
      error: `Unexpected error: ${(error as Error).message}`,
      screenshot: null,
    });

    return {
      url,
      timestamp,
      success: false,
      totalDuration: Date.now() - startTime,
      steps,
      browserInfo: {
        name: 'chromium',
        version: browser?.version() || 'unknown',
      },
      performanceMetrics: {
        timeToFirstByte: null,
        firstContentfulPaint: null,
        largestContentfulPaint: null,
        domInteractive: null,
      },
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Build result object (helper)
 */
async function buildResult(
  url: string,
  timestamp: string,
  startTime: number,
  steps: StepResult[],
  browser: Browser | null
): Promise<CanaryResult> {
  return {
    url,
    timestamp,
    success: false,
    totalDuration: Date.now() - startTime,
    steps,
    browserInfo: {
      name: 'chromium',
      version: browser?.version() || 'unknown',
    },
    performanceMetrics: {
      timeToFirstByte: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      domInteractive: null,
    },
  };
}

/**
 * Create GitHub issue for canary failure
 */
async function createGitHubAlert(result: CanaryResult): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    log('GITHUB_TOKEN or GITHUB_REPOSITORY not set, skipping alert', 'warn');
    return;
  }

  const history = loadHistory();
  const failedStep = result.steps.find((s) => !s.passed);

  const stepsMarkdown = result.steps
    .map((s) => {
      const status = s.passed ? ':white_check_mark:' : ':x:';
      const error = s.error ? ` - ${s.error}` : '';
      return `- ${status} ${s.name} (${s.duration}ms)${error}`;
    })
    .join('\n');

  const title = `[Canary Alert] Synthetic test failed at step: ${failedStep?.name || 'unknown'}`;
  const body = `## Synthetic Canary Test Failed

**URL:** ${result.url}
**Timestamp:** ${result.timestamp}
**Failed Step:** ${failedStep?.name || 'unknown'}
**Error:** ${failedStep?.error || 'Unknown error'}

### Test Steps
${stepsMarkdown}

### Success Rate
- Last 24 Hours: ${history.successRate24h.toFixed(2)}%
- Last 7 Days: ${history.successRate7d.toFixed(2)}%

### Performance Metrics
- Time to First Byte: ${result.performanceMetrics.timeToFirstByte || 'N/A'}ms
- First Contentful Paint: ${result.performanceMetrics.firstContentfulPaint || 'N/A'}ms
- DOM Interactive: ${result.performanceMetrics.domInteractive || 'N/A'}ms

---

**Action Required:**
1. Check the deployment at ${result.url}
2. Review recent commits for potential issues
3. Consider triggering rollback if success rate drops below 95%

---
*This issue was created automatically by the synthetic canary monitoring system.*
`;

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['alert', 'canary', 'automated'],
      }),
    });

    if (response.ok) {
      const issue = await response.json() as { html_url: string };
      log(`Created GitHub issue: ${issue.html_url}`, 'success');
    } else {
      const error = await response.text();
      log(`Failed to create GitHub issue: ${error}`, 'error');
    }
  } catch (error) {
    log(`Error creating GitHub issue: ${(error as Error).message}`, 'error');
  }
}

/**
 * Print results
 */
function printResults(result: CanaryResult): void {
  if (jsonOutput) {
    // Remove screenshots from JSON output to keep it clean
    const cleanResult = {
      ...result,
      steps: result.steps.map((s) => ({ ...s, screenshot: s.screenshot ? '[base64 data]' : null })),
    };
    console.log(JSON.stringify(cleanResult, null, 2));
    return;
  }

  console.log('\n========================================');
  console.log('Synthetic Canary Test Results');
  console.log('========================================');
  console.log(`URL: ${result.url}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Status: ${result.success ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log(`Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);

  console.log('\nTest Steps:');
  for (const step of result.steps) {
    const status = step.passed
      ? `\x1b[32mPASS\x1b[0m`
      : `\x1b[31mFAIL\x1b[0m`;
    const error = step.error ? ` - ${step.error}` : '';
    console.log(`  [${status}] ${step.name} (${step.duration}ms)${error}`);
  }

  console.log('\nPerformance Metrics:');
  console.log(`  TTFB: ${result.performanceMetrics.timeToFirstByte || 'N/A'}ms`);
  console.log(`  FCP:  ${result.performanceMetrics.firstContentfulPaint || 'N/A'}ms`);
  console.log(`  LCP:  ${result.performanceMetrics.largestContentfulPaint || 'N/A'}ms`);
  console.log(`  DOM:  ${result.performanceMetrics.domInteractive || 'N/A'}ms`);

  console.log('========================================\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  // Handle report generation
  if (generateReport) {
    generateSuccessReport();
    return;
  }

  // Validate URL
  if (!testUrl) {
    console.log('Usage: npx tsx scripts/synthetic-canary.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --url <URL>     URL to test (default: https://bitbrowse.eth.limo)');
    console.log('  --cid <CID>     Test IPFS CID via dweb.link gateway');
    console.log('  --json          Output results as JSON');
    console.log('  --alert         Create GitHub issue on failure');
    console.log('  --report        Generate success rate report');
    console.log('');
    console.log('Environment Variables:');
    console.log('  CANARY_URL        Default URL to test');
    console.log('  GITHUB_TOKEN      GitHub token for creating issues');
    console.log('  GITHUB_REPOSITORY Repository for issues (owner/repo)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/synthetic-canary.ts');
    console.log('  npx tsx scripts/synthetic-canary.ts --url https://bitbrowse.eth.limo');
    console.log('  npx tsx scripts/synthetic-canary.ts --cid bafyabc123...');
    console.log('  npx tsx scripts/synthetic-canary.ts --alert');
    process.exit(1);
  }

  try {
    const result = await runCanaryTest(testUrl);

    // Record to history
    recordHistory(result);

    // Print results
    printResults(result);

    // Create alert if needed
    if (shouldAlert && !result.success) {
      await createGitHubAlert(result);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }));
    } else {
      log(`Canary test failed: ${(error as Error).message}`, 'error');
    }
    process.exit(1);
  }
}

// Run the script
main();
