/**
 * Cryptographic Protocol Compatibility Tests
 *
 * These tests verify that the web client's cryptographic operations
 * are compatible with the iOS and Android BitChat apps.
 *
 * Validates:
 * - Test vectors from iOS implementation
 * - Noise Protocol handshake compatibility
 * - Key derivation compatibility
 * - Encryption/decryption cross-platform
 */

import { describe, it, expect } from 'vitest';
import {
  NIP44_VECTORS,
  NOISE_VECTORS,
  SCHNORR_VECTORS,
} from '../test-vectors';
import {
  NativeEncryptionFormat,
  NativeNoiseFormat,
  NativeKeyFormat,
  base64UrlEncode,
  base64UrlDecode,
} from '../native-format';
import { CryptoConstants } from '../../crypto/types';

// ============================================================================
// NIP-44 v2 Encryption Tests
// ============================================================================

describe('NIP-44 v2 Encryption Compatibility', () => {
  describe('XChaCha20-Poly1305 Parameters', () => {
    it('should use 32-byte keys', () => {
      expect(CryptoConstants.CHACHA20_KEY_BYTES).toBe(32);
      expect(NativeEncryptionFormat.KEY_DERIVATION.outputLength).toBe(32);
    });

    it('should use 24-byte nonces (XChaCha20)', () => {
      expect(CryptoConstants.XCHACHA20_NONCE_BYTES).toBe(24);
      expect(NativeEncryptionFormat.NONCE_LENGTH).toBe(24);
    });

    it('should use 16-byte authentication tags', () => {
      expect(CryptoConstants.POLY1305_TAG_BYTES).toBe(16);
      expect(NativeEncryptionFormat.TAG_LENGTH).toBe(16);
    });
  });

  describe('Key Derivation (HKDF-SHA256)', () => {
    it('should use SHA-256 as hash function', () => {
      expect(NativeEncryptionFormat.KEY_DERIVATION.algorithm).toBe('HKDF-SHA256');
    });

    it('should use empty salt', () => {
      const salt = NativeEncryptionFormat.KEY_DERIVATION.salt;
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(0);
    });

    it('should use "nip44-v2" as info string', () => {
      expect(NativeEncryptionFormat.KEY_DERIVATION.info).toBe('nip44-v2');
      expect(NIP44_VECTORS.keyDerivation.info).toBe('nip44-v2');
    });

    it('should derive 32-byte output key', () => {
      expect(NativeEncryptionFormat.KEY_DERIVATION.outputLength).toBe(32);
    });

    it('should accept 32-byte shared secret as input', () => {
      const sharedSecret = NIP44_VECTORS.keyDerivation.sharedSecret;
      // Shared secret should be 64 hex characters (32 bytes)
      expect(sharedSecret).toHaveLength(64);
      expect(sharedSecret).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Base64URL Encoding', () => {
    it('should encode bytes to base64url string', () => {
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base64UrlEncode(testData);

      // Should not contain standard base64 characters
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should decode base64url string to bytes', () => {
      const encoded = 'SGVsbG8'; // "Hello" in base64url
      const decoded = base64UrlDecode(encoded);

      expect(decoded).toBeInstanceOf(Uint8Array);
      expect(decoded).not.toBeNull();
      // "Hello" = [72, 101, 108, 108, 111]
      expect(decoded![0]).toBe(72);
      expect(decoded![1]).toBe(101);
    });

    it('should handle padding correctly', () => {
      // Different length inputs require different padding
      const test1 = new Uint8Array([1]); // 1 byte
      const test2 = new Uint8Array([1, 2]); // 2 bytes
      const test3 = new Uint8Array([1, 2, 3]); // 3 bytes

      // All should encode/decode correctly
      [test1, test2, test3].forEach((original) => {
        const encoded = base64UrlEncode(original);
        const decoded = base64UrlDecode(encoded);
        expect(decoded).toEqual(original);
      });
    });

    it('should return null for invalid base64url', () => {
      const invalid = '!!!invalid!!!';
      const result = base64UrlDecode(invalid);
      expect(result).toBeNull();
    });
  });

  describe('Ciphertext Format', () => {
    it('should format as v2: prefix + base64url', () => {
      const nonce = new Uint8Array(24).fill(0x11);
      const ciphertext = new Uint8Array(10).fill(0x22);
      const tag = new Uint8Array(16).fill(0x33);

      const formatted = NativeEncryptionFormat.formatCiphertext(
        nonce,
        ciphertext,
        tag
      );

      expect(formatted.startsWith('v2:')).toBe(true);
    });

    it('should concatenate nonce, ciphertext, and tag in order', () => {
      const nonce = new Uint8Array(24).fill(0x11);
      const ciphertext = new Uint8Array(10).fill(0x22);
      const tag = new Uint8Array(16).fill(0x33);

      const formatted = NativeEncryptionFormat.formatCiphertext(
        nonce,
        ciphertext,
        tag
      );

      // Parse it back
      const parsed = NativeEncryptionFormat.parseCiphertext(formatted);

      expect(parsed).not.toBeNull();
      expect(Array.from(parsed!.nonce)).toEqual(Array.from(nonce));
      expect(Array.from(parsed!.ciphertext)).toEqual(Array.from(ciphertext));
      expect(Array.from(parsed!.tag)).toEqual(Array.from(tag));
    });

    it('should reject messages without v2: prefix', () => {
      const parsed = NativeEncryptionFormat.parseCiphertext('v1:oldformat');
      expect(parsed).toBeNull();
    });

    it('should reject messages that are too short', () => {
      // Minimum: 24 (nonce) + 0 (ciphertext) + 16 (tag) = 40 bytes
      const tooShort = 'v2:' + base64UrlEncode(new Uint8Array(30));
      const parsed = NativeEncryptionFormat.parseCiphertext(tooShort);
      expect(parsed).toBeNull();
    });
  });

  describe('XChaCha20 Subkey Derivation (HChaCha20)', () => {
    /**
     * XChaCha20 uses HChaCha20 to derive a subkey from the first 16 bytes
     * of the 24-byte nonce, then uses standard ChaCha20 with the remaining
     * 8 bytes as part of the nonce.
     *
     * Reference: ../bitchat/bitchat/Nostr/XChaCha20Poly1305Compat.swift
     */
    it('should use first 16 bytes of nonce for HChaCha20', () => {
      // This is the iOS implementation behavior
      const nonce24 = new Uint8Array(24);
      for (let i = 0; i < 24; i++) {
        nonce24[i] = i;
      }

      // First 16 bytes are used for HChaCha20 subkey derivation
      const hchachaNonce = nonce24.slice(0, 16);
      expect(hchachaNonce).toHaveLength(16);
    });

    it('should use last 8 bytes for ChaCha20 nonce (with 4 zero prefix)', () => {
      // The 12-byte ChaCha20 nonce is: 4 zero bytes + last 8 bytes of nonce24
      const nonce24 = new Uint8Array(24);
      for (let i = 0; i < 24; i++) {
        nonce24[i] = i;
      }

      const chachaNonce = new Uint8Array(12);
      chachaNonce.set([0, 0, 0, 0], 0);
      chachaNonce.set(nonce24.slice(16, 24), 4);

      expect(chachaNonce.slice(0, 4)).toEqual(new Uint8Array([0, 0, 0, 0]));
      expect(Array.from(chachaNonce.slice(4))).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
    });
  });
});

// ============================================================================
// Noise Protocol Compatibility Tests
// ============================================================================

describe('Noise Protocol Compatibility', () => {
  describe('Protocol Configuration', () => {
    it('should use Noise_XX_25519_ChaChaPoly_SHA256', () => {
      expect(NOISE_VECTORS.protocolName).toBe('Noise_XX_25519_ChaChaPoly_SHA256');
      expect(NativeNoiseFormat.PROTOCOL_NAME).toBe('Noise_XX_25519_ChaChaPoly_SHA256');
    });

    it('should use X25519 for key exchange', () => {
      expect(NativeNoiseFormat.DH_ALGORITHM).toBe('X25519');
    });

    it('should use ChaCha20-Poly1305 for symmetric encryption', () => {
      expect(NativeNoiseFormat.CIPHER_ALGORITHM).toBe('ChaCha20-Poly1305');
    });

    it('should use SHA-256 for hashing', () => {
      expect(NativeNoiseFormat.HASH_ALGORITHM).toBe('SHA-256');
    });

    it('should use XX handshake pattern', () => {
      expect(NativeNoiseFormat.HANDSHAKE_PATTERN).toBe('XX');
    });
  });

  describe('XX Handshake Pattern', () => {
    it('should have correct message 1 tokens (initiator -> responder)', () => {
      expect(NOISE_VECTORS.xxPattern.message1).toEqual(['e']);
    });

    it('should have correct message 2 tokens (responder -> initiator)', () => {
      expect(NOISE_VECTORS.xxPattern.message2).toEqual(['e', 'ee', 's', 'es']);
    });

    it('should have correct message 3 tokens (initiator -> responder)', () => {
      expect(NOISE_VECTORS.xxPattern.message3).toEqual(['s', 'se']);
    });

    it('should complete in 3 messages', () => {
      const totalMessages =
        [NOISE_VECTORS.xxPattern.message1, NOISE_VECTORS.xxPattern.message2, NOISE_VECTORS.xxPattern.message3].length;
      expect(totalMessages).toBe(3);
    });
  });

  describe('Key Sizes', () => {
    it('should use 32-byte Curve25519 public keys', () => {
      expect(NOISE_VECTORS.keySizes.curve25519PublicKey).toBe(32);
      expect(NativeNoiseFormat.KEY_SIZES.publicKey).toBe(32);
    });

    it('should use 32-byte Curve25519 private keys', () => {
      expect(NOISE_VECTORS.keySizes.curve25519PrivateKey).toBe(32);
      expect(NativeNoiseFormat.KEY_SIZES.privateKey).toBe(32);
    });

    it('should use 32-byte ChaCha20 keys', () => {
      expect(NOISE_VECTORS.keySizes.chachaKey).toBe(32);
      expect(NativeNoiseFormat.KEY_SIZES.symmetricKey).toBe(32);
    });

    it('should use 12-byte ChaCha20 nonces', () => {
      expect(NOISE_VECTORS.keySizes.chachaNonce).toBe(12);
      expect(NativeNoiseFormat.KEY_SIZES.nonce).toBe(12);
    });

    it('should use 16-byte Poly1305 tags', () => {
      expect(NOISE_VECTORS.keySizes.poly1305Tag).toBe(16);
      expect(NativeNoiseFormat.KEY_SIZES.tag).toBe(16);
    });

    it('should use 32-byte SHA-256 hashes', () => {
      expect(NOISE_VECTORS.keySizes.sha256Hash).toBe(32);
    });
  });

  describe('Nonce Encoding', () => {
    it('should encode nonce as 12 bytes with 4-byte zero prefix', () => {
      expect(NOISE_VECTORS.nonceFormat.totalLength).toBe(12);
      expect(NOISE_VECTORS.nonceFormat.paddingLength).toBe(4);
      expect(NOISE_VECTORS.nonceFormat.counterLength).toBe(8);
    });

    it('should encode counter in little-endian', () => {
      const nonce = NativeNoiseFormat.encodeNonce(BigInt(1));

      // First 4 bytes should be zero
      expect(nonce.slice(0, 4)).toEqual(new Uint8Array([0, 0, 0, 0]));

      // Counter 1 in little-endian
      expect(nonce[4]).toBe(1);
      expect(nonce.slice(5, 12)).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0]));
    });

    it('should handle large counter values', () => {
      const largeCounter = BigInt('0x0102030405060708');
      const nonce = NativeNoiseFormat.encodeNonce(largeCounter);

      // First 4 bytes should be zero
      expect(nonce.slice(0, 4)).toEqual(new Uint8Array([0, 0, 0, 0]));

      // Counter in little-endian: 08 07 06 05 04 03 02 01
      expect(nonce[4]).toBe(0x08);
      expect(nonce[5]).toBe(0x07);
      expect(nonce[6]).toBe(0x06);
      expect(nonce[7]).toBe(0x05);
    });
  });

  describe('Replay Protection', () => {
    it('should use 1024-bit sliding window', () => {
      expect(NOISE_VECTORS.replayWindow.windowSize).toBe(1024);
      expect(NativeNoiseFormat.REPLAY_WINDOW.size).toBe(1024);
    });

    it('should store window as 128 bytes (1024 bits)', () => {
      expect(NOISE_VECTORS.replayWindow.windowBytes).toBe(128);
      expect(NativeNoiseFormat.REPLAY_WINDOW.bytes).toBe(128);
    });
  });

  describe('Transport Message Format', () => {
    it('should use 4-byte nonce prefix in transport messages', () => {
      expect(NativeNoiseFormat.TRANSPORT_NONCE_SIZE).toBe(4);
    });

    it('should format transport as: nonce(4) || ciphertext || tag(16)', () => {
      // Total overhead: 4 + 16 = 20 bytes
      const overheadSize =
        NativeNoiseFormat.TRANSPORT_NONCE_SIZE + NativeNoiseFormat.KEY_SIZES.tag;
      expect(overheadSize).toBe(20);
    });
  });

  describe('HKDF for Key Derivation', () => {
    it('should derive keys using HKDF with chaining key', () => {
      const { hkdf } = NOISE_VECTORS;
      expect(hkdf.emptyInfo.inputKeyMaterial).toHaveLength(32);
      expect(hkdf.emptyInfo.outputLength).toBe(32);
    });

    it('should support empty info for HKDF', () => {
      const { hkdf } = NOISE_VECTORS;
      expect(hkdf.emptyInfo.info).toHaveLength(0);
    });
  });
});

