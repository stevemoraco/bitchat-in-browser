#!/usr/bin/env npx tsx

/**
 * IPFS Gateway Health Monitoring Script for BitChat In Browser
 *
 * Monitors the health of IPFS gateways and tracks availability history.
 * Designed to run as a scheduled job every 5 minutes.
 *
 * Usage:
 *   npx tsx scripts/monitor-gateways.ts                    # Run health check
 *   npx tsx scripts/monitor-gateways.ts --cid <CID>        # Check specific CID
 *   npx tsx scripts/monitor-gateways.ts --report           # Generate weekly report
 *   npx tsx scripts/monitor-gateways.ts --json             # JSON output for CI
 *   npx tsx scripts/monitor-gateways.ts --alert            # Create GitHub issue on failure
 *
 * Environment Variables:
 *   GITHUB_TOKEN           - GitHub token for creating issues
 *   GITHUB_REPOSITORY      - Repository for issues (owner/repo)
 *   IPFS_CID               - Default CID to check
 *   ALERT_THRESHOLD        - Minimum healthy gateways (default: 2)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_ALERT_THRESHOLD = 2;
const HISTORY_FILE = 'gateway-health-history.json';

// IPFS Gateways to monitor (in priority order)
const GATEWAYS = [
  {
    name: 'eth.limo',
    template: (cid: string) => `https://${cid}.ipfs.eth.limo`,
    primary: true,
  },
  {
    name: 'dweb.link',
    template: (cid: string) => `https://${cid}.ipfs.dweb.link`,
    primary: true,
  },
  {
    name: 'ipfs.io',
    template: (cid: string) => `https://ipfs.io/ipfs/${cid}`,
    primary: false,
  },
  {
    name: 'cf-ipfs.com',
    template: (cid: string) => `https://${cid}.ipfs.cf-ipfs.com`,
    primary: false,
  },
  {
    name: 'cloudflare-ipfs.com',
    template: (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
    primary: false,
  },
  {
    name: 'gateway.pinata.cloud',
    template: (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
    primary: false,
  },
  {
    name: 'w3s.link',
    template: (cid: string) => `https://${cid}.ipfs.w3s.link`,
    primary: false,
  },
];

interface GatewayCheckResult {
  name: string;
  url: string;
  healthy: boolean;
  responseTime: number;
  statusCode: number | null;
  error: string | null;
  timestamp: string;
}

interface HealthCheckResult {
  cid: string;
  timestamp: string;
  totalGateways: number;
  healthyGateways: number;
  unhealthyGateways: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  results: GatewayCheckResult[];
}

interface HistoryEntry {
  timestamp: string;
  healthyCount: number;
  totalCount: number;
  gatewayStatuses: Record<string, boolean>;
}

interface HistoryData {
  entries: HistoryEntry[];
  lastUpdated: string;
}

// Command line arguments
const args = process.argv.slice(2);
const cidArg = args.find((arg) => arg === '--cid');
const cidIndex = cidArg ? args.indexOf(cidArg) : -1;
const cid = cidIndex >= 0 ? args[cidIndex + 1] : process.env.IPFS_CID;
const jsonOutput = args.includes('--json');
const generateReport = args.includes('--report');
const shouldAlert = args.includes('--alert');
const alertThreshold = parseInt(process.env.ALERT_THRESHOLD || '', 10) || DEFAULT_ALERT_THRESHOLD;

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  if (jsonOutput) return;

  const colors: Record<string, string> = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
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
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; responseTime: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BitChat-Gateway-Monitor/1.0',
      },
    });
    clearTimeout(timeoutId);

    return {
      ok: response.ok,
      status: response.status,
      responseTime: Date.now() - startTime,
    };
  } catch {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check a single gateway
 */
async function checkGateway(
  gateway: typeof GATEWAYS[0],
  cid: string
): Promise<GatewayCheckResult> {
  const url = gateway.template(cid);
  const timestamp = new Date().toISOString();

  try {
    const result = await fetchWithTimeout(url);

    return {
      name: gateway.name,
      url,
      healthy: result.ok,
      responseTime: result.responseTime,
      statusCode: result.status,
      error: result.ok ? null : `HTTP ${result.status}`,
      timestamp,
    };
  } catch (error) {
    return {
      name: gateway.name,
      url,
      healthy: false,
      responseTime: 0,
      statusCode: null,
      error: (error as Error).message,
      timestamp,
    };
  }
}

/**
 * Check all gateways
 */
