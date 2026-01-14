#!/usr/bin/env npx tsx

/**
 * Automatic Rollback System for BitChat In Browser
 *
 * Maintains deployment history and provides automatic rollback capabilities.
 * Triggers rollback when canary failure rate exceeds threshold.
 *
 * Usage:
 *   npx tsx scripts/rollback.ts status                       # Show current status
 *   npx tsx scripts/rollback.ts record <CID>                 # Record new deployment
 *   npx tsx scripts/rollback.ts rollback                     # Rollback to previous CID
 *   npx tsx scripts/rollback.ts rollback --to <CID>          # Rollback to specific CID
 *   npx tsx scripts/rollback.ts check                        # Check if rollback needed
 *   npx tsx scripts/rollback.ts check --auto                 # Auto-rollback if needed
 *
 * Environment Variables:
 *   ENS_PRIVATE_KEY        - Private key for ENS updates
 *   RPC_URL                - Ethereum RPC URL
 *   GITHUB_TOKEN           - GitHub token for creating issues
 *   GITHUB_REPOSITORY      - Repository for issues (owner/repo)
 *   ROLLBACK_THRESHOLD     - Failure rate threshold (default: 5%)
 *   MIN_HISTORY_ENTRIES    - Minimum entries before auto-rollback (default: 4)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEPLOYMENT_HISTORY_FILE = 'deployment-history.json';
const CANARY_HISTORY_FILE = 'canary-history.json';
const MAX_HISTORY_ENTRIES = 5;
const DEFAULT_ROLLBACK_THRESHOLD = 5; // 5% failure rate triggers rollback
const DEFAULT_MIN_ENTRIES = 4; // Minimum canary entries before auto-rollback

const ENS_NAME = 'bitbrowse.eth';

interface DeploymentEntry {
  cid: string;
  timestamp: string;
  commitHash: string | null;
  version: string | null;
  status: 'active' | 'previous' | 'rolledback';
  rollbackFrom: string | null;
}

interface DeploymentHistory {
  entries: DeploymentEntry[];
  lastUpdated: string;
  currentCid: string | null;
}

interface CanaryHistoryEntry {
  timestamp: string;
  success: boolean;
  duration: number;
  failedStep: string | null;
}

interface CanaryHistory {
  entries: CanaryHistoryEntry[];
  successRate24h: number;
  successRate7d: number;
}

interface RollbackDecision {
  shouldRollback: boolean;
  reason: string | null;
  currentCid: string | null;
  targetCid: string | null;
  failureRate: number;
  sampleSize: number;
}

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];
const jsonOutput = args.includes('--json');
const autoRollback = args.includes('--auto');
const dryRun = args.includes('--dry-run');
const toIndex = args.indexOf('--to');
const targetCid = toIndex >= 0 ? args[toIndex + 1] : null;

// Environment variables
const rollbackThreshold = parseFloat(process.env.ROLLBACK_THRESHOLD || '') || DEFAULT_ROLLBACK_THRESHOLD;
const minHistoryEntries = parseInt(process.env.MIN_HISTORY_ENTRIES || '', 10) || DEFAULT_MIN_ENTRIES;

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
 * Load deployment history
 */
function loadDeploymentHistory(): DeploymentHistory {
  const historyPath = path.join(process.cwd(), DEPLOYMENT_HISTORY_FILE);

  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { entries: [], lastUpdated: '', currentCid: null };
    }
  }

  return { entries: [], lastUpdated: '', currentCid: null };
}

/**
 * Save deployment history
 */
function saveDeploymentHistory(history: DeploymentHistory): void {
  const historyPath = path.join(process.cwd(), DEPLOYMENT_HISTORY_FILE);
  history.lastUpdated = new Date().toISOString();

  // Enforce maximum entries
  if (history.entries.length > MAX_HISTORY_ENTRIES) {
    history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Load canary history
 */
function loadCanaryHistory(): CanaryHistory {
  const historyPath = path.join(process.cwd(), CANARY_HISTORY_FILE);

  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { entries: [], successRate24h: 100, successRate7d: 100 };
    }
  }

  return { entries: [], successRate24h: 100, successRate7d: 100 };
}

/**
 * Record a new deployment
 */
function recordDeployment(cid: string): void {
  const history = loadDeploymentHistory();

  // Mark previous active deployment as 'previous'
  for (const entry of history.entries) {
    if (entry.status === 'active') {
      entry.status = 'previous';
    }
  }

  // Get commit hash and version from environment
  const commitHash = process.env.GITHUB_SHA || process.env.GIT_COMMIT || null;
  const version = process.env.npm_package_version || null;

  // Add new deployment
  history.entries.push({
    cid,
    timestamp: new Date().toISOString(),
    commitHash,
    version,
    status: 'active',
    rollbackFrom: null,
  });

  history.currentCid = cid;

  saveDeploymentHistory(history);

  log(`Recorded deployment: ${cid}`, 'success');
  log(`Total deployments in history: ${history.entries.length}`, 'info');
}

