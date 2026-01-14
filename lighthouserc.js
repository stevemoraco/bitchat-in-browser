/**
 * Lighthouse CI Configuration
 *
 * This configuration defines performance budgets and collection settings
 * for Lighthouse CI audits.
 *
 * ## Performance Targets
 * - Performance Score: > 90
 * - Accessibility Score: > 95
 * - Best Practices Score: > 95
 * - PWA Score: > 95
 *
 * ## Timing Budgets
 * - Time to First Byte: < 500ms
 * - First Contentful Paint: < 1.5s
 * - Largest Contentful Paint: < 2.5s
 * - Time to Interactive: < 3s
 * - Cumulative Layout Shift: < 0.1
 *
 * ## Size Budgets
 * - Total Transfer: < 600KB
 * - JavaScript: < 500KB
 * - CSS: < 50KB
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */

module.exports = {
  ci: {
    // ========================================================================
    // Collection Settings
    // ========================================================================
    collect: {
      // Serve the built application from dist/
      staticDistDir: './dist',

      // Number of runs per URL (more runs = more reliable results)
      numberOfRuns: 3,

      // URLs to audit
      url: [
        'http://localhost/', // Main app
      ],

      // Chrome flags for consistent testing
      settings: {
        // Simulate mobile device (Moto G4)
        preset: 'desktop',

        // Throttling settings
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },

        // Only run specific categories
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
          'pwa',
        ],

        // Skip audits that are noisy or not relevant
        skipAudits: [
          'uses-http2', // Not relevant for local testing
          'redirects-http', // Not relevant for local testing
        ],

        // Form factor
        formFactor: 'desktop',

        // Screen emulation
        screenEmulation: {
          mobile: false,
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          disabled: false,
        },

        // Wait for page to be fully loaded
        maxWaitForFcp: 15000,
        maxWaitForLoad: 35000,
      },

      // Chrome launch settings
      chromeFlags: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
    },

    // ========================================================================
    // Assertion Settings (Performance Budgets)
    // ========================================================================
    assert: {
      // Preset for PWA assertions
      preset: 'lighthouse:recommended',

      assertions: {
        // =====================================================================
        // Category Score Assertions
        // =====================================================================

        // Performance: Must score at least 90
        'categories:performance': ['error', { minScore: 0.9 }],

        // Accessibility: Must score at least 95
        'categories:accessibility': ['error', { minScore: 0.95 }],

        // Best Practices: Must score at least 95
        'categories:best-practices': ['error', { minScore: 0.95 }],

        // SEO: Must score at least 90
        'categories:seo': ['warn', { minScore: 0.9 }],

        // PWA: Must score at least 95
        'categories:pwa': ['error', { minScore: 0.95 }],

        // =====================================================================
        // Performance Metrics Assertions
        // =====================================================================

        // First Contentful Paint: < 1.5s (1500ms)
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],

        // Largest Contentful Paint: < 2.5s (2500ms)
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],

        // Time to Interactive: < 3s (3000ms)
        interactive: ['error', { maxNumericValue: 3000 }],

        // Speed Index: < 3s (3000ms)
        'speed-index': ['warn', { maxNumericValue: 3000 }],

        // Total Blocking Time: < 300ms
        'total-blocking-time': ['error', { maxNumericValue: 300 }],

        // Cumulative Layout Shift: < 0.1
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Server Response Time (TTFB): < 500ms
        'server-response-time': ['error', { maxNumericValue: 500 }],

        // =====================================================================
        // Resource Budgets
        // =====================================================================

        // Total byte weight: < 600KB (614400 bytes)
        'total-byte-weight': ['error', { maxNumericValue: 614400 }],

        // JavaScript execution time: < 2s
        'bootup-time': ['warn', { maxNumericValue: 2000 }],

        // Main thread work: < 3s
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 3000 }],

        // =====================================================================
        // Accessibility Assertions
        // =====================================================================

        // All accessibility audits should pass
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',

        // =====================================================================
        // Best Practices Assertions
        // =====================================================================

        // HTTPS
        'is-on-https': 'off', // Off for local testing

        // No deprecated APIs
        'deprecations': 'error',

        // No errors in console
        'errors-in-console': 'warn',

        // No vulnerable libraries
        'no-vulnerable-libraries': 'error',

        // =====================================================================
        // PWA Assertions
        // =====================================================================

        // Service worker registration
        'service-worker': 'error',

        // Installable
        'installable-manifest': 'error',

        // Splash screen
        'splash-screen': 'error',

        // Theme color
        'themed-omnibox': 'warn',

        // Viewport
        'viewport': 'error',

        // =====================================================================
        // SEO Assertions
        // =====================================================================

        // Meta description
        'meta-description': 'warn',

        // Crawlable links
        'crawlable-anchors': 'warn',

        // Mobile friendly
        'font-size': 'warn',
        'tap-targets': 'warn',
      },

      // Budget for resource sizes (bytes)
      budgets: [
        {
          path: '/*',
          resourceSizes: [
            {
              resourceType: 'total',
              budget: 600, // 600KB
            },
            {
              resourceType: 'script',
              budget: 500, // 500KB
            },
            {
              resourceType: 'stylesheet',
              budget: 50, // 50KB
            },
            {
              resourceType: 'image',
              budget: 100, // 100KB
            },
            {
              resourceType: 'font',
              budget: 100, // 100KB
            },
            {
              resourceType: 'document',
              budget: 50, // 50KB HTML
            },
          ],
          resourceCounts: [
            {
              resourceType: 'total',
              budget: 30, // Max 30 requests
            },
            {
              resourceType: 'script',
              budget: 10, // Max 10 JS files
            },
            {
              resourceType: 'stylesheet',
              budget: 5, // Max 5 CSS files
            },
          ],
        },
      ],
    },

    // ========================================================================
    // Upload Settings
    // ========================================================================
    upload: {
      // Use temporary public storage (free)
      target: 'temporary-public-storage',

      // Or use your own LHCI server:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,

      // Or upload to GitHub:
      // target: 'filesystem',
      // outputDir: './.lighthouseci',
    },

    // ========================================================================
    // Server Settings (for self-hosted LHCI)
    // ========================================================================
    // server: {
    //   storage: {
    //     storageMethod: 'sql',
    //     sqlDialect: 'sqlite',
    //     sqlDatabasePath: './.lighthouseci/db.sql',
    //   },
    // },
  },
};
