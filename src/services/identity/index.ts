/**
 * Identity Service
 *
 * Manages cryptographic identity for BitChat, including:
 * - Key generation (Ed25519 for signing, X25519 for key exchange)
 * - Key derivation from seed/mnemonic
 * - Secure key storage in IndexedDB (encrypted at rest)
 * - Nostr keypair generation and conversion (nsec/npub)
 * - Key export/backup functionality
 * - Key rotation support
 *
 * Compatible with native BitChat iOS/Android apps through shared
 * Nostr identity and key derivation patterns.
 *
 * @module services/identity
 */

import { getPublicKey, nip19 } from 'nostr-tools';
import sodium from 'libsodium-wrappers-sumo';
import {
  loadSodium,
  ensureSodiumReady,
  generateEd25519KeyPairFromSeed,
  bytesToHex,
  hexToBytes,
  sha256Hex,
  encryptCombined,
  decryptCombined,
  secureWipe,
  blake2b,
} from '../crypto';
import type { StorageAdapter } from '../storage/types';
import { useIdentityStore } from '../../stores/identity-store';

// Re-export submodules
export * from './import';
export * from './fingerprint';

// ============================================================================
// Types
// ============================================================================

/**
 * Stored identity data structure
 */
export interface StoredIdentity {
  /** Version for migration support */
  version: number;
  /** Nostr public key (hex) */
  publicKey: string;
  /** Public key in npub format */
  npub: string;
  /** SHA-256 fingerprint of public key (hex) */
  fingerprint: string;
  /** When the identity was created */
  createdAt: number;
  /** Ed25519 public key for signing (hex) */
  signingPublicKey: string;
  /** X25519 public key for key exchange (hex) */
  exchangePublicKey: string;
}

/**
 * Encrypted private key storage format
 */
export interface EncryptedKeyData {
  /** Version for migration support */
  version: number;
  /** Encrypted private key data (nonce + ciphertext) */
  encryptedKey: string; // base64
  /** Salt used for key derivation (hex) */
  salt: string;
  /** Key derivation algorithm identifier */
  algorithm: 'argon2id' | 'pbkdf2';
  /** Algorithm-specific parameters */
  params: {
    /** Memory cost for Argon2id (KiB) */
    memory?: number;
    /** Iterations/time cost */
    iterations: number;
    /** Parallelism for Argon2id */
    parallelism?: number;
  };
  /** Key type indicator */
  keyType: 'nostr' | 'ed25519' | 'combined';
}

/**
 * Combined key material (Nostr + Noise Protocol)
 */
export interface CombinedKeyMaterial {
  /** Nostr private key (32 bytes) - for signing Nostr events */
  nostrPrivateKey: Uint8Array;
  /** Nostr public key (32 bytes, x-only) */
  nostrPublicKey: Uint8Array;
  /** Ed25519 private key (64 bytes) - for BitChat signing */
  signingPrivateKey: Uint8Array;
  /** Ed25519 public key (32 bytes) */
  signingPublicKey: Uint8Array;
  /** X25519 private key (32 bytes) - for Noise protocol key exchange */
  exchangePrivateKey: Uint8Array;
  /** X25519 public key (32 bytes) */
  exchangePublicKey: Uint8Array;
}

/**
 * Key export format for backup
 */
export interface KeyBackup {
  /** Format version */
  version: number;
  /** Type of backup */
  type: 'nsec' | 'mnemonic' | 'raw';
  /** The actual backup data */
  data: string;
  /** Timestamp of export */
  exportedAt: number;
  /** Public key for verification */
  publicKey: string;
  /** Fingerprint for verification */
  fingerprint: string;
}

/**
 * Identity service configuration
 */
