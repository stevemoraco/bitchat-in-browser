/**
 * Crypto Service
 *
 * Main entry point for cryptographic operations in BitChat.
 * Provides a singleton CryptoService class that wraps all crypto functionality.
 */

// Re-export types
export * from './types';

// Re-export Noise Protocol
export * from './noise';

// Re-export initialization functions
export { loadSodium, isSodiumReady, ensureSodiumReady } from './init';

// Re-export key functions
export {
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
} from './keys';

// Re-export encryption functions
export {
  encryptChaCha20Poly1305,
  decryptChaCha20Poly1305,
  generateNonce,
  generateKey,
  encryptCombined,
  decryptCombined,
  encryptString,
  decryptString,
} from './encryption';

// Re-export signing functions
export {
  sign,
  verify,
  signString,
  verifyString,
  signToHex,
  verifyHex,
  signCombined,
  openSigned,
} from './signing';

// Re-export hash functions
export {
  sha256,
  sha256String,
  sha256Hex,
  sha256StringHex,
  fingerprint,
  shortFingerprint,
  fingerprintsEqual,
  blake2b,
  blake2bKeyed,
  generateRandomId,
  generateRandomIdHex,
} from './hash';

// Import for class implementation
import { loadSodium, isSodiumReady, ensureSodiumReady } from './init';
import {
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
} from './keys';
import {
  encryptChaCha20Poly1305,
  decryptChaCha20Poly1305,
  generateNonce,
  generateKey,
  encryptCombined,
  decryptCombined,
  encryptString,
  decryptString,
} from './encryption';
import {
  sign,
  verify,
  signString,
  verifyString,
  signToHex,
  verifyHex,
  signCombined,
  openSigned,
} from './signing';
import {
  sha256,
  sha256String,
  sha256Hex,
  sha256StringHex,
  fingerprint,
  shortFingerprint,
  fingerprintsEqual,
  blake2b,
  blake2bKeyed,
  generateRandomId,
  generateRandomIdHex,
} from './hash';
import type {
  KeyPair,
  NostrKeyPair,
  EncryptedData,
  Signature,
  PublicKeyFingerprint,
} from './types';

/**
 * CryptoService provides a unified interface for all cryptographic operations.
 *
 * Uses the singleton pattern to ensure consistent state and initialization.
 * All operations require the service to be initialized first.
 *
 * @example
 * ```typescript
 * const crypto = CryptoService.getInstance();
 * await crypto.initialize();
 *
 * // Generate keys
 * const keyPair = crypto.generateEd25519KeyPair();
 *
 * // Sign a message
 * const sig = crypto.sign(message, keyPair.privateKey);
 *
 * // Verify signature
 * const valid = crypto.verify(message, sig.signature, keyPair.publicKey);
 * ```
 */
export class CryptoService {
  private static instance: CryptoService | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

  /**
   * Get the singleton instance of CryptoService.
   *
   * @returns The CryptoService singleton instance
   */
  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * Reset the singleton instance.
   * Only for testing purposes.
   */
  public static _resetForTesting(): void {
    CryptoService.instance = null;
  }

  /**
   * Initialize the crypto service.
   * Must be called before using any crypto operations.
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if libsodium WASM loading fails
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await loadSodium();
      this.initialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Check if the service is ready for use.
   *
   * @returns True if initialized and ready
   */
  public isReady(): boolean {
    return this.initialized && isSodiumReady();
  }

