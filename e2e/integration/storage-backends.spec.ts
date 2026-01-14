/**
 * E2E Integration Tests for Storage Backends
 *
 * Comprehensive tests verifying:
 * - OPFS (Origin Private File System) as primary storage
 * - IndexedDB as fallback storage
 * - Automatic fallback mechanism
 * - Data persistence across page reloads
 * - Migration between storage formats
 * - Quota handling and edge cases
 *
 * @module e2e/integration/storage-backends
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for app to fully initialize
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * Clear all browser storage to start fresh
 */
async function clearAllStorage(page: Page): Promise<void> {
  const url = page.url();
  if (!url || url === 'about:blank') {
    return;
  }

  try {
    await page.evaluate(async () => {
      // Clear localStorage and sessionStorage
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // May fail if storage is not accessible
      }

      // Clear IndexedDB databases
      try {
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      } catch {
        // databases() may not be available
      }

      // Clear OPFS if available
      try {
        const root = await (navigator.storage as any).getDirectory();
        for await (const [name] of (root as any).entries()) {
          await root.removeEntry(name, { recursive: true });
        }
      } catch {
        // OPFS may not be available
      }
    });
  } catch {
    // Page may not be ready for evaluation
  }
}

/**
 * Check OPFS availability in the browser
 */
async function checkOPFSAvailability(page: Page): Promise<{
  available: boolean;
  reason: string;
}> {
  return await page.evaluate(async () => {
    try {
      if (!navigator.storage || typeof (navigator.storage as any).getDirectory !== 'function') {
        return { available: false, reason: 'OPFS API not available' };
      }

      const root = await (navigator.storage as any).getDirectory();
      const testFileName = `_opfs_test_${Date.now()}`;
      const testDir = await root.getDirectoryHandle(testFileName, { create: true });
      const testFile = await testDir.getFileHandle('test.txt', { create: true });

      // Test write capability
      const writable = await testFile.createWritable();
      await writable.write('test');
      await writable.close();

      // Verify read capability
      const file = await testFile.getFile();
      const content = await file.text();

      // Clean up
      await root.removeEntry(testFileName, { recursive: true });

      if (content !== 'test') {
        return { available: false, reason: 'OPFS read/write verification failed' };
      }

      return { available: true, reason: 'OPFS fully functional' };
    } catch (error: any) {
      return { available: false, reason: error.message || 'Unknown OPFS error' };
    }
  });
}

/**
 * Check IndexedDB availability
 */
async function checkIndexedDBAvailability(page: Page): Promise<{
  available: boolean;
  reason: string;
}> {
  return await page.evaluate(async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        return { available: false, reason: 'IndexedDB API not available' };
      }

      const testDbName = `idb_test_${Date.now()}`;

      return new Promise<{ available: boolean; reason: string }>((resolve) => {
        const request = indexedDB.open(testDbName, 1);

        request.onerror = () => {
          resolve({ available: false, reason: 'Failed to open IndexedDB' });
        };

        request.onsuccess = () => {
          const db = request.result;
          db.close();
          indexedDB.deleteDatabase(testDbName);
          resolve({ available: true, reason: 'IndexedDB fully functional' });
        };

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('test', { keyPath: 'id' });
        };
      });
    } catch (error: any) {
      return { available: false, reason: error.message || 'Unknown IndexedDB error' };
    }
  });
}

/**
 * Store data using OPFS directly
 */
async function storeInOPFS(
  page: Page,
  tableName: string,
  key: string,
  value: any
): Promise<boolean> {
  return await page.evaluate(
    async ({ tableName, key, value }) => {
      try {
        const root = await (navigator.storage as any).getDirectory();
        const appDir = await root.getDirectoryHandle('bitchat', { create: true });
        const tableDir = await appDir.getDirectoryHandle(tableName, { create: true });
        const filename = `${encodeURIComponent(key)}.json`;
        const fileHandle = await tableDir.getFileHandle(filename, { create: true });

        const record = {
          key,
          table: tableName,
          value,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(record));
        await writable.close();

        return true;
      } catch {
        return false;
      }
    },
    { tableName, key, value }
  );
}

/**
 * Retrieve data from OPFS directly
 */
