/**
 * Native App Format Documentation
 *
 * This module documents the message formats, event kinds, and relay behavior
 * used by the native BitChat iOS and Android apps. The web client must match
 * these formats exactly to ensure cross-platform compatibility.
 *
 * Reference: ../bitchat/bitchat/Nostr/NostrProtocol.swift
 * Reference: ../bitchat/bitchat/Protocols/Geohash.swift
 * Reference: ../bitchat/bitchat/Noise/NoiseProtocol.swift
 */

// ============================================================================
// Nostr Event Kinds
// ============================================================================

/**
 * Nostr event kinds used by BitChat native apps.
 * Web client must use identical kind numbers.
 */
export const NativeEventKinds = {
  /**
   * Kind 0: Metadata
   * User profile information (display name, about, picture)
   * NIP-01 standard
   */
  METADATA: 0,

  /**
   * Kind 1: Text Note
   * Standard public text note
   * Used for persistent location notes (geo-tagged text notes)
   * NIP-01 standard
   */
  TEXT_NOTE: 1,

  /**
   * Kind 14: DM Rumor
   * NIP-17 private direct message rumor (unsigned inner event)
   * Contains the actual message content
   * Always wrapped in a Seal (kind 13)
   */
  DM_RUMOR: 14,

  /**
   * Kind 13: Seal
   * NIP-17 sealed event (encrypted rumor)
   * Contains encrypted JSON of the DM rumor
   * Encrypted to recipient using NIP-44 v2
   * Always wrapped in a Gift Wrap (kind 1059)
   */
  SEAL: 13,

  /**
   * Kind 1059: Gift Wrap
   * NIP-59 gift wrap (outer envelope)
   * Contains encrypted JSON of the Seal
   * Uses ephemeral key for sender anonymity
   * Tags: [["p", recipientPubkey]]
   */
  GIFT_WRAP: 1059,

  /**
   * Kind 20000: Ephemeral Event
   * BitChat location channel messages
   * Tags: [["g", geohash], ["n", nickname]?, ["t", "teleport"]?]
   * Content: message text
   * Ephemeral events (20000-29999) are not persisted by relays
   */
  EPHEMERAL_EVENT: 20000,

  /**
   * Ephemeral event range end
   */
  EPHEMERAL_MAX: 29999,
} as const;

// ============================================================================
// Event Tag Formats
// ============================================================================

/**
 * Tag formats used by BitChat native apps.
 */
export const NativeTagFormats = {
  /**
   * Geohash tag for location channels
   * Format: ["g", geohash_string]
   * Example: ["g", "dr5regw7"]
   * Precision: 8 characters (building level, ~38m x 19m)
   */
  GEOHASH: {
    tagName: 'g',
    precision: 8,
    description: 'Location channel geohash (building level)',
  },

  /**
   * Nickname tag for display name
   * Format: ["n", nickname_string]
   * Example: ["n", "Alice"]
   * Optional: Only included if user has set a nickname
   */
  NICKNAME: {
    tagName: 'n',
    maxLength: 32,
    description: 'User display nickname',
  },

  /**
   * Teleport tag for non-physical presence
   * Format: ["t", "teleport"]
   * Example: ["t", "teleport"]
   * Indicates user has "teleported" to this location (not physically present)
   */
  TELEPORT: {
    tagName: 't',
    value: 'teleport',
    description: 'Indicates virtual/teleported presence',
  },

  /**
   * Pubkey tag for gift wrap recipient
   * Format: ["p", recipient_pubkey_hex]
   * Example: ["p", "abc123..."]
   * Used in Gift Wrap events (kind 1059) to indicate recipient
   */
  PUBKEY: {
    tagName: 'p',
    description: 'Recipient public key (x-only, 32 bytes hex)',
  },
} as const;

// ============================================================================
// NIP-44 v2 Encryption Format
// ============================================================================

/**
 * NIP-44 v2 encryption format used by BitChat native apps.
 */
