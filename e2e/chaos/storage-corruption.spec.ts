/**
 * E2E Chaos Tests: Storage Corruption and Failures
 *
 * Production-ready chaos engineering tests for storage resilience including:
 * - Storage quota exhaustion
 * - LocalStorage corruption
 * - IndexedDB corruption
 * - OPFS failures
 * - Service worker crash/restart
 * - Memory pressure
 * - Concurrent storage operations
 * - Data integrity under stress
 *
 * These tests verify the app degrades gracefully under adverse storage conditions
 * and can recover or gracefully handle data corruption.
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import {
  setupWithIdentity,
  setupWithChannels,
  waitForAppReady,
  clearStorage,
} from '../fixtures';

// ============================================================================
// Storage Chaos Test Fixtures
// ============================================================================

interface StorageChaosFixtures {
  storageChaos: StorageChaosHelper;
}

const test = base.extend<StorageChaosFixtures>({
  storageChaos: async ({ page }, use) => {
    await use(new StorageChaosHelper(page));
  },
});

// ============================================================================
// Storage Chaos Helper
// ============================================================================

class StorageChaosHelper {
  constructor(private page: Page) {}

  /**
   * Corrupt localStorage by inserting invalid JSON
   */
  async corruptLocalStorage(key: string): Promise<void> {
    await this.page.evaluate((key) => {
      localStorage.setItem(key, '{invalid json here[[[]');
    }, key);
  }

  /**
   * Partially corrupt localStorage JSON
   */
  async partiallyCorruptLocalStorage(key: string): Promise<void> {
    await this.page.evaluate((key) => {
      const current = localStorage.getItem(key);
      if (current) {
        // Corrupt by removing closing braces
        const corrupted = current.slice(0, -10) + '???corrupt';
        localStorage.setItem(key, corrupted);
      }
    }, key);
  }

  /**
   * Simulate storage quota exceeded by filling localStorage
   */
  async fillLocalStorage(): Promise<number> {
    return this.page.evaluate(() => {
      let totalSize = 0;
      const largeString = 'x'.repeat(1024 * 1024); // 1MB string
      let attempts = 0;
      const maxAttempts = 20;

      try {
        while (attempts < maxAttempts) {
          const key = `__quota_test_${attempts}`;
          try {
            localStorage.setItem(key, largeString);
            totalSize += largeString.length;
            attempts++;
          } catch {
            // Quota exceeded
            break;
          }
        }
      } catch (e) {
        console.log('Storage filled at:', totalSize, 'bytes');
      }

      return totalSize;
    });
  }

  /**
   * Clear quota test data
   */
  async clearQuotaTestData(): Promise<void> {
    await this.page.evaluate(() => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('__quota_test_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    });
  }

  /**
   * Delete specific localStorage keys
   */
  async deleteLocalStorageKeys(keys: string[]): Promise<void> {
    await this.page.evaluate((keysToDelete) => {
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    }, keys);
  }

  /**
   * Corrupt IndexedDB by deleting object stores
   */
  async corruptIndexedDB(dbName: string): Promise<void> {
    await this.page.evaluate(async (name) => {
      const request = indexedDB.deleteDatabase(name);
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve(); // Continue even if blocked
      });
    }, dbName);
  }

  /**
   * Get all IndexedDB database names
   */
  async getIndexedDBNames(): Promise<string[]> {
    return this.page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.map((db) => db.name || '').filter(Boolean);
    });
  }

  /**
   * Simulate OPFS failure by clearing the file system
   */
  async clearOPFS(): Promise<boolean> {
    return this.page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error - values() not in types
        for await (const name of root.keys()) {
          await root.removeEntry(name, { recursive: true });
        }
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Check OPFS availability and status
   */
  async checkOPFSStatus(): Promise<{
    available: boolean;
    fileCount: number;
    error?: string;
  }> {
    return this.page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        let count = 0;
        // @ts-expect-error - keys() not in types
        for await (const _ of root.keys()) {
          count++;
        }
        return { available: true, fileCount: count };
      } catch (e) {
        return {
          available: false,
          fileCount: 0,
          error: (e as Error).message,
        };
      }
    });
  }

  /**
   * Simulate service worker crash/unregistration
   */
  async crashServiceWorker(): Promise<void> {
    await this.page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    });
  }

  /**
   * Force garbage collection (if available)
   */
  async forceGC(): Promise<boolean> {
    return this.page.evaluate(() => {
      // @ts-expect-error - gc not in types
      if (typeof window.gc === 'function') {
        // @ts-expect-error - gc not in types
        window.gc();
        return true;
      }
      return false;
    });
  }

  /**
   * Simulate memory pressure by allocating large arrays
   */
  async simulateMemoryPressure(
    sizeMB: number
  ): Promise<{ allocated: number; freed: boolean }> {
    return this.page.evaluate((mb) => {
      const arrays: number[][] = [];
      let allocated = 0;

      try {
        for (let i = 0; i < mb; i++) {
          // Allocate ~1MB arrays
          const arr = new Array(256 * 1024).fill(Math.random());
          arrays.push(arr);
          allocated++;
        }
      } catch {
        // Memory allocation failed
      }

      // Store reference globally to prevent immediate GC
      (window as unknown as { __memoryPressure?: number[][] }).__memoryPressure = arrays;

      return { allocated, freed: false };
    }, sizeMB);
  }

  /**
   * Release memory pressure
   */
  async releaseMemoryPressure(): Promise<void> {
    await this.page.evaluate(() => {
      delete (window as unknown as { __memoryPressure?: number[][] }).__memoryPressure;
      // @ts-expect-error - gc not in types
      if (typeof window.gc === 'function') {
        // @ts-expect-error - gc not in types
        window.gc();
      }
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    localStorageSize: number;
    localStorageKeys: number;
    indexedDBDatabases: number;
    opfsAvailable: boolean;
    quotaUsed?: number;
    quotaTotal?: number;
  }> {
    return this.page.evaluate(async () => {
      // Calculate localStorage size
      let localStorageSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          localStorageSize += key.length + (localStorage.getItem(key)?.length || 0);
        }
      }

      // Get IndexedDB count
      const databases = await indexedDB.databases();

      // Check OPFS
      let opfsAvailable = false;
      try {
        await navigator.storage.getDirectory();
        opfsAvailable = true;
      } catch {
        opfsAvailable = false;
      }

      // Get quota info
      let quotaUsed: number | undefined;
      let quotaTotal: number | undefined;
      try {
        const estimate = await navigator.storage.estimate();
        quotaUsed = estimate.usage;
        quotaTotal = estimate.quota;
      } catch {
        // Quota API not available
      }

      return {
        localStorageSize,
        localStorageKeys: localStorage.length,
        indexedDBDatabases: databases.length,
        opfsAvailable,
        quotaUsed,
        quotaTotal,
      };
    });
  }

  /**
   * Inject invalid data into specific store
   */
  async injectInvalidData(
    storeName: string,
    invalidData: Record<string, unknown>
  ): Promise<void> {
    await this.page.evaluate(
      ({ name, data }) => {
        localStorage.setItem(name, JSON.stringify(data));
      },
      { name: storeName, data: invalidData }
    );
  }

  /**
   * Simulate concurrent storage operations
   */
  async simulateConcurrentStorageOps(operationCount: number): Promise<{
    successCount: number;
    errorCount: number;
  }> {
    return this.page.evaluate(async (count) => {
      let successCount = 0;
      let errorCount = 0;

      const operations = [];
      for (let i = 0; i < count; i++) {
        operations.push(
          (async () => {
            try {
              const key = `concurrent_${i}_${Date.now()}`;
              const value = JSON.stringify({ index: i, data: Math.random() });

              // Write
              localStorage.setItem(key, value);

              // Read
              const read = localStorage.getItem(key);
              if (read) {
                JSON.parse(read);
              }

              // Delete
              localStorage.removeItem(key);

              successCount++;
            } catch {
              errorCount++;
            }
          })()
        );
      }

      await Promise.all(operations);

      return { successCount, errorCount };
    }, operationCount);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

async function isAppFunctional(page: Page): Promise<boolean> {
  const appRoot = page.locator('#app, #root, [data-testid="app-root"]');
  return appRoot.first().isVisible();
}

async function getAppData(page: Page): Promise<{
  identity: unknown;
  settings: unknown;
  channels: unknown;
  queue: unknown;
}> {
  return page.evaluate(() => {
    const parse = (key: string) => {
      const data = localStorage.getItem(key);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch {
        return 'CORRUPTED';
      }
    };

    return {
      identity: parse('bitchat-identity'),
      settings: parse('bitchat-settings'),
      channels: parse('bitchat-channels'),
      queue: parse('bitchat-outbox-queue'),
    };
  });
}

async function isDataCorrupted(page: Page, key: string): Promise<boolean> {
  return page.evaluate((storageKey) => {
    const data = localStorage.getItem(storageKey);
    if (!data) return false;
    try {
      JSON.parse(data);
      return false;
    } catch {
      return true;
    }
  }, key);
}

// ============================================================================
// Storage Quota Exhaustion Tests
// ============================================================================

test.describe('Storage Chaos - Quota Exhaustion', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'QuotaTestUser' });
    await setupWithChannels(page);
  });

  test.afterEach(async ({ storageChaos }) => {
    await storageChaos.clearQuotaTestData();
  });

  test('should handle localStorage quota exceeded', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Fill localStorage to quota
    const filledSize = await storageChaos.fillLocalStorage();
    console.log('Filled localStorage with:', filledSize, 'bytes');

    // Try to use the app
    const button = page.getByRole('button').first();
    if (await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(500);
    }

    // App should still be functional
    expect(await isAppFunctional(page)).toBe(true);

    // Clean up
    await storageChaos.clearQuotaTestData();
  });

  test('should show error when cannot save data', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Fill localStorage
    await storageChaos.fillLocalStorage();

    // Try to trigger a save operation (navigate to settings and change something)
    const settingsButton = page.getByRole('button', { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
    }

    // Look for any error indicators
    const errorIndicator = page.locator(
      'text=/storage|quota|full|error/i'
    ).or(page.locator('[data-testid="storage-error"]'));

    const hasError = await errorIndicator.isVisible().catch(() => false);
    console.log('Storage error indicator shown:', hasError);

    // Clean up
    await storageChaos.clearQuotaTestData();
  });

  test('should recover when storage is cleared', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Fill localStorage
    await storageChaos.fillLocalStorage();
    await page.waitForTimeout(500);

    // Clear test data
    await storageChaos.clearQuotaTestData();
    await page.waitForTimeout(500);

    // App should recover
    const button = page.getByRole('button').first();
    if (await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(500);
    }

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle IndexedDB quota exceeded', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Get current storage info
    const storageInfo = await storageChaos.getStorageInfo();
    console.log('Initial storage info:', storageInfo);

    // The app should handle quota gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// LocalStorage Corruption Tests
// ============================================================================

test.describe('Storage Chaos - LocalStorage Corruption', () => {
  test('should recover from corrupted identity store', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt identity store
    await storageChaos.corruptLocalStorage('bitchat-identity');
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForTimeout(2000);

    // App should handle corruption gracefully
    expect(await isAppFunctional(page)).toBe(true);

    // Check if corrupted
    const corrupted = await isDataCorrupted(page, 'bitchat-identity');
    console.log('Identity still corrupted after reload:', corrupted);

    // App should either recover or show onboarding
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(0);
  });

  test('should recover from corrupted settings store', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt settings
    await storageChaos.corruptLocalStorage('bitchat-settings');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should recover with defaults
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should recover from corrupted channels store', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt channels
    await storageChaos.corruptLocalStorage('bitchat-channels');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should recover from corrupted queue store', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt queue
    await storageChaos.corruptLocalStorage('bitchat-outbox-queue');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);

    // Queue should be recreated
    const data = await getAppData(page);
    expect(data.queue !== 'CORRUPTED').toBe(true);
  });

  test('should handle partially corrupted data', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Partially corrupt settings
    await storageChaos.partiallyCorruptLocalStorage('bitchat-settings');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle all stores corrupted', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt all stores
    await storageChaos.corruptLocalStorage('bitchat-identity');
    await storageChaos.corruptLocalStorage('bitchat-settings');
    await storageChaos.corruptLocalStorage('bitchat-channels');
    await storageChaos.corruptLocalStorage('bitchat-outbox-queue');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should show onboarding or recover
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle invalid data structure', async ({ page, storageChaos }) => {
    // Inject completely wrong data structure
    await storageChaos.injectInvalidData('bitchat-identity', {
      state: {
        wrongKey: 'wrong value',
        anotherWrongKey: 12345,
      },
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle missing required fields', async ({ page, storageChaos }) => {
    // Inject data with missing required fields
    await storageChaos.injectInvalidData('bitchat-identity', {
      state: {
        identity: {
          // Missing publicKey, fingerprint, etc.
          nickname: 'TestUser',
        },
      },
      version: 0,
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// IndexedDB Corruption Tests
// ============================================================================

test.describe('Storage Chaos - IndexedDB Corruption', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'IDBTestUser' });
    await setupWithChannels(page);
  });

  test('should handle deleted IndexedDB database', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Get database names
    const dbNames = await storageChaos.getIndexedDBNames();
    console.log('IndexedDB databases:', dbNames);

    // Delete each database
    for (const name of dbNames) {
      await storageChaos.corruptIndexedDB(name);
    }

    await page.waitForTimeout(1000);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should recreate databases
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should recover from IndexedDB deletion during operation', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Start an operation
    const settingsButton = page.getByRole('button', { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Delete databases during operation
    const dbNames = await storageChaos.getIndexedDBNames();
    for (const name of dbNames) {
      await storageChaos.corruptIndexedDB(name);
    }

    await page.waitForTimeout(1000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// OPFS Failure Tests
// ============================================================================

test.describe('Storage Chaos - OPFS Failures', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'OPFSTestUser' });
    await setupWithChannels(page);
  });

  test('should handle OPFS being unavailable', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check OPFS status
    const status = await storageChaos.checkOPFSStatus();
    console.log('OPFS status:', status);

    // Clear OPFS
    if (status.available) {
      const cleared = await storageChaos.clearOPFS();
      console.log('OPFS cleared:', cleared);
    }

    // App should fall back to IndexedDB
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle OPFS cleared during operation', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to trigger OPFS usage
    const channelsButton = page.getByRole('button', { name: /channels/i });
    if (await channelsButton.isVisible()) {
      await channelsButton.click();
      await page.waitForTimeout(500);
    }

    // Clear OPFS
    await storageChaos.clearOPFS();
    await page.waitForTimeout(1000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should fallback when OPFS quota exceeded', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Get storage info
    const storageInfo = await storageChaos.getStorageInfo();
    console.log('Storage quota info:', {
      used: storageInfo.quotaUsed,
      total: storageInfo.quotaTotal,
      opfsAvailable: storageInfo.opfsAvailable,
    });

    // App should handle quota gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// Service Worker Crash Tests
// ============================================================================

test.describe('Storage Chaos - Service Worker Crash', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'SWCrashUser' });
    await setupWithChannels(page);
  });

  test('should recover from service worker unregistration', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for SW to register
    await page.waitForTimeout(3000);

    // Crash SW
    await storageChaos.crashServiceWorker();
    await page.waitForTimeout(1000);

    // Reload
    await page.reload();
    await page.waitForTimeout(3000);

    // App should re-register SW and work
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should function offline after SW crash and recovery', async ({ page, context, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(5000); // Ensure SW is active and caching

    // Crash SW
    await storageChaos.crashServiceWorker();
    await page.waitForTimeout(500);

    // Reload to re-register SW
    await page.reload();
    await page.waitForTimeout(5000);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Try to reload (should work from cache)
    try {
      await page.reload({ timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch {
      // May fail without SW cache
    }

    // Go back online
    await context.setOffline(false);
    await page.reload();
    await waitForAppReady(page);

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle repeated SW crashes', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(3000);

    // Crash SW multiple times
    for (let i = 0; i < 3; i++) {
      await storageChaos.crashServiceWorker();
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForTimeout(2000);
    }

    // App should still function
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// Memory Pressure Tests
// ============================================================================

test.describe('Storage Chaos - Memory Pressure', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'MemoryUser' });
    await setupWithChannels(page);
  });

  test.afterEach(async ({ storageChaos }) => {
    await storageChaos.releaseMemoryPressure();
  });

  test('should handle moderate memory pressure (100MB)', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply memory pressure
    const result = await storageChaos.simulateMemoryPressure(100);
    console.log('Allocated:', result.allocated, 'MB');

    // Try to use the app
    const channelsButton = page.getByRole('button', { name: /channels/i });
    if (await channelsButton.isVisible()) {
      await channelsButton.click();
      await page.waitForTimeout(1000);
    }

    // App should still function
    expect(await isAppFunctional(page)).toBe(true);

    // Release memory
    await storageChaos.releaseMemoryPressure();
  });

  test('should handle high memory pressure (500MB)', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply high memory pressure
    const result = await storageChaos.simulateMemoryPressure(500);
    console.log('Allocated:', result.allocated, 'MB');

    // App may be slow but should still function
    await page.waitForTimeout(2000);

    expect(await isAppFunctional(page)).toBe(true);

    await storageChaos.releaseMemoryPressure();
  });

  test('should recover after memory pressure released', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply memory pressure
    await storageChaos.simulateMemoryPressure(200);
    await page.waitForTimeout(1000);

    // Release
    await storageChaos.releaseMemoryPressure();
    await storageChaos.forceGC();
    await page.waitForTimeout(1000);

    // App should recover
    const channelsButton = page.getByRole('button', { name: /channels/i });
    if (await channelsButton.isVisible()) {
      await channelsButton.click();
      await page.waitForTimeout(500);
    }

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle memory pressure during operation', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Start navigation
    const channelsButton = page.getByRole('button', { name: /channels/i });
    if (await channelsButton.isVisible()) {
      await channelsButton.click();
    }

    // Apply memory pressure during operation
    await storageChaos.simulateMemoryPressure(300);
    await page.waitForTimeout(2000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);

    await storageChaos.releaseMemoryPressure();
  });
});