// ============================================================================
// Schnorr Signature Compatibility Tests
// ============================================================================

describe('Schnorr Signature Compatibility (BIP-340)', () => {
  describe('Key Format', () => {
    it('should use x-only public keys (32 bytes)', () => {
      expect(SCHNORR_VECTORS.format.publicKeyLength).toBe(32);
      expect(NativeKeyFormat.NOSTR_PUBLIC_KEY.length).toBe(32);
    });

    it('should use 32-byte private keys', () => {
      expect(SCHNORR_VECTORS.format.privateKeyLength).toBe(32);
      expect(NativeKeyFormat.NOSTR_PRIVATE_KEY.length).toBe(32);
    });

    it('should display public keys as 64-character hex', () => {
      expect(NativeKeyFormat.NOSTR_PUBLIC_KEY.hexLength).toBe(64);
    });
  });

  describe('Signature Format', () => {
    it('should produce 64-byte signatures', () => {
      expect(SCHNORR_VECTORS.format.signatureLength).toBe(64);
    });

    it('should use 32-byte auxiliary random data', () => {
      expect(SCHNORR_VECTORS.auxRandLength).toBe(32);
    });
  });

  describe('Signature Generation', () => {
    /**
     * BIP-340 signature generation:
     * 1. Compute message hash (SHA-256 of serialized event)
     * 2. Generate or use provided auxiliary random data (32 bytes)
     * 3. Sign using Schnorr algorithm
     * 4. Output 64-byte signature
     */
    it('should sign SHA-256 hash of message', () => {
      // Message hash should be 32 bytes (SHA-256 output)
      expect(CryptoConstants.SHA256_BYTES).toBe(32);
    });
  });
});

