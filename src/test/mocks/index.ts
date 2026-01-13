/**
 * Test Mocks - Central export for all mock modules
 */

// Nostr mocks
export {
  createMockEvent,
  createMockChannelEvent,
  createMockDMEvent,
  createMockGiftWrapEvent,
  createMockRelay,
  createMockRelayPool,
  mockNostrTools,
  DEFAULT_TEST_RELAYS,
  installNostrMocks,
  resetNostrMocks,
} from './nostr.mock';

export type {
  MockEvent,
  MockRelay,
  MockRelayPool,
  MockFilter,
  MockSubCallbacks,
  MockSubscription,
  MockPoolSubscription,
} from './nostr.mock';

// Storage mocks
export {
  createMockStorageAdapter,
  createMockDatabase,
  createMockTable,
  createMockSQLiteDatabase,
  createMockOPFS,
  createMockDexie,
  installStorageMocks,
  resetStorageMocks,
} from './storage.mock';

export type {
  StorageRecord,
  MockStorageAdapter,
  MockDatabase,
  MockTable,
  MockQuery,
  MockSQLiteDatabase,
  MockOPFSFile,
  MockOPFSDirectory,
} from './storage.mock';

// Crypto mocks
export {
  mockSodium,
  mockNoiseProtocol,
  mockChaCha20Poly1305,
  createMockNoiseSession,
  generateDeterministicBytes,
  resetRandomSeed,
  installCryptoMocks,
  resetCryptoMocks,
} from './crypto.mock';

export type { MockKeyPair, MockNoiseSession } from './crypto.mock';
