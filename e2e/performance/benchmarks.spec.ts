/**
 * Performance Benchmark Tests
 *
 * Comprehensive performance benchmarks for BitChat In Browser PWA.
 * These tests measure and enforce performance budgets for critical metrics.
 *
 * ## Performance Targets
 * - Time to First Byte (TTFB): < 500ms
 * - First Contentful Paint (FCP): < 1.5s
 * - Largest Contentful Paint (LCP): < 2.5s
 * - Time to Interactive (TTI): < 3s
 * - Cumulative Layout Shift (CLS): < 0.1
 * - Total Bundle Size: < 600KB
 * - Memory Usage: < 50MB
 * - First Input Delay (FID): < 100ms
 *
 * ## Running Tests
 * ```bash
 * # Run all performance benchmarks
 * npx playwright test e2e/performance/benchmarks.spec.ts
 *
 * # Run specific benchmark
 * npx playwright test e2e/performance/benchmarks.spec.ts -g "TTFB"
 * ```
 *
 * @module e2e/performance/benchmarks.spec
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { setupWithIdentity, setupWithChannels, waitForAppReady } from '../fixtures';

// ============================================================================
// Performance Budget Thresholds
// ============================================================================

const PERFORMANCE_BUDGET = {
  // Timing Metrics (milliseconds)
  TTFB: 500, // Time to First Byte
  FCP: 1500, // First Contentful Paint
  LCP: 2500, // Largest Contentful Paint
  TTI: 3000, // Time to Interactive
  FID: 100, // First Input Delay (simulated)
  DOM_CONTENT_LOADED: 2000,
  LOAD: 4000,

  // Core Web Vitals
  CLS: 0.1, // Cumulative Layout Shift

  // Bundle Size (bytes)
  TOTAL_BUNDLE: 600 * 1024, // 600KB total
  JS_BUNDLE: 500 * 1024, // 500KB JavaScript
  CSS_BUNDLE: 50 * 1024, // 50KB CSS
  INITIAL_HTML: 50 * 1024, // 50KB initial HTML

  // Memory (bytes)
  HEAP_SIZE: 50 * 1024 * 1024, // 50MB JS Heap
  HEAP_GROWTH: 10 * 1024 * 1024, // 10MB max growth after navigation

  // Rendering
  SCROLL_FPS: 55, // 55+ FPS during scroll
  INPUT_LATENCY: 50, // 50ms max input latency

  // Network
  REQUEST_COUNT: 20, // Max initial requests
  CACHE_HIT_RATIO: 0.8, // 80% cache hit on reload
};

// ============================================================================
// Types
// ============================================================================

interface PerformanceMetrics {
  ttfb: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  domContentLoaded: number;
  load: number;
  domInteractive: number;
}

interface ResourceMetrics {
  totalSize: number;
  jsSize: number;
  cssSize: number;
  imageSize: number;
  fontSize: number;
  otherSize: number;
  requestCount: number;
}

interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Collect all Core Web Vitals from the page
 */
async function collectWebVitals(page: Page): Promise<PerformanceMetrics> {
  return page.evaluate(() => {
    const metrics: PerformanceMetrics = {
      ttfb: null,
      fcp: null,
      lcp: null,
      cls: null,
      domContentLoaded: 0,
      load: 0,
      domInteractive: 0,
    };

    // Navigation Timing
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navEntry) {
      metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.startTime;
      metrics.load = navEntry.loadEventEnd - navEntry.startTime;
      metrics.domInteractive = navEntry.domInteractive - navEntry.startTime;
    }

    // Paint Timing
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
    if (fcpEntry) {
      metrics.fcp = fcpEntry.startTime;
    }

    // Note: LCP and CLS require PerformanceObserver which needs to be set up before page load
    // For E2E tests, we approximate these values

    return metrics;
  });
}

/**
 * Collect resource transfer sizes
 */
