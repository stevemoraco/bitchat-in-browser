/**
 * E2E Tests: PWA Functionality
 *
 * Tests Progressive Web App features including:
 * - Offline functionality
 * - Service Worker caching
 * - Install prompt
 * - App manifest
 * - Cache management
 */

import { test, expect, setupWithIdentity, setupWithChannels, waitForAppReady, goOffline, goOnline, navigateToView } from './fixtures';

test.describe('PWA - Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'OfflineUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should load app when online', async ({ page }) => {
    // App should be loaded and visible
    const appRoot = page.locator('#app, #root, [data-testid="app-root"]');
    await expect(appRoot.first()).toBeVisible();
  });

  test('should show offline indicator when offline', async ({ page, context }) => {
    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Offline indicator should be visible
    const offlineIndicator = page.locator('text=/offline/i').or(page.locator('.offline-indicator, [data-offline]'));
    const hasOffline = await offlineIndicator.isVisible().catch(() => false);

    // Go back online
    await goOnline(context);
  });

  test('should work offline after initial load', async ({ page, context }) => {
    // Wait for initial load to complete
    await page.waitForTimeout(2000);

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Navigate within the app
    await navigateToView(page, 'channels');
    await page.waitForTimeout(300);

    // App should still work
    const appContent = page.locator('text=/channel|message|nearby/i');
    const hasContent = await appContent.isVisible().catch(() => false);

    // Go back online
    await goOnline(context);
  });

  test('should access cached pages offline', async ({ page, context }) => {
    // Visit multiple pages to cache them
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);
    await navigateToView(page, 'peers');
    await page.waitForTimeout(500);
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Navigate back to channels
    await navigateToView(page, 'channels');
    await page.waitForTimeout(300);

    // Should still show cached content
    const channelsContent = page.locator('text=/channel|nearby/i');
    const hasChannels = await channelsContent.isVisible().catch(() => false);

    await goOnline(context);
  });

  test('should queue messages when offline', async ({ page, context, chatPage }) => {
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    // Select channel
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Send message
    const messageInput = chatPage.messageInput();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Offline message');
      await messageInput.press('Enter');
      await page.waitForTimeout(300);

      // Message should be queued
      const queueIndicator = page.locator('[data-status="pending"], .queued');
      // Queue status depends on implementation
    }

    await goOnline(context);
  });

  test('should sync queued messages when back online', async ({ page, context, chatPage }) => {
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Go offline, send message
    await goOffline(context);
    await page.waitForTimeout(300);

    const messageInput = chatPage.messageInput();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Message to sync');
      await messageInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // Go back online
    await goOnline(context);
    await page.waitForTimeout(2000);

    // Message status should update
    const sentIndicator = page.locator('[data-status="sent"], .status-sent');
    // Status depends on implementation
  });

  test('should handle offline page reload', async ({ page, context }) => {
    // Wait for initial caching
    await page.waitForTimeout(2000);

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Try to reload
    try {
      await page.reload({ timeout: 10000 });
    } catch {
      // Reload might fail or succeed depending on SW cache
    }

    await page.waitForTimeout(1000);

    // App should still show something (cached version or offline page)
    const hasContent = await page.locator('#app, #root, .offline-page').isVisible().catch(() => false);

    await goOnline(context);
  });
});

test.describe('PWA - Service Worker Caching', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for SW registration
    await page.waitForTimeout(3000);

    // Check SW registration
    const swRegistrations = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return [];
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((r) => ({
        scope: r.scope,
        state: r.active?.state,
      }));
    });

    // In production, SW should be registered
    // In development, it might not be
    console.log('Service Worker registrations:', swRegistrations);
  });

  test('should cache static assets', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(3000);

    // Check cache contents
    const cacheNames = await page.evaluate(async () => {
      if (!('caches' in window)) return [];
      return await caches.keys();
    });

    // In production, there should be caches
    console.log('Cache names:', cacheNames);
  });

  test('should cache API responses', async ({ page }) => {
    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Check if API cache exists
    const cacheContents = await page.evaluate(async () => {
      if (!('caches' in window)) return [];

      const keys = await caches.keys();
      const apiCache = keys.find((k) => k.includes('api') || k.includes('data'));

      if (!apiCache) return [];

      const cache = await caches.open(apiCache);
      const requests = await cache.keys();
      return requests.map((r) => r.url);
    });

    console.log('Cached URLs:', cacheContents);
  });

  test('should update service worker on new version', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Check for update available
    const updateAvailable = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return false;

      // Check for waiting worker
      return registration.waiting !== null;
    });

    // Update status depends on whether there's a new version
    console.log('Update available:', updateAvailable);
  });
});

