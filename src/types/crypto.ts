/**
 * Cryptographic Type Definitions
 *
 * Types for cryptographic operations in BitChat PWA.
 * Includes Noise Protocol state, session keys, and encrypted payloads.
 *
 * @module types/crypto
 */

/**
 * Handshake state enumeration.
 * Tracks the progress of a Noise Protocol handshake.
 * Matches native BitChat's HandshakeState enum.
 */
export enum HandshakeState {
  /** No handshake initiated */
  None = 'none',
  /** Handshake has been initiated, waiting for response */
  Initiated = 'initiated',
  /** Handshake is in progress */
  InProgress = 'inProgress',
  /** Handshake completed successfully */
  Completed = 'completed',
  /** Handshake failed */
  Failed = 'failed',
}

/**
 * Lazy handshake state for on-demand session establishment.
 * Matches native BitChat's LazyHandshakeState enum.
 */
export enum LazyHandshakeState {
  /** No session, no handshake attempted */
  None = 'none',
  /** User action requires handshake, queued */
  HandshakeQueued = 'handshakeQueued',
  /** Currently performing handshake */
  Handshaking = 'handshaking',
  /** Session established and ready */
  Established = 'established',
  /** Handshake failed */
  Failed = 'failed',
}

/**
 * Handshake state with completion details.
 */
export type HandshakeStateInfo =
  | { state: HandshakeState.None }
  | { state: HandshakeState.Initiated; initiatedAt: number }
  | { state: HandshakeState.InProgress; startedAt: number }
  | { state: HandshakeState.Completed; fingerprint: string; completedAt: number }
  | { state: HandshakeState.Failed; reason: string; failedAt: number };

/**
 * Session keys derived from a completed Noise handshake.
 * Used for ongoing encryption/decryption of messages.
 */
export interface SessionKeys {
  /**
   * Key for encrypting outgoing messages (32 bytes).
   */
  encryptKey: Uint8Array;

  /**
   * Key for decrypting incoming messages (32 bytes).
   */
  decryptKey: Uint8Array;

  /**
   * Nonce counter for outgoing messages.
   */
  sendNonce: number;

  /**
   * Nonce counter for incoming messages.
   */
  recvNonce: number;

  /**
   * Remote peer's static public key.
   */
  remoteStaticKey: Uint8Array;

  /**
   * Unix timestamp when keys were established.
   */
  establishedAt: number;

  /**
   * Optional: Session identifier for key rotation.
   */
  sessionId?: string;
}

/**
 * Encrypted payload container.
 * Contains all data needed to decrypt a message.
 */
export interface EncryptedPayload {
  /**
   * Encrypted ciphertext including authentication tag.
   */
  ciphertext: Uint8Array;

  /**
   * Nonce used for encryption (24 bytes for XChaCha20-Poly1305).
   */
  nonce: Uint8Array;

  /**
   * Additional authenticated data (if any).
   */
  aad?: Uint8Array;

  /**
   * Encryption algorithm used.
   */
  algorithm: EncryptionAlgorithm;

  /**
   * Version of the encryption format.
   */
  version: number;
}

/**
 * Encryption algorithms supported by BitChat.
 */
export enum EncryptionAlgorithm {
  /** XChaCha20-Poly1305 (24-byte nonce) - primary */
  XChaCha20Poly1305 = 'xchacha20-poly1305',
  /** ChaCha20-Poly1305 (12-byte nonce) - Noise protocol */
  ChaCha20Poly1305 = 'chacha20-poly1305',
  /** NIP-04 encryption (legacy) */
  Nip04 = 'nip04',
  /** NIP-44 encryption (modern Nostr DMs) */
  Nip44 = 'nip44',
}

/**
 * Noise Protocol handshake pattern.
 * BitChat uses XX pattern for mutual authentication.
 */
export enum NoisePattern {
  /** XX pattern - both sides send static keys */
  XX = 'XX',
  /** IK pattern - initiator knows responder's static key */
  IK = 'IK',
  /** NK pattern - only initiator sends static key */
  NK = 'NK',
}

/**
 * Noise Protocol handshake message.
 */
export interface NoiseHandshakeMessage {
  /**
   * Ephemeral public key (if included in this message).
   */
  ephemeralKey?: Uint8Array;

  /**
   * Encrypted static public key (if included).
   */
  encryptedStaticKey?: Uint8Array;

  /**
   * Encrypted payload (if any).
   */
  payload?: Uint8Array;

  /**
   * Message index in the handshake (0, 1, or 2 for XX).
   */
  messageIndex: number;
}

/**
 * Noise Protocol session state.
 * Maintains state during and after handshake.
 */
export interface NoiseSessionState {
  /**
   * Local static key pair.
   */
  localStatic: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };

  /**
   * Local ephemeral key pair (generated per handshake).
   */
  localEphemeral?: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };

  /**
   * Remote static public key (learned during handshake).
   */
  remoteStatic?: Uint8Array;

  /**
   * Remote ephemeral public key (learned during handshake).
   */
  remoteEphemeral?: Uint8Array;

  /**
   * Current handshake state.
   */
  handshakeState: HandshakeState;

  /**
   * Chaining key for key derivation.
   */
  chainingKey?: Uint8Array;

  /**
   * Handshake hash for channel binding.
   */
  handshakeHash?: Uint8Array;

  /**
   * Session keys (after handshake completes).
   */
  sessionKeys?: SessionKeys;

  /**
   * Whether we initiated the handshake.
   */
  isInitiator: boolean;

  /**
   * Handshake pattern being used.
   */
  pattern: NoisePattern;
}

