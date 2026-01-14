/**
 * Storage Security Tests
 *
 * Comprehensive tests for storage security including:
 * - Data isolation between tables and storage backends
 * - Emergency wipe completeness
 * - No plaintext secrets in storage
 * - Storage backend security characteristics
 *
 * @module storage/__tests__/security
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBStorage } from '../indexeddb-storage';
import { OPFSStorage } from '../opfs-storage';
import { StorageManager, resetStorageManager, createStorageManager } from '../storage-manager';
import { ALL_TABLES, type StorageTableName } from '../types';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Check if a string appears to contain plaintext secrets.
 * Tests for common secret patterns that should never be stored unencrypted.
 */
function containsPlaintextSecret(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  const str = typeof value === 'string' ? value : JSON.stringify(value);

  // Known patterns for secrets (all should be encrypted before storage)
  const secretPatterns = [
    // Nostr private key (nsec)
    /^nsec1[a-z0-9]{58}$/i,
    // Raw 64-char hex private key (unencrypted Ed25519)
    /^[0-9a-f]{64}$/i,
    // Nostr private key in JSON
    /"nsec1[a-z0-9]{58}"/i,
    // Seed phrases (12 or 24 word mnemonic patterns)
    /\b(abandon|ability|able|about|above|absent)\b.*\b(abandon|ability|able|about|above|absent)\b/i,
    // Password in plaintext JSON
    /"password"\s*:\s*"[^"]+"/i,
    // Private key in plaintext JSON
    /"privateKey"\s*:\s*"[0-9a-f]{64}"/i,
    /"private_key"\s*:\s*"[0-9a-f]{64}"/i,
  ];

  return secretPatterns.some(pattern => pattern.test(str));
}

/**
 * Generate test secret data for security testing
 */
function generateTestSecrets(): Record<string, unknown> {
  return {
    privateKey: 'a'.repeat(64), // Simulated 64-char hex private key
    nsec: 'nsec1' + 'a'.repeat(58), // Simulated nsec
    password: 'super_secret_password_123',
    seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  };
}

/**
 * Create encrypted-looking test data (to simulate proper storage)
 */
function createEncryptedTestData(): Record<string, unknown> {
  return {
    encryptedPrivateKey: {
      nonce: 'base64_nonce_value',
      ciphertext: 'base64_encrypted_content',
      salt: 'base64_salt_value',
    },
    publicKey: 'a'.repeat(64), // Public keys are OK in plaintext
    fingerprint: 'ABC123XY',
    createdAt: Date.now(),
  };
}

// ============================================================================
// Data Isolation Tests
// ============================================================================