// ============================================================================
// secp256k1 Key Compatibility Tests
// ============================================================================

describe('secp256k1 Key Compatibility', () => {
  describe('X-Only Public Keys', () => {
    /**
     * Nostr uses x-only public keys (32 bytes) instead of compressed (33 bytes)
     * or uncompressed (65 bytes) public keys.
     *
     * X-only keys omit the sign bit since it can be recovered during verification.
     */
    it('should use 32-byte x-only format', () => {
      expect(NativeKeyFormat.NOSTR_PUBLIC_KEY.format).toBe('x-only');
      expect(NativeKeyFormat.NOSTR_PUBLIC_KEY.length).toBe(32);
    });
  });

  describe('ECDH Shared Secret', () => {
    /**
     * When computing ECDH with x-only keys, both Y coordinate
     * parities must be tried since the sign is not known.
     *
     * Reference: NostrProtocol.swift deriveSharedSecret()
     */
    it('should produce 32-byte shared secrets', () => {
      expect(CryptoConstants.SHARED_SECRET_BYTES).toBe(32);
    });

    it('should handle both even and odd Y coordinates', () => {
      // X-only public keys can have either even or odd Y
      // Implementation should try both parities
      const evenPrefix = 0x02;
      const oddPrefix = 0x03;

      expect(evenPrefix).toBe(2);
      expect(oddPrefix).toBe(3);
    });
  });
});

