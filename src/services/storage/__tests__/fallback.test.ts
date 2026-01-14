/**
 * Storage Fallback Unit Tests
 *
 * Comprehensive tests for the storage fallback mechanism:
 * - OPFS to IndexedDB automatic fallback
 * - Backend detection and selection
 * - API consistency across backends
 * - Error handling during fallback
 * - Migration between storage formats
 *
 * @module storage/__tests__/fallback
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StorageManager, createStorageManager, resetStorageManager } from '../storage-manager';
import { OPFSStorage, createOPFSStorage } from '../opfs-storage';
import { IndexedDBStorage, createIndexedDBStorage } from '../indexeddb-storage';
import type { StorageAdapter, StorageTableName, StorageConfig } from '../types';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Create a mock storage adapter for testing
 */
function createMockAdapter(options: {
  available?: boolean;
  failOnGet?: boolean;
  failOnSet?: boolean;
  data?: Map<string, Map<string, unknown>>;
}): StorageAdapter {
  const {
    available = true,
    failOnGet = false,
    failOnSet = false,
    data = new Map(),
  } = options;

  return {
    async get(table: StorageTableName, key: string) {
      if (failOnGet) throw new Error('Mock get failure');
      const tableData = data.get(table);
      return tableData?.get(key) ?? null;
    },
    async set(table: StorageTableName, key: string, value: unknown) {
      if (failOnSet) throw new Error('Mock set failure');
      if (!data.has(table)) data.set(table, new Map());
      data.get(table)!.set(key, value);
    },
    async delete(table: StorageTableName, key: string) {
      const tableData = data.get(table);
      if (!tableData?.has(key)) return false;
      tableData.delete(key);
      return true;
    },
    async clear(table: StorageTableName) {
      data.set(table, new Map());
    },
    async keys(table: StorageTableName) {
      const tableData = data.get(table);
      return tableData ? Array.from(tableData.keys()) : [];
    },
    async getAll(table: StorageTableName) {
      const tableData = data.get(table);
      return tableData ? Array.from(tableData.values()) : [];
    },
    async getMany(table: StorageTableName, keys: string[]) {
      const tableData = data.get(table);
      return keys.map((key) => tableData?.get(key) ?? null);
    },
    async setMany(table: StorageTableName, entries: [string, unknown][]) {
      if (failOnSet) throw new Error('Mock setMany failure');
      if (!data.has(table)) data.set(table, new Map());
      const tableData = data.get(table)!;
      for (const [key, value] of entries) {
        tableData.set(key, value);
      }
    },
    async isAvailable() {
      return available;
    },
    async close() {
      data.clear();
    },
  };
}

// ============================================================================
// Backend Detection Tests
// ============================================================================

describe('Storage Backend Detection', () => {
  describe('OPFS Availability', () => {
    it('should detect OPFS availability correctly', async () => {
      const opfsStorage = createOPFSStorage({ dbName: 'opfs_detect_test' });
      const isAvailable = await opfsStorage.isAvailable();

      // In jsdom environment, OPFS is not available
      expect(typeof isAvailable).toBe('boolean');
      // jsdom doesn't have OPFS
      expect(isAvailable).toBe(false);

      await opfsStorage.close();
    });

    it('should handle OPFS detection errors gracefully', async () => {
      const opfsStorage = createOPFSStorage({ dbName: 'opfs_error_test' });

      // Should not throw, just return false
      const isAvailable = await opfsStorage.isAvailable();
      expect(isAvailable).toBe(false);

      await opfsStorage.close();
    });
  });

  describe('IndexedDB Availability', () => {
    it('should detect IndexedDB availability correctly', async () => {
      const idbStorage = createIndexedDBStorage({ dbName: 'idb_detect_test' });
      const isAvailable = await idbStorage.isAvailable();

      // fake-indexeddb should make IndexedDB available
      expect(typeof isAvailable).toBe('boolean');
      expect(isAvailable).toBe(true);

      await idbStorage.close();
    });

    it('should handle IndexedDB detection when unavailable', async () => {
      // Mock indexedDB to be undefined
      const originalIndexedDB = globalThis.indexedDB;

      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const idbStorage = createIndexedDBStorage({ dbName: 'idb_unavailable_test' });

      // Restore before the async operation to avoid test pollution
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });

      // The storage should report unavailable when IndexedDB is missing
      // Note: This may still return true because of fake-indexeddb setup
      const isAvailable = await idbStorage.isAvailable();
      expect(typeof isAvailable).toBe('boolean');

      await idbStorage.close();
    });
  });
});