describe('Storage Security', () => {
  describe('Data Isolation', () => {
    let storage: IndexedDBStorage;
    const testDbName = `security-test-db-${Date.now()}`;

    beforeEach(async () => {
      // Use unique DB name per test to ensure isolation
      storage = new IndexedDBStorage({ dbName: `${testDbName}-${Math.random().toString(36).slice(2)}` });
    });

    afterEach(async () => {
      // Clear all data before closing
      for (const table of ALL_TABLES) {
        await storage.clear(table);
      }
      await storage.close();
      resetStorageManager();
    });

    it('should isolate data between different tables', async () => {
      // Store data in different tables with the same key
      await storage.set('settings', 'testKey', { table: 'settings', value: 'settings_value' });
      await storage.set('messages', 'testKey', { table: 'messages', value: 'messages_value' });
      await storage.set('channels', 'testKey', { table: 'channels', value: 'channels_value' });

      // Retrieve and verify each table has its own isolated data
      const settingsData = await storage.get<{ table: string; value: string }>('settings', 'testKey');
      const messagesData = await storage.get<{ table: string; value: string }>('messages', 'testKey');
      const channelsData = await storage.get<{ table: string; value: string }>('channels', 'testKey');

      expect(settingsData?.table).toBe('settings');
      expect(settingsData?.value).toBe('settings_value');
      expect(messagesData?.table).toBe('messages');
      expect(messagesData?.value).toBe('messages_value');
      expect(channelsData?.table).toBe('channels');
      expect(channelsData?.value).toBe('channels_value');

      // Verify they are truly independent
      expect(settingsData).not.toEqual(messagesData);
      expect(messagesData).not.toEqual(channelsData);
    });

    it('should not leak data between different keys in the same table', async () => {
      // Store sensitive data in keys table
      await storage.set('keys', 'user1_keys', { userId: 'user1', keyData: 'secret1' });
      await storage.set('keys', 'user2_keys', { userId: 'user2', keyData: 'secret2' });

      // Retrieve each user's keys
      const user1Keys = await storage.get<{ userId: string; keyData: string }>('keys', 'user1_keys');
      const user2Keys = await storage.get<{ userId: string; keyData: string }>('keys', 'user2_keys');

      // Verify no cross-contamination
      expect(user1Keys?.userId).toBe('user1');
      expect(user1Keys?.keyData).toBe('secret1');
      expect(user2Keys?.userId).toBe('user2');
      expect(user2Keys?.keyData).toBe('secret2');

      // Verify they don't contain each other's data
      expect(JSON.stringify(user1Keys)).not.toContain('user2');
      expect(JSON.stringify(user2Keys)).not.toContain('user1');
    });

    it('should maintain data isolation after updates', async () => {
      // Initial data
      await storage.set('peers', 'peer1', { name: 'Alice', secret: 'alice_secret' });
      await storage.set('peers', 'peer2', { name: 'Bob', secret: 'bob_secret' });

      // Update one record
      await storage.set('peers', 'peer1', { name: 'Alice Updated', secret: 'new_alice_secret' });

      // Verify the other record is unchanged
      const peer2 = await storage.get<{ name: string; secret: string }>('peers', 'peer2');
      expect(peer2?.name).toBe('Bob');
      expect(peer2?.secret).toBe('bob_secret');
    });

    it('should isolate data when using getAll', async () => {
      // Store data across multiple tables
      await storage.set('messages', 'msg1', { content: 'message content' });
      await storage.set('settings', 'setting1', { theme: 'dark' });

      // getAll should only return data from the specified table
      const allMessages = await storage.getAll('messages');
      const allSettings = await storage.getAll('settings');

      // Verify messages table only has messages
      expect(allMessages.length).toBe(1);
      expect(allMessages[0]).toEqual({ content: 'message content' });

      // Verify settings table only has settings
      expect(allSettings.length).toBe(1);
      expect(allSettings[0]).toEqual({ theme: 'dark' });

      // Verify no cross-contamination
      const messagesStr = JSON.stringify(allMessages);
      const settingsStr = JSON.stringify(allSettings);
      expect(messagesStr).not.toContain('theme');
      expect(settingsStr).not.toContain('content');
    });
  });

  // ============================================================================
  // Plaintext Secret Detection Tests
  // ============================================================================

  describe('No Plaintext Secrets', () => {
    let storage: IndexedDBStorage;
    const testDbName = 'plaintext-test-db';

    beforeEach(() => {
      storage = new IndexedDBStorage({ dbName: testDbName });
    });

    afterEach(async () => {
      await storage.close();
    });

    it('should detect if plaintext secrets are stored in keys table', async () => {
      // This test verifies our detection function works
      const secrets = generateTestSecrets();

      // Store secrets (in real app these should be encrypted)
      await storage.set('keys', 'test_secrets', secrets);

      // Retrieve and check for plaintext secrets
      const storedData = await storage.get('keys', 'test_secrets');

      // Our detection should find these plaintext secrets
      expect(containsPlaintextSecret(storedData)).toBe(true);
    });

    it('should not flag encrypted data as plaintext secrets', async () => {
      const encryptedData = createEncryptedTestData();

      await storage.set('keys', 'encrypted_keys', encryptedData);

      const storedData = await storage.get('keys', 'encrypted_keys');

      // Encrypted data should not trigger secret detection
      // (The public key is allowed in plaintext)
      expect(containsPlaintextSecret(storedData)).toBe(false);
    });

    it('should allow public keys in plaintext', async () => {
      const publicKeyData = {
        publicKey: 'a'.repeat(64),
        npub: 'npub1' + 'a'.repeat(59),
        fingerprint: 'ABC123XY',
      };

      await storage.set('settings', 'identity', publicKeyData);

      const storedData = await storage.get('settings', 'identity');

      // Public key data is safe in plaintext
      expect(storedData).toEqual(publicKeyData);
    });

    it('should properly handle null and undefined values without false positives', async () => {
      await storage.set('settings', 'nullValue', null);

      const storedNull = await storage.get('settings', 'nullValue');
      expect(containsPlaintextSecret(storedNull)).toBe(false);

      // Test with empty object
      await storage.set('settings', 'emptyObj', {});
      const storedEmpty = await storage.get('settings', 'emptyObj');
      expect(containsPlaintextSecret(storedEmpty)).toBe(false);
    });

    it('should verify settings table contains no secrets', async () => {
      // Simulate typical settings data
      const typicalSettings = {
        theme: 'dark',
        notifications: 'all',
        showTimestamps: true,
        nickname: 'TestUser',
        fontSize: 'medium',
        autoJoinLocation: true,
        locationPrecision: 6,
      };

      await storage.set('settings', 'userSettings', typicalSettings);

      const stored = await storage.get('settings', 'userSettings');
      expect(containsPlaintextSecret(stored)).toBe(false);
    });

    it('should verify messages table does not contain key material', async () => {
      const typicalMessage = {
        id: 'msg_001',
        content: 'Hello, this is a test message!',
        senderId: 'abc123',
        channelId: 'channel_001',
        timestamp: Date.now(),
        status: 'delivered',
      };

      await storage.set('messages', 'msg_001', typicalMessage);

      const stored = await storage.get('messages', 'msg_001');
      expect(containsPlaintextSecret(stored)).toBe(false);
    });
  });

  // ============================================================================
  // Emergency Wipe Tests
  // ============================================================================

  describe('Emergency Wipe', () => {
    let storageManager: StorageManager;

    beforeEach(() => {
      resetStorageManager();
      storageManager = createStorageManager({
        dbName: 'wipe-test-db',
        preferOpfs: false, // Use IndexedDB for consistent testing
      });
    });

    afterEach(async () => {
      await storageManager.close();
      resetStorageManager();
    });

    it('should clear all tables on wipe', async () => {
      // Initialize storage
      await storageManager.initialize();

      // Populate all tables with data
      const testData = { test: 'data', timestamp: Date.now() };
      for (const tableName of ALL_TABLES) {
        await storageManager.set(tableName, 'testKey1', { ...testData, table: tableName });
        await storageManager.set(tableName, 'testKey2', { ...testData, table: tableName, key: 2 });
      }

      // Verify data exists in all tables
      for (const tableName of ALL_TABLES) {
        const keys = await storageManager.keys(tableName);
        expect(keys.length).toBeGreaterThan(0);
      }

      // Perform emergency wipe
      await storageManager.clearAllData();

      // Verify all tables are empty
      for (const tableName of ALL_TABLES) {
        const keys = await storageManager.keys(tableName);
        expect(keys).toHaveLength(0);

        const allData = await storageManager.getAll(tableName);
        expect(allData).toHaveLength(0);
      }
    });

    it('should leave no residual data after wipe', async () => {
      await storageManager.initialize();

      // Store sensitive data
      await storageManager.set('keys', 'identity', createEncryptedTestData());
      await storageManager.set('settings', 'user', { nickname: 'TestUser' });
      await storageManager.set('messages', 'msg1', { content: 'Secret message' });
      await storageManager.set('peers', 'peer1', { fingerprint: 'ABC123' });
      await storageManager.set('channels', 'ch1', { name: 'Private Channel' });
      await storageManager.set('outbox', 'pending1', { message: 'Pending message' });

      // Wipe
      await storageManager.clearAllData();

      // Attempt to retrieve any data
      const tables: StorageTableName[] = ['keys', 'settings', 'messages', 'peers', 'channels', 'outbox'];

      for (const table of tables) {
        const keys = await storageManager.keys(table);
        expect(keys).toHaveLength(0);

        // Try to get the specific keys we stored
        const data = await storageManager.get(table, ['identity', 'user', 'msg1', 'peer1', 'ch1', 'pending1'][tables.indexOf(table)]);
        expect(data).toBeNull();
      }
    });

    it('should wipe data even if some tables are empty', async () => {
      await storageManager.initialize();

      // Only populate some tables
      await storageManager.set('settings', 'test', { value: 1 });
      await storageManager.set('messages', 'test', { value: 2 });
      // Leave keys, peers, channels, outbox empty

      // Wipe should not throw on empty tables
      await expect(storageManager.clearAllData()).resolves.not.toThrow();

      // Verify populated tables are cleared
      expect(await storageManager.get('settings', 'test')).toBeNull();
      expect(await storageManager.get('messages', 'test')).toBeNull();
    });

    it('should be irreversible - data cannot be recovered after wipe', async () => {
      await storageManager.initialize();

      // Store data
      const sensitiveData = { secret: 'cannot be recovered' };
      await storageManager.set('keys', 'sensitive', sensitiveData);

      // Get reference to the data before wipe
      const beforeWipe = await storageManager.get('keys', 'sensitive');
      expect(beforeWipe).toEqual(sensitiveData);

      // Wipe
      await storageManager.clearAllData();

      // Data is gone
      const afterWipe = await storageManager.get('keys', 'sensitive');
      expect(afterWipe).toBeNull();

      // Even re-initializing doesn't bring it back
      await storageManager.close();
      const newManager = createStorageManager({
        dbName: 'wipe-test-db',
        preferOpfs: false,
      });
      await newManager.initialize();

      const afterReinit = await newManager.get('keys', 'sensitive');
      expect(afterReinit).toBeNull();

      await newManager.close();
    });

    it('should clear all data across multiple storage managers', async () => {
      await storageManager.initialize();

      // Store data via the first manager
      await storageManager.set('settings', 'testFromManager1', { value: 'manager1' });

      // Create second manager pointing to same DB
      const manager2 = createStorageManager({
        dbName: 'wipe-test-db',
        preferOpfs: false,
      });
      await manager2.initialize();

      // Store data via second manager
      await manager2.set('settings', 'testFromManager2', { value: 'manager2' });

      // Wipe via first manager
      await storageManager.clearAllData();

      // Verify both managers see empty data
      expect(await storageManager.get('settings', 'testFromManager1')).toBeNull();
      expect(await storageManager.get('settings', 'testFromManager2')).toBeNull();

      // Re-read from second manager (may need to refresh)
      expect(await manager2.get('settings', 'testFromManager1')).toBeNull();
      expect(await manager2.get('settings', 'testFromManager2')).toBeNull();

      await manager2.close();
    });
  });

  // ============================================================================
  // Storage Backend Security Tests
  // ============================================================================

  describe('Storage Backend Security', () => {
    describe('IndexedDB Storage', () => {
      let storage: IndexedDBStorage;

      beforeEach(() => {
        storage = new IndexedDBStorage({ dbName: 'backend-test-db' });
      });

      afterEach(async () => {
        await storage.close();
      });

      it('should handle storage availability check', async () => {
        const isAvailable = await storage.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      });

      it('should maintain data integrity on set/get cycle', async () => {
        const complexData = {
          nested: {
            deeply: {
              value: 'test',
              array: [1, 2, 3],
              binary: new Uint8Array([1, 2, 3, 4, 5]),
            },
          },
          timestamp: Date.now(),
          special: 'characters: <>&"\'/\\',
        };

        await storage.set('settings', 'complex', complexData);
        const retrieved = await storage.get<typeof complexData>('settings', 'complex');

        expect(retrieved?.nested.deeply.value).toBe('test');
        expect(retrieved?.nested.deeply.array).toEqual([1, 2, 3]);
        expect(retrieved?.special).toBe('characters: <>&"\'/\\');
        // Note: Uint8Array may be serialized differently, so we check content
        if (retrieved?.nested.deeply.binary) {
          const binaryArray = Array.from(
            retrieved.nested.deeply.binary instanceof Uint8Array
              ? retrieved.nested.deeply.binary
              : Object.values(retrieved.nested.deeply.binary)
          );
          expect(binaryArray).toEqual([1, 2, 3, 4, 5]);
        }
      });

      it('should handle large data without corruption', async () => {
        // Create a 1MB string
        const largeString = 'x'.repeat(1024 * 1024);

        await storage.set('settings', 'largeData', { content: largeString });
        const retrieved = await storage.get<{ content: string }>('settings', 'largeData');

        expect(retrieved?.content.length).toBe(largeString.length);
        expect(retrieved?.content).toBe(largeString);
      });

      it('should handle concurrent writes without data loss', async () => {
        // Perform multiple concurrent writes
        const writes = Array.from({ length: 10 }, (_, i) =>
          storage.set('messages', `msg_${i}`, { id: i, content: `Message ${i}` })
        );

        await Promise.all(writes);

        // Verify all data was written
        const keys = await storage.keys('messages');
        expect(keys.length).toBe(10);

        // Verify data integrity
        for (let i = 0; i < 10; i++) {
          const msg = await storage.get<{ id: number; content: string }>('messages', `msg_${i}`);
          expect(msg?.id).toBe(i);
          expect(msg?.content).toBe(`Message ${i}`);
        }
      });

      it('should properly handle database close and reopen', async () => {
        await storage.set('settings', 'persistTest', { value: 'persist' });

        await storage.close();

        // Create new storage instance
        const newStorage = new IndexedDBStorage({ dbName: 'backend-test-db' });
        const retrieved = await newStorage.get<{ value: string }>('settings', 'persistTest');

        expect(retrieved?.value).toBe('persist');

        await newStorage.close();
      });
    });

    describe('Storage Manager Backend Selection', () => {
      afterEach(() => {
        resetStorageManager();
      });

      it('should report the active backend type', async () => {
        const manager = createStorageManager({
          preferOpfs: false, // Force IndexedDB for test consistency
        });
        await manager.initialize();

        const backendType = manager.getBackendType();
        expect(['opfs', 'indexeddb', 'none']).toContain(backendType);

        await manager.close();
      });

      it('should fall back to IndexedDB when OPFS is unavailable', async () => {
        const manager = createStorageManager({
          preferOpfs: false,
        });

        const result = await manager.initialize();

        // In test environment, we typically use IndexedDB
        expect(result.backendType).toBe('indexeddb');

        await manager.close();
      });

      it('should maintain data integrity across backend selection', async () => {
        const manager = createStorageManager({
          dbName: 'integrity-test',
          preferOpfs: false,
        });
        await manager.initialize();

        const testData = { test: 'integrity', timestamp: Date.now() };
        await manager.set('settings', 'integrityTest', testData);

        const retrieved = await manager.get<typeof testData>('settings', 'integrityTest');
        expect(retrieved).toEqual(testData);

        await manager.close();
      });
    });

    describe('Storage Health Monitoring', () => {
      it('should report storage health status', async () => {
        const manager = createStorageManager({ preferOpfs: false });
        await manager.initialize();

        const health = await manager.getHealth();

        expect(typeof health.isHealthy).toBe('boolean');
        expect(['opfs', 'indexeddb', 'none']).toContain(health.backendType);
        expect(typeof health.usageBytes).toBe('number');
        expect(typeof health.quotaBytes).toBe('number');
        expect(typeof health.usagePercent).toBe('number');
        expect(typeof health.usageFormatted).toBe('string');
        expect(typeof health.checkedAt).toBe('number');

        await manager.close();
      });

      it('should report persistence status', async () => {
        const manager = createStorageManager({
          requestPersistence: true,
          preferOpfs: false,
        });
        await manager.initialize();

        const health = await manager.getHealth();
        expect(typeof health.isPersistent).toBe('boolean');

        await manager.close();
      });
    });
  });

  // ============================================================================
  // Export/Import Security Tests
  // ============================================================================

  describe('Export/Import Security', () => {
    let manager: StorageManager;

    beforeEach(async () => {
      resetStorageManager();
      manager = createStorageManager({
        dbName: 'export-import-test',
        preferOpfs: false,
      });
      await manager.initialize();
    });

    afterEach(async () => {
      await manager.close();
      resetStorageManager();
    });

    it('should export all data accurately', async () => {
      // Store data
      await manager.set('settings', 'theme', { mode: 'dark' });
      await manager.set('channels', 'ch1', { name: 'Test Channel' });
      await manager.set('messages', 'msg1', { content: 'Hello' });

      const exported = await manager.exportData();

      expect(exported.version).toBeDefined();
      expect(exported.exportedAt).toBeDefined();
      expect(exported.sizeBytes).toBeGreaterThan(0);
      expect(exported.data.settings['theme']).toEqual({ mode: 'dark' });
      expect(exported.data.channels['ch1']).toEqual({ name: 'Test Channel' });
      expect(exported.data.messages['msg1']).toEqual({ content: 'Hello' });
    });

    it('should import data without corrupting existing data', async () => {
      // Existing data
      await manager.set('settings', 'existing', { value: 'keep' });

      // Import new data (without clearing)
      const importData = {
        settings: { imported: { value: 'new' } },
        messages: { msg1: { content: 'Imported message' } },
      };

      const result = await manager.importData(importData, { clearExisting: false });

      expect(result.success).toBe(true);

      // Verify existing data is preserved
      const existing = await manager.get('settings', 'existing');
      expect(existing).toEqual({ value: 'keep' });

      // Verify imported data
      const imported = await manager.get('settings', 'imported');
      expect(imported).toEqual({ value: 'new' });
    });

    it('should clear existing data when clearExisting is true', async () => {
      await manager.set('settings', 'toBeCleared', { value: 'old' });

      const importData = {
        settings: { new: { value: 'imported' } },
      };

      await manager.importData(importData, { clearExisting: true, tables: ['settings'] });

      // Old data should be gone
      const cleared = await manager.get('settings', 'toBeCleared');
      expect(cleared).toBeNull();

      // New data should exist
      const newData = await manager.get('settings', 'new');
      expect(newData).toEqual({ value: 'imported' });
    });

    it('should handle export of sensitive tables', async () => {
      // Store encrypted key data (simulated)
      const encryptedKeys = createEncryptedTestData();
      await manager.set('keys', 'identity', encryptedKeys);

      const exported = await manager.exportData();

      // Verify keys table is included in export
      expect(exported.data.keys['identity']).toBeDefined();

      // The exported data should be encrypted (not plaintext secrets)
      expect(containsPlaintextSecret(exported.data.keys['identity'])).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Security Edge Cases', () => {
    let storage: IndexedDBStorage;

    beforeEach(() => {
      storage = new IndexedDBStorage({ dbName: 'edge-case-test' });
    });

    afterEach(async () => {
      await storage.close();
    });

    it('should handle special characters in keys safely', async () => {
      const specialKeys = [
        'key-with-dash',
        'key_with_underscore',
        'key.with.dots',
        'key/with/slashes',
        'key with spaces',
        'key<with>brackets',
        'key"with"quotes',
        "key'with'apostrophes",
      ];

      for (const key of specialKeys) {
        await storage.set('settings', key, { keyName: key });
        const retrieved = await storage.get<{ keyName: string }>('settings', key);
        expect(retrieved?.keyName).toBe(key);
      }
    });

    it('should handle Unicode in data safely', async () => {
      const unicodeData = {
        emoji: 'Hello! This is a test message!',
        chinese: 'Testing Chinese characters',
        arabic: 'Testing Arabic',
        special: 'Zero-width: |\u200B| joiner: |\u200D|',
      };

      await storage.set('messages', 'unicode', unicodeData);
      const retrieved = await storage.get<typeof unicodeData>('messages', 'unicode');

      expect(retrieved?.emoji).toBe(unicodeData.emoji);
      expect(retrieved?.chinese).toBe(unicodeData.chinese);
      expect(retrieved?.arabic).toBe(unicodeData.arabic);
      expect(retrieved?.special).toBe(unicodeData.special);
    });

    it('should handle deletion of non-existent keys gracefully', async () => {
      const result = await storage.delete('settings', 'nonexistent_key');
      expect(result).toBe(false);
    });

    it('should handle clearing already empty tables', async () => {
      // Table should be empty initially
      const keysBefore = await storage.keys('outbox');
      expect(keysBefore.length).toBe(0);

      // Clear should not throw
      await expect(storage.clear('outbox')).resolves.not.toThrow();

      // Table should still be empty
      const keysAfter = await storage.keys('outbox');
      expect(keysAfter.length).toBe(0);
    });

    it('should handle very long keys', async () => {
      const longKey = 'k'.repeat(1000);

      await storage.set('settings', longKey, { value: 'longKeyTest' });
      const retrieved = await storage.get<{ value: string }>('settings', longKey);

      expect(retrieved?.value).toBe('longKeyTest');
    });
  });
});
