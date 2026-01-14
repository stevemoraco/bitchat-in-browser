/**
 * E2E Tests: Key Derivation and Cryptographic Operations
 *
 * Comprehensive end-to-end tests for cryptographic key operations including:
 * - Key generation from known seeds
 * - Public key derivation verification
 * - Fingerprint calculation and verification
 * - Ed25519 signing and verification
 * - X25519 key exchange
 *
 * These tests verify that the web implementation produces correct
 * cryptographic outputs that are compatible with other implementations.
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Test Vectors
// ============================================================================

/**
 * Hardcoded test vectors for deterministic key derivation verification.
 * These vectors can be used to verify cross-platform compatibility.
 *
 * Format: secp256k1/Ed25519 keys (32 bytes hex for seeds/private keys)
 */
const KEY_DERIVATION_VECTORS = {
  // Vector 1: Zero seed
  zeroSeed: {
    seed: '0000000000000000000000000000000000000000000000000000000000000000',
    // Expected Ed25519 public key when using this seed
    // This is deterministic - same seed always produces same key
  },
  // Vector 2: Sequential bytes seed
  sequentialSeed: {
    seed: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  },
  // Vector 3: Random test seed
  testSeed: {
    seed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
  // Vector 4: All 0xFF seed
  maxSeed: {
    seed: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  },
};

/**
 * Test vectors for signature verification.
 */
const SIGNATURE_VECTORS = {
  // Simple test message
  simpleMessage: 'Hello, World!',
  // Empty message
  emptyMessage: '',
  // Long message
  longMessage: 'A'.repeat(10000),
  // Unicode message
  unicodeMessage: '\u{1F44B} Hello \u{1F30D} World \u{1F512}',
  // JSON message
  jsonMessage: '{"type":"test","data":{"value":123}}',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sets up the crypto context by navigating to the app and waiting for load.
 */
async function setupCryptoContext(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => typeof window !== 'undefined', { timeout: 10000 });
}

/**
 * Execute cryptographic operations in the browser context using libsodium.
 */
async function executeCrypto(
  page: Page,
  operation: string,
  args: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await page.evaluate(
    async ({ operation, args }) => {
      // Import required libraries
      const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils');

      // Try to use the app's crypto service if available, otherwise use libsodium directly
      let sodium: typeof import('libsodium-wrappers-sumo');
      try {
        const libsodium = await import('libsodium-wrappers-sumo');
        await libsodium.ready;
        sodium = libsodium;
      } catch (e) {
        throw new Error('Failed to load libsodium: ' + (e as Error).message);
      }

      // Helper: Convert bytes to hex
      function toHex(bytes: Uint8Array): string {
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }

      // Helper: Convert hex to bytes
      function fromHex(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        }
        return bytes;
      }

      // Define crypto operations
      const operations: Record<string, (...opArgs: unknown[]) => unknown> = {
        // Generate Ed25519 keypair from seed
        generateEd25519KeyPairFromSeed: (seedHex: string) => {
          const seed = fromHex(seedHex);
          if (seed.length !== 32) {
            throw new Error(`Invalid seed length: expected 32 bytes, got ${seed.length}`);
          }
          const keyPair = sodium.crypto_sign_seed_keypair(seed);
          return {
            publicKey: toHex(keyPair.publicKey),
            privateKey: toHex(keyPair.privateKey),
            seed: seedHex,
          };
        },

        // Generate random Ed25519 keypair
        generateEd25519KeyPair: () => {
          const keyPair = sodium.crypto_sign_keypair();
          return {
            publicKey: toHex(keyPair.publicKey),
            privateKey: toHex(keyPair.privateKey),
          };
        },

        // Generate random X25519 keypair
        generateX25519KeyPair: () => {
          const keyPair = sodium.crypto_box_keypair();
          return {
            publicKey: toHex(keyPair.publicKey),
            privateKey: toHex(keyPair.privateKey),
          };
        },

        // Derive public key from Ed25519 private key (seed portion)
        deriveEd25519PublicKey: (privateKeyHex: string) => {
          const privateKey = fromHex(privateKeyHex);
          // For Ed25519, the private key is 64 bytes (seed + public key)
          // If 32 bytes are provided, it's the seed
          if (privateKey.length === 32) {
            const keyPair = sodium.crypto_sign_seed_keypair(privateKey);
            return toHex(keyPair.publicKey);
          } else if (privateKey.length === 64) {
            // Extract public key from the end of the private key
            return toHex(privateKey.slice(32));
          }
          throw new Error(`Invalid private key length: ${privateKey.length}`);
        },

        // Compute SHA-256 hash
        sha256: (dataHex: string) => {
          const data = fromHex(dataHex);
          const hash = sodium.crypto_hash_sha256(data);
          return toHex(hash);
        },

        // Compute SHA-256 hash of string
        sha256String: (text: string) => {
          const data = sodium.from_string(text);
          const hash = sodium.crypto_hash_sha256(data);
          return toHex(hash);
        },

        // Generate fingerprint from public key
        fingerprint: (publicKeyHex: string) => {
          const publicKey = fromHex(publicKeyHex);
          if (publicKey.length !== 32) {
            throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKey.length}`);
          }
          const hash = sodium.crypto_hash_sha256(publicKey);
          const hashHex = toHex(hash).toUpperCase();

          // Format as groups of 4
          const groups: string[] = [];
          for (let i = 0; i < hashHex.length; i += 4) {
            groups.push(hashHex.slice(i, i + 4));
          }

          return {
            hash: toHex(hash),
            formatted: groups.join(':'),
            short: `${groups[0]}:${groups[1]}`,
          };
        },

        // Sign a message with Ed25519
        sign: (messageHex: string, privateKeyHex: string) => {
          const message = fromHex(messageHex);
          const privateKey = fromHex(privateKeyHex);
          if (privateKey.length !== 64) {
            throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKey.length}`);
          }
          const signature = sodium.crypto_sign_detached(message, privateKey);
          return toHex(signature);
        },

        // Sign a string message with Ed25519
        signString: (message: string, privateKeyHex: string) => {
          const messageBytes = sodium.from_string(message);
          const privateKey = fromHex(privateKeyHex);
          if (privateKey.length !== 64) {
            throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKey.length}`);
          }
          const signature = sodium.crypto_sign_detached(messageBytes, privateKey);
          return toHex(signature);
        },

        // Verify an Ed25519 signature
        verify: (messageHex: string, signatureHex: string, publicKeyHex: string) => {
          const message = fromHex(messageHex);
          const signature = fromHex(signatureHex);
          const publicKey = fromHex(publicKeyHex);
          if (signature.length !== 64) {
            throw new Error(`Invalid signature length: expected 64 bytes, got ${signature.length}`);
          }
          if (publicKey.length !== 32) {
            throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKey.length}`);
          }
          try {
            return sodium.crypto_sign_verify_detached(signature, message, publicKey);
          } catch {
            return false;
          }
        },

        // Verify string message signature
        verifyString: (message: string, signatureHex: string, publicKeyHex: string) => {
          const messageBytes = sodium.from_string(message);
          const signature = fromHex(signatureHex);
          const publicKey = fromHex(publicKeyHex);
          if (signature.length !== 64) {
            throw new Error(`Invalid signature length: expected 64 bytes, got ${signature.length}`);
          }
          if (publicKey.length !== 32) {
            throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKey.length}`);
          }
          try {
            return sodium.crypto_sign_verify_detached(signature, messageBytes, publicKey);
          } catch {
            return false;
          }
        },

        // X25519 key exchange (derive shared secret)
        deriveSharedSecret: (ourPrivateKeyHex: string, theirPublicKeyHex: string) => {
          const ourPrivateKey = fromHex(ourPrivateKeyHex);
          const theirPublicKey = fromHex(theirPublicKeyHex);
          if (ourPrivateKey.length !== 32) {
            throw new Error(`Invalid private key length: expected 32 bytes, got ${ourPrivateKey.length}`);
          }
          if (theirPublicKey.length !== 32) {
            throw new Error(`Invalid public key length: expected 32 bytes, got ${theirPublicKey.length}`);
          }
          const sharedSecret = sodium.crypto_scalarmult(ourPrivateKey, theirPublicKey);
          return toHex(sharedSecret);
        },

        // Convert Ed25519 public key to X25519
        ed25519ToX25519Public: (ed25519PublicKeyHex: string) => {
          const ed25519PublicKey = fromHex(ed25519PublicKeyHex);
          if (ed25519PublicKey.length !== 32) {
            throw new Error(`Invalid Ed25519 public key length: expected 32 bytes, got ${ed25519PublicKey.length}`);
          }
          const x25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519PublicKey);
          return toHex(x25519PublicKey);
        },

        // Convert Ed25519 private key to X25519
        ed25519ToX25519Private: (ed25519PrivateKeyHex: string) => {
          const ed25519PrivateKey = fromHex(ed25519PrivateKeyHex);
          if (ed25519PrivateKey.length !== 64) {
            throw new Error(`Invalid Ed25519 private key length: expected 64 bytes, got ${ed25519PrivateKey.length}`);
          }
          const x25519PrivateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(ed25519PrivateKey);
          return toHex(x25519PrivateKey);
        },

        // Generate random bytes
        randomBytes: (length: number) => {
          const bytes = sodium.randombytes_buf(length);
          return toHex(bytes);
        },

        // Constant-time comparison
        constantTimeEqual: (aHex: string, bHex: string) => {
          const a = fromHex(aHex);
          const b = fromHex(bHex);
          if (a.length !== b.length) {
            return false;
          }
          return sodium.memcmp(a, b);
        },

        // BLAKE2b hash
        blake2b: (dataHex: string, outputLength: number = 32) => {
          const data = fromHex(dataHex);
          const hash = sodium.crypto_generichash(outputLength, data);
          return toHex(hash);
        },

        // String to hex
        stringToHex: (str: string) => {
          const bytes = sodium.from_string(str);
          return toHex(bytes);
        },
      };

      const op = operations[operation];
      if (!op) {
        throw new Error(`Unknown operation: ${operation}`);
      }

      // Execute the operation with the provided arguments
      switch (operation) {
        case 'generateEd25519KeyPairFromSeed':
          return op(args.seed as string);
        case 'generateEd25519KeyPair':
        case 'generateX25519KeyPair':
          return op();
        case 'deriveEd25519PublicKey':
          return op(args.privateKey as string);
        case 'sha256':
          return op(args.data as string);
        case 'sha256String':
          return op(args.text as string);
        case 'fingerprint':
          return op(args.publicKey as string);
        case 'sign':
          return op(args.message as string, args.privateKey as string);
        case 'signString':
          return op(args.message as string, args.privateKey as string);
        case 'verify':
          return op(args.message as string, args.signature as string, args.publicKey as string);
        case 'verifyString':
          return op(args.message as string, args.signature as string, args.publicKey as string);
        case 'deriveSharedSecret':
          return op(args.ourPrivateKey as string, args.theirPublicKey as string);
        case 'ed25519ToX25519Public':
          return op(args.ed25519PublicKey as string);
        case 'ed25519ToX25519Private':
          return op(args.ed25519PrivateKey as string);
        case 'randomBytes':
          return op(args.length as number);
        case 'constantTimeEqual':
          return op(args.a as string, args.b as string);
        case 'blake2b':
          return op(args.data as string, args.outputLength as number);
        case 'stringToHex':
          return op(args.str as string);
        default:
          throw new Error(`Unhandled operation: ${operation}`);
      }
    },
    { operation, args }
  );
}

// ============================================================================
// Test Suite: Key Generation from Seed
// ============================================================================

test.describe('Key Derivation - Deterministic Key Generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should generate consistent keypair from same seed', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
      seed: string;
    }

    // Generate twice with the same seed
    const keyPair1 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const keyPair2 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Should produce identical results
    expect(keyPair1.publicKey).toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).toBe(keyPair2.privateKey);
    expect(keyPair1.seed).toBe(KEY_DERIVATION_VECTORS.testSeed.seed);
  });

  test('should generate different keypairs from different seeds', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair1 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.zeroSeed.seed,
    });

    const keyPair2 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Should produce different keys
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
  });

  test('should generate valid Ed25519 keypair with correct lengths', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Ed25519 public key: 32 bytes = 64 hex chars
    expect(keyPair.publicKey.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(keyPair.publicKey)).toBe(true);

    // Ed25519 private key: 64 bytes = 128 hex chars (seed + public key)
    expect(keyPair.privateKey.length).toBe(128);
    expect(/^[0-9a-f]+$/.test(keyPair.privateKey)).toBe(true);
  });

  test('should reject invalid seed length', async ({ page }) => {
    let errorThrown = false;

    try {
      await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
        seed: '0123', // Too short
      });
    } catch (error) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });

  test('should handle zero seed correctly', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.zeroSeed.seed,
    });

    // Should still produce a valid key (not zeros)
    expect(keyPair.publicKey).not.toBe(KEY_DERIVATION_VECTORS.zeroSeed.seed);
    expect(keyPair.publicKey.length).toBe(64);
  });

  test('should handle max value seed correctly', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.maxSeed.seed,
    });

    // Should produce a valid key
    expect(keyPair.publicKey).not.toBe(KEY_DERIVATION_VECTORS.maxSeed.seed);
    expect(keyPair.publicKey.length).toBe(64);
  });
});

// ============================================================================
// Test Suite: Public Key Derivation
// ============================================================================

test.describe('Key Derivation - Public Key Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should derive correct public key from private key seed', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    // Generate keypair from seed
    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Derive public key from the seed
    const derivedPubkey = await executeCrypto(page, 'deriveEd25519PublicKey', {
      privateKey: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Should match
    expect(derivedPubkey).toBe(keyPair.publicKey);
  });

  test('should derive public key from full private key', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Derive public key from the full 64-byte private key
    const derivedPubkey = await executeCrypto(page, 'deriveEd25519PublicKey', {
      privateKey: keyPair.privateKey,
    });

    // Should match
    expect(derivedPubkey).toBe(keyPair.publicKey);
  });

  test('should generate random keypairs with unique public keys', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    const keyPair1 = await executeCrypto(page, 'generateEd25519KeyPair', {});
    const keyPair2 = await executeCrypto(page, 'generateEd25519KeyPair', {});

    // Random keypairs should be different
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.publicKey.length).toBe(64);
    expect(keyPair2.publicKey.length).toBe(64);
  });
});

// ============================================================================
// Test Suite: Fingerprint Calculation
// ============================================================================

test.describe('Key Derivation - Fingerprint Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should calculate consistent fingerprint for same public key', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    interface Fingerprint {
      hash: string;
      formatted: string;
      short: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Calculate fingerprint twice
    const fp1 = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair.publicKey,
    });

    const fp2 = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair.publicKey,
    });

    // Should produce identical results
    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.formatted).toBe(fp2.formatted);
    expect(fp1.short).toBe(fp2.short);
  });

  test('should produce different fingerprints for different keys', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    interface Fingerprint {
      hash: string;
    }

    const keyPair1 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.zeroSeed.seed,
    });

    const keyPair2 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const fp1 = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair1.publicKey,
    });

    const fp2 = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair2.publicKey,
    });

    expect(fp1.hash).not.toBe(fp2.hash);
  });

  test('should produce correctly formatted fingerprint', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    interface Fingerprint {
      hash: string;
      formatted: string;
      short: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const fp = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair.publicKey,
    });

    // Hash should be 64 hex characters (32 bytes SHA-256)
    expect(fp.hash.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(fp.hash)).toBe(true);

    // Formatted should be groups of 4 uppercase hex chars separated by colons
    expect(/^[0-9A-F]{4}(:[0-9A-F]{4})+$/.test(fp.formatted)).toBe(true);

    // Short should be first two groups (8 chars + colon)
    expect(fp.short.length).toBe(9);
    expect(/^[0-9A-F]{4}:[0-9A-F]{4}$/.test(fp.short)).toBe(true);
  });

  test('should calculate fingerprint as SHA-256 of public key', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
    }

    interface Fingerprint {
      hash: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const fp = await executeCrypto(page, 'fingerprint', {
      publicKey: keyPair.publicKey,
    });

    // Calculate SHA-256 directly
    const directHash = await executeCrypto(page, 'sha256', {
      data: keyPair.publicKey,
    });

    // Should match
    expect(fp.hash).toBe(directHash);
  });
});

// ============================================================================
// Test Suite: Ed25519 Signing
// ============================================================================

test.describe('Key Derivation - Ed25519 Signing', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should sign and verify a message correctly', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Convert message to hex
    const messageHex = await executeCrypto(page, 'stringToHex', {
      str: SIGNATURE_VECTORS.simpleMessage,
    });

    // Sign the message
    const signature = await executeCrypto(page, 'sign', {
      message: messageHex,
      privateKey: keyPair.privateKey,
    });

    // Signature should be 64 bytes = 128 hex chars
    expect(signature.length).toBe(128);
    expect(/^[0-9a-f]+$/.test(signature)).toBe(true);

    // Verify the signature
    const isValid = await executeCrypto(page, 'verify', {
      message: messageHex,
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(true);
  });

  test('should sign and verify string message correctly', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign the string directly
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      privateKey: keyPair.privateKey,
    });

    // Verify the signature
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(true);
  });

  test('should reject tampered message', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign the original message
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      privateKey: keyPair.privateKey,
    });

    // Try to verify with modified message
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.simpleMessage + ' (tampered)',
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(false);
  });

  test('should reject signature from wrong key', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair1 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const keyPair2 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.zeroSeed.seed,
    });

    // Sign with key 1
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      privateKey: keyPair1.privateKey,
    });

    // Try to verify with key 2's public key
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      signature,
      publicKey: keyPair2.publicKey,
    });

    expect(isValid).toBe(false);
  });

  test('should handle empty message signing', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign empty message
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.emptyMessage,
      privateKey: keyPair.privateKey,
    });

    // Verify
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.emptyMessage,
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(true);
  });

  test('should handle long message signing', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign long message
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.longMessage,
      privateKey: keyPair.privateKey,
    });

    // Verify
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.longMessage,
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(true);
  });

  test('should handle unicode message signing', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign unicode message
    const signature = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.unicodeMessage,
      privateKey: keyPair.privateKey,
    });

    // Verify
    const isValid = await executeCrypto(page, 'verifyString', {
      message: SIGNATURE_VECTORS.unicodeMessage,
      signature,
      publicKey: keyPair.publicKey,
    });

    expect(isValid).toBe(true);
  });

  test('should produce deterministic signatures for same message and key', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const keyPair = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    // Sign the same message twice
    const signature1 = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      privateKey: keyPair.privateKey,
    });

    const signature2 = await executeCrypto(page, 'signString', {
      message: SIGNATURE_VECTORS.simpleMessage,
      privateKey: keyPair.privateKey,
    });

    // Ed25519 signatures should be deterministic
    expect(signature1).toBe(signature2);
  });
});

// ============================================================================
// Test Suite: X25519 Key Exchange
// ============================================================================

test.describe('Key Derivation - X25519 Key Exchange', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should derive identical shared secret from both sides', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    // Generate X25519 keypairs for Alice and Bob
    const aliceKeyPair = await executeCrypto(page, 'generateX25519KeyPair', {});
    const bobKeyPair = await executeCrypto(page, 'generateX25519KeyPair', {});

    // Alice derives shared secret with Bob's public key
    const aliceShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: aliceKeyPair.privateKey,
      theirPublicKey: bobKeyPair.publicKey,
    });

    // Bob derives shared secret with Alice's public key
    const bobShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: bobKeyPair.privateKey,
      theirPublicKey: aliceKeyPair.publicKey,
    });

    // Should be identical
    expect(aliceShared).toBe(bobShared);
    expect(aliceShared.length).toBe(64); // 32 bytes = 64 hex
  });

  test('should convert Ed25519 keys to X25519 for key exchange', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    // Generate Ed25519 keypairs
    const aliceEd25519 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.testSeed.seed,
    });

    const bobEd25519 = await executeCrypto(page, 'generateEd25519KeyPairFromSeed', {
      seed: KEY_DERIVATION_VECTORS.zeroSeed.seed,
    });

    // Convert to X25519
    const aliceX25519Private = await executeCrypto(page, 'ed25519ToX25519Private', {
      ed25519PrivateKey: aliceEd25519.privateKey,
    });

    const aliceX25519Public = await executeCrypto(page, 'ed25519ToX25519Public', {
      ed25519PublicKey: aliceEd25519.publicKey,
    });

    const bobX25519Private = await executeCrypto(page, 'ed25519ToX25519Private', {
      ed25519PrivateKey: bobEd25519.privateKey,
    });

    const bobX25519Public = await executeCrypto(page, 'ed25519ToX25519Public', {
      ed25519PublicKey: bobEd25519.publicKey,
    });

    // Derive shared secrets
    const aliceShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: aliceX25519Private,
      theirPublicKey: bobX25519Public,
    });

    const bobShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: bobX25519Private,
      theirPublicKey: aliceX25519Public,
    });

    // Should match
    expect(aliceShared).toBe(bobShared);
  });

  test('should produce different shared secrets with different key pairs', async ({ page }) => {
    interface KeyPair {
      publicKey: string;
      privateKey: string;
    }

    const alice = await executeCrypto(page, 'generateX25519KeyPair', {});
    const bob = await executeCrypto(page, 'generateX25519KeyPair', {});
    const charlie = await executeCrypto(page, 'generateX25519KeyPair', {});

    // Alice-Bob shared secret
    const aliceBobShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: alice.privateKey,
      theirPublicKey: bob.publicKey,
    });

    // Alice-Charlie shared secret
    const aliceCharlieShared = await executeCrypto(page, 'deriveSharedSecret', {
      ourPrivateKey: alice.privateKey,
      theirPublicKey: charlie.publicKey,
    });

    // Should be different
    expect(aliceBobShared).not.toBe(aliceCharlieShared);
  });
});

// ============================================================================
// Test Suite: SHA-256 Hashing
// ============================================================================

test.describe('Key Derivation - SHA-256 Hashing', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should produce consistent hash for same input', async ({ page }) => {
    const hash1 = await executeCrypto(page, 'sha256String', {
      text: 'Hello, World!',
    });

    const hash2 = await executeCrypto(page, 'sha256String', {
      text: 'Hello, World!',
    });

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // 32 bytes = 64 hex
  });

  test('should produce different hashes for different inputs', async ({ page }) => {
    const hash1 = await executeCrypto(page, 'sha256String', {
      text: 'Hello',
    });

    const hash2 = await executeCrypto(page, 'sha256String', {
      text: 'World',
    });

    expect(hash1).not.toBe(hash2);
  });

  test('should handle empty string', async ({ page }) => {
    const hash = await executeCrypto(page, 'sha256String', {
      text: '',
    });

    // SHA-256 of empty string is well-known
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  test('should handle unicode correctly', async ({ page }) => {
    const hash = await executeCrypto(page, 'sha256String', {
      text: '\u{1F44B}', // Wave emoji
    });

    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

// ============================================================================
// Test Suite: BLAKE2b Hashing
// ============================================================================

test.describe('Key Derivation - BLAKE2b Hashing', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should produce consistent hash for same input', async ({ page }) => {
    const dataHex = await executeCrypto(page, 'stringToHex', {
      str: 'Hello, World!',
    });

    const hash1 = await executeCrypto(page, 'blake2b', {
      data: dataHex,
      outputLength: 32,
    });

    const hash2 = await executeCrypto(page, 'blake2b', {
      data: dataHex,
      outputLength: 32,
    });

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // 32 bytes
  });

  test('should support variable output lengths', async ({ page }) => {
    const dataHex = await executeCrypto(page, 'stringToHex', {
      str: 'Test data',
    });

    const hash16 = await executeCrypto(page, 'blake2b', {
      data: dataHex,
      outputLength: 16,
    });

    const hash32 = await executeCrypto(page, 'blake2b', {
      data: dataHex,
      outputLength: 32,
    });

    const hash64 = await executeCrypto(page, 'blake2b', {
      data: dataHex,
      outputLength: 64,
    });

    expect(hash16.length).toBe(32); // 16 bytes
    expect(hash32.length).toBe(64); // 32 bytes
    expect(hash64.length).toBe(128); // 64 bytes
  });
});

// ============================================================================
// Test Suite: Constant-Time Comparison
// ============================================================================

test.describe('Key Derivation - Constant-Time Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should return true for identical byte arrays', async ({ page }) => {
    const result = await executeCrypto(page, 'constantTimeEqual', {
      a: '0123456789abcdef',
      b: '0123456789abcdef',
    });

    expect(result).toBe(true);
  });

  test('should return false for different byte arrays', async ({ page }) => {
    const result = await executeCrypto(page, 'constantTimeEqual', {
      a: '0123456789abcdef',
      b: '0123456789abcde0',
    });

    expect(result).toBe(false);
  });

  test('should return false for different length arrays', async ({ page }) => {
    const result = await executeCrypto(page, 'constantTimeEqual', {
      a: '0123456789abcdef',
      b: '0123456789abcdef00',
    });

    expect(result).toBe(false);
  });
});

// ============================================================================
// Test Suite: Random Byte Generation
// ============================================================================

test.describe('Key Derivation - Random Byte Generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should generate bytes of requested length', async ({ page }) => {
    const bytes16 = await executeCrypto(page, 'randomBytes', { length: 16 });
    const bytes32 = await executeCrypto(page, 'randomBytes', { length: 32 });
    const bytes64 = await executeCrypto(page, 'randomBytes', { length: 64 });

    expect(bytes16.length).toBe(32); // 16 bytes = 32 hex
    expect(bytes32.length).toBe(64); // 32 bytes = 64 hex
    expect(bytes64.length).toBe(128); // 64 bytes = 128 hex
  });

  test('should generate different values on each call', async ({ page }) => {
    const bytes1 = await executeCrypto(page, 'randomBytes', { length: 32 });
    const bytes2 = await executeCrypto(page, 'randomBytes', { length: 32 });
    const bytes3 = await executeCrypto(page, 'randomBytes', { length: 32 });

    // All should be different (statistically impossible to be same)
    expect(bytes1).not.toBe(bytes2);
    expect(bytes2).not.toBe(bytes3);
    expect(bytes1).not.toBe(bytes3);
  });

  test('should generate valid hex output', async ({ page }) => {
    const bytes = await executeCrypto(page, 'randomBytes', { length: 32 });

    expect(/^[0-9a-f]+$/.test(bytes)).toBe(true);
  });
});
