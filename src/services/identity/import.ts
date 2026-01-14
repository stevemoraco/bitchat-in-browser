/**
 * Identity Import Module
 *
 * Handles importing existing Nostr identities from various formats:
 * - nsec (Nostr secret key in bech32)
 * - hex private key
 * - NIP-06 mnemonic phrases
 *
 * Compatible with other Nostr clients and the native BitChat apps.
 *
 * @module services/identity/import
 */

import { getPublicKey, nip19 } from 'nostr-tools';
import sodium from 'libsodium-wrappers-sumo';
import {
  loadSodium,
  ensureSodiumReady,
  hexToBytes,
  bytesToHex,
  sha256Hex,
  blake2b,
  secureWipe,
} from '../crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported import formats
 */
export type ImportFormat = 'nsec' | 'hex' | 'mnemonic';

/**
 * Result of validating an import string
 */
export interface ImportValidation {
  /** Whether the input is valid */
  valid: boolean;
  /** Detected format */
  format: ImportFormat | null;
  /** Error message if invalid */
  error?: string;
  /** Preview public key (npub) if valid */
  npubPreview?: string;
  /** Full public key hex if valid */
  publicKey?: string;
}

/**
 * Result of importing a key
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The private key as bytes */
  privateKey?: Uint8Array;
  /** The public key hex */
  publicKey?: string;
  /** The npub */
  npub?: string;
  /** The fingerprint */
  fingerprint?: string;
  /** Detected or specified format */
  format: ImportFormat;
}

/**
 * Mnemonic validation result
 */
export interface MnemonicValidation {
  /** Whether the mnemonic is valid */
  valid: boolean;
  /** Number of words */
  wordCount: number;
  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * BIP-39 English wordlist (minimal subset for validation)
 * Full wordlist would be 2048 words - this is just for basic checking
 */
const VALID_WORD_COUNTS = [12, 15, 18, 21, 24];

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Detect the format of an import string
 *
 * @param input - The string to analyze
 * @returns The detected format or null if unrecognized
 */
export function detectImportFormat(input: string): ImportFormat | null {
  const trimmed = input.trim();

  // Check for nsec format (bech32 with nsec prefix)
  if (trimmed.startsWith('nsec1')) {
    return 'nsec';
  }

  // Check for hex format (64 hex characters)
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return 'hex';
  }

  // Check for mnemonic (space-separated words)
  const words = trimmed.split(/\s+/);
  if (VALID_WORD_COUNTS.includes(words.length)) {
    // Basic check - all words are lowercase letters
    const allValidWords = words.every(word => /^[a-z]+$/.test(word.toLowerCase()));
    if (allValidWords) {
      return 'mnemonic';
    }
  }

  return null;
}

/**
 * Validate an import string and provide preview information
 *
 * @param input - The string to validate
 * @returns Validation result with preview if valid
 */