async function checkAllGateways(cid: string): Promise<HealthCheckResult> {
  log(`Checking gateway health for CID: ${cid}`);

  const results: GatewayCheckResult[] = [];

  // Check all gateways in parallel
  const checkPromises = GATEWAYS.map((gateway) => checkGateway(gateway, cid));
  const gatewayResults = await Promise.all(checkPromises);

  for (const result of gatewayResults) {
    results.push(result);

    if (result.healthy) {
      log(`  ${result.name}: OK (${result.responseTime}ms)`, 'success');
    } else {
      log(`  ${result.name}: FAILED - ${result.error}`, 'error');
    }
  }

  const healthyCount = results.filter((r) => r.healthy).length;
  const totalCount = results.length;

  let overallHealth: 'healthy' | 'degraded' | 'critical';
  if (healthyCount >= Math.ceil(totalCount * 0.75)) {
    overallHealth = 'healthy';
  } else if (healthyCount >= alertThreshold) {
    overallHealth = 'degraded';
  } else {
    overallHealth = 'critical';
  }

  return {
    cid,
    timestamp: new Date().toISOString(),
    totalGateways: totalCount,
    healthyGateways: healthyCount,
    unhealthyGateways: totalCount - healthyCount,
    overallHealth,
    results,
  };
}

/**
 * Load health history
 */
function loadHistory(): HistoryData {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);

  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { entries: [], lastUpdated: '' };
    }
  }

  return { entries: [], lastUpdated: '' };
}

/**
 * Save health history
 */
