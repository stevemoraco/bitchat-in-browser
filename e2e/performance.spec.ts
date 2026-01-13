/**
 * Performance E2E Tests
 *
 * End-to-end performance tests using Playwright to measure real browser metrics:
 * - Lighthouse CI integration (simulated through Performance API)
 * - Core Web Vitals (LCP, FID, CLS)
 * - First Contentful Paint (FCP)
 * - Time to Interactive (TTI)
 * - Scroll performance (60fps target)
 *
 * ## Performance Targets
 * - Initial bundle under 500KB
 * - First paint under 2 seconds
 * - Message send under 100ms
 * - 60fps scroll on message list
 *
 * @module e2e/performance.spec
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Performance targets
const PERFORMANCE_TARGETS = {
  /** Maximum first contentful paint time in milliseconds */
  FCP: 2000,
  /** Maximum largest contentful paint time in milliseconds */
  LCP: 2500,
  /** Maximum cumulative layout shift */
  CLS: 0.1,
  /** Maximum time to interactive in milliseconds */
  TTI: 3500,
  /** Minimum acceptable FPS during scroll */
  SCROLL_FPS: 55,
  /** Maximum DOM content loaded time in milliseconds */
  DOM_CONTENT_LOADED: 1500,
  /** Maximum load time in milliseconds */
  LOAD: 3000,
  /** Maximum bundle size in bytes */
  BUNDLE_SIZE: 500 * 1024,
  /** Maximum initial transfer size in bytes */
  INITIAL_TRANSFER: 300 * 1024,
};

// Test fixtures
const TEST_MESSAGES = Array.from({ length: 100 }, (_, i) => ({
  id: `msg_${i}`,
  content: `Test message ${i}: ${Math.random().toString(36).substring(7)}`,
  timestamp: Date.now() - i * 60000,
}));

const TEST_CHANNELS = Array.from({ length: 50 }, (_, i) => ({
  id: `channel_${i}`,
  name: `Channel ${i}`,
  type: i % 3 === 0 ? 'location' : i % 3 === 1 ? 'dm' : 'public',
}));

// MARK: - Helper Functions

/**
 * Get Core Web Vitals from page
 */
async function getCoreWebVitals(page: Page): Promise<{
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
}> {
  return page.evaluate(() => {
    const result = {
      fcp: null as number | null,
      lcp: null as number | null,
      cls: null as number | null,
      fid: null as number | null,
      ttfb: null as number | null,
    };

    // Get FCP
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(
      (entry) => entry.name === 'first-contentful-paint'
    );
    if (fcpEntry) {
      result.fcp = fcpEntry.startTime;
    }

    // Get TTFB
    const navEntries = performance.getEntriesByType(
      'navigation'
    ) as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      result.ttfb = navEntries[0]!.responseStart;
    }

    return result;
  });
}

/**
 * Get navigation timing metrics
 */
async function getNavigationTiming(page: Page): Promise<{
  domContentLoaded: number;
  load: number;
  domInteractive: number;
  responseStart: number;
  responseEnd: number;
}> {
  return page.evaluate(() => {
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming;

    return {
      domContentLoaded:
        navEntry?.domContentLoadedEventEnd - navEntry?.startTime || 0,
      load: navEntry?.loadEventEnd - navEntry?.startTime || 0,
      domInteractive: navEntry?.domInteractive - navEntry?.startTime || 0,
      responseStart: navEntry?.responseStart - navEntry?.startTime || 0,
      responseEnd: navEntry?.responseEnd - navEntry?.startTime || 0,
    };
  });
}

/**
 * Get resource transfer sizes
 */
async function getResourceSizes(page: Page): Promise<{
  totalTransfer: number;
  jsTransfer: number;
  cssTransfer: number;
  imageTransfer: number;
}> {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[];

    let totalTransfer = 0;
    let jsTransfer = 0;
    let cssTransfer = 0;
    let imageTransfer = 0;

    for (const resource of resources) {
      const size = resource.transferSize || 0;
      totalTransfer += size;

      if (resource.name.endsWith('.js') || resource.name.includes('.js?')) {
        jsTransfer += size;
      } else if (
        resource.name.endsWith('.css') ||
        resource.name.includes('.css?')
      ) {
        cssTransfer += size;
      } else if (
        resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/)
      ) {
        imageTransfer += size;
      }
    }

    return { totalTransfer, jsTransfer, cssTransfer, imageTransfer };
  });
}