  /**
   * Ensure the service is ready, throwing if not.
   *
   * @throws Error if not initialized
   */
  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error(
        'CryptoService not initialized. Call initialize() first.'
      );
    }
    ensureSodiumReady();
  }

  // Key generation methods

  /**
   * Generate an X25519 key pair for Noise protocol.
   */
  public generateX25519KeyPair(): KeyPair {
    this.ensureReady();
    return generateX25519KeyPair();
  }

  /**
   * Generate an Ed25519 key pair for signing.
   */
  public generateEd25519KeyPair(): KeyPair {
    this.ensureReady();
    return generateEd25519KeyPair();
  }

  /**
   * Generate an Ed25519 key pair from a seed.
   */
  public generateEd25519KeyPairFromSeed(seed: Uint8Array): KeyPair {
    this.ensureReady();
    return generateEd25519KeyPairFromSeed(seed);
  }

  /**
   * Generate a Nostr-compatible key pair (hex-encoded).
   */
  public generateNostrKeyPair(): NostrKeyPair {
    this.ensureReady();
    const keyPair = generateEd25519KeyPair();
    // For Nostr, we use the seed (first 32 bytes) as the private key
    const seed = keyPair.privateKey.slice(0, 32);
    return {
      publicKey: publicKeyToHex(keyPair.publicKey),
      privateKey: bytesToHex(seed),
    };
  }

  // Key conversion methods

  /**
   * Convert public key to hex string.
   */
  public publicKeyToHex(publicKey: Uint8Array): string {
    this.ensureReady();
    return publicKeyToHex(publicKey);
  }

  /**
   * Convert hex string to public key.
   */
  public hexToPublicKey(hex: string): Uint8Array {
    this.ensureReady();
    return hexToPublicKey(hex);
  }

  /**
   * Convert bytes to hex.
   */
  public bytesToHex(bytes: Uint8Array): string {
    this.ensureReady();
    return bytesToHex(bytes);
  }

  /**
   * Convert hex to bytes.
   */
  public hexToBytes(hex: string): Uint8Array {
    this.ensureReady();
    return hexToBytes(hex);
  }

  /**
   * Derive shared secret using X25519.
   */
  public deriveSharedSecret(
    ourPrivateKey: Uint8Array,
    theirPublicKey: Uint8Array
  ): Uint8Array {
    this.ensureReady();
    return deriveSharedSecret(ourPrivateKey, theirPublicKey);
  }

  /**
   * Convert Ed25519 public key to X25519.
   */
  public ed25519PublicKeyToX25519(ed25519PublicKey: Uint8Array): Uint8Array {
    this.ensureReady();
    return ed25519PublicKeyToX25519(ed25519PublicKey);
  }

  /**
   * Convert Ed25519 private key to X25519.
   */
  public ed25519PrivateKeyToX25519(ed25519PrivateKey: Uint8Array): Uint8Array {
    this.ensureReady();
    return ed25519PrivateKeyToX25519(ed25519PrivateKey);
  }

  // Encryption methods

  /**
   * Encrypt data with ChaCha20-Poly1305.
   */
  public encrypt(
    data: Uint8Array,
    key: Uint8Array,
    nonce?: Uint8Array
  ): EncryptedData {
    this.ensureReady();
    return encryptChaCha20Poly1305(data, key, nonce);
  }

  /**
   * Decrypt data with ChaCha20-Poly1305.
   */
  public decrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce: Uint8Array
  ): Uint8Array {
    this.ensureReady();
    return decryptChaCha20Poly1305(ciphertext, key, nonce);
  }

  /**
   * Generate a random nonce.
   */
  public generateNonce(): Uint8Array {
    this.ensureReady();
    return generateNonce();
  }

  /**
   * Generate a random encryption key.
   */
  public generateKey(): Uint8Array {
    this.ensureReady();
    return generateKey();
  }

  /**
   * Encrypt and combine nonce + ciphertext.
   */
  public encryptCombined(data: Uint8Array, key: Uint8Array): Uint8Array {
    this.ensureReady();
    return encryptCombined(data, key);
  }

  /**
   * Decrypt combined nonce + ciphertext.
   */
  public decryptCombined(combined: Uint8Array, key: Uint8Array): Uint8Array {
    this.ensureReady();
    return decryptCombined(combined, key);
  }

  /**
   * Encrypt a string.
   */
  public encryptString(text: string, key: Uint8Array): string {
    this.ensureReady();
    return encryptString(text, key);
  }

  /**
   * Decrypt a string.
   */
  public decryptString(encoded: string, key: Uint8Array): string {
    this.ensureReady();
    return decryptString(encoded, key);
  }

  // Signing methods

  /**
   * Sign a message.
   */
  public sign(message: Uint8Array, privateKey: Uint8Array): Signature {
    this.ensureReady();
    return sign(message, privateKey);
  }

  /**
   * Verify a signature.
   */
  public verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): boolean {
    this.ensureReady();
    return verify(message, signature, publicKey);
  }

  /**
   * Sign a string message.
   */
  public signString(message: string, privateKey: Uint8Array): Signature {
    this.ensureReady();
    return signString(message, privateKey);
  }

  /**
   * Verify a string signature.
   */
  public verifyString(
    message: string,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): boolean {
    this.ensureReady();
    return verifyString(message, signature, publicKey);
  }

  /**
   * Sign and return hex.
   */
  public signToHex(message: Uint8Array, privateKey: Uint8Array): string {
    this.ensureReady();
    return signToHex(message, privateKey);
  }

  /**
   * Verify hex signature.
   */
  public verifyHex(
    message: Uint8Array,
    signatureHex: string,
    publicKey: Uint8Array
  ): boolean {
    this.ensureReady();
    return verifyHex(message, signatureHex, publicKey);
  }

  // Hashing methods

  /**
   * Compute SHA-256 hash.
   */
  public sha256(data: Uint8Array): Uint8Array {
    this.ensureReady();
    return sha256(data);
  }

  /**
   * Compute SHA-256 hash of string.
   */
  public sha256String(data: string): Uint8Array {
    this.ensureReady();
    return sha256String(data);
  }

  /**
   * Compute SHA-256 hash and return hex.
   */
  public sha256Hex(data: Uint8Array): string {
    this.ensureReady();
    return sha256Hex(data);
  }

  /**
   * Compute SHA-256 hash of string and return hex.
   */
  public sha256StringHex(data: string): string {
    this.ensureReady();
    return sha256StringHex(data);
  }

  /**
   * Generate public key fingerprint.
   */
  public fingerprint(publicKey: Uint8Array): PublicKeyFingerprint {
    this.ensureReady();
    return fingerprint(publicKey);
  }

  /**
   * Generate short fingerprint string.
   */
  public shortFingerprint(publicKey: Uint8Array): string {
    this.ensureReady();
    return shortFingerprint(publicKey);
  }

  /**
   * Compute BLAKE2b hash.
   */
  public blake2b(data: Uint8Array, outputLength?: number): Uint8Array {
    this.ensureReady();
    return blake2b(data, outputLength);
  }

  /**
   * Compute BLAKE2b keyed hash.
   */
  public blake2bKeyed(
    data: Uint8Array,
    key: Uint8Array,
    outputLength?: number
  ): Uint8Array {
    this.ensureReady();
    return blake2bKeyed(data, key, outputLength);
  }

  /**
   * Generate random ID bytes.
   */
  public generateRandomId(length?: number): Uint8Array {
    this.ensureReady();
    return generateRandomId(length);
  }

  /**
   * Generate random hex ID.
   */
  public generateRandomIdHex(byteLength?: number): string {
    this.ensureReady();
    return generateRandomIdHex(byteLength);
  }

  // Utility methods

  /**
   * Compare two byte arrays in constant time.
   */
  public constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    this.ensureReady();
    return constantTimeEqual(a, b);
  }

  /**
   * Securely wipe a byte array.
   */
  public secureWipe(bytes: Uint8Array): void {
    this.ensureReady();
    secureWipe(bytes);
  }
}

// Default export is the singleton getter
export default CryptoService;