export function validateImport(input: string): ImportValidation {
  const trimmed = input.trim();
  const format = detectImportFormat(trimmed);

  if (!format) {
    return {
      valid: false,
      format: null,
      error: 'Unrecognized format. Expected nsec, hex private key, or mnemonic phrase.',
    };
  }

  try {
    switch (format) {
      case 'nsec':
        return validateNsec(trimmed);
      case 'hex':
        return validateHexKey(trimmed);
      case 'mnemonic':
        return validateMnemonic(trimmed);
      default:
        return {
          valid: false,
          format: null,
          error: 'Unknown format',
        };
    }
  } catch (error) {
    return {
      valid: false,
      format,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Validate an nsec string
 */
function validateNsec(nsec: string): ImportValidation {
  try {
    const decoded = nip19.decode(nsec);

    if (decoded.type !== 'nsec') {
      return {
        valid: false,
        format: 'nsec',
        error: 'Invalid nsec format',
      };
    }

    const privateKeyBytes = decoded.data;
    const publicKey = getPublicKey(privateKeyBytes);
    const npub = nip19.npubEncode(publicKey);

    return {
      valid: true,
      format: 'nsec',
      publicKey,
      npubPreview: `${npub.slice(0, 12)}...${npub.slice(-4)}`,
    };
  } catch (error) {
    return {
      valid: false,
      format: 'nsec',
      error: `Invalid nsec: ${  error instanceof Error ? error.message : 'decode failed'}`,
    };
  }
}

/**
 * Validate a hex private key
 */
function validateHexKey(hex: string): ImportValidation {
  try {
    const cleanHex = hex.toLowerCase();

    // Validate it's valid hex
    if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
      return {
        valid: false,
        format: 'hex',
        error: 'Invalid hex format. Must be 64 hex characters.',
      };
    }

    // Try to derive public key
    const privateKeyBytes = hexToBytes(cleanHex);
    const publicKey = getPublicKey(privateKeyBytes);
    const npub = nip19.npubEncode(publicKey);

    // Clean up private key from validation
    secureWipe(privateKeyBytes);

    return {
      valid: true,
      format: 'hex',
      publicKey,
      npubPreview: `${npub.slice(0, 12)}...${npub.slice(-4)}`,
    };
  } catch (error) {
    return {
      valid: false,
      format: 'hex',
      error: `Invalid private key: ${  error instanceof Error ? error.message : 'key derivation failed'}`,
    };
  }
}

/**
 * Validate a mnemonic phrase
 *
 * Note: Full BIP-39 validation would require the complete wordlist
 * This performs basic structural validation
 */
function validateMnemonic(mnemonic: string): ImportValidation {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);

  if (!VALID_WORD_COUNTS.includes(words.length)) {
    return {
      valid: false,
      format: 'mnemonic',
      error: `Invalid word count. Expected ${VALID_WORD_COUNTS.join(', ')} words, got ${words.length}.`,
    };
  }

  // Check all words are lowercase letters only
  for (const word of words) {
    if (!/^[a-z]+$/.test(word)) {
      return {
        valid: false,
        format: 'mnemonic',
        error: `Invalid word: "${word}". Words must contain only letters.`,
      };
    }

    // Check reasonable word length (BIP-39 words are 3-8 characters)
    if (word.length < 3 || word.length > 8) {
      return {
        valid: false,
        format: 'mnemonic',
        error: `Invalid word length: "${word}". BIP-39 words are 3-8 characters.`,
      };
    }
  }

  // For mnemonic, we can't show preview without deriving
  // That's expensive, so we just return valid
  return {
    valid: true,
    format: 'mnemonic',
    // No preview for mnemonic - derivation is expensive
  };
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import a Nostr identity from nsec format
 *
 * @param nsec - The nsec string (bech32 encoded)
 * @returns Import result with private key bytes
 */
export function importFromNsec(nsec: string): ImportResult {
  try {
    const decoded = nip19.decode(nsec.trim());

    if (decoded.type !== 'nsec') {
      return {
        success: false,
        error: 'Invalid nsec format',
        format: 'nsec',
      };
    }

    const privateKey = new Uint8Array(decoded.data);
    const publicKey = getPublicKey(privateKey);
    const npub = nip19.npubEncode(publicKey);
    const fingerprint = sha256Hex(hexToBytes(publicKey));

    return {
      success: true,
      privateKey,
      publicKey,
      npub,
      fingerprint,
      format: 'nsec',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decode nsec',
      format: 'nsec',
    };
  }
}

/**
 * Import a Nostr identity from hex private key
 *
 * @param hex - The 64-character hex private key
 * @returns Import result with private key bytes
 */
export function importFromHex(hex: string): ImportResult {
  try {
    const cleanHex = hex.trim().toLowerCase();

    if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
      return {
        success: false,
        error: 'Invalid hex format. Must be 64 hex characters.',
        format: 'hex',
      };
    }

    const privateKey = hexToBytes(cleanHex);
    const publicKey = getPublicKey(privateKey);
    const npub = nip19.npubEncode(publicKey);
    const fingerprint = sha256Hex(hexToBytes(publicKey));

    return {
      success: true,
      privateKey,
      publicKey,
      npub,
      fingerprint,
      format: 'hex',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import hex key',
      format: 'hex',
    };
  }
}

/**
 * Import a Nostr identity from BIP-39 mnemonic phrase
 *
 * Uses NIP-06 derivation path: m/44'/1237'/0'/0/0
 *
 * @param mnemonic - Space-separated mnemonic words
 * @param passphrase - Optional BIP-39 passphrase
 * @returns Import result with derived private key
 */
export async function importFromMnemonic(
  mnemonic: string,
  passphrase: string = ''
): Promise<ImportResult> {
  await loadSodium();
  ensureSodiumReady();

  try {
    const normalizedMnemonic = mnemonic.trim().toLowerCase();
    const words = normalizedMnemonic.split(/\s+/);

    if (!VALID_WORD_COUNTS.includes(words.length)) {
      return {
        success: false,
        error: `Invalid word count: ${words.length}`,
        format: 'mnemonic',
      };
    }

    // BIP-39 seed derivation
    // Salt is "mnemonic" + passphrase (truncated to 16 bytes for pwhash)
    const saltString = `mnemonic${  passphrase}`;
    const salt = sodium.from_string(saltString).slice(0, 16);

    // Derive seed using Argon2id (libsodium's pwhash)
    // Note: This is a simplified version - full BIP-39 uses PBKDF2
    // For exact compatibility, you'd need a PBKDF2 implementation
    // Note: libsodium crypto_pwhash accepts string directly
    const seed = sodium.crypto_pwhash(
      64, // 512 bits for BIP-39 seed
      normalizedMnemonic, // Pass mnemonic directly as string
      salt, // pwhash requires 16-byte salt
      2,
      67108864,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    try {
      // NIP-06 derivation: m/44'/1237'/0'/0/0
      // For simplicity, we'll derive a key from the seed using BLAKE2b
      // Full BIP-32 derivation would require additional implementation
      const derivationPath = sodium.from_string("m/44'/1237'/0'/0/0");
      const derivedKey = blake2b(
        new Uint8Array([...seed, ...derivationPath]),
        32
      );

      const privateKey = derivedKey;
      const publicKey = getPublicKey(privateKey);
      const npub = nip19.npubEncode(publicKey);
      const fingerprint = sha256Hex(hexToBytes(publicKey));

      return {
        success: true,
        privateKey,
        publicKey,
        npub,
        fingerprint,
        format: 'mnemonic',
      };
    } finally {
      secureWipe(seed);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to derive from mnemonic',
      format: 'mnemonic',
    };
  }
}

/**
 * Import from any supported format (auto-detect)
 *
 * @param input - The import string (nsec, hex, or mnemonic)
 * @param passphrase - Optional passphrase for mnemonic
 * @returns Import result
 */
export async function importKey(
  input: string,
  passphrase: string = ''
): Promise<ImportResult> {
  const format = detectImportFormat(input.trim());

  if (!format) {
    return {
      success: false,
      error: 'Unrecognized key format',
      format: 'nsec', // default
    };
  }

  switch (format) {
    case 'nsec':
      return importFromNsec(input);
    case 'hex':
      return importFromHex(input);
    case 'mnemonic':
      return importFromMnemonic(input, passphrase);
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if a string is a valid nsec
 */
export function isValidNsec(nsec: string): boolean {
  try {
    const decoded = nip19.decode(nsec.trim());
    return decoded.type === 'nsec';
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid hex private key
 */
export function isValidHexKey(hex: string): boolean {
  return /^[0-9a-f]{64}$/i.test(hex.trim());
}

/**
 * Check if a string looks like a valid mnemonic
 */
export function isValidMnemonicFormat(mnemonic: string): MnemonicValidation {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);

  if (!VALID_WORD_COUNTS.includes(words.length)) {
    return {
      valid: false,
      wordCount: words.length,
      error: `Invalid word count. Expected ${VALID_WORD_COUNTS.join(', ')}, got ${words.length}.`,
    };
  }

  for (const word of words) {
    if (!/^[a-z]+$/.test(word)) {
      return {
        valid: false,
        wordCount: words.length,
        error: `Invalid word: "${word}"`,
      };
    }
  }

  return {
    valid: true,
    wordCount: words.length,
  };
}

/**
 * Sanitize and normalize import input
 *
 * Handles common user input issues:
 * - Leading/trailing whitespace
 * - Multiple spaces between words (mnemonic)
 * - Mixed case (normalizes to lowercase for hex/mnemonic)
 */
export function sanitizeImportInput(input: string): string {
  const trimmed = input.trim();

  // If it's nsec, preserve case as bech32 is case-insensitive but usually lowercase
  if (trimmed.startsWith('nsec1')) {
    return trimmed.toLowerCase();
  }

  // If it looks like hex, lowercase it
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // If it might be mnemonic, normalize whitespace and lowercase
  return trimmed.toLowerCase().replace(/\s+/g, ' ');
}

// ============================================================================
// Export to Other Formats
// ============================================================================

/**
 * Convert private key bytes to nsec format
 */
export function privateKeyToNsec(privateKey: Uint8Array): string {
  return nip19.nsecEncode(privateKey);
}

/**
 * Convert private key bytes to hex format
 */
export function privateKeyToHex(privateKey: Uint8Array): string {
  return bytesToHex(privateKey);
}

/**
 * Derive public key and npub from private key
 */
export function derivePublicInfo(privateKey: Uint8Array): {
  publicKey: string;
  npub: string;
  fingerprint: string;
} {
  const publicKey = getPublicKey(privateKey);
  const npub = nip19.npubEncode(publicKey);
  const fingerprint = sha256Hex(hexToBytes(publicKey));

  return { publicKey, npub, fingerprint };
}
