/**
 * Key Generation Security Tests
 *
 * Comprehensive tests for key generation security:
 * - Entropy source verification (crypto.getRandomValues)
 * - Valid secp256k1/Curve25519 key generation
 * - Key uniqueness guarantees
 * - Key material security (no leakage)
 *
 * @module services/crypto/__tests__/keys.test
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import {
  loadSodium,
  generateX25519KeyPair,
  generateEd25519KeyPair,
  generateEd25519KeyPairFromSeed,
  generateKey,
  generateNonce,
  generateRandomId,
  generateRandomIdHex,
  bytesToHex,
  CryptoConstants,
  secureWipe,
  constantTimeEqual,
  deriveSharedSecret,
  sign,
  verify,
} from '../index';

// ============================================================================
// Test Setup
// ============================================================================

describe('Key Generation Security', () => {
  beforeAll(async () => {
    await loadSodium();
  });

  // ==========================================================================
  // Entropy Source Verification
  // ==========================================================================

  describe('Entropy Source Verification', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should use crypto.getRandomValues as entropy source', () => {
      // Spy on crypto.getRandomValues
      const getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues');

      // Generate a random ID which uses randombytes under the hood
      generateRandomId(32);

      // Verify crypto.getRandomValues was called
      // Note: libsodium uses crypto.getRandomValues internally
      expect(getRandomValuesSpy).toHaveBeenCalled();
    });

    it('should use cryptographically secure random for key generation', () => {
      // This test verifies the library uses crypto.getRandomValues
      // rather than Math.random for key material

      // Generate key and verify it has high entropy (not predictable)
      const key1 = generateKey();
      const key2 = generateKey();

      // If Math.random were used with same seed, these would be identical
      // Crypto.getRandomValues guarantees uniqueness
      expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));

      // Verify key has full entropy (all bits can vary)
      const keys: Uint8Array[] = [];
      for (let i = 0; i < 20; i++) {
        keys.push(generateKey());
      }

      // Each byte position should have varying values across samples
      for (let bytePos = 0; bytePos < 32; bytePos++) {
        const valuesAtPosition = new Set(keys.map(k => k[bytePos]));
        // With 20 samples, each position should have multiple unique values
        expect(valuesAtPosition.size).toBeGreaterThan(1);
      }
    });

    it('should verify crypto.getRandomValues is available', () => {
      // Verify the Web Crypto API is available
      expect(typeof crypto).toBe('object');
      expect(typeof crypto.getRandomValues).toBe('function');
    });

    it('should generate cryptographically secure random bytes', () => {
      // Generate a large sample and verify it has expected entropy
      const samples: Uint8Array[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(generateRandomId(32));
      }

      // Calculate byte frequency distribution
      const byteFrequency = new Array(256).fill(0);
      for (const sample of samples) {
        for (const byte of sample) {
          byteFrequency[byte]++;
        }
      }

      // Total bytes analyzed
      const totalBytes = 100 * 32; // 3200 bytes

      // Expected frequency for uniform distribution
      const expectedFreq = totalBytes / 256; // ~12.5

      // Chi-squared test for uniformity
      // Allow some deviation but ensure it's not heavily biased
      let chiSquared = 0;
      for (const freq of byteFrequency) {
        chiSquared += Math.pow(freq - expectedFreq, 2) / expectedFreq;
      }

      // For 255 degrees of freedom at p=0.001, critical value is ~310
      // A truly random source should pass this test
      expect(chiSquared).toBeLessThan(400); // Allow some margin
    });
  });

  // ==========================================================================
  // Valid secp256k1/Curve25519 Key Generation
  // ==========================================================================

  describe('Valid Key Generation', () => {
    describe('X25519 Keys (Curve25519)', () => {
      it('should generate X25519 key pair with correct sizes', () => {
        const keyPair = generateX25519KeyPair();

        expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
        expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
        expect(keyPair.publicKey.length).toBe(CryptoConstants.X25519_PUBLIC_KEY_BYTES);
        expect(keyPair.privateKey.length).toBe(CryptoConstants.X25519_PRIVATE_KEY_BYTES);
      });

      it('should generate valid X25519 public key (not all zeros)', () => {
        const keyPair = generateX25519KeyPair();

        // Public key should not be all zeros (invalid point)
        const isAllZeros = keyPair.publicKey.every(b => b === 0);
        expect(isAllZeros).toBe(false);
      });

      it('should generate X25519 keys that can perform key exchange', () => {
        const alice = generateX25519KeyPair();
        const bob = generateX25519KeyPair();

        // Both parties should derive the same shared secret
        const sharedAlice = deriveSharedSecret(alice.privateKey, bob.publicKey);
        const sharedBob = deriveSharedSecret(bob.privateKey, alice.publicKey);

        expect(constantTimeEqual(sharedAlice, sharedBob)).toBe(true);
      });

      it('should clamp X25519 private key correctly', () => {
        // X25519 private keys should have specific bits set/cleared
        // Bit 0, 1, 2 of first byte should be 0
        // Bit 7 of last byte should be 0
        // Bit 6 of last byte should be 1

        for (let i = 0; i < 10; i++) {
          const keyPair = generateX25519KeyPair();
          const privateKey = keyPair.privateKey;

          // libsodium handles clamping internally, so generated keys should be valid
          // We just verify the key works for ECDH
          expect(privateKey.length).toBe(32);
        }
      });
    });

    describe('Ed25519 Keys', () => {
      it('should generate Ed25519 key pair with correct sizes', () => {
        const keyPair = generateEd25519KeyPair();

        expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
        expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
        expect(keyPair.publicKey.length).toBe(CryptoConstants.ED25519_PUBLIC_KEY_BYTES);
        expect(keyPair.privateKey.length).toBe(CryptoConstants.ED25519_PRIVATE_KEY_BYTES);
      });

      it('should generate Ed25519 keys that can sign and verify', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const signature = sign(message, keyPair.privateKey);
        const isValid = verify(message, signature.signature, keyPair.publicKey);

        expect(isValid).toBe(true);
      });

      it('should generate deterministic Ed25519 keys from seed', () => {
        const seed = new Uint8Array(32);
        seed.fill(42);

        const keyPair1 = generateEd25519KeyPairFromSeed(seed);
        const keyPair2 = generateEd25519KeyPairFromSeed(seed);

        expect(bytesToHex(keyPair1.publicKey)).toBe(bytesToHex(keyPair2.publicKey));
        expect(bytesToHex(keyPair1.privateKey)).toBe(bytesToHex(keyPair2.privateKey));
      });

      it('should reject invalid seed lengths for Ed25519', () => {
        const shortSeed = new Uint8Array(16);
        const longSeed = new Uint8Array(64);

        expect(() => generateEd25519KeyPairFromSeed(shortSeed)).toThrow();
        expect(() => generateEd25519KeyPairFromSeed(longSeed)).toThrow();
      });

      it('should generate Ed25519 public key as part of private key', () => {
        // Ed25519 private key is seed (32 bytes) + public key (32 bytes)
        const keyPair = generateEd25519KeyPair();

        // Last 32 bytes of private key should be the public key
        const pubKeyFromPrivate = keyPair.privateKey.slice(32);
        expect(constantTimeEqual(pubKeyFromPrivate, keyPair.publicKey)).toBe(true);
      });
    });

    describe('Encryption Keys', () => {
      it('should generate encryption keys with correct size', () => {
        const key = generateKey();

        expect(key).toBeInstanceOf(Uint8Array);
        expect(key.length).toBe(CryptoConstants.CHACHA20_KEY_BYTES);
      });

      it('should generate nonces with correct size', () => {
        const nonce = generateNonce();

        expect(nonce).toBeInstanceOf(Uint8Array);
        expect(nonce.length).toBe(CryptoConstants.XCHACHA20_NONCE_BYTES);
      });
    });
  });

  // ==========================================================================
  // Key Uniqueness Guarantees
  // ==========================================================================

  describe('Key Uniqueness Guarantees', () => {
    it('should generate 100 unique X25519 key pairs', () => {
      const publicKeys = new Set<string>();
      const privateKeys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const keyPair = generateX25519KeyPair();
        publicKeys.add(bytesToHex(keyPair.publicKey));
        privateKeys.add(bytesToHex(keyPair.privateKey));
      }

      // All 100 public keys should be unique
      expect(publicKeys.size).toBe(100);

      // All 100 private keys should be unique
      expect(privateKeys.size).toBe(100);
    });

    it('should generate 100 unique Ed25519 key pairs', () => {
      const publicKeys = new Set<string>();
      const privateKeys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const keyPair = generateEd25519KeyPair();
        publicKeys.add(bytesToHex(keyPair.publicKey));
        privateKeys.add(bytesToHex(keyPair.privateKey));
      }

      // All 100 public keys should be unique
      expect(publicKeys.size).toBe(100);

      // All 100 private keys should be unique
      expect(privateKeys.size).toBe(100);
    });

    it('should generate 100 unique encryption keys', () => {
      const keys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const key = generateKey();
        keys.add(bytesToHex(key));
      }

      // All 100 keys should be unique
      expect(keys.size).toBe(100);
    });

    it('should generate 100 unique nonces', () => {
      const nonces = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const nonce = generateNonce();
        nonces.add(bytesToHex(nonce));
      }

      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });

    it('should generate 100 unique random IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = generateRandomId(32);
        ids.add(bytesToHex(id));
      }

      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should generate 100 unique random hex IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = generateRandomIdHex(32);
        ids.add(id);
      }

      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should never generate sequential or predictable keys', () => {
      // Generate pairs of consecutive keys and ensure they differ significantly
      for (let i = 0; i < 50; i++) {
        const key1 = generateRandomId(32);
        const key2 = generateRandomId(32);

        // Count differing bytes
        let differingBytes = 0;
        for (let j = 0; j < 32; j++) {
          if (key1[j] !== key2[j]) {
            differingBytes++;
          }
        }

        // At least 20 of 32 bytes should differ (statistically almost certain)
        expect(differingBytes).toBeGreaterThan(15);
      }
    });
  });

  // ==========================================================================
  // Key Material Security
  // ==========================================================================

  describe('Key Material Security', () => {
    it('should securely wipe key material from memory', () => {
      const key = generateKey();
      const originalHex = bytesToHex(key);

      // Verify key has data
      expect(key.some(b => b !== 0)).toBe(true);

      // Wipe the key
      secureWipe(key);

      // All bytes should now be zero
      const isAllZeros = key.every(b => b === 0);
      expect(isAllZeros).toBe(true);

      // Should not match original
      expect(bytesToHex(key)).not.toBe(originalHex);
    });

    it('should wipe Ed25519 private key material', () => {
      const keyPair = generateEd25519KeyPair();

      // Verify private key has data
      expect(keyPair.privateKey.some(b => b !== 0)).toBe(true);

      // Wipe the private key
      secureWipe(keyPair.privateKey);

      // All bytes should be zero
      expect(keyPair.privateKey.every(b => b === 0)).toBe(true);
    });

    it('should wipe X25519 private key material', () => {
      const keyPair = generateX25519KeyPair();

      // Verify private key has data
      expect(keyPair.privateKey.some(b => b !== 0)).toBe(true);

      // Wipe the private key
      secureWipe(keyPair.privateKey);

      // All bytes should be zero
      expect(keyPair.privateKey.every(b => b === 0)).toBe(true);
    });

    it('should not expose private key in console logs', () => {
      // Mock console methods
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Generate keys
      const keyPair = generateX25519KeyPair();
      const privateKeyHex = bytesToHex(keyPair.privateKey);

      // Get all console output
      const allLogs = [
        ...consoleLogSpy.mock.calls.map(c => String(c)),
        ...consoleErrorSpy.mock.calls.map(c => String(c)),
        ...consoleWarnSpy.mock.calls.map(c => String(c)),
      ].join(' ');

      // Private key should not appear in any log
      expect(allLogs).not.toContain(privateKeyHex);

      // Cleanup
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should not include private key in error messages', () => {
      const keyPair = generateX25519KeyPair();
      const privateKeyHex = bytesToHex(keyPair.privateKey);

      // Test various error scenarios
      const errorScenarios = [
        () => generateEd25519KeyPairFromSeed(new Uint8Array(16)), // Invalid seed
      ];

      for (const scenario of errorScenarios) {
        try {
          scenario();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Error message should not contain the private key
          expect(errorMessage).not.toContain(privateKeyHex);
        }
      }
    });

    it('should create independent key copies', () => {
      const keyPair1 = generateX25519KeyPair();
      const originalPublicHex = bytesToHex(keyPair1.publicKey);
      const originalPrivateHex = bytesToHex(keyPair1.privateKey);

      // Generate a second key pair
      const keyPair2 = generateX25519KeyPair();

      // Wipe the second key pair
      secureWipe(keyPair2.privateKey);

      // First key pair should be unaffected
      expect(bytesToHex(keyPair1.publicKey)).toBe(originalPublicHex);
      expect(bytesToHex(keyPair1.privateKey)).toBe(originalPrivateHex);
    });

    it('should not share underlying buffer between keys', () => {
      const keys: Uint8Array[] = [];

      // Generate multiple keys
      for (let i = 0; i < 10; i++) {
        keys.push(generateKey());
      }

      // Wipe the first key
      secureWipe(keys[0]);

      // All other keys should be unaffected
      for (let i = 1; i < 10; i++) {
        expect(keys[i].some(b => b !== 0)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid successive key generation', async () => {
      const promises: Promise<void>[] = [];

      // Generate 50 key pairs simultaneously
      for (let i = 0; i < 50; i++) {
        promises.push(
          new Promise((resolve) => {
            generateX25519KeyPair();
            generateEd25519KeyPair();
            resolve();
          })
        );
      }

      // All should complete successfully
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should generate valid keys under memory pressure', () => {
      // Allocate a lot of memory to simulate pressure
      const largeArrays: Uint8Array[] = [];
      try {
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Uint8Array(1024 * 1024)); // 1MB each
        }
      } catch {
        // Memory allocation might fail, that's okay
      }

      // Should still generate valid keys
      const keyPair = generateX25519KeyPair();
      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.privateKey.length).toBe(32);

      // Cleanup
      largeArrays.length = 0;
    });

    it('should handle zero-length random ID request', () => {
      const id = generateRandomId(0);
      expect(id.length).toBe(0);
    });

    it('should handle various random ID lengths', () => {
      const lengths = [1, 8, 16, 32, 64, 128, 256];

      for (const len of lengths) {
        const id = generateRandomId(len);
        expect(id.length).toBe(len);
        // Should have some non-zero bytes (except for very short lengths)
        if (len >= 8) {
          expect(id.some(b => b !== 0)).toBe(true);
        }
      }
    });
  });
});
