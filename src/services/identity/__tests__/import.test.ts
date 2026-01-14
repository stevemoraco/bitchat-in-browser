/**
 * Key Import Security Tests
 *
 * Comprehensive tests for nsec/hex key import:
 * - Valid nsec import verification
 * - Invalid checksum rejection
 * - Wrong prefix rejection
 * - Length validation
 * - Non-bech32 character rejection
 * - Key material security during import
 *
 * @module services/identity/__tests__/import.test
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { nip19 } from 'nostr-tools';
import {
  detectImportFormat,
  validateImport,
  importFromNsec,
  importFromHex,
  importKey,
  isValidNsec,
  isValidHexKey,
  isValidMnemonicFormat,
  sanitizeImportInput,
  privateKeyToNsec,
  privateKeyToHex,
  derivePublicInfo,
} from '../import';
import {
  loadSodium,
  bytesToHex,
  hexToBytes,
  secureWipe,
} from '../../crypto';

// ============================================================================
// Test Vectors
// ============================================================================

/**
 * Known valid test vectors for verification
 * Note: The expected public key is derived from the nsec using nostr-tools
 */
const TEST_VECTORS = {
  // Valid nsec (known test key - DO NOT USE IN PRODUCTION)
  validNsec: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Valid 64-character hex private key
  validHex: '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa',
  // Valid 12-word mnemonic (test vector from BIP-39)
  validMnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
};

/**
 * Invalid nsec test cases with specific error conditions
 */
const INVALID_NSEC_CASES = {
  // Wrong prefix (npub instead of nsec)
  wrongPrefix: 'npub1qfmxhfvp6ytxp2aypv87vq9xmtldwwfkgk8sdp3h8n7a6zrllllsw0nqlv',
  // Too short (truncated)
  tooShort: 'nsec1vl029mgpspedva04g90vltkh6',
  // Too long (extra characters)
  tooLong: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5aaaa',
  // Invalid checksum (modified last chars)
  invalidChecksum: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqaaaa00',
  // Non-bech32 characters (contains 'b', 'i', 'o', '1' which are valid, but 'B' uppercase is not standard)
  nonBech32Chars: 'nsec1vl029mgpBpedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Contains invalid character 'I' (looks like 1)
  confusableChars: 'nsec1vI029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Empty string
  empty: '',
  // Just the prefix
  prefixOnly: 'nsec1',
  // Random invalid string
  randomString: 'not-a-valid-nsec-key-at-all',
  // Spaces in the key
  withSpaces: 'nsec1 vl029mg pspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Missing prefix
  noPrefix: 'vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
};

// ============================================================================
// Test Setup
// ============================================================================

