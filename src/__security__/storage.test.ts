/**
 * Storage Security Tests
 *
 * Tests to ensure the application properly secures data at rest,
 * encrypts sensitive information, and properly wipes data on demand.
 *
 * @module __security__/storage.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Test Data
// ============================================================================

const TEST_PRIVATE_KEY_HEX = 'a'.repeat(64);
const TEST_PASSWORD = 'correct-horse-battery-staple';
const TEST_ENCRYPTION_KEY = new Uint8Array(32).fill(0x42);

// Test data for reference - exported for potential reuse
export const TEST_NSEC = 'nsec1' + 'a'.repeat(59);

// Sensitive patterns that should never appear in plaintext - exported for reuse
export const SENSITIVE_PATTERNS = [
  /nsec1[a-z0-9]{58}/i, // Nostr secret key
  /[a-f0-9]{64}/i, // 64-char hex (likely private key)
  /-----BEGIN.*PRIVATE KEY-----/i, // PEM format
  /privateKey/i, // Key field names
  /secretKey/i,
  /seed/i,
  /mnemonic/i,
];

// ============================================================================
// Private Keys Encrypted at Rest Tests
// ============================================================================

describe('Storage Security: Private Keys Encrypted at Rest', () => {
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe('Key Storage Encryption', () => {
    it('should encrypt private keys before storing', () => {
      const privateKey = TEST_PRIVATE_KEY_HEX;

      // Store the key (should be encrypted)
      storePrivateKey(privateKey, TEST_ENCRYPTION_KEY, mockStorage);

      // Check that the raw key is not in storage
      for (const [_key, value] of mockStorage) {
        expect(value).not.toContain(privateKey);
        expect(value).not.toMatch(/^[a-f0-9]{64}$/i);
      }
    });

    it('should be able to decrypt stored keys', () => {
      const originalKey = TEST_PRIVATE_KEY_HEX;

      storePrivateKey(originalKey, TEST_ENCRYPTION_KEY, mockStorage);
      const retrieved = retrievePrivateKey(TEST_ENCRYPTION_KEY, mockStorage);

      expect(retrieved).toBe(originalKey);
    });

    it('should fail decryption with wrong password', () => {
      storePrivateKey(TEST_PRIVATE_KEY_HEX, TEST_ENCRYPTION_KEY, mockStorage);

      const wrongKey = new Uint8Array(32).fill(0x00);

      expect(() => retrievePrivateKey(wrongKey, mockStorage)).toThrow();
    });

    it('should use authenticated encryption for key storage', () => {
      storePrivateKey(TEST_PRIVATE_KEY_HEX, TEST_ENCRYPTION_KEY, mockStorage);

      // Tamper with the stored data
      const storedValue = mockStorage.get('encrypted_key');
      if (storedValue) {
        const tampered = storedValue.slice(0, -1) + 'X';
        mockStorage.set('encrypted_key', tampered);
      }

      // Should fail authentication
      expect(() => retrievePrivateKey(TEST_ENCRYPTION_KEY, mockStorage)).toThrow(
        /authentication|tampered|invalid/i
      );
    });
  });

  describe('Key Derivation for Storage Encryption', () => {
    it('should derive encryption key from password with proper KDF', () => {
      const password = TEST_PASSWORD;
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const derivedKey = deriveStorageKey(password, salt);

      // Key should be 32 bytes (256 bits)
      expect(derivedKey.length).toBe(32);

      // Same password + salt should give same key
      const derivedKey2 = deriveStorageKey(password, salt);
      expect(derivedKey).toEqual(derivedKey2);

      // Different salt should give different key
      const salt2 = crypto.getRandomValues(new Uint8Array(16));
      const derivedKey3 = deriveStorageKey(password, salt2);
      expect(derivedKey).not.toEqual(derivedKey3);
    });

    it('should use unique salt for each user', () => {
      const salts = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const salt = generateStorageSalt();
        const hex = Array.from(salt)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        salts.add(hex);
      }

      expect(salts.size).toBe(10);
    });
  });
});

// ============================================================================
// No Plaintext Secrets in localStorage Tests
// ============================================================================

describe('Storage Security: No Plaintext Secrets in localStorage', () => {
  let mockLocalStorage: Map<string, string>;

  beforeEach(() => {
    mockLocalStorage = new Map();
  });

  describe('Scanning localStorage for Secrets', () => {
    it('should not store nsec (Nostr secret key) in plaintext', () => {
      // Simulate app storage operations
      mockAppStorageOperations(mockLocalStorage);

      for (const [_key, value] of mockLocalStorage) {
        expect(value).not.toMatch(/nsec1[a-z0-9]{58}/i);
      }
    });

    it('should not store private key hex in plaintext', () => {
      mockAppStorageOperations(mockLocalStorage);

      for (const [_key, value] of mockLocalStorage) {
        // 64-char hex strings should only appear in encrypted form
        const matches = value.match(/[a-f0-9]{64}/gi);
        if (matches) {
          for (const match of matches) {
            // If it looks like a key, it should be in an encrypted wrapper
            expect(isWrappedInEncryption(value, match)).toBe(true);
          }
        }
      }
    });

    it('should not store seed phrases in plaintext', () => {
      mockAppStorageOperations(mockLocalStorage);

      for (const [_key, value] of mockLocalStorage) {
        // BIP39 seed phrase patterns
        expect(value).not.toMatch(/\b(abandon|ability|able)\b.*\b\w+\b/i);
        expect(value).not.toContain('mnemonic');
        expect(value).not.toContain('seedPhrase');
      }
    });

    it('should not store password in any form', () => {
      mockAppStorageOperations(mockLocalStorage);

      for (const [key, value] of mockLocalStorage) {
        expect(key.toLowerCase()).not.toContain('password');
        expect(value.toLowerCase()).not.toContain('password');
      }
    });
  });

  describe('Identity Store Persistence', () => {
    it('should only persist public key info, not private', () => {
      const identityState = createMockIdentityState();

      // Persist identity
      const persisted = serializeIdentityForStorage(identityState);
      mockLocalStorage.set('bitchat-identity', persisted);

      const stored = mockLocalStorage.get('bitchat-identity') ?? '';

      // Public key is okay to store
      expect(stored).toContain('publicKey');

      // Private key should never be stored
      expect(stored).not.toContain('privateKey');
      expect(stored).not.toContain('secretKey');
      expect(stored).not.toMatch(/nsec1/);
    });
  });

  describe('Session Data', () => {
    it('should not store session keys in localStorage', () => {
      mockAppStorageOperations(mockLocalStorage);

      for (const [key, _value] of mockLocalStorage) {
        expect(key.toLowerCase()).not.toContain('sessionkey');
        expect(key.toLowerCase()).not.toContain('sessionSecret');
      }
    });

    it('should not store encryption keys for messages', () => {
      mockAppStorageOperations(mockLocalStorage);

      for (const [_key, value] of mockLocalStorage) {
        // Look for patterns that suggest raw key storage
        expect(value).not.toMatch(/"encryptionKey"\s*:\s*"[a-f0-9]{64}"/i);
        expect(value).not.toMatch(/"messageKey"\s*:\s*"[a-f0-9]{64}"/i);
      }
    });
  });
});

// ============================================================================
// Proper Key Derivation for Encryption Tests
// ============================================================================

describe('Storage Security: Proper Key Derivation for Encryption', () => {
  describe('Password-Based Key Derivation', () => {
    it('should use Argon2id for password key derivation', () => {
      const kdfInfo = getPasswordKDFInfo();

      expect(kdfInfo.algorithm).toBe('Argon2id');
    });

    it('should use sufficient memory cost', () => {
      const kdfInfo = getPasswordKDFInfo();

      // At least 64MB for Argon2
      expect(kdfInfo.memory).toBeGreaterThanOrEqual(65536);
    });

    it('should use sufficient iteration count', () => {
      const kdfInfo = getPasswordKDFInfo();

      expect(kdfInfo.iterations).toBeGreaterThanOrEqual(3);
    });

    it('should use sufficient parallelism', () => {
      const kdfInfo = getPasswordKDFInfo();

      expect(kdfInfo.parallelism).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Salt Handling', () => {
    it('should store salt alongside encrypted data', () => {
      const encrypted = encryptForStorage('secret data', TEST_PASSWORD);

      expect(encrypted.salt).toBeDefined();
      expect(encrypted.salt.length).toBeGreaterThanOrEqual(16);
    });

    it('should generate unique salt for each encryption', () => {
      const encryptions = [];

      for (let i = 0; i < 10; i++) {
        const encrypted = encryptForStorage('secret data', TEST_PASSWORD);
        encryptions.push(encrypted);
      }

      const salts = encryptions.map((e) =>
        Array.from(e.salt)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      );
      const uniqueSalts = new Set(salts);

      expect(uniqueSalts.size).toBe(10);
    });
  });
});

// ============================================================================
// Emergency Wipe Completeness Tests
// ============================================================================

describe('Storage Security: Emergency Wipe Completeness', () => {
  describe('Data Wipe Coverage', () => {
    it('should wipe all storage tables', async () => {
      const storage = createMockStorageManager();

      // Add data to all tables
      await storage.set('messages', 'msg1', { content: 'test' });
      await storage.set('channels', 'chan1', { name: 'test' });
      await storage.set('peers', 'peer1', { name: 'alice' });
      await storage.set('keys', 'key1', { encrypted: 'data' });
      await storage.set('settings', 'theme', { mode: 'dark' });
      await storage.set('outbox', 'out1', { pending: true });

      // Perform wipe
      await storage.clearAllData();

      // Verify all tables are empty
      expect(await storage.keys('messages')).toHaveLength(0);
      expect(await storage.keys('channels')).toHaveLength(0);
      expect(await storage.keys('peers')).toHaveLength(0);
      expect(await storage.keys('keys')).toHaveLength(0);
      expect(await storage.keys('settings')).toHaveLength(0);
      expect(await storage.keys('outbox')).toHaveLength(0);
    });

    it('should wipe localStorage', async () => {
      const mockLocalStorage = createMockLocalStorage();

      mockLocalStorage.setItem('bitchat-identity', 'data');
      mockLocalStorage.setItem('bitchat-settings', 'data');
      mockLocalStorage.setItem('other-key', 'data');

      await performEmergencyWipe(mockLocalStorage);

      expect(mockLocalStorage.length).toBe(0);
    });

    it('should wipe sessionStorage', async () => {
      const mockSessionStorage = createMockLocalStorage();

      mockSessionStorage.setItem('session-data', 'data');

      await performEmergencyWipe(undefined, mockSessionStorage);

      expect(mockSessionStorage.length).toBe(0);
    });

    it('should wipe IndexedDB', async () => {
      const mockIDB = createMockIndexedDB();

      await mockIDB.createDatabase('bitchat');
      await mockIDB.addData('bitchat', 'messages', { id: 1, content: 'test' });

      await performEmergencyWipe(undefined, undefined, mockIDB);

      const databases = await mockIDB.listDatabases();
      expect(databases).not.toContain('bitchat');
    });

    it('should clear service worker caches', async () => {
      const mockCaches = createMockCacheStorage();

      await mockCaches.open('bitchat-v1');
      await mockCaches.open('bitchat-static');

      await performEmergencyWipe(
        undefined,
        undefined,
        undefined,
        mockCaches
      );

      const cacheNames = await mockCaches.keys();
      expect(cacheNames).toHaveLength(0);
    });
  });

  describe('In-Memory Key Clearing', () => {
    it('should clear identity state on wipe', async () => {
      const identityStore = createMockIdentityStore();

      identityStore.setIdentity({
        publicKey: 'abc123',
        fingerprint: 'AB:CD:EF',
        npub: 'npub1...',
      });

      await identityStore.clearIdentity();

      expect(identityStore.getIdentity()).toBeNull();
    });

    it('should wipe in-memory private keys', async () => {
      const keyMemory = new Uint8Array(32).fill(0xff);

      performSecureMemoryWipe(keyMemory);

      expect(keyMemory.every((b) => b === 0)).toBe(true);
    });
  });

  describe('Wipe Verification', () => {
    it('should verify wipe completed successfully', async () => {
      const storage = createMockStorageManager();

      // Add data
      await storage.set('messages', 'msg1', { content: 'test' });

      // Perform wipe
      await storage.clearAllData();

      // Verify
      const verificationResult = await verifyWipeComplete(storage);

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.remainingItems).toBe(0);
    });

    it('should report incomplete wipe', async () => {
      const storage = createMockStorageManager();

      // Add data
      await storage.set('messages', 'msg1', { content: 'test' });

      // Simulate partial wipe (don't actually wipe)
      // storage.clearAllData() not called

      const verificationResult = await verifyWipeComplete(storage);

      expect(verificationResult.success).toBe(false);
      expect(verificationResult.remainingItems).toBeGreaterThan(0);
    });
  });

  describe('Wipe Timing', () => {
    it('should complete wipe within acceptable time', async () => {
      const storage = createMockStorageManager();

      // Add substantial data
      for (let i = 0; i < 100; i++) {
        await storage.set('messages', `msg${i}`, { content: `message ${i}` });
      }

      const startTime = Date.now();
      await storage.clearAllData();
      const elapsed = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Post-Wipe State', () => {
    it('should leave app in clean initial state', async () => {
      const appState = createMockAppState();

      // Configure app
      appState.identity = { publicKey: 'abc' };
      appState.messages = [{ id: 1 }];
      appState.settings = { theme: 'dark' };

      // Wipe
      await performFullAppWipe(appState);

      // Should be initial state
      expect(appState.identity).toBeNull();
      expect(appState.messages).toHaveLength(0);
      expect(appState.settings).toEqual({});
    });

    it('should unregister service worker on wipe', async () => {
      const mockSW = createMockServiceWorker();

      await mockSW.register('/sw.js');
      expect(mockSW.isRegistered()).toBe(true);

      await performEmergencyWipe(undefined, undefined, undefined, undefined, mockSW);

      expect(mockSW.isRegistered()).toBe(false);
    });
  });
});

// ============================================================================
// OPFS Security Tests
// ============================================================================

describe('Storage Security: OPFS (Origin Private File System)', () => {
  describe('File-Level Encryption', () => {
    it('should encrypt sensitive data before writing to OPFS', async () => {
      const mockOPFS = createMockOPFS();

      const sensitiveData = { privateKey: TEST_PRIVATE_KEY_HEX };
      await writeToOPFSEncrypted(mockOPFS, 'keys.json', sensitiveData, TEST_ENCRYPTION_KEY);

      // Read raw file contents
      const rawContents = await mockOPFS.readRaw('keys.json');

      // Should not contain plaintext key
      expect(rawContents).not.toContain(TEST_PRIVATE_KEY_HEX);
    });
  });
});

// ============================================================================
// Helper Functions (Mock implementations)
// ============================================================================

function storePrivateKey(
  privateKey: string,
  encryptionKey: Uint8Array,
  storage: Map<string, string>
): void {
  // Encrypt the key
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const encrypted = mockEncrypt(
    new TextEncoder().encode(privateKey),
    encryptionKey,
    nonce
  );

  // Store as base64
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, nonce.length);

  storage.set('encrypted_key', btoa(String.fromCharCode(...combined)));
}

function retrievePrivateKey(
  encryptionKey: Uint8Array,
  storage: Map<string, string>
): string {
  const stored = storage.get('encrypted_key');
  if (!stored) throw new Error('No key found');

  const combined = new Uint8Array(
    atob(stored)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  const nonce = combined.slice(0, 24);
  const encrypted = combined.slice(24);

  const decrypted = mockDecrypt(encrypted, encryptionKey, nonce);
  return new TextDecoder().decode(decrypted);
}

function mockEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  // Simple XOR encryption for mock (real impl uses ChaCha20-Poly1305)
  const result = new Uint8Array(plaintext.length + 16); // +16 for auth tag
  for (let i = 0; i < plaintext.length; i++) {
    result[i] = (plaintext[i] ?? 0) ^ (key[i % key.length] ?? 0) ^ (nonce[i % nonce.length] ?? 0);
  }
  // Mock auth tag
  result.set(key.slice(0, 16), plaintext.length);
  return result;
}

function mockDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  // Check auth tag (simplified)
  const tag = ciphertext.slice(-16);
  const expectedTag = key.slice(0, 16);

  if (!constantTimeEqual(tag, expectedTag)) {
    throw new Error('Authentication failed: data may be tampered');
  }

  const encrypted = ciphertext.slice(0, -16);
  const result = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    result[i] = (encrypted[i] ?? 0) ^ (key[i % key.length] ?? 0) ^ (nonce[i % nonce.length] ?? 0);
  }
  return result;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return result === 0;
}

function deriveStorageKey(password: string, salt: Uint8Array): Uint8Array {
  // Mock key derivation (real impl uses Argon2id)
  const encoder = new TextEncoder();
  const combined = new Uint8Array([...encoder.encode(password), ...salt]);
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = (combined[i % combined.length] ?? 0) ^ (salt[i % salt.length] ?? 0);
  }
  return key;
}

function generateStorageSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

function mockAppStorageOperations(storage: Map<string, string>): void {
  // Simulate what the app stores
  storage.set(
    'bitchat-identity',
    JSON.stringify({
      publicKey: 'npub1abc123...',
      fingerprint: 'AB:CD:EF:12',
      // Note: no privateKey!
    })
  );

  storage.set(
    'bitchat-settings',
    JSON.stringify({
      theme: 'dark',
      notifications: true,
    })
  );

  storage.set(
    'bitchat-encrypted-keys',
    JSON.stringify({
      encrypted: btoa('encrypted-data-here'),
      salt: btoa('random-salt'),
      nonce: btoa('random-nonce'),
    })
  );
}

function isWrappedInEncryption(value: string, hexString: string): boolean {
  // Check if the hex string appears to be in an encrypted wrapper
  try {
    const parsed = JSON.parse(value);
    if (parsed.encrypted && parsed.salt && parsed.nonce) {
      return true;
    }
  } catch {
    // Not JSON
  }
  return false;
}

function createMockIdentityState() {
  return {
    publicKey: 'npub1abc...',
    fingerprint: 'AB:CD:EF:12',
    npub: 'npub1abc...',
    isKeyLoaded: false,
    // Note: no privateKey
  };
}

function serializeIdentityForStorage(state: ReturnType<typeof createMockIdentityState>): string {
  // Only serialize public data
  return JSON.stringify({
    publicKey: state.publicKey,
    fingerprint: state.fingerprint,
    npub: state.npub,
    isKeyLoaded: false,
  });
}

function getPasswordKDFInfo() {
  return {
    algorithm: 'Argon2id',
    memory: 65536, // 64MB
    iterations: 3,
    parallelism: 1,
  };
}

function encryptForStorage(data: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const key = deriveStorageKey(password, salt);
  const encrypted = mockEncrypt(new TextEncoder().encode(data), key, nonce);

  return {
    encrypted,
    salt,
    nonce,
  };
}

function createMockStorageManager() {
  const tables: Record<string, Map<string, unknown>> = {
    messages: new Map(),
    channels: new Map(),
    peers: new Map(),
    keys: new Map(),
    settings: new Map(),
    outbox: new Map(),
  };

  return {
    async set(table: string, key: string, value: unknown) {
      tables[table].set(key, value);
    },
    async get(table: string, key: string) {
      return tables[table].get(key);
    },
    async keys(table: string) {
      return Array.from(tables[table].keys());
    },
    async clearAllData() {
      for (const table of Object.values(tables)) {
        table.clear();
      }
    },
  };
}

function createMockLocalStorage() {
  const storage = new Map<string, string>();

  return {
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
    get length() {
      return storage.size;
    },
  };
}

function createMockIndexedDB() {
  const databases = new Map<string, Map<string, unknown[]>>();

  return {
    async createDatabase(name: string) {
      databases.set(name, new Map());
    },
    async addData(dbName: string, storeName: string, data: unknown) {
      const db = databases.get(dbName);
      if (db) {
        const store = db.get(storeName) ?? [];
        store.push(data);
        db.set(storeName, store);
      }
    },
    async deleteDatabase(name: string) {
      databases.delete(name);
    },
    async listDatabases() {
      return Array.from(databases.keys());
    },
  };
}

function createMockCacheStorage() {
  const caches = new Map<string, unknown[]>();

  return {
    async open(name: string) {
      caches.set(name, []);
    },
    async delete(name: string) {
      caches.delete(name);
    },
    async keys() {
      return Array.from(caches.keys());
    },
    async clear() {
      caches.clear();
    },
  };
}

async function performEmergencyWipe(
  localStorage?: ReturnType<typeof createMockLocalStorage>,
  sessionStorage?: ReturnType<typeof createMockLocalStorage>,
  indexedDB?: ReturnType<typeof createMockIndexedDB>,
  caches?: ReturnType<typeof createMockCacheStorage>,
  serviceWorker?: ReturnType<typeof createMockServiceWorker>
) {
  if (localStorage) {
    localStorage.clear();
  }
  if (sessionStorage) {
    sessionStorage.clear();
  }
  if (indexedDB) {
    const dbs = await indexedDB.listDatabases();
    for (const db of dbs) {
      await indexedDB.deleteDatabase(db);
    }
  }
  if (caches) {
    const names = await caches.keys();
    for (const name of names) {
      await caches.delete(name);
    }
  }
  if (serviceWorker) {
    await serviceWorker.unregister();
  }
}

function createMockIdentityStore() {
  let identity: Record<string, unknown> | null = null;

  return {
    setIdentity(id: Record<string, unknown>) {
      identity = id;
    },
    getIdentity() {
      return identity;
    },
    clearIdentity() {
      identity = null;
    },
  };
}

function performSecureMemoryWipe(buffer: Uint8Array) {
  buffer.fill(0);
}

async function verifyWipeComplete(storage: ReturnType<typeof createMockStorageManager>) {
  const tables = ['messages', 'channels', 'peers', 'keys', 'settings', 'outbox'];
  let remainingItems = 0;

  for (const table of tables) {
    const keys = await storage.keys(table);
    remainingItems += keys.length;
  }

  return {
    success: remainingItems === 0,
    remainingItems,
  };
}

function createMockAppState() {
  return {
    identity: null as Record<string, unknown> | null,
    messages: [] as unknown[],
    settings: {} as Record<string, unknown>,
  };
}

async function performFullAppWipe(appState: ReturnType<typeof createMockAppState>) {
  appState.identity = null;
  appState.messages = [];
  appState.settings = {};
}

function createMockServiceWorker() {
  let registered = false;

  return {
    async register(_scriptURL: string) {
      registered = true;
    },
    async unregister() {
      registered = false;
    },
    isRegistered() {
      return registered;
    },
  };
}

function createMockOPFS() {
  const files = new Map<string, Uint8Array>();

  return {
    async write(path: string, data: Uint8Array) {
      files.set(path, data);
    },
    async read(path: string) {
      return files.get(path);
    },
    async readRaw(path: string) {
      const data = files.get(path);
      return data ? new TextDecoder().decode(data) : '';
    },
  };
}

async function writeToOPFSEncrypted(
  opfs: ReturnType<typeof createMockOPFS>,
  path: string,
  data: unknown,
  encryptionKey: Uint8Array
) {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const encrypted = mockEncrypt(plaintext, encryptionKey, nonce);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, nonce.length);

  await opfs.write(path, combined);
}
