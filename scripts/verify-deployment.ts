#!/usr/bin/env npx tsx

/**
 * IPFS Deployment Verification Script for BitChat In Browser
 *
 * Verifies that a deployed IPFS site is accessible and complete
 *
 * Usage:
 *   npx tsx scripts/verify-deployment.ts <CID>           # Verify deployment
 *   npx tsx scripts/verify-deployment.ts <CID> --verbose # Verbose output
 *   npx tsx scripts/verify-deployment.ts <CID> --json    # JSON output for CI
 *
 * Examples:
 *   npx tsx scripts/verify-deployment.ts QmXyz123...
 *   npx tsx scripts/verify-deployment.ts bafyabc...
 */

interface VerificationResult {
  success: boolean;
  cid: string;
  gateway: string;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    duration?: number;
  }[];
  totalDuration: number;
}

interface ManifestData {
  name: string;
  short_name: string;
  icons: Array<{ src: string; sizes: string }>;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
}

// IPFS Gateways to test against (in priority order)
const GATEWAYS = [
  { name: 'dweb.link', template: (cid: string) => `https://${cid}.ipfs.dweb.link` },
  { name: 'cf-ipfs.com', template: (cid: string) => `https://${cid}.ipfs.cf-ipfs.com` },
  { name: 'pinata.cloud', template: (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}` },
  { name: 'ipfs.io', template: (cid: string) => `https://ipfs.io/ipfs/${cid}` },
  { name: 'cloudflare-ipfs.com', template: (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}` },
];

// Required files to verify
const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
];

// Optional but expected files
const EXPECTED_FILES = [
  'favicon.ico',
  'robots.txt',
];

// Command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const jsonOutput = args.includes('--json');
const cid = args.find((arg) => !arg.startsWith('-'));

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

function logVerbose(message: string): void {
  if (verbose && !jsonOutput) {
    console.log(`    ${message}`);
  }
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Find the first working gateway for the CID
 */
async function findWorkingGateway(cid: string): Promise<{ url: string; name: string } | null> {
  log('Finding working IPFS gateway...');

  for (const gateway of GATEWAYS) {
    const url = gateway.template(cid);
    logVerbose(`Trying ${gateway.name}: ${url}`);

    try {
      const start = Date.now();
      const response = await fetchWithTimeout(url, { method: 'HEAD', timeout: 15000 });
      const duration = Date.now() - start;

      if (response.ok) {
        log(`Gateway found: ${gateway.name} (${duration}ms)`, 'success');
        return { url, name: gateway.name };
      }
      logVerbose(`  Status: ${response.status}`);
    } catch (error) {
      logVerbose(`  Error: ${(error as Error).message}`);
    }
  }

  return null;
}

/**
 * Check if index.html loads and contains expected content
 */
async function verifyIndexHtml(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();
  const url = `${baseUrl}/index.html`;

  try {
    const response = await fetchWithTimeout(url, { timeout: 30000 });
    const duration = Date.now() - start;

    if (!response.ok) {
      return {
        passed: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration,
      };
    }

    const html = await response.text();

    // Check for essential PWA elements
    const checks = [
      { name: 'DOCTYPE', test: () => html.includes('<!DOCTYPE html') || html.includes('<!doctype html') },
      { name: 'manifest link', test: () => html.includes('manifest') },
      { name: 'viewport meta', test: () => html.includes('viewport') },
      { name: 'app root element', test: () => html.includes('id="app"') || html.includes('id="root"') },
      { name: 'script tags', test: () => html.includes('<script') },
    ];

    const failures = checks.filter((check) => !check.test()).map((check) => check.name);

    if (failures.length > 0) {
      return {
        passed: false,
        message: `Missing elements: ${failures.join(', ')}`,
        duration,
      };
    }

    return {
      passed: true,
      message: `Loaded successfully (${html.length} bytes)`,
      duration,
    };
  } catch (error) {
    return {
      passed: false,
      message: `Failed to fetch: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Verify PWA manifest.json / manifest.webmanifest
 */
async function verifyManifest(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();

  // Try both manifest locations
  const manifestUrls = [
    `${baseUrl}/manifest.webmanifest`,
    `${baseUrl}/manifest.json`,
  ];

  for (const url of manifestUrls) {
    try {
      const response = await fetchWithTimeout(url, { timeout: 20000 });

      if (!response.ok) {
        logVerbose(`  ${url}: HTTP ${response.status}`);
        continue;
      }

      const manifest = (await response.json()) as ManifestData;
      const duration = Date.now() - start;

      // Validate required fields
      const requiredFields = ['name', 'short_name', 'icons', 'start_url', 'display'];
      const missingFields = requiredFields.filter(
        (field) => !manifest[field as keyof ManifestData]
      );

      if (missingFields.length > 0) {
        return {
          passed: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          duration,
        };
      }

      // Validate icons array
      if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
        return {
          passed: false,
          message: 'No icons defined in manifest',
          duration,
        };
      }

      // Check for required icon sizes
      const iconSizes = manifest.icons.map((icon) => icon.sizes);
      const requiredSizes = ['192x192', '512x512'];
      const missingSizes = requiredSizes.filter((size) => !iconSizes.includes(size));

      if (missingSizes.length > 0) {
        return {
          passed: false,
          message: `Missing icon sizes: ${missingSizes.join(', ')}`,
          duration,
        };
      }

      return {
        passed: true,
        message: `Valid manifest: "${manifest.name}" with ${manifest.icons.length} icons`,
        duration,
      };
    } catch (error) {
      logVerbose(`  ${url}: ${(error as Error).message}`);
    }
  }

  return {
    passed: false,
    message: 'Manifest not found or invalid',
    duration: Date.now() - start,
  };
}

/**
 * Check if service worker file exists
 */
async function verifyServiceWorker(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();

  // Common service worker paths
  const swPaths = [
    '/sw.js',
    '/service-worker.js',
    '/serviceworker.js',
  ];

  for (const path of swPaths) {
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetchWithTimeout(url, { timeout: 20000 });

      if (response.ok) {
        const content = await response.text();
        const duration = Date.now() - start;

        // Basic validation that it's a service worker
        const swIndicators = ['self.', 'addEventListener', 'fetch', 'cache'];
        const foundIndicators = swIndicators.filter((indicator) =>
          content.includes(indicator)
        );

        if (foundIndicators.length >= 2) {
          return {
            passed: true,
            message: `Found at ${path} (${content.length} bytes)`,
            duration,
          };
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return {
    passed: false,
    message: 'Service worker not found',
    duration: Date.now() - start,
  };
}

/**
 * Verify that JavaScript assets load
 */
async function verifyJsAssets(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();

  try {
    // First get index.html to find JS files
    const indexResponse = await fetchWithTimeout(`${baseUrl}/index.html`, {
      timeout: 30000,
    });

    if (!indexResponse.ok) {
      return {
        passed: false,
        message: 'Could not fetch index.html to find JS assets',
        duration: Date.now() - start,
      };
    }

    const html = await indexResponse.text();

    // Extract JS file paths from script tags
    const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
    const jsFiles = Array.from(scriptMatches, (m) => m[1]);

    if (jsFiles.length === 0) {
      return {
        passed: false,
        message: 'No JS files found in index.html',
        duration: Date.now() - start,
      };
    }

    // Check each JS file
    let loadedCount = 0;
    const errors: string[] = [];

    for (const jsFile of jsFiles.slice(0, 5)) {
      // Check up to 5 files
      const jsUrl = jsFile.startsWith('http')
        ? jsFile
        : `${baseUrl}/${jsFile.replace(/^\.?\/?/, '')}`;

      try {
        const response = await fetchWithTimeout(jsUrl, {
          method: 'HEAD',
          timeout: 15000,
        });

        if (response.ok) {
          loadedCount++;
          logVerbose(`  [+] ${jsFile}`);
        } else {
          errors.push(`${jsFile}: HTTP ${response.status}`);
          logVerbose(`  [-] ${jsFile}: ${response.status}`);
        }
      } catch (error) {
        errors.push(`${jsFile}: ${(error as Error).message}`);
        logVerbose(`  [-] ${jsFile}: ${(error as Error).message}`);
      }
    }

    const duration = Date.now() - start;

    if (loadedCount === 0) {
      return {
        passed: false,
        message: `No JS files loaded. Errors: ${errors.join('; ')}`,
        duration,
      };
    }

    return {
      passed: true,
      message: `${loadedCount}/${jsFiles.length} JS files verified`,
      duration,
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking JS assets: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Verify CSS assets load
 */
async function verifyCssAssets(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();

  try {
    // First get index.html to find CSS files
    const indexResponse = await fetchWithTimeout(`${baseUrl}/index.html`, {
      timeout: 30000,
    });

    if (!indexResponse.ok) {
      return {
        passed: false,
        message: 'Could not fetch index.html to find CSS assets',
        duration: Date.now() - start,
      };
    }

    const html = await indexResponse.text();

    // Extract CSS file paths from link tags
    const cssMatches = html.matchAll(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g
    );
    const cssMatches2 = html.matchAll(
      /<link[^>]+href=["']([^"']+\.css[^"']*)["']/g
    );
    const cssFiles = [
      ...Array.from(cssMatches, (m) => m[1]),
      ...Array.from(cssMatches2, (m) => m[1]),
    ];

    // Also check for inline styles
    const hasInlineStyles = html.includes('<style');

    if (cssFiles.length === 0 && !hasInlineStyles) {
      return {
        passed: true,
        message: 'No external CSS files (may use CSS-in-JS)',
        duration: Date.now() - start,
      };
    }

    if (cssFiles.length === 0) {
      return {
        passed: true,
        message: 'Using inline styles',
        duration: Date.now() - start,
      };
    }

    // Check each CSS file
    let loadedCount = 0;

    for (const cssFile of cssFiles) {
      const cssUrl = cssFile.startsWith('http')
        ? cssFile
        : `${baseUrl}/${cssFile.replace(/^\.?\/?/, '')}`;

      try {
        const response = await fetchWithTimeout(cssUrl, {
          method: 'HEAD',
          timeout: 15000,
        });

        if (response.ok) {
          loadedCount++;
          logVerbose(`  [+] ${cssFile}`);
        } else {
          logVerbose(`  [-] ${cssFile}: ${response.status}`);
        }
      } catch (error) {
        logVerbose(`  [-] ${cssFile}: ${(error as Error).message}`);
      }
    }

    const duration = Date.now() - start;

    return {
      passed: loadedCount > 0,
      message:
        loadedCount > 0
          ? `${loadedCount}/${cssFiles.length} CSS files verified`
          : 'No CSS files could be loaded',
      duration,
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking CSS assets: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check optional files
 */
async function verifyOptionalFiles(baseUrl: string): Promise<{
  passed: boolean;
  message: string;
  duration: number;
}> {
  const start = Date.now();
  const found: string[] = [];
  const missing: string[] = [];

  for (const file of EXPECTED_FILES) {
    const url = `${baseUrl}/${file}`;

    try {
      const response = await fetchWithTimeout(url, {
        method: 'HEAD',
        timeout: 10000,
      });

      if (response.ok) {
        found.push(file);
        logVerbose(`  [+] ${file}`);
      } else {
        missing.push(file);
        logVerbose(`  [-] ${file}`);
      }
    } catch {
      missing.push(file);
      logVerbose(`  [-] ${file}`);
    }
  }

  const duration = Date.now() - start;

  return {
    passed: true, // Optional files don't fail the check
    message:
      found.length > 0
        ? `Found: ${found.join(', ')}${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}`
        : `Missing optional files: ${missing.join(', ')}`,
    duration,
  };
}

/**
 * Main verification function
 */
async function verifyDeployment(cid: string): Promise<VerificationResult> {
  const startTime = Date.now();
  const checks: VerificationResult['checks'] = [];

  log(`\nVerifying IPFS deployment: ${cid}\n`, 'info');

  // Find working gateway
  const gateway = await findWorkingGateway(cid);

  if (!gateway) {
    return {
      success: false,
      cid,
      gateway: 'none',
      checks: [
        {
          name: 'Gateway Access',
          passed: false,
          message: 'No IPFS gateway could access this CID',
        },
      ],
      totalDuration: Date.now() - startTime,
    };
  }

  const baseUrl = gateway.url;

  // Run all verification checks
  log('\nRunning verification checks...', 'info');

  // Check 1: Index HTML
  log('Checking index.html...', 'info');
  const indexResult = await verifyIndexHtml(baseUrl);
  checks.push({ name: 'Index HTML', ...indexResult });
  log(
    `Index HTML: ${indexResult.message}`,
    indexResult.passed ? 'success' : 'error'
  );

  // Check 2: PWA Manifest
  log('Checking PWA manifest...', 'info');
  const manifestResult = await verifyManifest(baseUrl);
  checks.push({ name: 'PWA Manifest', ...manifestResult });
  log(
    `PWA Manifest: ${manifestResult.message}`,
    manifestResult.passed ? 'success' : 'error'
  );

  // Check 3: Service Worker
  log('Checking service worker...', 'info');
  const swResult = await verifyServiceWorker(baseUrl);
  checks.push({ name: 'Service Worker', ...swResult });
  log(
    `Service Worker: ${swResult.message}`,
    swResult.passed ? 'success' : 'warn'
  );

  // Check 4: JS Assets
  log('Checking JavaScript assets...', 'info');
  const jsResult = await verifyJsAssets(baseUrl);
  checks.push({ name: 'JavaScript Assets', ...jsResult });
  log(
    `JavaScript Assets: ${jsResult.message}`,
    jsResult.passed ? 'success' : 'error'
  );

  // Check 5: CSS Assets
  log('Checking CSS assets...', 'info');
  const cssResult = await verifyCssAssets(baseUrl);
  checks.push({ name: 'CSS Assets', ...cssResult });
  log(
    `CSS Assets: ${cssResult.message}`,
    cssResult.passed ? 'success' : 'warn'
  );

  // Check 6: Optional Files
  log('Checking optional files...', 'info');
  const optionalResult = await verifyOptionalFiles(baseUrl);
  checks.push({ name: 'Optional Files', ...optionalResult });
  log(`Optional Files: ${optionalResult.message}`, 'info');

  const totalDuration = Date.now() - startTime;

  // Calculate overall success (critical checks only)
  const criticalChecks = ['Index HTML', 'PWA Manifest', 'JavaScript Assets'];
  const success = checks
    .filter((c) => criticalChecks.includes(c.name))
    .every((c) => c.passed);

  return {
    success,
    cid,
    gateway: gateway.name,
    checks,
    totalDuration,
  };
}

/**
 * Print results summary
 */
function printResults(result: VerificationResult): void {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n========================================');
  console.log('Deployment Verification Results');
  console.log('========================================');
  console.log(`CID: ${result.cid}`);
  console.log(`Gateway: ${result.gateway}`);
  console.log(`Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
  console.log('\nChecks:');

  for (const check of result.checks) {
    const status = check.passed ? '\x1b[32m PASS \x1b[0m' : '\x1b[31m FAIL \x1b[0m';
    const duration = check.duration ? ` (${check.duration}ms)` : '';
    console.log(`  [${status}] ${check.name}${duration}`);
    console.log(`         ${check.message}`);
  }

  console.log('\n----------------------------------------');

  if (result.success) {
    console.log('\x1b[32mDeployment verified successfully!\x1b[0m');
    console.log('\nAccess URLs:');
    console.log(`  - https://${result.cid}.ipfs.dweb.link`);
    console.log(`  - https://gateway.pinata.cloud/ipfs/${result.cid}`);
    console.log(`  - After ENS update: https://bitbrowse.eth.limo`);
  } else {
    console.log('\x1b[31mDeployment verification failed!\x1b[0m');
    console.log('\nFailed checks:');
    for (const check of result.checks.filter((c) => !c.passed)) {
      console.log(`  - ${check.name}: ${check.message}`);
    }
  }

  console.log('========================================\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  if (!cid) {
    console.log('Usage: npx tsx scripts/verify-deployment.ts <CID> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v    Show detailed output');
    console.log('  --json           Output results as JSON (for CI)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/verify-deployment.ts QmXyz123...');
    console.log('  npx tsx scripts/verify-deployment.ts bafyabc... --verbose');
    console.log('  npx tsx scripts/verify-deployment.ts bafyabc... --json');
    process.exit(1);
  }

  // Basic CID validation
  if (!cid.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,59})$/)) {
    log('Warning: CID format may be invalid. Expected Qm... (v0) or bafy... (v1)', 'warn');
  }

  try {
    const result = await verifyDeployment(cid);
    printResults(result);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({
          success: false,
          cid,
          error: (error as Error).message,
        })
      );
    } else {
      log(`Verification failed: ${(error as Error).message}`, 'error');
    }
    process.exit(1);
  }
}

// Run the script
main();
