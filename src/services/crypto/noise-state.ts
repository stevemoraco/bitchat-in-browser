/**
 * Noise Protocol State Machine
 *
 * Manages handshake state for Noise Protocol XX pattern.
 * Compatible with iOS BitChat Noise implementation.
 */

import { getSodium, ensureSodiumReady } from './init';
import { CryptoConstants } from './types';

// MARK: - Constants

/** Noise protocol constants */
export const NoiseConstants = {
  /** Public key size in bytes */
  DH_LEN: 32,
  /** SHA-256 hash size in bytes */
  HASH_LEN: 32,
  /** ChaCha20-Poly1305 key size in bytes */
  KEY_LEN: 32,
  /** ChaCha20-Poly1305 nonce size in bytes */
  NONCE_LEN: 12,
  /** Poly1305 authentication tag size in bytes */
  TAG_LEN: 16,
  /** Nonce size in bytes for transport messages (4 bytes, big-endian) */
  TRANSPORT_NONCE_SIZE: 4,
  /** Replay window size in messages */
  REPLAY_WINDOW_SIZE: 1024,
  /** Maximum nonce value before requiring rekeying */
  MAX_NONCE: 0xFFFFFFFF,
  /** High nonce warning threshold */
  HIGH_NONCE_WARNING: 1_000_000_000,
} as const;

// MARK: - Types

/**
 * Noise handshake patterns.
 * Each pattern provides different security properties.
 */
export enum NoisePattern {
  /** Most versatile, mutual authentication with identity hiding */
  XX = 'XX',
  /** Initiator knows responder's static key */
  IK = 'IK',
  /** Anonymous initiator */
  NK = 'NK',
}

/**
 * Role in the Noise handshake.
 */
export enum NoiseRole {
  /** Starts the handshake */
  Initiator = 'initiator',
  /** Responds to the handshake */
  Responder = 'responder',
}

/**
 * Noise session state.
 */
export enum NoiseSessionState {
  /** Session not yet initialized */
  Uninitialized = 'uninitialized',
  /** Handshake in progress */
  Handshaking = 'handshaking',
  /** Session established, can encrypt/decrypt */
  Established = 'established',
}

/**
 * Message pattern tokens.
 */
export enum NoiseToken {
  /** Ephemeral key */
  E = 'e',
  /** Static key */
  S = 's',
  /** DH(ephemeral, ephemeral) */
  EE = 'ee',
  /** DH(ephemeral, static) */
  ES = 'es',
  /** DH(static, ephemeral) */
  SE = 'se',
  /** DH(static, static) */
  SS = 'ss',
}

/**
 * Key pair for Noise protocol (X25519).
 */
export interface NoiseKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Transport cipher state for encryption/decryption.
 */
export interface TransportCiphers {
  /** Cipher for sending messages */
  send: NoiseCipherState;
  /** Cipher for receiving messages */
  receive: NoiseCipherState;
}

// MARK: - Errors

/**
 * Noise protocol errors.
 */
export class NoiseError extends Error {
  constructor(
    message: string,
    public readonly code: NoiseErrorCode
  ) {
    super(message);
    this.name = 'NoiseError';
  }
}

export enum NoiseErrorCode {
  UninitializedCipher = 'UNINITIALIZED_CIPHER',
  InvalidCiphertext = 'INVALID_CIPHERTEXT',
  HandshakeComplete = 'HANDSHAKE_COMPLETE',
  HandshakeNotComplete = 'HANDSHAKE_NOT_COMPLETE',
  MissingLocalStaticKey = 'MISSING_LOCAL_STATIC_KEY',
  MissingKeys = 'MISSING_KEYS',
  InvalidMessage = 'INVALID_MESSAGE',
  AuthenticationFailure = 'AUTHENTICATION_FAILURE',
  InvalidPublicKey = 'INVALID_PUBLIC_KEY',
  ReplayDetected = 'REPLAY_DETECTED',
  NonceExceeded = 'NONCE_EXCEEDED',
  InvalidState = 'INVALID_STATE',
  NotEstablished = 'NOT_ESTABLISHED',
}

// MARK: - Message Patterns

/**
 * Get message patterns for a given Noise pattern.
 */