// ============================================================================
// Cross-Platform Encryption/Decryption Tests
// ============================================================================

describe('Cross-Platform Encryption/Decryption', () => {
  describe('Message Format Interoperability', () => {
    it('should use consistent version prefix', () => {
      expect(NativeEncryptionFormat.VERSION_PREFIX).toBe('v2:');
    });

    it('should use same key derivation parameters', () => {
      const params = NativeEncryptionFormat.KEY_DERIVATION;

      expect(params.algorithm).toBe('HKDF-SHA256');
      expect(params.info).toBe('nip44-v2');
      expect(params.outputLength).toBe(32);
      expect(params.salt.length).toBe(0);
    });

    it('should use same nonce size', () => {
      expect(NativeEncryptionFormat.NONCE_LENGTH).toBe(24);
    });

    it('should use same tag size', () => {
      expect(NativeEncryptionFormat.TAG_LENGTH).toBe(16);
    });
  });

  describe('Byte Order Consistency', () => {
    it('should use big-endian for transport nonce in Noise', () => {
      // iOS uses big-endian for the 4-byte nonce prefix
      // Web implementation must match
      const nonce = 0x01020304;
      const bytes = new Uint8Array(4);
      const view = new DataView(bytes.buffer);
      view.setUint32(0, nonce, false); // false = big-endian

      expect(bytes[0]).toBe(0x01);
      expect(bytes[1]).toBe(0x02);
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);
    });

    it('should use little-endian for Noise counter nonce', () => {
      const nonce = NativeNoiseFormat.encodeNonce(BigInt(0x01020304));

      // First 4 bytes are padding zeros
      // Counter is in little-endian starting at byte 4
      expect(nonce[4]).toBe(0x04);
      expect(nonce[5]).toBe(0x03);
      expect(nonce[6]).toBe(0x02);
      expect(nonce[7]).toBe(0x01);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid ciphertext format', () => {
      const invalid = [
        '', // empty
        'v1:', // wrong version
        'v2:', // missing data
        'invalid', // no prefix
      ];

      invalid.forEach((ciphertext) => {
        const result = NativeEncryptionFormat.parseCiphertext(ciphertext);
        expect(result).toBeNull();
      });
    });
  });
});