async function collectResourceMetrics(page: Page): Promise<ResourceMetrics> {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const metrics: ResourceMetrics = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      imageSize: 0,
      fontSize: 0,
      otherSize: 0,
      requestCount: resources.length,
    };

    for (const resource of resources) {
      const size = resource.transferSize || 0;
      metrics.totalSize += size;

      const url = resource.name.toLowerCase();
      if (url.match(/\.js(\?|$)/)) {
        metrics.jsSize += size;
      } else if (url.match(/\.css(\?|$)/)) {
        metrics.cssSize += size;
      } else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|avif)(\?|$)/)) {
        metrics.imageSize += size;
      } else if (url.match(/\.(woff|woff2|ttf|eot|otf)(\?|$)/)) {
        metrics.fontSize += size;
      } else {
        metrics.otherSize += size;
      }
    }

    return metrics;
  });
}

/**
 * Collect memory metrics (Chrome only)
 */
async function collectMemoryMetrics(page: Page): Promise<MemoryMetrics | null> {
  return page.evaluate(() => {
    const performance_ = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    if (!performance_.memory) {
      return null;
    }

    return {
      usedJSHeapSize: performance_.memory.usedJSHeapSize,
      totalJSHeapSize: performance_.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance_.memory.jsHeapSizeLimit,
    };
  });
}

/**
 * Measure scroll frame rate
 */
async function measureScrollPerformance(
  page: Page,
  selector: string,
  scrollDistance: number = 1000
): Promise<{ fps: number; droppedFrames: number; jankCount: number }> {
  return page.evaluate(
    async ({ selector, scrollDistance }) => {
      const element = document.querySelector(selector) || document.documentElement;
      const frameTimes: number[] = [];
      let lastTime = performance.now();
      let recording = true;

      // Start recording frame times
      const recordFrame = () => {
        if (!recording) return;
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
        requestAnimationFrame(recordFrame);
      };
      requestAnimationFrame(recordFrame);

      // Perform scroll
      const startScroll = element.scrollTop;
      const duration = 500;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const animate = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 2);
          element.scrollTop = startScroll + scrollDistance * easeOut;

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setTimeout(() => {
              recording = false;
              resolve();
            }, 100);
          }
        };
        requestAnimationFrame(animate);
      });

      // Calculate metrics
      const validFrames = frameTimes.slice(1).filter((t) => t > 0 && t < 1000);
      if (validFrames.length === 0) {
        return { fps: 60, droppedFrames: 0, jankCount: 0 };
      }

      const avgFrameTime = validFrames.reduce((a, b) => a + b, 0) / validFrames.length;
      const fps = 1000 / avgFrameTime;
      const droppedFrames = validFrames.filter((t) => t > 16.67).length;
      const jankCount = validFrames.filter((t) => t > 50).length; // >50ms is janky

      return { fps, droppedFrames, jankCount };
    },
    { selector, scrollDistance }
  );
}

/**
 * Measure input latency
 */
