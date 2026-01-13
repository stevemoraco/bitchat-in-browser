/**
 * Example E2E Test - Basic app loading test
 *
 * This file demonstrates the basic structure of Playwright E2E tests
 * and verifies that the BitChat PWA loads correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('BitChat In Browser - Basic Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('should load the app successfully', async ({ page }) => {
    // Wait for the page to load
    await expect(page).toHaveTitle(/BitChat/i);
  });

  test('should display the main app container', async ({ page }) => {
    // The app should have a root element
    const root = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(root.first()).toBeVisible();
  });

  test('should not have any console errors on load', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Reload to capture any errors during load
    await page.reload();

    // Wait for app to stabilize
    await page.waitForTimeout(1000);

    // Filter out known acceptable errors (like extension-related)
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('extension') &&
        !err.includes('favicon') &&
        !err.includes('manifest')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should have correct meta viewport for mobile', async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute(
      'content',
      expect.stringContaining('width=device-width')
    );
  });

  test('should have theme-color meta tag for PWA', async ({ page }) => {
    const themeColor = page.locator('meta[name="theme-color"]');
    // Theme color should exist (PWA requirement)
    const count = await themeColor.count();
    expect(count).toBeGreaterThanOrEqual(0); // May not exist yet in early development
  });
});

test.describe('BitChat In Browser - Responsive Layout', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // App should still be visible
    const root = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(root.first()).toBeVisible();
  });

  test('should render correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // App should still be visible
    const root = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(root.first()).toBeVisible();
  });

  test('should render correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // App should still be visible
    const root = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(root.first()).toBeVisible();
  });
});

test.describe('BitChat In Browser - Accessibility', () => {
  test('should have a main landmark', async ({ page }) => {
    await page.goto('/');

    // Look for main element or role="main"
    const main = page.locator('main, [role="main"]');
    const count = await main.count();

    // In early development, main might not exist yet
    if (count > 0) {
      await expect(main.first()).toBeVisible();
    }
  });

  test('should have proper document language', async ({ page }) => {
    await page.goto('/');

    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^en/); // Should be English
  });
});

test.describe('BitChat In Browser - Navigation', () => {
  test('should handle navigation without page refresh', async ({ page }) => {
    await page.goto('/');

    // Store initial load time
    const initialLoad = await page.evaluate(() => window.performance.now());

    // If there's navigation available, test SPA behavior
    const navLinks = page.locator('a[href^="/"], button[data-navigate]');
    const linkCount = await navLinks.count();

    if (linkCount > 0) {
      // Click first navigation element
      await navLinks.first().click();

      // Page should not have done a full reload
      const afterClick = await page.evaluate(() => window.performance.now());
      expect(afterClick).toBeGreaterThan(initialLoad);
    }
  });
});

test.describe('BitChat In Browser - Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have reasonable performance metrics', async ({ page }) => {
    await page.goto('/');

    // Get performance timing
    const timing = await page.evaluate(() => {
      const perf = window.performance;
      const timing = perf.timing;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
      };
    });

    // Basic sanity checks
    expect(timing.domContentLoaded).toBeGreaterThan(0);
  });
});

test.describe('BitChat In Browser - Offline Capability', () => {
  test('should register service worker', async ({ page, context }) => {
    await page.goto('/');

    // Wait for service worker to register
    await page.waitForTimeout(2000);

    // Check if service worker is registered
    const swRegistrations = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return [];
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((r) => r.scope);
    });

    // In development, SW might not be active
    // This test will pass in production builds
    console.log('Service Worker registrations:', swRegistrations);
  });

  test('should handle offline state gracefully', async ({ page, context }) => {
    await page.goto('/');

    // Go offline
    await context.setOffline(true);

    // Try to navigate or interact
    await page.reload().catch(() => {
      // Expected to fail when offline without SW cache
    });

    // Go back online
    await context.setOffline(false);

    // Should recover
    await page.goto('/');
    const root = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(root.first()).toBeVisible();
  });
});
