import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for BitChat In Browser PWA
 *
 * This configuration provides comprehensive testing across:
 * - Multiple desktop browsers (Chrome, Firefox, Safari)
 * - Mobile viewports (iOS, Android)
 * - PWA-specific testing
 * - Offline functionality testing
 *
 * Commands:
 * - Run all tests: npm run test:e2e
 * - Run headed: npm run test:e2e:headed
 * - Run specific test: npx playwright test e2e/onboarding.spec.ts
 * - Run specific browser: npm run test:e2e:chromium
 * - Run mobile tests: npm run test:e2e:mobile
 * - Debug mode: npm run test:e2e:debug
 * - Open UI: npm run test:e2e:ui
 * - View report: npm run test:e2e:report
 */
export default defineConfig({
  // ============================================================================
  // Test Configuration
  // ============================================================================

  // Test directory containing all spec files
  testDir: './e2e',

  // Output directory for test artifacts (screenshots, videos, traces)
  outputDir: './test-results',

  // Snapshot directory for visual regression tests
  snapshotDir: './e2e/snapshots',

  // Maximum time per test (30 seconds)
  timeout: 30 * 1000,

  // Maximum time for expect() assertions
  expect: {
    timeout: 5000,
    // Configure screenshot comparison
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.1,
    },
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only (2 retries), local gets 1 retry
  retries: process.env.CI ? 2 : 1,

  // Limit parallel workers on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // ============================================================================
  // Reporter Configuration
  // ============================================================================

  reporter: process.env.CI
    ? [
        // GitHub Actions reporter for PR annotations
        ['github'],
        // HTML report (don't auto-open on CI)
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        // JSON report for CI processing
        ['json', { outputFile: 'test-results/results.json' }],
        // JUnit for CI integration
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [
        // HTML report (open on failure for local dev)
        ['html', { open: 'on-failure', outputFolder: 'playwright-report' }],
        // List reporter for terminal output
        ['list'],
        // Line reporter for concise output
        ['line'],
      ],

  // ============================================================================
  // Shared Settings for All Projects
  // ============================================================================

  use: {
    // Base URL for page.goto()
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // Collect trace when retrying a failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording configuration
    video: {
      mode: 'on-first-retry',
      size: { width: 1280, height: 720 },
    },

    // Action timeout (10 seconds)
    actionTimeout: 10000,

    // Navigation timeout (15 seconds)
    navigationTimeout: 15000,

    // Default viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,

    // Locale and timezone for consistent testing
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Geolocation for location-based features (San Francisco)
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    permissions: ['geolocation'],

    // User agent string
    userAgent: undefined, // Use browser default

    // Accept downloads
    acceptDownloads: true,

    // Enable JavaScript
    javaScriptEnabled: true,

    // Bypass CSP for testing (careful in production tests)
    bypassCSP: false,

    // Storage state (for persisting login across tests)
    storageState: undefined,

    // Service worker mode
    serviceWorkers: 'allow',

    // Color scheme for dark mode testing
    colorScheme: 'dark',
  },

  // ============================================================================
  // Browser Projects Configuration
  // ============================================================================

  projects: [
    // -------------------------------------------------------------------------
    // Setup Project (runs before all tests)
    // -------------------------------------------------------------------------
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: /global-teardown\.ts/,
    },

    // -------------------------------------------------------------------------
    // Desktop Browsers
    // -------------------------------------------------------------------------
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific launch options
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
          ],
        },
        // Enable Chrome DevTools Protocol for debugging
        channel: 'chrome',
      },
      // Run most tests on Chromium first
      dependencies: [],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'dom.events.asyncClipboard.readText': true,
            'dom.events.testing.asyncClipboard': true,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },

    // -------------------------------------------------------------------------
    // Mobile Devices - Android
    // -------------------------------------------------------------------------
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        // Mobile-specific settings
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'Mobile Chrome Landscape',
      use: {
        ...devices['Pixel 5 landscape'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'Galaxy S21',
      use: {
        ...devices['Galaxy S9+'],
        hasTouch: true,
        isMobile: true,
      },
    },

    // -------------------------------------------------------------------------
    // Mobile Devices - iOS
    // -------------------------------------------------------------------------
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'Mobile Safari Landscape',
      use: {
        ...devices['iPhone 13 landscape'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'iPad',
      use: {
        ...devices['iPad Pro 11'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'iPad Landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
        hasTouch: true,
        isMobile: true,
      },
    },

    // -------------------------------------------------------------------------
    // PWA-Specific Tests
    // -------------------------------------------------------------------------
    {
      name: 'pwa',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-features=ServiceWorkerServicification',
            '--enable-features=BackgroundFetch',
          ],
        },
        // Ensure service workers are allowed
        serviceWorkers: 'allow',
      },
      // Match PWA-specific test files
      testMatch: /.*\.pwa\.spec\.ts/,
    },
    {
      name: 'pwa-mobile',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--enable-features=ServiceWorkerServicification'],
        },
        serviceWorkers: 'allow',
        hasTouch: true,
        isMobile: true,
      },
      testMatch: /.*\.pwa\.spec\.ts/,
    },

    // -------------------------------------------------------------------------
    // Offline Testing
    // -------------------------------------------------------------------------
    {
      name: 'offline',
      use: {
        ...devices['Desktop Chrome'],
        serviceWorkers: 'allow',
        offline: false, // We'll toggle this in tests
      },
      testMatch: /.*\.(offline|pwa)\.spec\.ts/,
    },

    // -------------------------------------------------------------------------
    // Accessibility Testing
    // -------------------------------------------------------------------------
    {
      name: 'a11y',
      use: {
        ...devices['Desktop Chrome'],
        // Force high contrast for accessibility
        colorScheme: 'dark',
        // Reduced motion for animation testing
        reducedMotion: 'reduce',
      },
      testMatch: /.*\.a11y\.spec\.ts/,
    },

    // -------------------------------------------------------------------------
    // Visual Regression Testing
    // -------------------------------------------------------------------------
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        // Consistent viewport for screenshots
        viewport: { width: 1920, height: 1080 },
        // Disable animations for consistent screenshots
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
      testMatch: /.*\.visual\.spec\.ts/,
    },

    // -------------------------------------------------------------------------
    // Performance Testing
    // -------------------------------------------------------------------------
    {
      name: 'perf',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--js-flags=--expose-gc',
          ],
        },
      },
      testMatch: /.*\.perf\.spec\.ts/,
    },
  ],

  // ============================================================================
  // Web Server Configuration
  // ============================================================================

  webServer: {
    // Command to start the dev server
    command: process.env.CI ? 'npm run preview' : 'npm run dev',

    // URL to wait for before running tests
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // Reuse existing server in development
    reuseExistingServer: !process.env.CI,

    // Timeout for server to start (2 minutes)
    timeout: 120 * 1000,

    // Pipe server output for debugging
    stdout: 'pipe',
    stderr: 'pipe',

    // Environment variables for the server
    env: {
      NODE_ENV: process.env.CI ? 'production' : 'development',
    },
  },

  // ============================================================================
  // Global Setup/Teardown
  // ============================================================================

  // Run global setup before all tests
  globalSetup: undefined, // Uncomment when needed: './e2e/global-setup.ts'

  // Run global teardown after all tests
  globalTeardown: undefined, // Uncomment when needed: './e2e/global-teardown.ts'

  // ============================================================================
  // Metadata
  // ============================================================================

  metadata: {
    project: 'BitChat In Browser',
    team: 'BitChat',
    environment: process.env.CI ? 'CI' : 'local',
  },
});
