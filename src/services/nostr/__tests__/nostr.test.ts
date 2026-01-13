/**
 * Nostr Service Tests
 *
 * Tests for Nostr event utilities, key validation, timestamps,
 * and non-cryptographic helpers. Cryptographic operations are
 * tested in integration tests since they require real crypto.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  hexToBytes,
  bytesToHex,
  isValidPubkey,
  isValidPrivateKey,
  getCurrentTimestamp,
  getRandomizedTimestamp,
  isFutureTimestamp,
  isExpiredTimestamp,
  serializeEvent,
  createUnsignedEvent,
  createTextNoteEvent,
  createMetadataEvent,
  createChatMessageEvent,
  createLocationChannelEvent,
  createEventDeletionEvent,
  isEphemeralEvent,
  isReplaceableEvent,
  isParameterizedReplaceableEvent,
  getReplaceableEventId,
  cloneEvent,
  toUnsignedEvent,
} from '../events';
import type { NostrEvent, UnsignedNostrEvent } from '../types';
import { EventKinds } from '../kinds';

describe('Nostr Events Service', () => {
  // Use consistent test data
  const testPubkey = 'a'.repeat(64);
  const testEventId = 'b'.repeat(64);
  const testSig = 'c'.repeat(128);

  describe('Hex/Bytes Conversion', () => {
    it('should convert hex to bytes correctly', () => {
      const hex = '48656c6c6f'; // "Hello" in hex
      const bytes = hexToBytes(hex);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(5);
    });

    it('should convert bytes to hex correctly', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('48656c6c6f');
    });

    it('should throw error for invalid hex string (odd length)', () => {
      expect(() => hexToBytes('abc')).toThrow();
    });

    it('should throw error for invalid hex characters', () => {
      expect(() => hexToBytes('ghij')).toThrow();
    });

    it('should round-trip bytes through hex conversion', () => {
      const original = new Uint8Array([0, 127, 255, 128, 1]);
      const hex = bytesToHex(original);
      const restored = hexToBytes(hex);
      expect(Array.from(restored)).toEqual(Array.from(original));
    });

    it('should handle empty arrays', () => {
      const bytes = new Uint8Array([]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('');
      const restored = hexToBytes('');
      expect(restored.length).toBe(0);
    });
  });

  describe('Key Validation', () => {
    describe('isValidPubkey', () => {
      it('should validate correct pubkey format', () => {
        expect(isValidPubkey('a'.repeat(64))).toBe(true);
        expect(isValidPubkey('0123456789abcdef'.repeat(4))).toBe(true);
      });

      it('should reject short pubkeys', () => {
        expect(isValidPubkey('a'.repeat(63))).toBe(false);
      });

      it('should reject long pubkeys', () => {
        expect(isValidPubkey('a'.repeat(65))).toBe(false);
      });

      it('should reject empty string', () => {
        expect(isValidPubkey('')).toBe(false);
      });

      it('should reject non-hex characters', () => {
        expect(isValidPubkey('g'.repeat(64))).toBe(false);
        expect(isValidPubkey('G'.repeat(64))).toBe(false);
      });
    });

    describe('isValidPrivateKey', () => {
      it('should validate correct private key format', () => {
        expect(isValidPrivateKey('a'.repeat(64))).toBe(true);
      });

      it('should reject invalid length', () => {
        expect(isValidPrivateKey('a'.repeat(63))).toBe(false);
        expect(isValidPrivateKey('a'.repeat(65))).toBe(false);
      });
    });
  });

  describe('Timestamp Management', () => {
    it('should get current Unix timestamp in seconds', () => {
      const ts = getCurrentTimestamp();
      const expected = Math.floor(Date.now() / 1000);
      expect(Math.abs(ts - expected)).toBeLessThanOrEqual(1);
    });

    it('should get randomized timestamp within window', () => {
      const now = getCurrentTimestamp();
      const randomized = getRandomizedTimestamp(3600); // 1 hour window
      expect(Math.abs(randomized - now)).toBeLessThanOrEqual(1800);
    });

    it('should use default 2-day window for randomized timestamp', () => {
      const now = getCurrentTimestamp();
      const randomized = getRandomizedTimestamp();
      const twoDaysInSeconds = 2 * 24 * 60 * 60;
      expect(Math.abs(randomized - now)).toBeLessThanOrEqual(twoDaysInSeconds);
    });

    it('should detect future timestamps', () => {
      const future = getCurrentTimestamp() + 120;
      expect(isFutureTimestamp(future)).toBe(true);

      const past = getCurrentTimestamp() - 120;
      expect(isFutureTimestamp(past)).toBe(false);
    });

    it('should allow small clock drift', () => {
      // Timestamps within 60 seconds should not be considered future
      const smallFuture = getCurrentTimestamp() + 30;
      expect(isFutureTimestamp(smallFuture)).toBe(false);
    });

    it('should detect expired timestamps', () => {
      const veryOld = getCurrentTimestamp() - 365 * 24 * 60 * 60 - 1; // Over 1 year old
      expect(isExpiredTimestamp(veryOld)).toBe(true);

      const recent = getCurrentTimestamp() - 3600; // 1 hour old
      expect(isExpiredTimestamp(recent)).toBe(false);
    });
  });

  describe('Event Creation (Unsigned)', () => {
    describe('createUnsignedEvent', () => {
      it('should create unsigned event with correct structure', () => {
        const event = createUnsignedEvent(
          EventKinds.TEXT_NOTE,
          'Hello, Nostr!',
          testPubkey,
          [],
          {}
        );

        expect(event.kind).toBe(EventKinds.TEXT_NOTE);
        expect(event.content).toBe('Hello, Nostr!');
        expect(event.pubkey).toBe(testPubkey);
        expect(event.tags).toEqual([]);
        expect(event.created_at).toBeTypeOf('number');
      });

      it('should use provided timestamp', () => {
        const timestamp = 1234567890;
        const event = createUnsignedEvent(
          EventKinds.TEXT_NOTE,
          'Test',
          testPubkey,
          [],
          { timestamp }
        );

        expect(event.created_at).toBe(timestamp);
      });

      it('should add client tag when requested', () => {
        const event = createUnsignedEvent(
          EventKinds.TEXT_NOTE,
          'Test',
          testPubkey,
          [],
          { addClientTag: true }
        );

        expect(event.tags.some(t => t[0] === 'client')).toBe(true);
      });

      it('should preserve provided tags', () => {
        const tags = [['t', 'test'], ['r', 'relay']];
        const event = createUnsignedEvent(
          EventKinds.TEXT_NOTE,
          'Test',
          testPubkey,
          tags
        );

        expect(event.tags).toContainEqual(['t', 'test']);
        expect(event.tags).toContainEqual(['r', 'relay']);
      });
    });

    describe('createTextNoteEvent', () => {
      it('should create text note with kind 1', () => {
        const event = createTextNoteEvent(testPubkey, 'Hello!');

        expect(event.kind).toBe(EventKinds.TEXT_NOTE);
        expect(event.content).toBe('Hello!');
      });
    });

    describe('createMetadataEvent', () => {
      it('should create metadata event with JSON content', () => {
        const metadata = { name: 'Alice', about: 'Test user' };
        const event = createMetadataEvent(testPubkey, metadata);

        expect(event.kind).toBe(EventKinds.METADATA);
        expect(JSON.parse(event.content)).toEqual(metadata);
      });

      it('should handle complex metadata', () => {
        const metadata = {
          name: 'Bob',
          about: 'Developer',
          picture: 'https://example.com/avatar.jpg',
          nip05: 'bob@example.com',
          website: 'https://bob.dev',
        };
        const event = createMetadataEvent(testPubkey, metadata);
        const parsed = JSON.parse(event.content);

        expect(parsed.name).toBe('Bob');
        expect(parsed.nip05).toBe('bob@example.com');
      });
    });

    describe('createChatMessageEvent', () => {
      it('should create NIP-17 chat message event', () => {
        const recipients = ['recipient1_'.padEnd(64, '0'), 'recipient2_'.padEnd(64, '0')];

        const event = createChatMessageEvent(
          testPubkey,
          recipients,
          'Hello group!'
        );

        expect(event.kind).toBe(EventKinds.CHAT_MESSAGE);
        expect(event.tags.filter(t => t[0] === 'p').length).toBe(2);
      });
    });

    describe('createLocationChannelEvent', () => {
      it('should create location channel event with geohash tag', () => {
        const geohash = '9q8yy';
        const event = createLocationChannelEvent(
          testPubkey,
          'Hello from SF!',
          geohash
        );

        expect(event.kind).toBe(EventKinds.LOCATION_CHANNEL_MESSAGE);
        const geohashTags = event.tags.filter(t => t[0] === 'g');
        expect(geohashTags.length).toBeGreaterThan(0);
      });
    });

    describe('createEventDeletionEvent', () => {
      it('should create deletion event with e tags', () => {
        const eventIds = ['event1_'.padEnd(64, '0'), 'event2_'.padEnd(64, '0')];

        const event = createEventDeletionEvent(
          testPubkey,
          eventIds,
          'Removing old messages'
        );

        expect(event.kind).toBe(EventKinds.EVENT_DELETION);
        expect(event.content).toBe('Removing old messages');
        expect(event.tags.filter(t => t[0] === 'e').length).toBe(2);
      });

      it('should allow empty reason', () => {
        const event = createEventDeletionEvent(testPubkey, [testEventId]);

        expect(event.content).toBe('');
      });
    });
  });

  describe('Event Serialization', () => {
    it('should serialize event to NIP-01 format', () => {
      const event: UnsignedNostrEvent = {
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [['t', 'test']],
        content: 'Hello',
      };

      const serialized = serializeEvent(event);
      const parsed = JSON.parse(serialized);

      expect(parsed[0]).toBe(0);
      expect(parsed[1]).toBe(testPubkey);
      expect(parsed[2]).toBe(1234567890);
      expect(parsed[3]).toBe(1);
      expect(parsed[4]).toEqual([['t', 'test']]);
      expect(parsed[5]).toBe('Hello');
    });

    it('should handle empty tags', () => {
      const event: UnsignedNostrEvent = {
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: 'Test',
      };

      const serialized = serializeEvent(event);
      const parsed = JSON.parse(serialized);

      expect(parsed[4]).toEqual([]);
    });

    it('should handle special characters in content', () => {
      const event: UnsignedNostrEvent = {
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: 'Hello "world" \n\t with special chars',
      };

      const serialized = serializeEvent(event);
      const parsed = JSON.parse(serialized);

      expect(parsed[5]).toBe('Hello "world" \n\t with special chars');
    });
  });

  describe('Event Type Checks', () => {
    describe('Ephemeral Events', () => {
      it('should identify ephemeral events (kind 20000-29999)', () => {
        const ephemeral: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 20000,
          tags: [],
          content: '',
        };

        expect(isEphemeralEvent(ephemeral)).toBe(true);
      });

      it('should identify kind 29999 as ephemeral', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 29999,
          tags: [],
          content: '',
        };

        expect(isEphemeralEvent(event)).toBe(true);
      });

      it('should not identify regular events as ephemeral', () => {
        const regular: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 1,
          tags: [],
          content: '',
        };

        expect(isEphemeralEvent(regular)).toBe(false);
      });

      it('should not identify kind 19999 as ephemeral', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 19999,
          tags: [],
          content: '',
        };

        expect(isEphemeralEvent(event)).toBe(false);
      });
    });

    describe('Replaceable Events', () => {
      it('should identify kind 0 as replaceable', () => {
        const metadata: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 0,
          tags: [],
          content: '',
        };

        expect(isReplaceableEvent(metadata)).toBe(true);
      });

      it('should identify kind 3 as replaceable', () => {
        const contacts: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 3,
          tags: [],
          content: '',
        };

        expect(isReplaceableEvent(contacts)).toBe(true);
      });

      it('should identify kind 10000-19999 as replaceable', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 10002,
          tags: [],
          content: '',
        };

        expect(isReplaceableEvent(event)).toBe(true);
      });

      it('should not identify kind 1 as replaceable', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 1,
          tags: [],
          content: '',
        };

        expect(isReplaceableEvent(event)).toBe(false);
      });
    });

    describe('Parameterized Replaceable Events', () => {
      it('should identify kind 30000-39999 as parameterized replaceable', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 30023,
          tags: [['d', 'my-article']],
          content: '',
        };

        expect(isParameterizedReplaceableEvent(event)).toBe(true);
      });

      it('should get replaceable event ID with d-tag', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 30023,
          tags: [['d', 'my-article']],
          content: '',
        };

        const id = getReplaceableEventId(event);
        expect(id).toBe(`30023:${testPubkey}:my-article`);
      });

      it('should handle empty d-tag', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 30023,
          tags: [['d', '']],
          content: '',
        };

        const id = getReplaceableEventId(event);
        expect(id).toBe(`30023:${testPubkey}:`);
      });

      it('should handle missing d-tag', () => {
        const event: UnsignedNostrEvent = {
          pubkey: testPubkey,
          created_at: getCurrentTimestamp(),
          kind: 30023,
          tags: [],
          content: '',
        };

        const id = getReplaceableEventId(event);
        expect(id).toBe(`30023:${testPubkey}:`);
      });
    });
  });

  describe('Event Utilities', () => {
    it('should clone event with modifications', () => {
      const original: NostrEvent = {
        id: testEventId,
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: 'Original',
        sig: testSig,
      };

      const cloned = cloneEvent(original, { content: 'Cloned' });

      expect(cloned.content).toBe('Cloned');
      expect(cloned.pubkey).toBe(original.pubkey);
      expect(original.content).toBe('Original'); // Original unchanged
    });

    it('should convert signed event to unsigned', () => {
      const signed: NostrEvent = {
        id: testEventId,
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: 'Test',
        sig: testSig,
      };

      const unsigned = toUnsignedEvent(signed);

      expect(unsigned).not.toHaveProperty('id');
      expect(unsigned).not.toHaveProperty('sig');
      expect(unsigned.content).toBe('Test');
      expect(unsigned.pubkey).toBe(testPubkey);
      expect(unsigned.created_at).toBe(1234567890);
      expect(unsigned.kind).toBe(1);
    });

    it('should preserve tags when converting to unsigned', () => {
      const signed: NostrEvent = {
        id: testEventId,
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 1,
        tags: [['t', 'test'], ['p', testPubkey]],
        content: 'Test',
        sig: testSig,
      };

      const unsigned = toUnsignedEvent(signed);

      expect(unsigned.tags).toEqual([['t', 'test'], ['p', testPubkey]]);
    });
  });

  describe('Event Kinds', () => {
    it('should have correct kind values', () => {
      expect(EventKinds.METADATA).toBe(0);
      expect(EventKinds.TEXT_NOTE).toBe(1);
      expect(EventKinds.RELAY_LIST).toBe(10002);
      expect(EventKinds.ENCRYPTED_DM).toBe(4);
      expect(EventKinds.EVENT_DELETION).toBe(5);
      expect(EventKinds.REACTION).toBe(7);
    });
  });
});
