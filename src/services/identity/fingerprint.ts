/**
 * Visual Fingerprint Generation
 *
 * Creates human-verifiable visual representations of public keys
 * for identity verification. Supports multiple formats:
 * - Text fingerprints (hex groups)
 * - Color patterns (for visual comparison)
 * - Emoji sequences (memorable verification)
 * - SSH-style randomart (visual hash)
 *
 * Compatible with iOS BitChat fingerprint display for cross-platform
 * verification between web and native apps.
 *
 * @module services/identity/fingerprint
 */

import sodium from 'libsodium-wrappers-sumo';
import {
  ensureSodiumReady,
  sha256,
  hexToBytes,
  bytesToHex,
} from '../crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Complete fingerprint representation with multiple formats
 */
export interface VisualFingerprint {
  /** Raw SHA-256 hash bytes */
  hash: Uint8Array;
  /** Full hex representation (64 chars) */
  hex: string;
  /** Formatted with colons (XX:XX:XX...) */
  formatted: string;
  /** Short identifier (first 16 chars) */
  short: string;
  /** Color pattern for visual verification */
  colors: FingerprintColors;
  /** Emoji sequence for memorable verification */
  emoji: string;
  /** SSH-style randomart */
  randomart: string;
  /** Blocks of 4 chars separated by spaces */
  blocks: string;
}

/**
 * Color pattern derived from fingerprint
 */
export interface FingerprintColors {
  /** Primary color (hex RGB) */
  primary: string;
  /** Secondary color (hex RGB) */
  secondary: string;
  /** Tertiary color (hex RGB) */
  tertiary: string;
  /** Array of 8 colors for gradient/pattern */
  palette: string[];
  /** CSS gradient string */
  gradient: string;
}

/**
 * Comparison result between two fingerprints
 */