export const NativeEncryptionFormat = {
  /**
   * Version prefix for NIP-44 v2 ciphertext
   */
  VERSION_PREFIX: 'v2:',

  /**
   * Encryption algorithm: XChaCha20-Poly1305
   */
  ALGORITHM: 'XChaCha20-Poly1305',

  /**
   * Key derivation: HKDF-SHA256
   * Input: ECDH shared secret (secp256k1)
   * Salt: empty (0 bytes)
   * Info: "nip44-v2" (8 bytes UTF-8)
   * Output: 32 bytes
   */
  KEY_DERIVATION: {
    algorithm: 'HKDF-SHA256',
    salt: new Uint8Array(0),
    info: 'nip44-v2',
    outputLength: 32,
  },

  /**
   * Nonce size: 24 bytes (XChaCha20)
   */
  NONCE_LENGTH: 24,

  /**
   * Authentication tag size: 16 bytes (Poly1305)
   */
  TAG_LENGTH: 16,

  /**
   * Ciphertext format: base64url(nonce24 || ciphertext || tag)
   * Note: Standard base64 with URL-safe characters (+/= -> -_)
   */
  ENCODING: 'base64url',

  /**
   * Full format: "v2:" + base64url(nonce24 || ciphertext || tag)
   */
  formatCiphertext: (nonce: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array): string => {
    const combined = new Uint8Array(nonce.length + ciphertext.length + tag.length);
    combined.set(nonce, 0);
    combined.set(ciphertext, nonce.length);
    combined.set(tag, nonce.length + ciphertext.length);
    return 'v2:' + base64UrlEncode(combined);
  },

  /**
   * Parse ciphertext format
   */
  parseCiphertext: (encrypted: string): { nonce: Uint8Array; ciphertext: Uint8Array; tag: Uint8Array } | null => {
    if (!encrypted.startsWith('v2:')) {
      return null;
    }
    const encoded = encrypted.slice(3);
    const data = base64UrlDecode(encoded);
    if (!data || data.length < 24 + 16) {
      return null;
    }
    return {
      nonce: data.slice(0, 24),
      ciphertext: data.slice(24, data.length - 16),
      tag: data.slice(data.length - 16),
    };
  },
} as const;

// ============================================================================
// Nostr Event Structure
// ============================================================================

/**
 * Nostr event structure matching native app format.
 * All fields must be in this exact order for ID calculation.
 */
export interface NativeNostrEvent {
  /** Event ID: SHA-256 of serialized event (32 bytes, lowercase hex) */
  id: string;
  /** Author public key (x-only, 32 bytes, lowercase hex) */
  pubkey: string;
  /** Unix timestamp in seconds */
  created_at: number;
  /** Event kind */
  kind: number;
  /** Array of tag arrays */
  tags: string[][];
  /** Event content (string) */
  content: string;
  /** Schnorr signature (BIP-340, 64 bytes, lowercase hex) */
  sig: string;
}

/**
 * Event ID calculation format.
 * ID = SHA-256(JSON.stringify([0, pubkey, created_at, kind, tags, content]))
 *
 * Important notes from iOS implementation:
 * - Use withoutEscapingSlashes option for JSON serialization
 * - No whitespace in JSON output
 * - Tags must maintain exact order
 */
export function calculateEventIdFormat(event: Omit<NativeNostrEvent, 'id' | 'sig'>): string {
  // Serialization format: [0, pubkey, created_at, kind, tags, content]
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  // Result is SHA-256 hash of this string, as lowercase hex
  return serialized;
}

// ============================================================================
// Timestamp Handling
// ============================================================================

/**
 * Timestamp handling for NIP-17 privacy.
 * Gift wrap and seal timestamps are randomized for privacy.
 */
export const NativeTimestampHandling = {
  /**
   * Randomization range for gift wrap/seal timestamps
   * +/- 15 minutes from current time
   */
  RANDOMIZATION_RANGE_SECONDS: 900,

  /**
   * Generate randomized timestamp (for gift wrap/seal)
   */
  randomizedTimestamp: (): number => {
    const now = Math.floor(Date.now() / 1000);
    const offset = Math.floor(Math.random() * 1800) - 900; // -900 to +900
    return now + offset;
  },

  /**
   * Current timestamp (for rumor - actual message time)
   */
  currentTimestamp: (): number => {
    return Math.floor(Date.now() / 1000);
  },
} as const;

// ============================================================================
// Geohash Format
// ============================================================================

/**
 * Geohash format used by BitChat native apps.
 */
export const NativeGeohashFormat = {
  /**
   * Base32 character set for geohash encoding.
   * Note: 'a', 'i', 'l', 'o' are excluded to avoid confusion
   */
  BASE32_CHARS: '0123456789bcdefghjkmnpqrstuvwxyz',

  /**
   * Default precision for location channels (building level)
   */
  DEFAULT_PRECISION: 8,

  /**
   * Latitude range
   */
  LAT_RANGE: { min: -90.0, max: 90.0 },

  /**
   * Longitude range
   */
  LON_RANGE: { min: -180.0, max: 180.0 },

  /**
   * Validate building-level geohash (8 characters)
   */
  isValidBuildingGeohash: (geohash: string): boolean => {
    if (geohash.length !== 8) return false;
    const base32Chars = '0123456789bcdefghjkmnpqrstuvwxyz';
    return geohash.toLowerCase().split('').every(c => base32Chars.includes(c));
  },

  /**
   * Neighbor directions order: N, NE, E, SE, S, SW, W, NW
   */
  NEIGHBOR_DIRECTIONS: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const,
} as const;

// ============================================================================
// Noise Protocol Format
// ============================================================================

/**
 * Noise Protocol format used by BitChat native apps.
 */