export function getMessagePatterns(pattern: NoisePattern): NoiseToken[][] {
  switch (pattern) {
    case NoisePattern.XX:
      return [
        [NoiseToken.E], // -> e
        [NoiseToken.E, NoiseToken.EE, NoiseToken.S, NoiseToken.ES], // <- e, ee, s, es
        [NoiseToken.S, NoiseToken.SE], // -> s, se
      ];
    case NoisePattern.IK:
      return [
        [NoiseToken.E, NoiseToken.ES, NoiseToken.S, NoiseToken.SS], // -> e, es, s, ss
        [NoiseToken.E, NoiseToken.EE, NoiseToken.SE], // <- e, ee, se
      ];
    case NoisePattern.NK:
      return [
        [NoiseToken.E, NoiseToken.ES], // -> e, es
        [NoiseToken.E, NoiseToken.EE], // <- e, ee
      ];
  }
}

/**
 * Get the full protocol name for a pattern.
 */
export function getProtocolName(pattern: NoisePattern): string {
  return `Noise_${pattern}_25519_ChaChaPoly_SHA256`;
}

// MARK: - Cipher State

/**
 * Manages symmetric encryption state for Noise protocol sessions.
 * Handles ChaCha20-Poly1305 AEAD encryption with automatic nonce management
 * and replay protection using a sliding window algorithm.
 */
export class NoiseCipherState {
  private key: Uint8Array | null = null;
  private nonce: number = 0;
  private useExtractedNonce: boolean;

  // Sliding window replay protection (only used when useExtractedNonce = true)
  private highestReceivedNonce: number = 0;
  private replayWindow: Uint8Array;

  constructor(key?: Uint8Array, useExtractedNonce: boolean = false) {
    this.useExtractedNonce = useExtractedNonce;
    this.replayWindow = new Uint8Array(NoiseConstants.REPLAY_WINDOW_SIZE / 8);
    if (key) {
      this.initializeKey(key);
    }
  }

  /**
   * Initialize the cipher with a key.
   */
  initializeKey(key: Uint8Array): void {
    if (key.length !== NoiseConstants.KEY_LEN) {
      throw new NoiseError(
        `Invalid key length: expected ${NoiseConstants.KEY_LEN}, got ${key.length}`,
        NoiseErrorCode.InvalidCiphertext
      );
    }
    this.key = new Uint8Array(key);
    this.nonce = 0;
  }

  /**
   * Check if the cipher has a key initialized.
   */
  hasKey(): boolean {
    return this.key !== null;
  }

  /**
   * Get the current nonce value.
   */
  getNonce(): number {
    return this.nonce;
  }

  /**
   * Check if a received nonce is valid for replay protection.
   */
  private isValidNonce(receivedNonce: number): boolean {
    if (
      receivedNonce + NoiseConstants.REPLAY_WINDOW_SIZE <=
      this.highestReceivedNonce
    ) {
      return false; // Too old, outside window
    }

    if (receivedNonce > this.highestReceivedNonce) {
      return true; // Always accept newer nonces
    }

    const offset = this.highestReceivedNonce - receivedNonce;
    const byteIndex = Math.floor(offset / 8);
    const bitIndex = offset % 8;

    // Safe access since byteIndex is always within bounds when offset < REPLAY_WINDOW_SIZE
    return ((this.replayWindow[byteIndex] ?? 0) & (1 << bitIndex)) === 0; // Not yet seen
  }

  /**
   * Mark a nonce as seen in the replay window.
   */
  private markNonceAsSeen(receivedNonce: number): void {
    if (receivedNonce > this.highestReceivedNonce) {
      const shift = receivedNonce - this.highestReceivedNonce;

      if (shift >= NoiseConstants.REPLAY_WINDOW_SIZE) {
        // Clear entire window - shift is too large
        this.replayWindow.fill(0);
      } else {
        // Shift window right by `shift` bits
        const windowBytes = this.replayWindow.length;
        for (let i = windowBytes - 1; i >= 0; i--) {
          const sourceByteIndex = i - Math.floor(shift / 8);
          let newByte = 0;

          if (sourceByteIndex >= 0) {
            newByte = (this.replayWindow[sourceByteIndex] ?? 0) >> (shift % 8);
            if (sourceByteIndex > 0 && shift % 8 !== 0) {
              newByte |=
                (this.replayWindow[sourceByteIndex - 1] ?? 0) << (8 - (shift % 8));
            }
          }

          // TypeScript doesn't know replayWindow[i] is always valid here
          (this.replayWindow)[i] = newByte & 0xff;
        }
      }

      this.highestReceivedNonce = receivedNonce;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.replayWindow[0] |= 1; // Mark most recent bit as seen
    } else {
      const offset = this.highestReceivedNonce - receivedNonce;
      const byteIndex = Math.floor(offset / 8);
      const bitIndex = offset % 8;
      // Safe access - byteIndex is within bounds
      if (byteIndex < this.replayWindow.length) {
        this.replayWindow[byteIndex] = (this.replayWindow[byteIndex] ?? 0) | (1 << bitIndex);
      }
    }
  }