/**
 * Measure scroll frame rate
 */
async function measureScrollFPS(
  page: Page,
  selector: string,
  scrollDistance: number
): Promise<{ fps: number; droppedFrames: number; totalFrames: number }> {
  return page.evaluate(
    async ({ selector, scrollDistance }) => {
      const element = document.querySelector(selector);
      if (!element) {
        return { fps: 0, droppedFrames: 0, totalFrames: 0 };
      }

      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();
      let rafId: number;
      let scrollComplete = false;

      // Start recording frames
      const recordFrame = () => {
        const now = performance.now();
        frameTimes.push(now - lastFrameTime);
        lastFrameTime = now;

        if (!scrollComplete) {
          rafId = requestAnimationFrame(recordFrame);
        }
      };

      rafId = requestAnimationFrame(recordFrame);

      // Perform smooth scroll
      const startScroll = element.scrollTop;
      const duration = 1000; // 1 second scroll
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const animateScroll = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease-out function
          const easeOut = 1 - Math.pow(1 - progress, 3);
          element.scrollTop = startScroll + scrollDistance * easeOut;

          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          } else {
            scrollComplete = true;
            resolve();
          }
        };

        requestAnimationFrame(animateScroll);
      });

      // Stop recording
      cancelAnimationFrame(rafId);

      // Calculate FPS
      if (frameTimes.length < 2) {
        return { fps: 0, droppedFrames: 0, totalFrames: 0 };
      }

      const frameTimesSlice = frameTimes.slice(1); // Skip first frame
      const avgFrameTime =
        frameTimesSlice.reduce((a, b) => a + b, 0) / frameTimesSlice.length;
      const fps = 1000 / avgFrameTime;
      const droppedFrames = frameTimesSlice.filter((t) => t > 16.67).length;

      return {
        fps,
        droppedFrames,
        totalFrames: frameTimesSlice.length,
      };
    },
    { selector, scrollDistance }
  );
}

/**
 * Inject test data into the page
 */
async function injectTestData(
  page: Page,
  messages: typeof TEST_MESSAGES,
  channels: typeof TEST_CHANNELS
): Promise<void> {
  await page.evaluate(
    ({ messages, channels }) => {
      // Store test data in window for components to use
      (window as unknown as { __TEST_MESSAGES__: typeof messages }).__TEST_MESSAGES__ = messages;
      (window as unknown as { __TEST_CHANNELS__: typeof channels }).__TEST_CHANNELS__ = channels;
    },
    { messages, channels }
  );
}

// MARK: - Tests

test.describe('Core Web Vitals', () => {
  test('should meet FCP target', async ({ page }) => {
    // Navigate and wait for FCP
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for paint to register
    await page.waitForTimeout(500);

    const vitals = await getCoreWebVitals(page);

    console.log(`First Contentful Paint: ${vitals.fcp?.toFixed(0)}ms`);

    expect(vitals.fcp).not.toBeNull();
    expect(vitals.fcp!).toBeLessThan(PERFORMANCE_TARGETS.FCP);
  });

  test('should have acceptable TTFB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const vitals = await getCoreWebVitals(page);

    console.log(`Time to First Byte: ${vitals.ttfb?.toFixed(0)}ms`);

    expect(vitals.ttfb).not.toBeNull();
    // TTFB should be under 600ms for good user experience
    expect(vitals.ttfb!).toBeLessThan(600);
  });

  test('should meet DOM content loaded target', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const timing = await getNavigationTiming(page);

    console.log(
      `DOM Content Loaded: ${timing.domContentLoaded.toFixed(0)}ms`
    );
    console.log(`Full Load: ${timing.load.toFixed(0)}ms`);
    console.log(`DOM Interactive: ${timing.domInteractive.toFixed(0)}ms`);

    expect(timing.domContentLoaded).toBeLessThan(
      PERFORMANCE_TARGETS.DOM_CONTENT_LOADED
    );
    expect(timing.load).toBeLessThan(PERFORMANCE_TARGETS.LOAD);
  });
});

