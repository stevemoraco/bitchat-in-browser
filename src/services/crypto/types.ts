/**
 * Crypto Type Definitions
 *
 * Core types for cryptographic operations in BitChat.
 */

/**
 * Generic key pair for X25519 or Ed25519 operations.
 * Keys are stored as raw Uint8Array bytes.
 */
export interface KeyPair {
  /** Public key (32 bytes) */
  publicKey: Uint8Array;
  /** Private key (32 bytes for X25519, 64 bytes for Ed25519) */
  privateKey: Uint8Array;
}

/**
 * Nostr-specific key pair with hex-encoded keys.
 * Used for Nostr event signing and identity.
 */
export interface NostrKeyPair {
  /** Public key as 64-character hex string (32 bytes) */
  publicKey: string;
  /** Private key as 64-character hex string (32 bytes) */
  privateKey: string;
}

/**
 * Encrypted data container with all components needed for decryption.
 */
export interface EncryptedData {
  /** Encrypted ciphertext with authentication tag */
  ciphertext: Uint8Array;
  /** Nonce used for encryption (24 bytes for XChaCha20-Poly1305) */
  nonce: Uint8Array;
}

/**
 * Cryptographic signature.
 */
export interface Signature {
  /** Raw signature bytes (64 bytes for Ed25519) */
  signature: Uint8Array;
}

/**
 * Key type enumeration for different cryptographic purposes.
 */
export enum KeyType {
  /** X25519 key for Diffie-Hellman key exchange (Noise protocol) */
  X25519 = 'x25519',
  /** Ed25519 key for digital signatures (Nostr) */
  Ed25519 = 'ed25519',
}

/**
 * Key derivation information for shared secret derivation.
 */
export interface SharedSecretInfo {
  /** Derived shared secret (32 bytes) */
  sharedSecret: Uint8Array;
  /** Public key of the remote party */
  remotePublicKey: Uint8Array;
  /** Our public key used in the exchange */
  localPublicKey: Uint8Array;
}

/**
 * Fingerprint representation of a public key.
 * Used for human-readable key identification.
 */
export interface PublicKeyFingerprint {
  /** Full SHA-256 hash of the public key (32 bytes) */
  hash: Uint8Array;
  /** Human-readable formatted fingerprint (e.g., "AB12:CD34:EF56:7890") */
  formatted: string;
  /** Short fingerprint for display (first 8 characters) */
  short: string;
}

/**
 * Constants for key and data sizes.
 */
export const CryptoConstants = {
  /** X25519 public key size in bytes */
  X25519_PUBLIC_KEY_BYTES: 32,
  /** X25519 private key size in bytes */
  X25519_PRIVATE_KEY_BYTES: 32,
  /** Ed25519 public key size in bytes */
  ED25519_PUBLIC_KEY_BYTES: 32,
  /** Ed25519 private key (seed) size in bytes */
  ED25519_PRIVATE_KEY_BYTES: 64,
  /** Ed25519 signature size in bytes */
  ED25519_SIGNATURE_BYTES: 64,
  /** XChaCha20-Poly1305 nonce size in bytes */
  XCHACHA20_NONCE_BYTES: 24,
  /** ChaCha20-Poly1305 key size in bytes */
  CHACHA20_KEY_BYTES: 32,
  /** Poly1305 authentication tag size in bytes */
  POLY1305_TAG_BYTES: 16,
  /** SHA-256 hash output size in bytes */
  SHA256_BYTES: 32,
  /** Shared secret size from X25519 ECDH */
  SHARED_SECRET_BYTES: 32,
} as const;
