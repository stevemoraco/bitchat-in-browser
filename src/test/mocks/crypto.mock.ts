/**
 * Crypto Mock - Mock libsodium and cryptographic operations
 *
 * Provides deterministic mock implementations for testing cryptographic
 * functionality without actual cryptographic operations.
 */

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface MockKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface MockNoiseSession {
  isInitiator: boolean;
  localKeyPair: MockKeyPair;
  remotePublicKey: Uint8Array | null;
  handshakeComplete: boolean;
  sendKey: Uint8Array | null;
  receiveKey: Uint8Array | null;
}

// ============================================================================
// Deterministic Random Generation
// ============================================================================

let randomSeed = 12345;

/**
 * Resettable pseudo-random number generator for deterministic testing
 */
export function resetRandomSeed(seed: number = 12345): void {
  randomSeed = seed;
}

function nextRandom(): number {
  randomSeed = (randomSeed * 1103515245 + 12345) & 0x7fffffff;
  return randomSeed / 0x7fffffff;
}

function generateDeterministicBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(nextRandom() * 256);
  }
  return bytes;
}

// ============================================================================
// Mock libsodium
// ============================================================================

export const mockSodium = {
  // Initialization
  ready: Promise.resolve(),

  // Constants
  crypto_box_PUBLICKEYBYTES: 32,
  crypto_box_SECRETKEYBYTES: 32,
  crypto_box_NONCEBYTES: 24,
  crypto_box_MACBYTES: 16,
  crypto_secretbox_KEYBYTES: 32,
  crypto_secretbox_NONCEBYTES: 24,
  crypto_secretbox_MACBYTES: 16,
  crypto_sign_PUBLICKEYBYTES: 32,
  crypto_sign_SECRETKEYBYTES: 64,
  crypto_sign_BYTES: 64,
  crypto_kx_PUBLICKEYBYTES: 32,
  crypto_kx_SECRETKEYBYTES: 32,
  crypto_kx_SESSIONKEYBYTES: 32,
  crypto_hash_sha256_BYTES: 32,
  crypto_hash_sha512_BYTES: 64,

  // Random
  randombytes_buf: vi.fn((length: number): Uint8Array => {
    return generateDeterministicBytes(length);
  }),

  // Box (X25519 + XSalsa20-Poly1305)
  crypto_box_keypair: vi.fn((): MockKeyPair => {
    return {
      publicKey: generateDeterministicBytes(32),
      privateKey: generateDeterministicBytes(32),
    };
  }),

  crypto_box_easy: vi.fn(
    (
      message: Uint8Array,
      nonce: Uint8Array,
      _theirPublicKey: Uint8Array,
      _mySecretKey: Uint8Array
    ): Uint8Array => {
      // Mock encryption: prepend 'BOX:' marker + nonce + message
      const marker = new TextEncoder().encode('BOX:');
      const result = new Uint8Array(marker.length + nonce.length + message.length);
      result.set(marker);
      result.set(nonce, marker.length);
      result.set(message, marker.length + nonce.length);
      return result;
    }
  ),

  crypto_box_open_easy: vi.fn(
    (
      ciphertext: Uint8Array,
      nonce: Uint8Array,
      _theirPublicKey: Uint8Array,
      _mySecretKey: Uint8Array
    ): Uint8Array => {
      // Mock decryption: extract message from after marker and nonce
      const markerLength = 4; // 'BOX:'
      const messageStart = markerLength + nonce.length;
      return ciphertext.slice(messageStart);
    }
  ),

  // SecretBox (XSalsa20-Poly1305)
  crypto_secretbox_keygen: vi.fn((): Uint8Array => {
    return generateDeterministicBytes(32);
  }),

  crypto_secretbox_easy: vi.fn(
    (message: Uint8Array, _nonce: Uint8Array, key: Uint8Array): Uint8Array => {
      // Mock encryption: XOR with key (simplified)
      const result = new Uint8Array(message.length + 16); // Include MAC
      for (let i = 0; i < message.length; i++) {
        const keyByte = key[i % key.length];
        result[i] = message[i]! ^ (keyByte ?? 0);
      }
      // Add mock MAC
      result.set(generateDeterministicBytes(16), message.length);
      return result;
    }
  ),

  crypto_secretbox_open_easy: vi.fn(
    (ciphertext: Uint8Array, _nonce: Uint8Array, key: Uint8Array): Uint8Array => {
      // Mock decryption: XOR with key (simplified)
      const messageLength = ciphertext.length - 16;
      const result = new Uint8Array(messageLength);
      for (let i = 0; i < messageLength; i++) {
        const keyByte = key[i % key.length];
        result[i] = (ciphertext[i] ?? 0) ^ (keyByte ?? 0);
      }
      return result;
    }
  ),

  // Sign (Ed25519)
  crypto_sign_keypair: vi.fn((): { publicKey: Uint8Array; privateKey: Uint8Array } => {
    return {
      publicKey: generateDeterministicBytes(32),
      privateKey: generateDeterministicBytes(64),
    };
  }),

  crypto_sign: vi.fn((message: Uint8Array, _secretKey: Uint8Array): Uint8Array => {
    // Return signature + message
    const signature = generateDeterministicBytes(64);
    const result = new Uint8Array(64 + message.length);
    result.set(signature);
    result.set(message, 64);
    return result;
  }),

  crypto_sign_open: vi.fn((signedMessage: Uint8Array, _publicKey: Uint8Array): Uint8Array => {
    // Extract message (skip signature)
    return signedMessage.slice(64);
  }),

  crypto_sign_detached: vi.fn((_message: Uint8Array, _secretKey: Uint8Array): Uint8Array => {
    return generateDeterministicBytes(64);
  }),

  crypto_sign_verify_detached: vi.fn(
    (_signature: Uint8Array, _message: Uint8Array, _publicKey: Uint8Array): boolean => {
      return true; // Always verify in tests
    }
  ),

  crypto_sign_ed25519_pk_to_curve25519: vi.fn((edPk: Uint8Array): Uint8Array => {
    // Mock conversion: XOR with a constant
    const result = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      result[i] = (edPk[i] ?? 0) ^ 0x42;
    }
    return result;
  }),

  crypto_sign_ed25519_sk_to_curve25519: vi.fn((edSk: Uint8Array): Uint8Array => {
    // Mock conversion: take first 32 bytes and XOR
    const result = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      result[i] = (edSk[i] ?? 0) ^ 0x24;
    }
    return result;
  }),

  // Key Exchange (X25519)
  crypto_kx_keypair: vi.fn((): MockKeyPair => {
    return {
      publicKey: generateDeterministicBytes(32),
      privateKey: generateDeterministicBytes(32),
    };
  }),

  crypto_kx_client_session_keys: vi.fn(
    (
      _clientPk: Uint8Array,
      _clientSk: Uint8Array,
      _serverPk: Uint8Array
    ): { sharedRx: Uint8Array; sharedTx: Uint8Array } => {
      return {
        sharedRx: generateDeterministicBytes(32),
        sharedTx: generateDeterministicBytes(32),
      };
    }
  ),

  crypto_kx_server_session_keys: vi.fn(
    (
      _serverPk: Uint8Array,
      _serverSk: Uint8Array,
      _clientPk: Uint8Array
    ): { sharedRx: Uint8Array; sharedTx: Uint8Array } => {
      return {
        sharedRx: generateDeterministicBytes(32),
        sharedTx: generateDeterministicBytes(32),
      };
    }
  ),

  // Hashing
  crypto_hash_sha256: vi.fn((message: Uint8Array): Uint8Array => {
    // Simple mock hash based on message content
    const hash = new Uint8Array(32);
    for (let i = 0; i < message.length; i++) {
      const msgByte = message[i] ?? 0;
      const hashIdx = i % 32;
      hash[hashIdx] = (hash[hashIdx] ?? 0) ^ msgByte;
    }
    return hash;
  }),

  crypto_hash_sha512: vi.fn((message: Uint8Array): Uint8Array => {
    // Simple mock hash based on message content
    const hash = new Uint8Array(64);
    for (let i = 0; i < message.length; i++) {
      const msgByte = message[i] ?? 0;
      const hashIdx = i % 64;
      hash[hashIdx] = (hash[hashIdx] ?? 0) ^ msgByte;
    }
    return hash;
  }),

  crypto_generichash: vi.fn((length: number, message: Uint8Array, _key?: Uint8Array): Uint8Array => {
    const hash = new Uint8Array(length);
    for (let i = 0; i < message.length; i++) {
      const msgByte = message[i] ?? 0;
      const hashIdx = i % length;
      hash[hashIdx] = (hash[hashIdx] ?? 0) ^ msgByte;
    }
    return hash;
  }),

  // Scalarmult (X25519)
  crypto_scalarmult: vi.fn((_n: Uint8Array, _p: Uint8Array): Uint8Array => {
    return generateDeterministicBytes(32);
  }),

  crypto_scalarmult_base: vi.fn((_n: Uint8Array): Uint8Array => {
    return generateDeterministicBytes(32);
  }),

  // Memory utilities
  memzero: vi.fn((buffer: Uint8Array): void => {
    buffer.fill(0);
  }),

  memcmp: vi.fn((a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }),

  // Encoding
  to_hex: vi.fn((bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }),

  from_hex: vi.fn((hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }),

  to_base64: vi.fn((bytes: Uint8Array): string => {
    return btoa(String.fromCharCode(...bytes));
  }),

  from_base64: vi.fn((base64: string): Uint8Array => {
    return new Uint8Array(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  }),

  to_string: vi.fn((bytes: Uint8Array): string => {
    return new TextDecoder().decode(bytes);
  }),

  from_string: vi.fn((str: string): Uint8Array => {
    return new TextEncoder().encode(str);
  }),
};

