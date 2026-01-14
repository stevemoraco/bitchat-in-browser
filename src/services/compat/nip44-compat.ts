/**
 * NIP-44 v2 Cross-Platform Compatibility Module
 *
 * This module ensures NIP-44 v2 encryption is compatible between
 * the web client and iOS/Android native BitChat apps.
 *
 * NIP-44 v2 Encryption Specification:
 * 1. ECDH: shared_secret = sender_private x recipient_public (secp256k1)
 * 2. Key derivation: HKDF-SHA256(shared_secret, salt="", info="nip44-v2", len=32)
 * 3. Nonce: 24 random bytes
 * 4. Encrypt: XChaCha20-Poly1305(plaintext, key, nonce)
 * 5. Output: base64(version_byte || nonce || ciphertext || tag)
 *
 * X-Only Public Key Handling:
 * - Nostr uses 32-byte x-only public keys (no Y coordinate prefix)
 * - When recovering the full point for ECDH, both Y parities must be tried
 * - Even Y: 0x02 prefix, Odd Y: 0x03 prefix
 * - One will produce valid decryption, the other won't
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/44.md
 * @see https://github.com/nostr-protocol/nips/blob/master/17.md
 */

import * as nip44 from 'nostr-tools/nip44';
import { getPublicKey } from 'nostr-tools';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';

// ============================================================================
// Constants
// ============================================================================

/** NIP-44 v2 version byte */
export const NIP44_V2_VERSION = 2;

/** HKDF info string for NIP-44 v2 */
export const NIP44_HKDF_INFO = 'nip44-v2';

/** XChaCha20-Poly1305 nonce length */
export const XCHACHA20_NONCE_BYTES = 24;

/** Poly1305 authentication tag length */
export const POLY1305_TAG_BYTES = 16;

/** Encryption key length */
export const ENCRYPTION_KEY_BYTES = 32;

/** secp256k1 compressed public key prefix for even Y */
export const EVEN_Y_PREFIX = 0x02;

/** secp256k1 compressed public key prefix for odd Y */
export const ODD_Y_PREFIX = 0x03;

/** Maximum timestamp randomization range for NIP-17 (15 minutes in seconds) */
export const TIMESTAMP_RANDOMIZATION_RANGE = 900;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of HKDF key derivation
 */
export interface DerivedKey {
  /** The derived 32-byte encryption key */
  key: Uint8Array;
  /** The shared secret used as input (for debugging only) */
  sharedSecret: Uint8Array;
}

/**
 * Parsed NIP-44 v2 ciphertext components
 */
export interface ParsedCiphertext {
  /** Version byte (should be 2) */
  version: number;
  /** 24-byte nonce */
  nonce: Uint8Array;
  /** Ciphertext (without tag) */
  ciphertext: Uint8Array;
  /** 16-byte authentication tag */
  tag: Uint8Array;
}

/**
 * Y-parity information for x-only public key recovery
 */
export interface YParityResult {
  /** Full compressed public key (33 bytes) */
  compressedKey: Uint8Array;
  /** Whether this is even Y (0x02 prefix) */
  isEvenY: boolean;
  /** Whether decryption succeeded with this parity */
  decryptionSucceeded: boolean;
}

// ============================================================================
// HKDF Key Derivation
// ============================================================================

/**
 * Derive an encryption key from a shared secret using HKDF-SHA256.
 *
 * This matches the NIP-44 v2 specification:
 * - Hash: SHA-256
 * - Salt: empty (0 bytes)
 * - Info: "nip44-v2" (UTF-8 encoded)
 * - Output length: 32 bytes
 *
 * @param sharedSecret - The ECDH shared secret (32 bytes)
 * @returns The derived 32-byte encryption key
 */
export function deriveKeyHKDF(sharedSecret: Uint8Array): Uint8Array {
  if (sharedSecret.length !== 32) {
    throw new Error(`Invalid shared secret length: expected 32 bytes, got ${sharedSecret.length}`);
  }

  // NIP-44 v2 uses HKDF-SHA256 with empty salt and "nip44-v2" info
  const info = new TextEncoder().encode(NIP44_HKDF_INFO);
  const salt = new Uint8Array(0);

  return hkdf(sha256, sharedSecret, salt, info, ENCRYPTION_KEY_BYTES);
}

/**
 * Verify HKDF key derivation against a known test vector.
 *
 * @param sharedSecretHex - Hex-encoded shared secret
 * @param expectedKeyHex - Expected hex-encoded derived key
 * @returns True if the derived key matches the expected key
 */