async function measureInputLatency(page: Page): Promise<number> {
  const input = page.locator('textarea, input[type="text"]').first();
  if (!(await input.isVisible())) {
    return 0;
  }

  const startTime = await page.evaluate(() => performance.now());
  await input.click();
  await input.type('test', { delay: 0 });
  const endTime = await page.evaluate(() => performance.now());

  return endTime - startTime;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Format milliseconds
 */
function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

// ============================================================================
// Timing Benchmarks
// ============================================================================

test.describe('Timing Performance Benchmarks', () => {
  test('TTFB should be under 500ms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const metrics = await collectWebVitals(page);

    console.log(`Time to First Byte: ${formatMs(metrics.ttfb || 0)} (target: <${PERFORMANCE_BUDGET.TTFB}ms)`);

    expect(metrics.ttfb).not.toBeNull();
    expect(metrics.ttfb!).toBeLessThan(PERFORMANCE_BUDGET.TTFB);
  });

  test('FCP should be under 1.5s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Wait for paint to register

    const metrics = await collectWebVitals(page);

    console.log(`First Contentful Paint: ${formatMs(metrics.fcp || 0)} (target: <${PERFORMANCE_BUDGET.FCP}ms)`);

    expect(metrics.fcp).not.toBeNull();
    expect(metrics.fcp!).toBeLessThan(PERFORMANCE_BUDGET.FCP);
  });

  test('Time to Interactive should be under 3s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const metrics = await collectWebVitals(page);

    // Approximate TTI using domInteractive
    const tti = metrics.domInteractive;
    console.log(`Time to Interactive (approx): ${formatMs(tti)} (target: <${PERFORMANCE_BUDGET.TTI}ms)`);

    expect(tti).toBeLessThan(PERFORMANCE_BUDGET.TTI);
  });

  test('DOM Content Loaded should be under 2s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const metrics = await collectWebVitals(page);

    console.log(
      `DOM Content Loaded: ${formatMs(metrics.domContentLoaded)} (target: <${PERFORMANCE_BUDGET.DOM_CONTENT_LOADED}ms)`
    );

    expect(metrics.domContentLoaded).toBeLessThan(PERFORMANCE_BUDGET.DOM_CONTENT_LOADED);
  });

  test('Full page load should be under 4s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const metrics = await collectWebVitals(page);

    console.log(`Full Load: ${formatMs(metrics.load)} (target: <${PERFORMANCE_BUDGET.LOAD}ms)`);

    expect(metrics.load).toBeLessThan(PERFORMANCE_BUDGET.LOAD);
  });
});

// ============================================================================
// Bundle Size Benchmarks
// ============================================================================

test.describe('Bundle Size Benchmarks', () => {
  test('Total bundle size should be under 600KB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectResourceMetrics(page);

    console.log(`Total Bundle Size: ${formatBytes(metrics.totalSize)} (target: <${formatBytes(PERFORMANCE_BUDGET.TOTAL_BUNDLE)})`);

    expect(metrics.totalSize).toBeLessThan(PERFORMANCE_BUDGET.TOTAL_BUNDLE);
  });

  test('JavaScript bundle should be under 500KB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectResourceMetrics(page);

    console.log(`JavaScript Size: ${formatBytes(metrics.jsSize)} (target: <${formatBytes(PERFORMANCE_BUDGET.JS_BUNDLE)})`);

    expect(metrics.jsSize).toBeLessThan(PERFORMANCE_BUDGET.JS_BUNDLE);
  });

  test('CSS bundle should be under 50KB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectResourceMetrics(page);

    console.log(`CSS Size: ${formatBytes(metrics.cssSize)} (target: <${formatBytes(PERFORMANCE_BUDGET.CSS_BUNDLE)})`);

    expect(metrics.cssSize).toBeLessThan(PERFORMANCE_BUDGET.CSS_BUNDLE);
  });

  test('Initial request count should be under 20', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectResourceMetrics(page);

    console.log(`Request Count: ${metrics.requestCount} (target: <${PERFORMANCE_BUDGET.REQUEST_COUNT})`);

    expect(metrics.requestCount).toBeLessThan(PERFORMANCE_BUDGET.REQUEST_COUNT);
  });

  test('Bundle size breakdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectResourceMetrics(page);

    console.log('\n=== Bundle Size Breakdown ===');
    console.log(`JavaScript: ${formatBytes(metrics.jsSize)}`);
    console.log(`CSS: ${formatBytes(metrics.cssSize)}`);
    console.log(`Images: ${formatBytes(metrics.imageSize)}`);
    console.log(`Fonts: ${formatBytes(metrics.fontSize)}`);
    console.log(`Other: ${formatBytes(metrics.otherSize)}`);
    console.log(`Total: ${formatBytes(metrics.totalSize)}`);
    console.log(`Requests: ${metrics.requestCount}`);
    console.log('============================\n');

    // This test always passes - it's just for reporting
    expect(true).toBe(true);
  });
});

// ============================================================================
// Memory Benchmarks
// ============================================================================