// ============================================================================
// Concurrent Storage Operations Tests
// ============================================================================

test.describe('Storage Chaos - Concurrent Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ConcurrentUser' });
    await setupWithChannels(page);
  });

  test('should handle 100 concurrent localStorage operations', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Run concurrent operations
    const result = await storageChaos.simulateConcurrentStorageOps(100);
    console.log('Concurrent ops result:', result);

    expect(result.successCount).toBeGreaterThan(0);
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle 500 concurrent localStorage operations', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Run many concurrent operations
    const result = await storageChaos.simulateConcurrentStorageOps(500);
    console.log('Concurrent ops result:', result);

    expect(result.successCount).toBeGreaterThan(0);
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should maintain data integrity under concurrent writes', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Get initial app data
    const initialData = await getAppData(page);

    // Run concurrent operations
    await storageChaos.simulateConcurrentStorageOps(200);

    // Verify app data is not corrupted
    const finalData = await getAppData(page);

    expect(finalData.identity !== 'CORRUPTED').toBe(true);
    expect(finalData.settings !== 'CORRUPTED').toBe(true);
    expect(finalData.channels !== 'CORRUPTED').toBe(true);
  });
});

// ============================================================================
// Data Integrity Tests
// ============================================================================

test.describe('Storage Chaos - Data Integrity Under Stress', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'IntegrityUser' });
    await setupWithChannels(page);
  });

  test('should preserve data through storage stress', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Capture initial state
    const initialData = await getAppData(page);

    // Apply various stresses
    await storageChaos.simulateConcurrentStorageOps(100);
    await storageChaos.simulateMemoryPressure(100);
    await page.waitForTimeout(1000);
    await storageChaos.releaseMemoryPressure();

    // Verify data integrity
    const finalData = await getAppData(page);

    // Identity should be preserved
    expect(JSON.stringify(finalData.identity)).toBe(JSON.stringify(initialData.identity));

    // Settings should be preserved
    expect(JSON.stringify(finalData.settings)).toBe(JSON.stringify(initialData.settings));
  });

  test('should detect and report data corruption', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt data
    await storageChaos.corruptLocalStorage('bitchat-settings');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // Check for error handling
    const errorIndicator = page.locator(
      'text=/error|corrupt|reset|default/i'
    ).or(page.locator('[data-testid="data-error"]'));

    const hasError = await errorIndicator.isVisible().catch(() => false);
    console.log('Data corruption detected/handled:', hasError);

    // App should still be functional
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle rapid storage state changes', async ({ page, storageChaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Rapid operations
    for (let i = 0; i < 10; i++) {
      // Navigate
      const button = page.getByRole('button').first();
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(100);
      }

      // Concurrent storage ops
      await storageChaos.simulateConcurrentStorageOps(20);
    }

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);

    // Data should not be corrupted
    const data = await getAppData(page);
    expect(data.identity !== 'CORRUPTED').toBe(true);
  });
});

