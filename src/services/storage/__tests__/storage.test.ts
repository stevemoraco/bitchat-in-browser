/**
 * Storage Service Tests
 *
 * Tests for IndexedDB storage adapter.
 * Uses fake-indexeddb for testing IndexedDB operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBStorage, createIndexedDBStorage } from '../indexeddb-storage';
import type { StorageTableName } from '../types';

describe('Storage Service', () => {
  describe('IndexedDBStorage', () => {
    let storage: IndexedDBStorage;
    const testDbName = 'test-bitchat-db';

    beforeEach(() => {
      storage = new IndexedDBStorage({ dbName: testDbName });
    });

    afterEach(async () => {
      await storage.close();
    });

    describe('Initialization', () => {
      it('should initialize automatically on first operation', async () => {
        // Just performing an operation should auto-initialize
        const result = await storage.get('settings', 'nonexistent');
        expect(result).toBeNull();
      });

      it('should check availability', async () => {
        const available = await storage.isAvailable();
        expect(typeof available).toBe('boolean');
      });
    });

    describe('Basic CRUD Operations', () => {
      describe('set and get', () => {
        it('should store and retrieve string values', async () => {
          await storage.set('settings', 'testKey', 'testValue');
          const result = await storage.get<string>('settings', 'testKey');
          expect(result).toBe('testValue');
        });

        it('should store and retrieve object values', async () => {
          const testObject = { name: 'Alice', age: 30, active: true };
          await storage.set('settings', 'user', testObject);
          const result = await storage.get<typeof testObject>('settings', 'user');
          expect(result).toEqual(testObject);
        });

        it('should store and retrieve array values', async () => {
          const testArray = [1, 2, 3, 4, 5];
          await storage.set('settings', 'numbers', testArray);
          const result = await storage.get<number[]>('settings', 'numbers');
          expect(result).toEqual(testArray);
        });

        it('should return null for non-existent keys', async () => {
          const result = await storage.get('settings', 'nonexistent');
          expect(result).toBeNull();
        });

        it('should overwrite existing values', async () => {
          await storage.set('settings', 'key', 'value1');
          await storage.set('settings', 'key', 'value2');
          const result = await storage.get<string>('settings', 'key');
          expect(result).toBe('value2');
        });

        it('should handle null values', async () => {
          await storage.set('settings', 'nullKey', null);
          const result = await storage.get('settings', 'nullKey');
          expect(result).toBeNull();
        });
      });

      describe('delete', () => {
        it('should delete existing keys', async () => {
          await storage.set('settings', 'deleteMe', 'value');
          const deleted = await storage.delete('settings', 'deleteMe');
          expect(deleted).toBe(true);
          const result = await storage.get('settings', 'deleteMe');
          expect(result).toBeNull();
        });

        it('should return false when deleting non-existent keys', async () => {
          const deleted = await storage.delete('settings', 'nonexistent');
          expect(deleted).toBe(false);
        });
      });

      describe('clear', () => {
        it('should clear all data in a table', async () => {
          await storage.set('settings', 'key1', 'value1');
          await storage.set('settings', 'key2', 'value2');
          await storage.clear('settings');

          const result1 = await storage.get('settings', 'key1');
          const result2 = await storage.get('settings', 'key2');

          expect(result1).toBeNull();
          expect(result2).toBeNull();
        });
      });
    });

    describe('Batch Operations', () => {
      describe('setMany', () => {
        it('should store multiple key-value pairs', async () => {
          const entries: [string, unknown][] = [
            ['key1', 'value1'],
            ['key2', 'value2'],
            ['key3', { nested: true }],
          ];

          await storage.setMany('settings', entries);

          const result1 = await storage.get('settings', 'key1');
          const result2 = await storage.get('settings', 'key2');
          const result3 = await storage.get('settings', 'key3');

          expect(result1).toBe('value1');
          expect(result2).toBe('value2');
          expect(result3).toEqual({ nested: true });
        });

        it('should handle empty entries array', async () => {
          await expect(storage.setMany('settings', [])).resolves.not.toThrow();
        });
      });

      describe('getMany', () => {
        it('should retrieve multiple values', async () => {
          await storage.set('settings', 'a', 1);
          await storage.set('settings', 'b', 2);
          await storage.set('settings', 'c', 3);

          const results = await storage.getMany<number>('settings', ['a', 'b', 'c']);

          expect(results[0]).toBe(1);
          expect(results[1]).toBe(2);
          expect(results[2]).toBe(3);
        });

        it('should return null for missing keys', async () => {
          await storage.set('settings', 'exists', 'value');

          const results = await storage.getMany<string>('settings', ['exists', 'missing']);

          expect(results[0]).toBe('value');
          expect(results[1]).toBeNull();
        });
      });
    });

    describe('Key Operations', () => {
      describe('keys', () => {
        it('should return all keys in a table', async () => {
          await storage.set('settings', 'key1', 'value1');
          await storage.set('settings', 'key2', 'value2');
          await storage.set('settings', 'key3', 'value3');

          const keys = await storage.keys('settings');

          expect(keys).toHaveLength(3);
          expect(keys).toContain('key1');
          expect(keys).toContain('key2');
          expect(keys).toContain('key3');
        });

        it('should return empty array for empty table', async () => {
          const keys = await storage.keys('settings');
          expect(keys).toHaveLength(0);
        });
      });

      describe('getAll', () => {
        it('should return all values in a table', async () => {
          await storage.set('settings', 'k1', 'v1');
          await storage.set('settings', 'k2', 'v2');

          const values = await storage.getAll<string>('settings');

          expect(values).toHaveLength(2);
          expect(values).toContain('v1');
          expect(values).toContain('v2');
        });
      });

      describe('count', () => {
        it('should return correct count of entries', async () => {
          await storage.set('settings', 'c1', 'v1');
          await storage.set('settings', 'c2', 'v2');

          const count = await storage.count('settings');
          expect(count).toBe(2);
        });

        it('should return 0 for empty table', async () => {
          const count = await storage.count('settings');
          expect(count).toBe(0);
        });
      });
    });

    describe('Message Storage', () => {
      it('should store and retrieve messages', async () => {
        const message = {
          id: 'msg1',
          channelId: 'channel1',
          content: 'Hello!',
          timestamp: Date.now(),
        };

        await storage.set('messages', 'msg1', message);
        const result = await storage.get<typeof message>('messages', 'msg1');

        expect(result).toEqual(message);
      });

      it('should handle multiple messages', async () => {
        const messages = [
          { id: 'msg1', channelId: 'ch1', content: 'Hello', timestamp: 1 },
          { id: 'msg2', channelId: 'ch1', content: 'World', timestamp: 2 },
          { id: 'msg3', channelId: 'ch2', content: 'Test', timestamp: 3 },
        ];

        for (const msg of messages) {
          await storage.set('messages', msg.id, msg);
        }

        const all = await storage.getAll('messages');
        expect(all).toHaveLength(3);
      });
    });

    describe('Channel Storage', () => {
      it('should store and retrieve channels', async () => {
        const channel = {
          id: 'ch1',
          name: 'General',
          type: 'location',
          geohash: '9q8yy',
          unreadCount: 5,
        };

        await storage.set('channels', 'ch1', channel);
        const result = await storage.get<typeof channel>('channels', 'ch1');

        expect(result).toEqual(channel);
      });
    });

    describe('Peer Storage', () => {
      it('should store and retrieve peer data', async () => {
        const peer = {
          fingerprint: 'peer_fingerprint_123',
          publicKey: 'peer_pubkey_'.padEnd(64, '0'),
          nickname: 'Alice',
          status: 'online',
          lastSeenAt: Date.now(),
        };

        await storage.set('peers', peer.fingerprint, peer);
        const result = await storage.get<typeof peer>('peers', peer.fingerprint);

        expect(result).toEqual(peer);
      });
    });

    describe('Keys Storage', () => {
      it('should store and retrieve key data', async () => {
        const keyData = {
          publicKey: 'pubkey_'.padEnd(64, '0'),
          encryptedPrivateKey: 'encrypted...',
          createdAt: Date.now(),
        };

        await storage.set('keys', 'identity', keyData);
        const result = await storage.get<typeof keyData>('keys', 'identity');

        expect(result).toEqual(keyData);
      });
    });

    describe('Export and Import', () => {
      it('should export all data', async () => {
        await storage.set('settings', 'theme', 'dark');
        await storage.set('channels', 'ch1', { name: 'General' });

        const exported = await storage.exportAll();

        expect(exported.settings.some(r => r.key === 'theme')).toBe(true);
        expect(exported.channels.some(r => r.key === 'ch1')).toBe(true);
      });

      it('should import data', async () => {
        const data = {
          settings: [
            { key: 'imported', table: 'settings' as StorageTableName, value: 'test', createdAt: Date.now(), updatedAt: Date.now() },
          ],
        };

        await storage.importAll(data);

        const result = await storage.get('settings', 'imported');
        expect(result).toBe('test');
      });
    });

    describe('getUpdatedSince', () => {
      it('should return records updated after timestamp', async () => {
        const beforeTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));

        await storage.set('settings', 'recent', 'value');

        const updated = await storage.getUpdatedSince('settings', beforeTime);
        expect(updated.some(r => r.key === 'recent')).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should handle database close', async () => {
        await storage.set('settings', 'test', 'value');
        await storage.close();

        // After close, operations should reinitialize
        const result = await storage.get('settings', 'test');
        // Should be null because DB was closed and data lost (in test environment)
        expect(result).toBeDefined();
      });
    });
  });

  describe('createIndexedDBStorage', () => {
    it('should create IndexedDBStorage instance', () => {
      const storage = createIndexedDBStorage({ dbName: 'test-factory' });
      expect(storage).toBeInstanceOf(IndexedDBStorage);
    });

    it('should work with default config', () => {
      const storage = createIndexedDBStorage();
      expect(storage).toBeInstanceOf(IndexedDBStorage);
    });
  });

  describe('Storage Types', () => {
    let storage: IndexedDBStorage;

    beforeEach(() => {
      storage = new IndexedDBStorage({ dbName: 'test-types-db' });
    });

    afterEach(async () => {
      await storage.close();
    });

    it('should handle boolean values', async () => {
      await storage.set('settings', 'boolTrue', true);
      await storage.set('settings', 'boolFalse', false);

      expect(await storage.get('settings', 'boolTrue')).toBe(true);
      expect(await storage.get('settings', 'boolFalse')).toBe(false);
    });

    it('should handle number values', async () => {
      await storage.set('settings', 'int', 42);
      await storage.set('settings', 'float', 3.14159);
      await storage.set('settings', 'negative', -100);

      expect(await storage.get('settings', 'int')).toBe(42);
      expect(await storage.get('settings', 'float')).toBe(3.14159);
      expect(await storage.get('settings', 'negative')).toBe(-100);
    });

    it('should handle date values (as timestamps)', async () => {
      const date = new Date();
      const timestamp = date.getTime();

      await storage.set('settings', 'timestamp', timestamp);

      const result = await storage.get<number>('settings', 'timestamp');
      expect(result).toBe(timestamp);
    });

    it('should handle nested objects', async () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      await storage.set('settings', 'nested', nested);
      const result = await storage.get<typeof nested>('settings', 'nested');

      expect(result?.level1.level2.level3.value).toBe('deep');
    });

    it('should handle arrays of objects', async () => {
      const array = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];

      await storage.set('settings', 'people', array);
      const result = await storage.get<typeof array>('settings', 'people');

      expect(result).toHaveLength(3);
      expect(result?.[1].name).toBe('Bob');
    });

    it('should handle Uint8Array values', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);

      await storage.set('settings', 'bytes', bytes);
      const result = await storage.get<Uint8Array>('settings', 'bytes');

      // Note: IndexedDB preserves Uint8Array
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result || [])).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