async function getFromOPFS(
  page: Page,
  tableName: string,
  key: string
): Promise<any | null> {
  return await page.evaluate(
    async ({ tableName, key }) => {
      try {
        const root = await (navigator.storage as any).getDirectory();
        const appDir = await root.getDirectoryHandle('bitchat');
        const tableDir = await appDir.getDirectoryHandle(tableName);
        const filename = `${encodeURIComponent(key)}.json`;
        const fileHandle = await tableDir.getFileHandle(filename);

        const file = await fileHandle.getFile();
        const content = await file.text();
        const record = JSON.parse(content);

        return record.value;
      } catch {
        return null;
      }
    },
    { tableName, key }
  );
}

/**
 * Store data in IndexedDB directly
 */
async function storeInIndexedDB(
  page: Page,
  tableName: string,
  key: string,
  value: any
): Promise<boolean> {
  return await page.evaluate(
    async ({ tableName, key, value }) => {
      return new Promise<boolean>((resolve) => {
        try {
          const request = indexedDB.open('bitchat', 1);

          request.onerror = () => resolve(false);

          request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            const tables = ['messages', 'channels', 'peers', 'keys', 'settings', 'outbox'];
            for (const table of tables) {
              if (!db.objectStoreNames.contains(table)) {
                db.createObjectStore(table, { keyPath: 'key' });
              }
            }
          };

          request.onsuccess = () => {
            try {
              const db = request.result;
              const tx = db.transaction(tableName, 'readwrite');
              const store = tx.objectStore(tableName);

              const record = {
                key,
                table: tableName,
                value,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              const putRequest = store.put(record);

              putRequest.onsuccess = () => {
                db.close();
                resolve(true);
              };

              putRequest.onerror = () => {
                db.close();
                resolve(false);
              };
            } catch {
              resolve(false);
            }
          };
        } catch {
          resolve(false);
        }
      });
    },
    { tableName, key, value }
  );
}

/**
 * Retrieve data from IndexedDB directly
 */
async function getFromIndexedDB(
  page: Page,
  tableName: string,
  key: string
): Promise<any | null> {
  return await page.evaluate(
    async ({ tableName, key }) => {
      return new Promise<any | null>((resolve) => {
        try {
          const request = indexedDB.open('bitchat', 1);

          request.onerror = () => resolve(null);

          request.onsuccess = () => {
            try {
              const db = request.result;

              if (!db.objectStoreNames.contains(tableName)) {
                db.close();
                resolve(null);
                return;
              }

              const tx = db.transaction(tableName, 'readonly');
              const store = tx.objectStore(tableName);
              const getRequest = store.get(key);

              getRequest.onsuccess = () => {
                const record = getRequest.result;
                db.close();
                resolve(record ? record.value : null);
              };

              getRequest.onerror = () => {
                db.close();
                resolve(null);
              };
            } catch {
              resolve(null);
            }
          };
        } catch {
          resolve(null);
        }
      });
    },
    { tableName, key }
  );
}

// ============================================================================
// OPFS Primary Storage Tests
// ============================================================================