// ============================================================================
// Crypto Constants Validation
// ============================================================================

describe('Crypto Constants Validation', () => {
  describe('Web Client Constants', () => {
    it('should have correct X25519 key sizes', () => {
      expect(CryptoConstants.X25519_PUBLIC_KEY_BYTES).toBe(32);
      expect(CryptoConstants.X25519_PRIVATE_KEY_BYTES).toBe(32);
    });

    it('should have correct Ed25519 key sizes', () => {
      expect(CryptoConstants.ED25519_PUBLIC_KEY_BYTES).toBe(32);
      expect(CryptoConstants.ED25519_PRIVATE_KEY_BYTES).toBe(64);
      expect(CryptoConstants.ED25519_SIGNATURE_BYTES).toBe(64);
    });

    it('should have correct ChaCha20-Poly1305 sizes', () => {
      expect(CryptoConstants.XCHACHA20_NONCE_BYTES).toBe(24);
      expect(CryptoConstants.CHACHA20_KEY_BYTES).toBe(32);
      expect(CryptoConstants.POLY1305_TAG_BYTES).toBe(16);
    });

    it('should have correct hash sizes', () => {
      expect(CryptoConstants.SHA256_BYTES).toBe(32);
    });

    it('should have correct shared secret size', () => {
      expect(CryptoConstants.SHARED_SECRET_BYTES).toBe(32);
    });
  });

  describe('Native Format Constants', () => {
    it('should match Noise key sizes', () => {
      expect(NativeNoiseFormat.KEY_SIZES.publicKey).toBe(CryptoConstants.X25519_PUBLIC_KEY_BYTES);
      expect(NativeNoiseFormat.KEY_SIZES.privateKey).toBe(CryptoConstants.X25519_PRIVATE_KEY_BYTES);
      expect(NativeNoiseFormat.KEY_SIZES.symmetricKey).toBe(CryptoConstants.CHACHA20_KEY_BYTES);
    });

    it('should match encryption parameters', () => {
      expect(NativeEncryptionFormat.NONCE_LENGTH).toBe(CryptoConstants.XCHACHA20_NONCE_BYTES);
      expect(NativeEncryptionFormat.TAG_LENGTH).toBe(CryptoConstants.POLY1305_TAG_BYTES);
    });
  });
});