// ============================================================================
// Mock Noise Protocol Session
// ============================================================================

export function createMockNoiseSession(isInitiator: boolean): MockNoiseSession {
  resetRandomSeed(); // Ensure deterministic keys

  return {
    isInitiator,
    localKeyPair: {
      publicKey: generateDeterministicBytes(32),
      privateKey: generateDeterministicBytes(32),
    },
    remotePublicKey: null,
    handshakeComplete: false,
    sendKey: null,
    receiveKey: null,
  };
}

export const mockNoiseProtocol = {
  createSession: vi.fn((isInitiator: boolean) => createMockNoiseSession(isInitiator)),

  performHandshake: vi.fn(
    async (
      session: MockNoiseSession,
      remotePublicKey: Uint8Array
    ): Promise<{ sendKey: Uint8Array; receiveKey: Uint8Array }> => {
      session.remotePublicKey = remotePublicKey;
      session.handshakeComplete = true;

      const sendKey = generateDeterministicBytes(32);
      const receiveKey = generateDeterministicBytes(32);

      session.sendKey = sendKey;
      session.receiveKey = receiveKey;

      return { sendKey, receiveKey };
    }
  ),

  encrypt: vi.fn((session: MockNoiseSession, plaintext: Uint8Array): Uint8Array => {
    if (!session.sendKey) throw new Error('Session not established');
    // Mock encryption
    const result = new Uint8Array(plaintext.length + 16);
    for (let i = 0; i < plaintext.length; i++) {
      const keyByte = session.sendKey[i % 32] ?? 0;
      result[i] = (plaintext[i] ?? 0) ^ keyByte;
    }
    return result;
  }),

  decrypt: vi.fn((session: MockNoiseSession, ciphertext: Uint8Array): Uint8Array => {
    if (!session.receiveKey) throw new Error('Session not established');
    // Mock decryption
    const plaintextLength = ciphertext.length - 16;
    const result = new Uint8Array(plaintextLength);
    for (let i = 0; i < plaintextLength; i++) {
      const keyByte = session.receiveKey[i % 32] ?? 0;
      result[i] = (ciphertext[i] ?? 0) ^ keyByte;
    }
    return result;
  }),
};

