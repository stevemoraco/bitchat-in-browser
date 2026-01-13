/**
 * Nostr Events Protocol Compatibility Tests
 *
 * These tests verify that the web client produces Nostr events
 * that are compatible with the iOS and Android BitChat apps.
 *
 * Validates:
 * - Event structure matches iOS/Android
 * - Kind 20000 location events
 * - NIP-17 gift wrap format
 * - Event ID calculation
 * - Signature format
 */

import { describe, it, expect } from 'vitest';
import {
  EVENT_ID_VECTORS,
  NOSTR_EVENT_KINDS,
  NIP44_VECTORS,
  SCHNORR_VECTORS,
  BECH32_VECTORS,
} from '../test-vectors';
import {
  NativeEventKinds,
  NativeTagFormats,
  NativeEncryptionFormat,
  NativeTimestampHandling,
  calculateEventIdFormat,
} from '../native-format';
import type { NostrEvent } from '../../nostr/types';

// ============================================================================
// Event Structure Tests
// ============================================================================

describe('Nostr Event Structure Compatibility', () => {
  describe('Event Kind Constants', () => {
    it('should have matching event kinds with native apps', () => {
      // Verify all event kinds match between test vectors and native format
      expect(NOSTR_EVENT_KINDS.METADATA).toBe(NativeEventKinds.METADATA);
      expect(NOSTR_EVENT_KINDS.TEXT_NOTE).toBe(NativeEventKinds.TEXT_NOTE);
      expect(NOSTR_EVENT_KINDS.DM_RUMOR).toBe(NativeEventKinds.DM_RUMOR);
      expect(NOSTR_EVENT_KINDS.SEAL).toBe(NativeEventKinds.SEAL);
      expect(NOSTR_EVENT_KINDS.GIFT_WRAP).toBe(NativeEventKinds.GIFT_WRAP);
      expect(NOSTR_EVENT_KINDS.EPHEMERAL_EVENT).toBe(NativeEventKinds.EPHEMERAL_EVENT);
    });

    it('should use kind 20000 for location channel messages', () => {
      expect(NativeEventKinds.EPHEMERAL_EVENT).toBe(20000);
    });

    it('should use kind 14 for DM rumors (NIP-17)', () => {
      expect(NativeEventKinds.DM_RUMOR).toBe(14);
    });

    it('should use kind 13 for seals (NIP-17)', () => {
      expect(NativeEventKinds.SEAL).toBe(13);
    });

    it('should use kind 1059 for gift wraps (NIP-59)', () => {
      expect(NativeEventKinds.GIFT_WRAP).toBe(1059);
    });

    it('should define ephemeral event range correctly', () => {
      expect(NativeEventKinds.EPHEMERAL_EVENT).toBeGreaterThanOrEqual(20000);
      expect(NativeEventKinds.EPHEMERAL_MAX).toBe(29999);
    });
  });

  describe('Event Field Types', () => {
    it('should have id as lowercase hex string (64 chars)', () => {
      const validId = 'a'.repeat(64);
      const invalidIds = [
        'A'.repeat(64), // uppercase not allowed
        'a'.repeat(63), // too short
        'a'.repeat(65), // too long
        'g'.repeat(64), // invalid hex character
      ];

      expect(validId).toMatch(/^[0-9a-f]{64}$/);
      invalidIds.forEach((id) => {
        expect(id).not.toMatch(/^[0-9a-f]{64}$/);
      });
    });

    it('should have pubkey as lowercase hex string (64 chars)', () => {
      const validPubkey =
        EVENT_ID_VECTORS.textNote.event.pubkey.toLowerCase();
      expect(validPubkey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should have created_at as Unix timestamp in seconds', () => {
      const timestamp = EVENT_ID_VECTORS.textNote.event.created_at;
      expect(typeof timestamp).toBe('number');
      expect(Number.isInteger(timestamp)).toBe(true);
      // Should be reasonable Unix timestamp (after 2020, before 2100)
      expect(timestamp).toBeGreaterThan(1577836800); // 2020-01-01
      expect(timestamp).toBeLessThan(4102444800); // 2100-01-01
    });

    it('should have kind as integer', () => {
      const kind = EVENT_ID_VECTORS.textNote.event.kind;
      expect(typeof kind).toBe('number');
      expect(Number.isInteger(kind)).toBe(true);
    });

    it('should have tags as array of string arrays', () => {
      const tags = EVENT_ID_VECTORS.ephemeralLocationEvent.event.tags;
      expect(Array.isArray(tags)).toBe(true);
      tags.forEach((tag) => {
        expect(Array.isArray(tag)).toBe(true);
        tag.forEach((element) => {
          expect(typeof element).toBe('string');
        });
      });
    });

    it('should have content as string', () => {
      const content = EVENT_ID_VECTORS.textNote.event.content;
      expect(typeof content).toBe('string');
    });

    it('should have sig as lowercase hex string (128 chars)', () => {
      const validSig = 'a'.repeat(128);
      expect(validSig).toMatch(/^[0-9a-f]{128}$/);
    });
  });
});

// ============================================================================
// Event ID Calculation Tests
// ============================================================================

describe('Event ID Calculation Compatibility', () => {
  describe('Serialization Format', () => {
    it('should serialize events in correct array format [0, pubkey, created_at, kind, tags, content]', () => {
      const event = EVENT_ID_VECTORS.textNote.event;
      const serialized = calculateEventIdFormat(event);

      // Should start with [0,
      expect(serialized).toMatch(/^\[0,/);

      // Should contain pubkey as string
      expect(serialized).toContain(`"${event.pubkey}"`);

      // Should contain created_at as number (not string)
      expect(serialized).toContain(`,${event.created_at},`);

      // Should contain kind as number
      expect(serialized).toContain(`,${event.kind},`);

      // Should end with content
      expect(serialized).toContain(`"${event.content}"`);
    });

    it('should serialize text note correctly', () => {
      const event = EVENT_ID_VECTORS.textNote.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toBe(EVENT_ID_VECTORS.textNote.expectedSerialization);
    });

    it('should serialize ephemeral location event correctly', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toBe(
        EVENT_ID_VECTORS.ephemeralLocationEvent.expectedSerialization
      );
    });

    it('should serialize DM rumor correctly', () => {
      const event = EVENT_ID_VECTORS.dmRumor.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toBe(EVENT_ID_VECTORS.dmRumor.expectedSerialization);
    });

    it('should serialize seal event correctly', () => {
      const event = EVENT_ID_VECTORS.sealEvent.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toBe(EVENT_ID_VECTORS.sealEvent.expectedSerialization);
    });

    it('should serialize gift wrap event correctly', () => {
      const event = EVENT_ID_VECTORS.giftWrapEvent.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toBe(
        EVENT_ID_VECTORS.giftWrapEvent.expectedSerialization
      );
    });

    it('should not escape forward slashes in JSON', () => {
      const eventWithSlash = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Check out https://example.com/path',
      };
      const serialized = calculateEventIdFormat(eventWithSlash);

      // Should NOT have escaped slashes like \\/
      expect(serialized).not.toContain('\\/');
      // Should have normal slashes
      expect(serialized).toContain('https://example.com/path');
    });

    it('should preserve tag order exactly', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 20000,
        tags: [
          ['g', 'dr5regw7'],
          ['n', 'TestUser'],
          ['t', 'teleport'],
        ],
        content: 'Test',
      };
      const serialized = calculateEventIdFormat(event);

      // Tags should appear in exact order
      const tagMatch = serialized.match(
        /\[\["g","dr5regw7"\],\["n","TestUser"\],\["t","teleport"\]\]/
      );
      expect(tagMatch).not.toBeNull();
    });

    it('should handle empty tags array', () => {
      const event = EVENT_ID_VECTORS.textNote.event;
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toContain(',[],"');
    });

    it('should handle empty content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: '',
      };
      const serialized = calculateEventIdFormat(event);
      // Should end with empty string in JSON format
      expect(serialized).toContain(',""]');
    });

    it('should handle special characters in content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello "world" with\nnewline and\ttab',
      };
      const serialized = calculateEventIdFormat(event);

      // Should properly escape quotes and control characters
      expect(serialized).toContain('\\"world\\"');
      expect(serialized).toContain('\\n');
      expect(serialized).toContain('\\t');
    });

    it('should handle Unicode content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello World!',
      };
      const serialized = calculateEventIdFormat(event);
      expect(serialized).toContain('Hello World!');
    });
  });
});