export const NativeNoiseFormat = {
  /**
   * Protocol name
   */
  PROTOCOL_NAME: 'Noise_XX_25519_ChaChaPoly_SHA256',

  /**
   * Key exchange: Curve25519 (X25519)
   */
  DH_ALGORITHM: 'X25519',

  /**
   * Symmetric cipher: ChaCha20-Poly1305
   */
  CIPHER_ALGORITHM: 'ChaCha20-Poly1305',

  /**
   * Hash function: SHA-256
   */
  HASH_ALGORITHM: 'SHA-256',

  /**
   * Handshake pattern: XX
   * Provides mutual authentication and identity hiding
   */
  HANDSHAKE_PATTERN: 'XX',

  /**
   * Key sizes
   */
  KEY_SIZES: {
    publicKey: 32,
    privateKey: 32,
    symmetricKey: 32,
    nonce: 12,
    tag: 16,
  },

  /**
   * Nonce encoding for ChaCha20
   * 12 bytes: 4 zero bytes || 8 bytes little-endian counter
   */
  encodeNonce: (counter: bigint): Uint8Array => {
    const nonce = new Uint8Array(12);
    // First 4 bytes: zeros
    // Next 8 bytes: little-endian counter
    const view = new DataView(nonce.buffer);
    view.setBigUint64(4, counter, true); // true = little-endian
    return nonce;
  },

  /**
   * Replay protection window
   */
  REPLAY_WINDOW: {
    size: 1024,
    bytes: 128,
  },

  /**
   * Transport message format with extracted nonce
   * Format: <4-byte nonce (big-endian)> || <ciphertext> || <16-byte tag>
   */
  TRANSPORT_NONCE_SIZE: 4,
} as const;

// ============================================================================
// Relay Behavior
// ============================================================================

/**
 * Relay behavior expected by BitChat native apps.
 */
export const NativeRelayBehavior = {
  /**
   * Number of relays in the relay list
   * BitChat uses a large relay list for redundancy
   */
  RELAY_COUNT_APPROXIMATE: 290,

  /**
   * Subscription filters for location channels
   */
  locationChannelFilter: (geohash: string) => ({
    kinds: [20000],
    '#g': [geohash],
    limit: 100,
  }),

  /**
   * Subscription filters for DMs (gift wraps)
   */
  dmFilter: (recipientPubkey: string) => ({
    kinds: [1059],
    '#p': [recipientPubkey],
  }),

  /**
   * Message format from relay to client
   */
  relayMessages: {
    EVENT: ['EVENT', 'subscription_id', { /* event */ }] as const,
    OK: ['OK', 'event_id', true, 'message'] as const,
    EOSE: ['EOSE', 'subscription_id'] as const,
    CLOSED: ['CLOSED', 'subscription_id', 'reason'] as const,
    NOTICE: ['NOTICE', 'message'] as const,
    AUTH: ['AUTH', 'challenge'] as const,
  },

  /**
   * Message format from client to relay
   */
  clientMessages: {
    EVENT: ['EVENT', { /* event */ }] as const,
    REQ: ['REQ', 'subscription_id', { /* filter */ }] as const,
    CLOSE: ['CLOSE', 'subscription_id'] as const,
    AUTH: ['AUTH', { /* signed auth event */ }] as const,
  },
} as const;

// ============================================================================
// Key Format
// ============================================================================

/**
 * Key formats used by BitChat native apps.
 */
export const NativeKeyFormat = {
  /**
   * Nostr public key: x-only (32 bytes)
   * Displayed as lowercase hex (64 characters)
   */
  NOSTR_PUBLIC_KEY: {
    length: 32,
    hexLength: 64,
    format: 'x-only',
  },

  /**
   * Nostr private key: 32 bytes
   * Can be encoded as nsec (Bech32)
   */
  NOSTR_PRIVATE_KEY: {
    length: 32,
    hexLength: 64,
  },

  /**
   * Bech32 prefixes
   */
  BECH32: {
    npub: 'npub',
    nsec: 'nsec',
    note: 'note',
  },

  /**
   * Noise public key: Curve25519 (32 bytes)
   */
  NOISE_PUBLIC_KEY: {
    length: 32,
  },

  /**
   * Noise private key: Curve25519 (32 bytes)
   */
  NOISE_PRIVATE_KEY: {
    length: 32,
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Base64 URL-safe encoding (no padding)
 */
function base64UrlEncode(data: Uint8Array): string {
  // Convert to regular base64
  let base64 = '';
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      base64 += String.fromCharCode(byte);
    }
  }
  base64 = btoa(base64);

  // Convert to URL-safe
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL-safe decoding
 */
function base64UrlDecode(str: string): Uint8Array | null {
  try {
    // Add padding if needed
    const pad = (4 - (str.length % 4)) % 4;
    const padded = str + '='.repeat(pad);

    // Convert from URL-safe
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');

    // Decode
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// Export helper functions
export { base64UrlEncode, base64UrlDecode };