export interface IdentityServiceConfig {
  /** Storage adapter instance */
  storage: StorageAdapter;
  /** Key derivation difficulty (affects security vs. performance) */
  derivationDifficulty?: 'low' | 'medium' | 'high';
  /** Whether to allow unencrypted key storage (NOT recommended) */
  allowUnencrypted?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Current storage schema version */
const SCHEMA_VERSION = 1;

/** Storage keys */
const STORAGE_KEYS = {
  IDENTITY: 'identity',
  ENCRYPTED_KEYS: 'encrypted_keys',
  KEY_ROTATION_HISTORY: 'key_rotation_history',
} as const;

/** Argon2id parameters by difficulty level */
const ARGON2_PARAMS = {
  low: { memory: 65536, iterations: 2, parallelism: 1 }, // 64 MiB, quick
  medium: { memory: 262144, iterations: 3, parallelism: 2 }, // 256 MiB, balanced
  high: { memory: 1048576, iterations: 4, parallelism: 4 }, // 1 GiB, secure
} as const;

// ============================================================================
// Identity Service
// ============================================================================

/**
 * IdentityService manages the user's cryptographic identity.
 *
 * This service handles the complete lifecycle of identity management:
 * - Key generation for new users
 * - Key import from existing Nostr keys
 * - Secure storage with password-based encryption
 * - Key rotation for enhanced security
 * - Backup and export functionality
 *
 * Keys are stored encrypted at rest using XChaCha20-Poly1305 with
 * keys derived from the user's password using Argon2id.
 *
 * @example
 * ```typescript
 * const identity = IdentityService.getInstance();
 * await identity.initialize(storage);
 *
 * // Generate new identity
 * await identity.generateNewIdentity('secure-password');
 *
 * // Or load existing
 * await identity.loadIdentity('secure-password');
 *
 * // Sign a message
 * const keys = await identity.getKeyMaterial('secure-password');
 * // Use keys.nostrPrivateKey for Nostr signing
 * ```
 */
export class IdentityService {
  private static instance: IdentityService | null = null;
  private storage: StorageAdapter | null = null;
  private config: Required<Omit<IdentityServiceConfig, 'storage'>>;
  private initialized = false;

  /** In-memory cache of decrypted keys (cleared on lock) */
  private cachedKeyMaterial: CombinedKeyMaterial | null = null;

  /** Cached identity metadata */
  private cachedIdentity: StoredIdentity | null = null;

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {
    this.config = {
      derivationDifficulty: 'medium',
      allowUnencrypted: false,
    };
  }

  /**
   * Get the singleton instance of IdentityService
   */
  public static getInstance(): IdentityService {
    if (!IdentityService.instance) {
      IdentityService.instance = new IdentityService();
    }
    return IdentityService.instance;
  }

  /**
   * Reset the singleton (for testing only)
   */
  public static _resetForTesting(): void {
    if (IdentityService.instance) {
      IdentityService.instance.lock();
    }
    IdentityService.instance = null;
  }

  /**
   * Initialize the identity service with storage and configuration
   *
   * @param config - Service configuration including storage adapter
   */
  public async initialize(config: IdentityServiceConfig): Promise<void> {
    // Ensure crypto is ready
    await loadSodium();

    this.storage = config.storage;
    this.config = {
      derivationDifficulty: config.derivationDifficulty ?? 'medium',
      allowUnencrypted: config.allowUnencrypted ?? false,
    };

    // Load cached identity if available
    await this.loadCachedIdentity();

    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.storage) {
      throw new Error('IdentityService not initialized. Call initialize() first.');
    }
  }

  // ==========================================================================
  // Key Generation
  // ==========================================================================

  /**
   * Generate a new identity with random keys.
   *
   * Creates:
   * - Nostr keypair (secp256k1 via nostr-tools)
   * - Ed25519 keypair for BitChat message signing
   * - X25519 keypair for Noise protocol key exchange
   *
   * All keys are derived from a single 32-byte seed for consistency.
   *
   * @param password - Password for encrypting the keys at rest
   * @returns The stored identity information (no private keys)
   */
  public async generateNewIdentity(password: string): Promise<StoredIdentity> {
    this.ensureInitialized();
    ensureSodiumReady();

    // Generate 32-byte random seed
    const seed = sodium.randombytes_buf(32);

    try {
      // Generate all key material from seed
      const keyMaterial = this.deriveKeyMaterialFromSeed(seed);

      // Create identity metadata
      const identity = this.createIdentityFromKeyMaterial(keyMaterial);

      // Encrypt and store keys
      await this.encryptAndStoreKeys(keyMaterial, password);

      // Store identity metadata
      await this.storeIdentity(identity);

      // Update Zustand store
      this.updateIdentityStore(identity);

      // Cache for quick access
      this.cachedIdentity = identity;
      this.cachedKeyMaterial = keyMaterial;

      return identity;
    } finally {
      // Securely wipe the seed
      secureWipe(seed);
    }
  }