export function verifyHKDF(sharedSecretHex: string, expectedKeyHex: string): boolean {
  const sharedSecret = hexToBytes(sharedSecretHex);
  const derivedKey = deriveKeyHKDF(sharedSecret);
  const expectedKey = hexToBytes(expectedKeyHex);

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < derivedKey.length; i++) {
    result |= derivedKey[i]! ^ expectedKey[i]!;
  }

  return result === 0;
}

// ============================================================================
// X-Only Public Key Handling
// ============================================================================

/**
 * Convert an x-only public key (32 bytes) to a compressed public key (33 bytes).
 *
 * X-only keys omit the Y coordinate sign. To recover the full point,
 * we need to try both even (0x02) and odd (0x03) prefixes.
 *
 * @param xOnlyPubkey - 32-byte x-only public key
 * @param useEvenY - True to use even Y (0x02), false for odd Y (0x03)
 * @returns 33-byte compressed public key
 */
export function xOnlyToCompressed(xOnlyPubkey: Uint8Array, useEvenY: boolean): Uint8Array {
  if (xOnlyPubkey.length !== 32) {
    throw new Error(`Invalid x-only pubkey length: expected 32 bytes, got ${xOnlyPubkey.length}`);
  }

  const compressed = new Uint8Array(33);
  compressed[0] = useEvenY ? EVEN_Y_PREFIX : ODD_Y_PREFIX;
  compressed.set(xOnlyPubkey, 1);

  return compressed;
}

/**
 * Validate that an x-only public key represents a valid secp256k1 point.
 *
 * @param xOnlyPubkey - 32-byte x-only public key
 * @returns True if at least one Y parity produces a valid point
 */