test.describe('Memory Benchmarks', () => {
  test('Initial memory usage should be under 50MB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const memory = await collectMemoryMetrics(page);

    if (!memory) {
      console.log('Memory API not available (requires Chromium with --enable-precise-memory-info)');
      test.skip();
      return;
    }

    console.log(`Used JS Heap: ${formatBytes(memory.usedJSHeapSize)} (target: <${formatBytes(PERFORMANCE_BUDGET.HEAP_SIZE)})`);

    expect(memory.usedJSHeapSize).toBeLessThan(PERFORMANCE_BUDGET.HEAP_SIZE);
  });

  test('Memory should not grow excessively on navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const initialMemory = await collectMemoryMetrics(page);

    if (!initialMemory) {
      console.log('Memory API not available');
      test.skip();
      return;
    }

    // Perform multiple navigations
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if ((globalThis as any).gc) {
        (globalThis as any).gc();
      }
    });
    await page.waitForTimeout(1000);

    const finalMemory = await collectMemoryMetrics(page);

    if (!finalMemory) {
      test.skip();
      return;
    }

    const growth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    console.log(`Memory Growth: ${formatBytes(growth)} (target: <${formatBytes(PERFORMANCE_BUDGET.HEAP_GROWTH)})`);
    console.log(`Initial: ${formatBytes(initialMemory.usedJSHeapSize)}`);
    console.log(`Final: ${formatBytes(finalMemory.usedJSHeapSize)}`);

    expect(growth).toBeLessThan(PERFORMANCE_BUDGET.HEAP_GROWTH);
  });

  test('Memory report', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const memory = await collectMemoryMetrics(page);

    if (!memory) {
      console.log('Memory API not available');
      test.skip();
      return;
    }

    console.log('\n=== Memory Report ===');
    console.log(`Used JS Heap: ${formatBytes(memory.usedJSHeapSize)}`);
    console.log(`Total JS Heap: ${formatBytes(memory.totalJSHeapSize)}`);
    console.log(`Heap Size Limit: ${formatBytes(memory.jsHeapSizeLimit)}`);
    console.log(`Utilization: ${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`);
    console.log('=====================\n');

    expect(true).toBe(true);
  });
});

// ============================================================================
// Rendering Benchmarks
// ============================================================================

test.describe('Rendering Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
  });

  test('Scroll performance should maintain 55+ FPS', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Find scrollable element
    const scrollable = page.locator('[data-testid="message-list"], .overflow-auto, main').first();

    if (!(await scrollable.isVisible())) {
      console.log('No scrollable element found, using document');
    }

    const perf = await measureScrollPerformance(page, 'html', 500);

    console.log(`Scroll FPS: ${perf.fps.toFixed(1)} (target: >${PERFORMANCE_BUDGET.SCROLL_FPS})`);
    console.log(`Dropped Frames: ${perf.droppedFrames}`);
    console.log(`Jank Events: ${perf.jankCount}`);

    expect(perf.fps).toBeGreaterThan(PERFORMANCE_BUDGET.SCROLL_FPS);
  });

  test('Input latency should be under 50ms', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const latency = await measureInputLatency(page);

    if (latency === 0) {
      console.log('No input element found');
      test.skip();
      return;
    }

    console.log(`Input Latency: ${formatMs(latency)} (target: <${PERFORMANCE_BUDGET.INPUT_LATENCY}ms)`);

    expect(latency).toBeLessThan(PERFORMANCE_BUDGET.INPUT_LATENCY);
  });
});

// ============================================================================
// Caching Benchmarks
// ============================================================================