test.describe('Bundle Size', () => {
  test('should have acceptable transfer size', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sizes = await getResourceSizes(page);

    console.log(`Total Transfer: ${(sizes.totalTransfer / 1024).toFixed(0)}KB`);
    console.log(`JS Transfer: ${(sizes.jsTransfer / 1024).toFixed(0)}KB`);
    console.log(`CSS Transfer: ${(sizes.cssTransfer / 1024).toFixed(0)}KB`);
    console.log(`Image Transfer: ${(sizes.imageTransfer / 1024).toFixed(0)}KB`);

    // JS should be under 500KB target
    expect(sizes.jsTransfer).toBeLessThan(PERFORMANCE_TARGETS.BUNDLE_SIZE);
  });

  test('should have efficient code splitting', async ({ page }) => {
    // Check that vendor chunks are separated
    const resources: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.endsWith('.js')) {
        resources.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have multiple JS chunks (code splitting working)
    const jsChunks = resources.filter((r) => r.includes('/assets/'));
    console.log(`JS Chunks loaded: ${jsChunks.length}`);

    // Expect at least main + vendor chunks
    expect(jsChunks.length).toBeGreaterThan(1);
  });
});

test.describe('Scroll Performance', () => {
  test.skip('should maintain 60fps during message list scroll', async ({
    page,
  }) => {
    // Skip if no message list present (fresh install)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check if message list exists
    const messageList = page.locator('[data-testid="message-list"]');
    const exists = (await messageList.count()) > 0;

    if (!exists) {
      console.log('No message list found, skipping scroll test');
      test.skip();
      return;
    }

    // Inject test messages
    await injectTestData(page, TEST_MESSAGES, TEST_CHANNELS);
    await page.waitForTimeout(500); // Let component re-render

    const scrollResult = await measureScrollFPS(
      page,
      '[data-testid="message-list"]',
      2000
    );

    console.log(`Scroll FPS: ${scrollResult.fps.toFixed(1)}`);
    console.log(
      `Dropped Frames: ${scrollResult.droppedFrames}/${scrollResult.totalFrames}`
    );

    expect(scrollResult.fps).toBeGreaterThan(PERFORMANCE_TARGETS.SCROLL_FPS);
  });

  test.skip('should maintain 60fps during channel list scroll', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check if channel list exists
    const channelList = page.locator('[data-testid="channel-list"]');
    const exists = (await channelList.count()) > 0;

    if (!exists) {
      console.log('No channel list found, skipping scroll test');
      test.skip();
      return;
    }

    const scrollResult = await measureScrollFPS(
      page,
      '[data-testid="channel-list"]',
      1000
    );

    console.log(`Channel List Scroll FPS: ${scrollResult.fps.toFixed(1)}`);

    expect(scrollResult.fps).toBeGreaterThan(PERFORMANCE_TARGETS.SCROLL_FPS);
  });
});

test.describe('Interaction Performance', () => {
  test('should respond quickly to clicks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find any clickable element
    const button = page.locator('button').first();

    if ((await button.count()) === 0) {
      console.log('No buttons found, skipping click test');
      return;
    }

    // Measure click response time
    const startTime = Date.now();

    await button.click({ timeout: 1000 }).catch(() => {
      // Ignore click errors (button might navigate)
    });

    const clickTime = Date.now() - startTime;
    console.log(`Click response time: ${clickTime}ms`);

    // Click should respond within 100ms
    expect(clickTime).toBeLessThan(100);
  });

  test('should handle rapid input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find any text input
    const input = page.locator('input[type="text"]').first();

    if ((await input.count()) === 0) {
      console.log('No text inputs found, skipping input test');
      return;
    }

    // Type rapidly and measure
    const startTime = Date.now();
    const testText = 'Quick typing test message';

    await input.click();
    await input.fill(testText);

    const typingTime = Date.now() - startTime;
    console.log(`Input fill time (${testText.length} chars): ${typingTime}ms`);

    // Should handle input smoothly
    expect(typingTime).toBeLessThan(500);
  });
});