function saveHistory(history: HistoryData): void {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  history.lastUpdated = new Date().toISOString();

  // Keep last 7 days of data (assuming 5-minute intervals = ~2016 entries)
  const maxEntries = 2016;
  if (history.entries.length > maxEntries) {
    history.entries = history.entries.slice(-maxEntries);
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Add result to history
 */
function recordHistory(result: HealthCheckResult): void {
  const history = loadHistory();

  const gatewayStatuses: Record<string, boolean> = {};
  for (const r of result.results) {
    gatewayStatuses[r.name] = r.healthy;
  }

  history.entries.push({
    timestamp: result.timestamp,
    healthyCount: result.healthyGateways,
    totalCount: result.totalGateways,
    gatewayStatuses,
  });

  saveHistory(history);
}

/**
 * Generate weekly report
 */
function generateWeeklyReport(): void {
  const history = loadHistory();

  if (history.entries.length === 0) {
    log('No historical data available for report', 'warn');
    return;
  }

  // Filter to last 7 days
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekEntries = history.entries.filter(
    (e) => new Date(e.timestamp).getTime() >= oneWeekAgo
  );

  if (weekEntries.length === 0) {
    log('No data from the last 7 days', 'warn');
    return;
  }

  console.log('\n========================================');
  console.log('IPFS Gateway Health Report - Last 7 Days');
  console.log('========================================\n');

  // Overall statistics
  const totalChecks = weekEntries.length;
  const avgHealthy = weekEntries.reduce((sum, e) => sum + e.healthyCount, 0) / totalChecks;
  const criticalCount = weekEntries.filter((e) => e.healthyCount < DEFAULT_ALERT_THRESHOLD).length;
  const degradedCount = weekEntries.filter(
    (e) => e.healthyCount >= DEFAULT_ALERT_THRESHOLD && e.healthyCount < e.totalCount * 0.75
  ).length;

  console.log('Overall Statistics:');
  console.log(`  Total Checks: ${totalChecks}`);
  console.log(`  Average Healthy Gateways: ${avgHealthy.toFixed(1)}`);
  console.log(`  Critical Incidents: ${criticalCount}`);
  console.log(`  Degraded Periods: ${degradedCount}`);
  console.log(`  Uptime: ${(((totalChecks - criticalCount) / totalChecks) * 100).toFixed(2)}%\n`);

  // Per-gateway statistics
  console.log('Gateway Availability:');
  const gatewayStats: Record<string, { up: number; total: number }> = {};

  for (const entry of weekEntries) {
    for (const [name, status] of Object.entries(entry.gatewayStatuses)) {
      if (!gatewayStats[name]) {
        gatewayStats[name] = { up: 0, total: 0 };
      }
      gatewayStats[name].total++;
      if (status) {
        gatewayStats[name].up++;
      }
    }
  }

  const sortedGateways = Object.entries(gatewayStats)
    .sort((a, b) => (b[1].up / b[1].total) - (a[1].up / a[1].total));

  for (const [name, stats] of sortedGateways) {
    const uptime = ((stats.up / stats.total) * 100).toFixed(2);
    const bar = '='.repeat(Math.floor(parseFloat(uptime) / 5)) + '-'.repeat(20 - Math.floor(parseFloat(uptime) / 5));
    console.log(`  ${name.padEnd(25)} [${bar}] ${uptime}%`);
  }

  console.log('\n========================================\n');
}

/**
 * Create GitHub issue for gateway failure
 */
async function createGitHubAlert(result: HealthCheckResult): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    log('GITHUB_TOKEN or GITHUB_REPOSITORY not set, skipping alert', 'warn');
    return;
  }

  const unhealthyGateways = result.results
    .filter((r) => !r.healthy)
    .map((r) => `- ${r.name}: ${r.error || 'Unknown error'}`)
    .join('\n');

  const healthyGateways = result.results
    .filter((r) => r.healthy)
    .map((r) => `- ${r.name}: OK (${r.responseTime}ms)`)
    .join('\n');

  const title = `[Alert] IPFS Gateway Health Critical: ${result.healthyGateways}/${result.totalGateways} gateways healthy`;
  const body = `## Gateway Health Alert

**Status:** ${result.overallHealth.toUpperCase()}
**Timestamp:** ${result.timestamp}
**CID:** \`${result.cid}\`

### Summary
- **Healthy Gateways:** ${result.healthyGateways}/${result.totalGateways}
- **Alert Threshold:** ${alertThreshold} gateways

### Unhealthy Gateways
${unhealthyGateways || 'None'}

### Healthy Gateways
${healthyGateways || 'None'}

---

**Action Required:**
1. Check if unhealthy gateways are experiencing outages
2. Consider triggering rollback if issue persists
3. Monitor gateway status: https://ipfs.github.io/public-gateway-checker/

---
*This issue was created automatically by the gateway monitoring system.*
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
        labels: ['alert', 'gateway', 'automated'],
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
function printResults(result: HealthCheckResult): void {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n========================================');
  console.log('Gateway Health Check Results');
  console.log('========================================');
  console.log(`CID: ${result.cid}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Status: ${result.overallHealth.toUpperCase()}`);
  console.log(`\nHealthy: ${result.healthyGateways}/${result.totalGateways}`);

  console.log('\nGateway Details:');
  for (const r of result.results) {
    const status = r.healthy
      ? `\x1b[32mOK\x1b[0m (${r.responseTime}ms)`
      : `\x1b[31mFAIL\x1b[0m - ${r.error}`;
    console.log(`  ${r.name.padEnd(25)} ${status}`);
  }

  console.log('========================================\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  // Handle report generation
  if (generateReport) {
    generateWeeklyReport();
    return;
  }

  // Validate CID
  if (!cid) {
    console.log('Usage: npx tsx scripts/monitor-gateways.ts --cid <CID> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --cid <CID>     IPFS CID to check (or set IPFS_CID env var)');
    console.log('  --json          Output results as JSON');
    console.log('  --report        Generate weekly availability report');
    console.log('  --alert         Create GitHub issue on critical failure');
    console.log('');
    console.log('Environment Variables:');
    console.log('  IPFS_CID          Default CID to check');
    console.log('  GITHUB_TOKEN      GitHub token for creating issues');
    console.log('  GITHUB_REPOSITORY Repository for issues (owner/repo)');
    console.log('  ALERT_THRESHOLD   Minimum healthy gateways (default: 2)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/monitor-gateways.ts --cid bafyabc123...');
    console.log('  npx tsx scripts/monitor-gateways.ts --cid bafyabc123... --alert');
    console.log('  npx tsx scripts/monitor-gateways.ts --report');
    process.exit(1);
  }

  // Basic CID validation
  if (!cid.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,59})$/)) {
    log('Warning: CID format may be invalid. Expected Qm... (v0) or bafy... (v1)', 'warn');
  }

  try {
    const result = await checkAllGateways(cid);

    // Record to history
    recordHistory(result);

    // Print results
    printResults(result);

    // Create alert if needed
    if (shouldAlert && result.overallHealth === 'critical') {
      await createGitHubAlert(result);
    }

    // Exit with appropriate code
    if (result.overallHealth === 'critical') {
      process.exit(2);
    } else if (result.overallHealth === 'degraded') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }));
    } else {
      log(`Monitoring failed: ${(error as Error).message}`, 'error');
    }
    process.exit(1);
  }
}

// Run the script
main();