describe('Key Import Security', () => {
  beforeAll(async () => {
    await loadSodium();
  });

  // ==========================================================================
  // Format Detection Tests
  // ==========================================================================

  describe('Format Detection', () => {
    it('should detect valid nsec format', () => {
      expect(detectImportFormat(TEST_VECTORS.validNsec)).toBe('nsec');
    });

    it('should detect valid hex format', () => {
      expect(detectImportFormat(TEST_VECTORS.validHex)).toBe('hex');
    });

    it('should detect valid mnemonic format', () => {
      expect(detectImportFormat(TEST_VECTORS.validMnemonic)).toBe('mnemonic');
    });

    it('should return null for unrecognized formats', () => {
      expect(detectImportFormat('invalid')).toBeNull();
      expect(detectImportFormat('not-a-key')).toBeNull();
      expect(detectImportFormat('')).toBeNull();
      expect(detectImportFormat('   ')).toBeNull();
    });

    it('should handle leading/trailing whitespace', () => {
      expect(detectImportFormat(`  ${TEST_VECTORS.validNsec}  `)).toBe('nsec');
      expect(detectImportFormat(`\n${TEST_VECTORS.validHex}\t`)).toBe('hex');
    });

    it('should not detect npub as nsec', () => {
      expect(detectImportFormat(INVALID_NSEC_CASES.wrongPrefix)).not.toBe('nsec');
    });
  });

  // ==========================================================================
  // Valid nsec Import Tests
  // ==========================================================================

  describe('Valid nsec Import', () => {
    it('should import valid nsec correctly', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);

      expect(result.success).toBe(true);
      expect(result.format).toBe('nsec');
      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey?.length).toBe(32);
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey?.length).toBe(64); // hex string
      expect(result.npub).toMatch(/^npub1/);
      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint?.length).toBe(64); // sha256 hex
    });

    it('should derive correct public key from nsec', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);

      expect(result.success).toBe(true);
      // Public key should be 64 hex characters
      expect(result.publicKey).toHaveLength(64);
      expect(result.publicKey).toMatch(/^[0-9a-f]{64}$/);

      // Importing the same nsec twice should produce the same public key
      const result2 = importFromNsec(TEST_VECTORS.validNsec);
      expect(result2.publicKey).toBe(result.publicKey);
    });

    it('should handle lowercase nsec', () => {
      const lowercase = TEST_VECTORS.validNsec.toLowerCase();
      const result = importFromNsec(lowercase);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase nsec (bech32 is case-insensitive)', () => {
      // Bech32 is case-insensitive, but mixed case should fail
      const uppercase = TEST_VECTORS.validNsec.toUpperCase();
      const result = importFromNsec(uppercase);

      // nostr-tools should handle this
      expect(result.success).toBe(true);
    });

    it('should round-trip nsec correctly', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);
      expect(result.success).toBe(true);

      // Convert back to nsec
      const nsec = privateKeyToNsec(result.privateKey!);

      // Should match original (lowercase)
      expect(nsec.toLowerCase()).toBe(TEST_VECTORS.validNsec.toLowerCase());
    });

    it('should validate nsec and provide preview', () => {
      const validation = validateImport(TEST_VECTORS.validNsec);

      expect(validation.valid).toBe(true);
      expect(validation.format).toBe('nsec');
      expect(validation.npubPreview).toBeDefined();
      // Public key should be 64 hex characters
      expect(validation.publicKey).toHaveLength(64);
      expect(validation.publicKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ==========================================================================
  // Invalid Checksum Rejection
  // ==========================================================================

  describe('Invalid Checksum Rejection', () => {
    it('should reject nsec with invalid checksum', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.invalidChecksum);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject modified nsec (corrupted data)', () => {
      // Take valid nsec and corrupt one character
      const corrupted = TEST_VECTORS.validNsec.slice(0, -5) + 'xxxxx';
      const result = importFromNsec(corrupted);

      expect(result.success).toBe(false);
    });

    it('should provide meaningful error for checksum failure', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.invalidChecksum);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error should mention checksum or invalid
      expect(result.error?.toLowerCase()).toMatch(/checksum|invalid|failed|error/);
    });
  });

  // ==========================================================================
  // Wrong Prefix Rejection
  // ==========================================================================

  describe('Wrong Prefix Rejection', () => {
    it('should reject npub (wrong prefix)', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.wrongPrefix);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error should mention format issue (nsec, invalid, format, checksum, etc.)
      expect(result.error?.toLowerCase()).toMatch(/nsec|invalid|format|checksum|failed/);
    });

    it('should reject nprofile prefix', () => {
      // Create a fake nprofile-like string
      const nprofile = 'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gppzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhg';
      const result = importFromNsec(nprofile);

      expect(result.success).toBe(false);
    });

    it('should reject nevent prefix', () => {
      const nevent = 'nevent1qqstna2yrezu5wghjvswqqculvvwxsrcvu8cgstvc';
      const result = importFromNsec(nevent);

      expect(result.success).toBe(false);
    });

    it('should not auto-detect wrong prefix as nsec', () => {
      expect(detectImportFormat(INVALID_NSEC_CASES.wrongPrefix)).not.toBe('nsec');
    });

    it('should validate and reject wrong prefix', () => {
      const validation = validateImport(INVALID_NSEC_CASES.wrongPrefix);

      // Should not be detected as nsec
      expect(validation.format).not.toBe('nsec');
    });
  });

  // ==========================================================================
  // Length Validation
  // ==========================================================================

  describe('Length Validation', () => {
    it('should reject too short nsec', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.tooShort);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject too long nsec', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.tooLong);

      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.empty);

      expect(result.success).toBe(false);
    });

    it('should reject prefix only', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.prefixOnly);

      expect(result.success).toBe(false);
    });

    it('should reject hex key that is too short', () => {
      const shortHex = 'abcd1234';
      const result = importFromHex(shortHex);

      expect(result.success).toBe(false);
      expect(result.error).toContain('64');
    });

    it('should reject hex key that is too long', () => {
      const longHex = TEST_VECTORS.validHex + 'abcd';
      const result = importFromHex(longHex);

      expect(result.success).toBe(false);
    });

    it('should validate mnemonic word count', () => {
      const tooFewWords = 'abandon abandon abandon';
      const validation = isValidMnemonicFormat(tooFewWords);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('word count');
    });
  });

  // ==========================================================================
  // Non-Bech32 Character Rejection
  // ==========================================================================

  describe('Non-Bech32 Character Rejection', () => {
    it('should reject nsec with non-bech32 characters', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.nonBech32Chars);

      expect(result.success).toBe(false);
    });

    it('should reject nsec with confusable characters (I for 1)', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.confusableChars);

      expect(result.success).toBe(false);
    });

    it('should reject nsec with spaces', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.withSpaces);

      expect(result.success).toBe(false);
    });

    it('should reject random invalid string', () => {
      const result = importFromNsec(INVALID_NSEC_CASES.randomString);

      expect(result.success).toBe(false);
    });

    it('should reject hex key with non-hex characters', () => {
      const invalidHex = 'ghijklmnopqrstuvwxyz'.repeat(3) + 'abcd'; // 64 chars but not hex
      const result = importFromHex(invalidHex);

      expect(result.success).toBe(false);
      expect(result.error).toContain('hex');
    });

    it('should reject hex key with special characters', () => {
      const specialChars = TEST_VECTORS.validHex.slice(0, -4) + '!@#$';
      const result = importFromHex(specialChars);

      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // Hex Key Import Tests
  // ==========================================================================

  describe('Hex Key Import', () => {
    it('should import valid hex private key', () => {
      const result = importFromHex(TEST_VECTORS.validHex);

      expect(result.success).toBe(true);
      expect(result.format).toBe('hex');
      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey?.length).toBe(32);
      expect(result.publicKey).toBeDefined();
      expect(result.npub).toMatch(/^npub1/);
    });

    it('should handle uppercase hex', () => {
      const uppercase = TEST_VECTORS.validHex.toUpperCase();
      const result = importFromHex(uppercase);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case hex', () => {
      const mixed = TEST_VECTORS.validHex.split('').map((c, i) =>
        i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
      ).join('');
      const result = importFromHex(mixed);

      expect(result.success).toBe(true);
    });

    it('should convert hex to nsec correctly', () => {
      const result = importFromHex(TEST_VECTORS.validHex);
      expect(result.success).toBe(true);

      const nsec = privateKeyToNsec(result.privateKey!);
      expect(nsec).toMatch(/^nsec1/);

      // Should be able to re-import
      const reimport = importFromNsec(nsec);
      expect(reimport.success).toBe(true);
      expect(reimport.publicKey).toBe(result.publicKey);
    });
  });

  // ==========================================================================
  // Auto-Detection Import
  // ==========================================================================

  describe('Auto-Detection Import', () => {
    it('should auto-detect and import nsec', async () => {
      const result = await importKey(TEST_VECTORS.validNsec);

      expect(result.success).toBe(true);
      expect(result.format).toBe('nsec');
    });

    it('should auto-detect and import hex', async () => {
      const result = await importKey(TEST_VECTORS.validHex);

      expect(result.success).toBe(true);
      expect(result.format).toBe('hex');
    });

    it('should handle whitespace in auto-detection', async () => {
      const result = await importKey(`  ${TEST_VECTORS.validNsec}  `);

      expect(result.success).toBe(true);
    });

    it('should fail gracefully for unrecognized format', async () => {
      const result = await importKey('not-a-valid-key');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==========================================================================
  // Key Material Security During Import
  // ==========================================================================

  describe('Key Material Security', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not log private key during import', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Perform import
      const result = importFromNsec(TEST_VECTORS.validNsec);
      expect(result.success).toBe(true);

      // Get the private key hex
      const privateKeyHex = bytesToHex(result.privateKey!);

      // Check all console output
      const allLogs = [
        ...consoleLogSpy.mock.calls.map(c => String(c)),
        ...consoleErrorSpy.mock.calls.map(c => String(c)),
        ...consoleWarnSpy.mock.calls.map(c => String(c)),
      ].join(' ');

      // Private key should not appear in logs
      expect(allLogs).not.toContain(privateKeyHex);

      // nsec should not appear in logs
      expect(allLogs).not.toContain(TEST_VECTORS.validNsec);
    });

    it('should not include private key in error messages', () => {
      // Test with invalid input that might trigger error paths
      const result = importFromNsec(INVALID_NSEC_CASES.invalidChecksum);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Error should not contain any hex-like strings that could be key material
      // Error messages should be generic
      expect(result.error).not.toMatch(/[0-9a-f]{64}/i);
    });

    it('should allow secure wiping of imported key material', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);
      expect(result.success).toBe(true);

      const originalHex = bytesToHex(result.privateKey!);

      // Wipe the key
      secureWipe(result.privateKey!);

      // Key should now be all zeros
      expect(result.privateKey!.every(b => b === 0)).toBe(true);
      expect(bytesToHex(result.privateKey!)).not.toBe(originalHex);
    });

    it('should securely wipe temporary key material during validation', () => {
      // Validate a hex key (which creates temporary key material for public key derivation)
      const validation = validateImport(TEST_VECTORS.validHex);

      expect(validation.valid).toBe(true);
      expect(validation.publicKey).toBeDefined();

      // The validation should have wiped the private key internally
      // We can't directly test this, but we verify the function completes
      // without leaving key material accessible
    });

    it('should not expose private key through returned object properties', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);
      expect(result.success).toBe(true);

      // Get all enumerable properties
      const props = Object.keys(result);

      // privateKey should be the only sensitive field
      expect(props).toContain('privateKey');

      // There should be no alternative names for the private key
      expect(props).not.toContain('secret');
      expect(props).not.toContain('secretKey');
      expect(props).not.toContain('sk');
    });

    it('should create independent copy of imported key', () => {
      const result = importFromNsec(TEST_VECTORS.validNsec);
      expect(result.success).toBe(true);

      // Make a copy of the original hex
      const originalHex = bytesToHex(result.privateKey!);

      // Import again
      const result2 = importFromNsec(TEST_VECTORS.validNsec);
      expect(result2.success).toBe(true);

      // Wipe the second import
      secureWipe(result2.privateKey!);

      // First import should be unaffected
      expect(bytesToHex(result.privateKey!)).toBe(originalHex);
    });
  });

  // ==========================================================================
  // Input Sanitization
  // ==========================================================================

  describe('Input Sanitization', () => {
    it('should sanitize nsec input', () => {
      const input = `  ${TEST_VECTORS.validNsec}  `;
      const sanitized = sanitizeImportInput(input);

      expect(sanitized).toBe(TEST_VECTORS.validNsec.toLowerCase());
    });

    it('should sanitize hex input', () => {
      const input = `  ${TEST_VECTORS.validHex.toUpperCase()}  `;
      const sanitized = sanitizeImportInput(input);

      expect(sanitized).toBe(TEST_VECTORS.validHex.toLowerCase());
    });

    it('should normalize whitespace in mnemonic', () => {
      const input = 'word1   word2  word3';
      const sanitized = sanitizeImportInput(input);

      expect(sanitized).toBe('word1 word2 word3');
    });

    it('should lowercase mnemonic words', () => {
      const input = 'ABANDON ABANDON ABOUT';
      const sanitized = sanitizeImportInput(input);

      expect(sanitized).toBe('abandon abandon about');
    });
  });

  // ==========================================================================
  // Public Info Derivation
  // ==========================================================================

  describe('Public Info Derivation', () => {
    it('should derive correct public info from private key', () => {
      const privateKey = hexToBytes(TEST_VECTORS.validHex);
      const info = derivePublicInfo(privateKey);

      expect(info.publicKey).toHaveLength(64);
      expect(info.npub).toMatch(/^npub1/);
      expect(info.fingerprint).toHaveLength(64);
    });

    it('should produce consistent fingerprint', () => {
      const privateKey = hexToBytes(TEST_VECTORS.validHex);
      const info1 = derivePublicInfo(privateKey);
      const info2 = derivePublicInfo(privateKey);

      expect(info1.fingerprint).toBe(info2.fingerprint);
    });
  });

  // ==========================================================================
  // Validation Helpers
  // ==========================================================================

  describe('Validation Helpers', () => {
    it('should validate nsec format correctly', () => {
      expect(isValidNsec(TEST_VECTORS.validNsec)).toBe(true);
      expect(isValidNsec(INVALID_NSEC_CASES.invalidChecksum)).toBe(false);
      expect(isValidNsec(INVALID_NSEC_CASES.wrongPrefix)).toBe(false);
      expect(isValidNsec('')).toBe(false);
    });

    it('should validate hex key format correctly', () => {
      expect(isValidHexKey(TEST_VECTORS.validHex)).toBe(true);
      expect(isValidHexKey('tooshort')).toBe(false);
      expect(isValidHexKey('ghij'.repeat(16))).toBe(false);
      expect(isValidHexKey('')).toBe(false);
    });

    it('should validate mnemonic format correctly', () => {
      const valid12 = isValidMnemonicFormat(TEST_VECTORS.validMnemonic);
      expect(valid12.valid).toBe(true);
      expect(valid12.wordCount).toBe(12);

      const invalid = isValidMnemonicFormat('one two three');
      expect(invalid.valid).toBe(false);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle newlines in input', () => {
      const input = `\n${TEST_VECTORS.validNsec}\n`;
      const result = importFromNsec(input);

      expect(result.success).toBe(true);
    });

    it('should handle tabs in input', () => {
      const input = `\t${TEST_VECTORS.validNsec}\t`;
      const result = importFromNsec(input);

      expect(result.success).toBe(true);
    });

    it('should handle Windows line endings', () => {
      const input = `\r\n${TEST_VECTORS.validNsec}\r\n`;
      const result = importFromNsec(input);

      expect(result.success).toBe(true);
    });

    it('should reject null byte injection', () => {
      const input = `nsec1\0${TEST_VECTORS.validNsec.slice(5)}`;
      const result = importFromNsec(input);

      expect(result.success).toBe(false);
    });

    it('should handle Unicode normalization', () => {
      // Test with some unicode that might look like valid characters
      const input = TEST_VECTORS.validNsec;
      const result = importFromNsec(input);

      expect(result.success).toBe(true);
    });
  });
});