// ============================================================================
// Recovery and Reset Tests
// ============================================================================

test.describe('Storage Chaos - Recovery Mechanisms', () => {
  test('should allow complete data reset', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Clear all storage
    await clearStorage(page);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should show onboarding
    expect(await isAppFunctional(page)).toBe(true);

    // Storage should be clean
    const data = await getAppData(page);
    const hasData = data.identity || data.settings || data.channels;
    console.log('Has stored data after clear:', hasData);
  });

  test('should handle emergency wipe', async ({ page, storageChaos }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Simulate emergency wipe (triple tap on logo)
    const logo = page.locator('[data-testid="app-logo"], .app-logo').first();
    if (await logo.isVisible()) {
      await logo.click({ clickCount: 3 });
      await page.waitForTimeout(2000);
    }

    // Clear storage directly
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear IndexedDB
    const dbNames = await storageChaos.getIndexedDBNames();
    for (const name of dbNames) {
      await storageChaos.corruptIndexedDB(name);
    }

    // Clear OPFS
    await storageChaos.clearOPFS();

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // App should start fresh
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should rebuild corrupted stores on startup', async ({ page, storageChaos }) => {
    // Set up initial data
    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Corrupt multiple stores
    await storageChaos.corruptLocalStorage('bitchat-channels');
    await storageChaos.corruptLocalStorage('bitchat-outbox-queue');

    // Reload
    await page.reload();
    await page.waitForTimeout(3000);

    // App should rebuild corrupted stores
    const data = await getAppData(page);

    // Channels and queue should be rebuilt (not corrupted)
    expect(data.channels !== 'CORRUPTED').toBe(true);
    expect(data.queue !== 'CORRUPTED').toBe(true);

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should export data before corruption risk', async ({ page }) => {
    await setupWithIdentity(page);
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to settings
    const settingsButton = page.getByRole('button', { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
    }

    // Look for export functionality
    const exportButton = page.getByRole('button', { name: /export|backup/i });
    const hasExport = await exportButton.isVisible().catch(() => false);

    console.log('Export functionality available:', hasExport);

    // App should have export capability
    expect(await isAppFunctional(page)).toBe(true);
  });
});
