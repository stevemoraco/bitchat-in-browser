/**
 * Key Generation and Management
 *
 * Functions for generating cryptographic key pairs and performing
 * key exchange operations.
 */

import { getSodium, ensureSodiumReady } from './init';
import { KeyPair, CryptoConstants } from './types';

/**
 * Generate an X25519 key pair for Noise protocol and ECDH.
 *
 * @returns X25519 key pair with 32-byte public and private keys
 * @throws Error if sodium is not initialized
 */
export function generateX25519KeyPair(): KeyPair {
  ensureSodiumReady();
  const sodium = getSodium();

  const keyPair = sodium.crypto_box_keypair();

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Generate an Ed25519 key pair for digital signatures.
 *
 * @returns Ed25519 key pair with 32-byte public key and 64-byte private key
 * @throws Error if sodium is not initialized
 */
export function generateEd25519KeyPair(): KeyPair {
  ensureSodiumReady();
  const sodium = getSodium();

  const keyPair = sodium.crypto_sign_keypair();

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Generate an Ed25519 key pair from a seed.
 * Useful for deterministic key generation from imported keys.
 *
 * @param seed - 32-byte seed value
 * @returns Ed25519 key pair derived from the seed
 * @throws Error if sodium is not initialized or seed is invalid
 */
export function generateEd25519KeyPairFromSeed(seed: Uint8Array): KeyPair {
  ensureSodiumReady();
  const sodium = getSodium();

  if (seed.length !== CryptoConstants.X25519_PRIVATE_KEY_BYTES) {
    throw new Error(
      `Invalid seed length: expected ${CryptoConstants.X25519_PRIVATE_KEY_BYTES} bytes, got ${seed.length}`
    );
  }

  const keyPair = sodium.crypto_sign_seed_keypair(seed);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Convert a public key to a hexadecimal string.
 *
 * @param publicKey - Raw public key bytes
 * @returns Lowercase hexadecimal string representation
 * @throws Error if sodium is not initialized
 */
export function publicKeyToHex(publicKey: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.to_hex(publicKey);
}

/**
 * Convert a hexadecimal string to a public key.
 *
 * @param hex - Hexadecimal string (64 characters for 32 bytes)
 * @returns Raw public key bytes
 * @throws Error if sodium is not initialized or hex is invalid
 */
export function hexToPublicKey(hex: string): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate hex string
  if (!/^[0-9a-f]+$/i.test(hex)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  return sodium.from_hex(hex);
}

/**
 * Convert bytes to hexadecimal string.
 *
 * @param bytes - Raw bytes
 * @returns Lowercase hexadecimal string
 * @throws Error if sodium is not initialized
 */
export function bytesToHex(bytes: Uint8Array): string {
  ensureSodiumReady();
  const sodium = getSodium();

  return sodium.to_hex(bytes);
}

/**
 * Convert hexadecimal string to bytes.
 *
 * @param hex - Hexadecimal string
 * @returns Raw bytes
 * @throws Error if sodium is not initialized or hex is invalid
 */
export function hexToBytes(hex: string): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate hex string
  if (!/^[0-9a-f]+$/i.test(hex)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  return sodium.from_hex(hex);
}

/**
 * Derive a shared secret using X25519 ECDH.
 *
 * @param ourPrivateKey - Our X25519 private key (32 bytes)
 * @param theirPublicKey - Their X25519 public key (32 bytes)
 * @returns 32-byte shared secret
 * @throws Error if sodium is not initialized or keys are invalid
 */
export function deriveSharedSecret(
  ourPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  // Validate key lengths
  if (ourPrivateKey.length !== CryptoConstants.X25519_PRIVATE_KEY_BYTES) {
    throw new Error(
      `Invalid private key length: expected ${CryptoConstants.X25519_PRIVATE_KEY_BYTES} bytes, got ${ourPrivateKey.length}`
    );
  }

  if (theirPublicKey.length !== CryptoConstants.X25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Invalid public key length: expected ${CryptoConstants.X25519_PUBLIC_KEY_BYTES} bytes, got ${theirPublicKey.length}`
    );
  }

  // Perform X25519 scalar multiplication
  return sodium.crypto_scalarmult(ourPrivateKey, theirPublicKey);
}

/**
 * Convert an Ed25519 public key to an X25519 public key.
 * Useful for using signing keys in key exchange.
 *
 * @param ed25519PublicKey - Ed25519 public key (32 bytes)
 * @returns X25519 public key (32 bytes)
 * @throws Error if sodium is not initialized or key is invalid
 */
export function ed25519PublicKeyToX25519(
  ed25519PublicKey: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (ed25519PublicKey.length !== CryptoConstants.ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Invalid Ed25519 public key length: expected ${CryptoConstants.ED25519_PUBLIC_KEY_BYTES} bytes, got ${ed25519PublicKey.length}`
    );
  }

  return sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519PublicKey);
}

/**
 * Convert an Ed25519 private key to an X25519 private key.
 * Useful for using signing keys in key exchange.
 *
 * @param ed25519PrivateKey - Ed25519 private key (64 bytes)
 * @returns X25519 private key (32 bytes)
 * @throws Error if sodium is not initialized or key is invalid
 */
export function ed25519PrivateKeyToX25519(
  ed25519PrivateKey: Uint8Array
): Uint8Array {
  ensureSodiumReady();
  const sodium = getSodium();

  if (ed25519PrivateKey.length !== CryptoConstants.ED25519_PRIVATE_KEY_BYTES) {
    throw new Error(
      `Invalid Ed25519 private key length: expected ${CryptoConstants.ED25519_PRIVATE_KEY_BYTES} bytes, got ${ed25519PrivateKey.length}`
    );
  }

  return sodium.crypto_sign_ed25519_sk_to_curve25519(ed25519PrivateKey);
}

/**
 * Securely compare two byte arrays in constant time.
 * Prevents timing attacks on key comparisons.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns True if arrays are equal
 * @throws Error if sodium is not initialized
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  ensureSodiumReady();
  const sodium = getSodium();

  if (a.length !== b.length) {
    return false;
  }

  return sodium.memcmp(a, b);
}

/**
 * Securely wipe a byte array from memory.
 * Important for cleaning up sensitive key material.
 *
 * @param bytes - Byte array to wipe
 * @throws Error if sodium is not initialized
 */
export function secureWipe(bytes: Uint8Array): void {
  ensureSodiumReady();
  const sodium = getSodium();

  sodium.memzero(bytes);
}