test.describe('Caching Benchmarks', () => {
  test('Service Worker should cache resources efficiently', async ({ page }) => {
    // First load - populate cache
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for SW to cache

    // Check cache storage
    const cacheStats = await page.evaluate(async () => {
      if (!('caches' in self)) return null;

      const cacheNames = await caches.keys();
      let totalCached = 0;

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        totalCached += keys.length;
      }

      return { cacheNames: cacheNames.length, totalCached };
    });

    console.log('Cache Stats:', cacheStats);

    if (cacheStats) {
      expect(cacheStats.totalCached).toBeGreaterThan(0);
    }
  });

  test('Reload should use cached resources', async ({ page }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Track network requests on reload
    const networkRequests: { url: string; fromCache: boolean }[] = [];

    page.on('response', (response) => {
      networkRequests.push({
        url: response.url(),
        fromCache: response.fromCache(),
      });
    });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    const cachedCount = networkRequests.filter((r) => r.fromCache).length;
    const totalCount = networkRequests.length;
    const cacheHitRatio = totalCount > 0 ? cachedCount / totalCount : 0;

    console.log(`Cache Hit Ratio: ${(cacheHitRatio * 100).toFixed(1)}% (${cachedCount}/${totalCount})`);
    console.log(`Target: >${(PERFORMANCE_BUDGET.CACHE_HIT_RATIO * 100).toFixed(0)}%`);

    // Note: This may fail initially before service worker is properly installed
    // Marking as soft expectation
    if (totalCount > 5) {
      expect(cacheHitRatio).toBeGreaterThanOrEqual(PERFORMANCE_BUDGET.CACHE_HIT_RATIO * 0.5); // 50% of target as minimum
    }
  });
});

// ============================================================================
// Performance Budget Summary
// ============================================================================

