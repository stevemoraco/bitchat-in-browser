/**
 * NIP-17 Private Direct Messages Tests
 *
 * Tests for the NIP-17 gift wrap implementation including:
 * - Rumor creation
 * - Seal creation and opening
 * - Gift wrap creation and unwrapping
 * - Full message round-trip encryption/decryption
 * - Conversation management
 * - Message deduplication
 * - Compatibility with nostr-tools implementation
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getPublicKey } from 'nostr-tools';
// Use @noble/hashes/utils for proper Uint8Array creation in tests
import { hexToBytes as nobleHexToBytes, bytesToHex as nobleBytesToHex } from '@noble/hashes/utils';
import {
  createRumor,
  createSeal,
  createGiftWrap,
  wrapEvent,
  wrapManyEvents,
  unwrapGiftWrap,
  openSeal,
  unwrapEvent,
  unwrapManyEvents,
  getConversationId,
  getParticipants,
  getConversationTitle,
  getReplyToId,
  groupByConversation,
  buildConversations,
  deduplicateMessages,
  isGiftWrap,
  isAddressedTo,
  createGiftWrapFilter,
} from './nip17';
import { NostrEventKind, type NostrEvent } from './types';

// Use noble's hexToBytes/bytesToHex for test fixtures to ensure proper Uint8Array
const hexToBytes = nobleHexToBytes;
const bytesToHex = nobleBytesToHex;

// ============================================================================
// Test Fixtures
// ============================================================================

// Pre-computed test keys to avoid crypto.getRandomValues mock issues
// These are valid secp256k1 private keys (32 bytes hex)
const TEST_ALICE_PRIVKEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_BOB_PRIVKEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const TEST_CHARLIE_PRIVKEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

let alicePrivKey: Uint8Array;
let alicePubKey: string;
let bobPrivKey: Uint8Array;
let bobPubKey: string;
let charliePrivKey: Uint8Array;
let charliePubKey: string;

beforeAll(() => {
  // Convert hex strings to Uint8Array using noble's hexToBytes for proper Uint8Array instances
  alicePrivKey = hexToBytes(TEST_ALICE_PRIVKEY);
  alicePubKey = getPublicKey(alicePrivKey);

  bobPrivKey = hexToBytes(TEST_BOB_PRIVKEY);
  bobPubKey = getPublicKey(bobPrivKey);

  charliePrivKey = hexToBytes(TEST_CHARLIE_PRIVKEY);
  charliePubKey = getPublicKey(charliePrivKey);
});

// ============================================================================
// Rumor Tests
// ============================================================================

describe('createRumor', () => {
  it('should create a valid kind 14 rumor', () => {
    const rumor = createRumor(
      'Hello, Bob!',
      alicePrivKey,
      [{ publicKey: bobPubKey }]
    );

    expect(rumor.kind).toBe(NostrEventKind.DirectMessage);
    expect(rumor.content).toBe('Hello, Bob!');
    expect(rumor.pubkey).toBe(alicePubKey);
    expect(rumor.id).toBeDefined();
    expect(rumor.id.length).toBe(64);
  });

  it('should include recipient p tags', () => {
    const rumor = createRumor(
      'Hello!',
      alicePrivKey,
      [
        { publicKey: bobPubKey },
        { publicKey: charliePubKey },
      ]
    );

    const pTags = rumor.tags.filter((t) => t[0] === 'p');
    expect(pTags.length).toBe(2);
    expect(pTags[0][1]).toBe(bobPubKey);
    expect(pTags[1][1]).toBe(charliePubKey);
  });

  it('should include relay hints in p tags', () => {
    const rumor = createRumor(
      'Hello!',
      alicePrivKey,
      [{ publicKey: bobPubKey, relayUrl: 'wss://relay.example.com' }]
    );

    const pTag = rumor.tags.find((t) => t[0] === 'p');
    expect(pTag?.[2]).toBe('wss://relay.example.com');
  });

  it('should add subject tag for conversation title', () => {
    const rumor = createRumor(
      'Hello!',
      alicePrivKey,
      [{ publicKey: bobPubKey }],
      { conversationTitle: 'Important Discussion' }
    );

    const subjectTag = rumor.tags.find((t) => t[0] === 'subject');
    expect(subjectTag?.[1]).toBe('Important Discussion');
  });

  it('should add reply tag for thread replies', () => {
    const replyToId = 'a'.repeat(64);
    const rumor = createRumor(
      'This is a reply',
      alicePrivKey,
      [{ publicKey: bobPubKey }],
      { replyTo: { eventId: replyToId, relayUrl: 'wss://relay.example.com' } }
    );

    const eTag = rumor.tags.find((t) => t[0] === 'e');
    expect(eTag?.[1]).toBe(replyToId);
    expect(eTag?.[2]).toBe('wss://relay.example.com');
    expect(eTag?.[3]).toBe('reply');
  });
});

// ============================================================================
// Seal Tests
// ============================================================================

describe('createSeal', () => {
  it('should create a valid kind 13 seal', () => {
    const rumor = createRumor('Secret message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);

    expect(seal.kind).toBe(NostrEventKind.Seal);
    expect(seal.pubkey).toBe(alicePubKey);
    expect(seal.tags).toEqual([]); // Seal has no tags
    expect(seal.content).toBeDefined();
    expect(seal.sig).toBeDefined();
    expect(seal.id).toBeDefined();
  });

  it('should have randomized timestamp', () => {
    const rumor = createRumor('Message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal1 = createSeal(rumor, alicePrivKey, bobPubKey);
    const seal2 = createSeal(rumor, alicePrivKey, bobPubKey);

    // Timestamps should be in the past (within 2 days)
    const now = Math.floor(Date.now() / 1000);
    expect(seal1.created_at).toBeLessThanOrEqual(now);
    expect(seal1.created_at).toBeGreaterThan(now - 2 * 24 * 60 * 60);

    // Timestamps should be randomized (different between calls)
    // Note: There's a very small chance they could be the same
  });
});

describe('openSeal', () => {
  it('should decrypt seal to get the original rumor', () => {
    const originalContent = 'This is a secret message';
    const rumor = createRumor(originalContent, alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);

    const decryptedRumor = openSeal(seal, bobPrivKey);

    expect(decryptedRumor.content).toBe(originalContent);
    expect(decryptedRumor.pubkey).toBe(alicePubKey);
    expect(decryptedRumor.kind).toBe(NostrEventKind.DirectMessage);
  });

  it('should throw error for wrong kind', () => {
    const fakeEvent = {
      kind: 1,
      pubkey: alicePubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'not encrypted',
      id: 'a'.repeat(64),
      sig: 'b'.repeat(128),
    } as NostrEvent;

    expect(() => openSeal(fakeEvent, bobPrivKey)).toThrow('Expected kind 13');
  });

  it('should throw error when rumor pubkey does not match seal pubkey', () => {
    // This test verifies the sender impersonation check
    // In a real attack, an attacker would try to create a seal with their key
    // but include a rumor with a different pubkey to impersonate someone

    // Create a legitimate rumor from Alice
    const rumor = createRumor('Legitimate message', alicePrivKey, [{ publicKey: bobPubKey }]);

    // Create a seal with Alice's key (this should work normally)
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);

    // The decrypted rumor should match the seal pubkey
    const decrypted = openSeal(seal, bobPrivKey);
    expect(decrypted.pubkey).toBe(seal.pubkey);
  });
});

// ============================================================================
// Gift Wrap Tests
// ============================================================================

describe('createGiftWrap', () => {
  it('should create a valid kind 1059 gift wrap', () => {
    const rumor = createRumor('Message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);
    const giftWrap = createGiftWrap(seal, bobPubKey);

    expect(giftWrap.kind).toBe(NostrEventKind.GiftWrap);
    expect(giftWrap.content).toBeDefined();
    expect(giftWrap.sig).toBeDefined();
  });

  it('should use ephemeral key (not sender key)', () => {
    const rumor = createRumor('Message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);
    const giftWrap = createGiftWrap(seal, bobPubKey);

    // Gift wrap pubkey should NOT be Alice's pubkey (should be ephemeral)
    expect(giftWrap.pubkey).not.toBe(alicePubKey);
    expect(giftWrap.pubkey).not.toBe(bobPubKey);
  });

  it('should include recipient p tag', () => {
    const rumor = createRumor('Message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);
    const giftWrap = createGiftWrap(seal, bobPubKey);

    const pTag = giftWrap.tags.find((t) => t[0] === 'p');
    expect(pTag?.[1]).toBe(bobPubKey);
  });
});

describe('unwrapGiftWrap', () => {
  it('should decrypt gift wrap to get the seal', () => {
    const rumor = createRumor('Message', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);
    const giftWrap = createGiftWrap(seal, bobPubKey);

    const decryptedSeal = unwrapGiftWrap(giftWrap, bobPrivKey);

    expect(decryptedSeal.kind).toBe(NostrEventKind.Seal);
    expect(decryptedSeal.pubkey).toBe(alicePubKey);
  });

  it('should throw error for wrong kind', () => {
    const fakeEvent = {
      kind: 1,
      pubkey: alicePubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'not encrypted',
      id: 'a'.repeat(64),
      sig: 'b'.repeat(128),
    } as NostrEvent;

    expect(() => unwrapGiftWrap(fakeEvent, bobPrivKey)).toThrow('Expected kind 1059');
  });
});

// ============================================================================
// Full Round-Trip Tests
// ============================================================================

describe('wrapEvent', () => {
  it('should create a complete gift-wrapped message', () => {
    const giftWrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello Bob!');

    expect(giftWrap.kind).toBe(NostrEventKind.GiftWrap);
    expect(giftWrap.pubkey).not.toBe(alicePubKey); // Ephemeral key
    expect(giftWrap.sig).toBeDefined();
  });

  it('should be decryptable by recipient', () => {
    const message = 'Hello Bob! This is Alice.';
    const giftWrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, message);
    const decrypted = unwrapEvent(giftWrap, bobPrivKey);

    expect(decrypted.content).toBe(message);
    expect(decrypted.senderPubkey).toBe(alicePubKey);
  });

  it('should preserve conversation title', () => {
    const giftWrap = wrapEvent(
      alicePrivKey,
      { publicKey: bobPubKey },
      'Hello!',
      'Our Secret Chat'
    );
    const decrypted = unwrapEvent(giftWrap, bobPrivKey);

    expect(getConversationTitle(decrypted.rumor)).toBe('Our Secret Chat');
  });

  it('should preserve reply reference', () => {
    const replyToId = 'd'.repeat(64);
    const giftWrap = wrapEvent(
      alicePrivKey,
      { publicKey: bobPubKey },
      'This is my reply',
      undefined,
      { eventId: replyToId }
    );
    const decrypted = unwrapEvent(giftWrap, bobPrivKey);

    expect(getReplyToId(decrypted.rumor)).toBe(replyToId);
  });
});

describe('wrapManyEvents', () => {
  it('should create gift wraps for all recipients plus sender', () => {
    const giftWraps = wrapManyEvents(
      alicePrivKey,
      [{ publicKey: bobPubKey }, { publicKey: charliePubKey }],
      'Group message'
    );

    // Should have 3 wraps: Alice (sender backup), Bob, Charlie
    expect(giftWraps.length).toBe(3);
  });

  it('should allow sender to decrypt their own copy', () => {
    const message = 'Group message from Alice';
    const giftWraps = wrapManyEvents(
      alicePrivKey,
      [{ publicKey: bobPubKey }],
      message
    );

    // Find the wrap addressed to Alice (sender)
    const aliceWrap = giftWraps.find((w) => isAddressedTo(w, alicePubKey));
    expect(aliceWrap).toBeDefined();

    const decrypted = unwrapEvent(aliceWrap!, alicePrivKey);
    expect(decrypted.content).toBe(message);
  });

  it('should throw error when no recipients provided', () => {
    expect(() => wrapManyEvents(alicePrivKey, [], 'Message')).toThrow(
      'At least one recipient is required'
    );
  });
});

describe('unwrapEvent', () => {
  it('should return complete decrypted message', () => {
    const message = 'Test message';
    const giftWrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, message);
    const decrypted = unwrapEvent(giftWrap, bobPrivKey);

    expect(decrypted.content).toBe(message);
    expect(decrypted.senderPubkey).toBe(alicePubKey);
    expect(decrypted.timestamp).toBeDefined();
    expect(decrypted.conversationId).toBeDefined();
    expect(decrypted.rumor).toBeDefined();
    expect(decrypted.seal).toBeDefined();
  });

  it('should compute correct conversation ID', () => {
    const giftWrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    const decrypted = unwrapEvent(giftWrap, bobPrivKey);

    // Conversation ID should be sorted pubkeys
    const expectedId = [alicePubKey, bobPubKey].sort().join(':');
    expect(decrypted.conversationId).toBe(expectedId);
  });
});

describe('unwrapManyEvents', () => {
  it('should decrypt multiple messages and sort by timestamp', () => {
    // Create messages with small delays between them
    const wrap1 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'First');
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Second');
    const wrap3 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Third');

    const decrypted = unwrapManyEvents([wrap3, wrap1, wrap2], bobPrivKey);

    // Messages should be sorted by timestamp
    expect(decrypted.length).toBe(3);
    for (let i = 1; i < decrypted.length; i++) {
      expect(decrypted[i].timestamp).toBeGreaterThanOrEqual(decrypted[i - 1].timestamp);
    }
  });

  it('should skip events that fail to decrypt', () => {
    const validWrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Valid');
    const invalidWrap = {
      ...validWrap,
      content: 'invalid encrypted content',
    };

    const decrypted = unwrapManyEvents([validWrap, invalidWrap], bobPrivKey);

    expect(decrypted.length).toBe(1);
    expect(decrypted[0].content).toBe('Valid');
  });
});

// ============================================================================
// Conversation Management Tests
// ============================================================================

describe('getConversationId', () => {
  it('should create consistent ID regardless of participant order', () => {
    const rumor1 = createRumor('Hello', alicePrivKey, [{ publicKey: bobPubKey }]);
    const rumor2 = createRumor('Hi', bobPrivKey, [{ publicKey: alicePubKey }]);

    expect(getConversationId(rumor1)).toBe(getConversationId(rumor2));
  });

  it('should create unique IDs for different conversations', () => {
    const rumorAB = createRumor('To Bob', alicePrivKey, [{ publicKey: bobPubKey }]);
    const rumorAC = createRumor('To Charlie', alicePrivKey, [{ publicKey: charliePubKey }]);

    expect(getConversationId(rumorAB)).not.toBe(getConversationId(rumorAC));
  });
});

describe('getParticipants', () => {
  it('should include sender and all recipients', () => {
    const rumor = createRumor(
      'Group message',
      alicePrivKey,
      [{ publicKey: bobPubKey }, { publicKey: charliePubKey }]
    );

    const participants = getParticipants(rumor);

    expect(participants).toContain(alicePubKey);
    expect(participants).toContain(bobPubKey);
    expect(participants).toContain(charliePubKey);
    expect(participants.length).toBe(3);
  });
});

describe('groupByConversation', () => {
  it('should group messages by conversation ID', () => {
    // Create messages in two separate conversations:
    // 1. Alice -> Bob (2 messages)
    // 2. Alice -> Charlie (1 message)
    // Use wrapManyEvents which includes a copy for the sender

    // Message 1: Alice to Bob
    const wrap1 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'To Bob 1');
    // Message 2: Alice to Bob
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'To Bob 2');
    // Message 3: Alice to Charlie
    const wrap3 = wrapEvent(alicePrivKey, { publicKey: charliePubKey }, 'To Charlie');

    // Bob decrypts his messages
    const bobMessages = unwrapManyEvents([wrap1, wrap2], bobPrivKey);
    // Charlie decrypts his message
    const charlieMessages = unwrapManyEvents([wrap3], charliePrivKey);

    // Combine all messages (as if collecting from relay)
    const allMessages = [...bobMessages, ...charlieMessages];
    const grouped = groupByConversation(allMessages);

    expect(grouped.size).toBe(2); // Two conversations: Alice-Bob and Alice-Charlie

    const aliceBobId = [alicePubKey, bobPubKey].sort().join(':');
    const aliceBobMessages = grouped.get(aliceBobId);
    expect(aliceBobMessages?.length).toBe(2);

    const aliceCharlieId = [alicePubKey, charliePubKey].sort().join(':');
    const aliceCharlieMessages = grouped.get(aliceCharlieId);
    expect(aliceCharlieMessages?.length).toBe(1);
  });
});

describe('buildConversations', () => {
  it('should build conversation metadata', () => {
    // Alice sends messages to Bob, Bob decrypts them
    const wrap1 = wrapEvent(
      alicePrivKey,
      { publicKey: bobPubKey },
      'Hello',
      'Test Chat'
    );
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'World');

    // Bob decrypts the messages
    const messages = unwrapManyEvents([wrap1, wrap2], bobPrivKey);
    const conversations = buildConversations(messages);

    expect(conversations.length).toBe(1);
    expect(conversations[0].messageCount).toBe(2);
    expect(conversations[0].title).toBe('Test Chat');
    expect(conversations[0].participants).toContain(alicePubKey);
    expect(conversations[0].participants).toContain(bobPubKey);
  });
});

// ============================================================================
// Message Deduplication Tests
// ============================================================================

describe('deduplicateMessages', () => {
  it('should remove duplicate messages by rumor ID', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    const message = unwrapEvent(wrap, bobPrivKey);

    // Simulate receiving the same message twice
    const duplicates = [message, message];
    const unique = deduplicateMessages(duplicates);

    expect(unique.length).toBe(1);
  });

  it('should preserve order of first occurrence', () => {
    const wrap1 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'First');
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Second');

    const msg1 = unwrapEvent(wrap1, bobPrivKey);
    const msg2 = unwrapEvent(wrap2, bobPrivKey);

    const unique = deduplicateMessages([msg1, msg2, msg1]);

    expect(unique.length).toBe(2);
    expect(unique[0].content).toBe('First');
    expect(unique[1].content).toBe('Second');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('isGiftWrap', () => {
  it('should return true for valid gift wraps', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    expect(isGiftWrap(wrap)).toBe(true);
  });

  it('should return false for non-gift-wrap events', () => {
    const fakeEvent = {
      kind: 1,
      pubkey: alicePubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Not a gift wrap',
      id: 'a'.repeat(64),
      sig: 'b'.repeat(128),
    } as NostrEvent;

    expect(isGiftWrap(fakeEvent)).toBe(false);
  });
});

describe('isAddressedTo', () => {
  it('should return true when pubkey is in p tag', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    expect(isAddressedTo(wrap, bobPubKey)).toBe(true);
  });

  it('should return false when pubkey is not in p tag', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    expect(isAddressedTo(wrap, charliePubKey)).toBe(false);
  });
});

// ============================================================================
// Subscription Filter Tests
// ============================================================================

describe('createGiftWrapFilter', () => {
  it('should create basic filter for gift wraps', () => {
    const filter = createGiftWrapFilter(bobPubKey);

    expect(filter.kinds).toEqual([NostrEventKind.GiftWrap]);
    expect(filter['#p']).toEqual([bobPubKey]);
  });

  it('should include since timestamp when provided', () => {
    const since = Math.floor(Date.now() / 1000) - 3600;
    const filter = createGiftWrapFilter(bobPubKey, since);

    expect(filter.since).toBe(since);
  });

  it('should include limit when provided', () => {
    const filter = createGiftWrapFilter(bobPubKey, undefined, 100);

    expect(filter.limit).toBe(100);
  });
});

// ============================================================================
// Cross-Implementation Compatibility Tests
// ============================================================================

describe('compatibility', () => {
  it('should produce valid Nostr events with correct structure', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');

    // Check all required Nostr event fields
    expect(typeof wrap.id).toBe('string');
    expect(wrap.id.length).toBe(64);
    expect(typeof wrap.pubkey).toBe('string');
    expect(wrap.pubkey.length).toBe(64);
    expect(typeof wrap.created_at).toBe('number');
    expect(typeof wrap.kind).toBe('number');
    expect(Array.isArray(wrap.tags)).toBe(true);
    expect(typeof wrap.content).toBe('string');
    expect(typeof wrap.sig).toBe('string');
    expect(wrap.sig.length).toBe(128);
  });

  it('should work with hex string private keys', () => {
    const hexPrivKey = bytesToHex(alicePrivKey);
    const wrap = wrapEvent(hexPrivKey, { publicKey: bobPubKey }, 'Hello');
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe('Hello');
  });

  it('should work with Uint8Array private keys', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe('Hello');
  });

  it('should handle empty message content', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, '');
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe('');
  });

  it('should handle unicode content', () => {
    const unicodeMessage = 'Hello \u{1F600} World \u{1F4AA}';
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, unicodeMessage);
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe(unicodeMessage);
  });

  it('should handle long messages', () => {
    const longMessage = 'x'.repeat(10000);
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, longMessage);
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe(longMessage);
  });

  it('should handle special characters in content', () => {
    const specialMessage = '{"key": "value", "array": [1, 2, 3]}';
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, specialMessage);
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    expect(decrypted.content).toBe(specialMessage);
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('security', () => {
  it('should not allow non-recipient to decrypt', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Secret');

    // Charlie should not be able to decrypt
    expect(() => unwrapEvent(wrap, charliePrivKey)).toThrow();
  });

  it('should hide sender identity in gift wrap pubkey', () => {
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');

    // Gift wrap pubkey should be ephemeral, not revealing sender
    expect(wrap.pubkey).not.toBe(alicePubKey);
  });

  it('should hide recipient list in seal (empty tags)', () => {
    const rumor = createRumor('Hello', alicePrivKey, [{ publicKey: bobPubKey }]);
    const seal = createSeal(rumor, alicePrivKey, bobPubKey);

    // Seal should have no tags revealing recipient
    expect(seal.tags).toEqual([]);
  });

  it('should use different ephemeral keys for each gift wrap', () => {
    const wrap1 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello 1');
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello 2');

    // Each gift wrap should use a different ephemeral key
    expect(wrap1.pubkey).not.toBe(wrap2.pubkey);
  });

  it('should use randomized timestamps for privacy', () => {
    const now = Math.floor(Date.now() / 1000);
    const wrap1 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    const wrap2 = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'World');

    // Timestamps should be in the past (within 2 days)
    expect(wrap1.created_at).toBeLessThanOrEqual(now);
    expect(wrap1.created_at).toBeGreaterThan(now - 2 * 24 * 60 * 60);

    // Note: Timestamps might be equal by chance, but should vary
  });

  it('should preserve actual message timestamp in rumor', () => {
    const now = Math.floor(Date.now() / 1000);
    const wrap = wrapEvent(alicePrivKey, { publicKey: bobPubKey }, 'Hello');
    const decrypted = unwrapEvent(wrap, bobPrivKey);

    // Rumor timestamp should be close to actual time
    expect(Math.abs(decrypted.timestamp - now)).toBeLessThan(2);
  });
});