/**
 * Check if rollback is needed based on canary failure rate
 */
function checkRollbackNeeded(): RollbackDecision {
  const deploymentHistory = loadDeploymentHistory();
  const canaryHistory = loadCanaryHistory();

  const currentCid = deploymentHistory.currentCid;

  // Not enough data to make decision
  if (canaryHistory.entries.length < minHistoryEntries) {
    return {
      shouldRollback: false,
      reason: `Not enough canary data (${canaryHistory.entries.length}/${minHistoryEntries} entries)`,
      currentCid,
      targetCid: null,
      failureRate: 0,
      sampleSize: canaryHistory.entries.length,
    };
  }

  // Calculate recent failure rate (last hour = last 4 entries at 15-min intervals)
  const recentEntries = canaryHistory.entries.slice(-4);
  const failures = recentEntries.filter((e) => !e.success).length;
  const failureRate = (failures / recentEntries.length) * 100;

  // Find previous CID for rollback
  const previousEntry = deploymentHistory.entries
    .filter((e) => e.status === 'previous' && e.cid !== currentCid)
    .pop();

  // Check if rollback is needed
  if (failureRate > rollbackThreshold) {
    if (!previousEntry) {
      return {
        shouldRollback: false,
        reason: 'Rollback needed but no previous deployment available',
        currentCid,
        targetCid: null,
        failureRate,
        sampleSize: recentEntries.length,
      };
    }

    return {
      shouldRollback: true,
      reason: `Failure rate ${failureRate.toFixed(1)}% exceeds threshold ${rollbackThreshold}%`,
      currentCid,
      targetCid: previousEntry.cid,
      failureRate,
      sampleSize: recentEntries.length,
    };
  }

  return {
    shouldRollback: false,
    reason: `Failure rate ${failureRate.toFixed(1)}% is within acceptable range`,
    currentCid,
    targetCid: null,
    failureRate,
    sampleSize: recentEntries.length,
  };
}

/**
 * Update ENS content hash to trigger rollback
 */
async function updateENS(cid: string): Promise<boolean> {
  const privateKey = process.env.ENS_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || 'https://eth.llamarpc.com';

  if (!privateKey) {
    log('ENS_PRIVATE_KEY not set, cannot perform rollback', 'error');
    log('Manual rollback instructions:', 'info');
    log(`  1. Go to https://app.ens.domains`, 'info');
    log(`  2. Connect wallet that owns ${ENS_NAME}`, 'info');
    log(`  3. Update content hash to: ipfs://${cid}`, 'info');
    return false;
  }

  if (dryRun) {
    log(`[DRY RUN] Would update ENS to: ipfs://${cid}`, 'warn');
    return true;
  }

  try {
    // Dynamic import of ethers
    const { ethers } = await import('ethers');

    log(`Connecting to RPC: ${rpcUrl}`, 'info');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    log(`Wallet address: ${wallet.address}`, 'info');

    // Get the resolver
    const ensResolver = await provider.getResolver(ENS_NAME);

    if (!ensResolver) {
      throw new Error(`No resolver found for ${ENS_NAME}`);
    }

    log(`Resolver: ${ensResolver.address}`, 'info');

    // Get namehash
    const namehash = ethers.namehash(ENS_NAME);

    // Create content hash (simplified - production should use content-hash library)
    const contentHash = ethers.toUtf8Bytes(`/ipfs/${cid}`);

    // Create resolver contract
    const resolverABI = [
      'function setContenthash(bytes32 node, bytes calldata hash) external',
    ];

    const resolverContract = new ethers.Contract(
      ensResolver.address,
      resolverABI,
      wallet
    );

    log('Sending ENS update transaction...', 'info');

    const tx = await resolverContract.setContenthash(namehash, contentHash);
    log(`Transaction: ${tx.hash}`, 'info');

    log('Waiting for confirmation...', 'info');
    const receipt = await tx.wait();

    log(`Confirmed in block ${receipt.blockNumber}`, 'success');
    log(`View: https://etherscan.io/tx/${tx.hash}`, 'info');

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      log('ethers package not installed. Run: npm install ethers', 'error');
    } else {
      log(`ENS update failed: ${(error as Error).message}`, 'error');
    }
    return false;
  }
}

/**
 * Perform rollback
 */
