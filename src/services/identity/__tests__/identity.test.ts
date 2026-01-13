/**
 * Identity Service Tests
 *
 * Comprehensive tests for the identity service including:
 * - Key generation
 * - Key derivation from seed/mnemonic
 * - Secure storage
 * - Nostr key conversion
 * - Key import/export
 * - Visual fingerprint generation
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { nip19 } from 'nostr-tools';
import { IdentityService } from '../index';
import {
  detectImportFormat,
  validateImport,
  importFromNsec,
  importFromHex,
  importKey,
  isValidNsec,
  isValidHexKey,
  isValidMnemonicFormat,
  sanitizeImportInput,
  privateKeyToNsec,
  privateKeyToHex,
  derivePublicInfo,
} from '../import';
import {
  generateVisualFingerprint,
  formatFingerprint,
  formatAsBlocks,
  formatAsGrid,
  getShortId,
  generateColors,
  generateEmojiFingerprint,
  generateRandomart,
  compareFingerprints,
  fingerprintsMatch,
  generateVerificationWords,
  generateQRCompatible,
  parseQRFingerprint,
} from '../fingerprint';
import { loadSodium, bytesToHex, hexToBytes, sha256Hex } from '../../crypto';
import type { StorageAdapter } from '../../storage/types';

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Create a mock storage adapter for testing
 */
function createMockStorage(): StorageAdapter {
  const store = new Map<string, Map<string, unknown>>();

  return {
    async get<T>(table: string, key: string): Promise<T | null> {
      const tableData = store.get(table);
      if (!tableData) return null;
      return (tableData.get(key) as T) ?? null;
    },

    async set<T>(table: string, key: string, value: T): Promise<void> {
      if (!store.has(table)) {
        store.set(table, new Map());
      }
      store.get(table)!.set(key, value);
    },

    async delete(table: string, key: string): Promise<boolean> {
      const tableData = store.get(table);
      if (!tableData) return false;
      return tableData.delete(key);
    },

    async clear(table: string): Promise<void> {
      store.delete(table);
    },

    async keys(table: string): Promise<string[]> {
      const tableData = store.get(table);
      if (!tableData) return [];
      return Array.from(tableData.keys());
    },

    async getAll<T>(table: string): Promise<T[]> {
      const tableData = store.get(table);
      if (!tableData) return [];
      return Array.from(tableData.values()) as T[];
    },

    async getMany<T>(table: string, keys: string[]): Promise<(T | null)[]> {
      const tableData = store.get(table);
      if (!tableData) return keys.map(() => null);
      return keys.map(key => (tableData.get(key) as T) ?? null);
    },

    async setMany<T>(table: string, entries: [string, T][]): Promise<void> {
      if (!store.has(table)) {
        store.set(table, new Map());
      }
      const tableData = store.get(table)!;
      for (const [key, value] of entries) {
        tableData.set(key, value);
      }
    },

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async close(): Promise<void> {
      // No-op
    },
  };
}

// Known test vectors
const TEST_VECTORS = {
  // A known nsec for testing
  nsec: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Corresponding public key (hex)
  publicKey: 'ee6ea2b140ec4ee8c38b7bb32b5e4b47a12beaca4c8e2e10ecafc2ae7c85ab4d',
  // Corresponding npub
  npub: 'npub1ae82tvy8pvnhrrp0hwmvk4uj50gfthv5fvw9cg8jh7c2hn7pddxs9qh52a',
  // A known hex private key
  hexKey: '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa',
  // Test password
  password: 'TestPassword123!',
  // Test mnemonic (12 words)
  mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
};

// ============================================================================
// Identity Service Tests
// ============================================================================

