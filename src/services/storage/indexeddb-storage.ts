/**
 * IndexedDB Storage Adapter
 *
 * Implements the StorageAdapter interface using Dexie.js for IndexedDB access.
 * This is the fallback storage mechanism when OPFS is not available.
 *
 * Features:
 * - Full CRUD operations for all BitChat data tables
 * - Automatic retry on transient failures
 * - Safari compatibility handling
 * - Proper error wrapping
 *
 * @module storage/indexeddb-storage
 */

import Dexie, { type Table } from 'dexie';
import {
  type StorageAdapter,
  type StorageTableName,
  type StorageConfig,
  type StoredRecord,
  StorageError,
  DEFAULT_STORAGE_CONFIG,
  ALL_TABLES,
} from './types';

/**
 * Schema definition for the BitChat IndexedDB database.
 * Each table stores records with metadata.
 */
interface BitChatDB extends Dexie {
  messages: Table<StoredRecord>;
  channels: Table<StoredRecord>;
  peers: Table<StoredRecord>;
  keys: Table<StoredRecord>;
  settings: Table<StoredRecord>;
  outbox: Table<StoredRecord>;
}

/**
 * IndexedDB-based storage adapter using Dexie.js.
 *
 * Provides a reliable, well-supported storage backend that works across
 * all major browsers. While OPFS is preferred when available, IndexedDB
 * is the universal fallback.
 *
 * @example
 * ```typescript
 * const storage = new IndexedDBStorage({ dbName: 'bitchat' });
 * await storage.set('messages', 'msg_123', { content: 'Hello!' });
 * const message = await storage.get('messages', 'msg_123');
 * ```
 */
export class IndexedDBStorage implements StorageAdapter {
  private db: BitChatDB;
  private config: Required<StorageConfig>;
  private isInitialized = false;

  /**
   * Create a new IndexedDB storage adapter.
   *
   * @param config - Storage configuration options
   */
  constructor(config: StorageConfig = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.db = this.createDatabase();
  }

  /**
   * Create and configure the Dexie database instance.
   */
  private createDatabase(): BitChatDB {
    const db = new Dexie(this.config.dbName) as BitChatDB;

    // Define schema version 1
    // Using 'key' as primary key, with indexes on table and timestamps
    db.version(this.config.version).stores({
      messages: 'key, table, createdAt, updatedAt',
      channels: 'key, table, createdAt, updatedAt',
      peers: 'key, table, createdAt, updatedAt',
      keys: 'key, table, createdAt, updatedAt',
      settings: 'key, table, createdAt, updatedAt',
      outbox: 'key, table, createdAt, updatedAt',
    });

    return db;
  }

  /**
   * Ensure the database is open and ready.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.db.open();
      this.isInitialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to open IndexedDB database: ${error instanceof Error ? error.message : String(error)}`,
        'initialize',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Get the Dexie table for the specified table name.
   *
   * @param table - The storage table name
   * @returns The Dexie table instance
   */
  private getTable(table: StorageTableName): Table<StoredRecord> {
    switch (table) {
      case 'messages':
        return this.db.messages;
      case 'channels':
        return this.db.channels;
      case 'peers':
        return this.db.peers;
      case 'keys':
        return this.db.keys;
      case 'settings':
        return this.db.settings;
      case 'outbox':
        return this.db.outbox;
      default:
        throw new StorageError(
          `Unknown table: ${table}`,
          'getTable',
          { table }
        );
    }
  }