  /**
   * Convert nonce to 4-byte big-endian array.
   */
  private nonceToBytes(nonce: number): Uint8Array {
    const bytes = new Uint8Array(NoiseConstants.TRANSPORT_NONCE_SIZE);
    bytes[0] = (nonce >> 24) & 0xff;
    bytes[1] = (nonce >> 16) & 0xff;
    bytes[2] = (nonce >> 8) & 0xff;
    bytes[3] = nonce & 0xff;
    return bytes;
  }

  /**
   * Extract nonce from combined payload.
   */
  private extractNonceFromPayload(
    payload: Uint8Array
  ): { nonce: number; ciphertext: Uint8Array } | null {
    if (payload.length < NoiseConstants.TRANSPORT_NONCE_SIZE) {
      return null;
    }

    // Extract 4-byte nonce (big-endian) - safe since we checked length above
    const nonce =
      ((payload[0] ?? 0) << 24) |
      ((payload[1] ?? 0) << 16) |
      ((payload[2] ?? 0) << 8) |
      (payload[3] ?? 0);

    const ciphertext = payload.slice(NoiseConstants.TRANSPORT_NONCE_SIZE);

    return { nonce, ciphertext };
  }

  /**
   * Create a 12-byte nonce for ChaCha20-Poly1305.
   * Nonce format: 4 bytes zero padding + 8 bytes little-endian counter
   */
  private createChaChaPolyNonce(counter: number): Uint8Array {
    const nonce = new Uint8Array(NoiseConstants.NONCE_LEN);
    // First 4 bytes are zero (padding)
    // Bytes 4-7 are counter in little-endian
    nonce[4] = counter & 0xff;
    nonce[5] = (counter >> 8) & 0xff;
    nonce[6] = (counter >> 16) & 0xff;
    nonce[7] = (counter >> 24) & 0xff;
    // Bytes 8-11 remain zero (high bits of counter)
    return nonce;
  }

  /**
   * Encrypt plaintext with associated data.
   */
  encrypt(plaintext: Uint8Array, associatedData: Uint8Array = new Uint8Array(0)): Uint8Array {
    ensureSodiumReady();
    const sodium = getSodium();

    if (!this.key) {
      throw new NoiseError(
        'Cipher not initialized',
        NoiseErrorCode.UninitializedCipher
      );
    }

    // Check nonce overflow
    if (this.nonce >= NoiseConstants.MAX_NONCE) {
      throw new NoiseError('Nonce exceeded maximum value', NoiseErrorCode.NonceExceeded);
    }

    const currentNonce = this.nonce;
    const chachaPolyNonce = this.createChaChaPolyNonce(currentNonce);

    // Ensure plaintext is a proper Uint8Array (clone if needed)
    const plaintextBytes = new Uint8Array(plaintext);
    const ad = associatedData.length > 0 ? new Uint8Array(associatedData) : null;

    // Encrypt with ChaCha20-Poly1305
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      plaintextBytes,
      ad,
      null, // nsec
      chachaPolyNonce,
      this.key
    );

    // Increment nonce
    this.nonce++;

