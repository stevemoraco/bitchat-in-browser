/**
 * Identity Type Definitions
 *
 * Core types for user identity management in BitChat PWA.
 * Handles both local identity (our keys) and the three-layer identity model
 * used for representing peers.
 *
 * @module types/identity
 */

/**
 * Nostr key pair with bech32-encoded keys.
 * Used for Nostr protocol operations.
 */
export interface NostrIdentity {
  /**
   * Nostr public key in npub format (bech32-encoded).
   * Example: npub1abc...
   */
  npub: string;

  /**
   * Nostr private key in nsec format (bech32-encoded).
   * This should be stored securely and never exposed.
   * Example: nsec1xyz...
   */
  nsec: string;

  /**
   * Public key in hex format (64 characters).
   */
  publicKeyHex: string;

  /**
   * Private key in hex format (64 characters).
   * Used internally for signing.
   */
  privateKeyHex: string;
}

/**
 * Generic cryptographic key pair.
 * Raw bytes for use with cryptographic operations.
 */
export interface KeyPair {
  /**
   * Public key as Uint8Array (32 bytes for most curves).
   */
  publicKey: Uint8Array;

  /**
   * Private key as Uint8Array.
   * - 32 bytes for X25519
   * - 64 bytes for Ed25519 (seed + public)
   */
  privateKey: Uint8Array;
}

/**
 * Key pair with hex-encoded strings.
 * Convenient for storage and display.
 */
export interface HexKeyPair {
  /**
   * Public key as hex string.
   */
  publicKey: string;

  /**
   * Private key as hex string.
   */
  privateKey: string;
}

/**
 * User's local identity.
 * Represents the current user's cryptographic identity.
 */
export interface Identity {
  /**
   * Nostr public key (hex-encoded, 64 characters).
   */
  publicKey: string;

  /**
   * SHA-256 fingerprint of the public key (truncated for display).
   */
  fingerprint: string;

  /**
   * Full SHA-256 hash of the public key (hex-encoded, 64 characters).
   */
  fingerprintFull: string;

  /**
   * Whether the private key is currently loaded in memory.
   */
  isKeyLoaded: boolean;

  /**
   * Nostr public key in npub format.
   */
  npub?: string;

  /**
   * NIP-05 identifier if set and verified.
   * Format: user@domain.com
   */
  nip05?: string;

  /**
   * User's display nickname.
   */
  nickname: string;

  /**
   * Avatar URL or data URI.
   */
  avatar?: string;

  /**
   * Unix timestamp when the identity was created.
   */
  createdAt: number;

  /**
   * Unix timestamp when the identity was last used.
   */
  lastUsedAt?: number;
}

/**
 * Stored identity data for persistence.
 * Contains encrypted private key material.
 */
export interface StoredIdentity {
  /**
   * Identity version for migrations.
   */
  version: number;

  /**
   * Public key (hex-encoded).
   */
  publicKey: string;

  /**
   * Encrypted private key (base64-encoded ciphertext).
   */
  encryptedPrivateKey: string;

  /**
   * Salt used for key derivation (base64-encoded).
   */
  salt: string;

  /**
   * Nonce used for encryption (base64-encoded).
   */
  nonce: string;

  /**
   * Key derivation function parameters.
   */
  kdfParams: {
    /** Algorithm (e.g., 'argon2id', 'scrypt', 'pbkdf2') */
    algorithm: string;
    /** Number of iterations or ops limit */
    iterations: number;
    /** Memory limit in bytes */
    memoryLimit?: number;
    /** Parallelism factor */
    parallelism?: number;
  };

  /**
   * Unix timestamp when stored.
   */
  storedAt: number;

  /**
   * User's nickname at time of storage.
   */
  nickname?: string;
}

/**
 * Identity creation options.
 */
export interface CreateIdentityOptions {
  /**
   * User's chosen nickname.
   */
  nickname: string;

  /**
   * Password for encrypting the private key.
   */
  password?: string;

  /**
   * Whether to persist the identity to storage.
   */
  persist?: boolean;

  /**
   * Existing Nostr private key to import (nsec or hex).
   */
  importKey?: string;
}

/**
 * Identity import result.
 */
export interface IdentityImportResult {
  /**
   * Whether the import was successful.
   */
  success: boolean;

  /**
   * The imported identity (if successful).
   */
  identity?: Identity;

  /**
   * Error message (if failed).
   */
  error?: string;