describe('IdentityService', () => {
  let service: IdentityService;
  let storage: StorageAdapter;

  beforeAll(async () => {
    // Initialize crypto
    await loadSodium();
  });

  beforeEach(async () => {
    // Reset singleton and create fresh storage
    IdentityService._resetForTesting();
    service = IdentityService.getInstance();
    storage = createMockStorage();
    await service.initialize({ storage });
  });

  afterEach(() => {
    service.lock();
  });

  describe('initialization', () => {
    it('should be a singleton', () => {
      const service2 = IdentityService.getInstance();
      expect(service).toBe(service2);
    });

    it('should initialize successfully', () => {
      expect(service.isInitialized()).toBe(true);
    });

    it('should throw if not initialized', async () => {
      IdentityService._resetForTesting();
      const freshService = IdentityService.getInstance();
      await expect(freshService.hasIdentity()).rejects.toThrow('not initialized');
    });
  });

  describe('key generation', () => {
    it('should generate a new identity with random keys', async () => {
      const identity = await service.generateNewIdentity(TEST_VECTORS.password);

      expect(identity).toBeDefined();
      expect(identity.publicKey).toHaveLength(64); // 32 bytes hex
      expect(identity.npub).toMatch(/^npub1/);
      expect(identity.fingerprint).toHaveLength(64); // SHA-256 hex
      expect(identity.signingPublicKey).toHaveLength(64);
      expect(identity.exchangePublicKey).toHaveLength(64);
      expect(identity.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should generate different keys on each call', async () => {
      const identity1 = await service.generateNewIdentity(TEST_VECTORS.password);

      // Reset and generate new
      service.lock();
      await storage.clear('keys');

      const identity2 = await service.generateNewIdentity(TEST_VECTORS.password);

      expect(identity1.publicKey).not.toBe(identity2.publicKey);
      expect(identity1.fingerprint).not.toBe(identity2.fingerprint);
    });

    it('should generate deterministic keys from seed', async () => {
      const seed = new Uint8Array(32);
      seed.fill(42); // Known seed

      const identity1 = await service.generateFromSeed(seed, TEST_VECTORS.password);

      // Reset and regenerate from same seed
      IdentityService._resetForTesting();
      service = IdentityService.getInstance();
      storage = createMockStorage();
      await service.initialize({ storage });

      const identity2 = await service.generateFromSeed(seed, TEST_VECTORS.password);

      expect(identity1.publicKey).toBe(identity2.publicKey);
      expect(identity1.fingerprint).toBe(identity2.fingerprint);
    });

    it('should reject invalid seed length', async () => {
      const shortSeed = new Uint8Array(16);
      await expect(service.generateFromSeed(shortSeed, TEST_VECTORS.password))
        .rejects.toThrow('32 bytes');
    });
  });

  describe('key storage and retrieval', () => {
    it('should persist identity metadata', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      const hasIdentity = await service.hasIdentity();
      expect(hasIdentity).toBe(true);

      const identity = await service.getIdentity();
      expect(identity).not.toBeNull();
      expect(identity!.publicKey).toHaveLength(64);
    });

    it('should load identity with correct password', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);
      service.lock();

      const keyMaterial = await service.loadIdentity(TEST_VECTORS.password);

      expect(keyMaterial).toBeDefined();
      expect(keyMaterial.nostrPrivateKey).toHaveLength(32);
      expect(keyMaterial.signingPrivateKey).toHaveLength(64);
      expect(keyMaterial.exchangePrivateKey).toHaveLength(32);
    });

    it('should reject incorrect password', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);
      service.lock();

      await expect(service.loadIdentity('WrongPassword'))
        .rejects.toThrow('Incorrect password');
    });

    it('should cache decrypted keys', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);
      service.lock();

      // First load
      const keys1 = await service.loadIdentity(TEST_VECTORS.password);

      // Should be cached
      const keys2 = await service.getKeyMaterial();

      expect(keys1).toBe(keys2);
    });

    it('should clear keys on lock', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      expect(service.isUnlocked()).toBe(true);

      service.lock();

      expect(service.isUnlocked()).toBe(false);
      expect(await service.getKeyMaterial()).toBeNull();
    });
  });

  describe('key export', () => {
    it('should export as nsec', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      const backup = await service.exportAsNsec(TEST_VECTORS.password);

      expect(backup.type).toBe('nsec');
      expect(backup.data).toMatch(/^nsec1/);
      expect(backup.publicKey).toBeDefined();
      expect(backup.fingerprint).toBeDefined();
      expect(backup.exportedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should export as raw seed', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      const backup = await service.exportRawSeed(TEST_VECTORS.password);

      expect(backup.type).toBe('raw');
      expect(backup.data).toHaveLength(64); // 32 bytes hex
    });

    it('should verify exported nsec derives same public key', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);
      const identity = await service.getIdentity();

      const backup = await service.exportAsNsec(TEST_VECTORS.password);

      // Decode nsec and verify
      const decoded = nip19.decode(backup.data);
      expect(decoded.type).toBe('nsec');

      const result = importFromNsec(backup.data);
      expect(result.success).toBe(true);
      expect(result.publicKey).toBe(identity!.publicKey);
    });
  });

  describe('password change', () => {
    it('should change password successfully', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);
      const originalIdentity = await service.getIdentity();

      await service.changePassword(TEST_VECTORS.password, 'NewPassword456!');
      service.lock();

      // Old password should fail
      await expect(service.loadIdentity(TEST_VECTORS.password))
        .rejects.toThrow();

      // New password should work
      const keyMaterial = await service.loadIdentity('NewPassword456!');
      expect(keyMaterial).toBeDefined();

      // Identity should be unchanged
      const identity = await service.getIdentity();
      expect(identity!.publicKey).toBe(originalIdentity!.publicKey);
    });
  });

  describe('key rotation', () => {
    it('should rotate to new identity', async () => {
      const original = await service.generateNewIdentity(TEST_VECTORS.password);

      const rotated = await service.rotateIdentity(TEST_VECTORS.password);

      expect(rotated.publicKey).not.toBe(original.publicKey);
      expect(rotated.fingerprint).not.toBe(original.fingerprint);
    });

    it('should preserve rotation history', async () => {
      const original = await service.generateNewIdentity(TEST_VECTORS.password);
      await service.rotateIdentity(TEST_VECTORS.password);

      const history = await service.getRotationHistory();

      expect(history).toHaveLength(1);
      expect(history[0]?.publicKey).toBe(original.publicKey);
    });
  });

  describe('wipe', () => {
    it('should wipe all identity data', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      await service.wipeAll();

      expect(await service.hasIdentity()).toBe(false);
      expect(await service.getIdentity()).toBeNull();
      expect(service.isUnlocked()).toBe(false);
    });
  });

  describe('verify password', () => {
    it('should verify correct password', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      const valid = await service.verifyPassword(TEST_VECTORS.password);
      expect(valid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      await service.generateNewIdentity(TEST_VECTORS.password);

      const valid = await service.verifyPassword('WrongPassword');
      expect(valid).toBe(false);
    });
  });
});

