/**
 * Hashing Module
 *
 * Provides SHA-256 hashing and public key fingerprint generation
 * for identity verification and display.
 */

import { getSodium, ensureSodiumReady } from './init';
import { PublicKeyFingerprint, CryptoConstants } from './types';

/**
 * Compute SHA-256 hash of data.
 *
 * @param data - Data to hash (as bytes)
 * @returns 32-byte SHA-256 hash
 * @throws Error if sodium is not initialized
 */
export function sha256(data: Uint8Array): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.crypto_hash_sha256(data);
}

/**
 * Compute SHA-256 hash of a string.
 *
 * @param data - String to hash
 * @returns 32-byte SHA-256 hash
 * @throws Error if sodium is not initialized
 */
export function sha256String(data: string): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  const dataBytes = sodium.from_string(data);
  return sodium.crypto_hash_sha256(dataBytes);
}

/**
 * Compute SHA-256 hash and return as hex string.
 *
 * @param data - Data to hash (as bytes)
 * @returns 64-character hex-encoded hash
 * @throws Error if sodium is not initialized
 */
export function sha256Hex(data: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const hash = sha256(data);
  return sodium.to_hex(hash);
}

/**
 * Compute SHA-256 hash of string and return as hex.
 *
 * @param data - String to hash
 * @returns 64-character hex-encoded hash
 * @throws Error if sodium is not initialized
 */
export function sha256StringHex(data: string): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const hash = sha256String(data);
  return sodium.to_hex(hash);
}

/**
 * Generate a human-readable fingerprint of a public key.
 *
 * @param publicKey - Public key to fingerprint (32 bytes)
 * @returns Fingerprint object with hash, formatted, and short versions
 * @throws Error if sodium is not initialized or key is invalid
 */
export function fingerprint(publicKey: Uint8Array): PublicKeyFingerprint {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate key length (either 32 for X25519/Ed25519 public keys)
  if (
    publicKey.length !== CryptoConstants.ED25519_PUBLIC_KEY_BYTES &&
    publicKey.length !== CryptoConstants.X25519_PUBLIC_KEY_BYTES
  ) {
    throw new Error(
      `Invalid public key length: expected 32 bytes, got ${publicKey.length}`
    );
  }

  // Hash the public key
  const hash = sha256(publicKey);

  // Convert to hex for formatting
  const hashHex = sodium.to_hex(hash).toUpperCase();

  // Create formatted fingerprint (groups of 4, separated by colons)
  // e.g., "AB12:CD34:EF56:7890:..."
  const groups: string[] = [];
  for (let i = 0; i < hashHex.length; i += 4) {
    groups.push(hashHex.slice(i, i + 4));
  }
  const formatted = groups.join(':');

  // Short version: first 8 characters (2 groups)
  const short = `${groups[0]}:${groups[1]}`;

  return {
    hash,
    formatted,
    short,
  };
}

/**
 * Generate a short fingerprint string for display.
 *
 * @param publicKey - Public key to fingerprint
 * @returns Short fingerprint string (e.g., "AB12:CD34")
 * @throws Error if sodium is not initialized or key is invalid
 */
export function shortFingerprint(publicKey: Uint8Array): string {
  return fingerprint(publicKey).short;
}

/**
 * Compare two fingerprints for equality.
 *
 * @param fp1 - First fingerprint
 * @param fp2 - Second fingerprint
 * @returns True if fingerprints match
 */
export function fingerprintsEqual(
  fp1: PublicKeyFingerprint,
  fp2: PublicKeyFingerprint
): boolean {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.memcmp(fp1.hash, fp2.hash);
}

/**
 * Compute BLAKE2b hash (faster than SHA-256 for non-crypto purposes).
 *
 * @param data - Data to hash
 * @param outputLength - Desired output length in bytes (1-64, default 32)
 * @returns Hash of specified length
 * @throws Error if sodium is not initialized or output length is invalid
 */
export function blake2b(
  data: Uint8Array,
  outputLength: number = 32
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (outputLength < 1 || outputLength > 64) {
    throw new Error('BLAKE2b output length must be between 1 and 64 bytes');
  }

  return sodium.crypto_generichash(outputLength, data);
}

/**
 * Compute BLAKE2b keyed hash (MAC).
 *
 * @param data - Data to hash
 * @param key - Key for MAC (16-64 bytes)
 * @param outputLength - Desired output length in bytes (1-64, default 32)
 * @returns Keyed hash of specified length
 * @throws Error if sodium is not initialized or parameters are invalid
 */
export function blake2bKeyed(
  data: Uint8Array,
  key: Uint8Array,
  outputLength: number = 32
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (outputLength < 1 || outputLength > 64) {
    throw new Error('BLAKE2b output length must be between 1 and 64 bytes');
  }

  if (key.length < 16 || key.length > 64) {
    throw new Error('BLAKE2b key must be between 16 and 64 bytes');
  }

  return sodium.crypto_generichash(outputLength, data, key);
}

/**
 * Generate a random hash-based identifier.
 *
 * @param length - Desired identifier length in bytes (default 16)
 * @returns Random bytes suitable for use as an identifier
 * @throws Error if sodium is not initialized
 */
export function generateRandomId(length: number = 16): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.randombytes_buf(length);
}

/**
 * Generate a random hex identifier string.
 *
 * @param byteLength - Number of random bytes (hex string will be 2x this, default 16)
 * @returns Random hex string
 * @throws Error if sodium is not initialized
 */
export function generateRandomIdHex(byteLength: number = 16): string {
  ensureSodiumReady();
  const sodium = getSodium();

  const bytes = generateRandomId(byteLength);
  return sodium.to_hex(bytes);
}
