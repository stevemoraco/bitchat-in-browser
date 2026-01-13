/**
 * Storage Abstraction Layer Types
 *
 * Defines interfaces for storage adapters that work with both
 * IndexedDB (via Dexie.js) and OPFS (Origin Private File System).
 *
 * @module storage/types
 */

/**
 * Supported storage table names for the BitChat application.
 * Each table stores a specific type of data.
 */
export type StorageTableName =
  | 'messages'   // Chat messages
  | 'channels'   // Channel metadata
  | 'peers'      // Known peers/contacts
  | 'keys'       // Cryptographic keys (encrypted)
  | 'settings'   // User preferences
  | 'outbox';    // Pending messages to be sent

/**
 * Generic storage adapter interface that all storage implementations must follow.
 * Provides basic CRUD operations plus enumeration capabilities.
 *
 * @template T - The type of values stored
 */
export interface StorageAdapter<T = unknown> {
  /**
   * Retrieve a value by key from the specified table.
   *
   * @param table - The table name to query
   * @param key - The unique key identifying the value
   * @returns The stored value or null if not found
   *
   * @example
   * ```typescript
   * const message = await adapter.get('messages', 'msg_123');
   * ```
   */
  get(table: StorageTableName, key: string): Promise<T | null>;

  /**
   * Store a value with the specified key in the given table.
   * If a value already exists with this key, it will be overwritten.
   *
   * @param table - The table name to store in
   * @param key - The unique key for the value
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * await adapter.set('messages', 'msg_123', { content: 'Hello', timestamp: Date.now() });
   * ```
   */
  set(table: StorageTableName, key: string, value: T): Promise<void>;

  /**
   * Delete a value by key from the specified table.
   *
   * @param table - The table name to delete from
   * @param key - The key of the value to delete
   * @returns True if the value was deleted, false if it didn't exist
   *
   * @example
   * ```typescript
   * const wasDeleted = await adapter.delete('messages', 'msg_123');
   * ```
   */
  delete(table: StorageTableName, key: string): Promise<boolean>;

  /**
   * Clear all values from the specified table.
   *
   * @param table - The table name to clear
   *
   * @example
   * ```typescript
   * await adapter.clear('outbox');
   * ```
   */
  clear(table: StorageTableName): Promise<void>;

  /**
   * Get all keys in the specified table.
   *
   * @param table - The table name to enumerate
   * @returns Array of all keys in the table
   *
   * @example
   * ```typescript
   * const messageKeys = await adapter.keys('messages');
   * // ['msg_001', 'msg_002', 'msg_003']
   * ```
   */
  keys(table: StorageTableName): Promise<string[]>;

  /**
   * Get all values from the specified table.
   * Use with caution on large tables.
   *
   * @param table - The table name to read
   * @returns Array of all values in the table
   *
   * @example
   * ```typescript
   * const allMessages = await adapter.getAll('messages');
   * ```
   */
  getAll(table: StorageTableName): Promise<T[]>;

  /**
   * Get multiple values by their keys from the specified table.
   *
   * @param table - The table name to query
   * @param keys - Array of keys to retrieve
   * @returns Array of values (null for any keys not found)
   *
   * @example
   * ```typescript
   * const messages = await adapter.getMany('messages', ['msg_001', 'msg_002']);
   * ```
   */
  getMany(table: StorageTableName, keys: string[]): Promise<(T | null)[]>;

  /**
   * Store multiple key-value pairs in the specified table.
   * This is more efficient than calling set() multiple times.
   *
   * @param table - The table name to store in
   * @param entries - Array of [key, value] pairs to store
   *
   * @example
   * ```typescript
   * await adapter.setMany('messages', [
   *   ['msg_001', { content: 'Hello' }],
   *   ['msg_002', { content: 'World' }]
   * ]);
   * ```
   */
  setMany(table: StorageTableName, entries: [string, T][]): Promise<void>;

  /**
   * Check if the storage adapter is available and working.
   *
   * @returns True if storage is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Close the storage connection and release resources.
   */
  close(): Promise<void>;
}

/**
 * Configuration options for storage initialization.
 */
export interface StorageConfig {
  /**
   * Name of the database/storage area.
   * @default 'bitchat'
   */
  dbName?: string;