  /**
   * Warning messages (e.g., key format issues).
   */
  warnings?: string[];
}

/**
 * Identity export format.
 */
export interface IdentityExport {
  /**
   * Export format version.
   */
  version: number;

  /**
   * Nostr identity (npub and optionally nsec).
   */
  nostr: {
    npub: string;
    nsec?: string;
  };

  /**
   * Fingerprint for verification.
   */
  fingerprint: string;

  /**
   * Nickname at time of export.
   */
  nickname?: string;

  /**
   * Unix timestamp of export.
   */
  exportedAt: number;
}

/**
 * Fingerprint representation with formatting options.
 */
export interface Fingerprint {
  /**
   * Full SHA-256 hash (hex-encoded, 64 characters).
   */
  full: string;

  /**
   * Short version for display (first 8 characters).
   */
  short: string;

  /**
   * Human-readable formatted version.
   * Format: "AB12:CD34:EF56:7890"
   */
  formatted: string;

  /**
   * Raw bytes (32 bytes).
   */
  bytes: Uint8Array;
}

/**
 * Session state for temporary identity data.
 */
export interface IdentitySession {
  /**
   * Whether a valid session exists.
   */
  isActive: boolean;

  /**
   * Public key of the active identity.
   */
  publicKey?: string;

  /**
   * Unix timestamp when the session started.
   */
  startedAt?: number;

  /**
   * Unix timestamp when the session will expire.
   */
  expiresAt?: number;

  /**
   * Whether the private key is in memory.
   */
  hasPrivateKey: boolean;
}

/**
 * Key type enumeration.
 */
export enum KeyType {
  /** Nostr/Ed25519 signing key */
  Nostr = 'nostr',
  /** X25519 key for Noise protocol DH */
  Noise = 'noise',
  /** Ed25519 key for signing */
  Signing = 'signing',
}

/**
 * Key metadata for key management.
 */
export interface KeyMetadata {
  /**
   * Key type.
   */
  type: KeyType;

  /**
   * Key identifier (fingerprint or pubkey hash).
   */
  id: string;

  /**
   * Unix timestamp when the key was created.
   */
  createdAt: number;

  /**
   * Unix timestamp when the key was last used.
   */
  lastUsedAt?: number;

  /**
   * Whether this is the active/primary key of its type.
   */
  isPrimary: boolean;

  /**
   * Associated identity fingerprint.
   */
  identityFingerprint?: string;
}

/**
 * Identity verification challenge.
 * Used for out-of-band verification (QR code exchange).
 */
export interface VerificationChallenge {
  /**
   * Challenge nonce (random bytes, hex-encoded).
   */
  nonce: string;

  /**
   * Fingerprint being verified.
   */
  fingerprint: string;

  /**
   * Unix timestamp when the challenge was created.
   */
  createdAt: number;

  /**
   * Unix timestamp when the challenge expires.
   */
  expiresAt: number;
}

/**
 * Identity verification response.
 */
export interface VerificationResponse {
  /**
   * Original challenge nonce.
   */
  nonce: string;

  /**
   * Signature over the challenge (hex-encoded).
   */
  signature: string;

  /**
   * Responder's fingerprint.
   */
  fingerprint: string;

  /**
   * Unix timestamp of the response.
   */
  timestamp: number;
}

/**
 * Helper function to format a fingerprint for display.
 */
export function formatFingerprint(hex: string): string {
  // Format as groups of 4 characters separated by colons
  // e.g., "AB12:CD34:EF56:7890"
  const short = hex.slice(0, 16).toUpperCase();
  return short.match(/.{1,4}/g)?.join(':') || short;
}

/**
 * Helper function to create a short fingerprint.
 */
export function shortFingerprint(hex: string): string {
  return hex.slice(0, 8).toUpperCase();
}

/**
 * Validate a Nostr public key (npub or hex).
 */
export function isValidNostrPublicKey(key: string): boolean {
  // npub format
  if (key.startsWith('npub1') && key.length === 63) {
    return true;
  }
  // Hex format (64 characters)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return true;
  }
  return false;
}

/**
 * Validate a Nostr private key (nsec or hex).
 */
export function isValidNostrPrivateKey(key: string): boolean {
  // nsec format
  if (key.startsWith('nsec1') && key.length === 63) {
    return true;
  }
  // Hex format (64 characters)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return true;
  }
  return false;
}