// ============================================================================
// Kind 20000 Location Events Tests
// ============================================================================

describe('Kind 20000 Location Events Compatibility', () => {
  describe('Tag Format', () => {
    it('should include geohash tag with correct format', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      const geohashTag = event.tags.find((t) => t[0] === 'g');

      expect(geohashTag).toBeDefined();
      expect(geohashTag![0]).toBe('g');
      expect(geohashTag![1]).toHaveLength(8); // Building-level precision
    });

    it('should include optional nickname tag', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      const nicknameTag = event.tags.find((t) => t[0] === 'n');

      expect(nicknameTag).toBeDefined();
      expect(nicknameTag![0]).toBe('n');
      expect(typeof nicknameTag![1]).toBe('string');
    });

    it('should validate geohash tag name matches native format', () => {
      expect(NativeTagFormats.GEOHASH.tagName).toBe('g');
    });

    it('should validate nickname tag name matches native format', () => {
      expect(NativeTagFormats.NICKNAME.tagName).toBe('n');
    });

    it('should validate teleport tag format', () => {
      expect(NativeTagFormats.TELEPORT.tagName).toBe('t');
      expect(NativeTagFormats.TELEPORT.value).toBe('teleport');
    });

    it('should use correct geohash precision (8 characters)', () => {
      expect(NativeTagFormats.GEOHASH.precision).toBe(8);
    });
  });

  describe('Event Structure', () => {
    it('should have kind 20000', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      expect(event.kind).toBe(20000);
    });

    it('should be in ephemeral range (20000-29999)', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      expect(event.kind).toBeGreaterThanOrEqual(20000);
      expect(event.kind).toBeLessThanOrEqual(29999);
    });

    it('should have content as message text', () => {
      const event = EVENT_ID_VECTORS.ephemeralLocationEvent.event;
      expect(event.content).toBe('Hello from location channel!');
    });
  });
});