  /**
   * Execute an operation with retry logic for transient failures.
   *
   * @param operation - Name of the operation for error reporting
   * @param fn - The async function to execute
   * @returns The result of the function
   */
  private async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: { table?: StorageTableName; key?: string }
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt === this.config.maxRetries - 1) {
          throw new StorageError(
            `${operation} failed: ${lastError.message}`,
            operation,
            { ...options, cause: lastError }
          );
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }

    // This shouldn't be reached, but TypeScript needs it
    throw new StorageError(
      `${operation} failed after ${this.config.maxRetries} attempts`,
      operation,
      { ...options, cause: lastError }
    );
  }

  /**
   * Check if an error is transient and can be retried.
   *
   * @param error - The error to check
   * @returns True if the operation should be retried
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Safari quirk: Sometimes throws "Internal error" on first access
    if (message.includes('internal error')) return true;

    // Database might be blocked by another connection
    if (message.includes('database is blocked')) return true;
    if (message.includes('blocked')) return true;

    // Version change transaction interrupted
    if (message.includes('version change')) return true;

    // Connection closed unexpectedly
    if (message.includes('connection')) return true;

    return false;
  }

  /**
   * Delay helper for retry logic.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @inheritdoc
   */
  async get<T = unknown>(
    table: StorageTableName,
    key: string
  ): Promise<T | null> {
    await this.ensureInitialized();

    return this.withRetry(
      'get',
      async () => {
        const dexieTable = this.getTable(table);
        const record = await dexieTable.get(key);
        return record ? (record.value as T) : null;
      },
      { table, key }
    );
  }

  /**
   * @inheritdoc
   */
  async set<T = unknown>(
    table: StorageTableName,
    key: string,
    value: T
  ): Promise<void> {
    await this.ensureInitialized();

    return this.withRetry(
      'set',
      async () => {
        const dexieTable = this.getTable(table);
        const now = Date.now();

        // Check if record exists to preserve createdAt
        const existing = await dexieTable.get(key);

        const record: StoredRecord<T> = {
          key,
          table,
          value,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        await dexieTable.put(record);
      },
      { table, key }
    );
  }

  /**
   * @inheritdoc
   */
  async delete(table: StorageTableName, key: string): Promise<boolean> {
    await this.ensureInitialized();

    return this.withRetry(
      'delete',
      async () => {
        const dexieTable = this.getTable(table);

        // Check if the record exists first
        const existing = await dexieTable.get(key);
        if (!existing) return false;

        await dexieTable.delete(key);
        return true;
      },
      { table, key }
    );
  }

  /**
   * @inheritdoc
   */
  async clear(table: StorageTableName): Promise<void> {
    await this.ensureInitialized();

    return this.withRetry(
      'clear',
      async () => {
        const dexieTable = this.getTable(table);
        await dexieTable.clear();
      },
      { table }
    );
  }

  /**
   * @inheritdoc
   */
  async keys(table: StorageTableName): Promise<string[]> {
    await this.ensureInitialized();

    return this.withRetry(
      'keys',
      async () => {
        const dexieTable = this.getTable(table);
        const records = await dexieTable.toArray();
        return records.map((r) => r.key);
      },
      { table }
    );
  }

  /**
   * @inheritdoc
   */
  async getAll<T = unknown>(table: StorageTableName): Promise<T[]> {
    await this.ensureInitialized();

    return this.withRetry(
      'getAll',
      async () => {
        const dexieTable = this.getTable(table);
        const records = await dexieTable.toArray();
        return records.map((r) => r.value as T);
      },
      { table }
    );
  }

  /**
   * @inheritdoc
   */
  async getMany<T = unknown>(
    table: StorageTableName,
    keys: string[]
  ): Promise<(T | null)[]> {
    await this.ensureInitialized();

    return this.withRetry(
      'getMany',
      async () => {
        const dexieTable = this.getTable(table);
        const records = await dexieTable.bulkGet(keys);
        return records.map((r) => (r ? (r.value as T) : null));
      },
      { table }
    );
  }

  /**
   * @inheritdoc
   */
  async setMany<T = unknown>(
    table: StorageTableName,
    entries: [string, T][]
  ): Promise<void> {
    await this.ensureInitialized();

    return this.withRetry(
      'setMany',
      async () => {
        const dexieTable = this.getTable(table);
        const now = Date.now();

        // Get existing records to preserve createdAt
        const existingKeys = entries.map(([key]) => key);
        const existingRecords = await dexieTable.bulkGet(existingKeys);
        const existingMap = new Map(
          existingRecords
            .filter((r): r is StoredRecord => r !== undefined)
            .map((r) => [r.key, r])
        );

        const records: StoredRecord<T>[] = entries.map(([key, value]) => ({
          key,
          table,
          value,
          createdAt: existingMap.get(key)?.createdAt ?? now,
          updatedAt: now,
        }));

        await dexieTable.bulkPut(records);
      },
      { table }
    );
  }

  /**
   * @inheritdoc
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if IndexedDB is available
      if (typeof indexedDB === 'undefined') {
        return false;
      }

      // Try to open a test database
      const testDbName = `${this.config.dbName}_test_${Date.now()}`;
      const testDb = new Dexie(testDbName);
      testDb.version(1).stores({ test: 'id' });

      await testDb.open();
      await testDb.close();

      // Clean up test database
      await Dexie.delete(testDbName);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  async close(): Promise<void> {
    if (this.isInitialized) {
      this.db.close();
      this.isInitialized = false;
    }
  }

  /**
   * Delete the entire database.
   * Use with caution - this is destructive!
   */
  async deleteDatabase(): Promise<void> {
    await this.close();
    await Dexie.delete(this.config.dbName);
  }

  /**
   * Get the count of records in a table.
   *
   * @param table - The table name
   * @returns The number of records
   */
  async count(table: StorageTableName): Promise<number> {
    await this.ensureInitialized();

    return this.withRetry(
      'count',
      async () => {
        const dexieTable = this.getTable(table);
        return await dexieTable.count();
      },
      { table }
    );
  }

  /**
   * Get all records that were updated after a given timestamp.
   * Useful for sync operations.
   *
   * @param table - The table name
   * @param since - Timestamp in milliseconds
   * @returns Records updated after the given time
   */
  async getUpdatedSince<T = unknown>(
    table: StorageTableName,
    since: number
  ): Promise<Array<{ key: string; value: T; updatedAt: number }>> {
    await this.ensureInitialized();

    return this.withRetry(
      'getUpdatedSince',
      async () => {
        const dexieTable = this.getTable(table);
        const records = await dexieTable
          .where('updatedAt')
          .above(since)
          .toArray();

        return records.map((r) => ({
          key: r.key,
          value: r.value as T,
          updatedAt: r.updatedAt,
        }));
      },
      { table }
    );
  }

  /**
   * Export all data from all tables.
   * Useful for backup operations.
   *
   * @returns All data organized by table
   */
  async exportAll(): Promise<Record<StorageTableName, StoredRecord[]>> {
    await this.ensureInitialized();

    const result = {} as Record<StorageTableName, StoredRecord[]>;

    for (const tableName of ALL_TABLES) {
      const dexieTable = this.getTable(tableName);
      result[tableName] = await dexieTable.toArray();
    }

    return result;
  }

  /**
   * Import data into all tables.
   * Useful for restore operations.
   *
   * @param data - Data organized by table
   * @param clearExisting - Whether to clear existing data first
   */
  async importAll(
    data: Partial<Record<StorageTableName, StoredRecord[]>>,
    clearExisting = false
  ): Promise<void> {
    await this.ensureInitialized();

    await this.db.transaction('rw', [...ALL_TABLES.map(t => this.getTable(t))], async () => {
      for (const tableName of ALL_TABLES) {
        if (data[tableName]) {
          const dexieTable = this.getTable(tableName);

          if (clearExisting) {
            await dexieTable.clear();
          }

          await dexieTable.bulkPut(data[tableName]);
        }
      }
    });
  }
}

/**
 * Create a new IndexedDB storage adapter with the given configuration.
 *
 * @param config - Storage configuration options
 * @returns A new IndexedDBStorage instance
 *
 * @example
 * ```typescript
 * const storage = createIndexedDBStorage({ dbName: 'myapp' });
 * await storage.set('settings', 'theme', { mode: 'dark' });
 * ```
 */
export function createIndexedDBStorage(
  config?: StorageConfig
): IndexedDBStorage {
  return new IndexedDBStorage(config);
}
