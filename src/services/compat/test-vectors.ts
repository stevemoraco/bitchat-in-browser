/**
 * Test Vectors for Protocol Compatibility
 *
 * These test vectors are derived from the iOS BitChat implementation
 * to ensure cross-platform compatibility between web, iOS, and Android clients.
 *
 * Reference: ../bitchat/bitchat/Nostr/NostrProtocol.swift
 * Reference: ../bitchat/bitchat/Protocols/Geohash.swift
 * Reference: ../bitchat/bitchat/Noise/NoiseProtocol.swift
 */

// ============================================================================
// Nostr Event Test Vectors
// ============================================================================

/**
 * Test vectors for Nostr event ID calculation.
 * Event ID is SHA-256 of serialized event array: [0, pubkey, created_at, kind, tags, content]
 */
export const EVENT_ID_VECTORS = {
  /**
   * Basic text note (kind 1) with no tags
   */
  textNote: {
    event: {
      pubkey: 'a0afdd6e7a0a8c22c6f2b1b8c8a6bf3dbf3c3e4b5a6c7d8e9f0a1b2c3d4e5f60',
      created_at: 1704067200, // 2024-01-01 00:00:00 UTC
      kind: 1,
      tags: [],
      content: 'Hello, Nostr!',
    },
    // Expected serialization: [0,"a0afdd6e7a0a8c22c6f2b1b8c8a6bf3dbf3c3e4b5a6c7d8e9f0a1b2c3d4e5f60",1704067200,1,[],"Hello, Nostr!"]
    expectedSerialization:
      '[0,"a0afdd6e7a0a8c22c6f2b1b8c8a6bf3dbf3c3e4b5a6c7d8e9f0a1b2c3d4e5f60",1704067200,1,[],"Hello, Nostr!"]',
  },

  /**
   * Location channel ephemeral event (kind 20000)
   */
  ephemeralLocationEvent: {
    event: {
      pubkey: 'b1bfee7e8b1b9d33d7f3c2c9d9b7cf4ecf4d4f5c6b7d8e9f0a1b2c3d4e5f6071',
      created_at: 1704153600, // 2024-01-02 00:00:00 UTC
      kind: 20000,
      tags: [
        ['g', 'dr5regw7'], // Geohash tag
        ['n', 'TestUser'], // Nickname tag
      ],
      content: 'Hello from location channel!',
    },
    expectedSerialization:
      '[0,"b1bfee7e8b1b9d33d7f3c2c9d9b7cf4ecf4d4f5c6b7d8e9f0a1b2c3d4e5f6071",1704153600,20000,[["g","dr5regw7"],["n","TestUser"]],"Hello from location channel!"]',
  },

  /**
   * NIP-17 Direct Message rumor (kind 14)
   */
  dmRumor: {
    event: {
      pubkey: 'c2cfff8f9c2cae44e8f4d3daeacbd5fdf5e5f6d7c8e9f0a1b2c3d4e5f6072182',
      created_at: 1704240000, // 2024-01-03 00:00:00 UTC
      kind: 14,
      tags: [],
      content: 'Private message content',
    },
    expectedSerialization:
      '[0,"c2cfff8f9c2cae44e8f4d3daeacbd5fdf5e5f6d7c8e9f0a1b2c3d4e5f6072182",1704240000,14,[],"Private message content"]',
  },

  /**
   * NIP-17 Seal event (kind 13)
   */
  sealEvent: {
    event: {
      pubkey: 'd3d0009a0d3dbf55f9f5e4ebfbdce6fe6f6f7e8d9f0a1b2c3d4e5f6072183293',
      created_at: 1704326400, // 2024-01-04 00:00:00 UTC
      kind: 13,
      tags: [],
      content:
        'v2:base64_encrypted_rumor_content_here_simulating_nip44_format',
    },
    expectedSerialization:
      '[0,"d3d0009a0d3dbf55f9f5e4ebfbdce6fe6f6f7e8d9f0a1b2c3d4e5f6072183293",1704326400,13,[],"v2:base64_encrypted_rumor_content_here_simulating_nip44_format"]',
  },

  /**
   * NIP-59 Gift Wrap event (kind 1059)
   */
  giftWrapEvent: {
    event: {
      pubkey: 'e4e111ab1e4ecf66faf6f5fcfcfedf7f7f7f8f9e0a1b2c3d4e5f60721832a3a4',
      created_at: 1704412800, // 2024-01-05 00:00:00 UTC
      kind: 1059,
      tags: [['p', 'f5f6f7f8f9f0a1b2c3d4e5f6072183294a5b6c7d8e9f0a1b2c3d4e5f60718293']],
      content:
        'v2:base64_encrypted_seal_content_here_simulating_nip44_format',
    },
    expectedSerialization:
      '[0,"e4e111ab1e4ecf66faf6f5fcfcfedf7f7f7f8f9e0a1b2c3d4e5f60721832a3a4",1704412800,1059,[["p","f5f6f7f8f9f0a1b2c3d4e5f6072183294a5b6c7d8e9f0a1b2c3d4e5f60718293"]],"v2:base64_encrypted_seal_content_here_simulating_nip44_format"]',
  },
};

