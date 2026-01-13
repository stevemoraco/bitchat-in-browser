/**
 * OPFS (Origin Private File System) Storage Adapter
 *
 * Implements the StorageAdapter interface using the Origin Private File System API.
 * OPFS provides high-performance file storage that's isolated to the origin.
 *
 * Features:
 * - Uses FileSystemSyncAccessHandle for optimal performance when available
 * - Falls back gracefully when OPFS is unavailable
 * - Handles Safari's OPFS quirks
 * - JSON-based storage with atomic writes
 *
 * Browser Support:
 * - Chrome 86+: Full support
 * - Safari 15.2+: Supported with some quirks
 * - Firefox 111+: Full support
 *
 * @module storage/opfs-storage
 */

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
 * OPFS-based storage adapter.
 *
 * Stores data as JSON files in the Origin Private File System.
 * Each table gets its own subdirectory, and each record is stored
 * as a separate file named after its key.
 *
 * Directory structure:
 * ```
 * /bitchat/
 *   /messages/
 *     msg_001.json
 *     msg_002.json
 *   /channels/
 *     chan_001.json
 *   /settings/
 *     theme.json
 *   ...
 * ```
 *
 * @example
 * ```typescript
 * const storage = new OPFSStorage({ dbName: 'bitchat' });
 *
 * if (await storage.isAvailable()) {
 *   await storage.set('messages', 'msg_123', { content: 'Hello!' });
 *   const message = await storage.get('messages', 'msg_123');
 * }
 * ```
 */
export class OPFSStorage implements StorageAdapter {
  private config: Required<StorageConfig>;
  private rootDir: FileSystemDirectoryHandle | null = null;
  private tableDirs: Map<StorageTableName, FileSystemDirectoryHandle> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Create a new OPFS storage adapter.
   *
   * @param config - Storage configuration options
   */
  constructor(config: StorageConfig = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
  }