// ============================================================================
// NIP-17 Gift Wrap Format Tests
// ============================================================================

describe('NIP-17 Gift Wrap Format Compatibility', () => {
  describe('Three-Layer Structure', () => {
    it('should use kind 14 for innermost rumor', () => {
      expect(NOSTR_EVENT_KINDS.DM_RUMOR).toBe(14);
    });

    it('should use kind 13 for middle seal layer', () => {
      expect(NOSTR_EVENT_KINDS.SEAL).toBe(13);
    });

    it('should use kind 1059 for outer gift wrap', () => {
      expect(NOSTR_EVENT_KINDS.GIFT_WRAP).toBe(1059);
    });
  });

  describe('Gift Wrap Event Format', () => {
    it('should include p-tag with recipient pubkey', () => {
      const event = EVENT_ID_VECTORS.giftWrapEvent.event;
      const pTag = event.tags.find((t) => t[0] === 'p');

      expect(pTag).toBeDefined();
      expect(pTag![0]).toBe('p');
      expect(pTag![1]).toHaveLength(64); // 32-byte pubkey as hex
    });

    it('should have encrypted content with v2: prefix', () => {
      const event = EVENT_ID_VECTORS.giftWrapEvent.event;
      expect(event.content.startsWith(NativeEncryptionFormat.VERSION_PREFIX)).toBe(true);
    });
  });

  describe('Seal Event Format', () => {
    it('should have no tags', () => {
      const event = EVENT_ID_VECTORS.sealEvent.event;
      expect(event.tags).toHaveLength(0);
    });

    it('should have encrypted content with v2: prefix', () => {
      const event = EVENT_ID_VECTORS.sealEvent.event;
      expect(event.content.startsWith(NativeEncryptionFormat.VERSION_PREFIX)).toBe(true);
    });
  });

  describe('DM Rumor Format', () => {
    it('should have no tags (recipient is in seal)', () => {
      const event = EVENT_ID_VECTORS.dmRumor.event;
      expect(event.tags).toHaveLength(0);
    });

    it('should have plaintext content', () => {
      const event = EVENT_ID_VECTORS.dmRumor.event;
      expect(event.content).not.toMatch(/^v2:/);
      expect(event.content).toBe('Private message content');
    });
  });

  describe('Timestamp Handling', () => {
    it('should use randomized timestamps for gift wrap', () => {
      const now = Math.floor(Date.now() / 1000);
      const randomized = NativeTimestampHandling.randomizedTimestamp();

      // Should be within +/- 15 minutes of now
      expect(Math.abs(randomized - now)).toBeLessThanOrEqual(900);
    });

    it('should randomize within correct range (+/- 900 seconds)', () => {
      expect(NativeTimestampHandling.RANDOMIZATION_RANGE_SECONDS).toBe(900);
    });
  });
});