    // Create combined payload
    if (this.useExtractedNonce) {
      const nonceBytes = this.nonceToBytes(currentNonce);
      const combined = new Uint8Array(nonceBytes.length + ciphertext.length);
      combined.set(nonceBytes, 0);
      combined.set(ciphertext, nonceBytes.length);
      return combined;
    } 
      return ciphertext;
    
  }

  /**
   * Decrypt ciphertext with associated data.
   */
  decrypt(ciphertext: Uint8Array, associatedData: Uint8Array = new Uint8Array(0)): Uint8Array {
    ensureSodiumReady();
    const sodium = getSodium();

    if (!this.key) {
      throw new NoiseError(
        'Cipher not initialized',
        NoiseErrorCode.UninitializedCipher
      );
    }

    if (ciphertext.length < NoiseConstants.TAG_LEN) {
      throw new NoiseError(
        'Ciphertext too short',
        NoiseErrorCode.InvalidCiphertext
      );
    }

    let actualCiphertext: Uint8Array;
    let decryptionNonce: number;

    if (this.useExtractedNonce) {
      // Extract nonce and ciphertext from combined payload
      const extracted = this.extractNonceFromPayload(ciphertext);
      if (!extracted) {
        throw new NoiseError(
          'Could not extract nonce from payload',
          NoiseErrorCode.InvalidCiphertext
        );
      }

      // Validate nonce with sliding window replay protection
      if (!this.isValidNonce(extracted.nonce)) {
        throw new NoiseError(
          `Replay attack detected: nonce ${extracted.nonce} rejected`,
          NoiseErrorCode.ReplayDetected
        );
      }

      actualCiphertext = extracted.ciphertext;
      decryptionNonce = extracted.nonce;
    } else {
      actualCiphertext = ciphertext;
      decryptionNonce = this.nonce;
    }

    const chachaPolyNonce = this.createChaChaPolyNonce(decryptionNonce);

    // Ensure all inputs are proper Uint8Arrays
    const ciphertextBytes = new Uint8Array(actualCiphertext);
    const ad = associatedData.length > 0 ? new Uint8Array(associatedData) : null;

    try {
      const plaintext = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null, // nsec
        ciphertextBytes,
        ad,
        chachaPolyNonce,
        this.key
      );

      if (this.useExtractedNonce) {
        // Mark nonce as seen after successful decryption
        this.markNonceAsSeen(decryptionNonce);
      }

      this.nonce++;
      return plaintext;
    } catch {
      throw new NoiseError(
        'Decryption failed: authentication tag mismatch',
        NoiseErrorCode.AuthenticationFailure
      );
    }
  }

  /**
   * Securely clear sensitive data from memory.
   */
  clear(): void {
    if (this.key) {
      this.key.fill(0);
      this.key = null;
    }
    this.nonce = 0;
    this.highestReceivedNonce = 0;
    this.replayWindow.fill(0);
  }
}

// MARK: - Symmetric State

/**
 * Manages the symmetric cryptographic state during Noise handshakes.
 * Responsible for key derivation, protocol name hashing, and maintaining
 * the chaining key that provides key separation between handshake messages.
 */
export class NoiseSymmetricState {
  private cipherState: NoiseCipherState;
  private chainingKey: Uint8Array;
  private hash: Uint8Array;

  constructor(protocolName: string) {
    ensureSodiumReady();
    const sodium = getSodium();

    this.cipherState = new NoiseCipherState();

    // Initialize with protocol name
    const nameData = sodium.from_string(protocolName);
    if (nameData.length <= NoiseConstants.HASH_LEN) {
      this.hash = new Uint8Array(NoiseConstants.HASH_LEN);
      this.hash.set(nameData, 0);
    } else {
      this.hash = sodium.crypto_hash_sha256(nameData);
    }
    this.chainingKey = new Uint8Array(this.hash);
  }

  /**
   * Mix a key into the state using HKDF.
   */
  mixKey(inputKeyMaterial: Uint8Array): void {
    const output = this.hkdf(this.chainingKey, inputKeyMaterial, 2);
    // HKDF always returns the requested number of outputs
    this.chainingKey = output[0]!;
    this.cipherState.initializeKey(output[1]);
  }

  /**
   * Mix data into the hash.
   */
  mixHash(data: Uint8Array): void {
    ensureSodiumReady();
    const sodium = getSodium();

    const combined = new Uint8Array(this.hash.length + data.length);
    combined.set(this.hash, 0);
    combined.set(data, this.hash.length);
    this.hash = sodium.crypto_hash_sha256(combined);
  }

  /**
   * Get the current handshake hash.
   */
  getHandshakeHash(): Uint8Array {
    return new Uint8Array(this.hash);
  }

  /**
   * Check if the cipher has a key.
   */
  hasCipherKey(): boolean {
    return this.cipherState.hasKey();
  }