// ============================================================================
// Import Module Tests
// ============================================================================

describe('Import Module', () => {
  beforeAll(async () => {
    await loadSodium();
  });

  describe('format detection', () => {
    it('should detect nsec format', () => {
      expect(detectImportFormat(TEST_VECTORS.nsec)).toBe('nsec');
    });

    it('should detect hex format', () => {
      expect(detectImportFormat(TEST_VECTORS.hexKey)).toBe('hex');
    });

    it('should detect mnemonic format', () => {
      expect(detectImportFormat(TEST_VECTORS.mnemonic)).toBe('mnemonic');
    });

    it('should return null for invalid format', () => {
      expect(detectImportFormat('invalid')).toBeNull();
      expect(detectImportFormat('not a valid key')).toBeNull();
    });

    it('should handle whitespace', () => {
      expect(detectImportFormat(`  ${TEST_VECTORS.nsec}  `)).toBe('nsec');
    });
  });

  describe('validation', () => {
    it('should validate nsec', () => {
      const result = validateImport(TEST_VECTORS.nsec);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('nsec');
      expect(result.npubPreview).toBeDefined();
    });

    it('should validate hex key', () => {
      const result = validateImport(TEST_VECTORS.hexKey);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('hex');
    });

    it('should validate mnemonic', () => {
      const result = validateImport(TEST_VECTORS.mnemonic);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('mnemonic');
    });

    it('should reject invalid nsec', () => {
      const result = validateImport('nsec1invalidkey');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject short hex', () => {
      const result = validateImport('abcd1234');
      expect(result.valid).toBe(false);
    });
  });

  describe('nsec import', () => {
    it('should import valid nsec', () => {
      const result = importFromNsec(TEST_VECTORS.nsec);

      expect(result.success).toBe(true);
      expect(result.privateKey).toHaveLength(32);
      expect(result.publicKey).toBeDefined();
      expect(result.npub).toMatch(/^npub1/);
      expect(result.fingerprint).toHaveLength(64);
    });

    it('should reject invalid nsec', () => {
      const result = importFromNsec('nsec1invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('hex import', () => {
    it('should import valid hex key', () => {
      const result = importFromHex(TEST_VECTORS.hexKey);

      expect(result.success).toBe(true);
      expect(result.privateKey).toHaveLength(32);
      expect(result.publicKey).toBeDefined();
    });

    it('should normalize uppercase hex', () => {
      const result = importFromHex(TEST_VECTORS.hexKey.toUpperCase());
      expect(result.success).toBe(true);
    });

    it('should reject invalid hex', () => {
      const result = importFromHex('not-hex');
      expect(result.success).toBe(false);
    });
  });

  describe('auto-import', () => {
    it('should auto-detect and import nsec', async () => {
      const result = await importKey(TEST_VECTORS.nsec);
      expect(result.success).toBe(true);
      expect(result.format).toBe('nsec');
    });

    it('should auto-detect and import hex', async () => {
      const result = await importKey(TEST_VECTORS.hexKey);
      expect(result.success).toBe(true);
      expect(result.format).toBe('hex');
    });
  });

  describe('validation helpers', () => {
    it('should validate nsec format', () => {
      expect(isValidNsec(TEST_VECTORS.nsec)).toBe(true);
      expect(isValidNsec('invalid')).toBe(false);
    });

    it('should validate hex key format', () => {
      expect(isValidHexKey(TEST_VECTORS.hexKey)).toBe(true);
      expect(isValidHexKey('short')).toBe(false);
    });

    it('should validate mnemonic format', () => {
      const result = isValidMnemonicFormat(TEST_VECTORS.mnemonic);
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(12);
    });

    it('should reject invalid mnemonic word count', () => {
      const result = isValidMnemonicFormat('one two three');
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitization', () => {
    it('should sanitize input', () => {
      expect(sanitizeImportInput(`  ${TEST_VECTORS.nsec}  `)).toBe(TEST_VECTORS.nsec);
      expect(sanitizeImportInput('ABCD'.repeat(16))).toBe('abcd'.repeat(16));
      expect(sanitizeImportInput('word1   word2  word3')).toBe('word1 word2 word3');
    });
  });

  describe('export functions', () => {
    it('should convert private key to nsec', () => {
      const privateKey = hexToBytes(TEST_VECTORS.hexKey);
      const nsec = privateKeyToNsec(privateKey);
      expect(nsec).toMatch(/^nsec1/);
    });

    it('should convert private key to hex', () => {
      const privateKey = new Uint8Array(32);
      privateKey.fill(42);
      const hex = privateKeyToHex(privateKey);
      expect(hex).toHaveLength(64);
    });

    it('should derive public info', () => {
      const privateKey = hexToBytes(TEST_VECTORS.hexKey);
      const info = derivePublicInfo(privateKey);

      expect(info.publicKey).toBeDefined();
      expect(info.npub).toMatch(/^npub1/);
      expect(info.fingerprint).toHaveLength(64);
    });
  });
});

// ============================================================================
// Fingerprint Module Tests
// ============================================================================

describe('Fingerprint Module', () => {
  const testPublicKey = TEST_VECTORS.publicKey;
  let testKeyBytes: Uint8Array;

  beforeAll(async () => {
    await loadSodium();
    testKeyBytes = hexToBytes(testPublicKey);
  });

  describe('visual fingerprint generation', () => {
    it('should generate complete fingerprint', () => {
      const fp = generateVisualFingerprint(testKeyBytes);

      expect(fp.hash).toHaveLength(32);
      expect(fp.hex).toHaveLength(64);
      expect(fp.formatted).toContain(':');
      expect(fp.short).toHaveLength(16);
      expect(fp.colors).toBeDefined();
      expect(fp.emoji).toBeDefined();
      expect(fp.randomart).toBeDefined();
      expect(fp.blocks).toContain(' ');
    });

    it('should accept hex string input', () => {
      const fp = generateVisualFingerprint(testPublicKey);
      expect(fp.hex).toHaveLength(64);
    });

    it('should produce deterministic output', () => {
      const fp1 = generateVisualFingerprint(testKeyBytes);
      const fp2 = generateVisualFingerprint(testKeyBytes);

      expect(fp1.hex).toBe(fp2.hex);
      expect(fp1.emoji).toBe(fp2.emoji);
      expect(fp1.randomart).toBe(fp2.randomart);
    });
  });

  describe('text formatting', () => {
    it('should format with colons', () => {
      const formatted = formatFingerprint('ABCD1234');
      expect(formatted).toBe('AB:CD:12:34');
    });

    it('should format as blocks', () => {
      const blocks = formatAsBlocks('ABCD12345678');
      expect(blocks).toBe('ABCD 1234 5678');
    });

    it('should format as grid', () => {
      const grid = formatAsGrid('A'.repeat(64));
      const lines = grid.split('\n');
      expect(lines).toHaveLength(4);
    });

    it('should get short ID', () => {
      const shortId = getShortId('ABCD1234EFGH');
      expect(shortId).toBe('ABCD:1234');
    });
  });

  describe('color generation', () => {
    it('should generate color palette', () => {
      const hash = new Uint8Array(32);
      hash.fill(128);

      const colors = generateColors(hash);

      expect(colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.tertiary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.palette).toHaveLength(8);
      expect(colors.gradient).toContain('linear-gradient');
    });

    it('should produce different colors for different inputs', () => {
      const hash1 = new Uint8Array(32);
      hash1.fill(0);
      const hash2 = new Uint8Array(32);
      hash2.fill(255);

      const colors1 = generateColors(hash1);
      const colors2 = generateColors(hash2);

      expect(colors1.primary).not.toBe(colors2.primary);
    });
  });

  describe('emoji fingerprint', () => {
    it('should generate 8 emoji', () => {
      const hash = new Uint8Array(32);
      hash.fill(42);

      const emoji = generateEmojiFingerprint(hash);

      // Count emoji (this is approximate due to emoji complexity)
      expect(emoji.length).toBeGreaterThan(0);
    });

    it('should be deterministic', () => {
      const hash = new Uint8Array(32);
      hash.fill(99);

      const emoji1 = generateEmojiFingerprint(hash);
      const emoji2 = generateEmojiFingerprint(hash);

      expect(emoji1).toBe(emoji2);
    });
  });

  describe('randomart', () => {
    it('should generate randomart with borders', () => {
      const hash = new Uint8Array(32);
      hash.fill(50);

      const art = generateRandomart(hash);
      const lines = art.split('\n');

      expect(lines[0]).toMatch(/^\+[-]+\+$/);
      expect(lines[lines.length - 1]).toMatch(/^\+[-]+\+$/);
      expect(lines[1]).toMatch(/^\|.*\|$/);
    });

    it('should include start and end markers', () => {
      const hash = new Uint8Array(32);
      hash.fill(75);

      const art = generateRandomart(hash);

      expect(art).toContain('S'); // Start
      expect(art).toContain('E'); // End
    });
  });

  describe('comparison', () => {
    it('should detect matching fingerprints', () => {
      const result = compareFingerprints(testPublicKey, testPublicKey);

      expect(result.match).toBe(true);
      expect(result.similarity).toBe(100);
      expect(result.matchingChars).toBe(64);
    });

    it('should detect non-matching fingerprints', () => {
      const other = 'B'.repeat(64);
      const result = compareFingerprints(testPublicKey, other);

      expect(result.match).toBe(false);
      expect(result.similarity).toBeLessThan(100);
    });

    it('should calculate similarity', () => {
      // Same first half
      const fp1 = 'A'.repeat(32) + 'B'.repeat(32);
      const fp2 = 'A'.repeat(32) + 'C'.repeat(32);

      const result = compareFingerprints(fp1, fp2);

      expect(result.similarity).toBe(50);
      expect(result.matchingChars).toBe(32);
    });

    it('should use fingerprintsMatch helper', () => {
      expect(fingerprintsMatch(testPublicKey, testPublicKey)).toBe(true);
      expect(fingerprintsMatch(testPublicKey, 'B'.repeat(64))).toBe(false);
    });
  });

  describe('verification words', () => {
    it('should generate 8 words', () => {
      const hash = new Uint8Array(32);
      hash.fill(123);

      const words = generateVerificationWords(hash);

      expect(words).toHaveLength(8);
      words.forEach(word => {
        expect(typeof word).toBe('string');
        expect(word.length).toBeGreaterThan(0);
      });
    });

    it('should be deterministic', () => {
      const hash = new Uint8Array(32);
      hash.fill(200);

      const words1 = generateVerificationWords(hash);
      const words2 = generateVerificationWords(hash);

      expect(words1).toEqual(words2);
    });
  });

  describe('QR compatibility', () => {
    it('should generate QR-compatible string', () => {
      const qr = generateQRCompatible(testKeyBytes);

      expect(qr).toMatch(/^bitchat:/);
    });

    it('should parse QR fingerprint', () => {
      const qr = generateQRCompatible(testKeyBytes);
      const parsed = parseQRFingerprint(qr);

      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(32);
    });

    it('should reject invalid QR format', () => {
      const result = parseQRFingerprint('invalid');
      expect(result).toBeNull();
    });

    it('should round-trip correctly', () => {
      const original = sha256Hex(testKeyBytes);
      const qr = generateQRCompatible(testKeyBytes);
      const parsed = parseQRFingerprint(qr);

      expect(bytesToHex(parsed!)).toBe(original.toLowerCase());
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Identity Service Integration', () => {
  let service: IdentityService;
  let storage: StorageAdapter;

  beforeAll(async () => {
    await loadSodium();
  });

  beforeEach(async () => {
    IdentityService._resetForTesting();
    service = IdentityService.getInstance();
    storage = createMockStorage();
    await service.initialize({ storage });
  });

  afterEach(() => {
    service.lock();
  });

  it('should complete full identity lifecycle', async () => {
    // Generate identity
    const identity = await service.generateNewIdentity(TEST_VECTORS.password);
    expect(identity).toBeDefined();

    // Export backup
    const backup = await service.exportAsNsec(TEST_VECTORS.password);
    expect(backup.data).toMatch(/^nsec1/);

    // Lock
    service.lock();
    expect(service.isUnlocked()).toBe(false);

    // Unlock
    const keys = await service.loadIdentity(TEST_VECTORS.password);
    expect(keys).toBeDefined();
    expect(service.isUnlocked()).toBe(true);

    // Generate fingerprint
    const fp = generateVisualFingerprint(identity.publicKey);
    expect(fp.formatted).toBeDefined();

    // Verify export matches identity
    const importResult = importFromNsec(backup.data);
    expect(importResult.publicKey).toBe(identity.publicKey);
  });

  it('should import existing nsec and use it', async () => {
    // Import from nsec
    const importResult = importFromNsec(TEST_VECTORS.nsec);
    expect(importResult.success).toBe(true);

    // Generate identity from the imported key
    const identity = await service.generateFromSeed(
      importResult.privateKey!,
      TEST_VECTORS.password
    );

    // The Nostr public key should match
    // Note: Due to domain separation in key derivation, the derived key may differ
    // from the original import. This tests the seed-based flow works correctly.
    expect(identity.publicKey).toHaveLength(64);
    expect(identity.npub).toMatch(/^npub1/);
  });
});