async function performRollback(targetCid: string, reason: string): Promise<boolean> {
  const history = loadDeploymentHistory();

  log(`\n========================================`, 'warn');
  log(`ROLLBACK INITIATED`, 'warn');
  log(`========================================`, 'warn');
  log(`Reason: ${reason}`, 'info');
  log(`Target CID: ${targetCid}`, 'info');
  log(`Current CID: ${history.currentCid}`, 'info');

  // Verify target CID exists in history
  const targetEntry = history.entries.find((e) => e.cid === targetCid);
  if (!targetEntry) {
    log(`Target CID not found in deployment history`, 'error');
    return false;
  }

  // Update ENS
  log('\nUpdating ENS content hash...', 'info');
  const ensUpdated = await updateENS(targetCid);

  if (!ensUpdated) {
    log('ENS update failed, rollback incomplete', 'error');
    return false;
  }

  // Update deployment history
  const currentEntry = history.entries.find((e) => e.status === 'active');
  if (currentEntry) {
    currentEntry.status = 'rolledback';
  }

  // Update target entry
  targetEntry.status = 'active';
  targetEntry.rollbackFrom = history.currentCid;

  history.currentCid = targetCid;

  saveDeploymentHistory(history);

  log('\n========================================', 'success');
  log('ROLLBACK COMPLETE', 'success');
  log('========================================', 'success');
  log(`New active CID: ${targetCid}`, 'info');
  log(`Verify at: https://bitbrowse.eth.limo`, 'info');

  // Create GitHub issue for rollback notification
  await createRollbackIssue(targetCid, reason, history.entries.find((e) => e.cid === targetCid)?.rollbackFrom || null);

  return true;
}

/**
 * Create GitHub issue for rollback notification
 */
async function createRollbackIssue(targetCid: string, reason: string, fromCid: string | null): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    log('GITHUB_TOKEN or GITHUB_REPOSITORY not set, skipping issue creation', 'warn');
    return;
  }

  const history = loadDeploymentHistory();
  const canaryHistory = loadCanaryHistory();

  const title = `[Rollback] Deployed version rolled back due to failures`;
  const body = `## Automatic Rollback Executed

**Timestamp:** ${new Date().toISOString()}
**Reason:** ${reason}

### Deployment Changes
- **From CID:** \`${fromCid || 'unknown'}\`
- **To CID:** \`${targetCid}\`

### Canary Status
- Success Rate (24h): ${canaryHistory.successRate24h.toFixed(2)}%
- Success Rate (7d): ${canaryHistory.successRate7d.toFixed(2)}%
- Recent Tests: ${canaryHistory.entries.slice(-5).map(e => e.success ? ':white_check_mark:' : ':x:').join(' ')}

### Deployment History
${history.entries.map(e => `- \`${e.cid.slice(0, 20)}...\` - ${e.status} (${e.timestamp})`).join('\n')}

---

**Next Steps:**
1. Investigate the cause of failures
2. Review changes in the rolled-back deployment
3. Fix issues and redeploy when ready

---
*This issue was created automatically by the rollback system.*
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
        labels: ['rollback', 'incident', 'automated'],
      }),
    });

    if (response.ok) {
      const issue = await response.json() as { html_url: string };
      log(`Created rollback issue: ${issue.html_url}`, 'success');
    } else {
      const error = await response.text();
      log(`Failed to create GitHub issue: ${error}`, 'warn');
    }
  } catch (error) {
    log(`Error creating GitHub issue: ${(error as Error).message}`, 'warn');
  }
}

/**
 * Show current status
 */