export interface FingerprintComparison {
  /** Whether fingerprints match exactly */
  match: boolean;
  /** Similarity score (0-100) */
  similarity: number;
  /** Number of matching hex characters */
  matchingChars: number;
  /** Number of matching color blocks */
  matchingColors: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Emoji set for fingerprint encoding
 * 256 distinct emoji for 1:1 byte mapping
 */
const FINGERPRINT_EMOJI = [
  // Animals (32)
  '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}',
  '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F412}',
  '\u{1F414}', '\u{1F427}', '\u{1F426}', '\u{1F989}', '\u{1F987}', '\u{1F40B}', '\u{1F42C}', '\u{1F41F}',
  '\u{1F420}', '\u{1F419}', '\u{1F982}', '\u{1F980}', '\u{1F40C}', '\u{1F98B}', '\u{1F41D}', '\u{1F41B}',
  // Food (32)
  '\u{1F34E}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', '\u{1F347}', '\u{1F353}', '\u{1F352}', '\u{1F351}',
  '\u{1F34D}', '\u{1F95D}', '\u{1F965}', '\u{1F951}', '\u{1F346}', '\u{1F955}', '\u{1F33D}', '\u{1F336}',
  '\u{1F350}', '\u{1F96C}', '\u{1F966}', '\u{1F9C5}', '\u{1F954}', '\u{1F360}', '\u{1F950}', '\u{1F956}',
  '\u{1F968}', '\u{1F96F}', '\u{1F95E}', '\u{1F9C7}', '\u{1F354}', '\u{1F35F}', '\u{1F355}', '\u{1F32D}',
  // Nature (32)
  '\u{1F332}', '\u{1F333}', '\u{1F334}', '\u{1F335}', '\u{1F33B}', '\u{1F33C}', '\u{1F337}', '\u{1F339}',
  '\u{1F33A}', '\u{1F338}', '\u{1F340}', '\u{1F341}', '\u{1F342}', '\u{1F343}', '\u{1F344}', '\u{1F330}',
  '\u{2600}\u{FE0F}', '\u{1F324}', '\u{26C5}', '\u{1F327}', '\u{26C8}', '\u{1F308}', '\u{2744}\u{FE0F}', '\u{1F32C}',
  '\u{1F30A}', '\u{1F30B}', '\u{1F3D4}', '\u{1F3DD}', '\u{1F3D6}', '\u{1F3DC}', '\u{1F3DE}', '\u{1F305}',
  // Objects (32)
  '\u{2764}\u{FE0F}', '\u{1F499}', '\u{1F49A}', '\u{1F49B}', '\u{1F49C}', '\u{1F5A4}', '\u{1F90E}', '\u{1F90D}',
  '\u{2B50}', '\u{1F31F}', '\u{2728}', '\u{1F4AB}', '\u{1F525}', '\u{1F4A7}', '\u{1F4A8}', '\u{1F300}',
  '\u{1F48E}', '\u{1F3B5}', '\u{1F3B6}', '\u{1F3A4}', '\u{1F3B8}', '\u{1F3B9}', '\u{1F941}', '\u{1F3AF}',
  '\u{1F3AE}', '\u{1F3B2}', '\u{1F9E9}', '\u{1F511}', '\u{1F512}', '\u{1F513}', '\u{1F50D}', '\u{1F526}',
  // Transport (32)
  '\u{1F697}', '\u{1F695}', '\u{1F68C}', '\u{1F3CE}', '\u{1F6F5}', '\u{1F6B2}', '\u{1F6F4}', '\u{1F6B6}',
  '\u{1F681}', '\u{1F6EB}', '\u{1F6EC}', '\u{1F680}', '\u{1F6F8}', '\u{1F6F6}', '\u{26F5}', '\u{1F6A2}',
  '\u{1F682}', '\u{1F686}', '\u{1F688}', '\u{1F684}', '\u{1F685}', '\u{1F687}', '\u{1F683}', '\u{1F69D}',
  '\u{1F6A7}', '\u{2693}', '\u{26FD}', '\u{1F6A6}', '\u{1F6A8}', '\u{1F6A4}', '\u{1F6F3}', '\u{26F4}',
  // Symbols (32)
  '\u{2705}', '\u{274C}', '\u{2B55}', '\u{2757}', '\u{2753}', '\u{1F4A1}', '\u{1F4A4}', '\u{1F4AC}',
  '\u{1F4AD}', '\u{1F5E8}', '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u{270A}', '\u{270C}\u{FE0F}', '\u{1F91E}',
  '\u{1F44B}', '\u{1F64C}', '\u{1F64F}', '\u{1F91D}', '\u{1F4AA}', '\u{1F9E0}', '\u{1F441}', '\u{1F440}',
  '\u{1F442}', '\u{1F443}', '\u{1F463}', '\u{1F4A5}', '\u{1F4A2}', '\u{1F4AF}', '\u{1F3C6}', '\u{1F3C5}',
  // Buildings (32)
  '\u{1F3E0}', '\u{1F3E1}', '\u{1F3E2}', '\u{1F3E3}', '\u{1F3E4}', '\u{1F3E5}', '\u{1F3E6}', '\u{1F3E8}',
  '\u{1F3E9}', '\u{1F3EA}', '\u{1F3EB}', '\u{1F3EC}', '\u{1F3ED}', '\u{1F3EF}', '\u{1F3F0}', '\u{1F5FC}',
  '\u{1F5FD}', '\u{26EA}', '\u{1F54C}', '\u{1F54D}', '\u{26E9}', '\u{1F6D5}', '\u{26F2}', '\u{26FA}',
  '\u{1F3D7}', '\u{1F3D8}', '\u{1F3D9}', '\u{1F3DA}', '\u{1F3DB}', '\u{1F3AA}', '\u{1F3A0}', '\u{1F3A1}',
  // Misc (32)
  '\u{1F47D}', '\u{1F916}', '\u{1F383}', '\u{1F47B}', '\u{1F480}', '\u{1F47A}', '\u{1F479}', '\u{1F47F}',
  '\u{1F608}', '\u{1F31A}', '\u{1F31B}', '\u{1F31C}', '\u{1F31D}', '\u{1F31E}', '\u{1FA90}', '\u{2604}\u{FE0F}',
  '\u{1F6CE}', '\u{1F9F2}', '\u{1F52E}', '\u{1F52C}', '\u{1F52D}', '\u{1F4E1}', '\u{1F4BB}', '\u{1F4F1}',
  '\u{1F50B}', '\u{1F4BF}', '\u{1F4BE}', '\u{1F4BD}', '\u{1F5A8}', '\u{1F3A8}', '\u{1F58C}', '\u{1F58D}',
];

/**
 * Characters for SSH-style randomart
 */
const RANDOMART_CHARS = ' .o+=*BOX@%&#/^SE';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate a complete visual fingerprint from a public key
 *
 * @param publicKey - Public key as bytes or hex string
 * @returns Complete fingerprint with all representations
 */
export function generateVisualFingerprint(
  publicKey: Uint8Array | string
): VisualFingerprint {
  ensureSodiumReady();

  // Convert to bytes if hex string
  const keyBytes = typeof publicKey === 'string'
    ? hexToBytes(publicKey)
    : publicKey;

  // Generate SHA-256 hash
  const hash = sha256(keyBytes);
  const hex = bytesToHex(hash).toUpperCase();

  return {
    hash,
    hex,
    formatted: formatFingerprint(hex),
    short: hex.slice(0, 16),
    colors: generateColors(hash),
    emoji: generateEmojiFingerprint(hash),
    randomart: generateRandomart(hash),
    blocks: formatAsBlocks(hex),
  };
}

/**
 * Generate fingerprint from hex string directly
 */
export function fingerprintFromHex(hex: string): VisualFingerprint {
  const hash = hexToBytes(hex);
  return {
    hash,
    hex: hex.toUpperCase(),
    formatted: formatFingerprint(hex),
    short: hex.slice(0, 16).toUpperCase(),
    colors: generateColors(hash),
    emoji: generateEmojiFingerprint(hash),
    randomart: generateRandomart(hash),
    blocks: formatAsBlocks(hex),
  };
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Format fingerprint as colon-separated pairs (XX:XX:XX:XX...)
 *
 * This matches the iOS BitChat fingerprint display format.
 */
export function formatFingerprint(hex: string): string {
  const upper = hex.toUpperCase();
  const pairs: string[] = [];

  for (let i = 0; i < upper.length; i += 2) {
    pairs.push(upper.slice(i, i + 2));
  }

  return pairs.join(':');
}

/**
 * Format fingerprint as 4-character blocks with spaces
 *
 * More readable for manual comparison.
 */
export function formatAsBlocks(hex: string): string {
  const upper = hex.toUpperCase();
  const blocks: string[] = [];

  for (let i = 0; i < upper.length; i += 4) {
    blocks.push(upper.slice(i, i + 4));
  }

  return blocks.join(' ');
}

/**
 * Format fingerprint as 4 lines of 4 groups each
 *
 * Matches iOS BitChat FingerprintView format.
 */
export function formatAsGrid(hex: string): string {
  const upper = hex.toUpperCase();
  const lines: string[] = [];

  for (let lineStart = 0; lineStart < upper.length; lineStart += 16) {
    const groups: string[] = [];
    for (let i = 0; i < 16 && lineStart + i < upper.length; i += 4) {
      groups.push(upper.slice(lineStart + i, lineStart + i + 4));
    }
    lines.push(groups.join(' '));
  }

  return lines.join('\n');
}

/**
 * Get short identifier (first 8 characters formatted)
 */
export function getShortId(hex: string): string {
  const upper = hex.toUpperCase();
  return `${upper.slice(0, 4)}:${upper.slice(4, 8)}`;
}

// ============================================================================
// Color Generation
// ============================================================================

/**
 * Generate color palette from fingerprint hash
 *
 * Creates visually distinct colors for each unique fingerprint.
 */
export function generateColors(hash: Uint8Array): FingerprintColors {
  // Use first bytes for primary colors
  const primary = `#${bytesToHex(hash.slice(0, 3))}`;
  const secondary = `#${bytesToHex(hash.slice(3, 6))}`;
  const tertiary = `#${bytesToHex(hash.slice(6, 9))}`;

  // Generate 8-color palette from hash
  const palette: string[] = [];
  for (let i = 0; i < 8; i++) {
    const offset = i * 4;
    palette.push(`#${bytesToHex(hash.slice(offset, offset + 3))}`);
  }

  // Generate CSS gradient
  const gradientStops = palette.map((color, i) => {
    const percent = (i / (palette.length - 1)) * 100;
    return `${color} ${percent.toFixed(0)}%`;
  }).join(', ');
  const gradient = `linear-gradient(135deg, ${gradientStops})`;

  return {
    primary,
    secondary,
    tertiary,
    palette,
    gradient,
  };
}

/**
 * Generate HSL color from a single byte
 */
function byteToHSLColor(byte: number): string {
  const hue = (byte / 255) * 360;
  return `hsl(${hue.toFixed(0)}, 70%, 50%)`;
}

/**
 * Generate a color pattern string for terminal display
 */
export function generateColorPattern(hash: Uint8Array): string {
  const blocks: string[] = [];
  for (let i = 0; i < 8 && i < hash.length; i++) {
    const byte = hash[i];
    if (byte !== undefined) {
      blocks.push(byteToHSLColor(byte));
    }
  }
  return blocks.join(' ');
}

// ============================================================================
// Emoji Fingerprint
// ============================================================================

/**
 * Generate emoji sequence from fingerprint
 *
 * Uses first 8 bytes for a memorable 8-emoji sequence.
 */
export function generateEmojiFingerprint(hash: Uint8Array): string {
  const emojis: string[] = [];

  // Use first 8 bytes for emoji selection
  for (let i = 0; i < 8 && i < hash.length; i++) {
    const byte = hash[i];
    if (byte !== undefined) {
      const index = byte % FINGERPRINT_EMOJI.length;
      const emoji = FINGERPRINT_EMOJI[index];
      if (emoji) {
        emojis.push(emoji);
      }
    }
  }

  return emojis.join('');
}

/**
 * Generate longer emoji fingerprint (16 emoji)
 */
export function generateLongEmojiFingerprint(hash: Uint8Array): string {
  const emojis: string[] = [];

  for (let i = 0; i < 16 && i < hash.length; i++) {
    const byte = hash[i];
    if (byte !== undefined) {
      const index = byte % FINGERPRINT_EMOJI.length;
      const emoji = FINGERPRINT_EMOJI[index];
      if (emoji) {
        emojis.push(emoji);
      }
    }
  }

  return emojis.join('');
}

// ============================================================================
// SSH-style Randomart
// ============================================================================

/**
 * Generate SSH-style randomart from fingerprint
 *
 * Creates a visual ASCII art representation similar to ssh-keygen -lv.
 * This provides a quick visual way to verify fingerprints.
 */
export function generateRandomart(hash: Uint8Array, width = 17, height = 9): string {
  // Initialize field
  const field: number[][] = [];
  for (let y = 0; y < height; y++) {
    field.push(new Array(width).fill(0));
  }

  // Start position (center)
  let x = Math.floor(width / 2);
  let y = Math.floor(height / 2);

  // Walk based on hash bits
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    if (byte === undefined) continue;

    // Process 4 moves per byte (2 bits each)
    for (let j = 0; j < 4; j++) {
      const direction = (byte >> (j * 2)) & 0x03;

      // Move based on direction
      switch (direction) {
        case 0: // up-left
          if (x > 0) x--;
          if (y > 0) y--;
          break;
        case 1: // up-right
          if (x < width - 1) x++;
          if (y > 0) y--;
          break;
        case 2: // down-left
          if (x > 0) x--;
          if (y < height - 1) y++;
          break;
        case 3: // down-right
          if (x < width - 1) x++;
          if (y < height - 1) y++;
          break;
      }

      // Increment visit count
      const fieldRow = field[y];
      if (fieldRow) {
        fieldRow[x] = (fieldRow[x] ?? 0) + 1;
      }
    }
  }

  // Mark start and end positions
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);