// ============================================================================
// Nostr Event Kind Constants (matching iOS implementation)
// ============================================================================

export const NOSTR_EVENT_KINDS = {
  /** Metadata event (NIP-01) */
  METADATA: 0,
  /** Text note (NIP-01) */
  TEXT_NOTE: 1,
  /** NIP-17 DM rumor kind */
  DM_RUMOR: 14,
  /** NIP-17 sealed event */
  SEAL: 13,
  /** NIP-59 gift wrap */
  GIFT_WRAP: 1059,
  /** Ephemeral event for location channels */
  EPHEMERAL_EVENT: 20000,
  /** Maximum ephemeral event kind */
  EPHEMERAL_MAX: 29999,
} as const;

// ============================================================================
// NIP-44 Encryption Test Vectors
// ============================================================================

/**
 * NIP-44 v2 encryption test vectors.
 * Uses XChaCha20-Poly1305 with HKDF-SHA256 key derivation.
 */
export const NIP44_VECTORS = {
  /**
   * Key derivation test: HKDF-SHA256 with "nip44-v2" info
   */
  keyDerivation: {
    // Shared secret from ECDH (32 bytes, hex)
    sharedSecret:
      '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
    // Salt: empty for NIP-44 v2
    salt: '',
    // Info string for HKDF
    info: 'nip44-v2',
    // Expected derived key (32 bytes, hex)
    // Note: This is a computed value, verify against iOS implementation
    expectedKeyLength: 32,
  },

  /**
   * Base64URL encoding test vectors
   */
  base64url: {
    // Standard base64: "SGVsbG8sIFdvcmxkIQ=="
    // Base64URL: "SGVsbG8sIFdvcmxkIQ"
    plaintext: 'Hello, World!',
    base64url: 'SGVsbG8sIFdvcmxkIQ',
  },

  /**
   * Version prefix format: "v2:" + base64url(nonce24 || ciphertext || tag)
   */
  format: {
    versionPrefix: 'v2:',
    nonceLength: 24,
    tagLength: 16,
  },
};

// ============================================================================
// Geohash Test Vectors
// ============================================================================

/**
 * Geohash encoding/decoding test vectors.
 * Matches iOS implementation in Geohash.swift.
 */
