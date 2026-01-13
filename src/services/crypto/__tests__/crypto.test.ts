/**
 * Crypto Service Tests
 *
 * Tests for key generation, encryption/decryption, signing/verification,
 * and hashing functionality using libsodium.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  CryptoService,
  loadSodium,
  isSodiumReady,
  generateX25519KeyPair,
  generateEd25519KeyPair,
  generateEd25519KeyPairFromSeed,
  publicKeyToHex,
  hexToPublicKey,
  bytesToHex,
  hexToBytes,
  deriveSharedSecret,
  ed25519PublicKeyToX25519,
  ed25519PrivateKeyToX25519,
  constantTimeEqual,
  secureWipe,
  encryptChaCha20Poly1305,
  decryptChaCha20Poly1305,
  generateNonce,
  generateKey,
  encryptCombined,
  decryptCombined,
  encryptString,
  decryptString,
  sign,
  verify,
  signString,
  verifyString,
  signToHex,
  verifyHex,
  signCombined,
  openSigned,
  sha256,
  sha256String,
  sha256Hex,
  sha256StringHex,
  fingerprint,
  shortFingerprint,
  blake2b,
  blake2bKeyed,
  generateRandomId,
  generateRandomIdHex,
  CryptoConstants,
} from '../index';

describe('Crypto Service', () => {
  // Initialize sodium before all tests
  beforeAll(async () => {
    await loadSodium();
  });

  describe('Initialization', () => {
    it('should load sodium successfully', async () => {
      await loadSodium();
      expect(isSodiumReady()).toBe(true);
    });

    it('should return same promise on multiple loadSodium calls', async () => {
      const promise1 = loadSodium();
      const promise2 = loadSodium();
      await Promise.all([promise1, promise2]);
      expect(isSodiumReady()).toBe(true);
    });
  });

  describe('CryptoService Singleton', () => {
    let cryptoService: CryptoService;

    beforeEach(() => {
      CryptoService._resetForTesting();
      cryptoService = CryptoService.getInstance();
    });

    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = CryptoService.getInstance();
      const instance2 = CryptoService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully', async () => {
      await cryptoService.initialize();
      expect(cryptoService.isReady()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await cryptoService.initialize();
      await cryptoService.initialize();
      expect(cryptoService.isReady()).toBe(true);
    });

    it('should generate key pairs after initialization', async () => {
      await cryptoService.initialize();
      const keyPair = cryptoService.generateEd25519KeyPair();
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
    });
  });

  describe('Key Generation', () => {
    describe('X25519 Key Pairs', () => {
      it('should generate X25519 key pair with correct sizes', () => {
        const keyPair = generateX25519KeyPair();
        expect(keyPair.publicKey.length).toBe(CryptoConstants.X25519_PUBLIC_KEY_BYTES);
        expect(keyPair.privateKey.length).toBe(CryptoConstants.X25519_PRIVATE_KEY_BYTES);
      });

      it('should generate unique key pairs', () => {
        const keyPair1 = generateX25519KeyPair();
        const keyPair2 = generateX25519KeyPair();
        expect(bytesToHex(keyPair1.publicKey)).not.toBe(bytesToHex(keyPair2.publicKey));
        expect(bytesToHex(keyPair1.privateKey)).not.toBe(bytesToHex(keyPair2.privateKey));
      });
    });

    describe('Ed25519 Key Pairs', () => {
      it('should generate Ed25519 key pair with correct sizes', () => {
        const keyPair = generateEd25519KeyPair();
        expect(keyPair.publicKey.length).toBe(CryptoConstants.ED25519_PUBLIC_KEY_BYTES);
        expect(keyPair.privateKey.length).toBe(CryptoConstants.ED25519_PRIVATE_KEY_BYTES);
      });

      it('should generate unique key pairs', () => {
        const keyPair1 = generateEd25519KeyPair();
        const keyPair2 = generateEd25519KeyPair();
        expect(bytesToHex(keyPair1.publicKey)).not.toBe(bytesToHex(keyPair2.publicKey));
      });

      it('should generate Ed25519 key pair from seed', () => {
        const seed = generateRandomId(32);
        const keyPair = generateEd25519KeyPairFromSeed(seed);
        expect(keyPair.publicKey.length).toBe(CryptoConstants.ED25519_PUBLIC_KEY_BYTES);
        expect(keyPair.privateKey.length).toBe(CryptoConstants.ED25519_PRIVATE_KEY_BYTES);
      });

      it('should generate same key pair from same seed', () => {
        const seed = generateRandomId(32);
        const keyPair1 = generateEd25519KeyPairFromSeed(seed);
        const keyPair2 = generateEd25519KeyPairFromSeed(seed);
        expect(bytesToHex(keyPair1.publicKey)).toBe(bytesToHex(keyPair2.publicKey));
      });

      it('should throw error for invalid seed length', () => {
        const invalidSeed = new Uint8Array(16);
        expect(() => generateEd25519KeyPairFromSeed(invalidSeed)).toThrow();
      });
    });
  });

  describe('Key Conversion', () => {
    it('should convert public key to hex and back', () => {
      const keyPair = generateEd25519KeyPair();
      const hex = publicKeyToHex(keyPair.publicKey);
      const restored = hexToPublicKey(hex);
      expect(bytesToHex(restored)).toBe(hex);
    });

    it('should convert bytes to hex and back', () => {
      const original = new Uint8Array([0, 127, 255, 128, 1]);
      const hex = bytesToHex(original);
      const restored = hexToBytes(hex);
      expect(constantTimeEqual(original, restored)).toBe(true);
    });

    it('should throw error for invalid hex string', () => {
      expect(() => hexToPublicKey('invalid')).toThrow();
      expect(() => hexToPublicKey('abc')).toThrow(); // Odd length
      expect(() => hexToBytes('ghij')).toThrow(); // Non-hex chars
    });

    it('should convert Ed25519 public key to X25519', () => {
      const ed25519KeyPair = generateEd25519KeyPair();
      const x25519PublicKey = ed25519PublicKeyToX25519(ed25519KeyPair.publicKey);
      expect(x25519PublicKey.length).toBe(CryptoConstants.X25519_PUBLIC_KEY_BYTES);
    });

    it('should convert Ed25519 private key to X25519', () => {
      const ed25519KeyPair = generateEd25519KeyPair();
      const x25519PrivateKey = ed25519PrivateKeyToX25519(ed25519KeyPair.privateKey);
      expect(x25519PrivateKey.length).toBe(CryptoConstants.X25519_PRIVATE_KEY_BYTES);
    });

    it('should throw error for invalid key lengths in conversion', () => {
      const invalidKey = new Uint8Array(16);
      expect(() => ed25519PublicKeyToX25519(invalidKey)).toThrow();
      expect(() => ed25519PrivateKeyToX25519(invalidKey)).toThrow();
    });
  });

  describe('Key Exchange (ECDH)', () => {
    it('should derive same shared secret from both sides', () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();

      const sharedAlice = deriveSharedSecret(alice.privateKey, bob.publicKey);
      const sharedBob = deriveSharedSecret(bob.privateKey, alice.publicKey);

      expect(constantTimeEqual(sharedAlice, sharedBob)).toBe(true);
    });

    it('should derive shared secret with correct length', () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();

      const shared = deriveSharedSecret(alice.privateKey, bob.publicKey);
      expect(shared.length).toBe(CryptoConstants.SHARED_SECRET_BYTES);
    });

    it('should throw error for invalid key lengths', () => {
      const validKey = generateX25519KeyPair();
      const invalidKey = new Uint8Array(16);

      expect(() => deriveSharedSecret(invalidKey, validKey.publicKey)).toThrow();
      expect(() => deriveSharedSecret(validKey.privateKey, invalidKey)).toThrow();
    });
  });

  describe('Encryption (ChaCha20-Poly1305)', () => {
    describe('Basic Encryption/Decryption', () => {
      it('should encrypt and decrypt data correctly', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();

        const encrypted = encryptChaCha20Poly1305(plaintext, key);
        const decrypted = decryptChaCha20Poly1305(encrypted.ciphertext, key, encrypted.nonce);

        expect(constantTimeEqual(decrypted, plaintext)).toBe(true);
      });

      it('should produce different ciphertexts for same plaintext', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();

        const encrypted1 = encryptChaCha20Poly1305(plaintext, key);
        const encrypted2 = encryptChaCha20Poly1305(plaintext, key);

        expect(bytesToHex(encrypted1.ciphertext)).not.toBe(bytesToHex(encrypted2.ciphertext));
      });

      it('should use provided nonce when specified', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();
        const nonce = generateNonce();

        const encrypted = encryptChaCha20Poly1305(plaintext, key, nonce);
        expect(constantTimeEqual(encrypted.nonce, nonce)).toBe(true);
      });

      it('should fail decryption with wrong key', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key1 = generateKey();
        const key2 = generateKey();

        const encrypted = encryptChaCha20Poly1305(plaintext, key1);
        expect(() => decryptChaCha20Poly1305(encrypted.ciphertext, key2, encrypted.nonce)).toThrow();
      });

      it('should fail decryption with modified ciphertext', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();

        const encrypted = encryptChaCha20Poly1305(plaintext, key);
        encrypted.ciphertext[0] ^= 0xff; // Flip bits

        expect(() => decryptChaCha20Poly1305(encrypted.ciphertext, key, encrypted.nonce)).toThrow();
      });
    });

    describe('Combined Format', () => {
      it('should encrypt and decrypt with combined format', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();

        const combined = encryptCombined(plaintext, key);
        const decrypted = decryptCombined(combined, key);

        expect(constantTimeEqual(decrypted, plaintext)).toBe(true);
      });

      it('should have correct combined length', () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateKey();

        const combined = encryptCombined(plaintext, key);
        // Combined = nonce (24) + ciphertext (plaintext + 16 byte tag)
        expect(combined.length).toBe(CryptoConstants.XCHACHA20_NONCE_BYTES + plaintext.length + CryptoConstants.POLY1305_TAG_BYTES);
      });

      it('should throw error for too short combined data', () => {
        const key = generateKey();
        const shortData = new Uint8Array(10);
        expect(() => decryptCombined(shortData, key)).toThrow();
      });
    });

    describe('String Encryption', () => {
      it('should encrypt and decrypt strings correctly', () => {
        const plaintext = 'Hello, World! This is a test message.';
        const key = generateKey();

        const encrypted = encryptString(plaintext, key);
        expect(typeof encrypted).toBe('string');

        const decrypted = decryptString(encrypted, key);
        expect(decrypted).toBe(plaintext);
      });

      it('should handle empty strings', () => {
        const plaintext = '';
        const key = generateKey();

        const encrypted = encryptString(plaintext, key);
        const decrypted = decryptString(encrypted, key);
        expect(decrypted).toBe(plaintext);
      });

      it('should handle unicode strings', () => {
        const plaintext = 'Hello world! This is a test with unicode.';
        const key = generateKey();

        const encrypted = encryptString(plaintext, key);
        const decrypted = decryptString(encrypted, key);
        expect(decrypted).toBe(plaintext);
      });
    });

    describe('Key and Nonce Generation', () => {
      it('should generate key with correct length', () => {
        const key = generateKey();
        expect(key.length).toBe(CryptoConstants.CHACHA20_KEY_BYTES);
      });

      it('should generate nonce with correct length', () => {
        const nonce = generateNonce();
        expect(nonce.length).toBe(CryptoConstants.XCHACHA20_NONCE_BYTES);
      });

      it('should generate unique keys', () => {
        const key1 = generateKey();
        const key2 = generateKey();
        expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
      });

      it('should generate unique nonces', () => {
        const nonce1 = generateNonce();
        const nonce2 = generateNonce();
        expect(bytesToHex(nonce1)).not.toBe(bytesToHex(nonce2));
      });
    });

    describe('Error Cases', () => {
      it('should throw error for invalid key length', () => {
        const plaintext = new Uint8Array([1, 2, 3]);
        const invalidKey = new Uint8Array(16);

        expect(() => encryptChaCha20Poly1305(plaintext, invalidKey)).toThrow();
      });

      it('should throw error for invalid nonce length', () => {
        const plaintext = new Uint8Array([1, 2, 3]);
        const key = generateKey();
        const invalidNonce = new Uint8Array(16);

        expect(() => encryptChaCha20Poly1305(plaintext, key, invalidNonce)).toThrow();
      });

      it('should throw error for too short ciphertext', () => {
        const key = generateKey();
        const nonce = generateNonce();
        const shortCiphertext = new Uint8Array(10);

        expect(() => decryptChaCha20Poly1305(shortCiphertext, key, nonce)).toThrow();
      });
    });
  });

  describe('Digital Signatures (Ed25519)', () => {
    describe('Basic Signing/Verification', () => {
      it('should sign and verify message correctly', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sig = sign(message, keyPair.privateKey);
        expect(sig.signature.length).toBe(CryptoConstants.ED25519_SIGNATURE_BYTES);

        const isValid = verify(message, sig.signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it('should fail verification with wrong public key', () => {
        const keyPair1 = generateEd25519KeyPair();
        const keyPair2 = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sig = sign(message, keyPair1.privateKey);
        const isValid = verify(message, sig.signature, keyPair2.publicKey);
        expect(isValid).toBe(false);
      });

      it('should fail verification with modified message', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sig = sign(message, keyPair.privateKey);

        const modifiedMessage = new Uint8Array([1, 2, 3, 4, 6]);
        const isValid = verify(modifiedMessage, sig.signature, keyPair.publicKey);
        expect(isValid).toBe(false);
      });

      it('should fail verification with modified signature', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sig = sign(message, keyPair.privateKey);
        sig.signature[0] ^= 0xff;

        const isValid = verify(message, sig.signature, keyPair.publicKey);
        expect(isValid).toBe(false);
      });
    });

    describe('String Signing', () => {
      it('should sign and verify strings correctly', () => {
        const keyPair = generateEd25519KeyPair();
        const message = 'Hello, World!';

        const sig = signString(message, keyPair.privateKey);
        const isValid = verifyString(message, sig.signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });
    });

    describe('Hex Signatures', () => {
      it('should sign and return hex', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sigHex = signToHex(message, keyPair.privateKey);
        expect(typeof sigHex).toBe('string');
        expect(sigHex.length).toBe(CryptoConstants.ED25519_SIGNATURE_BYTES * 2);
      });

      it('should verify hex signature', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const sigHex = signToHex(message, keyPair.privateKey);
        const isValid = verifyHex(message, sigHex, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it('should throw error for invalid hex signature', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        expect(() => verifyHex(message, 'invalid', keyPair.publicKey)).toThrow();
        expect(() => verifyHex(message, 'abc', keyPair.publicKey)).toThrow();
      });
    });

    describe('Combined Signing', () => {
      it('should sign combined and open correctly', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const signed = signCombined(message, keyPair.privateKey);
        expect(signed.length).toBe(CryptoConstants.ED25519_SIGNATURE_BYTES + message.length);

        const opened = openSigned(signed, keyPair.publicKey);
        expect(constantTimeEqual(opened, message)).toBe(true);
      });

      it('should throw error when opening with wrong key', () => {
        const keyPair1 = generateEd25519KeyPair();
        const keyPair2 = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3, 4, 5]);

        const signed = signCombined(message, keyPair1.privateKey);
        expect(() => openSigned(signed, keyPair2.publicKey)).toThrow();
      });
    });

    describe('Error Cases', () => {
      it('should throw error for invalid private key length', () => {
        const message = new Uint8Array([1, 2, 3]);
        const invalidKey = new Uint8Array(32);

        expect(() => sign(message, invalidKey)).toThrow();
      });

      it('should throw error for invalid public key length', () => {
        const message = new Uint8Array([1, 2, 3]);
        const signature = new Uint8Array(64);
        const invalidKey = new Uint8Array(16);

        expect(() => verify(message, signature, invalidKey)).toThrow();
      });

      it('should throw error for invalid signature length', () => {
        const keyPair = generateEd25519KeyPair();
        const message = new Uint8Array([1, 2, 3]);
        const invalidSignature = new Uint8Array(32);

        expect(() => verify(message, invalidSignature, keyPair.publicKey)).toThrow();
      });
    });
  });

  describe('Hashing', () => {
    describe('SHA-256', () => {
      it('should hash data with correct output length', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash = sha256(data);
        expect(hash.length).toBe(CryptoConstants.SHA256_BYTES);
      });

      it('should produce deterministic hashes', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash1 = sha256(data);
        const hash2 = sha256(data);
        expect(constantTimeEqual(hash1, hash2)).toBe(true);
      });

      it('should produce different hashes for different data', () => {
        const data1 = new Uint8Array([1, 2, 3]);
        const data2 = new Uint8Array([1, 2, 4]);
        const hash1 = sha256(data1);
        const hash2 = sha256(data2);
        expect(constantTimeEqual(hash1, hash2)).toBe(false);
      });

      it('should hash strings correctly', () => {
        const str = 'Hello, World!';
        const hash = sha256String(str);
        expect(hash.length).toBe(CryptoConstants.SHA256_BYTES);
      });

      it('should return hex string for sha256Hex', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hex = sha256Hex(data);
        expect(typeof hex).toBe('string');
        expect(hex.length).toBe(CryptoConstants.SHA256_BYTES * 2);
      });

      it('should return hex string for sha256StringHex', () => {
        const str = 'Hello, World!';
        const hex = sha256StringHex(str);
        expect(typeof hex).toBe('string');
        expect(hex.length).toBe(CryptoConstants.SHA256_BYTES * 2);
      });
    });

    describe('BLAKE2b', () => {
      it('should hash data with default output length', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash = blake2b(data);
        expect(hash.length).toBe(32); // Default is 32 bytes
      });

      it('should hash data with custom output length', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash16 = blake2b(data, 16);
        const hash64 = blake2b(data, 64);
        expect(hash16.length).toBe(16);
        expect(hash64.length).toBe(64);
      });

      it('should produce deterministic hashes', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash1 = blake2b(data);
        const hash2 = blake2b(data);
        expect(constantTimeEqual(hash1, hash2)).toBe(true);
      });

      it('should produce keyed hash', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const key = generateRandomId(32);
        const hash = blake2bKeyed(data, key);
        expect(hash.length).toBe(32);
      });

      it('should produce different hashes with different keys', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const key1 = generateRandomId(32);
        const key2 = generateRandomId(32);
        const hash1 = blake2bKeyed(data, key1);
        const hash2 = blake2bKeyed(data, key2);
        expect(constantTimeEqual(hash1, hash2)).toBe(false);
      });
    });

    describe('Fingerprints', () => {
      it('should generate fingerprint from public key', () => {
        const keyPair = generateEd25519KeyPair();
        const fp = fingerprint(keyPair.publicKey);

        expect(fp.hash.length).toBe(CryptoConstants.SHA256_BYTES);
        expect(typeof fp.formatted).toBe('string');
        expect(typeof fp.short).toBe('string');
      });

      it('should generate deterministic fingerprints', () => {
        const keyPair = generateEd25519KeyPair();
        const fp1 = fingerprint(keyPair.publicKey);
        const fp2 = fingerprint(keyPair.publicKey);

        expect(fp1.formatted).toBe(fp2.formatted);
        expect(fp1.short).toBe(fp2.short);
      });

      it('should generate short fingerprint', () => {
        const keyPair = generateEd25519KeyPair();
        const short = shortFingerprint(keyPair.publicKey);

        expect(typeof short).toBe('string');
        expect(short.length).toBe(8);
      });
    });
  });

  describe('Random Generation', () => {
    it('should generate random ID with default length', () => {
      const id = generateRandomId();
      expect(id.length).toBe(16); // Default is 16 bytes
    });

    it('should generate random ID with custom length', () => {
      const id = generateRandomId(32);
      expect(id.length).toBe(32);
    });

    it('should generate unique random IDs', () => {
      const id1 = generateRandomId();
      const id2 = generateRandomId();
      expect(bytesToHex(id1)).not.toBe(bytesToHex(id2));
    });

    it('should generate random hex ID', () => {
      const hex = generateRandomIdHex();
      expect(typeof hex).toBe('string');
      expect(hex.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate random hex ID with custom length', () => {
      const hex = generateRandomIdHex(32);
      expect(hex.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('Utility Functions', () => {
    describe('Constant Time Comparison', () => {
      it('should return true for equal arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const b = new Uint8Array([1, 2, 3, 4, 5]);
        expect(constantTimeEqual(a, b)).toBe(true);
      });

      it('should return false for different arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const b = new Uint8Array([1, 2, 3, 4, 6]);
        expect(constantTimeEqual(a, b)).toBe(false);
      });

      it('should return false for arrays of different lengths', () => {
        const a = new Uint8Array([1, 2, 3]);
        const b = new Uint8Array([1, 2, 3, 4, 5]);
        expect(constantTimeEqual(a, b)).toBe(false);
      });
    });

    describe('Secure Wipe', () => {
      it('should zero out array contents', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        secureWipe(data);

        const zeros = new Uint8Array(5);
        expect(constantTimeEqual(data, zeros)).toBe(true);
      });
    });
  });
});
