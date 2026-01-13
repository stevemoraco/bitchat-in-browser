#!/usr/bin/env npx ts-node

/**
 * Security Scan Script
 *
 * Performs comprehensive security scanning of the BitChat codebase:
 * - Dependency vulnerability checks (npm audit)
 * - Known vulnerable patterns in source code
 * - Secret/credential detection
 * - Insecure coding patterns
 *
 * Usage:
 *   npx ts-node scripts/security-scan.ts
 *   npm run security:scan
 *
 * @module scripts/security-scan
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ScanResult {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

interface ScanSummary {
  errors: number;
  warnings: number;
  info: number;
  passed: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Directories to scan for source code */
  sourceDirs: ['src', 'scripts'],

  /** File extensions to scan */
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],

  /** Files/directories to ignore */
  ignore: ['node_modules', 'dist', 'build', 'coverage', '.git'],

  /** Maximum file size to scan (bytes) */
  maxFileSize: 1024 * 1024, // 1MB
};

// ============================================================================
// Vulnerable Patterns
// ============================================================================

/**
 * Patterns that indicate potential security vulnerabilities.
 */
const VULNERABLE_PATTERNS = [
  // Dangerous Functions
  {
    pattern: /\beval\s*\(/g,
    message: 'eval() usage detected - potential code injection vulnerability',
    severity: 'error' as const,
  },
  {
    pattern: /new\s+Function\s*\(/g,
    message: 'Function constructor usage detected - potential code injection',
    severity: 'error' as const,
  },
  {
    pattern: /document\.write\s*\(/g,
    message: 'document.write() usage detected - XSS vulnerability risk',
    severity: 'error' as const,
  },
  {
    pattern: /innerHTML\s*=/g,
    message: 'innerHTML assignment detected - verify content is sanitized',
    severity: 'warning' as const,
  },
  {
    pattern: /outerHTML\s*=/g,
    message: 'outerHTML assignment detected - verify content is sanitized',
    severity: 'warning' as const,
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    message: 'dangerouslySetInnerHTML usage - ensure content is sanitized',
    severity: 'warning' as const,
  },

  // SQL/NoSQL Injection
  {
    pattern: /\$\{[^}]*\}\s*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/gi,
    message: 'Potential SQL injection - use parameterized queries',
    severity: 'error' as const,
  },

  // Command Injection
  {
    pattern: /exec\s*\(\s*`[^`]*\$\{/g,
    message: 'Command injection risk - user input in shell command',
    severity: 'error' as const,
  },
  {
    pattern: /execSync\s*\(\s*`[^`]*\$\{/g,
    message: 'Command injection risk - user input in shell command',
    severity: 'error' as const,
  },

  // Weak Cryptography
  {
    pattern: /crypto\.createHash\s*\(\s*['"]md5['"]/gi,
    message: 'MD5 hash detected - use SHA-256 or better',
    severity: 'error' as const,
  },
  {
    pattern: /crypto\.createHash\s*\(\s*['"]sha1['"]/gi,
    message: 'SHA-1 hash detected - use SHA-256 or better for security',
    severity: 'warning' as const,
  },
  {
    pattern: /\bDES\b/g,
    message: 'DES encryption detected - use AES or ChaCha20',
    severity: 'error' as const,
  },
  {
    pattern: /aes-128-ecb|aes-192-ecb|aes-256-ecb/gi,
    message: 'ECB mode detected - use GCM or other authenticated mode',
    severity: 'error' as const,
  },

  // Insecure Random
  {
    pattern: /Math\.random\s*\(\s*\)/g,
    message: 'Math.random() used - verify not used for security purposes',
    severity: 'warning' as const,
  },

  // Hardcoded Secrets
  {
    pattern: /['"](?:password|secret|apikey|api_key|token)['"]:\s*['"][^'"]{8,}['"]/gi,
    message: 'Potential hardcoded secret detected',
    severity: 'error' as const,
  },
  {
    pattern: /(?:password|secret|apikey|api_key|token)\s*=\s*['"][^'"]{8,}['"]/gi,
    message: 'Potential hardcoded credential detected',
    severity: 'error' as const,
  },

  // Private Key Patterns
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    message: 'Private key detected in source code',
    severity: 'error' as const,
  },
  {
    pattern: /nsec1[a-z0-9]{58}/gi,
    message: 'Nostr private key (nsec) detected in source code',
    severity: 'error' as const,
  },

  // Insecure HTTP
  {
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g,
    message: 'Insecure HTTP URL detected - use HTTPS',
    severity: 'warning' as const,
  },
  {
    pattern: /ws:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g,
    message: 'Insecure WebSocket URL detected - use WSS',
    severity: 'warning' as const,
  },

  // Console Logging Sensitive Data
  {
    pattern: /console\.\w+\s*\([^)]*(?:privateKey|secretKey|password|nsec)/gi,
    message: 'Potential sensitive data logging detected',
    severity: 'error' as const,
  },

  // Disabled Security
  {
    pattern: /rejectUnauthorized:\s*false/g,
    message: 'SSL verification disabled - security vulnerability',
    severity: 'error' as const,
  },
  {
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/g,
    message: 'SSL verification disabled globally',
    severity: 'error' as const,
  },

  // Local Storage of Sensitive Data
  {
    pattern: /localStorage\.setItem\s*\([^)]*(?:privateKey|secretKey|password)/gi,
    message: 'Sensitive data may be stored in localStorage',
    severity: 'warning' as const,
  },

  // XSS Patterns
  {
    pattern: /\bhref\s*=\s*["']javascript:/gi,
    message: 'javascript: URL detected - XSS vulnerability',
    severity: 'error' as const,
  },
  {
    pattern: /on\w+\s*=\s*["'][^"']*["']/gi,
    message: 'Inline event handler detected - potential XSS',
    severity: 'warning' as const,
  },

  // Prototype Pollution
  {
    pattern: /__proto__/g,
    message: '__proto__ usage detected - prototype pollution risk',
    severity: 'warning' as const,
  },
  {
    pattern: /Object\.assign\s*\(\s*\{\s*\},\s*[^)]+\)/g,
    message: 'Object.assign with user input - verify no prototype pollution',
    severity: 'info' as const,
  },

  // Path Traversal
  {
    pattern: /\.\.\/|\.\.\\|%2e%2e/gi,
    message: 'Path traversal pattern detected - verify input validation',
    severity: 'warning' as const,
  },
];

/**
 * Patterns that should NOT be present (blocklist).
 */
const BLOCKLIST_PATTERNS = [
  {
    pattern: /google-analytics\.com/gi,
    message: 'Google Analytics tracking code detected',
    severity: 'error' as const,
  },
  {
    pattern: /googletagmanager\.com/gi,
    message: 'Google Tag Manager detected',
    severity: 'error' as const,
  },
  {
    pattern: /facebook\.com\/tr/gi,
    message: 'Facebook tracking pixel detected',
    severity: 'error' as const,
  },
  {
    pattern: /segment\.(?:com|io)/gi,
    message: 'Segment analytics detected',
    severity: 'error' as const,
  },
  {
    pattern: /mixpanel\.com/gi,
    message: 'Mixpanel analytics detected',
    severity: 'error' as const,
  },
  {
    pattern: /amplitude\.com/gi,
    message: 'Amplitude analytics detected',
    severity: 'error' as const,
  },
  {
    pattern: /hotjar\.com/gi,
    message: 'Hotjar tracking detected',
    severity: 'error' as const,
  },
  {
    pattern: /sentry\.io/gi,
    message: 'Sentry error tracking detected - review if privacy-compliant',
    severity: 'warning' as const,
  },
];

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Run npm audit to check for vulnerable dependencies.
 */
async function runNpmAudit(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  console.log('\n=== Running npm audit ===\n');

  try {
    // Run npm audit with JSON output
    const output = execSync('npm audit --json 2>/dev/null', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const audit = JSON.parse(output);

    if (audit.metadata?.vulnerabilities) {
      const vulns = audit.metadata.vulnerabilities;

      if (vulns.critical > 0) {
        results.push({
          type: 'error',
          category: 'dependencies',
          message: `${vulns.critical} critical vulnerabilities found`,
        });
      }

      if (vulns.high > 0) {
        results.push({
          type: 'error',
          category: 'dependencies',
          message: `${vulns.high} high severity vulnerabilities found`,
        });
      }

      if (vulns.moderate > 0) {
        results.push({
          type: 'warning',
          category: 'dependencies',
          message: `${vulns.moderate} moderate severity vulnerabilities found`,
        });
      }

      if (vulns.low > 0) {
        results.push({
          type: 'info',
          category: 'dependencies',
          message: `${vulns.low} low severity vulnerabilities found`,
        });
      }

      if (vulns.critical === 0 && vulns.high === 0 && vulns.moderate === 0 && vulns.low === 0) {
        results.push({
          type: 'info',
          category: 'dependencies',
          message: 'No vulnerabilities found in dependencies',
        });
      }
    }
  } catch (error: unknown) {
    // npm audit exits with non-zero if vulnerabilities are found
    try {
      const errorOutput = (error as { stdout?: string }).stdout;
      if (errorOutput) {
        const audit = JSON.parse(errorOutput);
        const vulns = audit.metadata?.vulnerabilities;

        if (vulns) {
          if (vulns.critical > 0) {
            results.push({
              type: 'error',
              category: 'dependencies',
              message: `${vulns.critical} critical vulnerabilities found - run 'npm audit' for details`,
            });
          }
          if (vulns.high > 0) {
            results.push({
              type: 'error',
              category: 'dependencies',
              message: `${vulns.high} high severity vulnerabilities found`,
            });
          }
          if (vulns.moderate > 0) {
            results.push({
              type: 'warning',
              category: 'dependencies',
              message: `${vulns.moderate} moderate severity vulnerabilities found`,
            });
          }
        }
      }
    } catch {
      results.push({
        type: 'warning',
        category: 'dependencies',
        message: 'Could not parse npm audit output - run manually to check',
      });
    }
  }

  return results;
}

/**
 * Scan source files for vulnerable patterns.
 */
function scanSourceFiles(): ScanResult[] {
  const results: ScanResult[] = [];
  const projectRoot = process.cwd();

  console.log('\n=== Scanning source files ===\n');

  function scanFile(filePath: string) {
    const relativePath = path.relative(projectRoot, filePath);

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > CONFIG.maxFileSize) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check vulnerable patterns
    for (const { pattern, message, severity } of VULNERABLE_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        // Find line number
        let lineNum = 1;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > match.index) {
            lineNum = i + 1;
            break;
          }
        }

        results.push({
          type: severity,
          category: 'code-pattern',
          message,
          file: relativePath,
          line: lineNum,
        });
      }
    }

    // Check blocklist patterns
    for (const { pattern, message, severity } of BLOCKLIST_PATTERNS) {
      if (pattern.test(content)) {
        results.push({
          type: severity,
          category: 'blocklist',
          message,
          file: relativePath,
        });
      }
    }
  }

  function scanDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip ignored paths
      if (CONFIG.ignore.some((i) => entry.name === i || fullPath.includes(i))) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CONFIG.extensions.includes(ext)) {
          scanFile(fullPath);
        }
      }
    }
  }

  for (const dir of CONFIG.sourceDirs) {
    scanDirectory(path.join(projectRoot, dir));
  }

  return results;
}

/**
 * Check for sensitive files that shouldn't be committed.
 */
function checkSensitiveFiles(): ScanResult[] {
  const results: ScanResult[] = [];
  const projectRoot = process.cwd();

  console.log('\n=== Checking for sensitive files ===\n');

  const sensitivePatterns = [
    { pattern: '.env', message: 'Environment file found' },
    { pattern: '.env.local', message: 'Local environment file found' },
    { pattern: '.env.production', message: 'Production environment file found' },
    { pattern: 'credentials.json', message: 'Credentials file found' },
    { pattern: 'secrets.json', message: 'Secrets file found' },
    { pattern: '*.pem', message: 'PEM key file found' },
    { pattern: '*.key', message: 'Key file found' },
    { pattern: 'id_rsa', message: 'SSH private key found' },
    { pattern: 'id_ed25519', message: 'SSH private key found' },
  ];

  for (const { pattern, message } of sensitivePatterns) {
    const files = findFiles(projectRoot, pattern);
    for (const file of files) {
      results.push({
        type: 'warning',
        category: 'sensitive-files',
        message: `${message}: ${file}`,
        file,
      });
    }
  }

  // Check .gitignore for sensitive patterns
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

    const requiredIgnores = ['.env', '*.pem', '*.key', 'credentials*', 'secrets*'];

    for (const required of requiredIgnores) {
      if (!gitignore.includes(required)) {
        results.push({
          type: 'warning',
          category: 'gitignore',
          message: `Consider adding '${required}' to .gitignore`,
        });
      }
    }
  }

  return results;
}