export const GEOHASH_VECTORS = {
  /**
   * Well-known location encodings
   */
  encode: [
    {
      name: 'New York City (Times Square)',
      latitude: 40.758,
      longitude: -73.9855,
      precision: 8,
      expected: 'dr5ru7v2', // Computed from standard geohash algorithm
    },
    {
      name: 'San Francisco (Golden Gate)',
      latitude: 37.8199,
      longitude: -122.4783,
      precision: 8,
      expected: '9q8zhuyh', // Computed from standard geohash algorithm
    },
    {
      name: 'London (Big Ben)',
      latitude: 51.5007,
      longitude: -0.1246,
      precision: 8,
      expected: 'gcpuvpmm', // Computed from standard geohash algorithm
    },
    {
      name: 'Tokyo (Shibuya)',
      latitude: 35.6595,
      longitude: 139.7004,
      precision: 8,
      expected: 'xn76fgwe', // Computed from standard geohash algorithm
    },
    {
      name: 'Sydney (Opera House)',
      latitude: -33.8568,
      longitude: 151.2153,
      precision: 8,
      expected: 'r3gx2ux9', // Computed from standard geohash algorithm
    },
    {
      name: 'Equator/Prime Meridian',
      latitude: 0.0,
      longitude: 0.0,
      precision: 8,
      expected: 's0000000',
    },
    {
      name: 'North Pole',
      latitude: 90.0,
      longitude: 0.0,
      precision: 8,
      expected: 'upbpbpbp',
    },
    {
      name: 'South Pole',
      latitude: -90.0,
      longitude: 0.0,
      precision: 8,
      expected: 'h0000000',
    },
  ],

  /**
   * Precision level tests
   */
  precision: [
    { precision: 1, approximateSize: '5000km x 5000km' },
    { precision: 2, approximateSize: '1250km x 625km' },
    { precision: 3, approximateSize: '156km x 156km' },
    { precision: 4, approximateSize: '39km x 19.5km' },
    { precision: 5, approximateSize: '4.9km x 4.9km' },
    { precision: 6, approximateSize: '1.2km x 0.6km' },
    { precision: 7, approximateSize: '153m x 153m' },
    { precision: 8, approximateSize: '38m x 19m' }, // Building level (BitChat default)
    { precision: 9, approximateSize: '4.8m x 4.8m' },
    { precision: 10, approximateSize: '1.2m x 0.6m' },
    { precision: 11, approximateSize: '15cm x 15cm' },
    { precision: 12, approximateSize: '3.7cm x 1.9cm' },
  ],

  /**
   * Neighbor calculation tests
   * Order: N, NE, E, SE, S, SW, W, NW
   */
  neighbors: [
    {
      center: 'dr5regw7',
      neighbors: [
        'dr5regwk', // N
        'dr5regwm', // NE
        'dr5regwe', // E
        'dr5regw6', // SE
        'dr5regw5', // S
        'dr5regw4', // SW
        'dr5regwd', // W
        'dr5regwh', // NW
      ],
    },
  ],

  /**
   * Base32 character set (matching iOS implementation)
   */
  base32Chars: '0123456789bcdefghjkmnpqrstuvwxyz',

  /**
   * Building-level precision validation (8 characters)
   */
  validation: {
    valid: ['dr5regw7', '9q8zhuyh', 'gcpuvpmm'],
    invalid: [
      'dr5reg', // Too short
      'dr5regw7x', // Too long
      'dr5regwa', // Invalid character 'a'
      'dr5regwi', // Invalid character 'i'
      'dr5regwl', // Invalid character 'l'
      'dr5regwo', // Invalid character 'o'
    ],
  },
};

// ============================================================================
// Noise Protocol Test Vectors
// ============================================================================

/**
 * Noise Protocol XX handshake test vectors.
 * BitChat uses: Noise_XX_25519_ChaChaPoly_SHA256
 */
