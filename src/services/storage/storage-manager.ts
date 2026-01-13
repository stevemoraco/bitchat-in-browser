/**
 * Storage Manager
 *
 * High-level storage manager that provides a unified interface for data storage.
 * Automatically selects the best available storage backend (OPFS or IndexedDB)
 * and provides health monitoring, persistence requests, and data export/import.
 *
 * Features:
 * - Automatic backend selection (prefers OPFS, falls back to IndexedDB)
 * - Storage health monitoring (quota, usage, persistence status)
 * - Request persistent storage from browser
 * - Export all data for backup
 * - Import data from backup
 * - Clear all data for emergency wipe
 *
 * @module storage/storage-manager
 */

import {
  type StorageAdapter,
  type StorageTableName,
  type StorageConfig,
  type StorageHealth,
  type ExportResult,
  type ImportOptions,
  type ImportResult,
  StorageError,
  DEFAULT_STORAGE_CONFIG,
  ALL_TABLES,
} from './types';
import { IndexedDBStorage } from './indexeddb-storage';
import { OPFSStorage } from './opfs-storage';

/**
 * Storage initialization result.
 */
export interface StorageInitResult {
  /** The active storage adapter */
  adapter: StorageAdapter;
  /** Which backend is being used */
  backendType: 'opfs' | 'indexeddb';
  /** Whether persistent storage was granted */
  isPersistent: boolean;
}

/**
 * Storage Manager provides a unified interface for all data storage needs.
 *
 * It automatically selects the best available storage backend and provides
 * additional features like health monitoring and data export/import.
 *
 * @example
 * ```typescript
 * const manager = new StorageManager({ dbName: 'bitchat' });
 * await manager.initialize();
 *
 * // Use the storage adapter
 * await manager.set('messages', 'msg_123', { content: 'Hello!' });
 * const message = await manager.get('messages', 'msg_123');
 *
 * // Check storage health
 * const health = await manager.getHealth();
 * console.log(`Using ${health.usageFormatted}`);
 *
 * // Export all data
 * const backup = await manager.exportData();
 * ```
 */
export class StorageManager implements StorageAdapter {
  private config: Required<StorageConfig>;
  private adapter: StorageAdapter | null = null;
  private backendType: 'opfs' | 'indexeddb' | 'none' = 'none';
  private isPersistent = false;
  private isInitialized = false;
  private initPromise: Promise<StorageInitResult> | null = null;

  /**
   * Create a new Storage Manager.
   *
   * @param config - Storage configuration options
   */
  constructor(config: StorageConfig = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
  }