  // Generate ASCII art
  const lines: string[] = [];

  // Top border
  lines.push(`+${  '-'.repeat(width)  }+`);

  // Field
  for (let row = 0; row < height; row++) {
    let line = '|';
    const fieldRow = field[row];
    for (let col = 0; col < width; col++) {
      if (row === startY && col === startX) {
        line += 'S'; // Start
      } else if (row === y && col === x) {
        line += 'E'; // End
      } else {
        const visits = Math.min(fieldRow?.[col] ?? 0, RANDOMART_CHARS.length - 1);
        line += RANDOMART_CHARS[visits] ?? ' ';
      }
    }
    line += '|';
    lines.push(line);
  }

  // Bottom border
  lines.push(`+${  '-'.repeat(width)  }+`);

  return lines.join('\n');
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compare two fingerprints and return similarity metrics
 */
export function compareFingerprints(
  fp1: string | Uint8Array,
  fp2: string | Uint8Array
): FingerprintComparison {
  // Normalize to hex strings
  const hex1 = typeof fp1 === 'string' ? fp1.toLowerCase() : bytesToHex(fp1);
  const hex2 = typeof fp2 === 'string' ? fp2.toLowerCase() : bytesToHex(fp2);

  // Check exact match
  const match = hex1 === hex2;

  // Count matching characters
  let matchingChars = 0;
  const minLen = Math.min(hex1.length, hex2.length);
  for (let i = 0; i < minLen; i++) {
    if (hex1[i] === hex2[i]) {
      matchingChars++;
    }
  }

  // Calculate similarity percentage
  const maxLen = Math.max(hex1.length, hex2.length);
  const similarity = maxLen > 0 ? (matchingChars / maxLen) * 100 : 0;

  // Compare color blocks (first 24 bytes = 8 RGB colors)
  const bytes1 = typeof fp1 === 'string' ? hexToBytes(fp1) : fp1;
  const bytes2 = typeof fp2 === 'string' ? hexToBytes(fp2) : fp2;
  let matchingColors = 0;

  for (let i = 0; i < 8; i++) {
    const offset = i * 3;
    if (offset + 2 < bytes1.length && offset + 2 < bytes2.length) {
      // Colors match if all 3 RGB bytes match
      if (
        bytes1[offset] === bytes2[offset] &&
        bytes1[offset + 1] === bytes2[offset + 1] &&
        bytes1[offset + 2] === bytes2[offset + 2]
      ) {
        matchingColors++;
      }
    }
  }

  return {
    match,
    similarity: Math.round(similarity * 100) / 100,
    matchingChars,
    matchingColors,
  };
}

/**
 * Check if two fingerprints are identical
 */
export function fingerprintsMatch(
  fp1: string | Uint8Array,
  fp2: string | Uint8Array
): boolean {
  const hex1 = typeof fp1 === 'string' ? fp1.toLowerCase() : bytesToHex(fp1);
  const hex2 = typeof fp2 === 'string' ? fp2.toLowerCase() : bytesToHex(fp2);
  return hex1 === hex2;
}

// ============================================================================
// Verification Helpers
// ============================================================================

/**
 * Generate verification words from fingerprint
 *
 * Creates a list of words that can be read aloud for verification.
 */
export function generateVerificationWords(hash: Uint8Array): string[] {
  // Simple word list for verification (phonetically distinct)
  const words = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
    'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
    'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
    'yankee', 'zulu', 'zero', 'one', 'two', 'three', 'four', 'five',
    'six', 'seven', 'eight', 'nine', 'red', 'blue', 'green', 'yellow',
    'orange', 'purple', 'white', 'black', 'silver', 'gold', 'bronze', 'copper',
    'north', 'south', 'east', 'west', 'up', 'down', 'left', 'right',
    'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'fire',
  ];

