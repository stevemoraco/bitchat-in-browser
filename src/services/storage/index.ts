/**
 * Storage Abstraction Layer
 *
 * Provides a unified interface for persistent data storage in BitChat.
 * Automatically selects the best available storage backend:
 *
 * 1. **OPFS (Origin Private File System)** - Preferred when available
 *    - High performance file storage
 *    - Chrome 86+, Safari 15.2+, Firefox 111+
 *
 * 2. **IndexedDB** - Universal fallback
 *    - Wide browser support
 *    - Uses Dexie.js for easier API
 *
 * ## Quick Start
 *
 * ```typescript
 * import { getStorageManager } from '@/services/storage';
 *
 * // Get the singleton storage manager
 * const storage = getStorageManager();
 *
 * // Initialize (selects best backend automatically)
 * const { backendType, isPersistent } = await storage.initialize();
 * console.log(`Using ${backendType}, persistent: ${isPersistent}`);
 *
 * // Store data
 * await storage.set('messages', 'msg_001', {
 *   content: 'Hello!',
 *   timestamp: Date.now(),
 * });
 *
 * // Retrieve data
 * const message = await storage.get('messages', 'msg_001');
 *
 * // Check storage health
 * const health = await storage.getHealth();
 * console.log(`Storage: ${health.usageFormatted}`);
 * ```
 *
 * ## Available Tables
 *
 * - `messages` - Chat messages
 * - `channels` - Channel metadata
 * - `peers` - Known peers/contacts
 * - `keys` - Encrypted cryptographic keys
 * - `settings` - User preferences
 * - `outbox` - Messages pending delivery
 *
 * ## Export/Import
 *
 * ```typescript
 * // Export all data for backup
 * const backup = await storage.exportData();
 * const blob = new Blob([JSON.stringify(backup.data)], { type: 'application/json' });
 *
 * // Import data
 * await storage.importData(backup.data, { clearExisting: true });
 * ```
 *
 * ## Emergency Wipe
 *
 * ```typescript
 * // Clear all data (triple-tap handler)
 * await storage.clearAllData();
 * ```
 *
 * @module storage
 */

// Types
export {
  type StorageAdapter,
  type StorageTableName,
  type StorageConfig,
  type StorageHealth,
  type ExportResult,
  type ImportOptions,
  type ImportResult,
  type StoredRecord,
  StorageError,
  ALL_TABLES,
  DEFAULT_STORAGE_CONFIG,
} from './types';

// IndexedDB Storage
export {
  IndexedDBStorage,
  createIndexedDBStorage,
} from './indexeddb-storage';

// OPFS Storage
export {
  OPFSStorage,
  createOPFSStorage,
} from './opfs-storage';

// Storage Manager
export {
  StorageManager,
  type StorageInitResult,
  getStorageManager,
  resetStorageManager,
  createStorageManager,
} from './storage-manager';

// SQLite Schema
export {
  // Table types
  type MessageRow,
  type ChannelRow,
  type PeerRow,
  type IdentityRow,
  type NostrEventRow,
  type RelayStatusRow,
  type PendingActionRow,
  // Enum types
  type MessageStatus,
  type ChannelType,
  type TrustLevel,
  type PendingActionType,
  // Migration types
  type Migration,
  type MigrationRecord,
  type MigrationResult,
  // SQL statements
  CREATE_MESSAGES_TABLE,
  CREATE_CHANNELS_TABLE,
  CREATE_PEERS_TABLE,
  CREATE_IDENTITIES_TABLE,
  CREATE_NOSTR_EVENTS_TABLE,
  CREATE_RELAY_STATUS_TABLE,
  CREATE_PENDING_ACTIONS_TABLE,
  CREATE_SCHEMA_MIGRATIONS_TABLE,
  ALL_TABLE_STATEMENTS,
  ALL_INDEX_STATEMENTS,
  // Index statements
  MESSAGES_INDEXES,
  CHANNELS_INDEXES,
  PEERS_INDEXES,
  IDENTITIES_INDEXES,
  NOSTR_EVENTS_INDEXES,
  RELAY_STATUS_INDEXES,
  PENDING_ACTIONS_INDEXES,
  // Constants
  SCHEMA_VERSION,
  DATABASE_NAME,
  // Helper functions
  generateId,
  now,
  isValidMessageStatus,
  isValidChannelType,
  isValidTrustLevel,
  isValidPendingActionType,
} from './schema';

// Migration Runner
export {
  MigrationRunner,
  InMemorySqlExecutor,
  type SqlExecutor,
  createMigrationRunner,
  createTestExecutor,
  migrations,
  getMigration,
  getLatestVersion,
} from './migrations';

/**
 * Default export is the storage manager getter for convenience.
 *
 * @example
 * ```typescript
 * import storage from '@/services/storage';
 *
 * const manager = storage();
 * await manager.initialize();
 * ```
 */
export { getStorageManager as default } from './storage-manager';