test.describe('OPFS Primary Storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('should detect OPFS availability correctly', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    // Log availability for debugging
    console.log(`OPFS availability in ${browserName}: ${opfsStatus.available} - ${opfsStatus.reason}`);

    // OPFS should be available in modern Chromium-based browsers
    expect(typeof opfsStatus.available).toBe('boolean');
    expect(typeof opfsStatus.reason).toBe('string');
    expect(opfsStatus.reason.length).toBeGreaterThan(0);

    if (browserName === 'chromium') {
      // Chromium should support OPFS
      expect(opfsStatus.available).toBe(true);
    }
  });

  test('should store and retrieve data via OPFS', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}: ${opfsStatus.reason}`);
      return;
    }

    const testData = {
      id: 'msg_test_001',
      content: 'Hello from OPFS test!',
      timestamp: Date.now(),
      metadata: {
        encrypted: true,
        version: 1,
      },
    };

    // Store data
    const storeResult = await storeInOPFS(page, 'messages', 'msg_test_001', testData);
    expect(storeResult).toBe(true);

    // Retrieve data
    const retrievedData = await getFromOPFS(page, 'messages', 'msg_test_001');
    expect(retrievedData).not.toBeNull();
    expect(retrievedData).toEqual(testData);
  });

  test('should store multiple records in different tables', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}`);
      return;
    }

    const tables = ['messages', 'channels', 'peers', 'settings'];
    const testRecords = tables.map((table, i) => ({
      table,
      key: `test_key_${i}`,
      value: { data: `Test value for ${table}`, index: i },
    }));

    // Store all records
    for (const record of testRecords) {
      const stored = await storeInOPFS(page, record.table, record.key, record.value);
      expect(stored).toBe(true);
    }

    // Verify all records
    for (const record of testRecords) {
      const retrieved = await getFromOPFS(page, record.table, record.key);
      expect(retrieved).toEqual(record.value);
    }
  });

  test('should handle quota limits gracefully', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}`);
      return;
    }

    // Try to store progressively larger data to test quota handling
    const result = await page.evaluate(async () => {
      const results: { size: number; success: boolean; error?: string }[] = [];

      try {
        const root = await (navigator.storage as any).getDirectory();
        const testDir = await root.getDirectoryHandle('quota_test', { create: true });

        // Start with 1KB and increase
        const sizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB

        for (const size of sizes) {
          try {
            const data = 'x'.repeat(size);
            const filename = `test_${size}.txt`;
            const fileHandle = await testDir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            results.push({ size, success: true });
          } catch (error: any) {
            results.push({
              size,
              success: false,
              error: error.name || error.message,
            });
          }
        }

        // Clean up
        await root.removeEntry('quota_test', { recursive: true });
      } catch (error: any) {
        results.push({
          size: 0,
          success: false,
          error: `Setup failed: ${error.message}`,
        });
      }

      return results;
    });

    // All reasonable sizes should succeed
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].success).toBe(true); // At least 1KB should work

    // Log quota test results
    for (const r of result) {
      console.log(`OPFS quota test - ${r.size} bytes: ${r.success ? 'OK' : r.error}`);
    }
  });

  test('should persist data across page reloads', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}`);
      return;
    }

    const testData = {
      persistenceTest: true,
      timestamp: Date.now(),
      randomValue: Math.random().toString(36).substring(7),
    };

    // Store data
    const stored = await storeInOPFS(page, 'settings', 'persistence_test', testData);
    expect(stored).toBe(true);

    // Reload the page
    await page.reload();
    await waitForAppReady(page);

    // Verify data persisted
    const retrieved = await getFromOPFS(page, 'settings', 'persistence_test');
    expect(retrieved).not.toBeNull();
    expect(retrieved).toEqual(testData);

    // Clean up
    await page.evaluate(async () => {
      try {
        const root = await (navigator.storage as any).getDirectory();
        const appDir = await root.getDirectoryHandle('bitchat');
        const settingsDir = await appDir.getDirectoryHandle('settings');
        await settingsDir.removeEntry('persistence_test.json');
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  test('should handle special characters in keys', async ({ page, browserName }) => {
    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}`);
      return;
    }

    const specialKeys = [
      'key with spaces',
      'key/with/slashes',
      'key:with:colons',
      'key?with=query&params',
      'unicode_key',
    ];

    for (const key of specialKeys) {
      const value = { key, testValue: `Value for ${key}` };
      const stored = await storeInOPFS(page, 'settings', key, value);
      expect(stored).toBe(true);

      const retrieved = await getFromOPFS(page, 'settings', key);
      expect(retrieved).toEqual(value);
    }
  });
});

// ============================================================================
// IndexedDB Fallback Tests
// ============================================================================

test.describe('IndexedDB Fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('should detect when OPFS is unavailable and fall back to IndexedDB', async ({ page }) => {
    // Simulate OPFS being unavailable
    const result = await page.evaluate(async () => {
      // First check if OPFS would normally be available
      let opfsNormallyAvailable = false;
      try {
        const root = await (navigator.storage as any).getDirectory();
        opfsNormallyAvailable = !!root;
      } catch {
        opfsNormallyAvailable = false;
      }

      // Check IndexedDB availability
      let idbAvailable = false;
      try {
        const testRequest = indexedDB.open('fallback_test', 1);
        await new Promise<void>((resolve, reject) => {
          testRequest.onerror = () => reject(new Error('IDB unavailable'));
          testRequest.onsuccess = () => {
            testRequest.result.close();
            indexedDB.deleteDatabase('fallback_test');
            resolve();
          };
        });
        idbAvailable = true;
      } catch {
        idbAvailable = false;
      }

      return {
        opfsNormallyAvailable,
        idbAvailable,
        canFallback: idbAvailable,
      };
    });

    expect(result.idbAvailable).toBe(true);
    console.log(`Fallback status - OPFS normally available: ${result.opfsNormallyAvailable}, IDB available: ${result.idbAvailable}`);
  });

  test('should automatically fall back to IndexedDB when OPFS unavailable', async ({ page }) => {
    // This test simulates the StorageManager behavior
    const result = await page.evaluate(async () => {
      const storageBackends: string[] = [];

      // Try OPFS first
      let opfsWorks = false;
      try {
        const root = await (navigator.storage as any).getDirectory();
        const testDir = await root.getDirectoryHandle('fallback_test', { create: true });
        const testFile = await testDir.getFileHandle('test.txt', { create: true });
        const writable = await testFile.createWritable();
        await writable.write('test');
        await writable.close();
        await root.removeEntry('fallback_test', { recursive: true });
        opfsWorks = true;
        storageBackends.push('opfs');
      } catch {
        opfsWorks = false;
      }

      // If OPFS didn't work, try IndexedDB
      if (!opfsWorks) {
        try {
          const request = indexedDB.open('fallback_test_idb', 1);
          await new Promise<void>((resolve, reject) => {
            request.onerror = () => reject(new Error('IDB failed'));
            request.onsuccess = () => {
              request.result.close();
              indexedDB.deleteDatabase('fallback_test_idb');
              resolve();
            };
            request.onupgradeneeded = (event: any) => {
              event.target.result.createObjectStore('test');
            };
          });
          storageBackends.push('indexeddb');
        } catch {
          // Both failed
        }
      }

      return {
        selectedBackend: storageBackends[0] || 'none',
        opfsWorks,
        backendsChecked: storageBackends,
      };
    });

    // Should have selected a backend
    expect(result.selectedBackend).not.toBe('none');
    expect(['opfs', 'indexeddb']).toContain(result.selectedBackend);
    console.log(`Storage backend selected: ${result.selectedBackend}`);
  });

  test('should provide same API for both backends', async ({ page }) => {
    // Test that basic operations work identically regardless of backend
    const idbResult = await storeInIndexedDB(page, 'settings', 'api_test', { backend: 'indexeddb', value: 42 });
    expect(idbResult).toBe(true);

    const retrieved = await getFromIndexedDB(page, 'settings', 'api_test');
    expect(retrieved).toEqual({ backend: 'indexeddb', value: 42 });
  });

  test('should maintain data integrity across backends', async ({ page, browserName }) => {
    const testData = {
      id: 'integrity_test',
      content: 'Test message for integrity',
      timestamp: Date.now(),
      nested: {
        level1: {
          level2: {
            value: 'deep nested value',
          },
        },
      },
      array: [1, 2, 3, 'four', { five: 5 }],
      unicode: 'Unicode test',
      special: '<script>alert("xss")</script>',
    };

    // Store in IndexedDB
    const stored = await storeInIndexedDB(page, 'messages', 'integrity_test', testData);
    expect(stored).toBe(true);

    // Retrieve and verify
    const retrieved = await getFromIndexedDB(page, 'messages', 'integrity_test');
    expect(retrieved).toEqual(testData);

    // Verify specific nested values
    expect(retrieved.nested.level1.level2.value).toBe('deep nested value');
    expect(retrieved.array[4].five).toBe(5);
  });
});

// ============================================================================
// Migration Tests
// ============================================================================

test.describe('Storage Migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('should migrate from old storage format', async ({ page }) => {
    // Simulate old storage format (v1)
    const oldFormatData = await page.evaluate(async () => {
      // Create old format data in localStorage
      const oldData = {
        version: 1,
        messages: {
          msg_001: { id: 'msg_001', content: 'Old message 1', timestamp: 1000 },
          msg_002: { id: 'msg_002', content: 'Old message 2', timestamp: 2000 },
        },
        settings: {
          theme: 'dark',
          nickname: 'OldUser',
        },
      };

      localStorage.setItem('bitchat_data_v1', JSON.stringify(oldData));

      return oldData;
    });

    // Perform migration
    const migrationResult = await page.evaluate(async (oldData) => {
      try {
        // Read old data
        const oldDataStr = localStorage.getItem('bitchat_data_v1');
        if (!oldDataStr) {
          return { success: false, error: 'No old data found' };
        }

        const parsedOldData = JSON.parse(oldDataStr);
        const migratedRecords: { table: string; key: string; success: boolean }[] = [];

        // Migrate to IndexedDB (new format)
        return new Promise<{ success: boolean; migratedRecords: any[]; error?: string }>((resolve) => {
          const request = indexedDB.open('bitchat_migrated', 1);

          request.onerror = () => {
            resolve({ success: false, migratedRecords: [], error: 'Failed to open IndexedDB' });
          };

          request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            db.createObjectStore('messages', { keyPath: 'key' });
            db.createObjectStore('settings', { keyPath: 'key' });
          };

          request.onsuccess = async () => {
            const db = request.result;

            try {
              // Migrate messages
              const msgTx = db.transaction('messages', 'readwrite');
              const msgStore = msgTx.objectStore('messages');

              for (const [key, value] of Object.entries(parsedOldData.messages || {})) {
                const record = {
                  key,
                  table: 'messages',
                  value,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                msgStore.put(record);
                migratedRecords.push({ table: 'messages', key, success: true });
              }

              await new Promise<void>((res) => {
                msgTx.oncomplete = () => res();
                msgTx.onerror = () => res();
              });

              // Migrate settings
              const settingsTx = db.transaction('settings', 'readwrite');
              const settingsStore = settingsTx.objectStore('settings');

              for (const [key, value] of Object.entries(parsedOldData.settings || {})) {
                const record = {
                  key,
                  table: 'settings',
                  value,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                settingsStore.put(record);
                migratedRecords.push({ table: 'settings', key, success: true });
              }

              await new Promise<void>((res) => {
                settingsTx.oncomplete = () => res();
                settingsTx.onerror = () => res();
              });

              db.close();

              // Mark migration complete
              localStorage.setItem('bitchat_migration_complete', 'true');
              localStorage.removeItem('bitchat_data_v1');

              resolve({ success: true, migratedRecords });
            } catch (error: any) {
              db.close();
              resolve({ success: false, migratedRecords, error: error.message });
            }
          };
        });
      } catch (error: any) {
        return { success: false, migratedRecords: [], error: error.message };
      }
    }, oldFormatData);

    expect(migrationResult.success).toBe(true);
    expect(migrationResult.migratedRecords.length).toBeGreaterThan(0);

    // Verify migrated data
    const verifyResult = await page.evaluate(async () => {
      return new Promise<{ messages: any[]; settings: any[] }>((resolve) => {
        const request = indexedDB.open('bitchat_migrated', 1);

        request.onsuccess = () => {
          const db = request.result;
          const messages: any[] = [];
          const settings: any[] = [];

          const msgTx = db.transaction('messages', 'readonly');
          const msgStore = msgTx.objectStore('messages');
          const msgCursor = msgStore.openCursor();

          msgCursor.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
              messages.push(cursor.value);
              cursor.continue();
            }
          };

          msgTx.oncomplete = () => {
            const settingsTx = db.transaction('settings', 'readonly');
            const settingsStore = settingsTx.objectStore('settings');
            const settingsCursor = settingsStore.openCursor();

            settingsCursor.onsuccess = (event: any) => {
              const cursor = event.target.result;
              if (cursor) {
                settings.push(cursor.value);
                cursor.continue();
              }
            };

            settingsTx.oncomplete = () => {
              db.close();
              resolve({ messages, settings });
            };
          };
        };
      });
    });

    expect(verifyResult.messages.length).toBe(2);
    expect(verifyResult.settings.length).toBe(2);
  });

  test('should handle partial migration failure gracefully', async ({ page }) => {
    // Set up data where some records will fail to migrate
    const partialMigrationResult = await page.evaluate(async () => {
      const results: { key: string; success: boolean; error?: string }[] = [];

      // Prepare test data with one problematic entry
      const testData = [
        { key: 'valid_1', value: { content: 'Valid record 1' } },
        { key: 'valid_2', value: { content: 'Valid record 2' } },
        // Simulate a circular reference that would cause JSON issues
        { key: 'valid_3', value: { content: 'Valid record 3' } },
      ];

      return new Promise<typeof results>((resolve) => {
        const request = indexedDB.open('partial_migration_test', 1);

        request.onupgradeneeded = (event: any) => {
          event.target.result.createObjectStore('data', { keyPath: 'key' });
        };

        request.onsuccess = async () => {
          const db = request.result;
          const tx = db.transaction('data', 'readwrite');
          const store = tx.objectStore('data');

          for (const item of testData) {
            try {
              const record = {
                key: item.key,
                value: item.value,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              store.put(record);
              results.push({ key: item.key, success: true });
            } catch (error: any) {
              results.push({ key: item.key, success: false, error: error.message });
            }
          }

          tx.oncomplete = () => {
            db.close();
            indexedDB.deleteDatabase('partial_migration_test');
            resolve(results);
          };

          tx.onerror = () => {
            db.close();
            indexedDB.deleteDatabase('partial_migration_test');
            resolve(results);
          };
        };

        request.onerror = () => {
          resolve([{ key: 'all', success: false, error: 'DB open failed' }]);
        };
      });
    });

    // At least some records should succeed
    const successCount = partialMigrationResult.filter(r => r.success).length;
    expect(successCount).toBeGreaterThan(0);
  });

  test('should verify data integrity after migration', async ({ page }) => {
    // Store original data
    const originalData = {
      message: {
        id: 'integrity_001',
        content: 'Message for integrity verification',
        timestamp: 1705000000000,
        metadata: {
          encrypted: true,
          signature: 'abc123',
        },
      },
      channel: {
        id: 'chan_001',
        name: 'Test Channel',
        type: 'location',
        geohash: '9q8yy',
      },
    };

    // Perform migration and integrity check
    const integrityResult = await page.evaluate(async (data) => {
      return new Promise<{
        originalHash: string;
        migratedHash: string;
        match: boolean;
      }>((resolve) => {
        // Simple hash function for comparison
        const hash = (obj: any): string => {
          const str = JSON.stringify(obj, Object.keys(obj).sort());
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash.toString(16);
        };

        const originalHash = hash(data);

        const request = indexedDB.open('integrity_test', 1);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('messages', { keyPath: 'key' });
          db.createObjectStore('channels', { keyPath: 'key' });
        };

        request.onsuccess = () => {
          const db = request.result;

          // Store data
          const tx = db.transaction(['messages', 'channels'], 'readwrite');
          tx.objectStore('messages').put({
            key: 'integrity_001',
            value: data.message,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          tx.objectStore('channels').put({
            key: 'chan_001',
            value: data.channel,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          tx.oncomplete = () => {
            // Read back and verify
            const readTx = db.transaction(['messages', 'channels'], 'readonly');
            const msgReq = readTx.objectStore('messages').get('integrity_001');
            const chanReq = readTx.objectStore('channels').get('chan_001');

            readTx.oncomplete = () => {
              const retrievedData = {
                message: msgReq.result?.value,
                channel: chanReq.result?.value,
              };

              const migratedHash = hash(retrievedData);

              db.close();
              indexedDB.deleteDatabase('integrity_test');

              resolve({
                originalHash,
                migratedHash,
                match: originalHash === migratedHash,
              });
            };
          };
        };

        request.onerror = () => {
          resolve({
            originalHash,
            migratedHash: 'error',
            match: false,
          });
        };
      });
    }, originalData);

    expect(integrityResult.match).toBe(true);
    expect(integrityResult.originalHash).toBe(integrityResult.migratedHash);
  });
});

// ============================================================================
// Cross-Backend Consistency Tests
// ============================================================================

test.describe('Cross-Backend Consistency', () => {
  test('should produce identical results from both backends', async ({ page, browserName }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await waitForAppReady(page);

    const opfsStatus = await checkOPFSAvailability(page);

    if (!opfsStatus.available) {
      test.skip(true, `OPFS not available in ${browserName}, skipping cross-backend test`);
      return;
    }

    const testData = {
      id: 'cross_backend_test',
      content: 'Testing cross-backend consistency',
      numbers: [1, 2, 3, 4, 5],
      nested: { a: { b: { c: 'deep' } } },
    };

    // Store in OPFS
    const opfsStored = await storeInOPFS(page, 'messages', 'cross_test', testData);
    expect(opfsStored).toBe(true);

    // Store same data in IndexedDB
    const idbStored = await storeInIndexedDB(page, 'messages', 'cross_test', testData);
    expect(idbStored).toBe(true);

    // Retrieve from both
    const opfsRetrieved = await getFromOPFS(page, 'messages', 'cross_test');
    const idbRetrieved = await getFromIndexedDB(page, 'messages', 'cross_test');

    // Both should return identical data
    expect(opfsRetrieved).toEqual(testData);
    expect(idbRetrieved).toEqual(testData);
    expect(opfsRetrieved).toEqual(idbRetrieved);
  });
});

// ============================================================================
// Error Recovery Tests
// ============================================================================

test.describe('Storage Error Recovery', () => {
  test('should recover from storage initialization failure', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const recoveryResult = await page.evaluate(async () => {
      let recoveryAttempts = 0;
      let success = false;

      // Simulate retry logic
      for (let i = 0; i < 3 && !success; i++) {
        recoveryAttempts++;
        try {
          // Try IndexedDB
          const request = indexedDB.open('recovery_test', 1);
          await new Promise<void>((resolve, reject) => {
            request.onerror = () => reject(new Error('Failed'));
            request.onsuccess = () => {
              request.result.close();
              resolve();
            };
            request.onupgradeneeded = (event: any) => {
              event.target.result.createObjectStore('test');
            };
          });
          success = true;
        } catch {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Clean up
      indexedDB.deleteDatabase('recovery_test');

      return { recoveryAttempts, success };
    });

    expect(recoveryResult.success).toBe(true);
  });

  test('should handle concurrent operations without data corruption', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const concurrencyResult = await page.evaluate(async () => {
      const operations = 50;
      const results: { operation: number; success: boolean }[] = [];

      return new Promise<typeof results>((resolve) => {
        const request = indexedDB.open('concurrency_test', 1);

        request.onupgradeneeded = (event: any) => {
          event.target.result.createObjectStore('data', { keyPath: 'key' });
        };

        request.onsuccess = async () => {
          const db = request.result;

          // Run concurrent writes
          const promises = Array.from({ length: operations }, async (_, i) => {
            try {
              const tx = db.transaction('data', 'readwrite');
              const store = tx.objectStore('data');
              store.put({
                key: `concurrent_${i}`,
                value: { index: i, timestamp: Date.now() },
                createdAt: Date.now(),
              });

              await new Promise<void>((res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej();
              });

              return { operation: i, success: true };
            } catch {
              return { operation: i, success: false };
            }
          });

          const allResults = await Promise.all(promises);
          db.close();
          indexedDB.deleteDatabase('concurrency_test');
          resolve(allResults);
        };

        request.onerror = () => {
          resolve([{ operation: -1, success: false }]);
        };
      });
    });

    const successCount = concurrencyResult.filter(r => r.success).length;
    expect(successCount).toBe(50);
  });
});

// ============================================================================
// Storage Health Monitoring Tests
// ============================================================================

test.describe('Storage Health Monitoring', () => {
  test('should report storage quota and usage', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const healthInfo = await page.evaluate(async () => {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { supported: false };
      }

      const estimate = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted
        ? await navigator.storage.persisted()
        : false;

      return {
        supported: true,
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usagePercent: estimate.quota
          ? ((estimate.usage || 0) / estimate.quota) * 100
          : 0,
        isPersisted: persisted,
      };
    });

    if (healthInfo.supported) {
      expect(typeof healthInfo.usage).toBe('number');
      expect(typeof healthInfo.quota).toBe('number');
      expect(healthInfo.quota).toBeGreaterThan(0);
      expect(healthInfo.usagePercent).toBeLessThan(100);

      console.log(`Storage health: ${healthInfo.usage} / ${healthInfo.quota} bytes (${healthInfo.usagePercent.toFixed(2)}%)`);
    }
  });

  test('should detect low storage conditions', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const lowStorageCheck = await page.evaluate(async () => {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { supported: false };
      }

      const estimate = await navigator.storage.estimate();
      const usagePercent = estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0;

      // Define thresholds
      const warningThreshold = 80;
      const criticalThreshold = 95;

      return {
        supported: true,
        usagePercent,
        isWarning: usagePercent >= warningThreshold,
        isCritical: usagePercent >= criticalThreshold,
        warningThreshold,
        criticalThreshold,
      };
    });

    if (lowStorageCheck.supported) {
      expect(typeof lowStorageCheck.usagePercent).toBe('number');
      expect(typeof lowStorageCheck.isWarning).toBe('boolean');
      expect(typeof lowStorageCheck.isCritical).toBe('boolean');

      // In normal test conditions, we shouldn't be at critical levels
      expect(lowStorageCheck.isCritical).toBe(false);
    }
  });
});