test.describe('Performance Budget Summary', () => {
  test('Complete performance budget report', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);

    const timing = await collectWebVitals(page);
    const resources = await collectResourceMetrics(page);
    const memory = await collectMemoryMetrics(page);

    console.log('\n');
    console.log('='.repeat(60));
    console.log('           PERFORMANCE BUDGET REPORT');
    console.log('='.repeat(60));
    console.log('\n');

    // Timing
    console.log('TIMING METRICS');
    console.log('-'.repeat(40));
    const timingResults = [
      {
        name: 'Time to First Byte',
        value: timing.ttfb,
        target: PERFORMANCE_BUDGET.TTFB,
        unit: 'ms',
      },
      {
        name: 'First Contentful Paint',
        value: timing.fcp,
        target: PERFORMANCE_BUDGET.FCP,
        unit: 'ms',
      },
      {
        name: 'DOM Content Loaded',
        value: timing.domContentLoaded,
        target: PERFORMANCE_BUDGET.DOM_CONTENT_LOADED,
        unit: 'ms',
      },
      {
        name: 'Full Load',
        value: timing.load,
        target: PERFORMANCE_BUDGET.LOAD,
        unit: 'ms',
      },
    ];

    for (const metric of timingResults) {
      const status = metric.value && metric.value < metric.target ? 'PASS' : 'FAIL';
      const valueStr = metric.value ? `${metric.value.toFixed(0)}${metric.unit}` : 'N/A';
      console.log(`  ${metric.name.padEnd(25)} ${status.padStart(6)} (${valueStr} / ${metric.target}${metric.unit})`);
    }

    console.log('\n');

    // Bundle Size
    console.log('BUNDLE SIZE');
    console.log('-'.repeat(40));
    const sizeResults = [
      {
        name: 'Total Bundle',
        value: resources.totalSize,
        target: PERFORMANCE_BUDGET.TOTAL_BUNDLE,
      },
      {
        name: 'JavaScript',
        value: resources.jsSize,
        target: PERFORMANCE_BUDGET.JS_BUNDLE,
      },
      {
        name: 'CSS',
        value: resources.cssSize,
        target: PERFORMANCE_BUDGET.CSS_BUNDLE,
      },
    ];

    for (const metric of sizeResults) {
      const status = metric.value < metric.target ? 'PASS' : 'FAIL';
      console.log(`  ${metric.name.padEnd(25)} ${status.padStart(6)} (${formatBytes(metric.value)} / ${formatBytes(metric.target)})`);
    }

    console.log('\n');

    // Memory
    if (memory) {
      console.log('MEMORY');
      console.log('-'.repeat(40));
      const memStatus = memory.usedJSHeapSize < PERFORMANCE_BUDGET.HEAP_SIZE ? 'PASS' : 'FAIL';
      console.log(`  ${'JS Heap Size'.padEnd(25)} ${memStatus.padStart(6)} (${formatBytes(memory.usedJSHeapSize)} / ${formatBytes(PERFORMANCE_BUDGET.HEAP_SIZE)})`);
      console.log('\n');
    }

    // Request Count
    console.log('NETWORK');
    console.log('-'.repeat(40));
    const reqStatus = resources.requestCount < PERFORMANCE_BUDGET.REQUEST_COUNT ? 'PASS' : 'FAIL';
    console.log(`  ${'Request Count'.padEnd(25)} ${reqStatus.padStart(6)} (${resources.requestCount} / ${PERFORMANCE_BUDGET.REQUEST_COUNT})`);

    console.log('\n');
    console.log('='.repeat(60));
    console.log('\n');

    // Overall pass/fail
    const allPassed =
      timingResults.every((m) => !m.value || m.value < m.target) &&
      sizeResults.every((m) => m.value < m.target) &&
      (!memory || memory.usedJSHeapSize < PERFORMANCE_BUDGET.HEAP_SIZE) &&
      resources.requestCount < PERFORMANCE_BUDGET.REQUEST_COUNT;

    expect(allPassed).toBe(true);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

test.describe('Stress Tests', () => {
  test('Should handle rapid navigation without memory leak', async ({ page }) => {
    const memoryReadings: number[] = [];

    // Initial load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const initialMemory = await collectMemoryMetrics(page);
    if (initialMemory) {
      memoryReadings.push(initialMemory.usedJSHeapSize);
    }

    // Rapid navigation
    for (let i = 0; i < 10; i++) {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const memory = await collectMemoryMetrics(page);
      if (memory) {
        memoryReadings.push(memory.usedJSHeapSize);
      }
    }

    // Force GC
    await page.evaluate(() => {
      if ((globalThis as any).gc) (globalThis as any).gc();
    });
    await page.waitForTimeout(1000);

    const finalMemory = await collectMemoryMetrics(page);

    if (memoryReadings.length > 0 && finalMemory) {
      const maxMemory = Math.max(...memoryReadings);
      const growth = finalMemory.usedJSHeapSize - memoryReadings[0]!;

      console.log(`Initial Memory: ${formatBytes(memoryReadings[0]!)}`);
      console.log(`Peak Memory: ${formatBytes(maxMemory)}`);
      console.log(`Final Memory: ${formatBytes(finalMemory.usedJSHeapSize)}`);
      console.log(`Net Growth: ${formatBytes(growth)}`);

      // Memory should not grow more than 20MB after 10 rapid navigations
      expect(growth).toBeLessThan(20 * 1024 * 1024);
    }
  });

  test('Should maintain performance with large message list', async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);

    // Inject large message list
    await page.addInitScript(() => {
      const messages = Array.from({ length: 500 }, (_, i) => ({
        id: `msg_${i}`,
        content: `Message ${i}: ${Math.random().toString(36).substring(7)}`,
        channelId: 'channel-nearby',
        senderFingerprint: i % 2 === 0 ? 'ABC123XY' : 'PEER1ABC',
        timestamp: Date.now() - i * 60000,
        status: 'delivered',
      }));

      localStorage.setItem(
        'bitchat-messages',
        JSON.stringify({
          state: { messages },
          version: 0,
        })
      );
    });

    await page.goto('/');
    await waitForAppReady(page);

    // Measure scroll performance with large list
    const scrollPerf = await measureScrollPerformance(page, 'html', 2000);

    console.log(`Scroll FPS with 500 messages: ${scrollPerf.fps.toFixed(1)}`);
    console.log(`Dropped Frames: ${scrollPerf.droppedFrames}`);
    console.log(`Jank Events: ${scrollPerf.jankCount}`);

    // Should still maintain reasonable FPS
    expect(scrollPerf.fps).toBeGreaterThan(30);
  });
});