  /**
   * Encrypt and hash data.
   */
  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    if (this.cipherState.hasKey()) {
      const ciphertext = this.cipherState.encrypt(plaintext, this.hash);
      this.mixHash(ciphertext);
      return ciphertext;
    } 
      this.mixHash(plaintext);
      return plaintext;
    
  }

  /**
   * Decrypt and hash data.
   */
  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    if (this.cipherState.hasKey()) {
      const plaintext = this.cipherState.decrypt(ciphertext, this.hash);
      this.mixHash(ciphertext);
      return plaintext;
    } 
      this.mixHash(ciphertext);
      return ciphertext;
    
  }

  /**
   * Split the symmetric state into two cipher states for transport.
   */
  split(useExtractedNonce: boolean): [NoiseCipherState, NoiseCipherState] {
    const output = this.hkdf(this.chainingKey, new Uint8Array(0), 2);
    // HKDF always returns the requested number of outputs
    const c1 = new NoiseCipherState(output[0], useExtractedNonce);
    const c2 = new NoiseCipherState(output[1], useExtractedNonce);
    return [c1, c2];
  }

  /**
   * HKDF implementation using HMAC-SHA256.
   */
  private hkdf(
    chainingKey: Uint8Array,
    inputKeyMaterial: Uint8Array,
    numOutputs: number
  ): Uint8Array[] {
    ensureSodiumReady();
    const sodium = getSodium();

    // Extract: tempKey = HMAC(chainingKey, inputKeyMaterial)
    const tempKey = sodium.crypto_auth_hmacsha256(inputKeyMaterial, chainingKey);

    // Expand
    const outputs: Uint8Array[] = [];
    let currentOutput = new Uint8Array(0);

    for (let i = 1; i <= numOutputs; i++) {
      const input = new Uint8Array(currentOutput.length + 1);
      input.set(currentOutput, 0);
      // currentOutput.length is always valid since we just constructed input
      (input as Uint8Array)[currentOutput.length] = i;
      // Copy the HMAC result to ensure proper Uint8Array type
      const hmacResult = sodium.crypto_auth_hmacsha256(input, tempKey);
      currentOutput = Uint8Array.from(hmacResult);
      outputs.push(Uint8Array.from(currentOutput));
    }

    return outputs;
  }

  /**
   * Clear sensitive data.
   */
  clear(): void {
    this.chainingKey.fill(0);
    this.hash.fill(0);
    this.cipherState.clear();
  }
}

// MARK: - Key Validation

/**
 * Known low-order points for Curve25519 that could enable small subgroup attacks.
 */
const LOW_ORDER_POINTS: Uint8Array[] = [
  // Point of order 1
  new Uint8Array([
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
  // Low order point
  new Uint8Array([
    0xe0, 0xeb, 0x7a, 0x7c, 0x3b, 0x41, 0xb8, 0xae, 0x16, 0x56, 0xe3, 0xfa,
    0xf1, 0x9f, 0xc4, 0x6a, 0xda, 0x09, 0x8d, 0xeb, 0x9c, 0x32, 0xb1, 0xfd,
    0x86, 0x62, 0x05, 0x16, 0x5f, 0x49, 0xb8, 0x00,
  ]),
  // Another low order point
  new Uint8Array([
    0x5f, 0x9c, 0x95, 0xbc, 0xa3, 0x50, 0x8c, 0x24, 0xb1, 0xd0, 0xb1, 0x55,
    0x9c, 0x83, 0xef, 0x5b, 0x04, 0x44, 0x5c, 0xc4, 0x58, 0x1c, 0x8e, 0x86,
    0xd8, 0x22, 0x4e, 0xdd, 0xd0, 0x9f, 0x11, 0x57,
  ]),
  // All 0xFF
  new Uint8Array(32).fill(0xff),
  // Another bad point
  new Uint8Array([
    0xda, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  ]),
  // Another bad point
  new Uint8Array([
    0xdb, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  ]),
];

/**
 * Validate a Curve25519 public key.
 * Checks for weak/invalid keys that could compromise security.
 */
export function validatePublicKey(keyData: Uint8Array): boolean {
  // Check key length
  if (keyData.length !== CryptoConstants.X25519_PUBLIC_KEY_BYTES) {
    return false;
  }

  // Check for all-zero key (point at infinity)
  if (keyData.every((b) => b === 0)) {
    return false;
  }

  // Check against known low-order points
  for (const badPoint of LOW_ORDER_POINTS) {
    if (keyData.every((b, i) => b === badPoint[i])) {
      return false;
    }
  }

  return true;
}