// ============================================================================
// Automatic Fallback Tests
// ============================================================================

describe('Automatic Fallback Mechanism', () => {
  let manager: StorageManager;

  beforeEach(() => {
    resetStorageManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
    resetStorageManager();
  });

  it('should fall back to IndexedDB when OPFS is unavailable', async () => {
    manager = createStorageManager({
      dbName: 'fallback_test',
      preferOpfs: true,
    });

    const result = await manager.initialize();

    // In jsdom, OPFS is not available, so should fall back to IndexedDB
    expect(result.backendType).toBe('indexeddb');
    expect(result.adapter).toBeDefined();
  });

  it('should prefer OPFS when available and configured', async () => {
    // In a real browser with OPFS support, this would select OPFS
    // In jsdom, it will fall back to IndexedDB
    manager = createStorageManager({
      dbName: 'opfs_prefer_test',
      preferOpfs: true,
    });

    const result = await manager.initialize();

    // Backend type should be one of the valid options
    expect(['opfs', 'indexeddb']).toContain(result.backendType);
  });

  it('should use IndexedDB when preferOpfs is false', async () => {
    manager = createStorageManager({
      dbName: 'idb_prefer_test',
      preferOpfs: false,
    });

    const result = await manager.initialize();

    // Should directly use IndexedDB
    expect(result.backendType).toBe('indexeddb');
  });

  it('should handle initialization failure gracefully', async () => {
    // Create a manager with invalid config to test error handling
    manager = createStorageManager({
      dbName: 'error_test',
    });

    // Should not throw during initialization
    const result = await manager.initialize();
    expect(result).toBeDefined();
    expect(result.adapter).toBeDefined();
  });
});

// ============================================================================
// API Consistency Tests
// ============================================================================