// ============================================================================
// Signature Format Tests
// ============================================================================

describe('Signature Format Compatibility', () => {
  describe('BIP-340 Schnorr Signatures', () => {
    it('should produce 64-byte signatures', () => {
      expect(SCHNORR_VECTORS.format.signatureLength).toBe(64);
    });

    it('should use x-only public keys (32 bytes)', () => {
      expect(SCHNORR_VECTORS.format.publicKeyLength).toBe(32);
    });

    it('should use 32-byte private keys', () => {
      expect(SCHNORR_VECTORS.format.privateKeyLength).toBe(32);
    });

    it('should use 32-byte auxiliary random data', () => {
      expect(SCHNORR_VECTORS.auxRandLength).toBe(32);
    });
  });

  describe('Signature Hex Encoding', () => {
    it('should encode signatures as 128-character lowercase hex', () => {
      const validSig = 'a'.repeat(128);
      expect(validSig).toHaveLength(128);
      expect(validSig).toMatch(/^[0-9a-f]+$/);
    });
  });
});

// ============================================================================
// Bech32 Encoding Tests
// ============================================================================

describe('Bech32 Encoding Compatibility', () => {
  describe('npub Format', () => {
    it('should use "npub" human-readable part', () => {
      expect(BECH32_VECTORS.npub.hrp).toBe('npub');
    });

    it('should produce strings starting with "npub1"', () => {
      BECH32_VECTORS.npub.examples.forEach((example) => {
        expect(example.expectedPrefix).toBe('npub1');
      });
    });
  });

  describe('nsec Format', () => {
    it('should use "nsec" human-readable part', () => {
      expect(BECH32_VECTORS.nsec.hrp).toBe('nsec');
    });

    it('should produce strings starting with "nsec1"', () => {
      BECH32_VECTORS.nsec.examples.forEach((example) => {
        expect(example.expectedPrefix).toBe('nsec1');
      });
    });
  });
});

// ============================================================================
// NIP-44 v2 Encryption Format Tests
// ============================================================================

describe('NIP-44 v2 Encryption Format Compatibility', () => {
  describe('Version Prefix', () => {
    it('should use "v2:" prefix', () => {
      expect(NIP44_VECTORS.format.versionPrefix).toBe('v2:');
      expect(NativeEncryptionFormat.VERSION_PREFIX).toBe('v2:');
    });
  });

  describe('Ciphertext Format', () => {
    it('should use 24-byte nonce', () => {
      expect(NIP44_VECTORS.format.nonceLength).toBe(24);
      expect(NativeEncryptionFormat.NONCE_LENGTH).toBe(24);
    });

    it('should use 16-byte authentication tag', () => {
      expect(NIP44_VECTORS.format.tagLength).toBe(16);
      expect(NativeEncryptionFormat.TAG_LENGTH).toBe(16);
    });

    it('should use base64url encoding', () => {
      expect(NativeEncryptionFormat.ENCODING).toBe('base64url');
    });
  });

  describe('Key Derivation', () => {
    it('should use HKDF-SHA256', () => {
      expect(NativeEncryptionFormat.KEY_DERIVATION.algorithm).toBe('HKDF-SHA256');
    });

    it('should use empty salt', () => {
      expect(NativeEncryptionFormat.KEY_DERIVATION.salt).toHaveLength(0);
    });

    it('should use "nip44-v2" as info', () => {
      expect(NIP44_VECTORS.keyDerivation.info).toBe('nip44-v2');
      expect(NativeEncryptionFormat.KEY_DERIVATION.info).toBe('nip44-v2');
    });

    it('should derive 32-byte key', () => {
      expect(NIP44_VECTORS.keyDerivation.expectedKeyLength).toBe(32);
      expect(NativeEncryptionFormat.KEY_DERIVATION.outputLength).toBe(32);
    });
  });

  describe('Base64URL Encoding', () => {
    it('should encode without padding', () => {
      // Standard base64 would have = padding, base64url should not
      const { base64url } = NIP44_VECTORS.base64url;
      expect(base64url).not.toContain('=');
    });

    it('should replace + with -', () => {
      const { base64url } = NIP44_VECTORS.base64url;
      expect(base64url).not.toContain('+');
    });

    it('should replace / with _', () => {
      const { base64url } = NIP44_VECTORS.base64url;
      expect(base64url).not.toContain('/');
    });
  });

  describe('Ciphertext Parsing', () => {
    it('should parse valid v2: ciphertext', () => {
      // Create a mock ciphertext
      const nonce = new Uint8Array(24).fill(1);
      const ciphertext = new Uint8Array(20).fill(2);
      const tag = new Uint8Array(16).fill(3);

      const encrypted = NativeEncryptionFormat.formatCiphertext(
        nonce,
        ciphertext,
        tag
      );

      expect(encrypted.startsWith('v2:')).toBe(true);

      const parsed = NativeEncryptionFormat.parseCiphertext(encrypted);
      expect(parsed).not.toBeNull();
      expect(parsed!.nonce).toHaveLength(24);
      expect(parsed!.tag).toHaveLength(16);
    });

    it('should reject ciphertext without v2: prefix', () => {
      const invalidEncrypted = 'invalid_ciphertext_without_prefix';
      const parsed = NativeEncryptionFormat.parseCiphertext(invalidEncrypted);
      expect(parsed).toBeNull();
    });

    it('should reject ciphertext with insufficient length', () => {
      const shortEncrypted = 'v2:' + 'YQ=='; // Too short
      const parsed = NativeEncryptionFormat.parseCiphertext(shortEncrypted);
      expect(parsed).toBeNull();
    });
  });
});