/**
 * Noise payload types for encrypted content.
 * Matches native BitChat's NoisePayloadType enum.
 */
export enum NoisePayloadType {
  /** Private chat message */
  PrivateMessage = 0x01,
  /** Read receipt */
  ReadReceipt = 0x02,
  /** Delivered confirmation */
  Delivered = 0x03,
  /** Verification challenge (QR-based) */
  VerifyChallenge = 0x10,
  /** Verification response */
  VerifyResponse = 0x11,
}

/**
 * Noise payload container.
 * First byte indicates the payload type.
 */
export interface NoisePayload {
  /**
   * Payload type identifier.
   */
  type: NoisePayloadType;

  /**
   * Payload data.
   */
  data: Uint8Array;
}

/**
 * Key derivation function parameters.
 */
export interface KdfParams {
  /**
   * Algorithm (e.g., 'hkdf-sha256', 'argon2id').
   */
  algorithm: string;

  /**
   * Salt value.
   */
  salt: Uint8Array;

  /**
   * Info/context string.
   */
  info?: Uint8Array;

  /**
   * Output key length in bytes.
   */
  outputLength: number;

  /**
   * Iterations (for PBKDF2/Argon2).
   */
  iterations?: number;

  /**
   * Memory limit in bytes (for Argon2).
   */
  memoryLimit?: number;
}

/**
 * Shared secret result from key exchange.
 */
export interface SharedSecret {
  /**
   * Derived shared secret (32 bytes).
   */
  secret: Uint8Array;

  /**
   * Remote public key used in the exchange.
   */
  remotePublicKey: Uint8Array;

  /**
   * Local public key used in the exchange.
   */
  localPublicKey: Uint8Array;
}

/**
 * Digital signature result.
 */
export interface SignatureResult {
  /**
   * Signature bytes (64 bytes for Ed25519).
   */
  signature: Uint8Array;

  /**
   * Public key of the signer.
   */
  publicKey: Uint8Array;

  /**
   * Message that was signed.
   */
  message: Uint8Array;

  /**
   * Algorithm used for signing.
   */
  algorithm: 'ed25519' | 'schnorr';
}

/**
 * Encryption session for a peer.
 * Manages encrypted communication with a single peer.
 */
export interface EncryptionSession {
  /**
   * Peer's fingerprint.
   */
  peerFingerprint: string;

  /**
   * Current session state.
   */
  state: LazyHandshakeState;

  /**
   * Session keys (if established).
   */
  keys?: SessionKeys;

  /**
   * Pending messages to send after handshake.
   */
  pendingMessages: Uint8Array[];

  /**
   * Unix timestamp when session was created.
   */
  createdAt: number;

  /**
   * Unix timestamp of last activity.
   */
  lastActivityAt: number;

  /**
   * Number of messages encrypted with this session.
   */
  messageCount: number;
}

/**
 * Crypto constants matching native BitChat.
 */
export const CryptoConstants = {
  /** X25519 public key size in bytes */
  X25519_PUBLIC_KEY_BYTES: 32,
  /** X25519 private key size in bytes */
  X25519_PRIVATE_KEY_BYTES: 32,
  /** Ed25519 public key size in bytes */
  ED25519_PUBLIC_KEY_BYTES: 32,
  /** Ed25519 private key (seed + public) size in bytes */
  ED25519_PRIVATE_KEY_BYTES: 64,
  /** Ed25519 signature size in bytes */
  ED25519_SIGNATURE_BYTES: 64,
  /** XChaCha20-Poly1305 nonce size in bytes */
  XCHACHA20_NONCE_BYTES: 24,
  /** ChaCha20-Poly1305 nonce size in bytes */
  CHACHA20_NONCE_BYTES: 12,
  /** ChaCha20-Poly1305 key size in bytes */
  CHACHA20_KEY_BYTES: 32,
  /** Poly1305 authentication tag size in bytes */
  POLY1305_TAG_BYTES: 16,
  /** SHA-256 hash output size in bytes */
  SHA256_BYTES: 32,
  /** Shared secret size from X25519 ECDH */
  SHARED_SECRET_BYTES: 32,
  /** Maximum message size before chunking */
  MAX_MESSAGE_SIZE: 65535,
} as const;

/**
 * Helper to encode a Noise payload.
 */
export function encodeNoisePayload(type: NoisePayloadType, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(1 + data.length);
  result[0] = type;
  result.set(data, 1);
  return result;
}

/**
 * Helper to decode a Noise payload.
 */
export function decodeNoisePayload(encoded: Uint8Array): NoisePayload | null {
  if (encoded.length < 1) return null;

  const type = encoded[0] as NoisePayloadType;
  const data = encoded.slice(1);

  return { type, data };
}

/**
 * Helper to check if session keys are still valid.
 */
export function areSessionKeysValid(
  keys: SessionKeys | undefined,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  if (!keys) return false;
  return Date.now() - keys.establishedAt < maxAgeMs;
}