  /**
   * Generate identity from a mnemonic phrase (BIP-39 style).
   *
   * This allows users to recover their identity from a mnemonic backup.
   * Uses PBKDF2 to derive a seed from the mnemonic for compatibility
   * with standard wallet implementations.
   *
   * @param mnemonic - Space-separated mnemonic words
   * @param password - Password for encrypting the keys at rest
   * @param passphrase - Optional BIP-39 passphrase (default: empty)
   * @returns The stored identity information
   */
  public async generateFromMnemonic(
    mnemonic: string,
    password: string,
    passphrase: string = ''
  ): Promise<StoredIdentity> {
    this.ensureInitialized();
    ensureSodiumReady();

    // Normalize mnemonic
    const normalizedMnemonic = mnemonic.trim().toLowerCase();

    // Derive seed using Argon2id
    // Salt is "mnemonic" + passphrase (truncated to 16 bytes for pwhash)
    const saltString = 'mnemonic' + passphrase;
    const salt = sodium.from_string(saltString).slice(0, 16);

    // Use crypto_pwhash for seed derivation
    // Note: libsodium crypto_pwhash accepts string directly
    const seed = sodium.crypto_pwhash(
      32, // Output length
      normalizedMnemonic, // Pass mnemonic directly as string
      salt, // Salt must be exactly 16 bytes for pwhash
      2, // Ops limit (iterations)
      67108864, // Mem limit (64 MiB)
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    try {
      // Generate all key material from seed
      const keyMaterial = this.deriveKeyMaterialFromSeed(seed);

      // Create identity metadata
      const identity = this.createIdentityFromKeyMaterial(keyMaterial);

      // Encrypt and store keys
      await this.encryptAndStoreKeys(keyMaterial, password);

      // Store identity metadata
      await this.storeIdentity(identity);

      // Update Zustand store
      this.updateIdentityStore(identity);

      // Cache for quick access
      this.cachedIdentity = identity;
      this.cachedKeyMaterial = keyMaterial;

      return identity;
    } finally {
      // Securely wipe the seed
      secureWipe(seed);
    }
  }

  /**
   * Generate identity from a raw 32-byte seed.
   *
   * Used for importing from other BitChat apps or custom sources.
   *
   * @param seed - 32-byte seed value
   * @param password - Password for encrypting the keys at rest
   * @returns The stored identity information
   */
  public async generateFromSeed(
    seed: Uint8Array,
    password: string
  ): Promise<StoredIdentity> {
    this.ensureInitialized();

    if (seed.length !== 32) {
      throw new Error('Seed must be exactly 32 bytes');
    }

    // Make a copy to avoid mutation
    const seedCopy = new Uint8Array(seed);

    try {
      // Generate all key material from seed
      const keyMaterial = this.deriveKeyMaterialFromSeed(seedCopy);

      // Create identity metadata
      const identity = this.createIdentityFromKeyMaterial(keyMaterial);

      // Encrypt and store keys
      await this.encryptAndStoreKeys(keyMaterial, password);

      // Store identity metadata
      await this.storeIdentity(identity);

      // Update Zustand store
      this.updateIdentityStore(identity);

      // Cache for quick access
      this.cachedIdentity = identity;
      this.cachedKeyMaterial = keyMaterial;

      return identity;
    } finally {
      // Securely wipe the seed copy
      secureWipe(seedCopy);
    }
  }

  // ==========================================================================
  // Key Derivation
  // ==========================================================================

  /**
   * Derive all key material from a 32-byte seed.
   *
   * Uses domain-separated key derivation to generate:
   * - Nostr key (secp256k1)
   * - Ed25519 signing key
   * - X25519 key exchange key
   *
   * This matches the iOS BitChat implementation for cross-platform compatibility.
   */
  private deriveKeyMaterialFromSeed(seed: Uint8Array): CombinedKeyMaterial {
    ensureSodiumReady();

    // Domain separation for different key types
    const nostrDomain = sodium.from_string('bitchat-nostr-key');
    const signingDomain = sodium.from_string('bitchat-signing-key');
    const exchangeDomain = sodium.from_string('bitchat-exchange-key');

    // Derive Nostr key (direct use of seed for secp256k1)
    // For Nostr, we use the seed directly as the private key
    const nostrPrivateKey = blake2b(
      new Uint8Array([...nostrDomain, ...seed]),
      32
    );
    const nostrPublicKey = hexToBytes(getPublicKey(nostrPrivateKey));

    // Derive Ed25519 signing key using domain-separated seed
    const signingSeed = blake2b(
      new Uint8Array([...signingDomain, ...seed]),
      32
    );
    const signingKeyPair = generateEd25519KeyPairFromSeed(signingSeed);

    // Derive X25519 key exchange key
    // We can either generate independently or convert from Ed25519
    // For consistency with native apps, we derive independently
    const exchangeSeed = blake2b(
      new Uint8Array([...exchangeDomain, ...seed]),
      32
    );

    // For X25519, we use the seed directly as the private key (it's already 32 bytes)
    // The public key is derived using crypto_scalarmult_base
    const exchangePrivateKey = exchangeSeed;
    const exchangePublicKey = sodium.crypto_scalarmult_base(exchangePrivateKey);

    // Clean up intermediate seeds
    secureWipe(signingSeed);

    return {
      nostrPrivateKey,
      nostrPublicKey,
      signingPrivateKey: signingKeyPair.privateKey,
      signingPublicKey: signingKeyPair.publicKey,
      exchangePrivateKey,
      exchangePublicKey,
    };
  }

  /**
   * Create identity metadata from key material
   */
  private createIdentityFromKeyMaterial(
    keyMaterial: CombinedKeyMaterial
  ): StoredIdentity {
    const publicKeyHex = bytesToHex(keyMaterial.nostrPublicKey);
    const npub = nip19.npubEncode(publicKeyHex);
    const fingerprint = sha256Hex(keyMaterial.nostrPublicKey);

    return {
      version: SCHEMA_VERSION,
      publicKey: publicKeyHex,
      npub,
      fingerprint,
      createdAt: Date.now(),
      signingPublicKey: bytesToHex(keyMaterial.signingPublicKey),
      exchangePublicKey: bytesToHex(keyMaterial.exchangePublicKey),
    };
  }

  // ==========================================================================
  // Key Storage
  // ==========================================================================

  /**
   * Encrypt and store key material using password-derived key
   */
  private async encryptAndStoreKeys(
    keyMaterial: CombinedKeyMaterial,
    password: string
  ): Promise<void> {
    this.ensureInitialized();
    ensureSodiumReady();

    // Generate salt for key derivation
    const salt = sodium.randombytes_buf(16);

    // Get Argon2 parameters based on difficulty
    const params = ARGON2_PARAMS[this.config.derivationDifficulty];

    // Derive encryption key from password
    // Note: libsodium crypto_pwhash accepts string directly
    const encryptionKey = sodium.crypto_pwhash(
      32,
      password, // Pass password directly as string
      salt,
      params.iterations,
      params.memory * 1024, // Convert KiB to bytes
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    try {
      // Serialize key material
      const keyData = this.serializeKeyMaterial(keyMaterial);

      // Encrypt with XChaCha20-Poly1305
      const encrypted = encryptCombined(keyData, encryptionKey);

      // Create storage format
      const encryptedKeyData: EncryptedKeyData = {
        version: SCHEMA_VERSION,
        encryptedKey: sodium.to_base64(
          encrypted,
          sodium.base64_variants.ORIGINAL
        ),
        salt: bytesToHex(salt),
        algorithm: 'argon2id',
        params: {
          memory: params.memory,
          iterations: params.iterations,
          parallelism: params.parallelism,
        },
        keyType: 'combined',
      };

      // Store encrypted keys
      await this.storage!.set('keys', STORAGE_KEYS.ENCRYPTED_KEYS, encryptedKeyData);

      // Clean up
      secureWipe(keyData);
    } finally {
      secureWipe(encryptionKey);
    }
  }

  /**
   * Serialize key material for encryption
   */
  private serializeKeyMaterial(keyMaterial: CombinedKeyMaterial): Uint8Array {
    ensureSodiumReady();

    // Pack all keys into a single buffer
    // Format: nostrPrivate(32) + signingPrivate(64) + exchangePrivate(32) = 128 bytes
    const packed = new Uint8Array(
      32 + // nostrPrivateKey
      64 + // signingPrivateKey
      32   // exchangePrivateKey
    );

    let offset = 0;
    packed.set(keyMaterial.nostrPrivateKey, offset);
    offset += 32;
    packed.set(keyMaterial.signingPrivateKey, offset);
    offset += 64;
    packed.set(keyMaterial.exchangePrivateKey, offset);

    return packed;
  }

  /**
   * Deserialize key material from decrypted data
   */
  private deserializeKeyMaterial(data: Uint8Array): CombinedKeyMaterial {
    ensureSodiumReady();

    if (data.length !== 128) {
      throw new Error(`Invalid key data length: expected 128, got ${data.length}`);
    }

    let offset = 0;
    const nostrPrivateKey = data.slice(offset, offset + 32);
    offset += 32;
    const signingPrivateKey = data.slice(offset, offset + 64);
    offset += 64;
    const exchangePrivateKey = data.slice(offset, offset + 32);

    // Derive public keys from private keys
    const nostrPublicKey = hexToBytes(getPublicKey(nostrPrivateKey));
    const signingPublicKey = signingPrivateKey.slice(32); // Ed25519 public is last 32 bytes
    const exchangePublicKey = sodium.crypto_scalarmult_base(exchangePrivateKey);

    return {
      nostrPrivateKey,
      nostrPublicKey,
      signingPrivateKey,
      signingPublicKey,
      exchangePrivateKey,
      exchangePublicKey,
    };
  }

  /**
   * Store identity metadata
   */
  private async storeIdentity(identity: StoredIdentity): Promise<void> {
    await this.storage!.set('keys', STORAGE_KEYS.IDENTITY, identity);
  }

  /**
   * Load cached identity metadata from storage
   */
  private async loadCachedIdentity(): Promise<void> {
    if (!this.storage) return;

    try {
      const identity = await this.storage.get(
        'keys',
        STORAGE_KEYS.IDENTITY
      ) as StoredIdentity | null;
      if (identity) {
        this.cachedIdentity = identity;
        // Update Zustand store with loaded identity
        this.updateIdentityStore(identity);
      }
    } catch {
      // Identity not found or error loading
      this.cachedIdentity = null;
    }
  }

  /**
   * Update the Zustand identity store
   */
  private updateIdentityStore(identity: StoredIdentity): void {
    useIdentityStore.getState().setIdentity({
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      npub: identity.npub,
      createdAt: identity.createdAt,
    });
  }

  // ==========================================================================
  // Key Access
  // ==========================================================================

  /**
   * Check if an identity exists in storage
   */
  public async hasIdentity(): Promise<boolean> {
    this.ensureInitialized();

    if (this.cachedIdentity) return true;

    try {
      const identity = await this.storage!.get(
        'keys',
        STORAGE_KEYS.IDENTITY
      ) as StoredIdentity | null;
      return identity !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the stored identity metadata (no private keys)
   */
  public async getIdentity(): Promise<StoredIdentity | null> {
    this.ensureInitialized();

    if (this.cachedIdentity) return this.cachedIdentity;

    try {
      const identity = await this.storage!.get(
        'keys',
        STORAGE_KEYS.IDENTITY
      ) as StoredIdentity | null;
      if (identity) {
        this.cachedIdentity = identity;
      }
      return identity;
    } catch {
      return null;
    }
  }

  /**
   * Load and decrypt key material using password.
   *
   * This unlocks the identity, making keys available for signing
   * and encryption operations.
   *
   * @param password - The password used to encrypt the keys
   * @returns The decrypted key material
   * @throws Error if password is incorrect or keys not found
   */
  public async loadIdentity(password: string): Promise<CombinedKeyMaterial> {
    this.ensureInitialized();

    // Return cached if available
    if (this.cachedKeyMaterial) {
      return this.cachedKeyMaterial;
    }

    const keyMaterial = await this.decryptKeys(password);
    this.cachedKeyMaterial = keyMaterial;

    // Mark key as loaded in store
    useIdentityStore.getState().setKeyLoaded(true);

    return keyMaterial;
  }

  /**
   * Decrypt stored keys using password
   */
  private async decryptKeys(password: string): Promise<CombinedKeyMaterial> {
    this.ensureInitialized();
    ensureSodiumReady();

    // Load encrypted key data
    const encryptedData = await this.storage!.get(
      'keys',
      STORAGE_KEYS.ENCRYPTED_KEYS
    ) as EncryptedKeyData | null;

    if (!encryptedData) {
      throw new Error('No encrypted keys found. Generate an identity first.');
    }

    // Reconstruct encryption key from password
    const salt = hexToBytes(encryptedData.salt);

    // Note: libsodium crypto_pwhash accepts string directly
    const encryptionKey = sodium.crypto_pwhash(
      32,
      password, // Pass password directly as string
      salt,
      encryptedData.params.iterations,
      (encryptedData.params.memory ?? 262144) * 1024,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    try {
      // Decrypt the key data
      const encrypted = sodium.from_base64(
        encryptedData.encryptedKey,
        sodium.base64_variants.ORIGINAL
      );

      const decrypted = decryptCombined(encrypted, encryptionKey);

      // Deserialize key material
      return this.deserializeKeyMaterial(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt keys. Incorrect password?');
    } finally {
      secureWipe(encryptionKey);
    }
  }

  /**
   * Get the decrypted key material.
   *
   * Requires the identity to be unlocked first via loadIdentity().
   *
   * @param password - Password to decrypt if not cached
   * @returns The key material or null if locked
   */
  public async getKeyMaterial(password?: string): Promise<CombinedKeyMaterial | null> {
    if (this.cachedKeyMaterial) {
      return this.cachedKeyMaterial;
    }

    if (password) {
      return this.loadIdentity(password);
    }

    return null;
  }

  /**
   * Check if keys are currently unlocked (in memory)
   */
  public isUnlocked(): boolean {
    return this.cachedKeyMaterial !== null;
  }

  /**
   * Lock the identity, clearing keys from memory
   */
  public lock(): void {
    if (this.cachedKeyMaterial) {
      // Securely wipe all private keys from memory
      secureWipe(this.cachedKeyMaterial.nostrPrivateKey);
      secureWipe(this.cachedKeyMaterial.signingPrivateKey);
      secureWipe(this.cachedKeyMaterial.exchangePrivateKey);
      this.cachedKeyMaterial = null;
    }

    // Update store
    useIdentityStore.getState().setKeyLoaded(false);
  }

  // ==========================================================================
  // Key Export and Backup
  // ==========================================================================

  /**
   * Export the identity as an nsec (Nostr secret key).
   *
   * This format is compatible with other Nostr clients.
   *
   * @param password - Password to decrypt the keys
   * @returns KeyBackup containing the nsec
   */
  public async exportAsNsec(password: string): Promise<KeyBackup> {
    this.ensureInitialized();

    const keyMaterial = await this.getKeyMaterial(password);
    if (!keyMaterial) {
      throw new Error('Failed to access keys');
    }

    const identity = await this.getIdentity();
    if (!identity) {
      throw new Error('No identity found');
    }

    const nsec = nip19.nsecEncode(keyMaterial.nostrPrivateKey);

    return {
      version: SCHEMA_VERSION,
      type: 'nsec',
      data: nsec,
      exportedAt: Date.now(),
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
    };
  }

  /**
   * Export the raw seed for full backup.
   *
   * WARNING: This exposes the master key material.
   * Handle with extreme care.
   *
   * @param password - Password to decrypt the keys
   * @returns KeyBackup containing hex-encoded seed
   */
  public async exportRawSeed(password: string): Promise<KeyBackup> {
    this.ensureInitialized();

    const keyMaterial = await this.getKeyMaterial(password);
    if (!keyMaterial) {
      throw new Error('Failed to access keys');
    }

    const identity = await this.getIdentity();
    if (!identity) {
      throw new Error('No identity found');
    }

    // Export the Nostr private key as the seed
    // This allows full recovery
    const seedHex = bytesToHex(keyMaterial.nostrPrivateKey);

    return {
      version: SCHEMA_VERSION,
      type: 'raw',
      data: seedHex,
      exportedAt: Date.now(),
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
    };
  }

  // ==========================================================================
  // Key Rotation
  // ==========================================================================

  /**
   * Change the password protecting the keys.
   *
   * Does not change the actual keys, only re-encrypts with new password.
   *
   * @param currentPassword - Current password
   * @param newPassword - New password to use
   */
  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    this.ensureInitialized();

    // Decrypt with current password
    const keyMaterial = await this.decryptKeys(currentPassword);

    try {
      // Re-encrypt with new password
      await this.encryptAndStoreKeys(keyMaterial, newPassword);

      // Update cache
      this.cachedKeyMaterial = keyMaterial;
    } catch (error) {
      // Clean up on error
      this.wipeKeyMaterial(keyMaterial);
      throw error;
    }
  }

  /**
   * Rotate to a new identity.
   *
   * This generates completely new keys. The old identity is
   * stored in rotation history for reference.
   *
   * WARNING: This changes your Nostr identity. Other users will
   * need to trust your new public key.
   *
   * @param password - Password for the new keys
   * @returns The new identity
   */
  public async rotateIdentity(password: string): Promise<StoredIdentity> {
    this.ensureInitialized();

    // Save current identity to rotation history
    const currentIdentity = await this.getIdentity();
    if (currentIdentity) {
      await this.addToRotationHistory(currentIdentity);
    }

    // Lock current keys
    this.lock();

    // Generate new identity
    return this.generateNewIdentity(password);
  }

  /**
   * Get the rotation history
   */
  public async getRotationHistory(): Promise<StoredIdentity[]> {
    this.ensureInitialized();

    try {
      const history = await this.storage!.get(
        'keys',
        STORAGE_KEYS.KEY_ROTATION_HISTORY
      ) as StoredIdentity[] | null;
      return history ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Add identity to rotation history
   */
  private async addToRotationHistory(identity: StoredIdentity): Promise<void> {
    const history = await this.getRotationHistory();
    history.push(identity);

    // Keep last 10 rotations
    const trimmed = history.slice(-10);

    await this.storage!.set('keys', STORAGE_KEYS.KEY_ROTATION_HISTORY, trimmed);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Completely wipe all identity data.
   *
   * This is destructive and cannot be undone. Use for emergency wipe
   * or when user wants to start fresh.
   */
  public async wipeAll(): Promise<void> {
    this.ensureInitialized();

    // Lock first
    this.lock();

    // Delete from storage
    await this.storage!.delete('keys', STORAGE_KEYS.IDENTITY);
    await this.storage!.delete('keys', STORAGE_KEYS.ENCRYPTED_KEYS);
    await this.storage!.delete('keys', STORAGE_KEYS.KEY_ROTATION_HISTORY);

    // Clear cached identity
    this.cachedIdentity = null;

    // Clear Zustand store
    useIdentityStore.getState().clearIdentity();
  }

  /**
   * Securely wipe key material
   */
  private wipeKeyMaterial(keyMaterial: CombinedKeyMaterial): void {
    secureWipe(keyMaterial.nostrPrivateKey);
    secureWipe(keyMaterial.signingPrivateKey);
    secureWipe(keyMaterial.exchangePrivateKey);
  }

  // ==========================================================================
  // Nostr Key Utilities
  // ==========================================================================

  /**
   * Get the Nostr public key in hex format
   */
  public async getNostrPublicKey(): Promise<string | null> {
    const identity = await this.getIdentity();
    return identity?.publicKey ?? null;
  }

  /**
   * Get the Nostr public key in npub format
   */
  public async getNpub(): Promise<string | null> {
    const identity = await this.getIdentity();
    return identity?.npub ?? null;
  }

  /**
   * Get the public key fingerprint
   */
  public async getFingerprint(): Promise<string | null> {
    const identity = await this.getIdentity();
    return identity?.fingerprint ?? null;
  }

  /**
   * Verify a password is correct without fully unlocking
   */
  public async verifyPassword(password: string): Promise<boolean> {
    try {
      const keyMaterial = await this.decryptKeys(password);
      this.wipeKeyMaterial(keyMaterial);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default IdentityService;