  /**
   * Initialize the OPFS storage system.
   * Creates the root directory and table subdirectories.
   */
  private async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Perform the actual initialization.
   */
  private async doInitialize(): Promise<void> {
    try {
      // Get the OPFS root
      const opfsRoot = await navigator.storage.getDirectory();

      // Create or get our app's root directory
      this.rootDir = await opfsRoot.getDirectoryHandle(this.config.dbName, {
        create: true,
      });

      // Create directories for each table
      for (const tableName of ALL_TABLES) {
        const tableDir = await this.rootDir.getDirectoryHandle(tableName, {
          create: true,
        });
        this.tableDirs.set(tableName, tableDir);
      }

      this.isInitialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to initialize OPFS: ${error instanceof Error ? error.message : String(error)}`,
        'initialize',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Ensure storage is initialized before operations.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.rootDir) {
      throw new StorageError('OPFS not initialized', 'ensureInitialized');
    }
  }

  /**
   * Get the directory handle for a table.
   *
   * @param table - The table name
   * @returns The FileSystemDirectoryHandle for the table
   */
  private getTableDir(table: StorageTableName): FileSystemDirectoryHandle {
    const dir = this.tableDirs.get(table);
    if (!dir) {
      throw new StorageError(`Table directory not initialized: ${table}`, 'getTableDir', { table });
    }
    return dir;
  }

  /**
   * Encode a key to be safe for use as a filename.
   * Handles special characters that aren't allowed in filenames.
   *
   * @param key - The key to encode
   * @returns A filename-safe string
   */
  private encodeKey(key: string): string {
    // URL encode special characters and add .json extension
    return encodeURIComponent(key) + '.json';
  }

  /**
   * Decode a filename back to the original key.
   *
   * @param filename - The filename to decode
   * @returns The original key
   */
  private decodeKey(filename: string): string {
    // Remove .json extension and decode
    if (filename.endsWith('.json')) {
      filename = filename.slice(0, -5);
    }
    return decodeURIComponent(filename);
  }

  /**
   * Read a JSON file from OPFS.
   *
   * @param fileHandle - The file handle
   * @returns The parsed JSON content
   */
  private async readJsonFile<T>(fileHandle: FileSystemFileHandle): Promise<T> {
    try {
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content) as T;
    } catch (error) {
      throw new StorageError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        'readJsonFile',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Write JSON data to OPFS.
   *
   * @param fileHandle - The file handle
   * @param data - The data to write
   */
  private async writeJsonFile<T>(
    fileHandle: FileSystemFileHandle,
    data: T
  ): Promise<void> {
    try {
      // Use the writable stream API for atomic writes
      const writable = await fileHandle.createWritable();

      try {
        const content = JSON.stringify(data);
        await writable.write(content);
        await writable.close();
      } catch (error) {
        // Ensure we close the stream on error
        try {
          await writable.abort();
        } catch {
          // Ignore abort errors
        }
        throw error;
      }
    } catch (error) {
      // Safari quirk: May need to retry with a slight delay
      if (this.isSafariQuirk(error)) {
        await this.delay(50);
        const writable = await fileHandle.createWritable();
        const content = JSON.stringify(data);
        await writable.write(content);
        await writable.close();
        return;
      }

      throw new StorageError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        'writeJsonFile',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Check if an error is a Safari-specific quirk that can be retried.
   */
  private isSafariQuirk(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();

    // Safari sometimes throws "InvalidStateError" on first write
    if (message.includes('invalidstateerror')) return true;
    if (message.includes('invalid state')) return true;

    // Safari may throw "NotAllowedError" on concurrent access
    if (message.includes('notallowederror')) return true;

    return false;
  }

  /**
   * Delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @inheritdoc
   */
  async get<T = unknown>(table: StorageTableName, key: string): Promise<T | null> {
    await this.ensureInitialized();

    try {
      const tableDir = this.getTableDir(table);
      const filename = this.encodeKey(key);

      const fileHandle = await tableDir.getFileHandle(filename);
      const record = await this.readJsonFile<StoredRecord<T>>(fileHandle);

      return record.value;
    } catch (error) {
      // File not found is not an error - return null
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }

      throw new StorageError(
        `Failed to get value: ${error instanceof Error ? error.message : String(error)}`,
        'get',
        { table, key, cause: error instanceof Error ? error : undefined }
      );
    }
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

    try {
      const tableDir = this.getTableDir(table);
      const filename = this.encodeKey(key);
      const now = Date.now();

      // Try to get existing record to preserve createdAt
      let createdAt = now;
      try {
        const existingHandle = await tableDir.getFileHandle(filename);
        const existing = await this.readJsonFile<StoredRecord>(existingHandle);
        createdAt = existing.createdAt;
      } catch {
        // File doesn't exist, use current time for createdAt
      }

      // Create or overwrite the file
      const fileHandle = await tableDir.getFileHandle(filename, { create: true });

      const record: StoredRecord<T> = {
        key,
        table,
        value,
        createdAt,
        updatedAt: now,
      };

      await this.writeJsonFile(fileHandle, record);
    } catch (error) {
      throw new StorageError(
        `Failed to set value: ${error instanceof Error ? error.message : String(error)}`,
        'set',
        { table, key, cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * @inheritdoc
   */
  async delete(table: StorageTableName, key: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const tableDir = this.getTableDir(table);
      const filename = this.encodeKey(key);

      // Check if file exists first
      try {
        await tableDir.getFileHandle(filename);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return false;
        }
        throw error;
      }

      // Remove the file
      await tableDir.removeEntry(filename);
      return true;
    } catch (error) {
      throw new StorageError(
        `Failed to delete value: ${error instanceof Error ? error.message : String(error)}`,
        'delete',
        { table, key, cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * @inheritdoc
   */
  async clear(table: StorageTableName): Promise<void> {
    await this.ensureInitialized();

    try {
      const tableDir = this.getTableDir(table);

      // Collect all filenames first
      const filenames: string[] = [];
      for await (const entry of (tableDir as any).values()) {
        if (entry.kind === 'file') {
          filenames.push(entry.name);
        }
      }

      // Delete all files
      for (const filename of filenames) {
        try {
          await tableDir.removeEntry(filename);
        } catch (error) {
          // Ignore errors during clear (file might have been deleted already)
          console.warn(`Failed to delete file during clear: ${filename}`, error);
        }
      }
    } catch (error) {
      throw new StorageError(
        `Failed to clear table: ${error instanceof Error ? error.message : String(error)}`,
        'clear',
        { table, cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * @inheritdoc
   */
  async keys(table: StorageTableName): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const tableDir = this.getTableDir(table);
      const keys: string[] = [];

      for await (const entry of (tableDir as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          keys.push(this.decodeKey(entry.name));
        }
      }

      return keys;
    } catch (error) {
      throw new StorageError(
        `Failed to list keys: ${error instanceof Error ? error.message : String(error)}`,
        'keys',
        { table, cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * @inheritdoc
   */
  async getAll<T = unknown>(table: StorageTableName): Promise<T[]> {
    await this.ensureInitialized();

    try {
      const tableDir = this.getTableDir(table);
      const values: T[] = [];

      for await (const entry of (tableDir as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          try {
            const fileHandle = await tableDir.getFileHandle(entry.name);
            const record = await this.readJsonFile<StoredRecord<T>>(fileHandle);
            values.push(record.value);
          } catch (error) {
            console.warn(`Failed to read file ${entry.name}:`, error);
          }
        }
      }

      return values;
    } catch (error) {
      throw new StorageError(
        `Failed to get all values: ${error instanceof Error ? error.message : String(error)}`,
        'getAll',
        { table, cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * @inheritdoc
   */
  async getMany<T = unknown>(
    table: StorageTableName,
    keys: string[]
  ): Promise<(T | null)[]> {
    await this.ensureInitialized();

    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(table, key);
      results.push(value);
    }

    return results;
  }

  /**
   * @inheritdoc
   */
  async setMany<T = unknown>(
    table: StorageTableName,
    entries: [string, T][]
  ): Promise<void> {
    await this.ensureInitialized();

    // Set all entries in parallel for better performance
    await Promise.all(entries.map(([key, value]) => this.set(table, key, value)));
  }

  /**
   * @inheritdoc
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if OPFS API is available
      if (typeof navigator === 'undefined' || !navigator.storage) {
        return false;
      }

      if (typeof navigator.storage.getDirectory !== 'function') {
        return false;
      }

      // Try to actually access OPFS
      const root = await navigator.storage.getDirectory();

      // Try to create a test file
      const testDirName = `_opfs_test_${Date.now()}`;
      const testDir = await root.getDirectoryHandle(testDirName, { create: true });
      const testFile = await testDir.getFileHandle('test.txt', { create: true });

      // Try to write to it
      const writable = await testFile.createWritable();
      await writable.write('test');
      await writable.close();

      // Clean up
      await root.removeEntry(testDirName, { recursive: true });

      return true;
    } catch (error) {
      console.debug('OPFS not available:', error);
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  async close(): Promise<void> {
    // OPFS doesn't need explicit closing, but we reset our state
    this.rootDir = null;
    this.tableDirs.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Delete all data in the OPFS storage.
   * Use with caution - this is destructive!
   */
  async deleteAll(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(this.config.dbName, { recursive: true });
      await this.close();
    } catch (error) {
      // If directory doesn't exist, that's fine
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        await this.close();
        return;
      }

      throw new StorageError(
        `Failed to delete all data: ${error instanceof Error ? error.message : String(error)}`,
        'deleteAll',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Get the count of records in a table.
   *
   * @param table - The table name
   * @returns The number of records
   */
  async count(table: StorageTableName): Promise<number> {
    const allKeys = await this.keys(table);
    return allKeys.length;
  }

  /**
   * Get storage usage information for OPFS.
   *
   * @returns Estimated storage usage and quota
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage ?? 0,
          quota: estimate.quota ?? 0,
        };
      }
    } catch {
      // Ignore errors
    }

    return { usage: 0, quota: 0 };
  }
}

/**
 * Create a new OPFS storage adapter with the given configuration.
 *
 * @param config - Storage configuration options
 * @returns A new OPFSStorage instance
 *
 * @example
 * ```typescript
 * const storage = createOPFSStorage({ dbName: 'myapp' });
 *
 * if (await storage.isAvailable()) {
 *   await storage.set('settings', 'theme', { mode: 'dark' });
 * }
 * ```
 */
export function createOPFSStorage(config?: StorageConfig): OPFSStorage {
  return new OPFSStorage(config);
}