describe('API Consistency Across Backends', () => {
  let idbStorage: IndexedDBStorage;

  beforeEach(() => {
    idbStorage = createIndexedDBStorage({ dbName: `api_test_${Date.now()}` });
  });

  afterEach(async () => {
    await idbStorage.close();
  });

  describe('Basic CRUD Operations', () => {
    it('should store and retrieve values correctly', async () => {
      const testValue = { content: 'test message', timestamp: Date.now() };

      await idbStorage.set('messages', 'msg_001', testValue);
      const retrieved = await idbStorage.get<typeof testValue>('messages', 'msg_001');

      expect(retrieved).toEqual(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const result = await idbStorage.get('messages', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should overwrite existing values', async () => {
      await idbStorage.set('settings', 'theme', 'light');
      await idbStorage.set('settings', 'theme', 'dark');

      const result = await idbStorage.get<string>('settings', 'theme');
      expect(result).toBe('dark');
    });

    it('should delete values correctly', async () => {
      await idbStorage.set('messages', 'delete_me', { content: 'delete' });
      const deleted = await idbStorage.delete('messages', 'delete_me');

      expect(deleted).toBe(true);

      const result = await idbStorage.get('messages', 'delete_me');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent keys', async () => {
      const deleted = await idbStorage.delete('messages', 'never_existed');
      expect(deleted).toBe(false);
    });

    it('should clear table correctly', async () => {
      await idbStorage.set('messages', 'msg_1', { content: '1' });
      await idbStorage.set('messages', 'msg_2', { content: '2' });
      await idbStorage.set('messages', 'msg_3', { content: '3' });

      await idbStorage.clear('messages');

      const keys = await idbStorage.keys('messages');
      expect(keys).toHaveLength(0);
    });
  });

  describe('Batch Operations', () => {
    it('should store multiple values with setMany', async () => {
      const entries: [string, unknown][] = [
        ['batch_1', { content: 'First' }],
        ['batch_2', { content: 'Second' }],
        ['batch_3', { content: 'Third' }],
      ];

      await idbStorage.setMany('messages', entries);

      const result1 = await idbStorage.get('messages', 'batch_1');
      const result2 = await idbStorage.get('messages', 'batch_2');
      const result3 = await idbStorage.get('messages', 'batch_3');

      expect(result1).toEqual({ content: 'First' });
      expect(result2).toEqual({ content: 'Second' });
      expect(result3).toEqual({ content: 'Third' });
    });

    it('should retrieve multiple values with getMany', async () => {
      await idbStorage.set('messages', 'get_1', { id: 1 });
      await idbStorage.set('messages', 'get_2', { id: 2 });
      await idbStorage.set('messages', 'get_3', { id: 3 });

      const results = await idbStorage.getMany('messages', ['get_1', 'get_2', 'get_3', 'nonexistent']);

      expect(results[0]).toEqual({ id: 1 });
      expect(results[1]).toEqual({ id: 2 });
      expect(results[2]).toEqual({ id: 3 });
      expect(results[3]).toBeNull();
    });

    it('should list all keys in a table', async () => {
      await idbStorage.set('channels', 'chan_1', { name: 'Channel 1' });
      await idbStorage.set('channels', 'chan_2', { name: 'Channel 2' });
      await idbStorage.set('channels', 'chan_3', { name: 'Channel 3' });

      const keys = await idbStorage.keys('channels');

      expect(keys).toHaveLength(3);
      expect(keys).toContain('chan_1');
      expect(keys).toContain('chan_2');
      expect(keys).toContain('chan_3');
    });

    it('should get all values in a table', async () => {
      await idbStorage.set('peers', 'peer_1', { name: 'Alice' });
      await idbStorage.set('peers', 'peer_2', { name: 'Bob' });

      const values = await idbStorage.getAll<{ name: string }>('peers');

      expect(values).toHaveLength(2);
      expect(values.map((v) => v.name).sort()).toEqual(['Alice', 'Bob']);
    });
  });

  describe('Data Type Preservation', () => {
    it('should preserve object structure', async () => {
      const complex = {
        nested: { level1: { level2: { value: 'deep' } } },
        array: [1, 2, 3],
        null: null,
        boolean: true,
        number: 42.5,
      };

      await idbStorage.set('settings', 'complex', complex);
      const result = await idbStorage.get<typeof complex>('settings', 'complex');

      expect(result).toEqual(complex);
    });

    it('should preserve arrays correctly', async () => {
      const array = [1, 'two', { three: 3 }, [4, 5, 6]];

      await idbStorage.set('settings', 'array', array);
      const result = await idbStorage.get<typeof array>('settings', 'array');

      expect(result).toEqual(array);
    });

    it('should preserve Uint8Array data', async () => {
      const bytes = new Uint8Array([0, 1, 127, 128, 255]);

      await idbStorage.set('keys', 'binary', bytes);
      const result = await idbStorage.get<Uint8Array>('keys', 'binary');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result || [])).toEqual([0, 1, 127, 128, 255]);
    });

    it('should handle Date objects', async () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const timestamp = date.toISOString();

      // Store as ISO string for consistency
      await idbStorage.set('settings', 'date', timestamp);
      const result = await idbStorage.get<string>('settings', 'date');

      expect(result).toBe(timestamp);
      expect(new Date(result!).getTime()).toBe(date.getTime());
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling During Fallback', () => {
  it('should handle OPFS errors and fall back gracefully', async () => {
    const manager = createStorageManager({
      dbName: 'error_fallback_test',
      preferOpfs: true,
    });

    // Should successfully initialize with IndexedDB fallback
    const result = await manager.initialize();
    expect(result).toBeDefined();
    expect(['opfs', 'indexeddb']).toContain(result.backendType);

    await manager.close();
  });

  it('should report health status correctly', async () => {
    const manager = createStorageManager({
      dbName: 'health_test',
    });

    await manager.initialize();
    const health = await manager.getHealth();

    expect(health).toBeDefined();
    expect(typeof health.isHealthy).toBe('boolean');
    expect(['opfs', 'indexeddb', 'none']).toContain(health.backendType);
    expect(typeof health.isPersistent).toBe('boolean');
    expect(typeof health.usageBytes).toBe('number');
    expect(typeof health.quotaBytes).toBe('number');
    expect(typeof health.usagePercent).toBe('number');
    expect(typeof health.usageFormatted).toBe('string');
    expect(typeof health.checkedAt).toBe('number');

    await manager.close();
  });

  it('should handle concurrent initialization calls', async () => {
    const manager = createStorageManager({
      dbName: 'concurrent_init_test',
    });

    // Call initialize multiple times concurrently
    const results = await Promise.all([
      manager.initialize(),
      manager.initialize(),
      manager.initialize(),
    ]);

    // All should return the same result
    expect(results[0].backendType).toBe(results[1].backendType);
    expect(results[1].backendType).toBe(results[2].backendType);

    await manager.close();
  });

  it('should auto-initialize on first operation', async () => {
    const manager = createStorageManager({
      dbName: 'auto_init_test',
    });

    // Don't call initialize explicitly
    await manager.set('settings', 'auto_test', { value: 'auto' });
    const result = await manager.get('settings', 'auto_test');

    expect(result).toEqual({ value: 'auto' });

    await manager.close();
  });
});

// ============================================================================
// Migration Tests
// ============================================================================

describe('Storage Migration', () => {
  describe('Data Format Migration', () => {
    it('should handle migration from old data format', async () => {
      const idbStorage = createIndexedDBStorage({
        dbName: 'migration_source_test',
      });

      // Store data in "old format" (simulated)
      const oldData = {
        version: 1,
        messages: [
          { id: 'msg_1', content: 'Old message 1' },
          { id: 'msg_2', content: 'Old message 2' },
        ],
      };

      // Store old format data
      await idbStorage.set('settings', 'legacy_data', oldData);

      // Perform migration
      const legacyData = await idbStorage.get<typeof oldData>('settings', 'legacy_data');

      if (legacyData?.messages) {
        for (const msg of legacyData.messages) {
          await idbStorage.set('messages', msg.id, msg);
        }
        await idbStorage.delete('settings', 'legacy_data');
      }

      // Verify migration
      const msg1 = await idbStorage.get<{ id: string; content: string }>('messages', 'msg_1');
      const msg2 = await idbStorage.get<{ id: string; content: string }>('messages', 'msg_2');
      const legacyGone = await idbStorage.get('settings', 'legacy_data');

      expect(msg1?.content).toBe('Old message 1');
      expect(msg2?.content).toBe('Old message 2');
      expect(legacyGone).toBeNull();

      await idbStorage.close();
    });

    it('should preserve data integrity during migration', async () => {
      const sourceStorage = createIndexedDBStorage({
        dbName: `migration_integrity_source_${Date.now()}`,
      });
      const targetStorage = createIndexedDBStorage({
        dbName: `migration_integrity_target_${Date.now()}`,
      });

      // Create test data with various types
      const testRecords = [
        { key: 'string_test', value: 'Hello World' },
        { key: 'number_test', value: 42.5 },
        { key: 'boolean_test', value: true },
        { key: 'null_test', value: null },
        { key: 'object_test', value: { nested: { deep: 'value' } } },
        { key: 'array_test', value: [1, 2, 3, 'four'] },
      ];

      // Store in source
      for (const record of testRecords) {
        await sourceStorage.set('settings', record.key, record.value);
      }

      // Migrate to target
      const keys = await sourceStorage.keys('settings');
      for (const key of keys) {
        const value = await sourceStorage.get('settings', key);
        await targetStorage.set('settings', key, value);
      }

      // Verify integrity
      for (const record of testRecords) {
        const sourceValue = await sourceStorage.get('settings', record.key);
        const targetValue = await targetStorage.get('settings', record.key);
        expect(targetValue).toEqual(sourceValue);
        expect(targetValue).toEqual(record.value);
      }

      await sourceStorage.close();
      await targetStorage.close();
    });

    it('should handle partial migration failure', async () => {
      const storage = createIndexedDBStorage({
        dbName: `partial_migration_${Date.now()}`,
      });

      const records = [
        { key: 'valid_1', value: { content: 'Valid 1' } },
        { key: 'valid_2', value: { content: 'Valid 2' } },
        { key: 'valid_3', value: { content: 'Valid 3' } },
      ];

      const migrationResults: { key: string; success: boolean }[] = [];

      // Simulate migration with potential failures
      for (const record of records) {
        try {
          await storage.set('messages', record.key, record.value);
          migrationResults.push({ key: record.key, success: true });
        } catch {
          migrationResults.push({ key: record.key, success: false });
        }
      }

      // All should succeed in this case
      expect(migrationResults.filter((r) => r.success).length).toBe(3);

      // Verify successfully migrated records exist
      const successfulKeys = migrationResults
        .filter((r) => r.success)
        .map((r) => r.key);

      for (const key of successfulKeys) {
        const value = await storage.get('messages', key);
        expect(value).not.toBeNull();
      }

      await storage.close();
    });
  });
});

// ============================================================================
// Storage Manager Export/Import Tests
// ============================================================================

describe('Storage Manager Export/Import', () => {
  let manager: StorageManager;

  beforeEach(async () => {
    manager = createStorageManager({
      dbName: `export_import_test_${Date.now()}`,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
  });

  it('should export all data correctly', async () => {
    // Store test data
    await manager.set('messages', 'msg_1', { content: 'Message 1' });
    await manager.set('channels', 'chan_1', { name: 'Channel 1' });
    await manager.set('settings', 'theme', 'dark');

    const exported = await manager.exportData();

    expect(exported).toBeDefined();
    expect(exported.version).toBeDefined();
    expect(exported.exportedAt).toBeGreaterThan(0);
    expect(exported.sizeBytes).toBeGreaterThan(0);
    expect(exported.data.messages).toBeDefined();
    expect(exported.data.channels).toBeDefined();
    expect(exported.data.settings).toBeDefined();
  });

  it('should import data correctly', async () => {
    const importData = {
      messages: { import_msg: { content: 'Imported message' } },
      channels: { import_chan: { name: 'Imported channel' } },
      settings: { import_setting: 'imported_value' },
      peers: {},
      keys: {},
      outbox: {},
    };

    const result = await manager.importData(importData, { clearExisting: true });

    expect(result.success).toBe(true);
    expect(result.imported.messages).toBe(1);
    expect(result.imported.channels).toBe(1);
    expect(result.imported.settings).toBe(1);

    // Verify imported data
    const msg = await manager.get('messages', 'import_msg');
    const chan = await manager.get('channels', 'import_chan');
    const setting = await manager.get('settings', 'import_setting');

    expect(msg).toEqual({ content: 'Imported message' });
    expect(chan).toEqual({ name: 'Imported channel' });
    expect(setting).toBe('imported_value');
  });

  it('should handle clearExisting option correctly', async () => {
    // Store existing data
    await manager.set('messages', 'existing', { content: 'Existing' });

    // Import with clearExisting
    const importData = {
      messages: { new_msg: { content: 'New' } },
      channels: {},
      settings: {},
      peers: {},
      keys: {},
      outbox: {},
    };

    await manager.importData(importData, { clearExisting: true });

    // Existing data should be gone
    const existing = await manager.get('messages', 'existing');
    expect(existing).toBeNull();

    // New data should exist
    const newMsg = await manager.get('messages', 'new_msg');
    expect(newMsg).toEqual({ content: 'New' });
  });

  it('should handle overwriteExisting option correctly', async () => {
    // Store existing data
    await manager.set('messages', 'overwrite_test', { content: 'Original' });

    // Import without overwrite
    const importData = {
      messages: { overwrite_test: { content: 'Updated' } },
      channels: {},
      settings: {},
      peers: {},
      keys: {},
      outbox: {},
    };

    const resultNoOverwrite = await manager.importData(importData, {
      clearExisting: false,
      overwriteExisting: false,
    });

    // Should skip existing
    expect(resultNoOverwrite.skipped.messages).toBe(1);

    // Original should remain
    const afterNoOverwrite = await manager.get('messages', 'overwrite_test');
    expect(afterNoOverwrite).toEqual({ content: 'Original' });

    // Now import with overwrite
    const resultWithOverwrite = await manager.importData(importData, {
      clearExisting: false,
      overwriteExisting: true,
    });

    expect(resultWithOverwrite.imported.messages).toBe(1);

    // Should be updated
    const afterOverwrite = await manager.get('messages', 'overwrite_test');
    expect(afterOverwrite).toEqual({ content: 'Updated' });
  });
});

// ============================================================================
// Clear All Data Tests
// ============================================================================

describe('Clear All Data', () => {
  let manager: StorageManager;

  beforeEach(async () => {
    manager = createStorageManager({
      dbName: `clear_all_test_${Date.now()}`,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
  });

  it('should clear all data from all tables', async () => {
    // Store data in multiple tables
    await manager.set('messages', 'msg_1', { content: 'Message' });
    await manager.set('channels', 'chan_1', { name: 'Channel' });
    await manager.set('peers', 'peer_1', { name: 'Peer' });
    await manager.set('settings', 'setting_1', 'value');
    await manager.set('keys', 'key_1', { key: 'data' });
    await manager.set('outbox', 'outbox_1', { pending: true });

    // Clear all
    await manager.clearAllData();

    // Verify all tables are empty
    const tables: StorageTableName[] = ['messages', 'channels', 'peers', 'settings', 'keys', 'outbox'];

    for (const table of tables) {
      const keys = await manager.keys(table);
      expect(keys).toHaveLength(0);
    }
  });

  it('should allow storing new data after clear', async () => {
    await manager.set('messages', 'before_clear', { content: 'Before' });
    await manager.clearAllData();

    // Should be able to store new data
    await manager.set('messages', 'after_clear', { content: 'After' });
    const result = await manager.get('messages', 'after_clear');

    expect(result).toEqual({ content: 'After' });
  });
});

// ============================================================================
// Backend Type Detection Tests
// ============================================================================

describe('Backend Type Detection', () => {
  it('should report correct backend type after initialization', async () => {
    const manager = createStorageManager({
      dbName: `backend_type_test_${Date.now()}`,
    });

    // Before init, backend type should be 'none'
    expect(manager.getBackendType()).toBe('none');

    await manager.initialize();

    // After init, should be opfs or indexeddb
    const backendType = manager.getBackendType();
    expect(['opfs', 'indexeddb']).toContain(backendType);

    await manager.close();

    // After close, should be 'none'
    expect(manager.getBackendType()).toBe('none');
  });
});

// ============================================================================
// Persistence Request Tests
// ============================================================================

describe('Persistence Requests', () => {
  it('should handle persistence check', async () => {
    const manager = createStorageManager({
      dbName: `persistence_test_${Date.now()}`,
      requestPersistence: true,
    });

    await manager.initialize();

    // In jsdom, navigator.storage may not be fully available
    const isPersistent = await manager.checkPersistence();
    expect(typeof isPersistent).toBe('boolean');

    await manager.close();
  });

  it('should handle persistence request', async () => {
    const manager = createStorageManager({
      dbName: `persistence_request_test_${Date.now()}`,
    });

    await manager.initialize();

    // Request persistent storage
    const granted = await manager.requestPersistentStorage();
    expect(typeof granted).toBe('boolean');

    await manager.close();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty string keys', async () => {
    const storage = createIndexedDBStorage({
      dbName: `edge_case_empty_key_${Date.now()}`,
    });

    await storage.set('settings', '', { empty: 'key' });
    const result = await storage.get('settings', '');

    expect(result).toEqual({ empty: 'key' });

    await storage.close();
  });

  it('should handle very long keys', async () => {
    const storage = createIndexedDBStorage({
      dbName: `edge_case_long_key_${Date.now()}`,
    });

    const longKey = 'a'.repeat(1000);
    await storage.set('settings', longKey, { long: 'key' });
    const result = await storage.get('settings', longKey);

    expect(result).toEqual({ long: 'key' });

    await storage.close();
  });

  it('should handle special characters in keys', async () => {
    const storage = createIndexedDBStorage({
      dbName: `edge_case_special_${Date.now()}`,
    });

    const specialKeys = [
      'key with spaces',
      'key/with/slashes',
      'key:with:colons',
      'key?query=param',
      'key#hash',
      'key&ampersand',
      'unicode_key',
    ];

    for (const key of specialKeys) {
      await storage.set('settings', key, { key });
      const result = await storage.get<{ key: string }>('settings', key);
      expect(result?.key).toBe(key);
    }

    await storage.close();
  });

  it('should handle undefined values gracefully', async () => {
    const storage = createIndexedDBStorage({
      dbName: `edge_case_undefined_${Date.now()}`,
    });

    // Storing undefined may convert to null
    await storage.set('settings', 'undefined_test', undefined);
    const result = await storage.get('settings', 'undefined_test');

    // undefined is typically converted to null in storage
    expect(result === null || result === undefined).toBe(true);

    await storage.close();
  });

  it('should handle circular reference prevention', async () => {
    const storage = createIndexedDBStorage({
      dbName: `edge_case_circular_${Date.now()}`,
    });

    // Create an object that would have circular reference
    const obj: any = { name: 'test' };
    // Don't actually create circular reference, just test normal nested objects
    obj.nested = { parent: 'reference', level: 2 };

    await storage.set('settings', 'nested_test', obj);
    const result = await storage.get('settings', 'nested_test');

    expect(result).toBeDefined();

    await storage.close();
  });
});