  /**
   * Initialize the storage manager.
   * Automatically selects the best available storage backend.
   *
   * @returns Initialization result with the active adapter and metadata
   *
   * @example
   * ```typescript
   * const result = await manager.initialize();
   * console.log(`Using ${result.backendType} storage`);
   * ```
   */
  async initialize(): Promise<StorageInitResult> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized && this.adapter) {
      return {
        adapter: this.adapter,
        backendType: this.backendType as 'opfs' | 'indexeddb',
        isPersistent: this.isPersistent,
      };
    }

    this.initPromise = this.doInitialize();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Perform the actual initialization.
   */
  private async doInitialize(): Promise<StorageInitResult> {
    // Request persistent storage first
    if (this.config.requestPersistence) {
      this.isPersistent = await this.requestPersistence();
    }

    // Try OPFS first if preferred
    if (this.config.preferOpfs) {
      const opfs = new OPFSStorage(this.config);
      const opfsAvailable = await opfs.isAvailable();

      if (opfsAvailable) {
        this.adapter = opfs;
        this.backendType = 'opfs';
        this.isInitialized = true;

        console.info('[StorageManager] Using OPFS storage');

        return {
          adapter: this.adapter,
          backendType: 'opfs',
          isPersistent: this.isPersistent,
        };
      }

      console.info('[StorageManager] OPFS not available, trying IndexedDB');
    }

    // Fall back to IndexedDB
    const idb = new IndexedDBStorage(this.config);
    const idbAvailable = await idb.isAvailable();

    if (idbAvailable) {
      this.adapter = idb;
      this.backendType = 'indexeddb';
      this.isInitialized = true;

      console.info('[StorageManager] Using IndexedDB storage');

      return {
        adapter: this.adapter,
        backendType: 'indexeddb',
        isPersistent: this.isPersistent,
      };
    }

    // No storage available
    throw new StorageError(
      'No storage backend available. Both OPFS and IndexedDB are unavailable.',
      'initialize'
    );
  }

  /**
   * Request persistent storage from the browser.
   * This helps prevent the browser from automatically evicting our data.
   *
   * @returns True if persistence was granted
   */
  private async requestPersistence(): Promise<boolean> {
    try {
      // Check if storage persistence API is available
      if (!navigator.storage || !navigator.storage.persist) {
        console.debug('[StorageManager] Storage persistence API not available');
        return false;
      }

      // Check if we already have persistence
      const persisted = await navigator.storage.persisted();
      if (persisted) {
        console.info('[StorageManager] Storage is already persistent');
        return true;
      }

      // Request persistence
      const granted = await navigator.storage.persist();

      if (granted) {
        console.info('[StorageManager] Persistent storage granted');
      } else {
        console.info('[StorageManager] Persistent storage not granted');
      }

      return granted;
    } catch (error) {
      console.warn('[StorageManager] Failed to request persistence:', error);
      return false;
    }
  }

  /**
   * Ensure storage is initialized before operations.
   */
  private async ensureInitialized(): Promise<StorageAdapter> {
    if (!this.isInitialized || !this.adapter) {
      await this.initialize();
    }

    if (!this.adapter) {
      throw new StorageError('Storage not initialized', 'ensureInitialized');
    }

    return this.adapter;
  }

  /**
   * Get the current storage health status.
   *
   * @returns Storage health information including quota, usage, and persistence status
   *
   * @example
   * ```typescript
   * const health = await manager.getHealth();
   *
   * if (!health.isHealthy) {
   *   console.warn('Storage issues:', health.error);
   * }
   *
   * if (health.usagePercent > 80) {
   *   console.warn('Storage is almost full!');
   * }
   * ```
   */
  async getHealth(): Promise<StorageHealth> {
    const checkedAt = Date.now();

    try {
      // Get storage estimate
      let usageBytes = 0;
      let quotaBytes = 0;

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        usageBytes = estimate.usage ?? 0;
        quotaBytes = estimate.quota ?? 0;
      }

      // Check persistence status
      let isPersistent = this.isPersistent;
      if (navigator.storage && navigator.storage.persisted) {
        isPersistent = await navigator.storage.persisted();
      }

      // Calculate usage percentage
      const usagePercent =
        quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;

      // Format usage string
      const usageFormatted = this.formatBytes(usageBytes, quotaBytes);

      // Check if storage adapter is working
      const adapter = this.adapter;
      const isAdapterHealthy = adapter ? await adapter.isAvailable() : false;

      return {
        isHealthy: isAdapterHealthy && usagePercent < 95,
        backendType: this.backendType,
        isPersistent,
        usageBytes,
        quotaBytes,
        usagePercent,
        usageFormatted,
        checkedAt,
      };
    } catch (error) {
      return {
        isHealthy: false,
        backendType: this.backendType,
        isPersistent: false,
        usageBytes: 0,
        quotaBytes: 0,
        usagePercent: 0,
        usageFormatted: 'Unknown',
        checkedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format bytes for human-readable display.
   *
   * @param usage - Current usage in bytes
   * @param quota - Quota in bytes
   * @returns Formatted string like "5.2 MB / 50 MB"
   */
  private formatBytes(usage: number, quota: number): string {
    const formatSingle = (bytes: number): string => {
      if (bytes === 0) return '0 B';

      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      const value = bytes / Math.pow(1024, i);

      return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    };

    return `${formatSingle(usage)} / ${formatSingle(quota)}`;
  }

  /**
   * Export all data from storage.
   *
   * @returns Export result with all data and metadata
   *
   * @example
   * ```typescript
   * const backup = await manager.exportData();
   *
   * // Save to a file
   * const blob = new Blob([JSON.stringify(backup.data)], { type: 'application/json' });
   * const url = URL.createObjectURL(blob);
   * // ... download the file
   * ```
   */
  async exportData(): Promise<ExportResult> {
    const adapter = await this.ensureInitialized();

    const data = {} as Record<StorageTableName, Record<string, unknown>>;

    for (const tableName of ALL_TABLES) {
      const keys = await adapter.keys(tableName);
      const tableData: Record<string, unknown> = {};

      for (const key of keys) {
        const value = await adapter.get(tableName, key);
        if (value !== null) {
          tableData[key] = value;
        }
      }

      data[tableName] = tableData;
    }

    const jsonString = JSON.stringify(data);
    const sizeBytes = new Blob([jsonString]).size;

    return {
      data,
      version: this.config.version,
      exportedAt: Date.now(),
      sizeBytes,
    };
  }

  /**
   * Import data from a backup.
   *
   * @param data - The data to import (from exportData)
   * @param options - Import options
   * @returns Import result with counts of imported and skipped records
   *
   * @example
   * ```typescript
   * const result = await manager.importData(backup.data, {
   *   clearExisting: true,
   *   tables: ['messages', 'channels'],
   * });
   *
   * if (result.success) {
   *   console.log(`Imported ${result.imported.messages} messages`);
   * }
   * ```
   */
  async importData(
    data: Record<string, Record<string, unknown>>,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const adapter = await this.ensureInitialized();

    const {
      clearExisting = false,
      overwriteExisting = true,
      tables,
    } = options;

    const imported = {} as Record<StorageTableName, number>;
    const skipped = {} as Record<StorageTableName, number>;
    const errors: string[] = [];

    // Initialize counts
    for (const tableName of ALL_TABLES) {
      imported[tableName] = 0;
      skipped[tableName] = 0;
    }

    // Determine which tables to import
    const tablesToImport = tables ?? ALL_TABLES;

    for (const tableName of tablesToImport) {
      if (!ALL_TABLES.includes(tableName)) {
        errors.push(`Unknown table: ${tableName}`);
        continue;
      }

      const tableData = data[tableName];
      if (!tableData || typeof tableData !== 'object') {
        continue;
      }

      try {
        // Clear existing data if requested
        if (clearExisting) {
          await adapter.clear(tableName);
        }

        // Import records
        for (const [key, value] of Object.entries(tableData)) {
          try {
            // Check if record exists
            const existing = await adapter.get(tableName, key);

            if (existing !== null && !overwriteExisting) {
              skipped[tableName]++;
              continue;
            }

            await adapter.set(tableName, key, value);
            imported[tableName]++;
          } catch (error) {
            errors.push(
              `Failed to import ${tableName}/${key}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `Failed to process table ${tableName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    };
  }

  /**
   * Clear all data from all tables.
   * This is the "Emergency Wipe" functionality.
   *
   * @example
   * ```typescript
   * // Triple-tap handler
   * if (tapCount === 3) {
   *   await manager.clearAllData();
   *   console.log('All data wiped!');
   * }
   * ```
   */
  async clearAllData(): Promise<void> {
    const adapter = await this.ensureInitialized();

    for (const tableName of ALL_TABLES) {
      await adapter.clear(tableName);
    }

    console.info('[StorageManager] All data cleared');
  }

  /**
   * Get the active storage backend type.
   *
   * @returns 'opfs', 'indexeddb', or 'none'
   */
  getBackendType(): 'opfs' | 'indexeddb' | 'none' {
    return this.backendType;
  }

  /**
   * Check if persistent storage has been granted.
   *
   * @returns True if persistent storage is active
   */
  async checkPersistence(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persisted) {
      this.isPersistent = await navigator.storage.persisted();
    }
    return this.isPersistent;
  }

  /**
   * Request persistent storage again (e.g., after user interaction).
   *
   * @returns True if persistence was granted
   */
  async requestPersistentStorage(): Promise<boolean> {
    this.isPersistent = await this.requestPersistence();
    return this.isPersistent;
  }

  // ============================================
  // StorageAdapter interface implementation
  // ============================================

  /**
   * @inheritdoc
   */
  async get<T = unknown>(table: StorageTableName, key: string): Promise<T | null> {
    const adapter = await this.ensureInitialized();
    return adapter.get(table, key) as Promise<T | null>;
  }

  /**
   * @inheritdoc
   */
  async set<T = unknown>(
    table: StorageTableName,
    key: string,
    value: T
  ): Promise<void> {
    const adapter = await this.ensureInitialized();
    return adapter.set(table, key, value);
  }

  /**
   * @inheritdoc
   */
  async delete(table: StorageTableName, key: string): Promise<boolean> {
    const adapter = await this.ensureInitialized();
    return adapter.delete(table, key);
  }

  /**
   * @inheritdoc
   */
  async clear(table: StorageTableName): Promise<void> {
    const adapter = await this.ensureInitialized();
    return adapter.clear(table);
  }

  /**
   * @inheritdoc
   */
  async keys(table: StorageTableName): Promise<string[]> {
    const adapter = await this.ensureInitialized();
    return adapter.keys(table);
  }

  /**
   * @inheritdoc
   */
  async getAll<T = unknown>(table: StorageTableName): Promise<T[]> {
    const adapter = await this.ensureInitialized();
    return adapter.getAll(table) as Promise<T[]>;
  }

  /**
   * @inheritdoc
   */
  async getMany<T = unknown>(
    table: StorageTableName,
    keys: string[]
  ): Promise<(T | null)[]> {
    const adapter = await this.ensureInitialized();
    return adapter.getMany(table, keys) as Promise<(T | null)[]>;
  }

  /**
   * @inheritdoc
   */
  async setMany<T = unknown>(
    table: StorageTableName,
    entries: [string, T][]
  ): Promise<void> {
    const adapter = await this.ensureInitialized();
    return adapter.setMany(table, entries);
  }

  /**
   * @inheritdoc
   */
  async isAvailable(): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }
    return this.adapter.isAvailable();
  }

  /**
   * @inheritdoc
   */
  async close(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
      this.adapter = null;
    }
    this.isInitialized = false;
    this.backendType = 'none';
  }
}

/**
 * Singleton instance of the storage manager.
 * Use this for app-wide storage access.
 */
let defaultStorageManager: StorageManager | null = null;

/**
 * Get the default storage manager instance.
 * Creates one if it doesn't exist.
 *
 * @param config - Optional configuration for first-time creation
 * @returns The default StorageManager instance
 *
 * @example
 * ```typescript
 * const storage = getStorageManager();
 * await storage.initialize();
 * await storage.set('settings', 'theme', { mode: 'dark' });
 * ```
 */
export function getStorageManager(config?: StorageConfig): StorageManager {
  if (!defaultStorageManager) {
    defaultStorageManager = new StorageManager(config);
  }
  return defaultStorageManager;
}

/**
 * Reset the default storage manager.
 * Useful for testing or when you need to reinitialize with different config.
 */
export function resetStorageManager(): void {
  if (defaultStorageManager) {
    // Don't await close - just reset the reference
    defaultStorageManager.close().catch(console.error);
    defaultStorageManager = null;
  }
}

/**
 * Create a new storage manager with the given configuration.
 *
 * @param config - Storage configuration options
 * @returns A new StorageManager instance
 *
 * @example
 * ```typescript
 * const storage = createStorageManager({
 *   dbName: 'myapp',
 *   preferOpfs: true,
 *   requestPersistence: true,
 * });
 *
 * await storage.initialize();
 * ```
 */
export function createStorageManager(config?: StorageConfig): StorageManager {
  return new StorageManager(config);
}