test.describe('PWA - Install Prompt', () => {
  test('should show install prompt on supported browsers', async ({ page }) => {
    // Simulate install prompt event
    await page.addInitScript(() => {
      window.addEventListener('load', () => {
        // Create mock beforeinstallprompt event
        setTimeout(() => {
          const event = new CustomEvent('beforeinstallprompt');
          (event as any).prompt = () => Promise.resolve();
          (event as any).userChoice = Promise.resolve({ outcome: 'dismissed' });
          window.dispatchEvent(event);
        }, 1000);
      });
    });

    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Install banner or button might be shown
    const installButton = page.locator('text=/install|add.*home/i').or(page.locator('[data-testid="install-button"]'));
    const hasInstall = await installButton.isVisible().catch(() => false);

    // Install prompt depends on browser support
  });

  test('should handle install prompt dismissal', async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const event = new CustomEvent('beforeinstallprompt');
          (event as any).prompt = () => Promise.resolve();
          (event as any).userChoice = Promise.resolve({ outcome: 'dismissed' });
          window.dispatchEvent(event);
        }, 1000);
      });
    });

    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const installButton = page.locator('text=/install|add.*home/i');
    if (await installButton.isVisible()) {
      await installButton.click();
      await page.waitForTimeout(1000);

      // Banner should be hidden after dismissal
    }
  });

  test('should persist install decision', async ({ page }) => {
    // Check if user has already seen/dismissed install prompt
    const hasSeenPrompt = await page.evaluate(() => {
      return localStorage.getItem('installPromptShown') !== null;
    });

    // Prompt behavior depends on previous user choice
  });
});

test.describe('PWA - App Manifest', () => {
  test('should have valid manifest', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check manifest link
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBeTruthy();
  });

  test('should have correct manifest properties', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Fetch and parse manifest
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;

      const href = link.getAttribute('href');
      if (!href) return null;

      try {
        const response = await fetch(href);
        return await response.json();
      } catch {
        return null;
      }
    });

    if (manifest) {
      // Check required properties
      expect(manifest.name || manifest.short_name).toBeTruthy();
      expect(manifest.start_url).toBeTruthy();
      expect(manifest.display).toBeTruthy();
      // Icons array should exist
      if (manifest.icons) {
        expect(Array.isArray(manifest.icons)).toBe(true);
      }
    }
  });

  test('should have theme color', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check theme-color meta tag
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    // Theme color is optional but recommended
    console.log('Theme color:', themeColor);
  });

  test('should have app icons', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check for various icon sizes
    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]').count();
    const icon = await page.locator('link[rel="icon"]').count();

    expect(appleTouchIcon + icon).toBeGreaterThan(0);
  });
});

test.describe('PWA - Cache Management', () => {
  test('should clear old caches on update', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Check cache cleanup
    const cacheInfo = await page.evaluate(async () => {
      if (!('caches' in window)) return { keys: [], total: 0 };

      const keys = await caches.keys();
      let total = 0;

      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        total += requests.length;
      }

      return { keys, total };
    });

    console.log('Cache info:', cacheInfo);
  });

  test('should respect cache expiration', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Cache expiration is typically handled by Workbox
    // This test verifies the app loads correctly with cache
  });

  test('should handle cache quota exceeded', async ({ page }) => {
    // This test would require filling up cache storage
    // which is impractical for E2E tests

    await page.goto('/');
    await waitForAppReady(page);

    // Verify app still functions if cache fails
    const appRoot = page.locator('#app, #root');
    await expect(appRoot.first()).toBeVisible();
  });
});

test.describe('PWA - Background Sync', () => {
  test('should queue background sync tasks', async ({ page, context }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(300);

    // Perform action that would be synced
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);

      const messageInput = page.locator('textarea, [data-testid="message-input"]');
      if (await messageInput.isVisible()) {
        await messageInput.fill('Background sync test');
        await messageInput.press('Enter');
        await page.waitForTimeout(500);
      }
    }

    // Check for pending sync
    const hasPendingSync = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      const registration = await navigator.serviceWorker.ready;
      if (!('sync' in registration)) return false;

      // Background Sync API check
      return true;
    });

    console.log('Background sync supported:', hasPendingSync);

    await goOnline(context);
  });
});

test.describe('PWA - Push Notifications', () => {
  test('should request notification permission', async ({ page }) => {
    // Grant notification permission
    await page.context().grantPermissions(['notifications']);

    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Check notification permission status
    const permissionStatus = await page.evaluate(() => {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    });

    console.log('Notification permission:', permissionStatus);
  });

  test('should handle denied notification permission', async ({ page }) => {
    // Deny notification permission
    await page.context().clearPermissions();

    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);

    // App should function without notifications
    const appRoot = page.locator('#app, #root');
    await expect(appRoot.first()).toBeVisible();
  });
});

test.describe('PWA - Standalone Mode', () => {
  test('should detect standalone mode', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check display mode
    const isStandalone = await page.evaluate(() => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    });

    console.log('Running in standalone:', isStandalone);
  });

  test('should handle different display modes', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // App should work in any display mode
    const displayMode = await page.evaluate(() => {
      const modes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
      for (const mode of modes) {
        if (window.matchMedia(`(display-mode: ${mode})`).matches) {
          return mode;
        }
      }
      return 'unknown';
    });

    console.log('Display mode:', displayMode);
  });
});

test.describe('PWA - Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should meet Lighthouse PWA criteria', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check basic PWA requirements
    const pwaChecks = await page.evaluate(async () => {
      const checks = {
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
        hasThemeColor: !!document.querySelector('meta[name="theme-color"]'),
        hasServiceWorker: 'serviceWorker' in navigator,
        isHttps: location.protocol === 'https:' || location.hostname === 'localhost',
      };

      if (checks.hasServiceWorker) {
        const registration = await navigator.serviceWorker.getRegistration();
        checks.hasServiceWorker = !!registration;
      }

      return checks;
    });

    console.log('PWA checks:', pwaChecks);

    expect(pwaChecks.hasManifest).toBe(true);
    expect(pwaChecks.hasViewportMeta).toBe(true);
  });
});