function showStatus(): void {
  const history = loadDeploymentHistory();
  const canaryHistory = loadCanaryHistory();
  const decision = checkRollbackNeeded();

  if (jsonOutput) {
    console.log(JSON.stringify({
      deploymentHistory: history,
      canaryStatus: {
        successRate24h: canaryHistory.successRate24h,
        successRate7d: canaryHistory.successRate7d,
        recentTests: canaryHistory.entries.slice(-5),
      },
      rollbackDecision: decision,
    }, null, 2));
    return;
  }

  console.log('\n========================================');
  console.log('BitChat Deployment Status');
  console.log('========================================\n');

  console.log('Current Deployment:');
  console.log(`  CID: ${history.currentCid || 'Not set'}`);
  console.log(`  Last Updated: ${history.lastUpdated || 'Never'}`);

  console.log('\nDeployment History:');
  if (history.entries.length === 0) {
    console.log('  No deployments recorded');
  } else {
    for (const entry of history.entries.slice().reverse()) {
      const status = entry.status === 'active' ? '\x1b[32m[ACTIVE]\x1b[0m' :
                     entry.status === 'previous' ? '\x1b[33m[PREVIOUS]\x1b[0m' :
                     '\x1b[31m[ROLLED BACK]\x1b[0m';
      console.log(`  ${status} ${entry.cid.slice(0, 20)}...`);
      console.log(`           ${entry.timestamp}`);
      if (entry.commitHash) {
        console.log(`           Commit: ${entry.commitHash.slice(0, 8)}`);
      }
    }
  }

  console.log('\nCanary Status:');
  console.log(`  Success Rate (24h): ${canaryHistory.successRate24h.toFixed(2)}%`);
  console.log(`  Success Rate (7d):  ${canaryHistory.successRate7d.toFixed(2)}%`);
  console.log(`  Recent Tests: ${canaryHistory.entries.slice(-5).map(e => e.success ? 'PASS' : 'FAIL').join(' | ')}`);

  console.log('\nRollback Status:');
  console.log(`  Threshold: ${rollbackThreshold}% failure rate`);
  console.log(`  Current Failure Rate: ${decision.failureRate.toFixed(1)}%`);
  console.log(`  Sample Size: ${decision.sampleSize} tests`);
  console.log(`  Decision: ${decision.shouldRollback ? '\x1b[31mROLLBACK NEEDED\x1b[0m' : '\x1b[32mOK\x1b[0m'}`);
  if (decision.reason) {
    console.log(`  Reason: ${decision.reason}`);
  }

  console.log('\n========================================\n');
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log('Usage: npx tsx scripts/rollback.ts <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  status              Show current deployment and rollback status');
  console.log('  record <CID>        Record a new deployment');
  console.log('  rollback            Rollback to previous deployment');
  console.log('  check               Check if rollback is needed');
  console.log('');
  console.log('Options:');
  console.log('  --to <CID>          Rollback to specific CID');
  console.log('  --auto              Automatically rollback if needed (with check)');
  console.log('  --dry-run           Show what would happen without making changes');
  console.log('  --json              Output results as JSON');
  console.log('');
  console.log('Environment Variables:');
  console.log('  ENS_PRIVATE_KEY     Private key for ENS updates');
  console.log('  RPC_URL             Ethereum RPC URL');
  console.log('  GITHUB_TOKEN        GitHub token for creating issues');
  console.log('  GITHUB_REPOSITORY   Repository for issues (owner/repo)');
  console.log('  ROLLBACK_THRESHOLD  Failure rate threshold (default: 5%)');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/rollback.ts status');
  console.log('  npx tsx scripts/rollback.ts record bafyabc123...');
  console.log('  npx tsx scripts/rollback.ts check --auto');
  console.log('  npx tsx scripts/rollback.ts rollback --to bafyxyz789...');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'status':
      showStatus();
      break;

    case 'record': {
      const cid = args[1];
      if (!cid) {
        log('Error: CID required for record command', 'error');
        process.exit(1);
      }
      if (!cid.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,59})$/)) {
        log('Warning: CID format may be invalid', 'warn');
      }
      recordDeployment(cid);
      break;
    }

    case 'check': {
      const decision = checkRollbackNeeded();

      if (jsonOutput) {
        console.log(JSON.stringify(decision, null, 2));
      } else {
        log(`Rollback check:`, 'info');
        log(`  Failure Rate: ${decision.failureRate.toFixed(1)}%`, 'info');
        log(`  Threshold: ${rollbackThreshold}%`, 'info');
        log(`  Decision: ${decision.shouldRollback ? 'ROLLBACK NEEDED' : 'OK'}`, decision.shouldRollback ? 'error' : 'success');
        if (decision.reason) {
          log(`  Reason: ${decision.reason}`, 'info');
        }
      }

      if (autoRollback && decision.shouldRollback && decision.targetCid) {
        log('\nAuto-rollback enabled, initiating rollback...', 'warn');
        const success = await performRollback(decision.targetCid, decision.reason || 'Auto-rollback triggered');
        process.exit(success ? 0 : 1);
      }

      process.exit(decision.shouldRollback ? 1 : 0);
    }

    case 'rollback': {
      const history = loadDeploymentHistory();

      let rollbackTarget = targetCid;

      if (!rollbackTarget) {
        // Find the previous CID
        const previousEntry = history.entries
          .filter((e) => e.status === 'previous' && e.cid !== history.currentCid)
          .pop();

        if (!previousEntry) {
          log('No previous deployment available for rollback', 'error');
          process.exit(1);
        }

        rollbackTarget = previousEntry.cid;
      }

      const success = await performRollback(rollbackTarget, 'Manual rollback triggered');
      process.exit(success ? 0 : 1);
    }

    default:
      log(`Unknown command: ${command}`, 'error');
      printUsage();
      process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  log(`Error: ${error.message}`, 'error');
  process.exit(1);
});