/**
 * Find files matching a pattern.
 */
function findFiles(dir: string, pattern: string): string[] {
  const results: string[] = [];

  function search(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (CONFIG.ignore.includes(entry.name)) continue;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          search(fullPath);
        } else if (entry.isFile()) {
          if (matchPattern(entry.name, pattern)) {
            results.push(path.relative(dir, fullPath));
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  search(dir);
  return results;
}

/**
 * Simple glob-like pattern matching.
 */
function matchPattern(filename: string, pattern: string): boolean {
  if (pattern.startsWith('*')) {
    return filename.endsWith(pattern.slice(1));
  }
  return filename === pattern;
}

/**
 * Print results to console.
 */
function printResults(results: ScanResult[]): ScanSummary {
  const summary: ScanSummary = {
    errors: 0,
    warnings: 0,
    info: 0,
    passed: true,
  };

  const byCategory = new Map<string, ScanResult[]>();

  for (const result of results) {
    const category = result.category;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(result);

    if (result.type === 'error') {
      summary.errors++;
      summary.passed = false;
    } else if (result.type === 'warning') {
      summary.warnings++;
    } else {
      summary.info++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('                    SECURITY SCAN RESULTS');
  console.log('='.repeat(60) + '\n');

  for (const [category, categoryResults] of byCategory) {
    console.log(`\n--- ${category.toUpperCase()} ---\n`);

    for (const result of categoryResults) {
      const icon =
        result.type === 'error'
          ? '[ERROR]'
          : result.type === 'warning'
            ? '[WARN]'
            : '[INFO]';

      const location = result.file
        ? result.line
          ? ` (${result.file}:${result.line})`
          : ` (${result.file})`
        : '';

      console.log(`${icon} ${result.message}${location}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('                         SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Errors:   ${summary.errors}`);
  console.log(`  Warnings: ${summary.warnings}`);
  console.log(`  Info:     ${summary.info}`);
  console.log('='.repeat(60));
  console.log(`  Status:   ${summary.passed ? 'PASSED' : 'FAILED'}`);
  console.log('='.repeat(60) + '\n');

  return summary;
}

/**
 * Main entry point.
 */
async function main() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('        BitChat Security Scan');
  console.log('='.repeat(60));
  console.log('\nScanning for security vulnerabilities...\n');

  const allResults: ScanResult[] = [];

  // Run npm audit
  const auditResults = await runNpmAudit();
  allResults.push(...auditResults);

  // Scan source files
  const sourceResults = scanSourceFiles();
  allResults.push(...sourceResults);

  // Check sensitive files
  const sensitiveResults = checkSensitiveFiles();
  allResults.push(...sensitiveResults);

  // Print results
  const summary = printResults(allResults);

  // Exit with appropriate code
  process.exit(summary.passed ? 0 : 1);
}

// Run the script
main().catch((error) => {
  console.error('Security scan failed:', error);
  process.exit(1);
});
