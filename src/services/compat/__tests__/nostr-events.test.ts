/**
 * Nostr Events Protocol Compatibility Tests
 *
 * These tests verify that the web client produces Nostr events
 * that are compatible with the iOS and Android BitChat apps.
 *
 * Validates:
 * - Event structure matches iOS/Android
 * - Event ID calculation is deterministic and correct
 * - JSON serialization is deterministic
 * - Signature verification works correctly
 * - Invalid signatures/events are rejected
 * - All supported event kinds can be created and parsed
 *
 * @module compat/__tests__/nostr-events.test
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
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
import {
  serializeEventForId,
  calculateEventId,
  verifyEventId,
  signEvent,
  createSignedEvent,
  verifyEventSignature,
  verifyEvent,
  validateEventStructure,
  parseEvent,
  isNostrEvent,
  isUnsignedNostrEvent,
  createMetadataEvent,
  createTextNoteEvent,
  createSealEvent,
  createDMRumorEvent,
  createGiftWrapEvent,
  createEphemeralEvent,
  generatePrivateKey,
  getPublicKey,
  isValidPublicKey,
  isValidPrivateKey,
  getCurrentTimestamp,
  getRandomizedTimestamp,
  NostrEventKind,
} from '../nostr-events';
import type { NostrEvent, UnsignedNostrEvent } from '../../nostr/types';

// ============================================================================
// Test Data - Known Vectors for Deterministic Testing
// ============================================================================

// Test private key (DO NOT use in production!)
const TEST_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

// ============================================================================
// Event ID Calculation Tests - CRITICAL FOR iOS/Android COMPATIBILITY
// ============================================================================

describe('Event ID Calculation', () => {
  describe('serializeEventForId', () => {
    it('should serialize event in correct NIP-01 format [0, pubkey, created_at, kind, tags, content]', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello, Nostr!',
      };

      const serialized = serializeEventForId(event);

      // Verify format
      expect(serialized).toMatch(/^\[0,/);
      expect(serialized).toContain(`"${'a'.repeat(64)}"`);
      expect(serialized).toContain(',1704067200,');
      expect(serialized).toContain(',1,');
      expect(serialized).toContain(',"Hello, Nostr!"]');
    });

    it('should produce compact JSON with no spaces', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [['tag', 'value']],
        content: 'test',
      };

      const serialized = serializeEventForId(event);

      // Should not have spaces after colons or commas
      expect(serialized).not.toMatch(/: /);
      expect(serialized).not.toMatch(/, /);
    });

    it('should not HTML escape characters', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test <script>alert("xss")</script>',
      };

      const serialized = serializeEventForId(event);

      // Should NOT have HTML entities
      expect(serialized).not.toContain('&lt;');
      expect(serialized).not.toContain('&gt;');
      expect(serialized).not.toContain('&amp;');
      // Should have literal characters
      expect(serialized).toContain('<script>');
      expect(serialized).toContain('</script>');
    });

    it('should preserve array order exactly', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 20000,
        tags: [
          ['g', 'dr5regw7'],
          ['n', 'Alice'],
          ['t', 'teleport'],
        ],
        content: 'Location message',
      };

      const serialized = serializeEventForId(event);

      // Tags should appear in exact order
      expect(serialized).toContain('[["g","dr5regw7"],["n","Alice"],["t","teleport"]]');
    });

    it('should serialize numbers as integers (no decimal points)', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 20000,
        tags: [],
        content: 'test',
      };

      const serialized = serializeEventForId(event);

      // Timestamps and kinds should be integers
      expect(serialized).toContain(',1704067200,');
      expect(serialized).not.toContain('1704067200.0');
      expect(serialized).toContain(',20000,');
      expect(serialized).not.toContain('20000.0');
    });
  });

  describe('calculateEventId', () => {
    it('should calculate deterministic event ID for known input', () => {
      const event = EVENT_ID_VECTORS.textNote.event;

      // Calculate ID twice - should be identical
      const id1 = calculateEventId(event);
      const id2 = calculateEventId(event);

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(64);
      expect(id1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce different IDs for different content', () => {
      const event1 = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello',
      };

      const event2 = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'World',
      };

      const id1 = calculateEventId(event1);
      const id2 = calculateEventId(event2);

      expect(id1).not.toBe(id2);
    });

    it('should produce different IDs for different timestamps', () => {
      const event1 = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const event2 = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067201,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      expect(calculateEventId(event1)).not.toBe(calculateEventId(event2));
    });

    it('should produce different IDs for different pubkeys', () => {
      const event1 = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const event2 = {
        pubkey: 'b'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      expect(calculateEventId(event1)).not.toBe(calculateEventId(event2));
    });

    it('should handle special characters in content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello "world" with\nnewline and\ttab',
      };

      const id = calculateEventId(event);

      expect(id).toHaveLength(64);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle Unicode content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Hello World! Emoji test.',
      };

      const id = calculateEventId(event);

      expect(id).toHaveLength(64);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty content', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: '',
      };

      const id = calculateEventId(event);

      expect(id).toHaveLength(64);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle complex nested tags', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [
          ['e', 'b'.repeat(64), 'wss://relay.example.com', 'root'],
          ['p', 'c'.repeat(64), 'wss://relay.example.com'],
          ['g', 'dr5regw7'],
        ],
        content: 'Reply with location',
      };

      const id = calculateEventId(event);

      expect(id).toHaveLength(64);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyEventId', () => {
    it('should return true for event with correct ID', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      expect(verifyEventId(event)).toBe(true);
    });

    it('should return false for event with incorrect ID', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      // Tamper with the ID
      const tamperedEvent = { ...event, id: 'x'.repeat(64) };

      expect(verifyEventId(tamperedEvent)).toBe(false);
    });

    it('should return false for event with modified content', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      // Tamper with the content (ID should no longer match)
      const tamperedEvent = { ...event, content: 'Modified' };

      expect(verifyEventId(tamperedEvent)).toBe(false);
    });
  });
});

// ============================================================================
// JSON Serialization Determinism Tests
// ============================================================================

describe('JSON Serialization Determinism', () => {
  it('should produce identical output for same input every time', () => {
    const event = {
      pubkey: 'a'.repeat(64),
      created_at: 1704067200,
      kind: 1,
      tags: [['g', 'dr5regw7'], ['n', 'TestUser']],
      content: 'Hello, world!',
    };

    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(serializeEventForId(event));
    }

    // All 100 serializations should be identical
    expect(results.size).toBe(1);
  });

  it('should match expected serialization for test vectors', () => {
    // Text note
    expect(serializeEventForId(EVENT_ID_VECTORS.textNote.event))
      .toBe(EVENT_ID_VECTORS.textNote.expectedSerialization);

    // Ephemeral location event
    expect(serializeEventForId(EVENT_ID_VECTORS.ephemeralLocationEvent.event))
      .toBe(EVENT_ID_VECTORS.ephemeralLocationEvent.expectedSerialization);

    // DM rumor
    expect(serializeEventForId(EVENT_ID_VECTORS.dmRumor.event))
      .toBe(EVENT_ID_VECTORS.dmRumor.expectedSerialization);

    // Seal event
    expect(serializeEventForId(EVENT_ID_VECTORS.sealEvent.event))
      .toBe(EVENT_ID_VECTORS.sealEvent.expectedSerialization);

    // Gift wrap event
    expect(serializeEventForId(EVENT_ID_VECTORS.giftWrapEvent.event))
      .toBe(EVENT_ID_VECTORS.giftWrapEvent.expectedSerialization);
  });
});

// ============================================================================
// Signature Verification Tests
// ============================================================================

describe('Signature Verification', () => {
  describe('verifyEventSignature', () => {
    it('should verify valid signature', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test message', privateKey);

      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should reject invalid signature (wrong signature bytes)', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test message', privateKey);

      // Tamper with signature
      const tamperedEvent = { ...event, sig: 'a'.repeat(128) };

      expect(verifyEventSignature(tamperedEvent)).toBe(false);
    });

    it('should reject signature from different private key', () => {
      const privateKey1 = generatePrivateKey();
      const privateKey2 = generatePrivateKey();

      const event = createSignedEvent(1, 'Test message', privateKey1);

      // Get signature from a different event signed with different key
      const otherEvent = createSignedEvent(1, 'Test message', privateKey2);

      // Replace signature with one from different key
      const tamperedEvent = { ...event, sig: otherEvent.sig };

      expect(verifyEventSignature(tamperedEvent)).toBe(false);
    });

    it('should reject event with modified content', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Original content', privateKey);

      // Tamper with content
      const tamperedEvent = { ...event, content: 'Modified content' };

      expect(verifyEventSignature(tamperedEvent)).toBe(false);
    });

    it('should reject event with incorrect ID', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test message', privateKey);

      // Tamper with ID
      const tamperedEvent = { ...event, id: 'b'.repeat(64) };

      expect(verifyEventSignature(tamperedEvent)).toBe(false);
    });
  });

  describe('verifyEvent (comprehensive)', () => {
    it('should return valid for correctly signed event', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test message', privateKey);

      const result = verifyEvent(event);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid with error for malformed pubkey', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      const malformedEvent = { ...event, pubkey: 'not-valid-hex' };

      const result = verifyEvent(malformedEvent);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid with error for wrong ID', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      const tamperedEvent = { ...event, id: 'a'.repeat(64) };

      const result = verifyEvent(tamperedEvent);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid event ID');
    });

    it('should return invalid with error for bad signature', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);

      const tamperedEvent = { ...event, sig: 'a'.repeat(128) };

      const result = verifyEvent(tamperedEvent);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// Invalid Event Rejection Tests
// ============================================================================

describe('Invalid Event Rejection', () => {
  describe('validateEventStructure', () => {
    it('should reject event with missing pubkey', () => {
      const event = {
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      } as unknown as UnsignedNostrEvent;

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
    });

    it('should reject event with short pubkey', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'a'.repeat(63), // 63 instead of 64
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('64');
    });

    it('should reject event with uppercase pubkey', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'A'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject event with invalid hex pubkey', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'g'.repeat(64), // 'g' is not valid hex
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
    });

    it('should reject event with negative timestamp', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'a'.repeat(64),
        created_at: -1,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-negative');
    });

    it('should reject event with non-integer timestamp', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200.5,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('integer');
    });

    it('should reject event with negative kind', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: -1,
        tags: [],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-negative');
    });

    it('should reject event with non-array tags', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: 'not an array',
        content: 'Test',
      } as unknown as UnsignedNostrEvent;

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('array');
    });

    it('should reject event with non-array tag element', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: ['not', 'arrays'] as unknown as string[][],
        content: 'Test',
      } as unknown as UnsignedNostrEvent;

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('array');
    });

    it('should reject event with non-string tag value', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [['g', 123]] as unknown as string[][],
        content: 'Test',
      } as UnsignedNostrEvent;

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject signed event with short id', () => {
      const event: NostrEvent = {
        id: 'a'.repeat(63), // 63 instead of 64
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'a'.repeat(128),
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('64');
    });

    it('should reject signed event with short sig', () => {
      const event: NostrEvent = {
        id: 'a'.repeat(64),
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'a'.repeat(127), // 127 instead of 128
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('128');
    });

    it('should accept valid unsigned event', () => {
      const event: UnsignedNostrEvent = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [['g', 'dr5regw7']],
        content: 'Test',
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(true);
    });

    it('should accept valid signed event', () => {
      const event: NostrEvent = {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'c'.repeat(128),
      };

      const result = validateEventStructure(event);

      expect(result.valid).toBe(true);
    });
  });

  describe('parseEvent', () => {
    it('should parse valid JSON event', () => {
      const privateKey = generatePrivateKey();
      const event = createSignedEvent(1, 'Test', privateKey);
      const json = JSON.stringify(event);

      const parsed = parseEvent(json);

      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(event.id);
      expect(parsed!.content).toBe('Test');
    });

    it('should return null for invalid JSON', () => {
      expect(parseEvent('not valid json')).toBeNull();
      expect(parseEvent('{')).toBeNull();
      expect(parseEvent('')).toBeNull();
    });

    it('should return null for JSON that is not an event', () => {
      expect(parseEvent('null')).toBeNull();
      expect(parseEvent('[]')).toBeNull();
      expect(parseEvent('"string"')).toBeNull();
      expect(parseEvent('123')).toBeNull();
      expect(parseEvent('{"not": "an event"}')).toBeNull();
    });
  });

  describe('isNostrEvent', () => {
    it('should return true for valid NostrEvent', () => {
      const event = {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'c'.repeat(128),
      };

      expect(isNostrEvent(event)).toBe(true);
    });

    it('should return false for missing fields', () => {
      expect(isNostrEvent({})).toBe(false);
      expect(isNostrEvent({ id: 'a'.repeat(64) })).toBe(false);
      expect(isNostrEvent(null)).toBe(false);
      expect(isNostrEvent(undefined)).toBe(false);
    });
  });

  describe('isUnsignedNostrEvent', () => {
    it('should return true for valid unsigned event', () => {
      const event = {
        pubkey: 'a'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      expect(isUnsignedNostrEvent(event)).toBe(true);
    });

    it('should return false for signed event', () => {
      const event = {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: 1704067200,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: 'c'.repeat(128),
      };

      expect(isUnsignedNostrEvent(event)).toBe(false);
    });
  });
});

// ============================================================================
// Event Kind Support Tests
// ============================================================================

describe('Event Kind Support', () => {
  describe('NostrEventKind constants', () => {
    it('should have correct kind values', () => {
      expect(NostrEventKind.METADATA).toBe(0);
      expect(NostrEventKind.TEXT_NOTE).toBe(1);
      expect(NostrEventKind.SEAL).toBe(13);
      expect(NostrEventKind.DM_RUMOR).toBe(14);
      expect(NostrEventKind.GIFT_WRAP).toBe(1059);
      expect(NostrEventKind.EPHEMERAL_EVENT).toBe(20000);
    });

    it('should match native app constants', () => {
      expect(NostrEventKind.METADATA).toBe(NativeEventKinds.METADATA);
      expect(NostrEventKind.TEXT_NOTE).toBe(NativeEventKinds.TEXT_NOTE);
      expect(NostrEventKind.SEAL).toBe(NativeEventKinds.SEAL);
      expect(NostrEventKind.DM_RUMOR).toBe(NativeEventKinds.DM_RUMOR);
      expect(NostrEventKind.GIFT_WRAP).toBe(NativeEventKinds.GIFT_WRAP);
      expect(NostrEventKind.EPHEMERAL_EVENT).toBe(NativeEventKinds.EPHEMERAL_EVENT);
    });
  });

  describe('createMetadataEvent (kind 0)', () => {
    it('should create valid metadata event', () => {
      const privateKey = generatePrivateKey();
      const metadata = {
        name: 'Alice',
        about: 'Test user',
        picture: 'https://example.com/avatar.png',
      };

      const event = createMetadataEvent(privateKey, metadata);

      expect(event.kind).toBe(0);
      expect(JSON.parse(event.content)).toEqual(metadata);
      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('createTextNoteEvent (kind 1)', () => {
    it('should create valid text note', () => {
      const privateKey = generatePrivateKey();

      const event = createTextNoteEvent(privateKey, 'Hello, Nostr!');

      expect(event.kind).toBe(1);
      expect(event.content).toBe('Hello, Nostr!');
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should include provided tags', () => {
      const privateKey = generatePrivateKey();
      const tags = [['t', 'nostr'], ['r', 'https://example.com']];

      const event = createTextNoteEvent(privateKey, 'Tagged post', tags);

      expect(event.tags).toEqual(tags);
    });
  });

  describe('createSealEvent (kind 13)', () => {
    it('should create valid seal event', () => {
      const privateKey = generatePrivateKey();
      const encryptedContent = 'v2:encrypted_rumor_here';

      const event = createSealEvent(privateKey, encryptedContent);

      expect(event.kind).toBe(13);
      expect(event.content).toBe(encryptedContent);
      expect(event.tags).toEqual([]);
      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('createDMRumorEvent (kind 14)', () => {
    it('should create valid DM rumor (unsigned)', () => {
      const pubkey = getPublicKey(generatePrivateKey());

      const rumor = createDMRumorEvent(pubkey, 'Private message');

      expect(rumor.kind).toBe(14);
      expect(rumor.content).toBe('Private message');
      expect(rumor.pubkey).toBe(pubkey);
      expect('id' in rumor).toBe(false);
      expect('sig' in rumor).toBe(false);
    });
  });

  describe('createGiftWrapEvent (kind 1059)', () => {
    it('should create valid gift wrap event', () => {
      const ephemeralKey = generatePrivateKey();
      const recipientPubkey = 'b'.repeat(64);
      const encryptedSeal = 'v2:encrypted_seal_here';

      const event = createGiftWrapEvent(ephemeralKey, recipientPubkey, encryptedSeal);

      expect(event.kind).toBe(1059);
      expect(event.content).toBe(encryptedSeal);
      expect(event.tags).toEqual([['p', recipientPubkey]]);
      expect(verifyEventSignature(event)).toBe(true);
    });
  });

  describe('createEphemeralEvent (kind 20000)', () => {
    it('should create valid ephemeral event with geohash', () => {
      const privateKey = generatePrivateKey();
      const geohash = 'dr5regw7';

      const event = createEphemeralEvent(privateKey, 'Hello from NYC!', geohash);

      expect(event.kind).toBe(20000);
      expect(event.content).toBe('Hello from NYC!');
      expect(event.tags.some((t) => t[0] === 'g' && t[1] === geohash)).toBe(true);
      expect(verifyEventSignature(event)).toBe(true);
    });

    it('should include optional nickname tag', () => {
      const privateKey = generatePrivateKey();
      const geohash = 'dr5regw7';
      const nickname = 'Alice';

      const event = createEphemeralEvent(privateKey, 'Hello!', geohash, nickname);

      expect(event.tags.some((t) => t[0] === 'n' && t[1] === nickname)).toBe(true);
    });

    it('should omit nickname tag when not provided', () => {
      const privateKey = generatePrivateKey();
      const geohash = 'dr5regw7';

      const event = createEphemeralEvent(privateKey, 'Hello!', geohash);

      expect(event.tags.some((t) => t[0] === 'n')).toBe(false);
    });
  });
});

// ============================================================================
// Key Utilities Tests
// ============================================================================

describe('Key Utilities', () => {
  describe('generatePrivateKey', () => {
    it('should generate 64-character hex string', () => {
      const privateKey = generatePrivateKey();

      expect(privateKey).toHaveLength(64);
      expect(privateKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generatePrivateKey());
      }

      // All 100 keys should be unique
      expect(keys.size).toBe(100);
    });
  });

  describe('getPublicKey', () => {
    it('should derive public key from private key', () => {
      const privateKey = generatePrivateKey();
      const publicKey = getPublicKey(privateKey);

      expect(publicKey).toHaveLength(64);
      expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic (same input = same output)', () => {
      const privateKey = generatePrivateKey();
      const pubkey1 = getPublicKey(privateKey);
      const pubkey2 = getPublicKey(privateKey);

      expect(pubkey1).toBe(pubkey2);
    });

    it('should accept Uint8Array input', () => {
      const privateKeyHex = generatePrivateKey();
      const privateKeyBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        privateKeyBytes[i] = parseInt(privateKeyHex.slice(i * 2, i * 2 + 2), 16);
      }

      const fromHex = getPublicKey(privateKeyHex);
      const fromBytes = getPublicKey(privateKeyBytes);

      expect(fromHex).toBe(fromBytes);
    });
  });

  describe('isValidPublicKey', () => {
    it('should return true for valid public key', () => {
      expect(isValidPublicKey('a'.repeat(64))).toBe(true);
      expect(isValidPublicKey('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should return false for invalid public key', () => {
      expect(isValidPublicKey('')).toBe(false);
      expect(isValidPublicKey('a'.repeat(63))).toBe(false);
      expect(isValidPublicKey('a'.repeat(65))).toBe(false);
      expect(isValidPublicKey('A'.repeat(64))).toBe(false); // uppercase
      expect(isValidPublicKey('g'.repeat(64))).toBe(false); // invalid hex
    });
  });

  describe('isValidPrivateKey', () => {
    it('should return true for valid private key', () => {
      expect(isValidPrivateKey('a'.repeat(64))).toBe(true);
    });

    it('should return false for invalid private key', () => {
      expect(isValidPrivateKey('')).toBe(false);
      expect(isValidPrivateKey('a'.repeat(63))).toBe(false);
      expect(isValidPrivateKey('G'.repeat(64))).toBe(false);
    });
  });
});

// ============================================================================
// Timestamp Utilities Tests
// ============================================================================

describe('Timestamp Utilities', () => {
  describe('getCurrentTimestamp', () => {
    it('should return current Unix timestamp in seconds', () => {
      const ts = getCurrentTimestamp();
      const expected = Math.floor(Date.now() / 1000);

      expect(Math.abs(ts - expected)).toBeLessThanOrEqual(1);
    });

    it('should return an integer', () => {
      const ts = getCurrentTimestamp();

      expect(Number.isInteger(ts)).toBe(true);
    });
  });

  describe('getRandomizedTimestamp', () => {
    it('should return timestamp within +/- 15 minutes of now', () => {
      const now = getCurrentTimestamp();
      const randomized = getRandomizedTimestamp();

      // Should be within 900 seconds (15 minutes)
      expect(Math.abs(randomized - now)).toBeLessThanOrEqual(900);
    });

    it('should produce varied timestamps', () => {
      const timestamps = new Set<number>();
      for (let i = 0; i < 100; i++) {
        timestamps.add(getRandomizedTimestamp());
      }

      // Should have some variety (not all the same)
      expect(timestamps.size).toBeGreaterThan(1);
    });
  });
});

// ============================================================================
// Cross-Platform Compatibility Tests (from original file)
// ============================================================================

describe('Cross-Platform Event Compatibility', () => {
  describe('Event Kind Constants', () => {
    it('should have matching event kinds with native apps', () => {
      expect(NOSTR_EVENT_KINDS.METADATA).toBe(NativeEventKinds.METADATA);
      expect(NOSTR_EVENT_KINDS.TEXT_NOTE).toBe(NativeEventKinds.TEXT_NOTE);
      expect(NOSTR_EVENT_KINDS.DM_RUMOR).toBe(NativeEventKinds.DM_RUMOR);
      expect(NOSTR_EVENT_KINDS.SEAL).toBe(NativeEventKinds.SEAL);
      expect(NOSTR_EVENT_KINDS.GIFT_WRAP).toBe(NativeEventKinds.GIFT_WRAP);
      expect(NOSTR_EVENT_KINDS.EPHEMERAL_EVENT).toBe(NativeEventKinds.EPHEMERAL_EVENT);
    });
  });

  describe('Native Format Serialization', () => {
    it('should match calculateEventIdFormat with serializeEventForId', () => {
      const testEvents = [
        EVENT_ID_VECTORS.textNote.event,
        EVENT_ID_VECTORS.ephemeralLocationEvent.event,
        EVENT_ID_VECTORS.dmRumor.event,
        EVENT_ID_VECTORS.sealEvent.event,
        EVENT_ID_VECTORS.giftWrapEvent.event,
      ];

      for (const event of testEvents) {
        const nativeFormat = calculateEventIdFormat(event);
        const compatFormat = serializeEventForId(event);

        expect(compatFormat).toBe(nativeFormat);
      }
    });
  });

  describe('Tag Format Compatibility', () => {
    it('should use correct geohash tag format', () => {
      expect(NativeTagFormats.GEOHASH.tagName).toBe('g');
      expect(NativeTagFormats.GEOHASH.precision).toBe(8);
    });

    it('should use correct nickname tag format', () => {
      expect(NativeTagFormats.NICKNAME.tagName).toBe('n');
    });

    it('should use correct teleport tag format', () => {
      expect(NativeTagFormats.TELEPORT.tagName).toBe('t');
      expect(NativeTagFormats.TELEPORT.value).toBe('teleport');
    });

    it('should use correct pubkey tag format', () => {
      expect(NativeTagFormats.PUBKEY.tagName).toBe('p');
    });
  });
});

// ============================================================================
// NIP-44 Format Compatibility Tests
// ============================================================================

describe('NIP-44 Format Compatibility', () => {
  it('should use v2: prefix', () => {
    expect(NIP44_VECTORS.format.versionPrefix).toBe('v2:');
    expect(NativeEncryptionFormat.VERSION_PREFIX).toBe('v2:');
  });

  it('should use 24-byte nonce', () => {
    expect(NIP44_VECTORS.format.nonceLength).toBe(24);
    expect(NativeEncryptionFormat.NONCE_LENGTH).toBe(24);
  });

  it('should use 16-byte authentication tag', () => {
    expect(NIP44_VECTORS.format.tagLength).toBe(16);
    expect(NativeEncryptionFormat.TAG_LENGTH).toBe(16);
  });
});

// ============================================================================
// Schnorr Signature Format Tests
// ============================================================================

describe('Schnorr Signature Format', () => {
  it('should use 64-byte signatures', () => {
    expect(SCHNORR_VECTORS.format.signatureLength).toBe(64);
  });

  it('should use 32-byte x-only public keys', () => {
    expect(SCHNORR_VECTORS.format.publicKeyLength).toBe(32);
  });

  it('should use 32-byte private keys', () => {
    expect(SCHNORR_VECTORS.format.privateKeyLength).toBe(32);
  });

  it('should produce correctly sized signatures', () => {
    const privateKey = generatePrivateKey();
    const event = createSignedEvent(1, 'Test', privateKey);

    // Signature should be 128 hex chars (64 bytes)
    expect(event.sig).toHaveLength(128);
    expect(event.sig).toMatch(/^[0-9a-f]{128}$/);
  });
});

// ============================================================================
// End-to-End Event Flow Tests
// ============================================================================

describe('End-to-End Event Flow', () => {
  it('should create, sign, serialize, and verify a complete event', () => {
    // Generate keys
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    // Create event
    const event = createSignedEvent(
      NostrEventKind.TEXT_NOTE,
      'End-to-end test message',
      privateKey,
      [['t', 'test']],
      1704067200
    );

    // Verify structure
    expect(event.pubkey).toBe(publicKey);
    expect(event.kind).toBe(1);
    expect(event.content).toBe('End-to-end test message');
    expect(event.tags).toEqual([['t', 'test']]);
    expect(event.created_at).toBe(1704067200);

    // Verify ID calculation
    expect(verifyEventId(event)).toBe(true);

    // Verify signature
    expect(verifyEventSignature(event)).toBe(true);

    // Comprehensive verification
    const result = verifyEvent(event);
    expect(result.valid).toBe(true);

    // Parse from JSON and re-verify
    const json = JSON.stringify(event);
    const parsed = parseEvent(json);
    expect(parsed).not.toBeNull();
    expect(verifyEvent(parsed!).valid).toBe(true);
  });

  it('should detect tampering at any stage', () => {
    const privateKey = generatePrivateKey();
    const event = createSignedEvent(1, 'Original', privateKey);

    // Tamper with content
    const tampered1 = { ...event, content: 'Tampered' };
    expect(verifyEvent(tampered1).valid).toBe(false);

    // Tamper with timestamp
    const tampered2 = { ...event, created_at: event.created_at + 1 };
    expect(verifyEvent(tampered2).valid).toBe(false);

    // Tamper with tags
    const tampered3 = { ...event, tags: [['fake', 'tag']] };
    expect(verifyEvent(tampered3).valid).toBe(false);

    // Tamper with kind
    const tampered4 = { ...event, kind: 9999 };
    expect(verifyEvent(tampered4).valid).toBe(false);
  });
});