  const result: string[] = [];

  // Use first 8 bytes for word selection
  for (let i = 0; i < 8 && i < hash.length; i++) {
    const byte = hash[i];
    if (byte !== undefined) {
      const index = byte % words.length;
      const word = words[index];
      if (word) {
        result.push(word);
      }
    }
  }

  return result;
}

/**
 * Format verification words for display
 */
export function formatVerificationWords(hash: Uint8Array): string {
  const words = generateVerificationWords(hash);
  return words.join(' ');
}

// ============================================================================
// QR-Compatible Formats
// ============================================================================

/**
 * Generate a compact representation suitable for QR codes
 *
 * Uses base64url encoding for QR-friendly format.
 */
export function generateQRCompatible(publicKey: Uint8Array | string): string {
  ensureSodiumReady();

  const keyBytes = typeof publicKey === 'string'
    ? hexToBytes(publicKey)
    : publicKey;

  // Create a prefixed format: "bitchat:" + base64url(hash)
  const hash = sha256(keyBytes);
  const base64 = sodium.to_base64(hash, sodium.base64_variants.URLSAFE_NO_PADDING);

  return `bitchat:${base64}`;
}

/**
 * Parse a QR-compatible fingerprint string
 */
export function parseQRFingerprint(qr: string): Uint8Array | null {
  ensureSodiumReady();

  if (!qr.startsWith('bitchat:')) {
    return null;
  }

  try {
    const base64 = qr.slice(8);
    return sodium.from_base64(base64, sodium.base64_variants.URLSAFE_NO_PADDING);
  } catch {
    return null;
  }
}