  /**
   * Database schema version for migrations.
   * @default 1
   */
  version?: number;

  /**
   * Whether to request persistent storage from the browser.
   * @default true
   */
  requestPersistence?: boolean;

  /**
   * Whether to prefer OPFS over IndexedDB when available.
   * @default true
   */
  preferOpfs?: boolean;

  /**
   * Maximum retry attempts for failed operations.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay in milliseconds between retry attempts.
   * @default 100
   */
  retryDelay?: number;
}

/**
 * Health information about the storage system.
 */
export interface StorageHealth {
  /**
   * Whether storage is currently operational.
   */
  isHealthy: boolean;

  /**
   * The type of storage backend being used.
   */
  backendType: 'opfs' | 'indexeddb' | 'none';

  /**
   * Whether persistent storage has been granted by the browser.
   */
  isPersistent: boolean;

  /**
   * Current storage usage in bytes.
   */
  usageBytes: number;

  /**
   * Storage quota in bytes (may be estimate).
   */
  quotaBytes: number;

  /**
   * Percentage of quota used (0-100).
   */
  usagePercent: number;

  /**
   * Human-readable usage string (e.g., "5.2 MB / 50 MB").
   */
  usageFormatted: string;

  /**
   * Timestamp of when this health check was performed.
   */
  checkedAt: number;

  /**
   * Any error that occurred during the health check.
   */
  error?: string;
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  /**
   * The exported data as a JSON-serializable object.
   */
  data: Record<StorageTableName, Record<string, unknown>>;

  /**
   * Version of the export format.
   */
  version: number;

  /**
   * Timestamp of when the export was created.
   */
  exportedAt: number;

  /**
   * Size of the export in bytes.
   */
  sizeBytes: number;
}

/**
 * Options for import operations.
 */
export interface ImportOptions {
  /**
   * Whether to clear existing data before importing.
   * @default false
   */
  clearExisting?: boolean;

  /**
   * Whether to overwrite existing keys with imported values.
   * @default true
   */
  overwriteExisting?: boolean;

  /**
   * Tables to import (if not specified, all tables are imported).
   */
  tables?: StorageTableName[];
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /**
   * Whether the import was successful.
   */
  success: boolean;

  /**
   * Number of records imported per table.
   */
  imported: Record<StorageTableName, number>;

  /**
   * Number of records skipped per table.
   */
  skipped: Record<StorageTableName, number>;

  /**
   * Any errors that occurred during import.
   */
  errors: string[];
}

/**
 * Stored record wrapper that includes metadata.
 * Used internally by storage adapters.
 */
export interface StoredRecord<T = unknown> {
  /**
   * The unique key for this record.
   */
  key: string;

  /**
   * The table this record belongs to.
   */
  table: StorageTableName;

  /**
   * The actual stored value.
   */
  value: T;

  /**
   * Timestamp when this record was created.
   */
  createdAt: number;

  /**
   * Timestamp when this record was last updated.
   */
  updatedAt: number;
}

/**
 * Error class for storage-related errors.
 */
export class StorageError extends Error {
  /**
   * The storage operation that failed.
   */
  readonly operation: string;

  /**
   * The table involved in the error (if applicable).
   */
  readonly table?: StorageTableName;

  /**
   * The key involved in the error (if applicable).
   */
  readonly key?: string;

  /**
   * The underlying error that caused this error.
   */
  override readonly cause?: Error;

  constructor(
    message: string,
    operation: string,
    options?: {
      table?: StorageTableName;
      key?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'StorageError';
    this.operation = operation;
    this.table = options?.table;
    this.key = options?.key;
    this.cause = options?.cause;
  }
}

/**
 * All supported storage table names as an array.
 * Useful for iteration.
 */
export const ALL_TABLES: StorageTableName[] = [
  'messages',
  'channels',
  'peers',
  'keys',
  'settings',
  'outbox',
];

/**
 * Default storage configuration values.
 */
export const DEFAULT_STORAGE_CONFIG: Required<StorageConfig> = {
  dbName: 'bitchat',
  version: 1,
  requestPersistence: true,
  preferOpfs: true,
  maxRetries: 3,
  retryDelay: 100,
};