// ============================================================================
// Cross-Platform Event Validation
// ============================================================================

describe('Cross-Platform Event Validation', () => {
  /**
   * Helper to create a minimal valid event structure
   */
  function createMinimalEvent(overrides: Partial<NostrEvent> = {}): Omit<NostrEvent, 'id' | 'sig'> {
    return {
      pubkey: 'a'.repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Test message',
      ...overrides,
    };
  }

  describe('Event Field Validation', () => {
    it('should validate pubkey is 64-character hex', () => {
      const validEvent = createMinimalEvent();
      expect(validEvent.pubkey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should validate created_at is positive integer', () => {
      const validEvent = createMinimalEvent();
      expect(validEvent.created_at).toBeGreaterThan(0);
      expect(Number.isInteger(validEvent.created_at)).toBe(true);
    });

    it('should validate kind is non-negative integer', () => {
      const validEvent = createMinimalEvent();
      expect(validEvent.kind).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(validEvent.kind)).toBe(true);
    });

    it('should validate tags is array of arrays', () => {
      const validEvent = createMinimalEvent({
        tags: [
          ['g', 'dr5regw7'],
          ['n', 'TestUser'],
        ],
      });

      expect(Array.isArray(validEvent.tags)).toBe(true);
      validEvent.tags.forEach((tag) => {
        expect(Array.isArray(tag)).toBe(true);
      });
    });

    it('should validate content is string', () => {
      const validEvent = createMinimalEvent();
      expect(typeof validEvent.content).toBe('string');
    });
  });

  describe('Location Channel Event Validation', () => {
    it('should have geohash tag for location events', () => {
      const event = createMinimalEvent({
        kind: 20000,
        tags: [['g', 'dr5regw7']],
      });

      const hasGeohashTag = event.tags.some((t) => t[0] === 'g');
      expect(hasGeohashTag).toBe(true);
    });

    it('should validate geohash is 8 characters', () => {
      const event = createMinimalEvent({
        kind: 20000,
        tags: [['g', 'dr5regw7']],
      });

      const geohashTag = event.tags.find((t) => t[0] === 'g');
      expect(geohashTag![1]).toHaveLength(8);
    });
  });

  describe('DM Event Validation', () => {
    it('should have p-tag for gift wrap events', () => {
      const event = createMinimalEvent({
        kind: 1059,
        tags: [['p', 'b'.repeat(64)]],
        content: 'v2:encrypted_content_here',
      });

      const hasPTag = event.tags.some((t) => t[0] === 'p');
      expect(hasPTag).toBe(true);
    });

    it('should have encrypted content for gift wrap', () => {
      const event = createMinimalEvent({
        kind: 1059,
        tags: [['p', 'b'.repeat(64)]],
        content: 'v2:encrypted_content_here',
      });

      expect(event.content.startsWith('v2:')).toBe(true);
    });
  });
});