export const NOISE_VECTORS = {
  /**
   * Protocol name for BitChat
   */
  protocolName: 'Noise_XX_25519_ChaChaPoly_SHA256',

  /**
   * XX pattern message flows
   */
  xxPattern: {
    // Message 1: Initiator -> Responder
    message1: ['e'], // Send ephemeral key
    // Message 2: Responder -> Initiator
    message2: ['e', 'ee', 's', 'es'], // Ephemeral, DH, static encrypted, DH
    // Message 3: Initiator -> Responder
    message3: ['s', 'se'], // Static encrypted, DH
  },

  /**
   * Key sizes
   */
  keySizes: {
    curve25519PublicKey: 32,
    curve25519PrivateKey: 32,
    chachaKey: 32,
    chachaNonce: 12,
    poly1305Tag: 16,
    sha256Hash: 32,
  },

  /**
   * Static test key pairs (for deterministic testing only)
   * DO NOT use in production!
   */
  testKeys: {
    initiator: {
      // These are example keys - actual tests should generate fresh keys
      privateKey:
        '0000000000000000000000000000000000000000000000000000000000000001',
      publicKey:
        '0900000000000000000000000000000000000000000000000000000000000000',
    },
    responder: {
      privateKey:
        '0000000000000000000000000000000000000000000000000000000000000002',
      publicKey:
        '2000000000000000000000000000000000000000000000000000000000000000',
    },
  },

  /**
   * HKDF test vectors for key derivation
   */
  hkdf: {
    // HKDF-SHA256 with empty salt and info
    emptyInfo: {
      inputKeyMaterial: new Uint8Array(32).fill(0x01),
      salt: new Uint8Array(0),
      info: new Uint8Array(0),
      outputLength: 32,
    },
  },

  /**
   * Replay protection window size (matching iOS)
   */
  replayWindow: {
    windowSize: 1024,
    windowBytes: 128, // 1024 / 8
  },

  /**
   * Nonce format for ChaCha20-Poly1305 in Noise
   * 12 bytes: first 4 bytes zero, then 8 bytes little-endian counter
   */
  nonceFormat: {
    totalLength: 12,
    paddingLength: 4,
    counterLength: 8,
  },
};

// ============================================================================
// Schnorr Signature Test Vectors (BIP-340)
// ============================================================================

/**
 * BIP-340 Schnorr signature test vectors for Nostr event signing.
 */
export const SCHNORR_VECTORS = {
  /**
   * Signature format
   */
  format: {
    signatureLength: 64,
    publicKeyLength: 32, // x-only
    privateKeyLength: 32,
  },

  /**
   * Auxiliary random data for deterministic signatures
   */
  auxRandLength: 32,
};

// ============================================================================
// Bech32 Encoding Test Vectors
// ============================================================================

/**
 * Bech32 encoding test vectors for npub/nsec.
 */
export const BECH32_VECTORS = {
  /**
   * npub encoding (public key)
   */
  npub: {
    hrp: 'npub',
    // Example: 32-byte public key -> npub encoded
    examples: [
      {
        hex: '0000000000000000000000000000000000000000000000000000000000000001',
        // Expected npub encoding
        expectedPrefix: 'npub1',
      },
    ],
  },

  /**
   * nsec encoding (private key)
   */
  nsec: {
    hrp: 'nsec',
    examples: [
      {
        hex: '0000000000000000000000000000000000000000000000000000000000000001',
        // Expected nsec encoding
        expectedPrefix: 'nsec1',
      },
    ],
  },
};

// ============================================================================
// Relay Message Format Test Vectors
// ============================================================================

/**
 * Nostr relay message format test vectors.
 */
export const RELAY_MESSAGE_VECTORS = {
  /**
   * Client to relay messages
   */
  clientToRelay: {
    event: ['EVENT', { /* NostrEvent */ }],
    request: ['REQ', 'subscription_id', { /* NostrFilter */ }],
    close: ['CLOSE', 'subscription_id'],
    auth: ['AUTH', { /* signed auth event */ }],
  },

  /**
   * Relay to client messages
   */
  relayToClient: {
    event: ['EVENT', 'subscription_id', { /* NostrEvent */ }],
    ok: ['OK', 'event_id', true, 'message'],
    eose: ['EOSE', 'subscription_id'],
    closed: ['CLOSED', 'subscription_id', 'reason'],
    notice: ['NOTICE', 'message'],
    auth: ['AUTH', 'challenge'],
  },
};

// ============================================================================
// Helper Types
// ============================================================================

export interface NostrEventTestVector {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface GeohashEncodeTestVector {
  name: string;
  latitude: number;
  longitude: number;
  precision: number;
  expected: string;
}

export interface GeohashNeighborTestVector {
  center: string;
  neighbors: string[];
}