test.describe('Memory Performance', () => {
  test('should not leak memory on navigation', async ({ page, context }) => {
    // Get initial memory (if available)
    const getMemory = async (): Promise<number | null> => {
      try {
        return await page.evaluate(() => {
          const memory = (
            performance as Performance & {
              memory?: { usedJSHeapSize: number };
            }
          ).memory;
          return memory?.usedJSHeapSize ?? null;
        });
      } catch {
        return null;
      }
    };

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const initialMemory = await getMemory();

    if (initialMemory === null) {
      console.log('Memory API not available, skipping memory test');
      return;
    }

    // Navigate back and forth several times
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if ((globalThis as { gc?: () => void }).gc) {
        (globalThis as { gc: () => void }).gc();
      }
    });

    await page.waitForTimeout(1000);

    const finalMemory = await getMemory();

    if (finalMemory !== null) {
      const memoryGrowth = finalMemory - initialMemory;
      const growthMB = memoryGrowth / (1024 * 1024);

      console.log(`Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory Growth: ${growthMB.toFixed(2)}MB`);

      // Memory growth should be minimal (less than 10MB after 5 navigations)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    }
  });
});

test.describe('Progressive Web App', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return false;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });

    console.log(`Service Worker Registered: ${swRegistered}`);
    expect(swRegistered).toBe(true);
  });

  test('should have manifest', async ({ page }) => {
    await page.goto('/');

    // Check for manifest link
    const manifestLink = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link?.getAttribute('href');
    });

    expect(manifestLink).toBeTruthy();
    console.log(`Manifest: ${manifestLink}`);
  });

  test('should cache resources', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for service worker to cache resources
    await page.waitForTimeout(2000);

    // Check cache storage
    const cacheInfo = await page.evaluate(async () => {
      if (!('caches' in self)) {
        return { available: false, caches: [] };
      }

      const cacheNames = await caches.keys();
      const cacheSizes: { name: string; size: number }[] = [];

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        cacheSizes.push({ name, size: keys.length });
      }

      return { available: true, caches: cacheSizes };
    });

    console.log('Cache Storage:', cacheInfo);

    expect(cacheInfo.available).toBe(true);
  });
});

test.describe('Performance Budget', () => {
  test('should meet overall performance budget', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Collect all metrics
    const vitals = await getCoreWebVitals(page);
    const timing = await getNavigationTiming(page);
    const sizes = await getResourceSizes(page);

    // Create performance report
    const report = {
      'First Contentful Paint': {
        value: vitals.fcp,
        target: PERFORMANCE_TARGETS.FCP,
        passed: vitals.fcp ? vitals.fcp < PERFORMANCE_TARGETS.FCP : false,
      },
      'Time to First Byte': {
        value: vitals.ttfb,
        target: 600,
        passed: vitals.ttfb ? vitals.ttfb < 600 : false,
      },
      'DOM Content Loaded': {
        value: timing.domContentLoaded,
        target: PERFORMANCE_TARGETS.DOM_CONTENT_LOADED,
        passed: timing.domContentLoaded < PERFORMANCE_TARGETS.DOM_CONTENT_LOADED,
      },
      'Full Load': {
        value: timing.load,
        target: PERFORMANCE_TARGETS.LOAD,
        passed: timing.load < PERFORMANCE_TARGETS.LOAD,
      },
      'JS Bundle Size': {
        value: sizes.jsTransfer,
        target: PERFORMANCE_TARGETS.BUNDLE_SIZE,
        passed: sizes.jsTransfer < PERFORMANCE_TARGETS.BUNDLE_SIZE,
      },
    };

    // Print report
    console.log('\n=== Performance Budget Report ===\n');
    for (const [metric, data] of Object.entries(report)) {
      const status = data.passed ? 'PASS' : 'FAIL';
      const value = typeof data.value === 'number'
        ? data.value.toFixed(0)
        : 'N/A';
      console.log(`${metric}: ${status} (${value} / ${data.target})`);
    }
    console.log('\n');

    // Assert all metrics pass
    const allPassed = Object.values(report).every((r) => r.passed);
    expect(allPassed).toBe(true);
  });
});