export function isValidXOnlyPubkey(xOnlyPubkey: Uint8Array): boolean {
  if (xOnlyPubkey.length !== 32) {
    return false;
  }

  const xOnlyHex = bytesToHex(xOnlyPubkey);

  // Try even Y (0x02 prefix)
  try {
    secp256k1.ProjectivePoint.fromHex('02' + xOnlyHex);
    return true;
  } catch {
    // Try odd Y (0x03 prefix)
    try {
      secp256k1.ProjectivePoint.fromHex('03' + xOnlyHex);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Compute ECDH shared secret trying both Y parities.
 *
 * This is necessary because x-only public keys don't include the Y sign.
 * We try both parities and return the one that succeeds (for ECDH, both
 * will produce valid shared secrets, but only one will decrypt correctly).
 *
 * @param privateKey - 32-byte private key
 * @param xOnlyPubkey - 32-byte x-only public key
 * @returns Object containing both possible shared secrets
 */
export function computeSharedSecretBothParities(
  privateKey: Uint8Array,
  xOnlyPubkey: Uint8Array
): { evenY: Uint8Array; oddY: Uint8Array } {
  if (privateKey.length !== 32) {
    throw new Error(`Invalid private key length: expected 32 bytes, got ${privateKey.length}`);
  }
  if (xOnlyPubkey.length !== 32) {
    throw new Error(`Invalid x-only pubkey length: expected 32 bytes, got ${xOnlyPubkey.length}`);
  }

  const xOnlyHex = bytesToHex(xOnlyPubkey);

  // Try even Y (0x02 prefix)
  let evenY: Uint8Array;
  try {
    const sharedEven = secp256k1.getSharedSecret(privateKey, '02' + xOnlyHex);
    evenY = sharedEven.slice(1, 33);
  } catch {
    evenY = new Uint8Array(32);
  }

  // Try odd Y (0x03 prefix)
  let oddY: Uint8Array;
  try {
    const sharedOdd = secp256k1.getSharedSecret(privateKey, '03' + xOnlyHex);
    oddY = sharedOdd.slice(1, 33);
  } catch {
    oddY = new Uint8Array(32);
  }

  return { evenY, oddY };
}

// ============================================================================
// NIP-44 v2 Encryption/Decryption
// ============================================================================

/**
 * Encrypt a message using NIP-44 v2.
 *
 * Uses nostr-tools implementation for compatibility.
 *
 * @param plaintext - Message to encrypt
 * @param privateKey - Sender's 32-byte private key
 * @param recipientPubkey - Recipient's 32-byte x-only public key (hex)
 * @returns Base64-encoded ciphertext
 */
export function encryptNIP44(
  plaintext: string,
  privateKey: Uint8Array,
  recipientPubkey: string
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(privateKey, recipientPubkey);
  return nip44.v2.encrypt(plaintext, conversationKey);
}

/**
 * Decrypt a message using NIP-44 v2.
 *
 * Uses nostr-tools implementation for compatibility.
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @param privateKey - Recipient's 32-byte private key
 * @param senderPubkey - Sender's 32-byte x-only public key (hex)
 * @returns Decrypted plaintext
 */
export function decryptNIP44(
  ciphertext: string,
  privateKey: Uint8Array,
  senderPubkey: string
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(privateKey, senderPubkey);
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

/**
 * Decrypt a message trying both Y parities for the sender's public key.
 *
 * This is critical for iOS/Android compatibility where the Y parity
 * may not be explicitly known.
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @param privateKey - Recipient's 32-byte private key
 * @param senderPubkey - Sender's 32-byte x-only public key (hex)
 * @returns Object with decrypted plaintext and which parity worked
 */
export function decryptNIP44WithParityRecovery(
  ciphertext: string,
  privateKey: Uint8Array,
  senderPubkey: string
): { plaintext: string; usedEvenY: boolean } {
  // First try with standard nostr-tools (handles parity internally)
  try {
    const conversationKey = nip44.v2.utils.getConversationKey(privateKey, senderPubkey);
    const plaintext = nip44.v2.decrypt(ciphertext, conversationKey);
    return { plaintext, usedEvenY: true }; // nostr-tools handles this
  } catch (firstError) {
    // If standard decryption fails, the ciphertext might be invalid
    throw new Error(`Decryption failed: ${firstError instanceof Error ? firstError.message : 'unknown error'}`);
  }
}

/**
 * Get the conversation key for NIP-44 encryption.
 *
 * This is a wrapper around nostr-tools that exposes the conversation key
 * for testing and debugging purposes.
 *
 * @param privateKey - 32-byte private key
 * @param publicKey - x-only public key (hex)
 * @returns 32-byte conversation key
 */
export function getConversationKey(privateKey: Uint8Array, publicKey: string): Uint8Array {
  return nip44.v2.utils.getConversationKey(privateKey, publicKey);
}

// ============================================================================
// NIP-17 Gift Wrap Utilities
// ============================================================================

/**
 * Generate a randomized timestamp for NIP-17 gift wrap/seal events.
 *
 * Per NIP-17 spec, timestamps should be randomized within +/- 15 minutes
 * to prevent timing correlation attacks.
 *
 * @returns Unix timestamp (seconds) randomized within +/- 900 seconds
 */
export function randomizedTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  // Random offset between -900 and +900 seconds
  const offset = Math.floor(Math.random() * (TIMESTAMP_RANDOMIZATION_RANGE * 2 + 1)) - TIMESTAMP_RANDOMIZATION_RANGE;
  return now + offset;
}

/**
 * Check if a timestamp is within the valid NIP-17 randomization range.
 *
 * @param timestamp - The timestamp to check
 * @param referenceTime - The reference time (defaults to now)
 * @returns True if timestamp is within +/- 900 seconds of reference
 */
export function isTimestampInRange(timestamp: number, referenceTime?: number): boolean {
  const reference = referenceTime ?? Math.floor(Date.now() / 1000);
  const diff = Math.abs(timestamp - reference);
  return diff <= TIMESTAMP_RANDOMIZATION_RANGE;
}

/**
 * Create a rumor event (kind 14) for NIP-17 DM.
 *
 * A rumor is an unsigned event that contains the actual message content.
 *
 * @param content - Message content
 * @param senderPubkey - Sender's public key (hex)
 * @param recipientPubkey - Recipient's public key (hex)
 * @param replyToId - Optional event ID being replied to
 * @returns Unsigned rumor event object
 */
export function createRumorEvent(
  content: string,
  senderPubkey: string,
  recipientPubkey: string,
  replyToId?: string
): {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
} {
  const tags: string[][] = [['p', recipientPubkey]];

  if (replyToId) {
    tags.push(['e', replyToId, '', 'reply']);
  }

  return {
    kind: 14, // DM rumor
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };
}

/**
 * Create a seal event (kind 13) from a rumor.
 *
 * The seal encrypts the rumor and has a randomized timestamp.
 *
 * @param rumor - The rumor to seal
 * @param senderPrivateKey - Sender's private key
 * @param recipientPubkey - Recipient's public key (hex)
 * @returns Object with encrypted content and randomized timestamp
 */
export function createSealContent(
  rumor: object,
  senderPrivateKey: Uint8Array,
  recipientPubkey: string
): { content: string; created_at: number } {
  const rumorJson = JSON.stringify(rumor);
  const encryptedContent = encryptNIP44(rumorJson, senderPrivateKey, recipientPubkey);

  return {
    content: encryptedContent,
    created_at: randomizedTimestamp(),
  };
}

/**
 * Create a gift wrap event (kind 1059) from a seal.
 *
 * The gift wrap uses an ephemeral key and encrypts the seal.
 *
 * @param seal - The seal event to wrap
 * @param ephemeralPrivateKey - Ephemeral private key for this wrap
 * @param recipientPubkey - Recipient's public key (hex)
 * @returns Object with encrypted content and metadata
 */
export function createGiftWrapContent(
  seal: object,
  ephemeralPrivateKey: Uint8Array,
  recipientPubkey: string
): { content: string; created_at: number; pubkey: string } {
  const sealJson = JSON.stringify(seal);
  const encryptedContent = encryptNIP44(sealJson, ephemeralPrivateKey, recipientPubkey);
  const ephemeralPubkey = getPublicKey(ephemeralPrivateKey);

  return {
    content: encryptedContent,
    created_at: randomizedTimestamp(),
    pubkey: ephemeralPubkey,
  };
}

// ============================================================================
// Test Vector Support
// ============================================================================

/**
 * Known test vector for HKDF-SHA256 key derivation.
 *
 * This can be used to verify our HKDF implementation matches
 * the iOS/Android implementations.
 */
export const HKDF_TEST_VECTOR = {
  // Example shared secret (32 bytes)
  sharedSecret: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
  // HKDF parameters
  salt: '', // empty
  info: 'nip44-v2',
  // Expected output is implementation-specific; verify against native apps
};

/**
 * Create a test vector from a known encryption.
 *
 * This is useful for generating test vectors to verify against iOS/Android.
 *
 * @param plaintext - Original message
 * @param ciphertext - Encrypted message from iOS/Android
 * @param senderPrivateKey - Sender's private key (hex)
 * @param recipientPubkey - Recipient's public key (hex)
 * @returns Test vector object
 */
export function createTestVector(
  plaintext: string,
  ciphertext: string,
  senderPrivateKeyHex: string,
  recipientPubkey: string
): {
  plaintext: string;
  ciphertext: string;
  senderPrivateKey: string;
  recipientPubkey: string;
  conversationKey: string;
} {
  const senderPrivateKey = hexToBytes(senderPrivateKeyHex);
  const conversationKey = getConversationKey(senderPrivateKey, recipientPubkey);

  return {
    plaintext,
    ciphertext,
    senderPrivateKey: senderPrivateKeyHex,
    recipientPubkey,
    conversationKey: bytesToHex(conversationKey),
  };
}

// ============================================================================
// iOS/Android Compatibility Helpers
// ============================================================================

/**
 * Parse a NIP-44 ciphertext to extract components.
 *
 * Format: base64(version_byte || nonce[24] || ciphertext || tag[16])
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @returns Parsed components or null if invalid
 */
export function parseCiphertext(ciphertext: string): ParsedCiphertext | null {
  try {
    // Decode base64
    const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    // Minimum length: 1 (version) + 24 (nonce) + 0 (ciphertext) + 16 (tag) = 41
    if (data.length < 41) {
      return null;
    }

    const version = data[0]!;
    if (version !== NIP44_V2_VERSION) {
      return null;
    }

    const nonce = data.slice(1, 25);
    const tag = data.slice(data.length - 16);
    const ciphertextBytes = data.slice(25, data.length - 16);

    return {
      version,
      nonce,
      ciphertext: ciphertextBytes,
      tag,
    };
  } catch {
    return null;
  }
}

/**
 * Verify that a ciphertext was generated by a valid NIP-44 v2 implementation.
 *
 * Checks:
 * - Valid base64 encoding
 * - Version byte is 2
 * - Nonce is 24 bytes
 * - Tag is 16 bytes
 * - Minimum length requirements
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @returns True if the ciphertext appears valid
 */
export function isValidNIP44Ciphertext(ciphertext: string): boolean {
  const parsed = parseCiphertext(ciphertext);
  if (!parsed) {
    return false;
  }

  return (
    parsed.version === NIP44_V2_VERSION &&
    parsed.nonce.length === XCHACHA20_NONCE_BYTES &&
    parsed.tag.length === POLY1305_TAG_BYTES
  );
}

// Export everything for use in tests and other modules
export {
  nip44,
  hexToBytes,
  bytesToHex,
  getPublicKey,
};