// ============================================================================
// Mock ChaCha20-Poly1305
// ============================================================================

export const mockChaCha20Poly1305 = {
  encrypt: vi.fn(
    (key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, _aad?: Uint8Array): Uint8Array => {
      // Mock encryption
      const result = new Uint8Array(plaintext.length + 16);
      for (let i = 0; i < plaintext.length; i++) {
        const keyByte = key[i % key.length] ?? 0;
        const nonceByte = nonce[i % nonce.length] ?? 0;
        result[i] = (plaintext[i] ?? 0) ^ keyByte ^ nonceByte;
      }
      // Mock auth tag
      result.set(generateDeterministicBytes(16), plaintext.length);
      return result;
    }
  ),

  decrypt: vi.fn(
    (key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, _aad?: Uint8Array): Uint8Array => {
      // Mock decryption
      const plaintextLength = ciphertext.length - 16;
      const result = new Uint8Array(plaintextLength);
      for (let i = 0; i < plaintextLength; i++) {
        const keyByte = key[i % key.length] ?? 0;
        const nonceByte = nonce[i % nonce.length] ?? 0;
        result[i] = (ciphertext[i] ?? 0) ^ keyByte ^ nonceByte;
      }
      return result;
    }
  ),
};

// ============================================================================
// Installation helpers
// ============================================================================

export function installCryptoMocks(): void {
  vi.mock('libsodium-wrappers-sumo', () => ({
    default: mockSodium,
    ready: mockSodium.ready,
  }));
}

export function resetCryptoMocks(): void {
  resetRandomSeed();

  Object.values(mockSodium).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) {
      value.mockClear();
    }
  });

  Object.values(mockNoiseProtocol).forEach((fn) => {
    if ('mockClear' in fn) fn.mockClear();
  });

  Object.values(mockChaCha20Poly1305).forEach((fn) => {
    if ('mockClear' in fn) fn.mockClear();
  });
}

// ============================================================================
// Exports
// ============================================================================

export { generateDeterministicBytes };
